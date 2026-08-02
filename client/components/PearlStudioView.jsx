import React, { useEffect, useMemo, useRef, useState } from "react";
import { executePearlActionEvent } from "../../shared/pearl-action-protocol.js";
import { createPearlEntity } from "../../shared/pearl-entity.js";
import { PEARL_STORE_KEY } from "../../shared/pearl-store.js";
import { listPearlVersions } from "../../shared/pearl-version-history.js";
import {
  listPearlFunctionRecords,
  orderedMovesFromFunction,
  summarizePearlFunctions,
} from "../../shared/pearl-function-moves.js";
import {
  draftOpsToOpMap,
  editorOpsToPearlFunction,
  pearlFunctionToEditorSeed,
} from "../lib/pearl-function-tree-bridge.js";
import {
  readPearlSystemPrompt,
  scrubExecutionRequestsFromSystemPrompt,
} from "../../shared/pearl-system-prompt.js";
import PhysicalPearl from "./PhysicalPearl.jsx";
import PearlFunctionMovesStudio from "./PearlFunctionMovesStudio.jsx";
import PearlAestheticPanel from "./PearlAestheticPanel.jsx";
import LensTreeEditor from "./LensTreeEditor.jsx";
import { normalizePearlAesthetic } from "../../shared/pearl-aesthetic.js";

const REF_KEY = "pearlStudioRefs.v1";
const read = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};

export function createWebPearlStudioReference(pearlId) {
  const ref = crypto.randomUUID();
  const refs = read(REF_KEY, {});
  refs[ref] = { pearlId, createdAt: Date.now(), expiresAt: Date.now() + 10 * 60_000 };
  localStorage.setItem(REF_KEY, JSON.stringify(refs));
  return ref;
}

function leavePearlStudio() {
  try {
    if (window.opener && !window.opener.closed) {
      window.close();
      return;
    }
  } catch { /* cross-origin opener — fall through */ }
  const hash = String(location.hash || "");
  if (hash.includes("pearl-studio")) {
    history.replaceState({}, "", `${location.pathname}${location.search}` || "/");
  }
  location.assign("/");
}

function resolveStudioEntity(localRef) {
  const store = read(PEARL_STORE_KEY, { entities: {} });
  const entities = store.entities || {};
  const ref = localRef ? read(REF_KEY, {})[localRef] : null;
  if (ref && ref.expiresAt >= Date.now() && entities[ref.pearlId]) {
    return entities[ref.pearlId];
  }
  let backupId = null;
  try { backupId = sessionStorage.getItem("pearlStudioActivePearlId"); } catch { /* private */ }
  if (backupId && entities[backupId]) return entities[backupId];
  if (store.activePearlId && entities[store.activePearlId]) return entities[store.activePearlId];
  if (ref?.pearlId && entities[ref.pearlId]) return entities[ref.pearlId];
  return null;
}

export default function PearlStudioView({ localRef }) {
  const initial = useMemo(() => resolveStudioEntity(localRef), [localRef]);
  const [entity, setEntity] = useState(() => initial && createPearlEntity(initial));
  const [status, setStatus] = useState(initial ? "Local · encrypted" : "This local Pearl reference is unavailable.");
  const [name, setName] = useState(initial?.identity?.name || "");
  const [systemPrompt, setSystemPrompt] = useState(() => (
    initial ? scrubExecutionRequestsFromSystemPrompt(readPearlSystemPrompt(initial)) : ""
  ));
  // Prompt is the readable summary; Moves · Weights · Lenses open when structure exists.
  const [structureOpen, setStructureOpen] = useState(() => {
    if (!initial) return false;
    const hasMoves = listPearlFunctionRecords(initial).some((fn) => orderedMovesFromFunction(fn).length >= 1)
      || (initial.moves || []).length > 0;
    const hasWeights = (initial.weights || []).length > 0;
    const hasLenses = (initial.lenses || []).length > 0;
    return hasMoves || hasWeights || hasLenses;
  });
  const [notesOpen, setNotesOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [versionLabel, setVersionLabel] = useState("");
  const [treeEditor, setTreeEditor] = useState(null);
  const timer = useRef();
  const autoOpenedRef = useRef(false);
  const editorSyncRef = useRef(0);
  const channel = useMemo(() => entity ? new BroadcastChannel(`pearl-studio:${entity.id}`) : null, [entity?.id]);
  const versions = entity ? listPearlVersions(entity) : null;
  const functionSummary = entity ? summarizePearlFunctions(entity) : [];

  function openOriginalFunctionEditor(fnId, { reason } = {}) {
    const fn = listPearlFunctionRecords(entity).find((entry) => entry.id === fnId);
    if (!fn) {
      setStatus("No Function to open in the original editor");
      return;
    }
    const seed = pearlFunctionToEditorSeed(fn);
    editorSyncRef.current += 1;
    setTreeEditor({
      ...seed.editor,
      pearlFunctionId: fn.id,
      syncKey: editorSyncRef.current,
    });
    setStructureOpen(true);
    setStatus(reason || "Function editor · drag grips to reorder Moves");
  }

  // Secondary: when structure exists, open Function editor below the prompt hero
  // (never instead of the system prompt).
  useEffect(() => {
    if (!entity || autoOpenedRef.current) return;
    const fns = listPearlFunctionRecords(entity);
    const preferred = fns.find((fn) => orderedMovesFromFunction(fn).length >= 1) || null;
    if (!preferred) return;
    autoOpenedRef.current = true;
    setStructureOpen(true);
    const seed = pearlFunctionToEditorSeed(preferred);
    editorSyncRef.current += 1;
    setTreeEditor({
      ...seed.editor,
      pearlFunctionId: preferred.id,
      syncKey: editorSyncRef.current,
    });
    setStatus("System prompt above · Function editor below");
  }, [entity?.id]);

  useEffect(() => () => channel?.close(), [channel]);
  useEffect(() => {
    const key = (event) => {
      if (event.key !== "Escape") return;
      if (treeEditor) {
        setTreeEditor(null);
        setStatus("Closed Function editor");
        return;
      }
      leavePearlStudio();
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [treeEditor]);
  useEffect(() => {
    if (!channel) return undefined;
    const listener = (event) => {
      if (event.data?.reload || (event.data?.revision && event.data.revision > (entity?.revision || 0))) {
        const next = resolveStudioEntity(localRef);
        if (next) {
          const refreshed = createPearlEntity(next);
          setEntity(refreshed);
          setName(refreshed.identity?.name || "");
          setSystemPrompt(readPearlSystemPrompt(refreshed));
          const companionTouch = event.data?.reason === "reorder-function-moves"
            || event.data?.reason === "decompose-function-move"
            || event.data?.reason === "system-prompt";
          setStatus(event.data?.reason === "reorder-function-moves"
            ? "Companion reordered Moves"
            : event.data?.reason === "decompose-function-move"
              ? "Companion decomposed a Move"
              : event.data?.reason === "system-prompt"
                ? "Companion updated system prompt"
                : "Updated");
          if (companionTouch && event.data?.reason !== "system-prompt") {
            const fnId = treeEditor?.pearlFunctionId
              || listPearlFunctionRecords(refreshed).find((fn) => orderedMovesFromFunction(fn).length >= 1)?.id;
            if (fnId) {
              const fn = listPearlFunctionRecords(refreshed).find((entry) => entry.id === fnId);
              if (fn) {
                const seed = pearlFunctionToEditorSeed(fn);
                editorSyncRef.current += 1;
                setTreeEditor({
                  ...seed.editor,
                  pearlFunctionId: fn.id,
                  syncKey: editorSyncRef.current,
                });
                setStructureOpen(true);
              }
            }
          }
          return;
        }
        setStatus("Changed in another tab · reload to review");
      }
    };
    channel.addEventListener("message", listener);
    return () => channel.removeEventListener("message", listener);
  }, [channel, entity?.revision, localRef, treeEditor?.pearlFunctionId]);

  useEffect(() => {
    const onStorage = (event) => {
      if (event.key !== PEARL_STORE_KEY || !entity?.id) return;
      const next = resolveStudioEntity(localRef);
      if (next && next.revision !== entity.revision) {
        const refreshed = createPearlEntity(next);
        setEntity(refreshed);
        setSystemPrompt(readPearlSystemPrompt(refreshed));
        setStatus("Synced");
      }
    };
    const onMoves = (event) => {
      if (event.detail?.pearlId && event.detail.pearlId !== entity?.id) return;
      const next = resolveStudioEntity(localRef);
      if (!next) return;
      const refreshed = createPearlEntity(next);
      setEntity(refreshed);
      setStatus(event.detail?.operation === "decompose" ? "Decomposed Moves" : "Reordered Moves");
      const fnId = treeEditor?.pearlFunctionId
        || listPearlFunctionRecords(refreshed).find((fn) => orderedMovesFromFunction(fn).length >= 1)?.id;
      if (!fnId) return;
      const fn = listPearlFunctionRecords(refreshed).find((entry) => entry.id === fnId);
      if (!fn) return;
      const seed = pearlFunctionToEditorSeed(fn);
      editorSyncRef.current += 1;
      setTreeEditor({
        ...seed.editor,
        pearlFunctionId: fn.id,
        syncKey: editorSyncRef.current,
      });
      setStructureOpen(true);
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("lens:pearl-function-moves-changed", onMoves);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("lens:pearl-function-moves-changed", onMoves);
    };
  }, [entity?.id, entity?.revision, localRef, treeEditor?.pearlFunctionId]);

  async function run(command, args = {}) {
    const store = read(PEARL_STORE_KEY, { version: 1, entities: {} });
    const current = createPearlEntity(store.entities[entity.id]);
    const executed = await executePearlActionEvent({
      entity: current,
      state: { pearlEntities: store.entities },
      event: {
        pearlId: current.id,
        command,
        args: { pearlId: current.id, ...args },
        surface: "studio",
        expectedRevision: current.revision,
        idempotencyKey: crypto.randomUUID(),
      },
    });
    if (executed.conflict) throw new Error("Changed in another tab · review before applying");
    const entities = { ...(executed.state?.pearlEntities || store.entities), [current.id]: executed.entity };
    localStorage.setItem(PEARL_STORE_KEY, JSON.stringify({ ...store, entities, updatedAt: Date.now() }));
    setEntity(executed.entity);
    channel?.postMessage({ pearlId: current.id, revision: executed.entity.revision });
    return executed.domainResult;
  }

  function scheduleSave(nextName, nextPrompt) {
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setStatus("Saving…");
      try {
        await run("editPearlEntity", {
          pearlId: entity.id,
          expectedRevision: entity.revision,
          idempotencyKey: crypto.randomUUID(),
          patch: {
            systemPrompt: nextPrompt,
            identity: {
              ...entity.identity,
              name: nextName,
              purpose: String(nextPrompt || "").slice(0, 1_000),
              description: String(nextPrompt || "").slice(0, 2_000),
            },
          },
        });
        // Mirror onto shelf pearl when present so Companion wear/reload sees the prompt.
        try {
          const scenesRaw = localStorage.getItem("lens.scenes.v4");
          if (scenesRaw) {
            const scenes = JSON.parse(scenesRaw);
            let changed = false;
            for (const scene of scenes.scenes || []) {
              scene.semanticOrbs = (scene.semanticOrbs || []).map((orb) => {
                if (orb.id !== entity.id) return orb;
                changed = true;
                return { ...orb, systemPrompt: nextPrompt, name: nextName || orb.name };
              });
            }
            if (changed) localStorage.setItem("lens.scenes.v4", JSON.stringify(scenes));
          }
        } catch { /* shelf mirror best-effort */ }
        setStatus("Saved locally");
      } catch (error) {
        setStatus(error.message);
      }
    }, 350);
  }

  async function patchFunction(fnId, mutation) {
    if (mutation?.operation === "reorder") {
      await run("reorderPearlFunctionMoves", {
        functionId: fnId,
        fromIndex: mutation.fromIndex,
        toIndex: mutation.toIndex,
      });
      return;
    }
    if (mutation?.operation === "decompose") {
      await run("decomposePearlFunctionMove", {
        functionId: fnId,
        moveIndex: mutation.moveIndex,
      });
      return;
    }
    const nextFn = mutation;
    const functions = (entity.functions || []).map((entry) => (
      entry.id === fnId
        ? {
          ...entry,
          steps: nextFn.steps,
          graph: nextFn.graph,
          name: nextFn.name || entry.name,
          description: nextFn.description || entry.description,
        }
        : entry
    ));
    const layers = (entity.cognition?.layers || []).map((layer) => {
      if (layer.id !== fnId || layer.kind !== "function") return layer;
      return {
        ...layer,
        definition: {
          ...layer.definition,
          steps: nextFn.steps,
          graph: nextFn.graph,
        },
      };
    });
    await run("editPearlEntity", {
      pearlId: entity.id,
      expectedRevision: entity.revision,
      idempotencyKey: crypto.randomUUID(),
      patch: {
        functions,
        cognition: { ...entity.cognition, layers },
      },
    });
  }

  if (!entity) {
    return <main className="web-pearl-studio">
      <style>{`.web-pearl-studio{box-sizing:border-box;width:min(760px,calc(100vw - 40px));margin:clamp(60px,12vh,150px) auto;color:var(--orb-text,#232825)}.web-pearl-studio button{border:0;border-bottom:1px solid color-mix(in srgb,currentColor 20%,transparent);background:transparent;color:inherit;padding:7px 0;margin-top:18px}`}</style>
      <p role="alert">{status}</p>
      <button type="button" onClick={leavePearlStudio}>Back to Reef</button>
    </main>;
  }

  return <main className="web-pearl-studio" data-testid="pearl-studio">
    <style>{`
      .web-pearl-studio{box-sizing:border-box;width:min(760px,calc(100vw - 40px));margin:clamp(48px,10vh,120px) auto 80px;color:var(--orb-text,#232825)}
      .web-pearl-studio__banner{margin:0 0 14px}
      .web-pearl-studio__banner span{display:block;font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.62;margin-bottom:6px}
      .web-pearl-studio__pearl{display:flex;align-items:center;gap:14px;margin-bottom:10px;flex-wrap:wrap}
      .web-pearl-studio__title{box-sizing:border-box;width:100%;border:0;border-bottom:1px solid color-mix(in srgb,currentColor 14%,transparent);background:transparent;color:inherit;outline:none;padding:0 0 12px;font:500 clamp(26px,4vw,40px)/1.15 inherit}
      .web-pearl-studio__prompt-label{margin:18px 0 8px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.62}
      .web-pearl-studio__prompt{box-sizing:border-box;width:100%;min-height:32vh;border:0;border-bottom:1px solid color-mix(in srgb,currentColor 14%,transparent);background:transparent;color:inherit;resize:vertical;font:400 16px/1.65 inherit;padding:8px 0;outline:none}
      .web-pearl-studio__hint{margin:8px 0 18px;font-size:13px;line-height:1.5;opacity:.72;max-width:58ch}
      .web-pearl-studio__status{margin:0 0 18px;font-size:12px;opacity:.58}
      .web-pearl-studio__actions{display:flex;gap:14px;align-items:center;margin:8px 0 4px;flex-wrap:wrap}
      .web-pearl-studio button{border:0;border-bottom:1px solid color-mix(in srgb,currentColor 20%,transparent);border-radius:0;background:transparent;color:inherit;padding:7px 0;cursor:pointer;font:inherit}
      .web-pearl-studio__close{margin-left:auto;opacity:.72}
      .web-pearl-studio__structure{margin-top:28px;padding-top:18px;border-top:1px solid color-mix(in srgb,currentColor 10%,transparent)}
      .web-pearl-studio__notes{margin-top:10px}
      .web-pearl-studio__notes textarea{box-sizing:border-box;width:100%;min-height:14vh;border:0;border-bottom:1px solid color-mix(in srgb,currentColor 12%,transparent);background:transparent;color:inherit;resize:vertical;font:400 14px/1.65 inherit;padding:10px 0}
      .web-pearl-studio__history{margin-top:28px;padding-top:14px;border-top:1px solid color-mix(in srgb,currentColor 12%,transparent)}
      .web-pearl-studio__history h2{margin:0 0 10px;font:500 13px/1.3 inherit}
      .web-pearl-studio__version{display:grid;gap:4px;padding:10px 0;border-bottom:1px solid color-mix(in srgb,currentColor 8%,transparent)}
      .web-pearl-studio__version-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:6px}
      .web-pearl-studio__name-row{display:flex;gap:12px;align-items:end;margin:12px 0 4px}
      .web-pearl-studio__name-row input{flex:1;border:0;border-bottom:1px solid color-mix(in srgb,currentColor 14%,transparent);background:transparent;color:inherit;padding:0 0 8px;font:inherit}
      .web-pearl-studio [role=status]{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}
      @media(prefers-reduced-motion:reduce){.web-pearl-studio *{animation:none!important;transition:none!important}}
    `}</style>
    <header className="web-pearl-studio__banner" data-testid="studio-banner">
      <span>Pearl Studio</span>
    </header>
    <div className="web-pearl-studio__pearl">
      <PhysicalPearl
        variant={entity.kind === "result" ? "result" : "primary"}
        state="idle"
        size={34}
        decorative
        aesthetic={entity.aesthetic}
        animation={status === "Restored" ? "recover" : status === "Saving…" ? "stream" : null}
      />
      <button
        type="button"
        aria-expanded={structureOpen}
        data-testid="studio-structure-toggle"
        onClick={() => setStructureOpen((v) => !v)}
      >
        {structureOpen ? "Hide structure" : "Moves · Weights · Lenses"}
      </button>
      <button type="button" aria-expanded={notesOpen} onClick={() => setNotesOpen((v) => !v)}>Notes</button>
      <button type="button" aria-expanded={appearanceOpen} onClick={() => setAppearanceOpen((v) => !v)}>Appearance</button>
      <button type="button" aria-expanded={historyOpen} data-testid="pearl-version-history" onClick={() => setHistoryOpen((v) => !v)}>History</button>
      <button type="button" className="web-pearl-studio__close" onClick={leavePearlStudio}>Close Studio</button>
    </div>
    <input
      className="web-pearl-studio__title"
      aria-label="Pearl name"
      data-testid="studio-pearl-name"
      value={name}
      onChange={(event) => { setName(event.target.value); scheduleSave(event.target.value, systemPrompt); }}
    />
    <p className="web-pearl-studio__prompt-label" id="studio-system-prompt-label">System prompt</p>
    <textarea
      className="web-pearl-studio__prompt"
      aria-labelledby="studio-system-prompt-label"
      data-testid="studio-system-prompt"
      value={systemPrompt}
      onChange={(event) => {
        setSystemPrompt(event.target.value);
        scheduleSave(name, event.target.value);
      }}
      placeholder="Taste, instructions, and capability this pearl carries — Companion reads this when worn."
    />
    <p className="web-pearl-studio__hint" data-testid="studio-purpose">
      Companion reads this summary; edit Moves · Weights · Lenses below for fidelity.
      {functionSummary.length
        ? ` Moves groups: ${functionSummary.map((fn) => fn.name).join(" · ")}.`
        : ""}
    </p>
    <p className="web-pearl-studio__status" aria-live="polite">{status}</p>

    {structureOpen && (
      <section className="web-pearl-studio__structure" data-testid="studio-structure">
        <button type="button" data-testid="pearl-organize" onClick={async () => {
          setStatus("Organizing…");
          try {
            const { organizePearlContents, applyOrganizeToPearl } = await import("../../shared/pearl-organize.js");
            const organized = organizePearlContents(entity, { extraText: systemPrompt });
            if (!organized.ok) {
              setStatus(organized.reason);
              return;
            }
            const next = applyOrganizeToPearl(entity, organized);
            await run("editPearlEntity", {
              pearlId: entity.id,
              expectedRevision: entity.revision,
              idempotencyKey: crypto.randomUUID(),
              patch: {
                moves: next.moves,
                functions: next.functions,
                weights: next.weights,
                lenses: next.lenses,
                workingSet: next.workingSet,
                provenance: next.provenance,
              },
            });
            setStatus(`Organized · ${organized.organization.moves.length}M · ${(organized.organization.weights || []).length}W · ${organized.organization.lenses.length}L`);
          } catch (error) {
            setStatus(error.message);
          }
        }}>Organize into Moves → Weights → Lenses</button>
        <PearlFunctionMovesStudio
          entity={entity}
          editorOpen={Boolean(treeEditor)}
          activeFunctionId={treeEditor?.pearlFunctionId || null}
          onOpenOriginalEditor={(fnId) => openOriginalFunctionEditor(fnId)}
        />
        {treeEditor && (
          <LensTreeEditor
            key={`studio-fn-${treeEditor.pearlFunctionId}-${treeEditor.syncKey || 0}`}
            editor={treeEditor}
            opMap={draftOpsToOpMap(treeEditor.seedOps || [])}
            operators={treeEditor.seedOps || []}
            paletteGroups={[]}
            studioSurface
            autoPersist
            createFromProse={async () => {
              throw new Error("AI prose create needs the main workspace — drag Moves to reorder here, then Save.");
            }}
            editFromProse={async () => {
              throw new Error("AI prose revise needs the main workspace — drag Moves to reorder here, then Save.");
            }}
            treeToOperators={() => ({ rootId: null, ops: [] })}
            onClose={() => {
              setTreeEditor(null);
              setStatus("Closed Function editor");
            }}
            onSaveTree={async (_oldId, ops, meta = {}) => {
              const rootId = treeEditor.seedRoot?.id || treeEditor.op?.id;
              const nextFn = editorOpsToPearlFunction(
                listPearlFunctionRecords(entity).find((entry) => entry.id === treeEditor.pearlFunctionId) || {},
                ops,
                rootId,
              );
              await patchFunction(treeEditor.pearlFunctionId, nextFn);
              if (meta?.auto) {
                setStatus(`Autosaved ordered Moves in “${nextFn.name || "Function"}”`);
                return;
              }
              setTreeEditor(null);
              setStatus(`Saved ordered Moves in “${nextFn.name || "Function"}” via original editor`);
            }}
          />
        )}
      </section>
    )}

    {notesOpen && (
      <div className="web-pearl-studio__notes">
        <textarea
          aria-label="Pearl notes"
          value={systemPrompt}
          onChange={(event) => { setSystemPrompt(event.target.value); scheduleSave(name, event.target.value); }}
          placeholder="Same as system prompt — free notes alias"
        />
      </div>
    )}

    {appearanceOpen && (
      <PearlAestheticPanel
        aesthetic={entity.aesthetic}
        title="Appearance"
        compact
        onChange={async (next) => {
          const aesthetic = normalizePearlAesthetic(next);
          await run("setPearlAesthetic", {
            pearlId: entity.id,
            colors: aesthetic.colors,
            material: aesthetic.material,
            light: aesthetic.light,
            surrounding: aesthetic.surrounding,
            label: aesthetic.label,
            preset: aesthetic.preset,
            expectedRevision: entity.revision,
            idempotencyKey: crypto.randomUUID(),
          });
          setStatus("Appearance saved");
          document.dispatchEvent(new CustomEvent("lens:pearl-aesthetic-changed", {
            detail: { aesthetic, pearlId: entity.id },
          }));
        }}
      />
    )}

    {historyOpen && <section className="web-pearl-studio__history" aria-label="Pearl version history">
      <h2>Version history</h2>
      <div className="web-pearl-studio__name-row">
        <input aria-label="Name this version" placeholder="Name this version" value={versionLabel} onChange={(event) => setVersionLabel(event.target.value)} />
        <button type="button" onClick={async () => {
          if (!versionLabel.trim()) return;
          await run("snapshotPearlVersion", { pearlId: entity.id, label: versionLabel.trim(), idempotencyKey: crypto.randomUUID() });
          setVersionLabel("");
          setStatus("Named version saved");
        }}>Save version</button>
      </div>
      <div className="web-pearl-studio__version">
        <strong>{versions.current.label} · current</strong>
        <small>{versions.current.preview.textPreview || "Empty"}</small>
      </div>
      {versions.versions.map((entry) => (
        <div key={entry.id} className="web-pearl-studio__version">
          <strong>{entry.label}{entry.named ? " · named" : ""}</strong>
          <small>{new Date(entry.at).toLocaleString()} · {entry.preview.textPreview || "Empty"}</small>
          <div className="web-pearl-studio__version-actions">
            <button type="button" onClick={async () => {
              await run("restorePearlVersion", { pearlId: entity.id, checkpointId: entry.id, confirmed: true });
              const next = createPearlEntity(read(PEARL_STORE_KEY, { entities: {} }).entities?.[entity.id]);
              setEntity(next);
              setName(next.identity.name || "");
              setSystemPrompt(readPearlSystemPrompt(next));
              setStatus("Restored");
            }}>Restore</button>
          </div>
        </div>
      ))}
      {!versions.versions.length && <p><small>Edits create restorable versions automatically.</small></p>}
    </section>}
    <span role="status" aria-live="polite">{status}</span>
  </main>;
}

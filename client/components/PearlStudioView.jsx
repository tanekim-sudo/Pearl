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
  const [purpose, setPurpose] = useState(
    initial?.identity?.description || initial?.purpose || initial?.results?.[0]?.text || "",
  );
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
    setStatus(reason || "Function editor · drag grips to reorder Moves");
  }

  // Default primary interior: original LensTreeEditor (not buried behind a button).
  useEffect(() => {
    if (!entity || autoOpenedRef.current) return;
    const fns = listPearlFunctionRecords(entity);
    const preferred = fns.find((fn) => orderedMovesFromFunction(fn).length >= 1) || fns[0];
    if (!preferred) return;
    autoOpenedRef.current = true;
    const seed = pearlFunctionToEditorSeed(preferred);
    editorSyncRef.current += 1;
    setTreeEditor({
      ...seed.editor,
      pearlFunctionId: preferred.id,
      syncKey: editorSyncRef.current,
    });
    setStatus("Function editor · ordered Moves");
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
          const companionTouch = event.data?.reason === "reorder-function-moves"
            || event.data?.reason === "decompose-function-move";
          setStatus(event.data?.reason === "reorder-function-moves"
            ? "Companion reordered Moves"
            : event.data?.reason === "decompose-function-move"
              ? "Companion decomposed a Move"
              : "Updated");
          if (companionTouch) {
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
        setEntity(createPearlEntity(next));
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

  function scheduleSave(nextName, nextPurpose) {
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setStatus("Saving…");
      try {
        const results = entity.results.length
          ? entity.results.map((entry, index) => (index ? entry : { ...entry, text: nextPurpose }))
          : [{ id: entity.id, status: "ready", text: nextPurpose }];
        await run("editPearlEntity", {
          pearlId: entity.id,
          expectedRevision: entity.revision,
          idempotencyKey: crypto.randomUUID(),
          patch: {
            identity: { ...entity.identity, name: nextName, description: nextPurpose },
            results,
          },
        });
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
    // Legacy full-function patch path (organize / external).
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

  const purposeLine = entity.identity?.description
    || entity.purpose
    || (functionSummary.length
      ? `Holds ${functionSummary.map((fn) => fn.name).join(" · ")} — each as ordered Moves.`
      : "Open structure below, or ask Companion to organize this pearl.");

  return <main className="web-pearl-studio" data-testid="pearl-studio">
    <style>{`
      .web-pearl-studio{box-sizing:border-box;width:min(760px,calc(100vw - 40px));margin:clamp(48px,10vh,120px) auto 80px;color:var(--orb-text,#232825)}
      .web-pearl-studio__banner{margin:0 0 14px}
      .web-pearl-studio__banner span{display:block;font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.62;margin-bottom:6px}
      .web-pearl-studio__pearl{display:flex;align-items:center;gap:14px;margin-bottom:10px;flex-wrap:wrap}
      .web-pearl-studio__title{box-sizing:border-box;width:100%;border:0;border-bottom:1px solid color-mix(in srgb,currentColor 14%,transparent);background:transparent;color:inherit;outline:none;padding:0 0 12px;font:500 clamp(26px,4vw,40px)/1.15 inherit}
      .web-pearl-studio__purpose{margin:0 0 8px;font-size:15px;line-height:1.55;opacity:.88;max-width:58ch}
      .web-pearl-studio__status{margin:0 0 18px;font-size:12px;opacity:.58}
      .web-pearl-studio__actions{display:flex;gap:14px;align-items:center;margin:8px 0 4px;flex-wrap:wrap}
      .web-pearl-studio button{border:0;border-bottom:1px solid color-mix(in srgb,currentColor 20%,transparent);border-radius:0;background:transparent;color:inherit;padding:7px 0;cursor:pointer;font:inherit}
      .web-pearl-studio__close{margin-left:auto;opacity:.72}
      .web-pearl-studio__notes{margin-top:10px}
      .web-pearl-studio__notes textarea{box-sizing:border-box;width:100%;min-height:18vh;border:0;border-bottom:1px solid color-mix(in srgb,currentColor 12%,transparent);background:transparent;color:inherit;resize:vertical;font:400 14px/1.65 inherit;padding:10px 0}
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
      <button type="button" className="web-pearl-studio__trigger" data-testid="pearl-organize" onClick={async () => {
        setStatus("Organizing…");
        try {
          const { organizePearlContents, applyOrganizeToPearl } = await import("../../shared/pearl-organize.js");
          const organized = organizePearlContents(entity, { extraText: purpose });
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
              lenses: next.lenses,
              workingSet: next.workingSet,
              provenance: next.provenance,
            },
          });
          setStatus(`Organized · ${organized.organization.moves.length}M · ${organized.organization.functions.length}F · ${organized.organization.lenses.length}L`);
        } catch (error) {
          setStatus(error.message);
        }
      }}>Organize</button>
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
      onChange={(event) => { setName(event.target.value); scheduleSave(event.target.value, purpose); }}
    />
    <p className="web-pearl-studio__purpose" data-testid="studio-purpose">{purposeLine}</p>
    <p className="web-pearl-studio__status" aria-live="polite">{status}</p>

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

    {notesOpen && (
      <div className="web-pearl-studio__notes">
        <textarea
          aria-label="Pearl notes"
          value={purpose}
          onChange={(event) => { setPurpose(event.target.value); scheduleSave(name, event.target.value); }}
          placeholder="What this pearl is about — free notes"
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
        <small>rev {versions.current.revision} · {versions.current.preview.textPreview || "Empty"}</small>
      </div>
      {versions.versions.map((entry) => (
        <div key={entry.id} className="web-pearl-studio__version">
          <strong>{entry.label}{entry.named ? " · named" : ""}</strong>
          <small>rev {entry.revision} · {new Date(entry.at).toLocaleString()} · {entry.preview.textPreview || "Empty"}</small>
          <div className="web-pearl-studio__version-actions">
            <button type="button" onClick={async () => {
              await run("restorePearlVersion", { pearlId: entity.id, checkpointId: entry.id, confirmed: true });
              const next = createPearlEntity(read(PEARL_STORE_KEY, { entities: {} }).entities?.[entity.id]);
              setEntity(next);
              setName(next.identity.name || "");
              setPurpose(next.results?.[0]?.text || next.identity.description || "");
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

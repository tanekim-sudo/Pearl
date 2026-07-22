import React, { useEffect, useMemo, useRef, useState } from "react";
import { executePearlActionEvent } from "../../shared/pearl-action-protocol.js";
import { createPearlEntity } from "../../shared/pearl-entity.js";
import { PEARL_STORE_KEY } from "../../shared/pearl-store.js";
import { createPearlStudioViewModel } from "../../shared/pearl-studio.js";
import { listPearlVersions } from "../../shared/pearl-version-history.js";
import PhysicalPearl from "./PhysicalPearl.jsx";
import CognitiveLayerStudio from "./CognitiveLayerStudio.jsx";
import PearlAestheticPanel from "./PearlAestheticPanel.jsx";
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

export default function PearlStudioView({ localRef }) {
  const initial = useMemo(() => {
    const ref = read(REF_KEY, {})[localRef];
    if (!ref || ref.expiresAt < Date.now()) return null;
    return read(PEARL_STORE_KEY, { entities: {} }).entities?.[ref.pearlId] || null;
  }, [localRef]);
  const [entity, setEntity] = useState(() => initial && createPearlEntity(initial));
  const [status, setStatus] = useState(initial ? "Local · encrypted" : "This local Pearl reference is unavailable.");
  const [name, setName] = useState(initial?.identity?.name || "");
  const [text, setText] = useState(initial?.results?.[0]?.text || initial?.identity?.description || "");
  const [structureOpen, setStructureOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [versionLabel, setVersionLabel] = useState("");
  const timer = useRef();
  const channel = useMemo(() => entity ? new BroadcastChannel(`pearl-studio:${entity.id}`) : null, [entity?.id]);
  const view = entity ? createPearlStudioViewModel(entity) : null;
  const versions = entity ? listPearlVersions(entity) : null;

  useEffect(() => () => channel?.close(), [channel]);
  useEffect(() => {
    const key = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setStructureOpen(true);
      } else if (event.key === "Escape") {
        if (structureOpen) setStructureOpen(false);
        else leavePearlStudio();
      }
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [structureOpen]);
  useEffect(() => {
    if (!channel) return undefined;
    const listener = (event) => {
      if (event.data?.revision > entity.revision) setStatus("Changed in another tab · reload to review");
    };
    channel.addEventListener("message", listener);
    return () => channel.removeEventListener("message", listener);
  }, [channel, entity?.revision]);

  async function run(command, args = {}) {
    const store = read(PEARL_STORE_KEY, { version: 1, entities: {} });
    const current = createPearlEntity(store.entities[entity.id]);
    const executed = await executePearlActionEvent({
      entity: current,
      state: { pearlEntities: store.entities },
      event: {
        pearlId: current.id,
        command,
        args,
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

  function scheduleSave(nextName, nextText) {
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setStatus("Saving…");
      try {
        const results = entity.results.length
          ? entity.results.map((entry, index) => index ? entry : { ...entry, text: nextText })
          : [{ id: entity.id, status: "ready", text: nextText }];
        await run("editPearlEntity", {
          pearlId: entity.id,
          expectedRevision: entity.revision,
          idempotencyKey: crypto.randomUUID(),
          patch: { identity: { ...entity.identity, name: nextName }, results },
        });
        setStatus("Saved locally");
      } catch (error) {
        setStatus(error.message);
      }
    }, 350);
  }

  if (!entity) {
    return <main className="web-pearl-studio">
      <style>{`.web-pearl-studio{box-sizing:border-box;width:min(760px,calc(100vw - 40px));margin:clamp(60px,12vh,150px) auto;color:var(--orb-text,#232825)}.web-pearl-studio button{border:0;border-bottom:1px solid color-mix(in srgb,currentColor 20%,transparent);background:transparent;color:inherit;padding:7px 0;margin-top:18px}`}</style>
      <p role="alert">{status}</p>
      <button type="button" onClick={leavePearlStudio}>Back to Reef</button>
    </main>;
  }
  return <main className="web-pearl-studio">
    <style>{`
      .web-pearl-studio{box-sizing:border-box;width:min(760px,calc(100vw - 40px));margin:clamp(60px,12vh,150px) auto;color:var(--orb-text,#232825)}
      .web-pearl-studio__pearl{display:flex;align-items:center;gap:16px;margin-bottom:30px}.web-pearl-studio input,.web-pearl-studio textarea{box-sizing:border-box;width:100%;border:0;border-bottom:1px solid color-mix(in srgb,currentColor 14%,transparent);border-radius:0;background:transparent;color:inherit;outline:none}
      .web-pearl-studio input{padding:0 0 18px;font:500 clamp(24px,4vw,44px)/1.1 inherit}.web-pearl-studio textarea{min-height:42vh;padding:22px 0;resize:vertical;font:400 15px/1.7 inherit}
      .web-pearl-studio__trigger{opacity:0;transition:opacity .16s}.web-pearl-studio:hover .web-pearl-studio__trigger,.web-pearl-studio:focus-within .web-pearl-studio__trigger,.web-pearl-studio__trigger:focus-visible{opacity:.68}.web-pearl-studio__actions{display:flex;gap:14px;align-items:center;margin-top:18px;flex-wrap:wrap}.web-pearl-studio button,.web-pearl-studio select{border:0;border-bottom:1px solid color-mix(in srgb,currentColor 20%,transparent);border-radius:0;background:transparent;color:inherit;padding:7px 0}.web-pearl-studio [role=status]{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}
      .web-pearl-studio details{margin-top:26px;padding-top:10px;border-top:1px solid color-mix(in srgb,currentColor 12%,transparent);font-size:11px}.web-pearl-studio pre{white-space:pre-wrap}
      .web-pearl-studio__close{margin-left:auto;opacity:.72}
      .web-pearl-studio__history{margin-top:28px;padding-top:14px;border-top:1px solid color-mix(in srgb,currentColor 12%,transparent)}
      .web-pearl-studio__history h2{margin:0 0 10px;font:500 13px/1.3 inherit;letter-spacing:.02em}
      .web-pearl-studio__version{display:grid;gap:4px;padding:10px 0;border-bottom:1px solid color-mix(in srgb,currentColor 8%,transparent)}
      .web-pearl-studio__version strong{font-weight:550}.web-pearl-studio__version small{opacity:.62}
      .web-pearl-studio__version-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:6px}
      .web-pearl-studio__name-row{display:flex;gap:12px;align-items:end;margin:12px 0 4px}
      .web-pearl-studio__name-row input{font:400 14px/1.4 inherit!important;padding:0 0 8px!important}
      @media(prefers-reduced-motion:reduce){.web-pearl-studio *{animation:none!important;transition:none!important}}
    `}</style>
    <div className="web-pearl-studio__pearl">
      <PhysicalPearl
        variant={entity.kind === "result" ? "result" : "primary"}
        state="idle"
        size={34}
        decorative
        aesthetic={entity.aesthetic}
        animation={status === "Restored" ? "recover" : status === "Saving…" ? "stream" : null}
      />
      <button type="button" className="web-pearl-studio__trigger" aria-expanded={structureOpen} aria-keyshortcuts="Meta+K Control+K" onClick={() => setStructureOpen((value) => !value)}>Inspect structure</button>
      <button type="button" className="web-pearl-studio__trigger" data-testid="pearl-organize" onClick={async () => {
        setStatus("Organizing…");
        try {
          const { organizePearlContents, applyOrganizeToPearl } = await import("../../shared/pearl-organize.js");
          const organized = organizePearlContents(entity, { extraText: text });
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
      <button type="button" className="web-pearl-studio__trigger" aria-expanded={historyOpen} data-testid="pearl-version-history" onClick={() => setHistoryOpen((value) => !value)}>Version history</button>
      <button type="button" className="web-pearl-studio__close" onClick={leavePearlStudio}>Close Studio</button>
    </div>
    <input aria-label="Pearl name" value={name} onChange={(event) => { setName(event.target.value); scheduleSave(event.target.value, text); }} />
    <textarea aria-label="Pearl content" value={text} onChange={(event) => { setText(event.target.value); scheduleSave(name, event.target.value); }} />
    <PearlAestheticPanel
      aesthetic={entity.aesthetic}
      title="Appearance"
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
              setText(next.results?.[0]?.text || next.identity.description || "");
              setStatus("Restored");
            }}>Restore</button>
          </div>
        </div>
      ))}
      {!versions.versions.length && <p><small>Edits create restorable versions automatically. Name one anytime.</small></p>}
    </section>}
    {structureOpen && <><div className="web-pearl-studio__actions">
      <select aria-label="Representation" value={view.representation} onChange={(event) => run("setPearlStudioRepresentation", { pearlId: entity.id, representation: event.target.value, expectedRevision: entity.revision, idempotencyKey: crypto.randomUUID() })}>
        {view.representations.map((entry) => <option key={entry} value={entry}>{entry.replaceAll("-", " ")}</option>)}
      </select>
      <button type="button" onClick={() => run("undoPearlEntityEdit", { pearlId: entity.id })}>Undo</button>
      <button type="button" onClick={() => run("redoPearlEntityEdit", { pearlId: entity.id })}>Redo</button>
      <span role="status" aria-live="polite">{status}</span>
    </div>
    {entity.cognition.layers.length > 0 && <CognitiveLayerStudio
      cognition={entity.cognition}
      onCommand={(command, args) => run(command, { pearlId: entity.id, ...args })}
    />}
    {view.sections.filter((entry) => !["identity", "outputs", "history"].includes(entry.id)).map((section) => <details key={section.id}><summary>{section.label}</summary><pre>{JSON.stringify(section.value, null, 2)}</pre></details>)}</>}
  </main>;
}

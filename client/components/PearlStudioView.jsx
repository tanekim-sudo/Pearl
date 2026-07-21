import React, { useEffect, useMemo, useRef, useState } from "react";
import { executePearlActionEvent } from "../../shared/pearl-action-protocol.js";
import { createPearlEntity } from "../../shared/pearl-entity.js";
import { PEARL_STORE_KEY } from "../../shared/pearl-store.js";
import { createPearlStudioViewModel } from "../../shared/pearl-studio.js";
import PhysicalPearl from "./PhysicalPearl.jsx";
import CognitiveLayerStudio from "./CognitiveLayerStudio.jsx";

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
  const timer = useRef();
  const channel = useMemo(() => entity ? new BroadcastChannel(`pearl-studio:${entity.id}`) : null, [entity?.id]);
  const view = entity ? createPearlStudioViewModel(entity) : null;

  useEffect(() => () => channel?.close(), [channel]);
  useEffect(() => {
    const key = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setStructureOpen(true);
      } else if (event.key === "Escape") {
        setStructureOpen(false);
      }
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, []);
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

  if (!entity) return <main className="web-pearl-studio"><p role="alert">{status}</p></main>;
  return <main className="web-pearl-studio">
    <style>{`
      .web-pearl-studio{box-sizing:border-box;width:min(760px,calc(100vw - 40px));margin:clamp(60px,12vh,150px) auto;color:var(--orb-text,#232825)}
      .web-pearl-studio__pearl{display:flex;align-items:center;gap:16px;margin-bottom:30px}.web-pearl-studio input,.web-pearl-studio textarea{box-sizing:border-box;width:100%;border:0;border-bottom:1px solid color-mix(in srgb,currentColor 14%,transparent);border-radius:0;background:transparent;color:inherit;outline:none}
      .web-pearl-studio input{padding:0 0 18px;font:500 clamp(24px,4vw,44px)/1.1 inherit}.web-pearl-studio textarea{min-height:42vh;padding:22px 0;resize:vertical;font:400 15px/1.7 inherit}
      .web-pearl-studio__trigger{opacity:0;transition:opacity .16s}.web-pearl-studio:hover .web-pearl-studio__trigger,.web-pearl-studio:focus-within .web-pearl-studio__trigger,.web-pearl-studio__trigger:focus-visible{opacity:.68}.web-pearl-studio__actions{display:flex;gap:14px;align-items:center;margin-top:18px}.web-pearl-studio button,.web-pearl-studio select{border:0;border-bottom:1px solid color-mix(in srgb,currentColor 20%,transparent);border-radius:0;background:transparent;color:inherit;padding:7px 0}.web-pearl-studio [role=status]{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}
      .web-pearl-studio details{margin-top:26px;padding-top:10px;border-top:1px solid color-mix(in srgb,currentColor 12%,transparent);font-size:11px}.web-pearl-studio pre{white-space:pre-wrap}
      @media(prefers-reduced-motion:reduce){.web-pearl-studio *{animation:none!important;transition:none!important}}
    `}</style>
    <div className="web-pearl-studio__pearl">
      <PhysicalPearl variant={entity.kind === "result" ? "result" : "primary"} state="idle" size={34} decorative />
      <button type="button" className="web-pearl-studio__trigger" aria-expanded={structureOpen} aria-keyshortcuts="Meta+K Control+K" onClick={() => setStructureOpen((value) => !value)}>Inspect structure</button>
    </div>
    <input aria-label="Pearl name" value={name} onChange={(event) => { setName(event.target.value); scheduleSave(event.target.value, text); }} />
    <textarea aria-label="Pearl content" value={text} onChange={(event) => { setText(event.target.value); scheduleSave(name, event.target.value); }} />
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
    {view.sections.filter((entry) => !["identity", "outputs"].includes(entry.id)).map((section) => <details key={section.id}><summary>{section.label}</summary><pre>{JSON.stringify(section.value, null, 2)}</pre></details>)}</>}
  </main>;
}

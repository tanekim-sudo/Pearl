import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { TRANSFORM_PRIMITIVES } from "../../../shared/transform-primitives.js";
import { previewCompositionSequence } from "../../../shared/lens-grammar.js";
import { lensRackRecord, selectRack } from "../../../shared/lens-rack.js";
import { createMessage } from "../core/messages.js";
import { portableLensPayload, writeDragPayload } from "../core/portable.js";
import { executeExtensionVerb, parseExtensionIntent } from "./companion.js";
import "./sidepanel.css";

async function call(type, payload = {}) {
  const response = await chrome.runtime.sendMessage(createMessage(type, payload));
  if (!response?.ok) throw new Error(response?.error || "extension request failed");
  return response.value;
}

const builtIns = TRANSFORM_PRIMITIVES.map((operator) => ({
  ...lensRackRecord(operator),
  operator,
}));

function App() {
  const [session, setSession] = useState({ fragments: [], queue: [], generator: null, results: [] });
  const [library, setLibrary] = useState(builtIns);
  const [generators, setGenerators] = useState([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [companion, setCompanion] = useState("");
  const [ghost, setGhost] = useState(false);

  async function refresh() {
    const value = await call("get-session");
    setSession(value);
  }

  useEffect(() => {
    refresh().catch((e) => setError(e.message));
    call("library-refresh").then((data) => {
      if (data.operators?.length) setLibrary(data.operators.map((operator) => ({ ...lensRackRecord(operator, operator.rack), operator })));
      setGenerators(data.generators || []);
    }).catch(() => {});
    const listener = () => refresh().catch(() => {});
    chrome.storage?.onChanged.addListener(listener);
    return () => chrome.storage?.onChanged.removeListener(listener);
  }, []);

  const visible = useMemo(() => selectRack(library, { search: query, limit: 60 }).records, [library, query]);
  const map = useMemo(() => Object.fromEntries(library.map((entry) => [entry.id, entry.operator])), [library]);
  const queuedOps = session.queue.map((entry) => map[entry.id]).filter(Boolean);
  const preview = queuedOps.length ? previewCompositionSequence(queuedOps, map) : null;
  const characters = session.fragments.reduce((sum, entry) => sum + entry.quote.length, 0);

  async function action(type, payload) {
    setError("");
    try {
      const value = await call(type, payload);
      if (value?.fragments || value?.queue || value?.results) setSession(value);
      else await refresh();
      return value;
    } catch (e) {
      setError(e.message);
      return null;
    }
  }

  async function go() {
    if (!characters || (!session.queue.length && !session.generator)) return;
    if ((preview?.requiresConfirmation || characters > 50_000) && !confirm(`Send ${characters.toLocaleString()} selected characters and produce up to ${preview?.predictedOutputCount || 1} outputs?`)) return;
    setRunning(true);
    await action("go", { disclosedCharacters: characters, idempotencyKey: crypto.randomUUID() });
    setRunning(false);
  }

  async function directCompanion(event) {
    event.preventDefault();
    try {
      const command = parseExtensionIntent(companion);
      const outputs = session.results.flatMap((run) => run.outputs);
      await executeExtensionVerb(command.name, command.args, {
        action,
        pressGo: go,
        readPreview: () => preview,
        resolveLens: (name) => {
          const lens = library.find((entry) => entry.id === name || entry.name.toLowerCase().includes(String(name).toLowerCase()));
          if (!lens) throw new Error("lens not found");
          return { id: lens.id, name: lens.name, version: lens.version, kind: "lens" };
        },
        resolveGenerator: (name) => {
          const generator = generators.find((entry) => entry.id === name || entry.name.toLowerCase().includes(String(name).toLowerCase()));
          if (!generator) throw new Error("generator not found");
          return generator;
        },
        resolveResult: (name) => {
          const result = outputs.find((entry) => entry.id === name) || outputs[Number(name) - 1] || outputs[0];
          if (!result) throw new Error("result not found");
          return result;
        },
        animate: async () => {
          setGhost(true);
          await new Promise((resolve) => setTimeout(resolve, 240));
          setGhost(false);
        },
      });
      setCompanion("");
    } catch (e) {
      setError(e.message);
    }
  }

  return <main>
    <header>
      <div><b>Lens</b><span>Everywhere</span></div>
      <button onClick={() => action("auth-login")}>Sign in</button>
    </header>
    <section className="capture">
      <button onClick={() => action("toggle-highlighter")} className="gold">Highlight page</button>
      <button onClick={() => action("capture-selection")}>Capture selection</button>
      <p>{session.fragments.length} fragment{session.fragments.length === 1 ? "" : "s"} · {characters.toLocaleString()} characters</p>
      <div className="fragments">{session.fragments.map((fragment) =>
        <article key={fragment.id}><q>{fragment.quote.slice(0, 180)}</q><small>{fragment.provenance.title} · {fragment.provenance.origin}</small><button aria-label="Remove fragment" onClick={() => action("remove-fragment", { id: fragment.id })}>×</button></article>
      )}</div>
    </section>
    <section>
      <h2>Lens rack</h2>
      <input aria-label="Search lenses" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search lenses" />
      <div className="rack">{visible.map((lens) =>
        <button key={lens.id} draggable onDragStart={(event) => writeDragPayload(event.dataTransfer, portableLensPayload(lens.operator, library.map((entry) => entry.operator)))} onClick={() => action("queue-lens", { lens: { id: lens.id, name: lens.name, version: lens.version, kind: "lens" } })}>
          <b>{lens.name}</b><small>{lens.description}</small>
        </button>
      )}</div>
    </section>
    <section>
      <h2>Ordered stack</h2>
      <ol className="queue">{session.queue.map((lens, index) =>
        <li key={`${lens.id}-${index}`}><span>{lens.name}</span><button disabled={!index} onClick={() => action("reorder-queue", { from: index, to: index - 1 })}>↑</button><button disabled={index === session.queue.length - 1} onClick={() => action("reorder-queue", { from: index, to: index + 1 })}>↓</button><button onClick={() => action("remove-queue", { index })}>×</button></li>
      )}</ol>
      {preview && <p className={preview.ok ? "compat good" : "compat bad"}>{preview.ok ? `${preview.label} · ${preview.predictedOutputCount} output${preview.predictedOutputCount === 1 ? "" : "s"}` : preview.errors[0]}</p>}
      <label>Generator destination<select value={session.generator?.id || ""} onChange={(event) => action("set-generator", { generator: generators.find((item) => item.id === event.target.value) || null })}><option value="">None</option>{generators.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <div className="disclosure">GO sends exactly <b>{characters.toLocaleString()}</b> selected characters from {[...new Set(session.fragments.map((item) => item.provenance.origin))].join(", ") || "no origin"}.</div>
      <button className="go" disabled={running || !characters || (!session.queue.length && !session.generator) || preview?.ok === false} onClick={go}>{running ? "Running…" : "GO"}</button>
      {running && <button onClick={() => action("cancel-run", { runId: session.activeRunId })}>Cancel</button>}
    </section>
    <section>
      <h2>Preview results</h2>
      {!session.results.length && <p className="muted">Results stage here. The page never changes automatically.</p>}
      {session.results.flatMap((run) => run.outputs.map((output) =>
        <article className="result" key={output.id}><p>{output.text}</p><div><button onClick={() => navigator.clipboard.writeText(output.text)}>Copy</button><button onClick={() => action("result-action", { text: output.text, plan: { operation: "insert" } })}>Insert</button><button onClick={() => action("result-action", { text: output.text, plan: { operation: "replace" } })}>Replace</button><button onClick={() => action("open-artifact", { result: output, provenance: run.provenance })}>Open in Lens</button></div></article>
      ))}</section>
    <form className="companion" onSubmit={directCompanion}><i className={ghost ? "ghost active" : "ghost"} aria-hidden="true">●</i><input aria-label="Lens companion command" value={companion} onChange={(event) => setCompanion(event.target.value)} placeholder="capture selection · preview GO · press GO" /><button>Do</button></form>
    {error && <aside role="alert">{error}</aside>}
  </main>;
}

createRoot(document.getElementById("root")).render(<App />);

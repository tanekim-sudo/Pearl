import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { TRANSFORM_PRIMITIVES } from "../../../shared/transform-primitives.js";
import { previewCompositionSequence } from "../../../shared/lens-grammar.js";
import { lensRackRecord, selectRack } from "../../../shared/lens-rack.js";
import { createMessage } from "../core/messages.js";
import { trackFunnel } from "../core/funnel-analytics.js";
import { portableLensPayload, writeDragPayload } from "../core/portable.js";
import { executeExtensionVerb, parseExtensionIntent } from "./companion.js";
import { outputContractFor, outputContractLabel } from "../../../shared/output-specifications.js";
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
  const [importPreview, setImportPreview] = useState(null);
  const [importChoices, setImportChoices] = useState({ lenses: {}, generators: {} });
  const [importing, setImporting] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(null);
  const [onboardingMode, setOnboardingMode] = useState("");
  const [auth, setAuth] = useState(false);
  const [readyMessage, setReadyMessage] = useState("");
  const [learnOpen, setLearnOpen] = useState(false);
  const [learnBefore, setLearnBefore] = useState("");
  const [learnAfter, setLearnAfter] = useState("");
  const [learning, setLearning] = useState(false);
  const fileRef = useRef(null);

  function applyLibrary(data) {
    const byId = new Map(builtIns.map((entry) => [entry.id, entry]));
    for (const operator of data?.operators || []) {
      byId.set(operator.id, { ...lensRackRecord(operator, operator.rack), operator });
    }
    setLibrary([...byId.values()]);
    setGenerators(data?.generators || []);
  }

  async function refresh() {
    const value = await call("get-session");
    setSession(value);
  }

  useEffect(() => {
    refresh().catch((e) => setError(e.message));
    call("library-refresh").then(applyLibrary).catch(() => {});
    call("library-pending").then((pending) => {
      if (pending?.bundle) previewBundle(pending.bundle);
    }).catch(() => {});
    call("auth-status").then((value) => setAuth(value.authenticated)).catch(() => {});
    chrome.storage.local.get(["onboardingComplete", "onboardingMode"], (value) => {
      setOnboardingMode(value.onboardingMode || "");
      setOnboardingStep(value.onboardingComplete ? 0 : 1);
    });
    const listener = () => refresh().catch(() => {});
    chrome.storage?.onChanged.addListener(listener);
    return () => chrome.storage?.onChanged.removeListener(listener);
  }, []);

  async function previewBundle(bundle) {
    setError("");
    try {
      const value = await call("library-import-preview", { bundle });
      setImportPreview(value);
      setImportChoices({ lenses: {}, generators: {} });
    } catch (e) {
      setError(e.message);
    }
  }

  async function readImportFile(file) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("Library file exceeds 10 MB.");
      return;
    }
    try {
      await previewBundle(JSON.parse(await file.text()));
    } catch {
      setError("Choose a valid .lens-library.json or .lens.json file.");
    }
  }

  async function commitImport() {
    setImporting(true);
    try {
      const value = await call("library-import", { bundle: importPreview.bundle, choices: importChoices });
      applyLibrary(value);
      setImportPreview(null);
      setReadyMessage(`${value.operators.length} lenses and ${value.generators.length} generators are ready.`);
      trackFunnel("library_transferred", "file");
    } catch (e) {
      setError(e.message);
    } finally {
      setImporting(false);
    }
  }

  function choiceFor(kind, entry) {
    const selected = importChoices[kind]?.[entry.id];
    if (selected) return selected;
    if (entry.status === "new") return "add";
    if (entry.status === "version-update") return "replace";
    return "skip";
  }

  const visible = useMemo(() => selectRack(library, { search: query, limit: 60 }).records, [library, query]);
  const map = useMemo(() => Object.fromEntries(library.map((entry) => [entry.id, entry.operator])), [library]);
  const queuedOps = session.queue.map((entry) => map[entry.id]).filter(Boolean);
  const preview = queuedOps.length ? previewCompositionSequence(queuedOps, map) : null;
  const characters = session.fragments.reduce((sum, entry) => sum + entry.quote.length, 0);
  const sampleLens = library.find((entry) => /summar/i.test(entry.name)) || library[0];
  const importConflicts = importPreview
    ? [...importPreview.conflicts.lenses, ...importPreview.conflicts.generators]
      .filter((entry) => entry.status === "id-conflict")
    : [];

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
    chrome.storage.local.get(["firstGoTracked"], (value) => {
      if (!value.firstGoTracked) {
        trackFunnel("first_go");
        chrome.storage.local.set({ firstGoTracked: true });
      }
    });
    setRunning(false);
  }

  async function signIn() {
    setError("");
    try {
      const value = await call("auth-login");
      setAuth(true);
      applyLibrary(value.library);
      setReadyMessage(`${value.counts.lenses} lenses and ${value.counts.generators} generators are ready.`);
      setOnboardingMode("signed-in");
      setOnboardingStep(3);
      chrome.storage.local.set({ onboardingMode: "signed-in" });
      trackFunnel("sign_in");
    } catch (e) {
      setError(e.message);
    }
  }

  function latestCapturedText() {
    return session.fragments.map((fragment) => fragment.quote).join("\n\n").slice(0, 12_000);
  }

  async function inferBeforeAfter() {
    if (!learnBefore.trim() || !learnAfter.trim()) return;
    if (!auth) {
      setError("Sign in to infer here, or open the web editor. Your draft stays in these fields.");
      return;
    }
    setLearning(true);
    setError("");
    const value = await action("infer-before-after", {
      version: 1,
      private: true,
      examples: [{
        id: crypto.randomUUID(),
        counterexample: false,
        before: { text: learnBefore, assets: [], objectRefs: [] },
        after: { text: learnAfter, assets: [], objectRefs: [] },
      }],
      idempotencyKey: crypto.randomUUID(),
    });
    if (value?.operator) {
      applyLibrary(value.library);
      setReadyMessage(`Learned lens “${value.operator.name}” is ready in the rack.`);
      setLearnOpen(false);
      setLearnBefore("");
      setLearnAfter("");
    }
    setLearning(false);
  }

  function continueLocal() {
    setOnboardingMode("local");
    setOnboardingStep(3);
    chrome.storage.local.set({ onboardingMode: "local" });
    trackFunnel("continue_local");
  }

  function finishOnboarding() {
    chrome.storage.local.set({ onboardingComplete: true, onboardingMode });
    setOnboardingStep(0);
  }

  function skipOnboarding() {
    chrome.storage.local.set({ onboardingComplete: true, onboardingMode: onboardingMode || "local" });
    setOnboardingStep(0);
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
        showImport: async () => {
          const pending = await call("library-pending");
          if (!pending?.bundle) throw new Error("no pending library import");
          await previewBundle(pending.bundle);
          return pending;
        },
        openBeforeAfter: async () => {
          setLearnOpen(true);
          return { open: true };
        },
        setBeforeAfterText: async (side, text) => {
          setLearnOpen(true);
          if (side === "after") setLearnAfter(String(text || ""));
          else setLearnBefore(String(text || ""));
          return { side };
        },
        inferBeforeAfter,
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
    {onboardingStep > 0 && <div className="onboarding" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className="onboarding-top"><span>Step {onboardingStep} of 3</span><button type="button" onClick={skipOnboarding}>Skip</button></div>
      {onboardingStep === 1 && <>
        <div className="onboarding-mark" aria-hidden="true">L</div>
        <h1 id="onboarding-title">Lens, anywhere you read</h1>
        <p>Highlight something on a page, choose a lens, and press GO to transform it.</p>
        <button className="gold onboarding-primary" onClick={() => setOnboardingStep(2)}>Get started</button>
      </>}
      {onboardingStep === 2 && <>
        <h1 id="onboarding-title">Choose how to continue</h1>
        <p>Sign in to bring over your web library automatically, or keep everything on this browser.</p>
        <div className="onboarding-choices">
          <button className="gold" onClick={signIn}><b>Sign in</b><small>Sync my Lens library</small></button>
          <button onClick={continueLocal}><b>Continue locally</b><small>No account needed</small></button>
        </div>
        <a href="https://representation-eta.vercel.app/extension/privacy.html" target="_blank" rel="noreferrer">How Lens handles data</a>
      </>}
      {onboardingStep === 3 && <>
        <h1 id="onboarding-title">{onboardingMode === "signed-in" ? "Your library is ready" : "Bring your library—or start now"}</h1>
        {onboardingMode === "signed-in" ? <p role="status">{readyMessage || "Your web library syncs automatically when you sign in."}</p> : <div
          className="onboarding-drop"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => { event.preventDefault(); readImportFile(event.dataTransfer.files?.[0]); }}
        >
          <span aria-hidden="true">↓</span>
          <b>Drop .lens-library.json here</b>
          <button onClick={() => fileRef.current?.click()}>Choose file</button>
        </div>}
        {importPreview && <div className="onboarding-import" role="status">
          <b>{importPreview.counts.lenses} lenses and {importPreview.counts.generators} generators found</b>
          <button className="gold" disabled={importing} onClick={commitImport}>{importing ? "Adding…" : importConflicts.length ? "Review choices below" : "Add library"}</button>
        </div>}
        {readyMessage && <p role="status">{readyMessage}</p>}
        <div className="onboarding-demo"><span>1. Highlight</span><span>2. Choose {sampleLens?.name || "a lens"}</span><span>3. GO</span></div>
        <button className="gold onboarding-primary" onClick={finishOnboarding}>Try it now</button>
      </>}
      {error && <p role="alert">{error}</p>}
    </div>}
    <header>
      <div><b>Lens</b><span>Everywhere</span></div>
      {auth ? <span className="signed-in">Synced</span> : <button onClick={signIn}>Sign in</button>}
    </header>
    {!characters && !session.queue.length && <section className="quick-start">
      <p>Highlight anything, choose a lens, press GO</p>
      {sampleLens && <button onClick={() => action("queue-lens", { lens: { id: sampleLens.id, name: sampleLens.name, version: sampleLens.version, kind: "lens", outputSpec: outputContractFor(sampleLens.operator, map) } })}>
        <b>{sampleLens.name}</b><small>Sample lens</small>
      </button>}
    </section>}
    <section className="capture">
      <button onClick={() => action("toggle-highlighter")} className="gold">Highlight page</button>
      <button onClick={() => action("capture-selection")}>Capture selection</button>
      <p>{session.fragments.length} fragment{session.fragments.length === 1 ? "" : "s"} · {characters.toLocaleString()} characters</p>
      <div className="fragments">{session.fragments.map((fragment) =>
        <article key={fragment.id}><q>{fragment.quote.slice(0, 180)}</q><small>{fragment.provenance.title} · {fragment.provenance.origin}</small><button aria-label="Remove fragment" onClick={() => action("remove-fragment", { id: fragment.id })}>×</button></article>
      )}</div>
      <button className="learn-toggle" onClick={() => setLearnOpen((value) => !value)}>Learn from before/after</button>
      {learnOpen && <div className="learn-panel" aria-label="Learn from before and after">
        <p>Capture each selection explicitly, then place it in a slot.</p>
        <label>Before<textarea rows="3" value={learnBefore} onChange={(event) => setLearnBefore(event.target.value)} placeholder="Paste text or use current capture" /></label>
        <button onClick={() => setLearnBefore(latestCapturedText())} disabled={!characters}>Use current capture as Before</button>
        <label>After<textarea rows="3" value={learnAfter} onChange={(event) => setLearnAfter(event.target.value)} placeholder="Paste text or use current capture" /></label>
        <button onClick={() => setLearnAfter(latestCapturedText())} disabled={!characters}>Use current capture as After</button>
        <div><button className="gold" disabled={learning || !learnBefore.trim() || !learnAfter.trim()} onClick={inferBeforeAfter}>{learning ? "Inferring…" : "Infer lens"}</button><a href="https://representation-eta.vercel.app/?learn=before-after" target="_blank" rel="noreferrer">Open full editor for images &amp; drawing</a></div>
      </div>}
    </section>
    <section>
      <h2>Lens rack</h2>
      <div
        className="library-import"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          readImportFile(event.dataTransfer.files?.[0]);
        }}
      >
        <input ref={fileRef} hidden type="file" accept=".json,.lens.json,.lens-library.json,application/json" onChange={(event) => readImportFile(event.target.files?.[0])} />
        <button onClick={() => fileRef.current?.click()}>Import library</button>
        <small>or drop a Lens library file here</small>
      </div>
      {importPreview && <div className="import-preview" role="dialog" aria-label="Library import preview">
        <b>{importConflicts.length ? "Choose what to keep" : "Add this library?"}</b>
        <p>{importPreview.counts.lenses} lenses · {importPreview.counts.generators} generators · {importPreview.counts.generatorItems} material items</p>
        {[["lenses", importPreview.conflicts.lenses], ["generators", importPreview.conflicts.generators]].map(([kind, entries]) =>
          importConflicts.length && entries.some((entry) => entry.status === "id-conflict") ? <div key={kind}><small>{kind}</small>{entries.filter((entry) => entry.status === "id-conflict").map((entry) =>
            <label key={`${kind}-${entry.id}`}><span>{entry.name || entry.id} · {entry.status}</span>
              <select value={choiceFor(kind, entry)} onChange={(event) => setImportChoices((current) => ({
                ...current,
                [kind]: { ...current[kind], [entry.id]: event.target.value },
              }))}>
                {entry.status === "new" && <option value="add">add</option>}
                <option value="skip">skip</option>
                {entry.status !== "exact-duplicate" && <option value="replace">replace/update</option>}
                <option value="keep-both">keep both</option>
              </select>
            </label>
          )}</div> : null
        )}
        <div><button className="gold" disabled={importing} onClick={commitImport}>{importing ? "Adding…" : importConflicts.length ? "Continue" : "Add library"}</button><button onClick={() => setImportPreview(null)}>Cancel</button></div>
      </div>}
      {readyMessage && !importPreview && <p className="ready-message" role="status">{readyMessage}</p>}
      <input aria-label="Search lenses" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search lenses" />
      <div className="rack">{visible.map((lens) =>
        <button key={lens.id} title={`Output: ${outputContractLabel(outputContractFor(lens.operator, map))}`} draggable onDragStart={(event) => writeDragPayload(event.dataTransfer, portableLensPayload(lens.operator, library.map((entry) => entry.operator)))} onClick={() => action("queue-lens", { lens: { id: lens.id, name: lens.name, version: lens.version, kind: "lens", outputSpec: outputContractFor(lens.operator, map) } })}>
          <b>{lens.name}</b><small>{lens.description}</small><small className="output-contract">→ {outputContractLabel(outputContractFor(lens.operator, map))}</small>
        </button>
      )}</div>
    </section>
    <section>
      <h2>Ordered stack</h2>
      <ol className="queue">{session.queue.map((lens, index) =>
        <li key={`${lens.id}-${index}`}><span>{lens.name}<small>{lens.outputSpec ? outputContractLabel(lens.outputSpec) : ""}</small></span><button disabled={!index} onClick={() => action("reorder-queue", { from: index, to: index - 1 })}>↑</button><button disabled={index === session.queue.length - 1} onClick={() => action("reorder-queue", { from: index, to: index + 1 })}>↓</button><button onClick={() => action("remove-queue", { index })}>×</button></li>
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
        <article className="result" key={output.id}><small className="result-type">{output.semanticType || "Output"}{output.branchIndex != null ? ` · branch ${output.branchIndex + 1}` : ""}</small><p>{output.text}</p><div><button onClick={() => navigator.clipboard.writeText(output.text)}>Copy</button><button onClick={() => action("result-action", { text: output.text, outputSpec: output.outputSpec, machineKind: output.machineKind, plan: { operation: "insert" } })}>Insert</button><button onClick={() => action("result-action", { text: output.text, outputSpec: output.outputSpec, machineKind: output.machineKind, plan: { operation: "replace" } })}>Replace</button><button onClick={() => action("open-artifact", { result: output, provenance: run.provenance })}>Open in Lens</button></div></article>
      ))}</section>
    <form className="companion" onSubmit={directCompanion}><i className={ghost ? "ghost active" : "ghost"} aria-hidden="true">●</i><input aria-label="Lens companion command" value={companion} onChange={(event) => setCompanion(event.target.value)} placeholder="capture selection · preview GO · press GO" /><button>Do</button></form>
    {error && <aside role="alert">{error}</aside>}
  </main>;
}

createRoot(document.getElementById("root")).render(<App />);

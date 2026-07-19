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
import { normalizeGenerationPlan } from "../../../shared/generation-plan.js";
import { verifyCognitivePackage } from "../../../shared/cognitive-package.js";
import { createSemanticOrb, semanticOrbFromMaterial } from "../../../shared/semantic-orbs.js";
import "./sidepanel.css";

async function call(type, payload = {}) {
  const response = await chrome.runtime.sendMessage(createMessage(type, payload));
  if (!response?.ok) throw new Error(response?.error || "extension request failed");
  return response.value;
}

const builtIns = TRANSFORM_PRIMITIVES.map((operator) => ({
  ...lensRackRecord(operator),
  operator,
  objectKind: "move",
}));

const ORB_RAYS = Object.freeze([
  [4, 13, 35, 2], [43, 18, 36, -1], [82, 11, 34, 1], [129, 18, 36, 2],
  [174, 14, 35, -1], [220, 19, 36, 1], [266, 12, 34, -2], [309, 17, 36, 1], [341, 15, 35, -1],
]);

function ExtensionOrb({ phase, listening, onVoice, onCommandView, contextCount = 0, lensActive = false, candidateCount = 0 }) {
  return <div className="extension-orb-shell" data-orb-state={phase} aria-label={`Lens orb, ${phase}`}>
    <div className="extension-orb-emissions" aria-live="polite">
      {lensActive && <span className="extension-lens-ring" aria-label="Active Lens atmosphere" />}
      {Array.from({ length: Math.min(6, contextCount) }, (_, index) => <i className="extension-context-star" key={index} style={{ "--star-index": index, "--star-count": Math.min(6, contextCount) }} />)}
      {Array.from({ length: Math.min(5, candidateCount) }, (_, index) => <i className="extension-candidate-star" key={index} style={{ "--candidate-index": index }} />)}
    </div>
    <button type="button" className="extension-orb" aria-label={listening ? "Stop listening" : "Hold to speak"} onClick={onVoice}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <g className="extension-orb-rays">
          {ORB_RAYS.map(([angle, start, end, bend]) => <path key={angle} d={`M50 ${start} C${50 + bend} ${start + 7} ${50 - bend} ${end - 5} 50 ${end}`} transform={`rotate(${angle} 50 50)`} />)}
        </g>
        <path className="extension-orb-trace" d="M50 14 C66 20 76 34 78 50" />
        <circle cx="50" cy="50" r="29" className="extension-orb-halo" />
        <circle cx="50" cy="50" r="36" className="extension-orb-state-ring" />
        <circle cx="50" cy="50" r="19" className="extension-orb-core" />
      </svg>
    </button>
    <button type="button" className="extension-orb-label" onClick={onCommandView}>{phase === "listening" ? "Listening…" : phase === "executing" ? "Working…" : "Tell the orb your goal"}</button>
  </div>;
}

function App() {
  const [session, setSession] = useState({ fragments: [], queue: [], generator: null, results: [] });
  const [library, setLibrary] = useState(builtIns);
  const [generators, setGenerators] = useState([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [companion, setCompanion] = useState("");
  const [ghost, setGhost] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const voiceRecognizerRef = useRef(null);
  const voiceVadTimerRef = useRef(null);
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
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatDraft, setChatDraft] = useState("");
  const [chatKind, setChatKind] = useState("all");
  const [chatResult, setChatResult] = useState(null);
  const [chatRunning, setChatRunning] = useState(false);
  const [generationPlan, setGenerationPlan] = useState(() => normalizeGenerationPlan({}));
  const [modelCatalog, setModelCatalog] = useState([]);
  const [packagesOpen, setPackagesOpen] = useState(false);
  const [packages, setPackages] = useState([]);
  const [activeView, setActiveView] = useState("command");
  const [orbCursorEnabled, setOrbCursorEnabled] = useState(false);
  const [semanticOrbs, setSemanticOrbs] = useState([]);
  const [activeSemanticOrbId, setActiveSemanticOrbId] = useState(null);
  const fileRef = useRef(null);

  async function browsePackages() {
    setPackagesOpen(true);
    setError("");
    try {
      const response = await fetch("https://representation-eta.vercel.app/api/cognitive-packages?limit=20");
      if (!response.ok) throw new Error("Package registry is unavailable.");
      const visible = (await response.json()).packages || [];
      setPackages(visible);
      return { type: "package-list", packages: visible };
    } catch (reason) {
      setError(reason.message);
      throw reason;
    }
  }

  async function installPackage(pkg) {
    try {
      const publicKey = await crypto.subtle.importKey("jwk", pkg.author.publicKey, { name: "Ed25519" }, true, ["verify"]);
      await verifyCognitivePackage(pkg, { publicKey });
      const current = await chrome.storage.local.get("cognitivePackages");
      const key = `${pkg.namespace}/${pkg.name}`;
      const history = await chrome.storage.local.get("cognitivePackageHistory");
      await chrome.storage.local.set({ cognitivePackages: { ...(current.cognitivePackages || {}), [key]: pkg } });
      await chrome.storage.local.set({ cognitivePackageHistory: [...(history.cognitivePackageHistory || []), { key, previous: current.cognitivePackages?.[key] || null, installedAt: Date.now() }].slice(-30) });
      setReadyMessage(`Verified and installed ${key}@${pkg.version}. Complex graph edits open in the web editor.`);
      return { type: "package-install-receipt", package: `${key}@${pkg.version}`, verified: true };
    } catch (reason) {
      setError(`Package install blocked: ${reason.message}`);
      throw reason;
    }
  }

  function applyLibrary(data) {
    const byId = new Map(builtIns.map((entry) => [entry.id, entry]));
    for (const operator of data?.operators || []) {
      byId.set(operator.id, {
        ...lensRackRecord(operator, operator.rack),
        operator,
        objectKind: operator.libraryKind || (operator.kind === "pipeline" ? "function" : "move"),
      });
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
    call("model-catalog").then((value) => setModelCatalog(value.models || [])).catch(() => {});
    call("orb-cursor-get").then((value) => setOrbCursorEnabled(value.enabled === true)).catch(() => {});
    chrome.storage.local.get(["onboardingComplete", "onboardingMode", "generationPlan", "semanticOrbs", "activeSemanticOrbId"], (value) => {
      setOnboardingMode(value.onboardingMode || "");
      setOnboardingStep(value.onboardingComplete ? 0 : 1);
      if (value.generationPlan) setGenerationPlan(normalizeGenerationPlan(value.generationPlan));
      setSemanticOrbs((value.semanticOrbs || []).map((orb) => createSemanticOrb(orb)));
      setActiveSemanticOrbId(value.activeSemanticOrbId || null);
    });
    const listener = () => refresh().catch(() => {});
    chrome.storage?.onChanged.addListener(listener);
    return () => chrome.storage?.onChanged.removeListener(listener);
  }, []);

  useEffect(() => {
    chrome.storage.local.set({ generationPlan });
  }, [generationPlan]);

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
      setReadyMessage(`${value.operators.length} Moves/Functions and ${value.generators.length} Lenses are ready.`);
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
  const visibleMoves = visible.filter((record) => library.find((entry) => entry.id === record.id)?.objectKind === "move");
  const visibleFunctions = visible.filter((record) => library.find((entry) => entry.id === record.id)?.objectKind === "function");
  const map = useMemo(() => Object.fromEntries(library.map((entry) => [entry.id, entry.operator])), [library]);
  const queuedOps = session.queue.map((entry) => map[entry.id]).filter(Boolean);
  const preview = queuedOps.length ? previewCompositionSequence(queuedOps, map) : null;
  const characters = session.fragments.reduce((sum, entry) => sum + entry.quote.length, 0);
  const sampleLens = library.find((entry) => /summar/i.test(entry.name)) || library[0];
  const importConflicts = importPreview
    ? [...importPreview.conflicts.lenses, ...importPreview.conflicts.generators]
      .filter((entry) => entry.status === "id-conflict")
    : [];

  async function persistSemanticOrbs(next, activeId = activeSemanticOrbId) {
    const normalized = next.map((orb) => createSemanticOrb(orb));
    await chrome.storage.local.set({ semanticOrbs: normalized, activeSemanticOrbId: activeId || null });
    setSemanticOrbs(normalized);
    setActiveSemanticOrbId(activeId || null);
    return { type: "external-semantic-orbs", orbs: normalized, activeId: activeId || null };
  }

  async function semanticOrbAction(name, args = {}) {
    const byId = new Map(semanticOrbs.map((orb) => [orb.id, orb]));
    if (name === "create") {
      const id = args.id || `external-orb:${crypto.randomUUID()}`;
      const captured = args.material || session.fragments.at(-1);
      const orb = captured
        ? semanticOrbFromMaterial(captured, { id, sceneId: "extension-captures", placement: { x: 0, y: 0 } })
        : createSemanticOrb({ id, sceneId: "extension-captures", name: args.name || "Untitled orb" });
      await persistSemanticOrbs([...semanticOrbs, orb], id);
      setActiveView("orbs");
      return { type: "external-semantic-orb", id, orb };
    }
    if (name === "merge") {
      const sources = (args.ids || []).map((id) => byId.get(id)).filter(Boolean);
      if (sources.length < 2) throw new Error("choose at least two orbs");
      const context = new Map(sources.flatMap((entry) => entry.workingSet.context || []).map((item) => [item.id, item]));
      const merged = createSemanticOrb({
        id: `external-orb:${crypto.randomUUID()}`,
        sceneId: "extension-captures",
        name: args.name || sources.map((entry) => entry.name).join(" + "),
        representation: { kind: "grouped-context", refs: sources.map((entry) => entry.id), label: args.name || "Merged orb" },
        workingSet: { context: [...context.values()] },
        lineage: sources.map((entry) => ({ orbId: entry.id, operation: "merge" })),
      });
      byId.set(merged.id, merged);
      await persistSemanticOrbs([...byId.values()], merged.id);
      setActiveView("orbs");
      return { type: "external-semantic-orb", id: merged.id, orb: merged };
    }
    const orb = byId.get(args.id) || semanticOrbs.find((entry) => entry.name.toLowerCase().includes(String(args.id || "").toLowerCase()));
    if (!orb) throw new Error("orb not found");
    if (name === "open") {
      await persistSemanticOrbs(semanticOrbs, orb.id);
      setActiveView("orbs");
      return { type: "external-semantic-orb-active", id: orb.id };
    }
    if (name === "add-context") {
      const items = args.items?.length ? args.items : session.fragments.slice(-1);
      const context = new Map((orb.workingSet.context || []).map((item) => [item.id, item]));
      items.forEach((item) => item?.id && context.set(item.id, item));
      byId.set(orb.id, createSemanticOrb({ ...orb, workingSet: { ...orb.workingSet, context: [...context.values()] } }));
    } else if (name === "apply-lens") {
      const lens = args.lens || generators.find((entry) => entry.id === args.lensId) || library.find((entry) => entry.id === args.lensId)?.operator;
      if (!lens?.id) throw new Error("Lens not found");
      const lenses = new Map((orb.workingSet.lenses || []).map((entry) => [entry.id, entry]));
      lenses.set(lens.id, { ...lens, strength: args.strength ?? .7 });
      byId.set(orb.id, createSemanticOrb({ ...orb, workingSet: { ...orb.workingSet, lenses: [...lenses.values()] } }));
    } else if (name === "archive") {
      byId.set(orb.id, createSemanticOrb({ ...orb, archived: args.archived !== false }));
    }
    const next = [...byId.values()];
    await persistSemanticOrbs(next, name === "archive" && args.archived !== false && activeSemanticOrbId === orb.id ? null : activeSemanticOrbId);
    return { type: `external-semantic-orb-${name}`, id: orb.id, orb: byId.get(orb.id) };
  }

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

  async function toggleOrbCursor(enabled = !orbCursorEnabled) {
    const value = await action("toggle-orb-cursor", { enabled, source: "control" });
    if (value?.enabled != null) setOrbCursorEnabled(value.enabled === true);
    return value;
  }

  async function go() {
    if (!characters || (!session.queue.length && !session.generator)) return;
    if ((preview?.requiresConfirmation || characters > 50_000) && !confirm(`Send ${characters.toLocaleString()} selected characters and produce up to ${preview?.predictedOutputCount || 1} outputs?`)) return;
    setRunning(true);
    await action("go", { disclosedCharacters: characters, generationPlan, idempotencyKey: crypto.randomUUID() });
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
      setReadyMessage(`${value.counts.lenses} Moves/Functions and ${value.counts.generators} Lenses are ready.`);
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
      setReadyMessage(`Learned Move “${value.operator.name}” is ready in the rack.`);
      setLearnOpen(false);
      setLearnBefore("");
      setLearnAfter("");
    }
    setLearning(false);
  }

  async function saveCaptureAs(kind) {
    if (!characters) return;
    const value = await action(
      kind === "move"
        ? "save-capture-as-move"
        : kind === "function"
          ? "save-capture-as-function"
          : "save-capture-as-lens",
      {}
    );
    if (value?.library) applyLibrary(value.library);
    if (value?.object) {
      setReadyMessage(kind === "move"
        ? `${value.duplicate ? "Existing" : "New"} Move “${value.object.name}” is ready.`
        : kind === "function"
          ? `${value.duplicate ? "Existing" : "New"} one-step Function “${value.object.name}” preserves the exact capture.`
          : `Lens “${value.object.name}” collected ${value.object.material.length} context items.`);
    }
    setSaveAsOpen(false);
  }

  async function learnFromChat() {
    setChatRunning(true);
    setError("");
    try {
      const result = await call("infer-transcript-artifacts", { transcript: chatDraft, requested: chatKind, idempotencyKey: crypto.randomUUID() });
      setChatResult(result);
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setChatRunning(false);
    }
  }

  async function saveChatArtifacts() {
    const kinds = chatKind === "all" ? ["move", "function", "lens"] : [chatKind];
    const value = await call("save-transcript-artifacts", { result: chatResult, kinds });
    applyLibrary(value);
    setReadyMessage(`Saved ${kinds.join(" + ")} from private transcript evidence.`);
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
      const approvalRequired = ["insertExternalResult", "replaceExternalSelection", "annotateExternalResult", "installExternalPackage", "teachExternalPersonalCommand"].includes(command.name);
      const confirmed = !approvalRequired || window.confirm(
        command.name === "teachExternalPersonalCommand"
          ? `Remember “${command.args.trigger}” in ${command.args.scope} scope?`
          : command.name === "installExternalPackage"
            ? `Verify and install ${command.args.manifest?.namespace}/${command.args.manifest?.name}@${command.args.manifest?.version}?`
            : `${command.name === "insertExternalResult" ? "Insert into" : command.name === "replaceExternalSelection" ? "Replace selection in" : "Annotate"} the current verified page target?\n\nOnly the staged result and current target are in scope.`
      );
      if (!confirmed) return;
      await executeExtensionVerb(command.name, command.args, {
        confirmed,
        approvalScope: "current verified page target",
        idempotencyKey: `companion:${command.name}:${JSON.stringify(command.args)}`,
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
          if (!generator) throw new Error("Lens not found");
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
        browsePackages,
        installPackage,
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
        openSaveAs: async () => {
          setSaveAsOpen(true);
          return { open: true };
        },
        toggleOrbCursor,
        saveCaptureAs,
        semanticOrbAction,
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

  function toggleCompanionVoice() {
    if (voiceListening) {
      voiceRecognizerRef.current?.stop?.();
      setVoiceListening(false);
      return;
    }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setError("voice recognition is unavailable in this browser");
      return;
    }
    const recognizer = new Recognition();
    recognizer.continuous = true;
    recognizer.interimResults = true;
    recognizer.lang = navigator.language || "en-US";
    let stable = "";
    recognizer.onresult = (event) => {
      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const text = event.results[index]?.[0]?.transcript || "";
        if (event.results[index].isFinal) stable = `${stable} ${text}`.trim();
        else interim = `${interim} ${text}`.trim();
      }
      setCompanion(`${stable} ${interim}`.trim());
      clearTimeout(voiceVadTimerRef.current);
      if (stable) {
        voiceVadTimerRef.current = setTimeout(() => {
          recognizer.stop();
          setVoiceListening(false);
          document.querySelector("form.companion")?.requestSubmit();
        }, 1200);
      }
    };
    recognizer.onerror = (event) => {
      if (event.error !== "aborted") setError(`voice recognition failed: ${event.error}`);
      setVoiceListening(false);
    };
    recognizer.onend = () => setVoiceListening(false);
    voiceRecognizerRef.current = recognizer;
    recognizer.start();
    setVoiceListening(true);
  }

  const orbPhase = voiceListening ? "listening" : running || chatRunning || learning ? "executing" : error ? "blocked" : "idle";
  return <main data-orb-view={activeView}>
    {onboardingStep > 0 && <div className="onboarding" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className="onboarding-top"><span>Step {onboardingStep} of 3</span><button type="button" onClick={skipOnboarding}>Skip</button></div>
      {onboardingStep === 1 && <>
        <ExtensionOrb phase="idle" listening={false} onVoice={() => {}} onCommandView={() => {}} />
        <h1 id="onboarding-title">Your orb, anywhere you read</h1>
        <p>Activate Lens on any ordinary page. Select material, bring it into the orb, then speak or type the outcome you want.</p>
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
          <b>{importPreview.counts.lenses} Moves/Functions and {importPreview.counts.generators} Lenses found</b>
          <button className="gold" disabled={importing} onClick={commitImport}>{importing ? "Adding…" : importConflicts.length ? "Review choices below" : "Add library"}</button>
        </div>}
        {readyMessage && <p role="status">{readyMessage}</p>}
        <div className="onboarding-demo"><span>1. Highlight</span><span>2. Choose {sampleLens?.name || "a lens"}</span><span>3. GO</span></div>
        <button className="gold onboarding-primary" onClick={finishOnboarding}>Try it now</button>
      </>}
      {error && <p role="alert">{error}</p>}
    </div>}
    <header>
      <ExtensionOrb phase={orbPhase} listening={voiceListening} onVoice={toggleCompanionVoice} onCommandView={() => setActiveView("command")}
        contextCount={session.fragments.length} lensActive={Boolean(session.generator)} candidateCount={session.results.flatMap((run) => run.outputs).length} />
      <div>
        <button type="button" onClick={browsePackages}>Packages</button>
        {auth ? <span className="signed-in">Synced</span> : <button onClick={signIn}>Sign in</button>}
      </div>
    </header>
    <nav className="orb-view-tabs" aria-label="Orb views">
      {["command", "context", "orbs", "library", "review", "taste", "settings"].map((view) => <button key={view} type="button" aria-current={activeView === view ? "page" : undefined} onClick={() => setActiveView(view)}>{view}</button>)}
    </nav>
    <section className={`orb-panel extension-semantic-orbs ${activeView === "orbs" ? "active" : ""}`} aria-label="Saved semantic orbs">
      <div className="extension-semantic-orb-head">
        <div><h2>Orbs</h2><small>Compact capsules for anything you want to keep working with.</small></div>
        <button className="gold" type="button" onClick={() => semanticOrbAction("create", { name: "Untitled orb", material: session.fragments.at(-1) || null })}>
          {session.fragments.length ? "Orb from capture" : "New orb"}
        </button>
      </div>
      <div className="extension-semantic-orb-tray">
        {semanticOrbs.filter((orb) => !orb.archived).map((orb) => <button
          type="button"
          key={orb.id}
          aria-pressed={activeSemanticOrbId === orb.id}
          onClick={() => semanticOrbAction("open", { id: orb.id })}
        >
          <i />
          <b>{orb.name}</b>
          <small>{orb.representation?.kind || "empty"} · {orb.workingSet?.context?.length || 0} context</small>
        </button>)}
        {!semanticOrbs.some((orb) => !orb.archived) && <p>No saved orbs yet. Capture a selection or make an empty one.</p>}
      </div>
      {activeSemanticOrbId && semanticOrbs.find((orb) => orb.id === activeSemanticOrbId) && <div className="extension-semantic-orb-detail">
        <b>{semanticOrbs.find((orb) => orb.id === activeSemanticOrbId).name}</b>
        <button type="button" disabled={!session.fragments.length} onClick={() => semanticOrbAction("add-context", { id: activeSemanticOrbId, items: session.fragments.slice(-1) })}>Add current capture</button>
        <button type="button" onClick={() => action("open-web-handoff", { surface: "semantic-orb-scene", orbId: activeSemanticOrbId, preservePayload: true })}>Arrange in full Scene</button>
        <button type="button" onClick={() => semanticOrbAction("archive", { id: activeSemanticOrbId, archived: true })}>Archive</button>
      </div>}
    </section>
    {packagesOpen && <section className={`orb-panel ${activeView === "library" ? "active" : ""} extension-packages`} aria-label="Cognitive Packages">
      <div><b>Cognitive Packages</b><button type="button" onClick={() => setPackagesOpen(false)}>×</button></div>
      {packages.map((pkg) => <article key={`${pkg.namespace}/${pkg.name}@${pkg.version}`}>
        <b>{pkg.namespace}/{pkg.name}</b>
        <small>v{pkg.version} · {pkg.kinds.join(" · ")} · signature {pkg.trust?.signature || "unverified"}</small>
        <button type="button" onClick={() => installPackage(pkg)}>Verify & install</button>
      </article>)}
      {!packages.length && <p>No public or team packages are visible.</p>}
    </section>}
    {!characters && !session.queue.length && <section className={`orb-panel ${activeView === "context" ? "active" : ""} quick-start`}>
      <p>Highlight anything, choose a Move or Function, optionally add Lens context, then press GO</p>
      {sampleLens && <button onClick={() => action("queue-lens", { lens: { id: sampleLens.id, name: sampleLens.name, version: sampleLens.version, kind: "lens", outputSpec: outputContractFor(sampleLens.operator, map) } })}>
        <b>{sampleLens.name}</b><small>Sample Primitive Move</small>
      </button>}
    </section>}
    <section className={`orb-panel ${activeView === "context" ? "active" : ""} capture`}>
      <button onClick={() => action("toggle-highlighter")} className="gold">Highlight page</button>
      <button onClick={() => action("capture-selection")}>Capture selection</button>
      <button className="save-as-toggle" disabled={!characters} onClick={() => setSaveAsOpen((value) => !value)}>Save capture as…</button>
      {saveAsOpen && <div className="save-as-chooser" role="dialog" aria-label="Save capture as">
        <button onClick={() => saveCaptureAs("move")}><b>↦ Move</b><small>Use selected text verbatim as one instruction</small></button>
        <button onClick={() => saveCaptureAs("function")}><b>⛓ Function</b><small>Wrap exact capture as a one-step Function</small></button>
        <button onClick={() => saveCaptureAs("lens")}><b>✦ Lens</b><small>Collect each capture as bounded context material</small></button>
      </div>}
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
        <div><button className="gold" disabled={learning || !learnBefore.trim() || !learnAfter.trim()} onClick={inferBeforeAfter}>{learning ? "Inferring…" : "Infer Move / Function"}</button><a href="https://representation-eta.vercel.app/?learn=before-after" target="_blank" rel="noreferrer">Open full editor for images &amp; drawing</a></div>
      </div>}
      <button className="learn-toggle" onClick={() => setChatOpen((value) => !value)}>Learn from chat</button>
      {chatOpen && <div className="learn-panel" aria-label="Learn from chat transcript">
        <p>Paste only the chat content you explicitly want analyzed. It stays private and is sent only when Generate is pressed.</p>
        <textarea rows="5" value={chatDraft} onChange={(event) => { setChatDraft(event.target.value); setChatResult(null); }} placeholder="User: …&#10;Assistant: …" />
        <select aria-label="Transcript artifact type" value={chatKind} onChange={(event) => setChatKind(event.target.value)}>
          <option value="move">Move only</option><option value="function">Function only</option><option value="lens">Lens only</option><option value="all">All three</option>
        </select>
        <button className="gold" disabled={chatRunning || !chatDraft.trim()} onClick={learnFromChat}>{chatRunning ? "Generating…" : "Generate preview"}</button>
        {chatResult && <div><p>{Object.entries(chatResult.candidates || {}).map(([kind, candidate]) => `${kind}: ${candidate.supported ? candidate.name || "candidate" : "unsupported"}`).join(" · ")}</p><button onClick={saveChatArtifacts}>Save generated artifacts</button></div>}
        {chatDraft.length > 40_000 && <a href="https://representation-eta.vercel.app/?learn=chat" target="_blank" rel="noreferrer">Use full editor for long chats, exclusions, and redaction</a>}
      </div>}
    </section>
    <section className={`orb-panel ${activeView === "library" ? "active" : ""}`}>
      <h2>Library</h2>
      <p className="kind-guide">Move = one action.<br />Function = a process.<br />Lens = a way of seeing.</p>
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
        <p>{importPreview.counts.lenses} Moves/Functions · {importPreview.counts.generators} Lenses · {importPreview.counts.generatorItems} context items</p>
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
      <input aria-label="Search library" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Moves, Functions, Lenses" />
      <h3 className="library-subhead">↦ Primitive Moves and Moves · one action</h3>
      <div className="rack">{visibleMoves.map((fn) =>
        <button key={fn.id} title={`One model call · Output: ${outputContractLabel(outputContractFor(fn.operator, map))}`} draggable onDragStart={(event) => writeDragPayload(event.dataTransfer, portableLensPayload(fn.operator, library.map((entry) => entry.operator)))} onClick={() => action("queue-lens", { lens: { id: fn.id, name: fn.name, version: fn.version, kind: "move", outputSpec: outputContractFor(fn.operator, map) } })}>
          <b>{fn.name}</b><small>{fn.description}</small><small className="output-contract">one call → {outputContractLabel(outputContractFor(fn.operator, map))}</small>
        </button>
      )}</div>
      <h3 className="library-subhead">⛓ Functions · a process</h3>
      {!visibleFunctions.length && <p className="muted">No Functions yet. Capture actual lineage in the web app.</p>}
      <div className="rack">{visibleFunctions.map((lens) =>
        <button key={lens.id} title={`Process · Output: ${outputContractLabel(outputContractFor(lens.operator, map))}`} draggable onDragStart={(event) => writeDragPayload(event.dataTransfer, portableLensPayload(lens.operator, library.map((entry) => entry.operator)))} onClick={() => action("queue-lens", { lens: { id: lens.id, name: lens.name, version: lens.version, kind: "function", outputSpec: outputContractFor(lens.operator, map) } })}>
          <b>{lens.name}</b><small>{lens.stepCount} connected step{lens.stepCount === 1 ? "" : "s"}</small><small className="output-contract">process → {outputContractLabel(outputContractFor(lens.operator, map))}</small>
        </button>
      )}</div>
      <h3 className="library-subhead">✦ Lenses · a way of seeing</h3>
      <div className="generator-rack">{generators.map((generator) =>
        <button key={generator.id} onClick={() => action("set-generator", { generator })}><b>{generator.name || generator.title}</b><small>{(generator.material || generator.items || []).length} material items</small></button>
      )}</div>
    </section>
    <section className={`orb-panel ${activeView === "review" ? "active" : ""}`}>
      <h2>Action stack</h2>
      <ol className="queue">{session.queue.map((lens, index) =>
        <li key={`${lens.id}-${index}`}><span>{lens.name}<small>{lens.outputSpec ? outputContractLabel(lens.outputSpec) : ""}</small></span><button disabled={!index} onClick={() => action("reorder-queue", { from: index, to: index - 1 })}>↑</button><button disabled={index === session.queue.length - 1} onClick={() => action("reorder-queue", { from: index, to: index + 1 })}>↓</button><button onClick={() => action("remove-queue", { index })}>×</button></li>
      )}</ol>
      {preview && <p className={preview.ok ? "compat good" : "compat bad"}>{preview.ok ? `${preview.label} · ${preview.predictedOutputCount} output${preview.predictedOutputCount === 1 ? "" : "s"}` : preview.errors[0]}</p>}
      <label>Lens context<select value={session.generator?.id || ""} onChange={(event) => action("set-generator", { generator: generators.find((item) => item.id === event.target.value) || null })}><option value="">New chat · no context</option>{generators.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Candidates
        <input
          type="number"
          min="1"
          max="20"
          value={generationPlan.candidateCount}
          onChange={(event) => setGenerationPlan(normalizeGenerationPlan({ ...generationPlan, candidateCount: Number(event.target.value) }))}
          aria-label="Candidate variations"
        />
        <select
          aria-label="Candidate model"
          value={generationPlan.assignment.mode === "single" ? generationPlan.assignment.model : "auto"}
          onChange={(event) => setGenerationPlan(normalizeGenerationPlan({
            ...generationPlan,
            assignment: event.target.value === "auto"
              ? { mode: "auto", model: "auto", slots: [], groups: [] }
              : { mode: "single", model: event.target.value, slots: [], groups: [] },
          }))}
        >
          <option value="auto">Auto compatible model</option>
          {modelCatalog.map((model) => <option key={model.id} value={model.id}>{model.name || model.id}</option>)}
        </select>
      </label>
      <div className="disclosure">GO sends exactly <b>{characters.toLocaleString()}</b> selected characters from {[...new Set(session.fragments.map((item) => item.provenance.origin))].join(", ") || "no origin"}.</div>
      <button className="go" disabled={running || !characters || (!session.queue.length && !session.generator) || preview?.ok === false} onClick={go}>{running ? "Running…" : "GO"}</button>
      {running && <button onClick={() => action("cancel-run", { runId: session.activeRunId })}>Cancel</button>}
    </section>
    <section className={`orb-panel ${activeView === "taste" || activeView === "review" ? "active" : ""}`}>
      <h2>Preview results</h2>
      {!session.results.length && <p className="muted">Results stage here. The page never changes automatically.</p>}
      {session.results.flatMap((run) => run.outputs.map((output) =>
        <article className={`result ${output.tasteFeedback?.decision || ""}`} key={output.id}><small className="result-type">{output.semanticType || "Candidate"}{output.branchIndex != null ? ` · structural output ${output.branchIndex + 1}` : ""}</small><p>{output.text}</p>{(output.provenance || run.provenance) && <small className="model-provenance">{(output.provenance || run.provenance).requestedModel || "auto"} → {(output.provenance || run.provenance).resolvedModel || (output.provenance || run.provenance).model || "compatible model"}{(output.provenance || run.provenance).providerRoute ? ` via ${(output.provenance || run.provenance).providerRoute}` : ""}{(output.provenance || run.provenance).fallback ? " · fallback" : ""}</small>}<div><button aria-label="Accept candidate" onClick={() => action("taste-feedback", { outputId: output.id, decision: "accepted" })}>Yes</button><button aria-label="Reject candidate" onClick={() => action("taste-feedback", { outputId: output.id, decision: "rejected" })}>No</button>{output.tasteFeedback && <button onClick={() => action("taste-feedback", { outputId: output.id, decision: "undecided" })}>Undo</button>}<button onClick={() => navigator.clipboard.writeText(output.text)}>Copy</button><button onClick={() => action("result-action", { text: output.text, outputSpec: output.outputSpec, machineKind: output.machineKind, plan: { operation: "insert" } })}>Insert</button><button onClick={() => action("result-action", { text: output.text, outputSpec: output.outputSpec, machineKind: output.machineKind, plan: { operation: "replace" } })}>Replace</button><button onClick={() => action("open-artifact", { result: output, provenance: run.provenance })}>Open in Lens</button></div></article>
      ))}</section>
    <section className={`orb-panel ${activeView === "settings" ? "active" : ""} orb-settings`} aria-label="Orb settings">
      <h2>Settings</h2>
      <p className="muted">Voice stays local until you explicitly run a capability. Page capture always requires your action.</p>
      <button type="button" aria-pressed={orbCursorEnabled} onClick={() => toggleOrbCursor()}>
        {orbCursorEnabled ? "Return to native cursor" : "Make the orb my cursor"}
      </button>
      <p className="muted">On supported pages, press Space three times to toggle. Triple-Space is ignored while typing.</p>
      <button type="button" onClick={signIn}>{auth ? "Refresh synced library" : "Sign in for sync"}</button>
      <a href="https://representation-eta.vercel.app/settings" target="_blank" rel="noreferrer">Models, connectors, vocabulary, and privacy</a>
    </section>
    <form className={`companion ${activeView === "command" ? "active" : ""}`} onSubmit={directCompanion}><i className={ghost ? "ghost active" : "ghost"} aria-hidden="true">●</i><input aria-label="Lens orb command" value={companion} onChange={(event) => setCompanion(event.target.value)} placeholder="Tell the orb your goal…" /><button type="button" aria-pressed={voiceListening} aria-label={voiceListening ? "Stop voice command" : "Start voice command"} onClick={toggleCompanionVoice}>{voiceListening ? "■" : "🎙"}</button><button>Run</button></form>
    {error && <aside role="alert">{error}</aside>}
  </main>;
}

createRoot(document.getElementById("root")).render(<App />);

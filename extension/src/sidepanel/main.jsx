import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { TRANSFORM_PRIMITIVES } from "../../../shared/transform-primitives.js";
import { previewCompositionSequence } from "../../../shared/lens-grammar.js";
import { lensRackRecord, selectRack } from "../../../shared/lens-rack.js";
import { createMessage } from "../core/messages.js";
import { trackFunnel } from "../core/funnel-analytics.js";
import { portableLensPayload, writeDragPayload } from "../core/portable.js";
import { executeExtensionVerb, extensionCommandNeedsApproval, planExtensionIntent } from "./companion.js";
import { outputContractFor, outputContractLabel } from "../../../shared/output-specifications.js";
import { normalizeGenerationPlan } from "../../../shared/generation-plan.js";
import { verifyCognitivePackage } from "../../../shared/cognitive-package.js";
import { createSemanticOrb, semanticOrbFromMaterial } from "../../../shared/semantic-orbs.js";
import { pearlActionPrompt, searchPearlActions } from "../../../client/lib/pearl-shell.js";
import { guideSectionsFor } from "../../../client/lib/pearl-guide.js";
import { BrowserPlatform } from "../platform/browser-platform.js";
import { PHYSICAL_PEARL_CSS, physicalPearlMarkup } from "../../../shared/physical-pearl.js";
import { createPearlPrivacyPolicy } from "../../../shared/pearl-privacy-policy.js";
import { createPearlEntity } from "../../../shared/pearl-entity.js";
import { migrateLegacyPearlState, PEARL_STORE_KEY } from "../../../shared/pearl-store.js";
import { loadCompanionAesthetic, pearlAestheticStyle } from "../../../shared/pearl-aesthetic.js";
import "../../../shared/pearl-interface-tokens.css";
import "./sidepanel.css";

async function call(type, payload = {}) {
  const response = await chrome.runtime.sendMessage(createMessage(type, payload));
  if (!response?.ok) throw new Error(response?.error || "extension request failed");
  return response.value;
}

function recoveryMessage(error, type = "") {
  const message = String(error?.message || error || "The action could not be completed.");
  if (/permission|cannot access|supported web page|chrome:\/\//i.test(message)) return `Page access is blocked. Open a normal web page, grant Pearl access when Chrome asks, then retry. (${message})`;
  if (/offline|network|fetch|unavailable|model|gateway/i.test(message)) return `Pearl could not reach the selected model. Check your connection or choose another model, then retry. (${message})`;
  if (/auth|token|sign.?in|expired|unauthorized|401/i.test(message)) return `Your sign-in has expired. Sign in again; the local capture and action stack are preserved. (${message})`;
  if (/selection|fragment|highlight material/i.test(message) || type === "capture-selection") return `No page selection was captured. Select text on the page, choose Capture selection, then retry. (${message})`;
  if (/target|editable|insert|replace/i.test(message) || type === "result-action") return `The page insertion target is no longer available. Focus an editable field, select text before Replace, or use Copy, then retry. (${message})`;
  return message;
}

const builtIns = TRANSFORM_PRIMITIVES.map((operator) => ({
  ...lensRackRecord(operator),
  operator,
  objectKind: "move",
}));

function ExtensionOrb({ phase, listening, onCommandView, onDropMaterial, contextCount = 0, lensActive = false, candidateCount = 0, aesthetic = null }) {
  const id = useId();
  const lightRef = useRef({ x: 0, y: 0, at: 0 });
  const aestheticVars = aesthetic ? pearlAestheticStyle(aesthetic) : null;
  function moveLight(event) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, ((event.clientX - bounds.left) / bounds.width - .5) * 2));
    const y = Math.max(-1, Math.min(1, ((event.clientY - bounds.top) / bounds.height - .5) * 2));
    const now = event.timeStamp || performance.now();
    const speed = Math.min(1, Math.hypot(x - lightRef.current.x, y - lightRef.current.y) * 120 / Math.max(16, now - lightRef.current.at));
    event.currentTarget.style.setProperty("--pearl-light-x", x.toFixed(3));
    event.currentTarget.style.setProperty("--pearl-light-y", y.toFixed(3));
    event.currentTarget.style.setProperty("--pearl-motion", speed.toFixed(3));
    window.clearTimeout(lightRef.current.timer);
    const target = event.currentTarget;
    lightRef.current = {
      x,
      y,
      at: now,
      timer: window.setTimeout(() => target.style.setProperty("--pearl-motion", "0"), 140),
    };
  }
  return <div
    className="extension-orb-shell"
    data-orb-state={phase}
    aria-label={`Pearl, ${phase}`}
    onPointerMove={moveLight}
    onDragOver={(event) => event.preventDefault()}
    onDrop={onDropMaterial}
  >
    <div className="extension-orb-emissions" aria-live="polite">
      {lensActive && <span className="extension-lens-ring" aria-label="Active Lens atmosphere" />}
      {Array.from({ length: Math.min(6, contextCount) }, (_, index) => <i className="extension-context-star" key={index} style={{ "--star-index": index, "--star-count": Math.min(6, contextCount) }} />)}
      {Array.from({ length: Math.min(5, candidateCount) }, (_, index) => <span className="extension-candidate-star" key={index} style={{ "--candidate-index": index }} dangerouslySetInnerHTML={{ __html: physicalPearlMarkup({ id: `sidepanel-candidate-${index}`, variant: "candidate", state: "new", size: 16, decorative: true }) }} />)}
    </div>
    <button type="button" className="extension-orb" aria-label={`Open Pearl actions, ${phase}`} aria-expanded="false" onClick={onCommandView}>
      <style>{PHYSICAL_PEARL_CSS}</style>
      <span
        data-pearl-aesthetic={aesthetic?.preset || undefined}
        style={aestheticVars || undefined}
        dangerouslySetInnerHTML={{ __html: physicalPearlMarkup({ id: `extension-pearl-${id.replace(/[^a-zA-Z0-9_-]/g, "")}`, variant: "primary", state: phase, size: 36, decorative: true, aesthetic }) }}
      />
    </button>
    <span className="extension-orb-label sr-only">{phase === "listening" ? "Listening" : phase === "executing" ? "Working" : "Pearl command"}</span>
  </div>;
}

function App() {
  const [session, setSession] = useState({ fragments: [], queue: [], generator: null, results: [] });
  const [library, setLibrary] = useState(builtIns);
  const [generators, setGenerators] = useState([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [retryAction, setRetryAction] = useState(null);
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
  const [activeView, setActiveView] = useState("idle");
  const [pearlOpen, setPearlOpen] = useState(false);
  const [powerSearch, setPowerSearch] = useState(false);
  const [pearlQuery, setPearlQuery] = useState("");
  const [orbCursorEnabled, setOrbCursorEnabled] = useState(false);
  const [semanticOrbs, setSemanticOrbs] = useState([]);
  const [activeSemanticOrbId, setActiveSemanticOrbId] = useState(null);
  const [pendingPearlIntent, setPendingPearlIntent] = useState(null);
  const [pearlSoundscapes, setPearlSoundscapes] = useState({});
  const [privacySurface, setPrivacySurface] = useState(null);
  const [privacyProposal, setPrivacyProposal] = useState(null);
  const [pearlAesthetic, setPearlAesthetic] = useState(() => loadCompanionAesthetic());
  const [guideOpen, setGuideOpen] = useState(false);
  const [audioSearchResults, setAudioSearchResults] = useState([]);
  const fileRef = useRef(null);
  const audioFileRef = useRef(null);

  useEffect(() => {
    function pearlKeys(event) {
      const typing = event.target?.closest?.("input,textarea,select,[contenteditable='true']");
      if (!typing && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPearlOpen(true);
        setPowerSearch(true);
      } else if (event.key === "Escape") {
        setPearlOpen(false);
        setPowerSearch(false);
        setActiveView("idle");
      }
    }
    addEventListener("keydown", pearlKeys);
    return () => removeEventListener("keydown", pearlKeys);
  }, []);

  useEffect(() => {
    if (!pearlOpen) return;
    function collapse(event) {
      if (event.target?.closest?.(".extension-pearl-halo,.extension-orb")) return;
      setPearlOpen(false);
      setPowerSearch(false);
      setPearlQuery("");
    }
    document.addEventListener("pointerdown", collapse, true);
    return () => document.removeEventListener("pointerdown", collapse, true);
  }, [pearlOpen]);

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
      const current = await BrowserPlatform.storage.get("local", ["cognitivePackages"]);
      const key = `${pkg.namespace}/${pkg.name}`;
      const history = await BrowserPlatform.storage.get("local", ["cognitivePackageHistory"]);
      await BrowserPlatform.storage.set("local", { cognitivePackages: { ...(current.cognitivePackages || {}), [key]: pkg } });
      await BrowserPlatform.storage.set("local", { cognitivePackageHistory: [...(history.cognitivePackageHistory || []), { key, previous: current.cognitivePackages?.[key] || null, installedAt: Date.now() }].slice(-30) });
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
    Promise.all([
      BrowserPlatform.storage.get("local", ["onboardingComplete", "onboardingMode", "generationPlan", "semanticOrbs", "activeSemanticOrbId", "pearlSoundscapes"]),
      BrowserPlatform.storage.get("session", ["pendingPearlIntent"]),
    ]).then(([local, ephemeral]) => {
      const value = { ...local, ...ephemeral };
      setOnboardingMode(value.onboardingMode || "");
      setOnboardingStep(0);
      if (!value.onboardingComplete) BrowserPlatform.storage.set("local", { onboardingComplete: true });
      if (value.generationPlan) setGenerationPlan(normalizeGenerationPlan(value.generationPlan));
      setSemanticOrbs((value.semanticOrbs || []).map((orb) => createSemanticOrb(orb)));
      setActiveSemanticOrbId(value.activeSemanticOrbId || null);
      setPearlSoundscapes(value.pearlSoundscapes || {});
      setPendingPearlIntent(value.pendingPearlIntent || null);
    }).catch(() => {});
    const listener = (changes, area) => {
      if (area === "session" && changes.lensEverywhereSession?.newValue) {
        setSession(changes.lensEverywhereSession.newValue);
      } else {
        refresh().catch(() => {});
      }
      if (area === "local" && changes.semanticOrbs) {
        setSemanticOrbs((changes.semanticOrbs.newValue || []).map((orb) => createSemanticOrb(orb)));
      }
      if (area === "local" && changes.activeSemanticOrbId) {
        setActiveSemanticOrbId(changes.activeSemanticOrbId.newValue || null);
      }
      if (area === "session" && changes.pendingPearlIntent?.newValue) {
        setPendingPearlIntent(changes.pendingPearlIntent.newValue);
      }
    };
    chrome.storage?.onChanged.addListener(listener);
    return () => chrome.storage?.onChanged.removeListener(listener);
  }, []);

  useEffect(() => {
    const text = String(pendingPearlIntent?.text || "").trim();
    if (!text) return;
    BrowserPlatform.storage.remove("session", ["pendingPearlIntent"]);
    setPendingPearlIntent(null);
    setCompanion(text);
    queueMicrotask(() => runCompanionCommand(text));
  }, [pendingPearlIntent]);

  useEffect(() => {
    BrowserPlatform.storage.set("local", { generationPlan });
  }, [generationPlan]);

  useEffect(() => {
    if (session.fragments.length || !activeSemanticOrbId) return;
    const activePearl = semanticOrbs.find((orb) => orb.id === activeSemanticOrbId);
    const fragments = (activePearl?.workingSet?.context || []).filter((item) => item?.id && (item.quote || item.text));
    if (!fragments.length) return;
    call("fragments-changed", { fragments }).then(setSession).catch((reason) => setError(recoveryMessage(reason, "make-pearl")));
  }, [activeSemanticOrbId, semanticOrbs, session.fragments.length]);

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
    const stored = await BrowserPlatform.storage.get("local", ["pearlPrivacyPolicies", PEARL_STORE_KEY]);
    const pearlPrivacyPolicies = { ...(stored.pearlPrivacyPolicies || {}) };
    for (const orb of normalized) pearlPrivacyPolicies[orb.id] ||= createPearlPrivacyPolicy({ pearlId: orb.id });
    const pearlStore = stored[PEARL_STORE_KEY] || migrateLegacyPearlState({});
    const entities = { ...(pearlStore.entities || {}) };
    for (const orb of normalized) entities[orb.id] = createPearlEntity({ ...orb, privacyPolicy: pearlPrivacyPolicies[orb.id] });
    await BrowserPlatform.storage.set("local", {
      semanticOrbs: normalized,
      activeSemanticOrbId: activeId || null,
      pearlPrivacyPolicies,
      [PEARL_STORE_KEY]: { ...pearlStore, entities, activePearlId: activeId || null, updatedAt: Date.now() },
    });
    setSemanticOrbs(normalized);
    setActiveSemanticOrbId(activeId || null);
    return { type: "external-semantic-orbs", orbs: normalized, activeId: activeId || null };
  }

  async function semanticOrbAction(name, args = {}) {
    const byId = new Map(semanticOrbs.map((orb) => [orb.id, orb]));
    if (name === "clear-wear" || name === "remove-wear") {
      const { removeWornPearlId, loadWornPearlIds, buildWornPearlPack } = await import("../../../shared/companion-pearl-wear.js");
      removeWornPearlId(name === "remove-wear" ? args.id : null);
      const remaining = loadWornPearlIds();
      await persistSemanticOrbs(semanticOrbs, remaining[0] || null);
      const packs = remaining
        .map((id) => semanticOrbs.find((entry) => entry.id === id))
        .filter(Boolean)
        .map((entry) => buildWornPearlPack(entry));
      await action("pearl-worn-orbit", { packs, pearlIds: remaining }).catch(() => {});
      setReadyMessage(remaining.length
        ? `${remaining.length} pearl${remaining.length === 1 ? "" : "s"} still orbiting the companion.`
        : "Companion is bare — no pearls orbiting.");
      return { type: "external-worn-pearl", status: remaining.length ? "worn" : "bare", pearlIds: remaining };
    }
    if (name === "encode-conversation") {
      const {
        compressConversationToPearlSpec,
        suggestPearlForConversation,
        saveWornPearlId,
      } = await import("../../../shared/companion-pearl-wear.js");
      const { parseTranscript } = await import("../../../shared/transcript-learning.js");
      let text = String(args.text || "").trim();
      if (!text && args.captureScreen) {
        const capture = await action("capture-visible-tab", { authorized: true });
        text = String(capture?.text || capture?.transcript || "").trim();
      }
      if (!text) throw new Error("Paste the conversation or capture the chat tab first.");
      const transcript = parseTranscript(text);
      const spec = compressConversationToPearlSpec(transcript, { name: args.name });
      const suggestion = suggestPearlForConversation(semanticOrbs, {
        name: spec.function.name,
        description: spec.function.description,
        steps: spec.function.steps,
        keywords: spec.keywords,
      });
      const library = await action("save-transcript-artifacts", {
        kinds: ["function"],
        result: {
          transcript,
          candidates: {
            function: {
              supported: true,
              name: spec.function.name,
              description: spec.function.description,
              steps: spec.function.steps,
              outputSpec: spec.function.outputSpec,
            },
          },
        },
      });
      const functionId = (library?.operators || [])
        .filter((entry) => entry.libraryKind === "function" && entry.name === spec.function.name)
        .at(-1)?.id || null;
      let targetId = args.targetPearlId || null;
      if (!targetId && !args.forceNew && suggestion.suggestions[0] && !suggestion.preferNew) {
        targetId = suggestion.suggestions[0].pearlId;
      }
      if (!targetId) {
        const created = await semanticOrbAction("create", {
          name: spec.pearl.name,
          material: spec.pearl.workingSet.context[0],
        });
        targetId = created.id;
      } else {
        await semanticOrbAction("add-context", { id: targetId, items: spec.pearl.workingSet.context });
      }
      const storedOrbs = (await BrowserPlatform.storage.get("local", ["semanticOrbs"])).semanticOrbs || [];
      if (targetId && functionId) {
        const nextOrbs = storedOrbs.map((orb) => (
          orb.id === targetId
            ? createSemanticOrb({
              ...orb,
              representation: { kind: "function", refs: [functionId], label: spec.function.name },
            })
            : createSemanticOrb(orb)
        ));
        await persistSemanticOrbs(nextOrbs, targetId);
      }
      await semanticOrbAction("open", { id: targetId, wear: true });
      saveWornPearlId(targetId);
      call("library-refresh").then(applyLibrary).catch(() => {});
      setReadyMessage(`Conversation encoded into pearl with function “${spec.function.name}”.`);
      return {
        type: "external-conversation-pearl",
        id: targetId,
        functionId,
        functionName: spec.function.name,
        suggestion,
      };
    }
    if (name === "create") {
      const id = args.id || `external-orb:${crypto.randomUUID()}`;
      const value = await action("make-pearl", {
        id,
        name: args.name,
        material: args.material || session.fragments.at(-1),
        idempotencyKey: args.idempotencyKey || id,
      });
      if (!value?.pearl) throw new Error("Pearl could not be created");
      await persistSemanticOrbs(value.semanticOrbs || [...semanticOrbs, value.pearl], value.activeSemanticOrbId || id);
      setActiveView("orbs");
      setReadyMessage(`Pearl “${value.pearl.name}” is saved with its source and ready to reopen.`);
      return { type: "external-semantic-orb", id, orb: value.pearl };
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
    let orb = byId.get(args.id) || semanticOrbs.find((entry) => entry.name.toLowerCase().includes(String(args.id || "").toLowerCase()));
    if (!orb && args.id) {
      const stored = (await BrowserPlatform.storage.get("local", ["semanticOrbs"])).semanticOrbs || [];
      orb = stored.map((entry) => createSemanticOrb(entry)).find((entry) => entry.id === args.id)
        || stored.map((entry) => createSemanticOrb(entry)).find((entry) => entry.name.toLowerCase().includes(String(args.id || "").toLowerCase()));
      if (orb) byId.set(orb.id, orb);
    }
    if (!orb) throw new Error("orb not found");
    if (name === "open") {
      const previousPearlId = activeSemanticOrbId;
      const fragments = (orb.workingSet.context || []).filter((item) => item?.id && (item.quote || item.text));
      if (fragments.length) {
        const restored = await action("fragments-changed", { fragments });
        if (restored) setSession(restored);
      }
      await persistSemanticOrbs(semanticOrbs, orb.id);
      if (args.wear !== false) {
        const { addWornPearlId, saveWornPearlId, loadWornPearlIds, loadWornOrbitState, buildWornPearlPack } = await import("../../../shared/companion-pearl-wear.js");
        if (args.replace === true) saveWornPearlId(orb.id);
        else addWornPearlId(orb.id);
        const orbiting = loadWornPearlIds();
        const packs = orbiting
          .map((id) => semanticOrbs.find((entry) => entry.id === id) || (id === orb.id ? orb : null))
          .filter(Boolean)
          .map((entry) => buildWornPearlPack(entry));
        await action("pearl-worn-orbit", { packs, pearlIds: loadWornOrbitState().pearlIds }).catch(() => {});
        setReadyMessage(orbiting.length > 1
          ? `“${orb.name}” joined the orbit (${orbiting.length} pearls around the companion).`
          : `“${orb.name}” is orbiting the companion.`);
      } else {
        setReadyMessage(`Opened “${orb.name}”.`);
      }
      await action("page-canvas-command", { command: "activatePearlPageCanvas", args: { pearlId: orb.id } }).catch(() => {});
      if (previousPearlId && previousPearlId !== orb.id && pearlSoundscapes[previousPearlId]?.playback === "playing") {
        await controlPearlAudio("stop", { pearlId: previousPearlId }).catch(() => {});
      }
      if (pearlSoundscapes[orb.id]?.activation?.onPearlActivation && pearlSoundscapes[orb.id]?.activeTrackId) {
        await controlPearlAudio("play", { pearlId: orb.id }).catch(() => {});
      }
      setActiveView("orbs");
      return { type: "external-semantic-orb-active", id: orb.id, worn: args.wear !== false };
    }
    if (name === "add-context") {
      const items = args.items?.length ? args.items : session.fragments.slice(-1);
      const context = new Map((orb.workingSet.context || []).map((item) => [item.id, item]));
      items.forEach((item) => item?.id && context.set(item.id, item));
      byId.set(orb.id, createSemanticOrb({ ...orb, workingSet: { ...orb.workingSet, context: [...context.values()] } }));
    } else if (name === "remove-context") {
      byId.set(orb.id, createSemanticOrb({
        ...orb,
        workingSet: { ...orb.workingSet, context: (orb.workingSet.context || []).filter((item) => item.id !== args.contextId) },
      }));
    } else if (name === "apply-lens") {
      const lens = args.lens || generators.find((entry) => entry.id === args.lensId) || library.find((entry) => entry.id === args.lensId)?.operator;
      if (!lens?.id) throw new Error("Lens not found");
      const lenses = new Map((orb.workingSet.lenses || []).map((entry) => [entry.id, entry]));
      lenses.set(lens.id, { ...lens, strength: args.strength ?? .7 });
      byId.set(orb.id, createSemanticOrb({ ...orb, workingSet: { ...orb.workingSet, lenses: [...lenses.values()] } }));
    } else if (name === "remove-lens") {
      byId.set(orb.id, createSemanticOrb({
        ...orb,
        workingSet: { ...orb.workingSet, lenses: (orb.workingSet.lenses || []).filter((lens) => lens.id !== args.lensId) },
      }));
    } else if (name === "rename") {
      byId.set(orb.id, createSemanticOrb({ ...orb, name: String(args.name || "Untitled orb").slice(0, 80) }));
    } else if (name === "duplicate") {
      const duplicate = createSemanticOrb({
        ...orb,
        id: `external-orb:${crypto.randomUUID()}`,
        name: args.name || `${orb.name} copy`,
        placement: { ...orb.placement, x: orb.placement.x + 42, y: orb.placement.y + 42 },
        parentOrbId: null,
        childOrbIds: [],
        lineage: [...(orb.lineage || []), { orbId: orb.id, operation: "duplicate" }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      byId.set(duplicate.id, duplicate);
      await persistSemanticOrbs([...byId.values()], duplicate.id);
      return { type: "external-semantic-orb-duplicate", id: duplicate.id, orb: duplicate };
    } else if (name === "split") {
      const parts = orb.workingSet.context?.length
        ? orb.workingSet.context
        : (orb.childOrbIds || []).map((id) => ({ id, kind: "grouped-context", label: id }));
      if (!parts.length) throw new Error("orb has nothing to split");
      const additions = parts.map((part, index) => createSemanticOrb(semanticOrbFromMaterial(part, {
        id: `external-orb:${crypto.randomUUID()}`,
        sceneId: orb.sceneId,
        placement: {
          x: orb.placement.x + Math.cos(index * 2.3999632297) * 70,
          y: orb.placement.y + Math.sin(index * 2.3999632297) * 70,
        },
      })));
      additions.forEach((entry) => byId.set(entry.id, createSemanticOrb({
        ...entry,
        lineage: [...(entry.lineage || []), { orbId: orb.id, operation: "split" }],
      })));
    } else if (name === "unnest") {
      if (orb.parentOrbId && byId.has(orb.parentOrbId)) {
        const parent = byId.get(orb.parentOrbId);
        byId.set(parent.id, createSemanticOrb({ ...parent, childOrbIds: (parent.childOrbIds || []).filter((id) => id !== orb.id) }));
      }
      byId.set(orb.id, createSemanticOrb({ ...orb, parentOrbId: null }));
    } else if (name === "delete") {
      byId.delete(orb.id);
      for (const entry of byId.values()) {
        if (entry.parentOrbId === orb.id || entry.childOrbIds?.includes(orb.id)) {
          byId.set(entry.id, createSemanticOrb({
            ...entry,
            parentOrbId: entry.parentOrbId === orb.id ? null : entry.parentOrbId,
            childOrbIds: (entry.childOrbIds || []).filter((id) => id !== orb.id),
          }));
        }
      }
    } else if (name === "archive") {
      byId.set(orb.id, createSemanticOrb({ ...orb, archived: args.archived !== false }));
    }
    const next = [...byId.values()];
    await persistSemanticOrbs(next, (name === "archive" && args.archived !== false || name === "delete") && activeSemanticOrbId === orb.id ? null : activeSemanticOrbId);
    return { type: `external-semantic-orb-${name}`, id: orb.id, orb: byId.get(orb.id) };
  }

  async function action(type, payload) {
    setError("");
    setRetryAction(null);
    try {
      const value = await call(type, payload);
      if (value?.fragments || value?.queue || value?.results) setSession(value);
      else await refresh();
      return value;
    } catch (e) {
      setError(recoveryMessage(e, type));
      setRetryAction(() => () => action(type, payload));
      return null;
    }
  }

  async function toggleOrbCursor(enabled = !orbCursorEnabled) {
    const value = await action("toggle-orb-cursor", { enabled, source: "control" });
    if (value?.enabled != null) setOrbCursorEnabled(value.enabled === true);
    return value;
  }

  async function go() {
    if (!characters) {
      setError("GO is blocked until page material is captured. Select text on the page, then choose Capture selection.");
      setActiveView("context");
      return;
    }
    if (!session.queue.length && !session.generator) {
      setError("GO is blocked until you choose a Move or Function, or apply Lens context.");
      setActiveView("library");
      return;
    }
    const privacyDisclosureApproved = confirm(`Send exactly ${characters.toLocaleString()} selected characters to the configured model provider and stage up to ${preview?.predictedOutputCount || 1} local Result Pearls?`);
    if (!privacyDisclosureApproved) return;
    setRunning(true);
    try {
      const result = await action("go", { disclosedCharacters: characters, generationPlan, idempotencyKey: crypto.randomUUID(), privacyDisclosureApproved });
      if (result) {
        setActiveView("review");
        if (result.pendingOutputRouting) {
          setCompanion(result.pendingOutputRouting.question || "Where should this output go?");
          setPearlOpen(true);
        }
        BrowserPlatform.storage.get("local", ["firstGoTracked"]).then((value) => {
          if (!value.firstGoTracked) {
            trackFunnel("first_go");
            BrowserPlatform.storage.set("local", { firstGoTracked: true });
          }
        });
      }
    } finally {
      setRunning(false);
    }
  }

  async function proposeResultPlacement(resultId, answer) {
    const routing = await action("output-routing-answer", { resultId: resultId || session.pendingOutputRouting?.activeResultId || "latest", answer });
    const request = routing?.object;
    if (request?.stage === "confirming") {
      setCompanion(request.plan.summary);
      setPearlOpen(true);
    } else if (request?.clarification) {
      setCompanion(request.clarification);
      setPearlOpen(true);
    }
    return routing;
  }

  async function proposePrivacyPatch(patch) {
    const privacy = privacySurface || await call("privacy-policy-get", { pearlId: activeSemanticOrbId || "pearl:extension-default" });
    setPrivacySurface(privacy);
    const proposal = await call("privacy-policy-propose", {
      pearlId: privacy.policy.pearlId,
      expectedVersion: privacy.policy.version,
      patch,
    });
    setPrivacyProposal(proposal.object);
    setCompanion("Apply this privacy change?");
    setPearlOpen(true);
  }

  function applySoundscapeResult(value) {
    if (!value?.soundscape?.pearlId) return value;
    setPearlSoundscapes((current) => ({ ...current, [value.soundscape.pearlId]: value.soundscape }));
    return value;
  }

  async function searchPearlAudio(search, provider = "internet-archive") {
    if (!activeSemanticOrbId) throw new Error("Choose a Pearl before adding a soundscape.");
    const value = await call("pearl-audio-search", { pearlId: activeSemanticOrbId, query: search, provider });
    setAudioSearchResults(value.tracks || []);
    return value;
  }

  async function addPearlAudio(track) {
    const value = await call("pearl-audio-add", { pearlId: activeSemanticOrbId, track });
    setAudioSearchResults([]);
    return applySoundscapeResult(value);
  }

  async function uploadPearlAudio(file) {
    if (!file) return;
    if (!file.type.startsWith("audio/")) throw new Error("Choose a supported audio file.");
    const value = await call("pearl-audio-upload", {
      pearlId: activeSemanticOrbId,
      title: file.name.replace(/\.[^.]+$/, "").slice(0, 240),
      mime: file.type,
      bytes: await file.arrayBuffer(),
    });
    applySoundscapeResult(value);
  }

  async function controlPearlAudio(actionName, options = {}) {
    const { pearlId = activeSemanticOrbId, ...controlOptions } = options;
    const value = await call("pearl-audio-control", {
      pearlId,
      action: actionName,
      userGesture: true,
      ...controlOptions,
    });
    return applySoundscapeResult(value);
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
      BrowserPlatform.storage.set("local", { onboardingMode: "signed-in" });
      trackFunnel("sign_in");
    } catch (e) {
      setError(e.message);
    }
  }

  async function signOut() {
    setError("");
    try {
      await call("auth-logout");
      setAuth(false);
      location.reload();
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
    BrowserPlatform.storage.set("local", { onboardingMode: "local" });
    trackFunnel("continue_local");
  }

  function finishOnboarding() {
    BrowserPlatform.storage.set("local", { onboardingComplete: true, onboardingMode });
    setOnboardingStep(0);
  }

  function skipOnboarding() {
    BrowserPlatform.storage.set("local", { onboardingComplete: true, onboardingMode: onboardingMode || "local" });
    setOnboardingStep(0);
  }

  async function runCompanionCommand(raw = companion) {
    try {
      const request = String(raw || "").trim();
      if (privacyProposal && /^(?:yes|confirm|apply it)$/i.test(request)) {
        const applied = await call("privacy-policy-apply", {
          pearlId: privacySurface?.policy?.pearlId,
          proposalId: privacyProposal.id,
          confirmed: true,
        });
        setPrivacySurface((current) => ({ ...(current || {}), policy: applied.object }));
        setPrivacyProposal(null);
        setCompanion("");
        return;
      }
      if (/\bwhat is private here\b|\bshow (?:this )?pearl privacy\b|\bprivacy (?:policy|settings)\b/i.test(request)) {
        const privacy = await call("privacy-policy-get", { pearlId: activeSemanticOrbId || "pearl:extension-default" });
        setPrivacySurface(privacy);
        setPrivacyProposal(null);
        setCompanion("");
        setPearlOpen(false);
        return;
      }
      if (/\bkeep (?:this|it) local\b|\blocal only\b/i.test(request)) {
        const privacy = privacySurface || await call("privacy-policy-get", { pearlId: activeSemanticOrbId || "pearl:extension-default" });
        setPrivacySurface(privacy);
        const proposed = await call("privacy-policy-propose", {
          pearlId: privacy.policy.pearlId,
          expectedVersion: privacy.policy.version,
          patch: { audience: "local-only", storage: { mode: "device-only", queuedEncryptedSync: false } },
        });
        setPrivacyProposal(proposed.object);
        setCompanion("Keep this Pearl local-only and device-only?");
        setPearlOpen(true);
        return;
      }
      if (/\bshare only inside\b|\bpartners? run but not inspect\b/i.test(request)) {
        setCompanion("Choose a verified organization or group before changing this Pearl’s access.");
        setPearlOpen(true);
        return;
      }
      const inspectView = /\b(?:show|inspect|let me see|what)\b.*\b(?:noticed|selected|source|context)\b/i.test(request)
        ? "context"
        : /\b(?:show|inspect|let me see)\b.*\b(?:kept|saved|pearls?)\b/i.test(request)
          ? "orbs"
          : /\b(?:show|inspect|let me see)\b.*\b(?:tools|library|things i can reuse)\b/i.test(request)
            ? "library"
            : /\b(?:show|inspect|let me see)\b.*\b(?:results?|choices?|options?)\b/i.test(request)
              ? "taste"
              : /\b(?:show|inspect|let me see|what)\b.*\b(?:next|about to do|queued)\b/i.test(request)
                ? "review"
                : /\b(?:show|open|change)\b.*\b(?:preferences|account|settings)\b/i.test(request)
                  ? "settings"
                  : null;
      if (inspectView) {
        setActiveView(inspectView);
        setCompanion("");
        setPearlOpen(false);
        return;
      }
      if (session.pendingOutputRouting?.activeResultId && request) {
        const resultId = session.pendingOutputRouting.activeResultId;
        const response = /^(?:yes|confirm|place it|do it)$/i.test(request)
          ? await call("output-routing-confirm", { resultId })
          : /^(?:cancel|never ?mind|stop)$/i.test(request)
            ? await call("output-routing-cancel", { resultId })
            : await call("output-routing-answer", { resultId, answer: request });
        const fresh = await call("get-session");
        setSession(fresh || { fragments: [], queue: [], generator: null, results: [] });
        const routing = response?.object?.routing || response?.object;
        setCompanion(routing?.stage === "confirming"
          ? routing.plan?.summary || "Confirm this placement?"
          : routing?.stage === "clarifying" || routing?.stage === "choosing"
            ? routing.clarification || routing.question || "Where should this output go?"
            : "");
        if (!["confirming", "clarifying", "choosing"].includes(routing?.stage)) setPearlOpen(false);
        return;
      }
      if (/\b(?:use|activate|open)\b.*\b(?:this )?pearl\b.*\bhere\b/i.test(request)) {
        await action("page-canvas-command", { command: "activatePearlPageCanvas", args: { pearlId: activeSemanticOrbId } });
        setCompanion("");
        setPearlOpen(false);
        return;
      }
      if (/\b(?:edit|use|return to)\b.*\b(?:page|website)\b.*\b(?:again|normally|native)?\b/i.test(request)) {
        await action("page-canvas-command", { command: "deactivatePearlPageCanvas", args: { pearlId: activeSemanticOrbId } });
        setCompanion("");
        setPearlOpen(false);
        return;
      }
      const canvasMode = /\b(?:draw|pen)\b/i.test(request) ? "pen"
        : /\bhighlight(?:er)?\b/i.test(request) ? "highlighter"
          : /\berase|eraser\b/i.test(request) ? "eraser"
            : /\blasso|select several\b/i.test(request) ? "lasso"
              : /\b(?:text box|textbox|type placement)\b/i.test(request) ? "select-type"
                : /\b(?:paste|drop|place) (?:an )?image\b/i.test(request) ? "image"
                  : null;
      if (canvasMode) {
        if (/\bcontext\b/i.test(request) && session.fragments.length) {
          await action("page-canvas-command", {
            command: "bindPearlCanvasContext",
            args: {
              pearlId: activeSemanticOrbId,
              entries: session.fragments.map((entry) => ({
                id: entry.id,
                kind: "page-selection",
                ref: entry.id,
                summary: String(entry.quote || "").slice(0, 160),
                provenance: entry.provenance,
              })),
            },
          });
        }
        if (canvasMode === "select-type" && /\b(?:answer|output|result)\b/i.test(request)) {
          await action("page-canvas-command", {
            command: "setPearlCanvasOutputDestination",
            args: { pearlId: activeSemanticOrbId, destination: { type: "canvas-textbox", scope: "selected-output" } },
          });
        }
        await action("page-canvas-command", {
          command: "setPearlCanvasInputMode",
          args: { pearlId: activeSemanticOrbId, mode: canvasMode },
        });
        setCompanion("");
        setPearlOpen(false);
        return;
      }
      const audioSearch = request.match(/\b(?:search for|find|give (?:this )?pearl)\s+(.+?)(?:\s+(?:music|audio|ambience|soundscape|song))?$/i);
      if (audioSearch && /\b(?:music|audio|ambience|soundscape|song|rain|room tone)\b/i.test(request)) {
        const queryText = audioSearch[1].replace(/\b(?:music|audio|soundscape|song)\b/gi, "").trim();
        const procedural = /\b(?:rain|room tone|brown noise|soft noise)\b/i.test(queryText);
        const found = await searchPearlAudio(queryText, procedural ? "procedural" : "internet-archive");
        if (procedural && found.tracks[0]) await addPearlAudio(found.tracks[0]);
        setCompanion("");
        setPearlOpen(false);
        return;
      }
      if (/\buse (?:this|that|the) (?:song|track|sound)\b/i.test(request) && audioSearchResults[0]) {
        await addPearlAudio(audioSearchResults[0]);
        setCompanion("");
        setPearlOpen(false);
        return;
      }
      if (/\bupload\b.*\b(?:track|audio|song)\b/i.test(request)) {
        audioFileRef.current?.click();
        setCompanion("");
        setPearlOpen(false);
        return;
      }
      if (/^(?:preview|play|resume)(?: (?:the )?(?:music|soundscape|track))?$/i.test(request)) {
        await controlPearlAudio("play");
        setCompanion("");
        setPearlOpen(false);
        return;
      }
      if (/\b(?:pause|stop)\b.*\b(?:music|soundscape|track|audio)?\b/i.test(request)) {
        await controlPearlAudio(/\bstop\b/i.test(request) ? "stop" : "pause");
        setCompanion("");
        setPearlOpen(false);
        return;
      }
      if (/\bturn (?:it|the music) down\b/i.test(request)) {
        const currentVolume = pearlSoundscapes[activeSemanticOrbId]?.volume ?? .55;
        await controlPearlAudio("volume", { volume: Math.max(0, currentVolume - .15) });
        setCompanion("");
        setPearlOpen(false);
        return;
      }
      const planned = await planExtensionIntent(raw, {
        requestPlan: (request) => call("adaptive-companion-plan", { request }),
      });
      const command = planned.commands[0];
      const outputs = session.results.flatMap((run) => run.outputs);
      const approvalRequired = extensionCommandNeedsApproval(command.name) || [
        "installExternalPackage", "teachExternalPersonalCommand", "deleteExternalLocalData",
        "removeExternalPearlAudioTrack", "saveExternalPearlTrackOffline", "deleteExternalResultPearl",
      ].includes(command.name);
      const confirmed = !approvalRequired || window.confirm(
        command.name === "teachExternalPersonalCommand"
          ? `Remember “${command.args.trigger}” in ${command.args.scope} scope?`
          : command.name === "deleteExternalLocalData"
            ? "Delete only this profile’s local Pearl metadata? This does not delete account data."
            : command.name === "removeExternalPearlAudioTrack"
              ? "Remove this track and its current-profile local audio copy?"
              : command.name === "saveExternalPearlTrackOffline"
                ? "Save this rights-eligible track locally for offline playback?"
                : command.name === "deleteExternalResultPearl"
                  ? "Delete this persisted result Pearl? Its source material will not be changed."
          : command.name === "installExternalPackage"
            ? `Verify and install ${command.args.manifest?.namespace}/${command.args.manifest?.name}@${command.args.manifest?.version}?`
            : extensionCommandNeedsApproval(command.name)
              ? `Allow Pearl to run ${command.name} with the shown arguments?\n\n${JSON.stringify(command.args || {}, null, 2).slice(0, 1200)}`
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
        proposeResultPlacement,
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
        inspectPrivacy: async () => {
          const consent = await BrowserPlatform.storage.get("local", ["pearlSyncConsent"]);
          const local = await BrowserPlatform.storage.exportLocal();
          const summary = {
            mode: consent.pearlSyncConsent === "enabled" ? "explicit sync enabled" : "local only",
            profile: local.profile,
            storedCategories: Object.keys(local.entries || {}).length,
          };
          setReadyMessage(`${summary.mode}. ${summary.storedCategories} local data categories in this ${summary.profile} profile.`);
          return summary;
        },
        exportLocalData: async () => {
          const local = await BrowserPlatform.storage.exportLocal();
          const url = URL.createObjectURL(new Blob([JSON.stringify(local, null, 2)], { type: "application/json" }));
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = "pearl-local-data.json";
          anchor.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          return { exported: true, profile: local.profile };
        },
        setSync: async (enabled) => {
          await BrowserPlatform.storage.set("local", { pearlSyncConsent: enabled ? "enabled" : "disabled" });
          if (enabled) {
            let synced = await call("library-refresh", { sync: true });
            if (synced.requiresAdoption) {
              const merge = window.confirm(`This device has ${synced.adoption.localCount} local items and the account has ${synced.adoption.accountCount}. Merge both into this profile? Cancel keeps local work separate and leaves sync off.`);
              if (!merge) {
                await BrowserPlatform.storage.set("local", { pearlSyncConsent: "disabled" });
                setReadyMessage("Sync remains off. Local and account work stayed separate.");
                return { enabled: false, adoption: "keep-local" };
              }
              synced = await call("library-refresh", { sync: true, adoption: "merge" });
            }
            applyLibrary(synced);
          }
          setReadyMessage(enabled ? "Sync is enabled for this profile." : "Sync is off. Local work remains on this device.");
          return { enabled };
        },
        deleteLocalData: async () => {
          const receipt = await call("privacy-delete-local", { confirmed: true });
          setSession(emptySession());
          setLibrary([]);
          setGenerators([]);
          setSemanticOrbs([]);
          setReadyMessage(`Local profile data deleted at ${receipt.at}.`);
          return receipt;
        },
        lockPearls: async () => {
          const secret = window.prompt("Enter this profile’s passphrase, or create one (12+ characters) the first time. Losing it makes protected local data unrecoverable.");
          if (!secret) throw new Error("locking was cancelled");
          const value = await call("privacy-lock", { secret });
          setSession(emptySession());
          setLibrary([]);
          setGenerators([]);
          setSemanticOrbs([]);
          setReadyMessage("Local Pearls are locked on this device.");
          return value;
        },
        unlockPearls: async () => {
          const secret = window.prompt("Enter this profile’s local passphrase.");
          if (!secret) throw new Error("unlocking was cancelled");
          const value = await call("privacy-unlock", { secret });
          const [restoredSession, restoredLocal] = await Promise.all([
            call("get-session"),
            BrowserPlatform.storage.get("local", ["operators", "generators", "rack", "semanticOrbs", "activeSemanticOrbId"]),
          ]);
          setSession(restoredSession);
          applyLibrary(restoredLocal);
          setSemanticOrbs(restoredLocal.semanticOrbs || []);
          setActiveSemanticOrbId(restoredLocal.activeSemanticOrbId || null);
          setReadyMessage("Local Pearls are unlocked.");
          return value;
        },
        bindCanvasContext: () => action("page-canvas-command", {
          command: "bindPearlCanvasContext",
          args: {
            entries: session.fragments.map((entry) => ({
              id: entry.id,
              kind: "page-selection",
              ref: entry.id,
              summary: String(entry.quote || "").slice(0, 160),
              provenance: entry.provenance,
            })),
          },
        }),
        searchAudio: searchPearlAudio,
        chooseAudio: () => {
          audioFileRef.current?.click();
          return { chooser: "audio" };
        },
        addAudio: addPearlAudio,
        controlAudio: controlPearlAudio,
        updateAudio: (args) => controlPearlAudio("volume", args),
        openGuide: () => {
          setGuideOpen(true);
          setActiveView("idle");
          return { type: "extension-guide", opened: true };
        },
        animate: async () => {
          setGhost(true);
          await new Promise((resolve) => setTimeout(resolve, 240));
          setGhost(false);
        },
      });
      if (/PearlAesthetic|pearl-aesthetic|companion-aesthetic/i.test(command.name)) {
        setPearlAesthetic(loadCompanionAesthetic());
      }
      setCompanion("");
      setPearlOpen(false);
    } catch (e) {
      setError(e.message);
    }
  }

  async function directCompanion(event) {
    event.preventDefault();
    await runCompanionCommand();
  }

  async function runPearlAction(pearlAction) {
    if (pearlAction.platform === "app") {
      await action("open-web-handoff", {
        surface: "pearl-capability",
        capability: pearlAction.capability,
        preservePayload: true,
      });
      setPearlOpen(false);
      return;
    }
    setCompanion(pearlAction.example);
    await runCompanionCommand(pearlAction.example);
  }

  async function dropOnPearl(event) {
    event.preventDefault();
    const audioFile = [...(event.dataTransfer?.files || [])].find((entry) => entry.type.startsWith("audio/"));
    if (audioFile) {
      await uploadPearlAudio(audioFile);
      setActiveView("idle");
      setPearlOpen(false);
      return;
    }
    const portable = event.dataTransfer?.getData("application/x-lens-object");
    const text = event.dataTransfer?.getData("text/plain")?.trim();
    let object = null;
    try { object = portable ? JSON.parse(portable) : null; } catch { /* plain text remains valid material */ }
    if (object && ["lens", "generator"].includes(object.kind || object.type)) {
      await action("set-generator", { generator: object });
      setReadyMessage("Context noticed.");
    } else if (object && ["move", "function", "operator"].includes(object.kind || object.type || object.libraryKind)) {
      await action("queue-lens", { lens: object });
      setReadyMessage("Ready.");
    } else if (text || object) {
      const fragment = {
        ...(object || {}),
        id: object?.id || `pearl-drop:${crypto.randomUUID()}`,
        quote: object?.quote || object?.text || text,
        provenance: object?.provenance || { title: "Dropped into Pearl", origin: "sidepanel", capturedAt: new Date().toISOString() },
      };
      await action("fragments-changed", { fragments: [...session.fragments.filter((entry) => entry.id !== fragment.id), fragment] });
      setReadyMessage("Noticed.");
    }
    setActiveView("idle");
    setPearlOpen(false);
  }

  function toggleCompanionVoice() {
    if (voiceListening) {
      voiceRecognizerRef.current?.stop?.();
      setVoiceListening(false);
      return;
    }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setError("Voice recognition is unavailable in this browser. Type the same command in Tell Pearl your goal, then choose Run.");
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
      if (event.error !== "aborted") setError(event.error === "not-allowed"
        ? "Microphone permission was denied. Allow microphone access in Chrome settings or type the command instead."
        : `Voice recognition stopped (${event.error}). Type the command or retry voice.`);
      setVoiceListening(false);
    };
    recognizer.onend = () => setVoiceListening(false);
    voiceRecognizerRef.current = recognizer;
    recognizer.start();
    setVoiceListening(true);
  }

  const orbPhase = voiceListening ? "listening" : running || chatRunning || learning ? "executing" : error ? "blocked" : "idle";
  const latestRun = session.results.at(-1) || null;
  const latestResult = session.results.at(-1)?.outputs?.at(-1) || null;
  const latestResultId = latestRun && latestResult
    ? `result-pearl:${latestRun.runId}:${latestResult.branchIndex ?? Math.max(0, latestRun.outputs.length - 1)}`
    : null;
  const latestFragment = session.fragments.at(-1) || null;
  const contextualAction = latestFragment && (session.queue.length || session.generator)
    ? { label: "Make it", run: go }
    : latestFragment
      ? { label: "Keep this", run: () => semanticOrbAction("create", { material: latestFragment }) }
      : { label: "Notice selection", run: () => action("capture-selection") };
  const activeSoundscape = pearlSoundscapes[activeSemanticOrbId] || null;
  const activeTrack = activeSoundscape?.tracks?.find((entry) => entry.id === activeSoundscape.activeTrackId) || null;
  return <main data-orb-view={activeView}>
    <header>
      <ExtensionOrb phase={orbPhase} listening={voiceListening} aesthetic={pearlAesthetic} onCommandView={() => {
        setPowerSearch(false);
        setPearlOpen((value) => !value);
      }}
        onDropMaterial={dropOnPearl}
        contextCount={session.fragments.length} lensActive={Boolean(session.generator)} candidateCount={session.results.flatMap((run) => run.outputs).length} />
    </header>
    <input
      ref={audioFileRef}
      className="sr-only"
      type="file"
      accept="audio/mpeg,audio/mp4,audio/ogg,audio/wav,audio/webm,audio/flac"
      onChange={(event) => uploadPearlAudio(event.target.files?.[0]).catch((reason) => setError(reason.message))}
      aria-label="Upload local audio for this Pearl"
    />
    {privacySurface && <section className="pearl-privacy-surface" aria-label="Pearl privacy policy">
      <header><span>Privacy · v{privacySurface.policy.version}</span><button type="button" onClick={() => { setPrivacySurface(null); setPrivacyProposal(null); }}>Close</button></header>
      <p><b>{privacySurface.policy.audience}</b> · {privacySurface.policy.sensitivity} · {privacySurface.policy.storage.mode}</p>
      <p>{privacySurface.observation.lockState} · {privacySurface.observation.integrity}{privacySurface.observation.conflicts.length ? ` · ${privacySurface.observation.conflicts.length} conflict` : ""}</p>
      <div>
        <button type="button" onClick={() => proposePrivacyPatch({ audience: "local-only", storage: { mode: "device-only", queuedEncryptedSync: false } })}>Keep local</button>
        <button type="button" aria-pressed={privacySurface.policy.disclosure.model.allowed} onClick={() => proposePrivacyPatch({ disclosure: { model: { ...privacySurface.policy.disclosure.model, allowed: !privacySurface.policy.disclosure.model.allowed, requiresApproval: true } } })}>Model access</button>
        <button type="button" aria-pressed={privacySurface.policy.disclosure.research.allowed} onClick={() => proposePrivacyPatch({ disclosure: { research: { ...privacySurface.policy.disclosure.research, allowed: !privacySurface.policy.disclosure.research.allowed, requiresApproval: true } } })}>Research access</button>
      </div>
      {privacyProposal && <div className="pearl-privacy-diff" role="alert">
        <span>{privacyProposal.relaxation ? "This expands access." : "This keeps or tightens access."}</span>
        <button type="button" onClick={() => runCompanionCommand("confirm")}>Confirm</button>
        <button type="button" onClick={() => { setPrivacyProposal(null); setCompanion(""); }}>Cancel</button>
      </div>}
    </section>}
    {activeView === "idle" && !pearlOpen && (latestResult || latestFragment) && <section className="pearl-transient-material" aria-label={latestResult ? "Latest result" : "Current material"}>
      <p>{String(latestResult?.text || latestFragment?.quote || latestFragment?.text || "").slice(0, 600)}</p>
      {latestResult && <div>
        <button type="button" onClick={() => proposeResultPlacement(latestResultId, "insert at the caret")}>Use</button>
        <button type="button" onClick={() => semanticOrbAction("create", { material: latestResult })}>Keep</button>
      </div>}
    </section>}
    {activeView === "idle" && !pearlOpen && audioSearchResults.length > 0 && <section className="pearl-audio-choices" aria-label="Licensed audio choices">
      {audioSearchResults.slice(0, 3).map((track) => <button type="button" key={track.id} onClick={() => addPearlAudio(track).catch((reason) => setError(reason.message))}>
        <span>{track.title}</span><small>{track.artist || track.provider} · {track.license.spdx || "Provider terms"}</small>
      </button>)}
    </section>}
    {activeView === "idle" && !pearlOpen && activeTrack && <section className="pearl-now-playing" aria-label="Pearl soundscape" aria-live="polite">
      <span><b>{activeTrack.title}</b><small>{activeSoundscape.playback}</small></span>
      <button type="button" onClick={() => controlPearlAudio(activeSoundscape.playback === "playing" ? "pause" : "play").catch((reason) => setError(reason.message))}>
        {activeSoundscape.playback === "playing" ? "Pause" : "Play"}
      </button>
      <label><span className="sr-only">Soundscape volume</span><input type="range" min="0" max="1" step=".05" value={activeSoundscape.volume} onChange={(event) => controlPearlAudio("volume", { volume: Number(event.target.value) }).catch(() => {})} /></label>
      <button type="button" onClick={() => controlPearlAudio("stop").catch(() => {})}>Stop</button>
    </section>}
    {guideOpen && <section className="extension-pearl-guide" role="dialog" aria-label="How Pearl works">
      <header><b>How Pearl works</b><button type="button" onClick={() => setGuideOpen(false)}>Close</button></header>
      {guideSectionsFor("extension").map((section, index) => <div key={section.id} className="extension-guide-section" style={{ "--guide-index": index }}>
        <h3>{section.title}</h3>
        <p>{section.summary}</p>
        <ul>{section.items.map((item) => <li key={item.id}>
          <b>{item.label}</b>
          <span>{item.detail}</span>
          {item.gesture && <i>{item.gesture}</i>}
          {item.command && <i>Say “{item.command}”</i>}
        </li>)}</ul>
      </div>)}
    </section>}
    {!guideOpen && !pearlOpen && <button type="button" className="extension-guide-button" aria-label="How Pearl works" title="How Pearl works" onClick={() => setGuideOpen(true)}>?</button>}
    {pearlOpen && <aside className="extension-pearl-halo" aria-label={powerSearch ? "Universal Pearl command search" : "Pearl command"}>
      {!powerSearch && <form onSubmit={directCompanion}>
        <input autoFocus aria-label="Tell Pearl your goal" value={companion} onChange={(event) => setCompanion(event.target.value)} placeholder="What do you want?" />
        <button type="submit" aria-label="Send command">→</button>
      </form>}
      {!powerSearch && <div className="pearl-quick-actions" role="group" aria-label="Pearl quick actions">
        <button type="button" onClick={() => { setGuideOpen(true); setPearlOpen(false); }}>How Pearl works</button>
        <button type="button" onClick={() => { setActiveView("orbs"); setPearlOpen(false); }}>Library</button>
        <button type="button" onClick={() => { setActiveView("settings"); setPearlOpen(false); }}>{auth ? "Account" : "Sign in"}</button>
        <button type="button" onClick={() => { setActiveView("context"); setPearlOpen(false); }}>Import / capture</button>
        <button type="button" className="pearl-contextual-action" onClick={() => {
          contextualAction.run?.();
          setPearlOpen(false);
        }}>{contextualAction.label}</button>
      </div>}
      {powerSearch && <>
        <input autoFocus type="search" aria-label="Search every Pearl action" value={pearlQuery} onChange={(event) => setPearlQuery(event.target.value)} placeholder="Search by intent…" />
        <div className="extension-pearl-actions">
          {pearlQuery.trim() && searchPearlActions(pearlQuery, { platform: "extension" }).slice(0, 5).map((pearlAction) => <button type="button" key={pearlAction.id} onClick={() => runPearlAction(pearlAction)}>
            <b>{pearlActionPrompt(pearlAction)}</b>
          </button>)}
        </div>
      </>}
    </aside>}
    {!["idle", "command"].includes(activeView) && <button className="extension-emission-close" type="button" aria-label="Collapse view into Pearl" onClick={() => setActiveView("idle")}>Collapse into Pearl</button>}
    <section className={`orb-panel extension-semantic-orbs ${activeView === "orbs" ? "active" : ""}`} aria-label="Saved pearls">
      <div className="extension-semantic-orb-head">
        <div><h2>Pearls</h2><small>Source-linked semantic capsules you can reopen and keep shaping.</small></div>
        <button className="gold" type="button" onClick={() => semanticOrbAction("create", { name: "Untitled pearl", material: session.fragments.at(-1) || null }).catch(() => {})}>
          {session.fragments.length ? "Make a pearl" : "New empty pearl"}
        </button>
      </div>
      <div className="extension-semantic-orb-tray">
        {semanticOrbs.filter((orb) => !orb.archived).map((orb) => <button
          type="button"
          key={orb.id}
          aria-pressed={activeSemanticOrbId === orb.id}
          onClick={() => semanticOrbAction("open", { id: orb.id })}
        >
          <span dangerouslySetInnerHTML={{ __html: physicalPearlMarkup({ id: `sidepanel-semantic-${String(orb.id).replace(/[^a-zA-Z0-9_-]/g, "")}`, variant: "semantic", state: activeSemanticOrbId === orb.id ? "listening" : "idle", size: 30, decorative: true }) }} />
          <b>{orb.name}</b>
          <small>{orb.representation?.kind || "empty"} · {orb.workingSet?.context?.length || 0} context</small>
        </button>)}
        {!semanticOrbs.some((orb) => !orb.archived) && <p>No saved pearls yet. Select page material and make your first pearl.</p>}
      </div>
      {activeSemanticOrbId && semanticOrbs.find((orb) => orb.id === activeSemanticOrbId) && <div className="extension-semantic-orb-detail">
        <input
          aria-label="Semantic orb name"
          key={`${activeSemanticOrbId}:${semanticOrbs.find((orb) => orb.id === activeSemanticOrbId).name}`}
          defaultValue={semanticOrbs.find((orb) => orb.id === activeSemanticOrbId).name}
          onBlur={(event) => {
            const name = event.currentTarget.value.trim();
            if (name) semanticOrbAction("rename", { id: activeSemanticOrbId, name });
          }}
        />
        <button type="button" disabled={!session.fragments.length} onClick={() => semanticOrbAction("add-context", { id: activeSemanticOrbId, items: session.fragments.slice(-1) })}>Add current capture</button>
        {(semanticOrbs.find((orb) => orb.id === activeSemanticOrbId).workingSet?.context || []).map((item) => <span key={item.id}>
          {item.label || item.quote || item.text || item.id}
          <button type="button" aria-label={`Remove ${item.label || item.id} context`} onClick={() => semanticOrbAction("remove-context", { id: activeSemanticOrbId, contextId: item.id })}>×</button>
        </span>)}
        {(semanticOrbs.find((orb) => orb.id === activeSemanticOrbId).workingSet?.lenses || []).map((lens) => <span key={lens.id}>
          {lens.name || lens.label || lens.id}
          <button type="button" aria-label={`Remove ${lens.name || lens.id} Lens`} onClick={() => semanticOrbAction("remove-lens", { id: activeSemanticOrbId, lensId: lens.id })}>×</button>
        </span>)}
        <button type="button" onClick={() => semanticOrbAction("duplicate", { id: activeSemanticOrbId })}>Duplicate</button>
        <button type="button" disabled={!(semanticOrbs.find((orb) => orb.id === activeSemanticOrbId).workingSet?.context?.length || semanticOrbs.find((orb) => orb.id === activeSemanticOrbId).childOrbIds?.length)} onClick={() => semanticOrbAction("split", { id: activeSemanticOrbId })}>Split</button>
        {semanticOrbs.find((orb) => orb.id === activeSemanticOrbId).parentOrbId && <button type="button" onClick={() => semanticOrbAction("unnest", { id: activeSemanticOrbId })}>Unnest</button>}
        <button type="button" onClick={() => action("open-web-handoff", { surface: "semantic-orb-scene", orbId: activeSemanticOrbId, preservePayload: true })}>Arrange in full Scene</button>
        <button type="button" onClick={() => semanticOrbAction("archive", { id: activeSemanticOrbId, archived: true })}>Archive</button>
        <button type="button" onClick={() => {
          if (confirm("Delete this orb? Its source material and library objects will remain.")) semanticOrbAction("delete", { id: activeSemanticOrbId });
        }}>Delete</button>
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
      <p>Import a chat, paste notes, or highlight the page — then make your first Pearl. Or ask Pearl in plain language.</p>
      <button type="button" className="gold" onClick={() => { setChatOpen(true); setActiveView("context"); }}>Paste a ChatGPT / Claude export</button>
      {sampleLens && <button onClick={() => action("queue-lens", { lens: { id: sampleLens.id, name: sampleLens.name, version: sampleLens.version, kind: "lens", outputSpec: outputContractFor(sampleLens.operator, map) } })}>
        <b>{sampleLens.name}</b><small>Sample Primitive Move</small>
      </button>}
    </section>}
    <section className={`orb-panel ${activeView === "context" ? "active" : ""} capture`}>
      <button onClick={() => action("toggle-highlighter")} className="gold">Highlight page</button>
      <button onClick={() => action("capture-selection")}>Capture selection</button>
      {characters > 0 && !semanticOrbs.length && <div className="first-pearl">
        <b>Your first Pearl is one click away.</b>
        <small>Keep this capture with its source link, then open Studio or encode a reusable process from it.</small>
        <button className="gold" type="button" onClick={() => semanticOrbAction("create", { material: session.fragments.at(-1) }).catch(() => {})}>Make a pearl</button>
      </div>}
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
      {(!characters || (!session.queue.length && !session.generator)) && <p className="blocked-guidance" role="status">
        {!characters ? "1. Capture a page selection. " : "1. Capture ready. "}
        {!session.queue.length && !session.generator ? "2. Choose a Move or Function, or apply Lens context. " : "2. Action or Lens ready. "}
        3. Press GO to create reviewable candidates.
      </p>}
      <button className="go" disabled={running || !characters || (!session.queue.length && !session.generator) || preview?.ok === false} onClick={go}>{running ? "Running…" : "GO"}</button>
      {running && <button onClick={() => action("cancel-run", { runId: session.activeRunId })}>Cancel</button>}
    </section>
    <section className={`orb-panel ${activeView === "taste" || activeView === "review" ? "active" : ""}`}>
      <h2>Preview results</h2>
      {!session.results.length && <p className="muted">Results stage here. The page never changes automatically.</p>}
      {session.results.flatMap((run) => run.outputs.map((output, outputIndex) =>
        <article className={`result ${output.tasteFeedback?.decision || ""}`} key={output.id}><small className="result-type">{output.semanticType || "Candidate"}{output.branchIndex != null ? ` · structural output ${output.branchIndex + 1}` : ""}</small><p>{output.text}</p>{(output.provenance || run.provenance) && <small className="model-provenance">{(output.provenance || run.provenance).requestedModel || "auto"} → {(output.provenance || run.provenance).resolvedModel || (output.provenance || run.provenance).model || "compatible model"}{(output.provenance || run.provenance).providerRoute ? ` via ${(output.provenance || run.provenance).providerRoute}` : ""}{(output.provenance || run.provenance).fallback ? " · fallback" : ""}</small>}<div><button aria-label="Accept candidate" onClick={() => action("taste-feedback", { outputId: output.id, decision: "accepted" })}>Yes</button><button aria-label="Reject candidate" onClick={() => action("taste-feedback", { outputId: output.id, decision: "rejected" })}>No</button>{output.tasteFeedback && <button onClick={() => action("taste-feedback", { outputId: output.id, decision: "undecided" })}>Undo</button>}<button onClick={() => proposeResultPlacement(`result-pearl:${run.runId}:${output.branchIndex ?? outputIndex}`, "copy it")}>Copy</button><button onClick={() => proposeResultPlacement(`result-pearl:${run.runId}:${output.branchIndex ?? outputIndex}`, "insert at the caret")}>Insert</button><button onClick={() => proposeResultPlacement(`result-pearl:${run.runId}:${output.branchIndex ?? outputIndex}`, "replace this selection")}>Replace</button><button onClick={() => action("result-pearl-open-tab", { resultId: `result-pearl:${run.runId}:${output.branchIndex ?? outputIndex}` })}>Open Pearl</button></div></article>
      ))}</section>
    <section className={`orb-panel ${activeView === "settings" ? "active" : ""} orb-settings`} aria-label="Orb settings">
      <h2>Settings</h2>
      <p className="muted">Voice stays local until you explicitly run a capability. Page capture always requires your action.</p>
      <button type="button" aria-pressed={orbCursorEnabled} onClick={() => toggleOrbCursor()}>
        {orbCursorEnabled ? "Return to native cursor" : "Let Pearl follow my cursor"}
      </button>
      <p className="muted">On supported pages, press Space three times to toggle. Triple-Space is ignored while typing.</p>
      <button type="button" onClick={auth ? signOut : signIn}>{auth ? "Sign out and return to local Pearls" : "Sign in for sync"}</button>
      <a href="https://representation-eta.vercel.app/settings" target="_blank" rel="noreferrer">Connections, phrases, and privacy</a>
    </section>
    <form className={`companion ${activeView === "command" ? "active" : ""}`} onSubmit={directCompanion}><i className={ghost ? "ghost active" : "ghost"} aria-hidden="true">●</i><input aria-label="Pearl command" value={companion} onChange={(event) => setCompanion(event.target.value)} placeholder="Tell Pearl your goal…" /><button type="button" aria-pressed={voiceListening} aria-label={voiceListening ? "Stop voice command" : "Start voice command"} onClick={toggleCompanionVoice}>{voiceListening ? "■" : "🎙"}</button><button>Run</button></form>
    {error && <aside className="recovery-alert" role="alert"><span>{error}</span>{retryAction && <button type="button" onClick={retryAction}>Retry</button>}<button type="button" aria-label="Dismiss error" onClick={() => { setError(""); setRetryAction(null); }}>Dismiss</button></aside>}
  </main>;
}

createRoot(document.getElementById("root")).render(<App />);

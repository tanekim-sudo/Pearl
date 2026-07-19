import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CompanionOrb from "./CompanionOrb.jsx";
import OrbCursorLayer from "./OrbCursorLayer.jsx";
import SemanticOrbLayer from "./SemanticOrbLayer.jsx";
import { createOrbState, executeOrbCommand, markUtteranceDispatched, recordOrbUtterance, transitionOrb } from "../../shared/orb-runtime.js";
import {
  ORB_CURSOR_EVENT,
  ORB_CURSOR_SEQUENCE_ATTRIBUTE,
  ORB_CURSOR_STORAGE_KEY,
  createTripleSpaceRecognizer,
  normalizeOrbCursorPreference,
} from "../../shared/orb-cursor.js";
import { checkTrustedExtensionInstallation, detectExtensionBrowser, trackExtensionFunnel, validChromeStoreUrl } from "../lib/extension-funnel.js";
import { createCompanionVoiceSession } from "../lib/companion-voice.js";
import {
  LEGACY_UNIFIED_WORKSPACE_KEYS,
  UNIFIED_WORKSPACE_KEY,
  createScene,
  migrateUnifiedWorkspace,
  serializeUnifiedWorkspace,
  updateSceneWorkspace,
} from "../lib/unified-workspace.js";

export const ORB_CONTINUE_KEY = "lens.orb-universe.continued.v1";
const SpeechRecognitionImpl =
  typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

export function parseOrbRoute(locationLike = globalThis.location) {
  const path = String(locationLike?.pathname || "/").replace(/\/+$/, "") || "/";
  const audit = new URLSearchParams(locationLike?.search || "");
  if ([...audit.keys()].some((key) => /(?:audit|tour|brush|cognitive|learn)/i.test(key))) {
    return { kind: "stage", path, sceneId: "release-audit", legacyAudit: true };
  }
  if (/^\/(?:stage|scene)(?:\/|$)/.test(path)) {
    const rawSceneId = path.split("/")[2] || "";
    let sceneId = rawSceneId;
    try { sceneId = decodeURIComponent(rawSceneId); } catch { /* retain the URL-safe identifier */ }
    return { kind: "stage", path, sceneId: sceneId || null };
  }
  if (path === "/install") return { kind: "install", path };
  if (path === "/" || path === "/library" || path === "/toolbox") return { kind: "home", path };
  if (/^\/(?:packages|settings|tasks)(?:\/|$)/.test(path)) return { kind: "library", section: path.split("/")[1], id: path.split("/")[2] || null, path };
  return { kind: "library", section: "library", path };
}

function navigate(path) {
  history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function waitForOrbRuntime(timeoutMs = 12_000) {
  if (window.__lensOrbRuntime?.run) return Promise.resolve(window.__lensOrbRuntime);
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener("lens:orb-runtime-ready", ready);
      reject(new Error("The Scene runtime did not become ready."));
    }, timeoutMs);
    function ready() {
      if (!window.__lensOrbRuntime?.run) return;
      window.clearTimeout(timeout);
      window.removeEventListener("lens:orb-runtime-ready", ready);
      resolve(window.__lensOrbRuntime);
    }
    window.addEventListener("lens:orb-runtime-ready", ready);
  });
}

function useRoute() {
  const [route, setRoute] = useState(() => parseOrbRoute());
  useEffect(() => {
    const update = () => setRoute(parseOrbRoute());
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  return route;
}

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function loadSceneWorkspace() {
  const unified = readJson(UNIFIED_WORKSPACE_KEY, null)
    || LEGACY_UNIFIED_WORKSPACE_KEYS.map((key) => readJson(key, null)).find(Boolean)
    || null;
  const items = readJson("lens.board.items.v1", []);
  const nodes = readJson("lens.ai.nodes.v1", []);
  const pages = readJson("lens.board.pages.v1", []);
  if (!unified && !items.length && !nodes.length && !pages.length) {
    return { version: 4, activeSceneId: null, scenes: [] };
  }
  return migrateUnifiedWorkspace({
    unified,
    items,
    nodes,
    pages,
    activePageId: pages[0]?.id || null,
    camera: readJson("lens.board.camera.v1", null),
  });
}

function InstallLanding({ install, onContinue }) {
  const browser = useMemo(() => detectExtensionBrowser(navigator.userAgent), []);
  const storeUrl = validChromeStoreUrl(import.meta.env.VITE_CHROME_WEB_STORE_URL);
  const release = typeof __LENS_EXTENSION_RELEASE__ === "undefined" ? null : __LENS_EXTENSION_RELEASE__;
  const installUrl = storeUrl || release?.versionedUrl || "/extension/lens-everywhere-chrome.zip";
  return <main className="orb-install">
    <section>
      <div className="orb-kicker">Lens Everywhere</div>
      <h1>Your cognition, available on every page.</h1>
      <p>Select material anywhere, tell the orb your goal, review candidates, and preserve the thinking you want to reuse.</p>
      <div className="orb-actions">
        {install.status === "installed"
          ? <button className="orb-primary" type="button" onClick={onContinue}>Open cognitive library</button>
          : <a className="orb-primary" href={installUrl} onClick={() => trackExtensionFunnel("install_cta", { surface: "orb-home", mode: storeUrl ? "store" : "download" })}>
              {browser.supported ? "Add Lens to Chrome" : "Get Lens for desktop Chrome"}
            </a>}
        <button className="orb-secondary" type="button" onClick={onContinue}>Continue to Lens</button>
      </div>
      <p className="orb-status" role="status">
        {install.status === "checking" ? "Checking trusted extension status…"
          : install.status === "installed" ? "Extension verified and ready."
            : "Installation status is unknown. You can check again after installing."}
      </p>
    </section>
    <div className="orb-install-card" aria-label="The Lens orb">
      <CompanionOrb key="install-orb" compact featured state={createOrbState()} />
    </div>
  </main>;
}

const libraryObjects = [
  ["Moves", "Single reusable actions and primitive operations.", "/library?kind=moves", "wide"],
  ["Functions", "Visible ordered and branched choreographies.", "/library?kind=functions"],
  ["Lenses", "Context atmospheres, Taste Lenses, and perceptual models.", "/library?kind=lenses"],
  ["Packages", "Signed cognition with trust, versions, tests, and provenance.", "/packages", "wide"],
  ["Saved Scenes", "Resume an explicit working set, camera, branches, and checkpoints.", "/tasks?view=scenes"],
  ["Tasks & history", "Review plans, diffs, checkpoints, recovery, and semantic rewind.", "/tasks"],
  ["Vocabulary", "Teach personal phrases without weakening privacy boundaries.", "/settings?vocabulary=1"],
  ["Models & connectors", "Control execution models, research policy, and handoffs.", "/settings?connectors=1"],
  ["Sync health", "Anonymous local work, account adoption, import, and export.", "/settings?sync=1"],
];

function ContextInspector({ items, onChange, onRemove }) {
  if (!items.length) return <p role="status">No working context yet. Drop material onto the orb to add it without changing the source.</p>;
  return <ul className="orb-context-inspector" aria-label="Working context priority">
    {items.map((item) => <li key={item.id}>
      <span><b>{item.label || item.text || "Context material"}</b><small>{item.kind || "material"}</small></span>
      <label>
        Priority
        <input
          type="range"
          min="0"
          max="1"
          step=".05"
          value={item.priority ?? 1}
          onChange={(event) => onChange(item.id, { priority: Number(event.target.value) })}
        />
      </label>
      <button type="button" aria-pressed={Boolean(item.pinned)} onClick={() => onChange(item.id, { pinned: !item.pinned })}>
        {item.pinned ? "Unpin" : "Pin"}
      </button>
      <button type="button" onClick={() => onRemove(item.id)}>Remove</button>
    </li>)}
  </ul>;
}

function LensAtmosphereInspector({ lenses, onChange, onRemove }) {
  if (!lenses.length) return <p role="status">No Lens atmosphere is active. Drag a Lens onto the orb to apply it.</p>;
  return <ul className="orb-context-inspector orb-lens-inspector" aria-label="Active Lens atmosphere">
    {lenses.map((lens) => <li key={lens.id}>
      <span><b>{lens.name || lens.label || "Untitled Lens"}</b><small>Lens atmosphere</small></span>
      <label>
        Strength
        <input type="range" min="0" max="1" step=".05" value={lens.strength ?? .7} onChange={(event) => onChange(lens.id, Number(event.target.value))} />
      </label>
      <button type="button" onClick={() => onRemove(lens.id)}>Remove</button>
    </li>)}
  </ul>;
}

function CandidateInspector({ candidates, onTaste }) {
  if (!candidates.length) return <p role="status">No active candidates. Ask the orb for alternatives to create a constellation.</p>;
  return <ul className="orb-context-inspector orb-candidate-inspector" aria-label="Candidate constellation">
    {candidates.map((candidate) => <li key={candidate.id}>
      <span><b>{candidate.title || "Candidate"}</b><small>{candidate.distinction || candidate.status || "Generated branch"}</small></span>
      <button type="button" onClick={() => onTaste(candidate, "yes")}>Yes</button>
      <button type="button" onClick={() => onTaste(candidate, "no")}>No</button>
      <button type="button" onClick={() => onTaste(candidate, "more")}>More like this</button>
    </li>)}
  </ul>;
}

function LibraryHome({ route, scenes, onCreateScene, activeView, onView, install, context, lenses, candidates, onContextChange, onContextRemove, onLensChange, onLensRemove, onCandidateTaste }) {
  const [query, setQuery] = useState("");
  const title = route.section && route.section !== "library"
    ? route.section[0].toUpperCase() + route.section.slice(1)
    : "Your cognitive universe";
  const visibleObjects = libraryObjects.filter(([name, description]) =>
    `${name} ${description}`.toLowerCase().includes(query.trim().toLowerCase())
  );
  return <main className="orb-library-home">
    <header className="orb-universe-head">
      <a href="/library" onClick={(event) => { event.preventDefault(); navigate("/library"); }}>LENS</a>
      <span>{install.status === "installed" ? "Extension connected" : install.status === "checking" ? "Checking extension" : "Local universe"} · {install.trusted ? "trusted handoff" : "private by default"}</span>
      <button type="button" onClick={() => onView(activeView === "library" ? null : "library")}>Library</button>
    </header>
    <section className="orb-home-intro">
      <div className="orb-kicker">Extension-first · Stage on demand</div>
      <h1>{title}</h1>
      <p>Speak a goal, bring material close, or resume a thought.</p>
    </section>
    <section className="orb-recent-orbit" aria-label="Recent scenes and tasks">
      {scenes.slice(0, 2).map((scene, index) => <button
        key={scene.id}
        className={`recent-scene scene-${String.fromCharCode(97 + (index % 3))}`}
        onClick={() => navigate(`/scene/${encodeURIComponent(scene.id)}`)}
      >
        <i />{scene.name || "Untitled Scene"}
        <small>{(scene.items?.length || 0) + (scene.nodes?.length || 0)} materials · {(scene.frames?.length || 0)} frames</small>
      </button>)}
      <button className="recent-scene scene-c" onClick={onCreateScene}><i />New Scene<small>Begin with an empty working set</small></button>
    </section>
    <p className="orb-home-prompt">Hold the orb to speak · click for command · drag material into its orbit</p>
    {activeView && <aside className="orb-emitted-library" aria-label={`${activeView} emitted by orb`}>
      <div>
        <span>{activeView === "library" ? "Cognitive library" : activeView}</span>
        <button type="button" aria-label="Close emitted view" onClick={() => onView(null)}>×</button>
      </div>
      {activeView === "context"
        ? <ContextInspector items={context} onChange={onContextChange} onRemove={onContextRemove} />
        : activeView === "lenses"
          ? <LensAtmosphereInspector lenses={lenses} onChange={onLensChange} onRemove={onLensRemove} />
        : activeView === "taste"
          ? <CandidateInspector candidates={candidates} onTaste={onCandidateTaste} />
        : <>
            <input
              aria-label="Search cognitive library"
              placeholder="Search Moves, Functions, Lenses, Scenes…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <nav>
              {visibleObjects.map(([name, description, href]) => <a key={name} href={href} onClick={(event) => {
                event.preventDefault();
                navigate(href);
              }}>
                <i /> <b>{name}</b><small>{description}</small>
              </a>)}
              {!visibleObjects.length && <span role="status">No library areas match “{query}”.</span>}
            </nav>
          </>}
    </aside>}
  </main>;
}

function SceneStage({ scene, onOpenFrame, onMaterialDrop, onContextAdd, semanticOrbActions }) {
  const [view, setView] = useState("Stage");
  useEffect(() => setView("Stage"), [scene?.id]);
  const materials = useMemo(() => [
    ...(scene?.items || []).map((item) => ({
      ...item,
      materialKind: item.type || "material",
      label: item.text || item.label || item.name || item.type || "Material",
    })),
    ...(scene?.nodes || []).map((node) => ({
      ...node,
      materialKind: node.nodeKind || "node",
      label: node.expandedText || node.preview || node.prompt || node.nodeKind || "AI node",
    })),
  ], [scene]);
  const chooseView = (next) => {
    if (next === "Frame") onOpenFrame();
    else setView(next);
  };
  return <main
    className="orb-black-stage"
    aria-label={`Scene ${scene?.name || scene?.id || "untitled"}`}
    data-stage-view={view.toLowerCase()}
    onDoubleClick={(event) => {
      if (event.target.closest?.("article,button,input,.semantic-orb-capsule")) return;
      semanticOrbActions?.create?.({
        placement: { x: event.clientX - innerWidth / 2, y: event.clientY - innerHeight / 2 },
      });
    }}
    onDragOver={(event) => {
      if (event.dataTransfer?.types?.includes("application/x-lens-object")) event.preventDefault();
    }}
    onDrop={(event) => {
      const portable = event.dataTransfer?.getData("application/x-lens-object");
      if (!portable) return;
      event.preventDefault();
      try {
        onMaterialDrop?.(JSON.parse(portable), { x: event.clientX - innerWidth / 2, y: event.clientY - innerHeight / 2 });
      } catch {
        /* only typed Lens material enters a Scene */
      }
    }}
  >
    <div className="orb-stage-context">
      <span>Scene</span>
      <b>{scene?.name || scene?.id || "Untitled Scene"}</b>
      <small>{materials.length} materials · {scene?.frames?.length || 0} Output Frames</small>
    </div>
    <nav className="orb-adaptive-views" aria-label="Adaptive Scene views">
      {["Stage", "Gallery", "Graph", "Table", "Timeline", "Frame"].map((option) => <button
        type="button"
        key={option}
        aria-pressed={option === view}
        onClick={() => chooseView(option)}
      >{option}</button>)}
    </nav>
    {!materials.length && !(scene?.semanticOrbs || []).filter((orb) => !orb.archived).length
      ? <section className="orb-stage-empty">
          <span className="orb-stage-locus" aria-hidden="true" />
          <h1>Bring material into this Scene.</h1>
          <p>Drag onto the orb, speak a goal, or open a saved working set. Nothing is created until you choose it.</p>
        </section>
      : view === "Table"
        ? <table className="orb-stage-table"><thead><tr><th>Material</th><th>Kind</th><th>Lineage</th></tr></thead><tbody>
            {materials.map((material) => <tr key={material.id}><td>{String(material.label).slice(0, 180)}</td><td>{material.materialKind}</td><td>{material.parentId || material.sourceId || "root"}</td></tr>)}
          </tbody></table>
        : <section className={`orb-stage-materials view-${view.toLowerCase()}`} aria-label={`${view} materials`}>
            {materials.map((material, index) => <article
              key={material.id}
              draggable="true"
              data-material-id={material.id}
              data-material-kind={material.materialKind}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "copyMove";
                event.dataTransfer.setData("text/plain", String(material.label));
                event.dataTransfer.setData("application/x-lens-object", JSON.stringify(material));
              }}
              style={view === "Stage" ? {
                "--material-x": `${50 + Math.max(-42, Math.min(42, (Number(material.x) || index * 80) / 20))}%`,
                "--material-y": `${48 + Math.max(-35, Math.min(35, (Number(material.y) || index * 60) / 24))}%`,
              } : undefined}
            >
              <small>{material.materialKind}</small>
              <p>{String(material.label).slice(0, 420)}</p>
              {view === "Timeline" && <time>{material.createdAt || material.updatedAt || `Step ${index + 1}`}</time>}
              <button type="button" className="orb-material-context-action" onClick={() => onContextAdd(material)}>Add to orb context</button>
              <button type="button" className="orb-material-context-action" onClick={() => semanticOrbActions?.create?.({
                material,
                placement: { x: Number(material.x) || index * 64, y: Number(material.y) || index * 48 },
              })}>Make orb</button>
            </article>)}
          </section>}
    <SemanticOrbLayer
      sceneId={scene?.id}
      orbs={(scene?.semanticOrbs || []).filter((orb) => !orb.archived)}
      activeId={scene?.activeSemanticOrbId || null}
      onCreate={semanticOrbActions?.create}
      onActivate={semanticOrbActions?.activate}
      onMove={semanticOrbActions?.move}
      onRename={semanticOrbActions?.rename}
      onArchive={semanticOrbActions?.archive}
      onAddContext={semanticOrbActions?.addContext}
      onApplyLens={semanticOrbActions?.applyLens}
      onNest={semanticOrbActions?.nest}
      onMerge={semanticOrbActions?.merge}
      onCompose={semanticOrbActions?.compose}
    />
  </main>;
}

export default function OrbUniverseShell({ StageComponent }) {
  const route = useRoute();
  const [sceneWorkspace, setSceneWorkspace] = useState(loadSceneWorkspace);
  const voiceSessionRef = useRef(null);
  const voiceGenerationRef = useRef(0);
  const orbRef = useRef(null);
  const contextCommandQueueRef = useRef(Promise.resolve());
  const activeRunAbortRef = useRef(null);
  const orbUndoRef = useRef(null);
  const approvalResolverRef = useRef(null);
  const [install, setInstall] = useState({ status: "checking", trusted: false });
  const [continued, setContinued] = useState(() => localStorage.getItem(ORB_CONTINUE_KEY) === "true");
  const [orb, setOrb] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("lens.orb.surface.v1") || "null");
      if (stored) return createOrbState(stored);
    } catch { /* use the fresh universe */ }
    return createOrbState({
      placement: {
        x: Math.max(28, (window.innerWidth - 150) / 2),
        y: Math.max(120, (window.innerHeight - 150) / 2),
        dock: "free",
        minimized: false,
        manual: false,
      },
    });
  });
  const [emittedView, setEmittedView] = useState(null);
  const [hasOrbUndo, setHasOrbUndo] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(null);
  const [cursorMode, setCursorModeState] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(ORB_CURSOR_STORAGE_KEY) || "null")?.enabled === true;
    } catch {
      return false;
    }
  });
  const [externalCursorMode, setExternalCursorMode] = useState(false);
  const [outputFrameOpen, setOutputFrameOpen] = useState(() => {
    const query = new URLSearchParams(location.search);
    return query.get("frame") === "legacy" || [...query.keys()].some((key) => /(?:audit|tour|brush|cognitive|learn)/i.test(key));
  });
  orbRef.current = orb;

  useEffect(() => {
    const workspace = loadSceneWorkspace();
    setSceneWorkspace(workspace);
    const sceneId = route.sceneId || workspace.activeSceneId;
    const scene = (workspace.scenes || []).find((entry) => entry.id === sceneId);
    if (scene) {
      const activeCapsule = scene.semanticOrbs?.find((entry) => entry.id === scene.activeSemanticOrbId && !entry.archived);
      const workingSet = activeCapsule?.workingSet || scene.workingSet || {};
      setOrb((value) => createOrbState({
        ...value,
        activeSemanticOrbId: activeCapsule?.id || null,
        context: workingSet.context || [],
        lenses: workingSet.lenses || [],
      }));
    }
  }, [route.path]);

  useEffect(() => {
    let active = true;
    checkTrustedExtensionInstallation().then((value) => {
      if (active) setInstall(value);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    localStorage.setItem("lens.orb.surface.v1", JSON.stringify(orb));
  }, [orb]);

  const setCursorMode = useCallback((enabled, source = "control") => {
    const preference = normalizeOrbCursorPreference({ enabled: enabled === true, source });
    localStorage.setItem(ORB_CURSOR_STORAGE_KEY, JSON.stringify(preference));
    document.documentElement.setAttribute("data-lens-orb-cursor-active", String(preference.enabled));
    setCursorModeState(preference.enabled);
    if (!preference.enabled) setExternalCursorMode(false);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-lens-orb-cursor-active", String(cursorMode));
    localStorage.setItem(ORB_CURSOR_STORAGE_KEY, JSON.stringify(normalizeOrbCursorPreference({
      enabled: cursorMode,
      source: "restore",
    })));
  }, [cursorMode]);

  useEffect(() => {
    function syncExtensionCursor() {
      const active = document.documentElement.getAttribute("data-lens-orb-cursor-active") === "true";
      const external = Boolean(document.getElementById("lens-orb-overlay-host")) && active;
      setExternalCursorMode(external);
      setCursorModeState(active);
      localStorage.setItem(ORB_CURSOR_STORAGE_KEY, JSON.stringify(normalizeOrbCursorPreference({
        enabled: active,
        source: external ? "triple-space" : "control",
      })));
    }
    function commandCursor(event) {
      setCursorMode(event.detail?.enabled !== false, event.detail?.source || "companion");
    }
    async function commandContext(event) {
      const detail = event.detail || {};
      try {
        if (detail.action === "remove") await removeOrbContext(detail.id);
        else if (detail.action === "update") await updateOrbContext(detail.id, detail.patch || {});
        else if (detail.action === "add") {
          for (const item of detail.items || []) await addOrbContext({ ...item, priority: detail.priority ?? item.priority, group: detail.group ?? item.group });
        }
        detail.resolve?.({ completed: true });
      } catch (error) {
        detail.reject?.(error);
      }
    }
    async function commandLens(event) {
      const detail = event.detail || {};
      try {
        if (detail.action === "remove") await removeOrbLens(detail.id);
        else if (detail.action === "update") await updateOrbLens(detail.id, detail.strength);
        else if (detail.action === "add") await addOrbLens({ ...detail.lens, strength: detail.strength ?? detail.lens?.strength });
        detail.resolve?.({ completed: true });
      } catch (error) {
        detail.reject?.(error);
      }
    }
    async function commandSemanticOrb(event) {
      const detail = event.detail || {};
      try {
        const execution = await applySemanticOrbCommand(detail.command, detail.args || {});
        detail.resolve?.({ completed: true, id: execution.result?.id || null, result: execution.result });
      } catch (error) {
        detail.reject?.(error);
      }
    }
    document.addEventListener(ORB_CURSOR_EVENT, syncExtensionCursor);
    document.addEventListener("lens:orb-cursor-command", commandCursor);
    document.addEventListener("lens:orb-context-command", commandContext);
    document.addEventListener("lens:orb-lens-command", commandLens);
    document.addEventListener("lens:semantic-orb-command", commandSemanticOrb);
    return () => {
      document.removeEventListener(ORB_CURSOR_EVENT, syncExtensionCursor);
      document.removeEventListener("lens:orb-cursor-command", commandCursor);
      document.removeEventListener("lens:orb-context-command", commandContext);
      document.removeEventListener("lens:orb-lens-command", commandLens);
      document.removeEventListener("lens:semantic-orb-command", commandSemanticOrb);
    };
  }, [route.path, setCursorMode]);

  useEffect(() => {
    const recognizer = createTripleSpaceRecognizer({ intervalMs: 650 });
    let sequenceTimer = 0;
    let sequenceScroll = null;
    function clearSequence() {
      recognizer.reset();
      sequenceScroll = null;
      window.clearTimeout(sequenceTimer);
      document.documentElement.removeAttribute(ORB_CURSOR_SEQUENCE_ATTRIBUTE);
    }
    function keyDown(event) {
      const result = recognizer.accept(event);
      if (!result.accepted) {
        clearSequence();
        return;
      }
      if (result.count === 1) sequenceScroll = { x: window.scrollX, y: window.scrollY };
      document.documentElement.setAttribute(ORB_CURSOR_SEQUENCE_ATTRIBUTE, "true");
      window.clearTimeout(sequenceTimer);
      sequenceTimer = window.setTimeout(clearSequence, 690);
      if (!result.matched) return;
      event.preventDefault();
      event.stopPropagation();
      if (sequenceScroll && (window.scrollX !== sequenceScroll.x || window.scrollY !== sequenceScroll.y)) {
        window.scrollTo(sequenceScroll.x, sequenceScroll.y);
      }
      clearSequence();
      setCursorMode(!cursorMode, "triple-space");
    }
    window.addEventListener("keydown", keyDown, true);
    return () => {
      window.removeEventListener("keydown", keyDown, true);
      clearSequence();
    };
  }, [cursorMode, setCursorMode]);

  useEffect(() => {
    if (orb.placement?.manual) return;
    setOrb((value) => ({
      ...value,
      placement: {
        ...value.placement,
        x: Math.max(28, (window.innerWidth - (route.kind === "stage" ? 120 : 160)) / 2),
        y: Math.max(120, (window.innerHeight - (route.kind === "stage" ? 120 : 160)) / 2),
      },
    }));
  }, [route.kind]);

  function continueToLibrary() {
    localStorage.setItem(ORB_CONTINUE_KEY, "true");
    setContinued(true);
    navigate("/library");
  }

  async function command(raw) {
    activeRunAbortRef.current?.abort();
    const recorded = recordOrbUtterance(orb, raw, {
      id: `web:${Date.now()}`,
      targetSnapshot: [{ route: route.path }],
    });
    const dispatched = markUtteranceDispatched(recorded.state, recorded.entry.id, `dispatch:${recorded.entry.id}`);
    let current = dispatched.phase === "idle"
      ? dispatched
      : createOrbState({
          ...dispatched,
          phase: "idle",
          taskId: recorded.entry.id,
          effectId: null,
          commandId: null,
        });
    let next = transitionOrb({ ...current, activeIntent: recorded.entry }, "interpreting", { taskId: recorded.entry.id });
    const cursorRequest = /\b(?:become|make|turn)\b.*\bcursor\b/i.test(recorded.entry.normalized)
      ? true
      : /\b(?:native|normal|regular)\s+cursor\b/i.test(recorded.entry.normalized)
        ? false
        : null;
    if (cursorRequest != null) {
      setCursorMode(cursorRequest, "companion");
      next = transitionOrb(next, "executing", { taskId: recorded.entry.id, commandId: "toggleOrbCursor" });
      setOrb(transitionOrb(next, "completed", {
        taskId: recorded.entry.id,
        commandId: "toggleOrbCursor",
        effectId: `orb-cursor:${cursorRequest ? "on" : "off"}`,
      }));
      return;
    }
    if (/\b(?:open|start|new)\b.*\bscene\b/i.test(recorded.entry.normalized)) {
      next = transitionOrb(next, "executing", { taskId: recorded.entry.id, commandId: "openScene" });
      setOrb(transitionOrb(next, "completed", { taskId: recorded.entry.id, commandId: "openScene", effectId: "route:scene" }));
      navigate(`/scene/${crypto.randomUUID()}`);
      return;
    }
    if (route.kind !== "stage") {
      setOrb(transitionOrb(next, "blocked", { taskId: recorded.entry.id, evidence: { boundary: "Open or create a Scene before mutating material." } }));
      return;
    }
    setOrb(next);
    setOutputFrameOpen(true);
    const controller = new AbortController();
    activeRunAbortRef.current = controller;
    try {
      const runtime = await waitForOrbRuntime();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const phaseMap = {
        planning: "planning",
        researching: "researching",
        executing: "executing",
        blocked: "blocked",
        evaluating: "executing",
      };
      const result = await runtime.run(recorded.entry.raw, {
        mode: "agent",
        signal: controller.signal,
        onPhase(phase) {
          const mapped = phaseMap[phase];
          if (!mapped) return;
          setOrb((value) => value.phase === mapped ? value : transitionOrb(value, mapped, { taskId: recorded.entry.id }));
        },
        onWorker(event) {
          setOrb((value) => {
            const byId = new Map((value.workers || []).map((worker) => [worker.id, worker]));
            byId.set(event.worker.id, { ...byId.get(event.worker.id), ...event.worker });
            return createOrbState({ ...value, workers: [...byId.values()].slice(-4) });
          });
        },
        onPlan(plan) {
          if (!plan) {
            setPendingApproval(null);
            approvalResolverRef.current = null;
            return null;
          }
          setOrb((value) => value.phase === "approval" ? value : transitionOrb(value, "approval", {
            taskId: recorded.entry.id,
            evidence: { title: plan.title, preview: true },
          }));
          setPendingApproval(plan);
          return new Promise((resolve) => {
            approvalResolverRef.current = resolve;
          });
        },
      });
      if (result?.visible) {
        setOrb((value) => value.phase === "blocked" ? value : transitionOrb(value, "blocked", {
          taskId: recorded.entry.id,
          evidence: { boundary: result.text },
        }));
        return;
      }
      setOrb((value) => {
        const withCandidates = result?.candidates?.length
          ? { ...value, candidates: result.candidates, checkpoints: result.checkpoints || value.checkpoints, fusion: result.workerFusion || value.fusion }
          : { ...value, checkpoints: result?.checkpoints || value.checkpoints, fusion: result?.workerFusion || value.fusion };
        const executing = withCandidates.phase === "executing"
          ? withCandidates
          : transitionOrb(withCandidates, "executing", { taskId: recorded.entry.id, commandId: "companion-plan" });
        return transitionOrb(executing, "completed", {
          taskId: recorded.entry.id,
          commandId: "companion-plan",
          effectId: `companion:${recorded.entry.id}`,
        });
      });
    } catch (error) {
      if (error.name === "AbortError" || controller.signal.aborted) {
        setOrb((value) => createOrbState({
          ...value,
          phase: "paused",
          effectId: null,
          trace: [...(value.trace || []), {
            id: `paused:${recorded.entry.id}`,
            from: value.phase,
            to: "paused",
            taskId: recorded.entry.id,
            at: new Date().toISOString(),
            evidence: { boundary: "Stopped by user" },
          }],
        }));
        return;
      }
      setOrb((value) => {
        if (value.phase === "blocked") return value;
        const recoverable = ["executing", "paused"].includes(value.phase)
          ? transitionOrb(value, "recovery", { taskId: recorded.entry.id, evidence: { error: error.message } })
          : value;
        return transitionOrb(recoverable, "blocked", { taskId: recorded.entry.id, evidence: { boundary: error.message } });
      });
    } finally {
      if (activeRunAbortRef.current === controller) activeRunAbortRef.current = null;
    }
  }

  function stopOrb() {
    approvalResolverRef.current?.({ decision: "reject" });
    approvalResolverRef.current = null;
    setPendingApproval(null);
    activeRunAbortRef.current?.abort();
    activeRunAbortRef.current = null;
    setOrb((value) => createOrbState({
      ...value,
      phase: "paused",
      effectId: null,
      trace: [...(value.trace || []), {
        id: `stop:${Date.now()}`,
        from: value.phase,
        to: "paused",
        taskId: value.taskId,
        at: new Date().toISOString(),
        evidence: { boundary: "Stopped by user" },
      }],
    }));
  }

  function decideApproval(decision) {
    const resolve = approvalResolverRef.current;
    approvalResolverRef.current = null;
    setPendingApproval(null);
    resolve?.({ decision });
  }

  async function undoOrbEffect() {
    if (orbUndoRef.current) {
      const record = orbUndoRef.current;
      const prior = record.orb || record;
      record.restore?.();
      const at = new Date().toISOString();
      const restored = createOrbState({
        ...prior,
        phase: "completed",
        commandId: "undo",
        effectId: `undo:orb-context:${at}`,
        trace: [...(prior.trace || []), {
          id: `undo:orb-context:${at}`,
          from: orbRef.current?.phase || "completed",
          to: "completed",
          commandId: "undo",
          at,
          evidence: { observed: ["orb-context-changed"] },
        }],
      });
      orbUndoRef.current = null;
      setHasOrbUndo(false);
      orbRef.current = restored;
      setOrb(restored);
      return;
    }
    try {
      const runtime = await waitForOrbRuntime();
      setOrb((value) => createOrbState({ ...value, phase: "recovery", effectId: null }));
      const receipt = runtime.undo();
      setOrb((value) => transitionOrb(value, "completed", {
        taskId: value.taskId || `undo:${Date.now()}`,
        commandId: "undo",
        effectId: `undo:${Date.now()}`,
        evidence: receipt,
      }));
    } catch (error) {
      setOrb((value) => createOrbState({
        ...value,
        phase: "blocked",
        effectId: null,
        trace: [...(value.trace || []), { id: `undo-error:${Date.now()}`, from: value.phase, to: "blocked", evidence: { boundary: error.message } }],
      }));
    }
  }

  function finishVoice({ send = true } = {}) {
    const session = voiceSessionRef.current;
    if (!session) return false;
    voiceSessionRef.current = null;
    return session.finish({ send, reason: send ? "explicit" : "cancelled" });
  }

  function beginVoice() {
    if (activeRunAbortRef.current) stopOrb();
    finishVoice({ send: false });
    if (!SpeechRecognitionImpl) {
      setOrb((value) => createOrbState({
        ...value,
        phase: "blocked",
        trace: [...(value.trace || []), {
          id: `voice-unavailable:${Date.now()}`,
          from: value.phase,
          to: "blocked",
          at: new Date().toISOString(),
          evidence: { boundary: "Voice input is unavailable in this browser. Type the goal in the orb." },
        }],
      }));
      return;
    }
    setOrb((value) => {
      const ready = ["idle", "completed"].includes(value.phase) ? value : createOrbState({ ...value, phase: "idle", effectId: null, commandId: null });
      return transitionOrb(ready, "listening", { taskId: `voice:${Date.now()}` });
    });
    const generation = ++voiceGenerationRef.current;
    let restarts = 0;
    const session = createCompanionVoiceSession({
      generation,
      dispatch: (text) => {
        if (voiceSessionRef.current === session) voiceSessionRef.current = null;
        command(text);
      },
      captureSnapshot: () => [{ route: location.pathname, sceneId: route.sceneId || null }],
    });
    const attach = () => {
      if (!session.isActive() || generation !== voiceGenerationRef.current) return;
      const recognition = new SpeechRecognitionImpl();
      recognition.lang = navigator.language || "en-US";
      recognition.interimResults = true;
      recognition.continuous = true;
      recognition.onresult = (event) => session.ingest(event, generation);
      recognition.onerror = (event) => {
        if (event?.error === "not-allowed" || event?.error === "service-not-allowed") {
          finishVoice({ send: false });
          setOrb((value) => createOrbState({
            ...value,
            phase: "blocked",
            trace: [...(value.trace || []), {
              id: `voice-denied:${Date.now()}`,
              from: value.phase,
              to: "blocked",
              at: new Date().toISOString(),
              evidence: { boundary: "Microphone permission was not granted. Type the goal in the orb." },
            }],
          }));
        }
      };
      recognition.onend = () => {
        if (!session.isActive() || generation !== voiceGenerationRef.current) return;
        restarts += 1;
        if (restarts > 40) {
          finishVoice({ send: true });
          return;
        }
        try {
          attach();
        } catch {
          finishVoice({ send: true });
        }
      };
      session.registerRecognizer(recognition);
      recognition.start();
    };
    voiceSessionRef.current = session;
    try {
      attach();
    } catch {
      finishVoice({ send: false });
      setOrb((value) => createOrbState({ ...value, phase: "blocked" }));
    }
  }

  function endVoice() {
    if (voiceSessionRef.current) {
      finishVoice({ send: true });
      return;
    }
    setOrb((value) => value.phase === "listening"
      ? createOrbState({ ...value, phase: "idle", taskId: value.taskId })
      : value);
  }

  useEffect(() => () => {
    approvalResolverRef.current?.({ decision: "reject" });
    approvalResolverRef.current = null;
    activeRunAbortRef.current?.abort();
    voiceGenerationRef.current += 1;
    finishVoice({ send: false });
  }, []);

  function persistWorkspace(workspace) {
    const previousStorage = localStorage.getItem(UNIFIED_WORKSPACE_KEY);
    const serialized = serializeUnifiedWorkspace(workspace);
    localStorage.setItem(UNIFIED_WORKSPACE_KEY, serialized);
    setSceneWorkspace(JSON.parse(serialized));
    return () => {
      if (previousStorage == null) localStorage.removeItem(UNIFIED_WORKSPACE_KEY);
      else localStorage.setItem(UNIFIED_WORKSPACE_KEY, previousStorage);
      const restored = loadSceneWorkspace();
      setSceneWorkspace(restored);
      const restoredScene = restored.scenes?.find((entry) => entry.id === (route.sceneId || restored.activeSceneId));
      const restoredWorkingSet = restoredScene?.activeSemanticOrbId
        ? restoredScene.semanticOrbs?.find((entry) => entry.id === restoredScene.activeSemanticOrbId)?.workingSet
        : restoredScene?.workingSet;
      if (restoredWorkingSet) setOrb((value) => createOrbState({
        ...value,
        activeSemanticOrbId: restoredScene?.activeSemanticOrbId || null,
        context: restoredWorkingSet.context || [],
        lenses: restoredWorkingSet.lenses || [],
      }));
    };
  }

  function persistActiveWorkingSet(patch) {
    const workspace = loadSceneWorkspace();
    const sceneId = route.sceneId || workspace.activeSceneId;
    const scene = (workspace.scenes || []).find((entry) => entry.id === sceneId);
    if (!scene) return null;
    const updated = updateSceneWorkspace(workspace, sceneId, (current) => {
      if (!current.activeSemanticOrbId) {
        return { ...current, workingSet: { ...(current.workingSet || {}), ...patch } };
      }
      return {
        ...current,
        semanticOrbs: current.semanticOrbs.map((semanticOrb) => semanticOrb.id === current.activeSemanticOrbId
          ? { ...semanticOrb, workingSet: { ...(semanticOrb.workingSet || {}), ...patch }, updatedAt: new Date().toISOString() }
          : semanticOrb),
      };
    });
    return persistWorkspace(updated);
  }

  async function applySemanticOrbCommand(name, args) {
    const currentOrb = orbRef.current;
    const ready = ["idle", "completed"].includes(currentOrb.phase)
      ? currentOrb
      : createOrbState({ ...currentOrb, phase: "idle", effectId: null, commandId: null });
    const workspace = loadSceneWorkspace();
    const sceneId = route.sceneId || workspace.activeSceneId;
    const scene = workspace.scenes?.find((entry) => entry.id === sceneId);
    if (!scene) throw new Error("Open a Scene before creating an orb");
    const execution = await executeOrbCommand({
      orb: ready,
      command: name,
      state: {
        semanticOrbs: scene.semanticOrbs || [],
        activeSemanticOrbId: scene.activeSemanticOrbId || null,
      },
      args,
      taskId: `semantic-orb:${name}:${Date.now()}`,
      observe: async ({ result }) => ({ effects: result.effects }),
    });
    const updated = updateSceneWorkspace(workspace, sceneId, (current) => ({
      ...current,
      semanticOrbs: execution.state.semanticOrbs,
      activeSemanticOrbId: execution.state.activeSemanticOrbId,
    }));
    const restore = persistWorkspace(updated);
    const nextScene = updated.scenes.find((entry) => entry.id === sceneId);
    const activeCapsule = nextScene.semanticOrbs.find((entry) => entry.id === nextScene.activeSemanticOrbId);
    const workingSet = activeCapsule?.workingSet || nextScene.workingSet || {};
    const nextOrb = createOrbState({
      ...execution.orb,
      activeSemanticOrbId: nextScene.activeSemanticOrbId || null,
      context: workingSet.context || [],
      lenses: workingSet.lenses || [],
    });
    orbUndoRef.current = { orb: currentOrb, restore };
    setHasOrbUndo(true);
    orbRef.current = nextOrb;
    setOrb(nextOrb);
    return execution;
  }

  const semanticOrbActions = {
    create: ({ placement = { x: 0, y: 0 }, material = null, name = null } = {}) => applySemanticOrbCommand("createSemanticOrb", {
      sceneId: route.sceneId,
      placement,
      activate: true,
      ...(material ? { material } : { orb: { name: name || "Untitled orb" } }),
    }),
    activate: (id) => applySemanticOrbCommand("activateSemanticOrb", { id }),
    move: (id, placement) => applySemanticOrbCommand("moveSemanticOrb", { id, placement }),
    rename: (id, name) => applySemanticOrbCommand("renameSemanticOrb", { id, name }),
    archive: (id, archived = true) => applySemanticOrbCommand("archiveSemanticOrb", { id, archived }),
    addContext: (id, item) => applySemanticOrbCommand("addSemanticOrbContext", { id, items: [item] }),
    applyLens: (id, lens) => applySemanticOrbCommand("applySemanticOrbLens", { id, lens, strength: lens.strength }),
    nest: (childId, parentId) => applySemanticOrbCommand("nestSemanticOrb", { childId, parentId }),
    merge: (ids) => applySemanticOrbCommand("mergeSemanticOrbs", { ids, sceneId: route.sceneId }),
    compose: (ids) => applySemanticOrbCommand("composeSemanticOrbs", { ids, sceneId: route.sceneId }),
  };

  function applyOrbContextCommand(name, args) {
    const operation = contextCommandQueueRef.current.then(async () => {
      const current = orbRef.current;
      const ready = ["idle", "completed"].includes(current.phase)
        ? current
        : createOrbState({ ...current, phase: "idle", effectId: null, commandId: null });
      const execution = await executeOrbCommand({
        orb: ready,
        command: name,
        state: { orbContext: current.context || [] },
        args,
        taskId: `context:${Date.now()}`,
        observe: async ({ result }) => ({ effects: result.effects }),
      });
      const next = {
        ...execution.orb,
        context: execution.state.orbContext.slice(-12),
      };
      const restore = persistActiveWorkingSet({ context: next.context });
      orbUndoRef.current = { orb: current, restore };
      setHasOrbUndo(true);
      orbRef.current = next;
      setOrb(next);
      return execution;
    });
    contextCommandQueueRef.current = operation.catch(() => {});
    return operation.catch((error) => {
      setOrb((value) => createOrbState({
        ...value,
        phase: "blocked",
        trace: [...(value.trace || []), {
          id: `context-error:${Date.now()}`,
          from: value.phase,
          to: "blocked",
          at: new Date().toISOString(),
          evidence: { boundary: error.message },
        }],
      }));
      throw error;
    });
  }

  function addOrbContext(item) {
    return applyOrbContextCommand("addOrbContext", {
      items: [item],
      priority: item.priority ?? 1,
      group: item.group || null,
    });
  }

  function updateOrbContext(id, patch) {
    return applyOrbContextCommand("updateOrbContext", { id, ...patch });
  }

  function removeOrbContext(id) {
    return applyOrbContextCommand("removeOrbContext", { id });
  }

  function applyOrbLensCommand(name, args) {
    const operation = contextCommandQueueRef.current.then(async () => {
      const current = orbRef.current;
      const ready = ["idle", "completed"].includes(current.phase)
        ? current
        : createOrbState({ ...current, phase: "idle", effectId: null, commandId: null });
      const execution = await executeOrbCommand({
        orb: ready,
        command: name,
        state: { orbLenses: current.lenses || [] },
        args,
        taskId: `lens:${Date.now()}`,
        observe: async ({ result }) => ({ effects: result.effects }),
      });
      const next = { ...execution.orb, lenses: execution.state.orbLenses.slice(-8) };
      const restore = persistActiveWorkingSet({ lenses: next.lenses });
      orbUndoRef.current = { orb: current, restore };
      setHasOrbUndo(true);
      orbRef.current = next;
      setOrb(next);
      return execution;
    });
    contextCommandQueueRef.current = operation.catch(() => {});
    return operation.catch((error) => {
      setOrb((value) => createOrbState({
        ...value,
        phase: "blocked",
        trace: [...(value.trace || []), {
          id: `lens-error:${Date.now()}`,
          from: value.phase,
          to: "blocked",
          at: new Date().toISOString(),
          evidence: { boundary: error.message },
        }],
      }));
      throw error;
    });
  }

  function addOrbLens(lens) {
    return applyOrbLensCommand("addOrbLens", { lens, strength: lens.strength });
  }

  function updateOrbLens(id, strength) {
    return applyOrbLensCommand("updateOrbLens", { id, strength });
  }

  function removeOrbLens(id) {
    return applyOrbLensCommand("removeOrbLens", { id });
  }

  async function materializeOnStage(item, worldPoint) {
    const current = orbRef.current;
    const ready = ["idle", "completed"].includes(current.phase)
      ? current
      : createOrbState({ ...current, phase: "idle", effectId: null, commandId: null });
    const workspace = loadSceneWorkspace();
    const scene = (workspace.scenes || []).find((entry) => entry.id === route.sceneId)
      || createScene({ id: route.sceneId || `scene-${Date.now()}` });
    const sourceId = item.id || null;
    const copy = {
      ...item,
      id: `material:${globalThis.crypto?.randomUUID?.() || Date.now()}`,
      provenance: {
        ...(item.provenance || {}),
        sourceId,
        copiedFrom: item.sceneId || "orb-context",
      },
    };
    const execution = await executeOrbCommand({
      orb: ready,
      command: "materializeOnStage",
      state: { sceneItems: scene.items || [] },
      args: { items: [copy], sceneId: scene.id, worldPoint },
      taskId: `materialize:${copy.id}`,
      observe: async ({ result }) => ({ effects: result.effects, ids: result.objects?.map((entry) => entry.id) }),
    });
    const nextScene = createScene({ ...scene, items: execution.state.sceneItems });
    const scenes = (workspace.scenes || []).some((entry) => entry.id === scene.id)
      ? workspace.scenes.map((entry) => entry.id === scene.id ? nextScene : entry)
      : [...(workspace.scenes || []), nextScene];
    const previousStorage = localStorage.getItem(UNIFIED_WORKSPACE_KEY);
    const serialized = serializeUnifiedWorkspace({
      ...workspace,
      scenes,
      activeSceneId: nextScene.id,
      items: nextScene.items,
      nodes: nextScene.nodes,
      camera: nextScene.camera,
      frames: nextScene.frames,
      orbInstances: nextScene.orbInstances,
      workingSet: nextScene.workingSet,
    });
    localStorage.setItem(UNIFIED_WORKSPACE_KEY, serialized);
    setSceneWorkspace(JSON.parse(serialized));
    orbUndoRef.current = {
      orb: current,
      restore() {
        if (previousStorage == null) localStorage.removeItem(UNIFIED_WORKSPACE_KEY);
        else localStorage.setItem(UNIFIED_WORKSPACE_KEY, previousStorage);
        setSceneWorkspace(loadSceneWorkspace());
      },
    };
    setHasOrbUndo(true);
    orbRef.current = execution.orb;
    setOrb(execution.orb);
  }

  async function tasteCandidate(candidate, decision) {
    try {
      const runtime = await waitForOrbRuntime();
      setOrb((value) => createOrbState({ ...value, phase: "executing", taskId: `taste:${candidate.id}` }));
      const action = decision === "more"
        ? { verb: "moreLikeThis", args: { count: 3 } }
        : { verb: "tasteCandidate", args: { decision: decision === "yes" ? "yes" : "no" } };
      const result = await runtime.execute([
        { verb: "selectAiNode", args: { target: candidate.id } },
        action,
      ], { title: `${decision} candidate` });
      if (!result.completed) throw new Error(result.errors?.[0] || "Candidate feedback could not be applied");
      const candidates = runtime.candidates?.() || (orbRef.current.candidates || []).map((entry) =>
        entry.id === candidate.id && decision !== "more" ? { ...entry, status: decision } : entry
      );
      setOrb((value) => transitionOrb({ ...value, candidates }, "completed", {
        taskId: `taste:${candidate.id}`,
        commandId: action.verb,
        effectId: `taste:${candidate.id}:${decision}`,
        evidence: { observed: result.effects || ["candidate-feedback-changed"] },
      }));
    } catch (error) {
      setOrb((value) => createOrbState({
        ...value,
        phase: "blocked",
        trace: [...(value.trace || []), {
          id: `taste-error:${Date.now()}`,
          from: value.phase,
          to: "blocked",
          at: new Date().toISOString(),
          evidence: { boundary: error.message },
        }],
      }));
    }
  }

  async function cancelWorker(workerId) {
    try {
      const runtime = await waitForOrbRuntime();
      const receipt = runtime.cancelWorker?.(workerId);
      if (!receipt?.cancelled) throw new Error("Worker is no longer running");
      setOrb((value) => createOrbState({
        ...value,
        workers: (value.workers || []).map((worker) =>
          worker.id === workerId ? { ...worker, status: "cancelled", blocker: "cancelled by user" } : worker
        ),
      }));
    } catch (error) {
      setOrb((value) => createOrbState({
        ...value,
        trace: [...(value.trace || []), {
          id: `worker-cancel:${Date.now()}`,
          from: value.phase,
          to: value.phase,
          at: new Date().toISOString(),
          evidence: { boundary: error.message },
        }],
      }));
    }
  }

  function createBlankScene() {
    const id = `scene-${globalThis.crypto?.randomUUID?.() || Date.now()}`;
    const scene = createScene({ id, name: "Untitled Scene", metadata: { createdFrom: "new-scene-control" } });
    const scenes = [...(sceneWorkspace.scenes || []), scene];
    const serialized = serializeUnifiedWorkspace({
      scenes,
      activeSceneId: scene.id,
      items: scene.items,
      nodes: scene.nodes,
      camera: scene.camera,
      frames: scene.frames,
      orbInstances: scene.orbInstances,
      workingSet: scene.workingSet,
    });
    localStorage.setItem(UNIFIED_WORKSPACE_KEY, serialized);
    setSceneWorkspace(JSON.parse(serialized));
    navigate(`/scene/${encodeURIComponent(id)}`);
  }

  const routedScene = (sceneWorkspace.scenes || []).find((scene) => scene.id === route.sceneId)
    || createScene({ id: route.sceneId || "untitled", name: route.sceneId || "Untitled Scene" });

  if (route.kind === "stage") {
    return <div className="orb-stage-shell" data-semantic-anchor="scene-stage">
      <div className="orb-stage-bar">
        <a href="/library" onClick={(event) => { event.preventDefault(); navigate("/library"); }}>← Library</a>
        <button type="button" onClick={() => setOutputFrameOpen((value) => !value)}>{outputFrameOpen ? "Close Output Frame" : "Open Output Frame"}</button>
      </div>
      <div className="orb-output-frame-host" data-semantic-anchor="output-frame" hidden={!outputFrameOpen}><StageComponent key={route.sceneId || "untitled"} sceneId={route.sceneId} /></div>
      {!outputFrameOpen && <SceneStage
        scene={routedScene}
        onOpenFrame={() => setOutputFrameOpen(true)}
        onMaterialDrop={materializeOnStage}
        onContextAdd={addOrbContext}
        semanticOrbActions={semanticOrbActions}
      />}
      {!cursorMode && <CompanionOrb key="stage-orb" featured state={orb} onStateChange={setOrb} onCommand={command} onStop={stopOrb} onUndo={undoOrbEffect}
        onVoiceStart={beginVoice} onVoiceEnd={endVoice} onContextAdd={addOrbContext} onLensAdd={addOrbLens} onEmitView={setEmittedView}
        onOrbCreate={() => semanticOrbActions.create({ placement: { x: 0, y: 0 } })}
        cursorMode={cursorMode} onCursorToggle={(enabled) => setCursorMode(enabled, "control")}
        approval={pendingApproval} onApproval={decideApproval} onWorkerCancel={cancelWorker} />}
      {cursorMode && !externalCursorMode && <OrbCursorLayer state={orb} onDisable={() => setCursorMode(false, "control")} />}
      <span className="sr-only" role="status" aria-live="polite">{cursorMode ? "Orb cursor on" : "Orb cursor off"}</span>
      {emittedView && <aside className="orb-stage-emission" aria-label={`${emittedView} view emitted by orb`}>
        <button type="button" onClick={() => setEmittedView(null)}>Close</button>
        <b>{emittedView === "context" ? "Working context" : "Cognitive library"}</b>
        {emittedView === "context"
          ? <ContextInspector items={orb.context || []} onChange={updateOrbContext} onRemove={removeOrbContext} />
          : emittedView === "lenses"
            ? <LensAtmosphereInspector lenses={orb.lenses || []} onChange={updateOrbLens} onRemove={removeOrbLens} />
            : emittedView === "taste"
              ? <CandidateInspector candidates={orb.candidates || []} onTaste={tasteCandidate} />
            : libraryObjects.slice(0, 5).map(([name]) => <span key={name}>{name}</span>)}
      </aside>}
    </div>;
  }

  const showInstall = route.kind === "install" || (route.kind === "home" && !continued && install.status !== "installed");
  return <div className="orb-universe">
    {showInstall
      ? <InstallLanding install={install} onContinue={continueToLibrary} />
      : <LibraryHome
          route={route}
          scenes={sceneWorkspace.scenes || []}
          onCreateScene={createBlankScene}
          activeView={emittedView}
          onView={setEmittedView}
          install={install}
          context={orb.context || []}
          lenses={orb.lenses || []}
          candidates={orb.candidates || []}
          onContextChange={updateOrbContext}
          onContextRemove={removeOrbContext}
          onLensChange={updateOrbLens}
          onLensRemove={removeOrbLens}
          onCandidateTaste={tasteCandidate}
        />}
    {!showInstall && !cursorMode && <CompanionOrb key="home-orb" featured state={orb} onStateChange={setOrb} onCommand={command} onStop={stopOrb} onUndo={hasOrbUndo ? undoOrbEffect : undefined}
      onVoiceStart={beginVoice} onVoiceEnd={endVoice} onContextAdd={addOrbContext} onLensAdd={addOrbLens} onEmitView={setEmittedView}
      cursorMode={cursorMode} onCursorToggle={(enabled) => setCursorMode(enabled, "control")}
      approval={pendingApproval} onApproval={decideApproval} onWorkerCancel={cancelWorker} />}
    {!showInstall && cursorMode && !externalCursorMode && <OrbCursorLayer state={orb} onDisable={() => setCursorMode(false, "control")} />}
    {!showInstall && <span className="sr-only" role="status" aria-live="polite">{cursorMode ? "Orb cursor on" : "Orb cursor off"}</span>}
  </div>;
}

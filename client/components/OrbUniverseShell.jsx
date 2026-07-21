import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CompanionOrb from "./CompanionOrb.jsx";
import PhysicalPearl from "./PhysicalPearl.jsx";
import OrbCursorLayer from "./OrbCursorLayer.jsx";
import SemanticOrbLayer from "./SemanticOrbLayer.jsx";
import { createWebPearlStudioReference } from "./PearlStudioView.jsx";
import { createPearlEntity } from "../../shared/pearl-entity.js";
import { PEARL_STORE_KEY } from "../../shared/pearl-store.js";
import { createOrbState, executeOrbCommand, markUtteranceDispatched, recordOrbUtterance, transitionOrb } from "../../shared/orb-runtime.js";
import { normalizeSemanticOrbs } from "../../shared/semantic-orbs.js";
import {
  ORB_CURSOR_EVENT,
  ORB_CURSOR_SEQUENCE_ATTRIBUTE,
  ORB_CURSOR_STORAGE_KEY,
  createTripleSpaceRecognizer,
  normalizeOrbCursorPreference,
} from "../../shared/orb-cursor.js";
import {
  checkTrustedExtensionInstallation,
  detectExtensionBrowser,
  requestTrustedExtensionHandoff,
  requestTrustedResultHandoff,
  trackExtensionFunnel,
  validChromeStoreUrl,
} from "../lib/extension-funnel.js";
import {
  continuationItems,
  continuationMaterial,
  continuationMaterialCount,
} from "../lib/extension-continuation.js";
import { createCompanionVoiceSession } from "../lib/companion-voice.js";
import { boardSyncEnabled, setBoardSyncEnabled } from "../lib/board-sync.js";
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
let initialHandoffFragment = null;
if (typeof location !== "undefined" && location.hash) {
  const candidate = new URLSearchParams(location.hash.replace(/^#/, ""));
  if (candidate.get("token")) {
    initialHandoffFragment = candidate;
    history.replaceState(history.state, "", `${location.pathname}${location.search}`);
  }
}

export function parseOrbRoute(locationLike = globalThis.location) {
  const path = String(locationLike?.pathname || "/").replace(/\/+$/, "") || "/";
  const query = new URLSearchParams(locationLike?.search || "");
  const fragment = String(locationLike?.hash || "")
    ? new URLSearchParams(String(locationLike.hash).replace(/^#/, ""))
    : locationLike === globalThis.location && initialHandoffFragment
      ? initialHandoffFragment
      : new URLSearchParams();
  if ([...query.keys()].some((key) => /(?:audit|tour|brush|learn)/i.test(key))) {
    return { kind: "stage", path, sceneId: "release-audit", legacyAudit: true };
  }
  if (/^\/(?:stage|scene)(?:\/|$)/.test(path)) {
    const rawSceneId = path.split("/")[2] || "";
    let sceneId = rawSceneId;
    try { sceneId = decodeURIComponent(rawSceneId); } catch { /* retain the URL-safe identifier */ }
    return { kind: "stage", path, sceneId: sceneId || null };
  }
  if (path === "/install") return { kind: "install", path };
  if (path === "/" || path === "/library" || path === "/toolbox") {
    const handoff = fragment.get("handoff") || query.get("handoff");
    const legacyCognitive = query.get("cognitive");
    return {
      kind: "home",
      path,
      handoff: handoff || legacyCognitive || null,
      handoffSource: handoff ? "handoff" : legacyCognitive ? "legacy-cognitive" : null,
      handoffView: fragment.get("view") || query.get("view") || null,
      handoffToken: fragment.get("token") || null,
    };
  }
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
  const captureRoute = useCallback(() => parseOrbRoute(), []);
  const [route, setRoute] = useState(captureRoute);
  useEffect(() => {
    initialHandoffFragment = null;
    const update = () => setRoute(captureRoute());
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, [captureRoute]);
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

function InstallLanding({ install, onContinue, onRetry }) {
  const browser = useMemo(() => detectExtensionBrowser(navigator.userAgent), []);
  const storeUrl = validChromeStoreUrl(import.meta.env.VITE_CHROME_WEB_STORE_URL);
  const release = typeof __LENS_EXTENSION_RELEASE__ === "undefined" ? null : __LENS_EXTENSION_RELEASE__;
  const installUrl = storeUrl || release?.versionedUrl || "/extension/lens-everywhere-chrome.zip";
  return <main className="orb-install">
    <section>
      <div className="orb-kicker">Pearl</div>
      <h1>Add Pearl to Chrome</h1>
      <p>Use the same companion on any page.</p>
      <div className="orb-actions">
        {install.status === "installed"
          ? <button className="orb-primary" type="button" onClick={onContinue}>Open cognitive library</button>
          : <a className="orb-primary" href={installUrl} onClick={() => trackExtensionFunnel("install_cta", { surface: "orb-home", mode: storeUrl ? "store" : "download" })}>
              {browser.supported ? "Add Pearl to Chrome" : "Get Pearl for desktop Chrome"}
            </a>}
        {install.status === "unknown" && <button className="orb-secondary" type="button" onClick={onRetry}>Check extension again</button>}
      </div>
      <p className="orb-status" role="status">
        {install.status === "checking" ? "Checking trusted extension status…"
          : install.status === "installed" ? "Extension verified and ready."
            : "Installation status is unknown. You can check again after installing."}
      </p>
    </section>
  </main>;
}

const libraryObjects = [
  ["Actions", "Things Pearl can repeat.", "/library?kind=moves", "wide"],
  ["Processes", "Ways Pearl can carry work through several steps.", "/library?kind=functions"],
  ["Context", "Material that shapes how Pearl responds.", "/library?kind=lenses"],
  ["Shared tools", "Trusted reusable work from you or your team.", "/packages", "wide"],
  ["Saved spaces", "Return to material you were working with.", "/tasks?view=scenes"],
  ["Activity", "Review, recover, or continue earlier work.", "/tasks"],
  ["Phrases", "Teach Pearl language you use.", "/settings?vocabulary=1"],
  ["Connections", "Choose where Pearl can work.", "/settings?connectors=1"],
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

const PEARL_NATIVE_ACTIONS = Object.freeze([
  { group: "Make", label: "Sticky note", note: "Place an editable note", verb: "addBlock", args: { type: "sticky" } },
  { group: "Make", label: "Observation", note: "Add a structured observation", verb: "addBlock", args: { type: "callout", variant: "observation", text: "Your observation…" } },
  { group: "Make", label: "Question", note: "Add a structured question", verb: "addBlock", args: { type: "callout", variant: "question", text: "Your question?" } },
  { group: "Make", label: "Diagram", note: "Place a diagram block", verb: "addBlock", args: { type: "diagram" } },
  { group: "Select", label: "Select + type", note: "Move, select, or create text", verb: "switchTool", args: { tool: "select" } },
  { group: "Select", label: "Highlighter", note: "Build a persistent cross-domain selection", verb: "switchTool", args: { tool: "highlighter" } },
  { group: "Select", label: "Make one node", note: "Combine highlighted material without running it", verb: "makeHighlightNode", args: {} },
  { group: "Select", label: "Save selection as…", note: "Choose Move, Function, or Lens", verb: "openSaveAsChooser", args: {} },
  { group: "Learn", label: "Before → after", note: "Infer an editable transformation", verb: "openBeforeAfterCreation", args: {} },
  { group: "Learn", label: "Learn from chat", note: "Extract reusable cognition from a transcript", verb: "openTranscriptLearning", args: {} },
  { group: "Learn", label: "Capture lineage", note: "Save the contributing path as a Function", verb: "captureThreadAsFunction", args: {} },
  { group: "Learn", label: "Save page as Lens", note: "Preserve the page as bounded context", verb: "savePageAsLens", args: {} },
  { group: "Arrange", label: "Organize", note: "Arrange current material coherently", verb: "organizePage", args: {} },
  { group: "Arrange", label: "Fit frame", note: "Fit the full paper frame", verb: "fitPaper", args: {} },
  { group: "Arrange", label: "Zoom in", note: "Move closer without losing context", verb: "zoomPaper", args: { direction: "in" } },
  { group: "Arrange", label: "Zoom out", note: "Reveal more of the workspace", verb: "zoomPaper", args: { direction: "out" } },
  { group: "Preserve", label: "Export markdown", note: "Download selected or visible material", verb: "exportWorkspace", args: { format: "md" } },
  { group: "Preserve", label: "Export text", note: "Download a plain-text copy", verb: "exportWorkspace", args: { format: "txt" } },
  { group: "Preserve", label: "Share", note: "Share the selected journey or workspace", verb: "shareWorkspace", args: {} },
  { group: "Preserve", label: "Capability tour", note: "See the interaction system in context", verb: "startWorkspaceTour", args: {} },
  { group: "Preserve", label: "Set up for role", note: "Adapt Pearl to the work you do", verb: "openRoleSetup", args: {} },
  { group: "Preserve", label: "Switch material", note: "Toggle the workspace material theme", verb: "toggleWorkspaceTheme", args: {} },
]);

function PearlActionPalette({ onRun }) {
  const groups = [...new Set(PEARL_NATIVE_ACTIONS.map((action) => action.group))];
  const [group, setGroup] = useState(groups[0]);
  return <section className="pearl-action-palette" aria-label="Pearl actions">
    <nav aria-label="Action groups">
      {groups.map((name) => <button type="button" key={name} aria-pressed={group === name} onClick={() => setGroup(name)}>{name}</button>)}
    </nav>
    <div>
      {PEARL_NATIVE_ACTIONS.filter((action) => action.group === group).map((action) => <button
        type="button"
        key={action.label}
        onClick={() => onRun?.(action)}
      >
        <b>{action.label}</b>
        <small>{action.note}</small>
      </button>)}
    </div>
  </section>;
}

function LibraryHome({
  route,
  scenes,
  onCreateScene,
  onContinueHandoff,
  extensionHandoff,
  handoffStatus,
  onRetryHandoff,
  activeView,
  onView,
  install,
  context,
  lenses,
  candidates,
  onContextChange,
  onContextRemove,
  onLensChange,
  onLensRemove,
  onCandidateTaste,
}) {
  const [query, setQuery] = useState("");
  const continuationCount = continuationMaterialCount(extensionHandoff);
  const pearlCount = extensionHandoff?.semanticOrbs?.length || 0;
  const activePearl = extensionHandoff?.semanticOrbs?.find((entry) => entry.id === extensionHandoff?.activeSemanticOrbId)
    || extensionHandoff?.semanticOrbs?.[0];
  const isRoot = route.path === "/";
  const firstUse = isRoot && scenes.length === 0 && continuationCount === 0 && !route.handoff;
  const emptyLibrary = !isRoot && scenes.length === 0;
  const title = route.section && route.section !== "library"
    ? route.section[0].toUpperCase() + route.section.slice(1)
    : firstUse ? "Begin with something you noticed." : emptyLibrary ? "No saved work yet." : "Your cognitive universe";
  const visibleObjects = libraryObjects.filter(([name, description]) =>
    `${name} ${description}`.toLowerCase().includes(query.trim().toLowerCase())
  );
  return <main className="orb-library-home">
    {(firstUse || emptyLibrary) && <section className="orb-home-intro">
      <div className="orb-kicker">{firstUse ? "Pearl continuation space" : "Saved work"}</div>
      <h1>{title}</h1>
      <p>{firstUse
        ? "Select or drop material, click Pearl, and tell it what you want. Your source stays unchanged until you confirm where the result goes."
        : "Click Pearl to begin here, or select material on a page to create your first saved Pearl."}</p>
    </section>}
    {isRoot && (continuationCount > 0 || route.handoff) && <section className="orb-continuation" aria-label="Continue extension work">
      <div>
        <small>{extensionHandoff?.connected ? "Pearl extension connected" : handoffStatus === "loading" ? "Checking the page Pearl" : "Waiting for the page Pearl"}</small>
        <h2>{continuationCount
          ? pearlCount
            ? `${activePearl?.name || "Your pearl"} is ready to continue`
            : `${continuationCount} ${continuationCount === 1 ? "piece" : "pieces"} ready to become a pearl`
          : route.handoff ? "No working set arrived" : "Open this space from the Pearl on any page"}</h2>
        <p>{continuationCount
          ? `${pearlCount ? `${pearlCount} ${pearlCount === 1 ? "pearl remains" : "pearls remain"}` : "This captured material remains"} source-linked. Continue the capsule into one Scene to refine, use, insert, or arrange it without losing provenance.`
          : route.handoff
            ? "The link opened, but no capture, queued action, Lens, candidate, or saved orb was verified. Return to the extension and choose Arrange in full Scene, or retry after reconnecting it."
            : "On a page, ask Pearl to arrange, compare, edit deeply, inspect history, or open a full Scene. Pearl will carry the explicit working set here."}</p>
      </div>
      {continuationCount
        ? <button className="orb-primary" type="button" onClick={onContinueHandoff}>Continue this work</button>
        : route.handoff
          ? <button className="orb-secondary" type="button" disabled={handoffStatus === "loading"} onClick={onRetryHandoff}>{handoffStatus === "loading" ? "Checking…" : "Retry handoff"}</button>
        : extensionHandoff?.connected
          ? <button className="orb-secondary" type="button" onClick={() => onView("library")}>Open saved library</button>
          : <a className="orb-continuation-setup" href="/install" onClick={(event) => { event.preventDefault(); navigate("/install"); }}>Extension setup</a>}
    </section>}
    <section className="orb-recent-orbit" aria-label="Recent scenes and tasks">
      {scenes.slice(0, 2).map((scene, index) => <button
        key={scene.id}
        className={`recent-scene scene-${String.fromCharCode(97 + (index % 3))}`}
        onClick={() => navigate(`/scene/${encodeURIComponent(scene.id)}`)}
      >
        <i />{scene.name || "Untitled Scene"}
        <small>{(scene.items?.length || 0) + (scene.nodes?.length || 0)} materials · {(scene.frames?.length || 0)} frames</small>
      </button>)}
      {!isRoot && <button className="recent-scene scene-c" onClick={onCreateScene}><i />New Scene<small>Begin with an empty working set</small></button>}
    </section>
    {(firstUse || emptyLibrary) && <p className="orb-home-prompt">Click Pearl to begin · hold to speak · triple-click for Studio</p>}
    {activeView && <aside className="orb-emitted-library" aria-label={`${activeView} emitted by orb`}>
      <div>
        <span>{activeView === "library" ? "Cognitive library" : activeView}</span>
        <button type="button" aria-label="Close emitted view" onClick={() => onView(null)}>×</button>
      </div>
      {activeView === "actions"
        ? <p role="status">Pearl’s material actions appear inside a continued Scene, where selection, history, undo, and provenance are explicit.</p>
        : activeView === "context"
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

function SceneStage({ scene, view = "Stage", onMaterialDrop, onContextAdd, semanticOrbActions, onOpenStudio }) {
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
    <div className="orb-stage-context sr-only">
      <span>Scene</span>
      <b>{scene?.name || scene?.id || "Untitled Scene"}</b>
      <small>{materials.length} materials · {scene?.frames?.length || 0} Output Frames</small>
    </div>
    {!materials.length && !(scene?.semanticOrbs || []).filter((orb) => !orb.archived).length
      ? <section className="orb-stage-empty">
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
              <button type="button" className="orb-material-context-action" onClick={() => onContextAdd(material)}>Add to Pearl context</button>
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
      onBind={semanticOrbActions?.bind}
      onArchive={semanticOrbActions?.archive}
      onAddContext={semanticOrbActions?.addContext}
      onRemoveContext={semanticOrbActions?.removeContext}
      onApplyLens={semanticOrbActions?.applyLens}
      onRemoveLens={semanticOrbActions?.removeLens}
      onNest={semanticOrbActions?.nest}
      onUnnest={semanticOrbActions?.unnest}
      onMerge={semanticOrbActions?.merge}
      onCompose={semanticOrbActions?.compose}
      onSplit={semanticOrbActions?.split}
      onDuplicate={semanticOrbActions?.duplicate}
      onDelete={semanticOrbActions?.delete}
      onOpenStudio={onOpenStudio}
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
  const orbRedoRef = useRef(null);
  const approvalResolverRef = useRef(null);
  const [install, setInstall] = useState({ status: "checking", trusted: false });
  const [extensionHandoff, setExtensionHandoff] = useState({ connected: false, handoff: null, session: null, semanticOrbs: [] });
  const [handoffStatus, setHandoffStatus] = useState("idle");
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
  const [privacyNotice, setPrivacyNotice] = useState(null);
  const [hasOrbUndo, setHasOrbUndo] = useState(false);
  const [hasOrbRedo, setHasOrbRedo] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(null);
  const [cursorMode, setCursorModeState] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(ORB_CURSOR_STORAGE_KEY) || "null")?.enabled === true;
    } catch {
      return false;
    }
  });
  const [externalCursorMode, setExternalCursorMode] = useState(false);
  const [sceneView, setSceneView] = useState("Stage");
  const [outputToolsOpen, setOutputToolsOpen] = useState(false);
  const [outputFrameOpen, setOutputFrameOpen] = useState(() => {
    const query = new URLSearchParams(location.search);
    return ["legacy", "workspace"].includes(query.get("frame")) || [...query.keys()].some((key) => /(?:audit|tour|brush|learn)/i.test(key));
  });
  orbRef.current = orb;

  useEffect(() => {
    setSceneView("Stage");
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

  const refreshInstall = useCallback(() => {
    setInstall({ status: "checking", trusted: false });
    return checkTrustedExtensionInstallation().then(setInstall);
  }, []);

  useEffect(() => {
    let active = true;
    checkTrustedExtensionInstallation().then((value) => {
      if (active) setInstall(value);
    });
    return () => { active = false; };
  }, []);

  const refreshHandoff = useCallback(async () => {
    setHandoffStatus("loading");
    const value = route.handoff === "result-pearl"
      ? await requestTrustedResultHandoff(route.handoffToken)
      : await requestTrustedExtensionHandoff(route.handoffToken);
    setExtensionHandoff(value);
    setHandoffStatus(continuationMaterialCount(value) > 0 ? "ready" : "blocked");
    return value;
  }, [route.handoff, route.handoffToken]);

  useEffect(() => {
    if (route.kind !== "home") return;
    refreshHandoff();
  }, [route.kind, route.handoff, refreshHandoff]);

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
        y: route.kind === "stage"
          ? Math.max(120, (window.innerHeight - 120) / 2)
          : Math.max(120, window.innerHeight - 86),
      },
    }));
  }, [route.kind]);

  function continueToLibrary() {
    localStorage.setItem(ORB_CONTINUE_KEY, "true");
    navigate("/library");
  }

  async function command(raw) {
    activeRunAbortRef.current?.abort();
    const recorded = recordOrbUtterance(orb, raw, {
      id: `web:${Date.now()}`,
      targetSnapshot: [{ route: route.path }],
    });
    const dispatched = markUtteranceDispatched(recorded.state, recorded.entry.id, `dispatch:${recorded.entry.id}`);
    window.dispatchEvent(new CustomEvent("lens:companion-run", {
      detail: { id: recorded.entry.id, source: "pearl", text: recorded.entry.raw },
    }));
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
    const privacyIntent = recorded.entry.normalized;
    if (/^what(?:'s| is) stored(?: here| locally| on this device)?\??$/i.test(privacyIntent)) {
      const summary = window.__pearlPrivacy?.describe?.() || { locked: true, profile: "unknown", keys: [] };
      setPrivacyNotice({
        title: summary.locked ? "Local Pearls are locked" : boardSyncEnabled() ? "Local storage · sync enabled" : "Local only",
        detail: `${summary.itemCount || 0} private data categories · ${summary.profile || "this"} profile`,
      });
      setEmittedView("privacy");
      next = transitionOrb(next, "executing", { taskId: recorded.entry.id, commandId: "inspectLocalPrivacy" });
      setOrb(transitionOrb(next, "completed", { taskId: recorded.entry.id, commandId: "inspectLocalPrivacy", effectId: "privacy:inspected" }));
      return;
    }
    if (/^export (?:my )?local pearl data$/i.test(privacyIntent)) {
      const local = await window.__pearlPrivacy?.exportLocal?.();
      if (!local) throw new Error("local privacy storage is unavailable");
      const url = URL.createObjectURL(new Blob([JSON.stringify(local, null, 2)], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "pearl-local-data.json";
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      next = transitionOrb(next, "executing", { taskId: recorded.entry.id, commandId: "exportLocalData" });
      setOrb(transitionOrb(next, "completed", { taskId: recorded.entry.id, commandId: "exportLocalData", effectId: "privacy:exported" }));
      return;
    }
    if (/^(?:enable|turn on|disable|turn off) sync$/i.test(privacyIntent)) {
      const enabled = /^(?:enable|turn on)/i.test(privacyIntent);
      setBoardSyncEnabled(enabled);
      window.dispatchEvent(new CustomEvent("pearl-board-sync-consent", { detail: { enabled } }));
      setPrivacyNotice({ title: enabled ? "Sync enabled for this profile" : "Local only", detail: enabled ? "Account sync was explicitly enabled." : "No Pearl metadata will sync." });
      setEmittedView("privacy");
      next = transitionOrb(next, "executing", { taskId: recorded.entry.id, commandId: "setBoardSync" });
      setOrb(transitionOrb(next, "completed", { taskId: recorded.entry.id, commandId: "setBoardSync", effectId: `privacy:sync:${enabled}` }));
      return;
    }
    if (/^(?:lock|unlock) (?:my |these )?pearls$/i.test(privacyIntent)) {
      const unlock = /^unlock/i.test(privacyIntent);
      const secret = window.prompt(unlock
        ? "Enter this profile’s local passphrase."
        : "Enter this profile’s passphrase, or create one (12+ characters) the first time. Losing it makes protected local data unrecoverable.");
      if (!secret) {
        setOrb(transitionOrb(next, "blocked", { taskId: recorded.entry.id, evidence: { boundary: `${unlock ? "Unlocking" : "Locking"} was cancelled.` } }));
        return;
      }
      await window.__pearlPrivacy?.[unlock ? "unlock" : "lock"]?.(secret);
      next = transitionOrb(next, "executing", { taskId: recorded.entry.id, commandId: unlock ? "unlockLocalPearls" : "lockLocalPearls" });
      setOrb(transitionOrb(next, "completed", { taskId: recorded.entry.id, commandId: unlock ? "unlockLocalPearls" : "lockLocalPearls", effectId: `privacy:${unlock ? "unlocked" : "locked"}` }));
      location.reload();
      return;
    }
    if (/^delete (?:my |this profile(?:'s)? )?local pearl data$/i.test(privacyIntent)) {
      setOrb(transitionOrb(next, "approval", {
        taskId: recorded.entry.id,
        evidence: { title: "Delete this profile’s local Pearl metadata?", preview: true, steps: ["Account data is untouched", "A local deletion receipt is created"] },
      }));
      setPendingApproval({ title: "Delete this profile’s local Pearl metadata?", steps: ["Account data is untouched", "A local deletion receipt is created"] });
      const approval = await new Promise((resolve) => { approvalResolverRef.current = resolve; });
      if (approval?.decision !== "accept") {
        setOrb((value) => createOrbState({ ...value, phase: "paused", effectId: null, commandId: null }));
        return;
      }
      await window.__pearlPrivacy?.deleteLocal?.();
      setOrb((value) => transitionOrb(value, "executing", { taskId: recorded.entry.id, commandId: "deleteLocalData" }));
      setOrb((value) => transitionOrb(value, "completed", { taskId: recorded.entry.id, commandId: "deleteLocalData", effectId: "privacy:deleted" }));
      location.reload();
      return;
    }
    if (/\b(?:open|start|new)\b.*\bscene\b/i.test(recorded.entry.normalized)) {
      next = transitionOrb(next, "executing", { taskId: recorded.entry.id, commandId: "openScene" });
      setOrb(transitionOrb(next, "completed", { taskId: recorded.entry.id, commandId: "openScene", effectId: "route:scene" }));
      navigate(`/scene/${crypto.randomUUID()}`);
      return;
    }
    if (/\b(?:install|set up|add)\b.*\b(?:pearl|extension)\b/i.test(recorded.entry.normalized)) {
      const executing = transitionOrb(next, "executing", { taskId: recorded.entry.id, commandId: "openExtensionDownload" });
      setOrb(transitionOrb(executing, "completed", { taskId: recorded.entry.id, commandId: "openExtensionDownload", effectId: "route:install" }));
      navigate("/install");
      return;
    }
    if (/\b(?:show|inspect|open)\b.*\b(?:context|what you noticed|source material)\b/i.test(recorded.entry.normalized)) {
      setEmittedView("context");
      const executing = transitionOrb(next, "executing", { taskId: recorded.entry.id, commandId: "inspectContext" });
      setOrb(transitionOrb(executing, "completed", { taskId: recorded.entry.id, commandId: "inspectContext", effectId: "view:context" }));
      return;
    }
    if (/\b(?:show|inspect|open)\b.*\b(?:saved|history|library|settings|packages|past work)\b/i.test(recorded.entry.normalized)) {
      setEmittedView("library");
      const executing = transitionOrb(next, "executing", { taskId: recorded.entry.id, commandId: "inspectLibrary" });
      setOrb(transitionOrb(executing, "completed", { taskId: recorded.entry.id, commandId: "inspectLibrary", effectId: "view:library" }));
      return;
    }
    if (/\b(?:show|inspect|open|change)\b.*\b(?:scene controls|layout|view)\b/i.test(recorded.entry.normalized)) {
      setEmittedView("scene");
      const executing = transitionOrb(next, "executing", { taskId: recorded.entry.id, commandId: "inspectScene" });
      setOrb(transitionOrb(executing, "completed", { taskId: recorded.entry.id, commandId: "inspectScene", effectId: "view:scene" }));
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
      const stagedDestructive = runtime.pendingDestructive?.();
      if (stagedDestructive) {
        const steps = stagedDestructive.domains.map((domain) =>
          `${domain}: ${stagedDestructive.counts?.[domain] || 0} item${stagedDestructive.counts?.[domain] === 1 ? "" : "s"}`
        );
        setOrb((value) => value.phase === "approval" ? value : transitionOrb(value, "approval", {
          taskId: recorded.entry.id,
          evidence: { title: "Clear selected workspace domains?", preview: true, steps },
        }));
        setPendingApproval({ title: "Clear selected workspace domains?", steps });
        const approval = await new Promise((resolve) => {
          approvalResolverRef.current = resolve;
        });
        if (approval?.decision !== "accept") {
          runtime.rejectDestructive?.();
          setOrb((value) => createOrbState({ ...value, phase: "paused", effectId: null, commandId: null }));
          return;
        }
        runtime.confirmDestructive?.();
        setOrb((value) => transitionOrb(value, "executing", {
          taskId: recorded.entry.id,
          commandId: "clearWorkspaceDomains",
        }));
      }
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

  async function executePearlAction(action) {
    if (!action?.verb) return;
    if (route.kind !== "stage") {
      setOrb((value) => createOrbState({
        ...value,
        phase: "blocked",
        trace: [...(value.trace || []), {
          id: `pearl-action-blocked:${Date.now()}`,
          from: value.phase,
          to: "blocked",
          at: new Date().toISOString(),
          evidence: { boundary: "Continue or open a Scene before using material actions." },
        }],
      }));
      return;
    }
    setOutputFrameOpen(true);
    setOrb((value) => createOrbState({
      ...value,
      phase: "executing",
      commandId: action.verb,
      taskId: `pearl-action:${action.verb}:${Date.now()}`,
    }));
    try {
      const runtime = await waitForOrbRuntime();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const result = await runtime.execute([{ verb: action.verb, args: action.args || {} }], {
        title: action.label || "Pearl action",
      });
      if (!result?.completed) throw new Error(result?.errors?.[0] || `${action.label || action.verb} could not complete`);
      const candidates = runtime.candidates?.() || orbRef.current.candidates || [];
      setOrb((value) => transitionOrb({ ...value, candidates }, "completed", {
        taskId: value.taskId,
        commandId: action.verb,
        effectId: result.effects?.at?.(-1)?.id || `pearl-action:${action.verb}:${Date.now()}`,
        evidence: { observed: result.effects || [`${action.verb}-completed`] },
      }));
      setEmittedView(null);
    } catch (error) {
      setOrb((value) => createOrbState({
        ...value,
        phase: "blocked",
        trace: [...(value.trace || []), {
          id: `pearl-action-error:${Date.now()}`,
          from: value.phase,
          to: "blocked",
          at: new Date().toISOString(),
          evidence: { boundary: error.message },
        }],
      }));
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
      const redoStorage = localStorage.getItem(UNIFIED_WORKSPACE_KEY);
      const redoOrb = orbRef.current;
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
      orbRedoRef.current = {
        orb: redoOrb,
        restore() {
          if (redoStorage == null) localStorage.removeItem(UNIFIED_WORKSPACE_KEY);
          else localStorage.setItem(UNIFIED_WORKSPACE_KEY, redoStorage);
          setSceneWorkspace(loadSceneWorkspace());
        },
      };
      setHasOrbUndo(false);
      setHasOrbRedo(true);
      orbRef.current = restored;
      setOrb(restored);
      return;
    }
    try {
      const runtime = await waitForOrbRuntime();
      setOrb((value) => createOrbState({ ...value, phase: "recovery", effectId: null }));
      const receipt = runtime.undo();
      orbRedoRef.current = { runtime: true };
      setHasOrbRedo(true);
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

  async function redoOrbEffect() {
    const record = orbRedoRef.current;
    if (!record) return;
    if (record.runtime) {
      try {
        const runtime = await waitForOrbRuntime();
        const receipt = runtime.redo();
        setOrb((value) => transitionOrb(value, "completed", {
          taskId: value.taskId || `redo:${Date.now()}`,
          commandId: "redoWorkspace",
          effectId: `redo:${Date.now()}`,
          evidence: receipt,
        }));
        orbRedoRef.current = null;
        setHasOrbRedo(false);
        setHasOrbUndo(true);
      } catch (error) {
        setOrb((value) => createOrbState({
          ...value,
          phase: "blocked",
          trace: [...(value.trace || []), { id: `redo-error:${Date.now()}`, from: value.phase, to: "blocked", evidence: { boundary: error.message } }],
        }));
      }
      return;
    }
    const undoStorage = localStorage.getItem(UNIFIED_WORKSPACE_KEY);
    const undoOrb = orbRef.current;
    record.restore?.();
    const restored = createOrbState({
      ...(record.orb || undoOrb),
      phase: "completed",
      commandId: "redoWorkspace",
      effectId: `redo:orb:${Date.now()}`,
    });
    orbUndoRef.current = {
      orb: undoOrb,
      restore() {
        if (undoStorage == null) localStorage.removeItem(UNIFIED_WORKSPACE_KEY);
        else localStorage.setItem(UNIFIED_WORKSPACE_KEY, undoStorage);
        setSceneWorkspace(loadSceneWorkspace());
      },
    };
    orbRedoRef.current = null;
    setHasOrbRedo(false);
    setHasOrbUndo(true);
    orbRef.current = restored;
    setOrb(restored);
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
    orbRedoRef.current = null;
    setHasOrbUndo(true);
    setHasOrbRedo(false);
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
    bind: (id, representation) => applySemanticOrbCommand("bindSemanticOrb", { id, representation }),
    archive: (id, archived = true) => applySemanticOrbCommand("archiveSemanticOrb", { id, archived }),
    addContext: (id, item) => applySemanticOrbCommand("addSemanticOrbContext", { id, items: [item] }),
    removeContext: (id, itemId) => applySemanticOrbCommand("removeSemanticOrbContext", { id, itemId }),
    applyLens: (id, lens) => applySemanticOrbCommand("applySemanticOrbLens", { id, lens, strength: lens.strength }),
    removeLens: (id, lensId) => applySemanticOrbCommand("removeSemanticOrbLens", { id, lensId }),
    nest: (childId, parentId) => applySemanticOrbCommand("nestSemanticOrb", { childId, parentId }),
    unnest: (id) => applySemanticOrbCommand("unnestSemanticOrb", { id }),
    merge: (ids) => applySemanticOrbCommand("mergeSemanticOrbs", { ids, sceneId: route.sceneId }),
    compose: (ids) => applySemanticOrbCommand("composeSemanticOrbs", { ids, sceneId: route.sceneId }),
    split: (id) => applySemanticOrbCommand("splitSemanticOrb", { id, sceneId: route.sceneId }),
    duplicate: (id) => applySemanticOrbCommand("duplicateSemanticOrb", { id }),
    delete: (id) => applySemanticOrbCommand("deleteSemanticOrb", { id }),
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
      orbRedoRef.current = null;
      setHasOrbUndo(true);
      setHasOrbRedo(false);
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
      orbRedoRef.current = null;
      setHasOrbUndo(true);
      setHasOrbRedo(false);
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
    orbRedoRef.current = null;
    setHasOrbUndo(true);
    setHasOrbRedo(false);
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

  async function continueExtensionWork() {
    if (!continuationMaterialCount(extensionHandoff)) {
      setHandoffStatus("blocked");
      return;
    }
    const handoffIdentity = String(
      extensionHandoff?.handoff?.id
      || extensionHandoff?.resultPearl?.id
      || extensionHandoff?.handoff?.createdAt
      || [
        ...(extensionHandoff?.session?.fragments || []).map((entry) => entry.id),
        ...(extensionHandoff?.session?.queue || []).map((entry) => entry.id),
        ...(extensionHandoff?.session?.results || []).flatMap((run) => (run.outputs || []).map((entry) => entry.id)),
      ].filter(Boolean).join("-")
      || "current"
    ).replace(/[^a-z0-9_-]/gi, "-").slice(0, 80);
    const id = `scene-extension-${handoffIdentity}`;
    const carriedItems = continuationItems(extensionHandoff);
    const material = continuationMaterial(extensionHandoff, {
      id: `extension-working-set-${handoffIdentity}`,
      surface: route.handoff,
    });
    const carriedOrbs = normalizeSemanticOrbs(extensionHandoff?.semanticOrbs || []).map((semanticOrb, index) => ({
      ...semanticOrb,
      sceneId: id,
      placement: {
        ...semanticOrb.placement,
        x: Number(semanticOrb.placement?.x) || -180 + (index % 5) * 90,
        y: Number(semanticOrb.placement?.y) || -110 + Math.floor(index / 5) * 90,
      },
      provenance: {
        ...(semanticOrb.provenance || {}),
        continuedFrom: "pearl-extension",
      },
    }));
    const carriedActiveId = carriedOrbs.some((semanticOrb) => semanticOrb.id === extensionHandoff?.activeSemanticOrbId)
      ? extensionHandoff.activeSemanticOrbId
      : null;
    const execution = await executeOrbCommand({
      orb: createOrbState(),
      command: "createSemanticOrb",
      state: { semanticOrbs: carriedOrbs, activeSemanticOrbId: carriedActiveId },
      args: { sceneId: id, material, orb: { id: material.id }, placement: { x: 0, y: 0 }, activate: !carriedActiveId },
      taskId: `extension-handoff:${id}`,
      observe: async ({ result }) => ({ effects: result.effects }),
    });
    const scene = createScene({
      id,
      name: extensionHandoff?.handoff?.name || "Continued from Pearl",
      items: carriedItems,
      semanticOrbs: execution.state.semanticOrbs,
      activeSemanticOrbId: execution.state.activeSemanticOrbId,
      metadata: {
        createdFrom: "pearl-extension-handoff",
        handoffSurface: route.handoff || extensionHandoff?.handoff?.surface || "workspace",
        handoffQueue: (extensionHandoff?.session?.queue || []).map((entry) => entry.id).filter(Boolean),
        handoffLens: extensionHandoff?.session?.generator?.id || null,
        handoffCandidates: (extensionHandoff?.session?.results || []).flatMap((run) => (run.outputs || []).map((output) => output.id)).filter(Boolean),
      },
    });
    const scenes = [...(sceneWorkspace.scenes || []).filter((entry) => entry.id !== scene.id), scene];
    const serialized = serializeUnifiedWorkspace({
      scenes,
      activeSceneId: scene.id,
      items: scene.items,
      nodes: scene.nodes,
      camera: scene.camera,
      frames: scene.frames,
      orbInstances: scene.orbInstances,
      semanticOrbs: scene.semanticOrbs,
      activeSemanticOrbId: scene.activeSemanticOrbId,
      workingSet: scene.workingSet,
    });
    localStorage.setItem(UNIFIED_WORKSPACE_KEY, serialized);
    setSceneWorkspace(JSON.parse(serialized));
    setOutputFrameOpen(true);
    navigate(`/scene/${encodeURIComponent(id)}?frame=workspace`);
  }

  useEffect(() => {
    if (route.handoff !== "result-pearl" || handoffStatus !== "ready" || !extensionHandoff?.resultPearl) return;
    continueExtensionWork();
  }, [route.handoff, handoffStatus, extensionHandoff?.resultPearl?.id]);

  function openActivePearlStudio(selectedPearl = null) {
    const scene = (sceneWorkspace.scenes || []).find((entry) => entry.id === (route.sceneId || sceneWorkspace.activeSceneId));
    const active = selectedPearl || scene?.semanticOrbs?.find((entry) => entry.id === scene.activeSemanticOrbId)
      || scene?.semanticOrbs?.[0]
      || {
        id: `primary:${scene?.id || "workspace"}`,
        kind: "primary",
        name: scene?.name || "Pearl",
        workingSet: { context: orb.context || [], lenses: orb.lenses || [] },
        candidates: orb.candidates || [],
        workers: orb.workers || [],
      };
    const entity = createPearlEntity(active);
    let store;
    try { store = JSON.parse(localStorage.getItem(PEARL_STORE_KEY) || "null"); } catch { store = null; }
    store ||= { version: 1, entities: {} };
    localStorage.setItem(PEARL_STORE_KEY, JSON.stringify({
      ...store,
      entities: { ...(store.entities || {}), [entity.id]: entity },
      activePearlId: entity.id,
      updatedAt: Date.now(),
    }));
    const ref = createWebPearlStudioReference(entity.id);
    const href = `${location.pathname}${location.search}#pearl-studio=${encodeURIComponent(ref)}`;
    const opened = window.open(href, "_blank", "noopener");
    if (!opened) location.assign(href);
  }

  useEffect(() => {
    const open = (event) => {
      const pearlId = event.detail?.pearlId;
      const selected = pearlId
        ? (sceneWorkspace.scenes || []).flatMap((scene) => scene.semanticOrbs || []).find((entry) => entry.id === pearlId)
        : null;
      openActivePearlStudio(selected);
    };
    window.addEventListener("lens:open-pearl-studio", open);
    return () => window.removeEventListener("lens:open-pearl-studio", open);
  });

  const routedScene = (sceneWorkspace.scenes || []).find((scene) => scene.id === route.sceneId)
    || createScene({ id: route.sceneId || "untitled", name: route.sceneId || "Untitled Scene" });

  if (route.kind === "stage") {
    return <div className="orb-stage-shell" data-semantic-anchor="scene-stage">
      <div className={`orb-output-frame-host ${outputToolsOpen ? "tools-emitted" : ""}`} data-semantic-anchor="output-frame" hidden={!outputFrameOpen}><StageComponent key={route.sceneId || "untitled"} sceneId={route.sceneId} pearlShell /></div>
      {!outputFrameOpen && <SceneStage
        scene={routedScene}
        view={sceneView}
        onMaterialDrop={materializeOnStage}
        onContextAdd={addOrbContext}
        semanticOrbActions={semanticOrbActions}
        onOpenStudio={openActivePearlStudio}
      />}
      {!cursorMode && <CompanionOrb key="stage-orb" featured state={orb} onStateChange={setOrb} onCommand={command} onStop={stopOrb} onUndo={undoOrbEffect} onRedo={hasOrbRedo ? redoOrbEffect : undefined}
        onVoiceStart={beginVoice} onVoiceEnd={endVoice} onContextAdd={addOrbContext} onLensAdd={addOrbLens} onEmitView={setEmittedView}
        onOrbCreate={() => semanticOrbActions.create({ placement: { x: 0, y: 0 } })}
        cursorMode={cursorMode} onCursorToggle={(enabled) => setCursorMode(enabled, "control")}
        onOpenStudio={openActivePearlStudio}
        approval={pendingApproval} onApproval={decideApproval} onWorkerCancel={cancelWorker} />}
      {cursorMode && !externalCursorMode && <OrbCursorLayer state={orb} onDisable={() => setCursorMode(false, "control")} />}
      <span className="sr-only" role="status" aria-live="polite">{cursorMode ? "Orb cursor on" : "Orb cursor off"}</span>
      {emittedView && <aside className="orb-stage-emission" aria-label={`${emittedView} view emitted by orb`}>
        <button type="button" onClick={() => setEmittedView(null)}>Close</button>
        <b>{emittedView === "context" ? "What Pearl noticed" : emittedView === "actions" ? "Actions" : emittedView === "taste" ? "Choices" : emittedView === "scene" ? "View" : emittedView === "privacy" ? privacyNotice?.title : "Saved work"}</b>
        {emittedView === "actions"
          ? <PearlActionPalette onRun={executePearlAction} />
          : emittedView === "scene"
          ? <nav className="pearl-scene-actions" aria-label="Scene and Output Frame actions">
              <button type="button" onClick={() => navigate("/library")}>Past work</button>
              <button type="button" aria-pressed={outputFrameOpen} onClick={() => setOutputFrameOpen((value) => !value)}>
                {outputFrameOpen ? "Return to space" : "Focus on the result"}
              </button>
              {outputFrameOpen && <button type="button" aria-pressed={outputToolsOpen} onClick={() => setOutputToolsOpen((value) => !value)}>
                {outputToolsOpen ? "Hide editing tools" : "Editing tools"}
              </button>}
              {[["Stage", "Space"], ["Gallery", "Grid"], ["Graph", "Connections"], ["Table", "Details"], ["Timeline", "Sequence"]].map(([option, optionLabel]) => <button
                type="button"
                key={option}
                aria-pressed={!outputFrameOpen && sceneView === option}
                onClick={() => { setOutputFrameOpen(false); setSceneView(option); }}
              >{optionLabel}</button>)}
            </nav>
          : emittedView === "privacy"
          ? <span>{privacyNotice?.detail}</span>
          : emittedView === "context"
          ? <ContextInspector items={orb.context || []} onChange={updateOrbContext} onRemove={removeOrbContext} />
          : emittedView === "lenses"
            ? <LensAtmosphereInspector lenses={orb.lenses || []} onChange={updateOrbLens} onRemove={removeOrbLens} />
            : emittedView === "taste"
              ? <CandidateInspector candidates={orb.candidates || []} onTaste={tasteCandidate} />
            : libraryObjects.slice(0, 5).map(([name]) => <span key={name}>{name}</span>)}
      </aside>}
    </div>;
  }

  const showInstall = route.kind === "install";
  return <div className="orb-universe">
    {showInstall
      ? <InstallLanding install={install} onContinue={continueToLibrary} onRetry={refreshInstall} />
      : <LibraryHome
          route={route}
          scenes={sceneWorkspace.scenes || []}
          onCreateScene={createBlankScene}
          onContinueHandoff={continueExtensionWork}
          extensionHandoff={extensionHandoff}
          handoffStatus={handoffStatus}
          onRetryHandoff={refreshHandoff}
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
    {!showInstall && !cursorMode && <CompanionOrb
      key="universe-orb"
      featured
      state={orb}
      onStateChange={setOrb}
      onCommand={command}
      onStop={stopOrb}
      onUndo={undoOrbEffect}
      onRedo={hasOrbRedo ? redoOrbEffect : undefined}
      onVoiceStart={beginVoice}
      onVoiceEnd={endVoice}
      onContextAdd={addOrbContext}
      onLensAdd={addOrbLens}
      onEmitView={setEmittedView}
      onOrbCreate={createBlankScene}
      cursorMode={cursorMode}
      onCursorToggle={(enabled) => setCursorMode(enabled, "control")}
      approval={pendingApproval}
      onApproval={decideApproval}
      onWorkerCancel={cancelWorker}
      onOpenStudio={openActivePearlStudio}
    />}
    {emittedView === "privacy" && privacyNotice && <aside className="orb-stage-emission" aria-label="Privacy view emitted by Pearl">
      <button type="button" onClick={() => setEmittedView(null)}>Close</button>
      <b>{privacyNotice.title}</b>
      <span>{privacyNotice.detail}</span>
    </aside>}
  </div>;
}

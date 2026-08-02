import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CompanionOrb from "./CompanionOrb.jsx";
import PhysicalPearl from "./PhysicalPearl.jsx";
import OrbCursorLayer from "./OrbCursorLayer.jsx";
import SemanticOrbLayer from "./SemanticOrbLayer.jsx";
import PearlPowerFxOverlay from "./PearlPowerFxOverlay.jsx";
import AuthOverlay from "./AuthOverlay.jsx";
import EncodeAnythingPanel from "./EncodeAnythingPanel.jsx";
import CognitivePackageRegistry from "./CognitivePackageRegistry.jsx";
import { createWebPearlStudioReference } from "./PearlStudioView.jsx";
import SurfaceErrorBoundary from "./SurfaceErrorBoundary.jsx";
import { visibleShellNavScreens } from "../lib/pearl-primary-screens.js";
import { openPearlStudioDocument } from "../lib/pearl-studio-navigation.js";
import { createPearlEntity } from "../../shared/pearl-entity.js";
import { PEARL_STORE_KEY } from "../../shared/pearl-store.js";
import { createOrbState, executeOrbCommand, markUtteranceDispatched, recordOrbUtterance, transitionOrb } from "../../shared/orb-runtime.js";
import { normalizeSemanticOrbs } from "../../shared/semantic-orbs.js";
import { pearlAnimationForCommand } from "../../shared/pearl-animation.js";
import { dispatchPearlPowerFx, powerFxForAnimation } from "../../shared/pearl-power-fx.js";
import {
  ORB_CURSOR_EVENT,
  ORB_CURSOR_SEQUENCE_ATTRIBUTE,
  ORB_CURSOR_STORAGE_KEY,
  ORB_CURSOR_TRIPLE_SPACE_MS,
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
  PEARL_GUIDE_STORAGE_KEY,
  PEARL_WELCOME_STORAGE_KEY,
  guideSectionsFor,
  recordPearlGuideOpen,
} from "../lib/pearl-guide.js";
import {
  LEGACY_UNIFIED_WORKSPACE_KEYS,
  UNIFIED_WORKSPACE_KEY,
  createScene,
  migrateUnifiedWorkspace,
  serializeUnifiedWorkspace,
  updateSceneWorkspace,
} from "../lib/unified-workspace.js";
import { useSupabaseSession } from "../lib/auth-session.js";
import { getSupabase, isSupabaseConfigured } from "../lib/supabase.js";
import { describeAccountPanel, describeAccountsUnavailable } from "../lib/account-setup.js";
import {
  SHELL_ACTION_EVENT,
  matchShellNavigationIntent,
  navigateBackOrHome,
  navigateHome,
  nextEscapeAction,
} from "../lib/shell-navigation.js";
import { collectReefPearls, findWorkspacePearl, isReefHomePath } from "../lib/reef-home.js";
import {
  materialFromIngestedText,
  resolveSceneMaterialDrop,
  shouldAcceptSceneStageTransfer,
  wantsOutputFrameFromSearch,
} from "../lib/scene-stage-interactions.js";
import { registerDirectorVerbs } from "../lib/director.js";
import {
  parseInvestorRolePearlCommand,
  parsePearlCapabilityDemoCommand,
  parsePearlRemixCommand,
  parseSafeDemonstrationCommand,
} from "../lib/companion-intent.js";
import { buildInvestorRolePearlScaffold } from "../../shared/role-pearl-scaffold.js";
import { findDemo } from "../lib/companion-demos.js";
import { PEARL_CAPABILITY_DEMO_ID } from "../lib/pearl-capability-demo.js";
import {
  discoverFormingPearls as discoverFormingPearlsFromImport,
  MAX_FORMING_PEARLS,
} from "../../shared/forming-pearls.js";
import { extractTextFromFile } from "../../shared/encode-evidence.js";
import {
  loadGauntletState,
  MAX_GAUNTLET_SLOTS,
  removePearlIdFromGauntlet,
  wearPearlIdInGauntlet,
} from "../../shared/companion-pearl-gauntlet.js";
import { loadWornOrbitState } from "../../shared/companion-pearl-wear.js";
import {
  EXECUTION_CODES,
  mapErrorToExecutionResult,
  recordAndLogExecution,
} from "../../shared/execution-result.js";

export { collectReefPearls, findWorkspacePearl, isReefHomePath } from "../lib/reef-home.js";

export const ORB_CONTINUE_KEY = "lens.orb-universe.continued.v1";
function resolveSpeechRecognition() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}
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
  if (isReefHomePath(path)) {
    const handoff = fragment.get("handoff") || query.get("handoff");
    const legacyCognitive = query.get("cognitive");
    return {
      kind: "home",
      path,
      reef: true,
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
  history.pushState({ pearlNav: true }, "", path);
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
  try {
    const unified = readJson(UNIFIED_WORKSPACE_KEY, null)
      || LEGACY_UNIFIED_WORKSPACE_KEYS.map((key) => readJson(key, null)).find(Boolean)
      || null;
    const rawItems = readJson("lens.board.items.v1", []);
    const rawNodes = readJson("lens.ai.nodes.v1", []);
    const rawPages = readJson("lens.board.pages.v1", []);
    const items = Array.isArray(rawItems) ? rawItems : [];
    const nodes = Array.isArray(rawNodes) ? rawNodes : [];
    const pages = Array.isArray(rawPages) ? rawPages : [];
    if (!unified && !items.length && !nodes.length && !pages.length) {
      return { version: 4, activeSceneId: null, scenes: [] };
    }
    const migrated = migrateUnifiedWorkspace({
      unified,
      items,
      nodes,
      pages,
      activePageId: pages[0]?.id || null,
      camera: readJson("lens.board.camera.v1", null),
    });
    if (!migrated || !Array.isArray(migrated.scenes)) {
      return { version: 4, activeSceneId: null, scenes: [] };
    }
    return migrated;
  } catch (error) {
    console.error("Pearl workspace load failed; starting empty Reef.", error);
    return { version: 4, activeSceneId: null, scenes: [] };
  }
}

const EXTENSION_DOWNLOAD_FALLBACK = "/downloads/lens-everywhere-chrome-latest.zip";

function InstallLanding({ install, onContinue, onRetry, onHome }) {
  const browser = useMemo(() => detectExtensionBrowser(navigator.userAgent), []);
  const storeUrl = validChromeStoreUrl(import.meta.env.VITE_CHROME_WEB_STORE_URL);
  const release = typeof __LENS_EXTENSION_RELEASE__ === "undefined" ? null : __LENS_EXTENSION_RELEASE__;
  const installUrl = storeUrl || release?.versionedUrl || release?.latestUrl || EXTENSION_DOWNLOAD_FALLBACK;
  return <main className="orb-install" data-testid="install-landing">
    <header className="pearl-reef-chrome" aria-label="Install page navigation">
      <button type="button" data-testid="shell-nav-reef" onClick={onHome}>← Reef (home)</button>
      <span>Install · browser extension</span>
    </header>
    <section>
      <h1>Install Pearl in Chrome</h1>
      <p>{install.status === "installed"
        ? "Ready. Open the Reef and talk to your Companion."
        : "Add Pearl, then press Check again."}</p>
      <div className="orb-actions">
        {install.status === "installed"
          ? <button className="orb-primary" type="button" onClick={onContinue}>Open Reef</button>
          : <a
              className="orb-primary"
              data-testid="extension-download-cta"
              href={installUrl}
              onClick={() => trackExtensionFunnel("install_cta", { surface: "orb-home", mode: storeUrl ? "store" : "download" })}
            >
              {browser.supported ? "Add Pearl to Chrome" : "Download for Chrome"}
            </a>}
        {install.status !== "installed" && <button className="orb-secondary" type="button" onClick={onRetry}>Check again</button>}
        <button className="orb-secondary" type="button" onClick={onHome}>Back to Reef</button>
      </div>
      <p className="orb-status" role="status">
        {install.status === "checking" ? "Checking whether Pearl is installed…"
          : install.status === "installed" ? "Installed and verified."
            : "Not verified yet. Install, then check again."}
      </p>
    </section>
  </main>;
}

function PearlShellNav({ activeId = "reef", onNavigate }) {
  const screens = visibleShellNavScreens();
  return (
    <nav className="pearl-shell-nav" data-testid="pearl-shell-nav" aria-label="Pearl primary screens">
      {screens.map((screen) => (
        <button
          key={screen.id}
          type="button"
          data-testid={screen.testId}
          aria-current={activeId === screen.id ? "page" : undefined}
          onClick={() => onNavigate?.(screen)}
        >
          {screen.label}
        </button>
      ))}
    </nav>
  );
}

function AccountPrivacyPanel({
  session,
  sessionResolved = true,
  accountsConfigured,
  syncEnabled,
  onSignIn,
  onSignOut,
  onToggleSync,
  onLock,
  onUnlock,
  onDeleteLocal,
}) {
  const email = session?.user?.email || null;
  const panel = describeAccountPanel({
    accountsConfigured,
    email,
    syncEnabled,
    sessionResolved,
  });
  return <section className="pearl-account-panel" aria-label="Account and privacy" data-testid="pearl-account-panel" data-account-mode={panel.mode}>
    <header className="pearl-account-section">
      <p className="pearl-account-kicker">Account</p>
      <p className="pearl-account-status" data-testid="pearl-account-status">{panel.status}</p>
      {panel.mode === "unavailable" && (
        <div className="pearl-account-blocker" data-testid="pearl-account-blocker" role="status">
          <b>{panel.title}</b>
          <ol>
            {panel.nextSteps.map((step) => <li key={step}>{step}</li>)}
          </ol>
        </div>
      )}
      <div className="pearl-account-actions pearl-account-primary">
        {panel.canSignOut
          ? <button type="button" className="pearl-account-primary-btn" data-testid="pearl-account-sign-out" onClick={onSignOut}>Sign out</button>
          : panel.canSignIn
            ? <button type="button" className="pearl-account-primary-btn" data-testid="pearl-account-sign-in" onClick={onSignIn}>Sign in</button>
            : null}
      </div>
    </header>

    <section className="pearl-account-section" aria-label="Account sync">
      <p className="pearl-account-kicker">Sync</p>
      <p className="pearl-account-note">{panel.syncHint}</p>
      <div className="pearl-account-actions">
        <button
          type="button"
          aria-pressed={syncEnabled}
          disabled={!panel.canToggleSync}
          data-testid="pearl-account-sync"
          onClick={() => onToggleSync(!syncEnabled)}
        >
          {syncEnabled ? "Disable account sync" : "Enable account sync"}
        </button>
      </div>
    </section>

    {panel.showLocalPrivacy && (
      <section className="pearl-account-section" aria-label="This device">
        <p className="pearl-account-kicker">This device</p>
        <p className="pearl-account-note">
          Lock, unlock, or wipe only this browser profile. Passphrase lock is local — it is not account recovery.
        </p>
        <div className="pearl-account-actions">
          <button type="button" data-testid="pearl-account-lock" onClick={onLock}>Lock local Pearls</button>
          <button type="button" data-testid="pearl-account-unlock" onClick={onUnlock}>Unlock local Pearls</button>
          <button type="button" data-testid="pearl-account-delete-local" onClick={onDeleteLocal}>Delete local Pearl data</button>
        </div>
      </section>
    )}

    <p className="pearl-account-note">
      Account sync is opt-in and is not end-to-end vault encryption. Firm material defaults to local-only until you explicitly approve model, research, or share.
    </p>
  </section>;
}

const libraryObjects = [
  ["Actions", "Things Pearl can repeat.", { emit: "library", kind: "moves" }, "wide"],
  ["Processes", "Ways Pearl can carry work through several steps.", { emit: "library", kind: "functions" }],
  ["Context", "Material that shapes how Pearl responds.", { emit: "library", kind: "lenses" }],
  ["Shared tools", "Trusted reusable work from you or your team.", { emit: "packages" }, "wide"],
  ["Saved spaces", "Return to material you were working with.", { emit: "library", kind: "scenes" }],
  ["Activity", "Review, recover, or continue earlier work.", { emit: "tasks" }],
  ["Phrases", "Teach Pearl language you use.", { emit: "settings", panel: "vocabulary" }],
  ["Connections", "Choose where Pearl can work.", { emit: "settings", panel: "connectors" }],
  ["Account & privacy", "Sign in, sync consent, lock, and local wipe.", { emit: "settings", panel: "account" }],
  ["Encode anything", "Turn prompts, emails, PDFs, and Drive material into a Pearl.", { emit: "encode" }],
];

function ContextInspector({ items, onChange, onRemove }) {
  if (!items.length) return <p role="status">No working context yet. Drop material onto Pearl to add it without changing the source.</p>;
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
  if (!lenses.length) return <p role="status">No Lens atmosphere is active. Drag a Lens onto Pearl to apply it.</p>;
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
  if (!candidates.length) return <p role="status">No active candidates. Ask Pearl for alternatives to create a constellation.</p>;
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
  { group: "Learn", label: "Learn from chat", note: "Extract reusable cognition from a transcript", verb: "openTranscriptLearning", args: {} },
  { group: "Learn", label: "Capture lineage", note: "Save the contributing path as a Function", verb: "captureThreadAsFunction", args: {} },
  { group: "Learn", label: "Save page as Lens", note: "Preserve the page as bounded context", verb: "savePageAsLens", args: {} },
  { group: "Arrange", label: "Organize page", note: "Arrange current paper material coherently", verb: "organizePage", args: {} },
  { group: "Arrange", label: "Organize pearl", note: "Organize pearl dump into Moves → Functions → Lenses", verb: "organizePearl", args: {} },
  { group: "Arrange", label: "Counter pearl", note: "Breed an opposition pearl from the active pearl", verb: "createCounterPearl", args: {} },
  { group: "Arrange", label: "Evaluate with gauntlet", note: "Ground page/deck material in worn pearl lenses", verb: "evaluateWithGauntlet", args: { capturePage: true } },
  { group: "Arrange", label: "Fit frame", note: "Fit the full paper frame", verb: "fitPaper", args: {} },
  { group: "Arrange", label: "Zoom in", note: "Move closer without losing context", verb: "zoomPaper", args: { direction: "in" } },
  { group: "Arrange", label: "Zoom out", note: "Reveal more of the workspace", verb: "zoomPaper", args: { direction: "out" } },
  { group: "Preserve", label: "Export markdown", note: "Download selected or visible material", verb: "exportWorkspace", args: { format: "md" } },
  { group: "Preserve", label: "Export text", note: "Download a plain-text copy", verb: "exportWorkspace", args: { format: "txt" } },
  { group: "Preserve", label: "Share", note: "Share the selected journey or workspace", verb: "shareWorkspace", args: {} },
  // Hidden from first-use palette (still available via companion verbs): startWorkspaceTour, openRoleSetup
  { group: "Preserve", label: "Switch material", note: "Toggle the workspace material theme", verb: "toggleWorkspaceTheme", args: {} },
]);

function PearlActionPalette({ onRun }) {
  // Demote dense catalog from novice path — palette still exists for power users who emit it.
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

function startPearlCapabilityDemoFromShell() {
  window.dispatchEvent(new CustomEvent("lens:companion-expand"));
  const tryRun = () => {
    const runtime = window.__lensOrbRuntime;
    if (!runtime?.run) return false;
    void runtime.run("watch what pearl can do", { mode: "agent" });
    return true;
  };
  if (tryRun()) return;
  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    if (tryRun() || attempts > 48) window.clearInterval(timer);
  }, 100);
}

function PearlWelcome({ onAsk, onDismiss, onShellNav, onPlayDemo }) {
  return <section className="pearl-welcome" aria-label="Welcome to Pearl" data-companion-first="true" data-zero-demand="true">
    {/* Primary shell nav stays hit-testable on first-run — welcome must not orphan Scene/Install. */}
    <div className="pearl-welcome-shell-nav">
      <PearlShellNav activeId="reef" onNavigate={(screen) => {
        onDismiss?.();
        onShellNav?.(screen);
      }} />
    </div>
    <button type="button" className="pearl-welcome-mark" aria-label="Companion Pearl" onClick={onAsk}>
      <PhysicalPearl variant="primary" state="idle" size={46} decorative />
    </button>
    <p className="pearl-welcome-kicker">Companion Pearl</p>
    <h1>Just talk.</h1>
    <p>Say what you want. Your Companion does the rest.</p>
    <div className="pearl-welcome-actions">
      <button type="button" className="pearl-welcome-primary" data-testid="welcome-talk" onClick={onAsk}>Talk to Companion</button>
      <button type="button" className="pearl-welcome-secondary" data-testid="welcome-play-demo" onClick={() => {
        onDismiss?.();
        (onPlayDemo || startPearlCapabilityDemoFromShell)();
      }}>Watch what Pearl can do</button>
    </div>
    <button type="button" className="pearl-welcome-dismiss" data-testid="welcome-skip" onClick={onDismiss}>Skip</button>
  </section>;
}

const GUIDE_TRY_COMMANDS = new Set([
  "open a new scene",
  "show me the scene controls",
  "show my saved library",
  "install the extension",
  "what is stored here?",
  "encode anything",
  "open account and privacy",
]);

function PearlGuidePanel({ onClose, onTry }) {
  return <aside className="pearl-guide-panel" role="dialog" aria-label="How Pearl works">
    <header>
      <b>How Pearl works</b>
      <button type="button" onClick={onClose}>Close</button>
    </header>
    {guideSectionsFor("app").map((section, index) => <section key={section.id} style={{ "--guide-index": index }}>
      <h2>{section.title}</h2>
      <p>{section.summary}</p>
      <ul>
        {section.items.map((item) => <li key={item.id}>
          <b>{item.label}</b>
          <span>{item.detail}</span>
          {item.gesture && <i>{item.gesture}</i>}
          {item.command && !GUIDE_TRY_COMMANDS.has(item.command) && <i>Say “{item.command}”</i>}
          {item.command && GUIDE_TRY_COMMANDS.has(item.command) && onTry && <button type="button" onClick={() => onTry(item.command)}>
            Try “{item.command.replace(/\?$/, "")}”
          </button>}
        </li>)}
      </ul>
    </section>)}
  </aside>;
}

function LibraryHome({
  route,
  scenes,
  onCreateScene,
  onOpenGuide,
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
  onOpenStudio,
  onWearPearl,
}) {
  const [query, setQuery] = useState("");
  const continuationCount = continuationMaterialCount(extensionHandoff);
  const pearlCount = extensionHandoff?.semanticOrbs?.length || 0;
  const activePearl = extensionHandoff?.semanticOrbs?.find((entry) => entry.id === extensionHandoff?.activeSemanticOrbId)
    || extensionHandoff?.semanticOrbs?.[0];
  const isRoot = isReefHomePath(route.path);
  const reefPearls = useMemo(() => collectReefPearls(scenes), [scenes]);
  const firstUse = isRoot && scenes.length === 0 && reefPearls.length === 0 && continuationCount === 0 && !route.handoff;
  const emptyLibrary = !isRoot && scenes.length === 0 && reefPearls.length === 0;
  const sectionLabel = route.section && route.section !== "library"
    ? route.section[0].toUpperCase() + route.section.slice(1)
    : null;
  const title = sectionLabel
    || (firstUse ? "Your Reef"
      : emptyLibrary ? "Reef — empty for now"
        : "Reef");
  const visibleObjects = libraryObjects.filter(([name, description]) =>
    `${name} ${description}`.toLowerCase().includes(query.trim().toLowerCase())
  );
  const activeShellNavId = route.section === "packages" ? "packages"
    : route.section === "settings" ? "settings"
      : route.path === "/install" ? "install"
        : "reef";
  const handleShellNav = (screen) => {
    if (screen.id === "reef") {
      navigateHome();
      return;
    }
    if (screen.id === "scene") {
      onCreateScene?.({ source: "shell-nav" });
      return;
    }
    if (screen.id === "install") {
      navigate("/install");
      return;
    }
    if (screen.emit) {
      onView?.(screen.emit, screen.id === "settings" ? { panel: "account" } : undefined);
      if (screen.path) navigate(screen.path);
      return;
    }
    if (screen.path) navigate(screen.path);
  };
  return <main className="orb-library-home orb-reef-home" data-reef-home="true" data-companion-first="true" data-zero-demand="true" aria-label="Reef — home of pearls">
    <header className="pearl-reef-chrome" data-testid="reef-chrome" aria-label="Reef navigation">
      <button type="button" data-testid="reef-home" onClick={() => navigateHome()}>Reef</button>
      <span>{sectionLabel ? `${sectionLabel} · saved tools & settings` : "Reef · where pearls live"}</span>
      <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("lens:companion-expand"))}>Companion</button>
      <button
        type="button"
        className="pearl-play-demo"
        data-testid="reef-play-demo"
        onClick={startPearlCapabilityDemoFromShell}
      >
        Watch what Pearl can do
      </button>
      <PearlShellNav activeId={activeShellNavId} onNavigate={handleShellNav} />
    </header>
    {/* Intro only when the shelf is empty — never stack a hero “Reef” title over pearl names. */}
    {(firstUse || emptyLibrary) && !reefPearls.length && <section className="orb-home-intro orb-reef-kicker" data-testid="reef-next-step">
      <div className="orb-kicker">Home of pearls</div>
      <h1>{title}</h1>
      <p>Pearls form, play, and expand here. Talk to your Companion — it does the rest.</p>
      <div className="orb-home-intro-actions">
        <button type="button" className="orb-primary" data-testid="reef-talk" onClick={() => window.dispatchEvent(new CustomEvent("lens:companion-expand"))}>Talk to Companion</button>
        <button type="button" className="orb-secondary" data-testid="reef-play-demo-intro" onClick={startPearlCapabilityDemoFromShell}>Watch what Pearl can do</button>
      </div>
    </section>}
    {isRoot && (continuationCount > 0 || route.handoff) && <section className="orb-continuation" aria-label="Continue extension work">
      <div>
        <small>{extensionHandoff?.connected ? "Extension Companion connected" : handoffStatus === "loading" ? "Checking the page Companion" : "Waiting for the page Companion"}</small>
        <h2>{continuationCount
          ? pearlCount
            ? `${activePearl?.name || "Your pearl"} is ready to continue`
            : `${continuationCount} ${continuationCount === 1 ? "piece" : "pieces"} ready to become a pearl`
          : route.handoff
            ? (extensionHandoff?.reason === "missing-extension-id"
              ? "This build cannot verify the browser extension"
              : "No working set arrived")
            : "Open this space from the Pearl on any page"}</h2>
        <p>{continuationCount
          ? `${pearlCount ? `${pearlCount} ${pearlCount === 1 ? "pearl remains" : "pearls remain"}` : "This captured material remains"} source-linked. Continue the capsule into one Scene to refine, use, insert, or arrange it without losing provenance.`
          : route.handoff
            ? (extensionHandoff?.reason === "missing-extension-id"
              ? "Trusted continuation needs VITE_LENS_EXTENSION_ID in this web build so the page can ask the installed Pearl extension for the working set. Rebuild with that id, or open Arrange in full Scene from the extension again."
              : "The link opened, but no capture, queued action, Lens, candidate, or saved pearl was verified. Return to the extension and choose Arrange in full Scene, or retry after reconnecting it.")
            : "On a page, ask the Companion to arrange, compare, edit deeply, inspect history, or open a full Scene. It will carry the explicit working set here."}</p>
      </div>
      {continuationCount
        ? <button className="orb-primary" type="button" onClick={onContinueHandoff}>Continue this work</button>
        : route.handoff
          ? <button className="orb-secondary" type="button" disabled={handoffStatus === "loading"} onClick={onRetryHandoff}>{handoffStatus === "loading" ? "Checking…" : "Retry handoff"}</button>
        : extensionHandoff?.connected
          ? <button className="orb-secondary" type="button" onClick={() => onView("library")}>Open saved library</button>
          : <a className="orb-continuation-setup" href="/install" onClick={(event) => { event.preventDefault(); navigate("/install"); }}>Extension setup</a>}
    </section>}
    <section className={`orb-recent-orbit orb-reef${reefPearls.length ? " orb-reef-populated" : ""}`} aria-label="Pearl canvas">
      <p className="orb-reef-section-label">{reefPearls.length || scenes.length ? "Your pearls — drag onto Companion to wear, or open one" : "Empty canvas — ask Companion to make a pearl"}</p>
      <div className="orb-reef-shelf" data-testid="reef-shelf" data-pearl-shelf="true">
        {reefPearls.map((pearl) => (
          <div
            key={pearl.id}
            className="reef-pearl"
            data-reef-pearl={pearl.id}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "copyMove";
              event.dataTransfer.setData(
                "application/x-lens-pearl",
                JSON.stringify({ id: pearl.id, name: pearl.name, fromGauntlet: false }),
              );
              event.dataTransfer.setData("text/plain", pearl.id);
            }}
            onContextMenu={(event) => {
              // Right-click still reaches Scene spatial play when needed.
              event.preventDefault();
              if (pearl.sceneId) navigate(`/scene/${encodeURIComponent(pearl.sceneId)}`);
            }}
            title={`${pearl.name} — drag onto Companion gauntlet to wear · click opens Studio`}
          >
            <button
              type="button"
              className="reef-pearl-open"
              data-testid="reef-pearl-open"
              onClick={() => onOpenStudio?.(pearl)}
              aria-label={`${pearl.name}, open pearl explorer`}
            >
              <PhysicalPearl
                variant="semantic"
                state="idle"
                size={36}
                aesthetic={pearl.aesthetic || null}
                decorative
              />
              <b>{pearl.name}</b>
              <small>Drag to wear · open Studio</small>
            </button>
            <button
              type="button"
              className="reef-pearl-wear"
              data-testid="reef-pearl-wear"
              onClick={() => {
                if (onWearPearl) onWearPearl(pearl);
                else if (globalThis.__lensOrbRuntime?.execute) {
                  void globalThis.__lensOrbRuntime.execute(
                    [{ verb: "wearPearl", args: { id: pearl.id } }],
                    { title: "Wear" },
                  );
                }
              }}
              aria-label={`Wear ${pearl.name} on the gauntlet`}
            >
              Wear
            </button>
          </div>
        ))}
        {!reefPearls.length && scenes.slice(0, 2).map((scene, index) => <button
          key={scene.id}
          type="button"
          className={`recent-scene scene-${String.fromCharCode(97 + (index % 3))}`}
          onClick={() => navigate(`/scene/${encodeURIComponent(scene.id)}`)}
        >
          <i />{scene.name || "Untitled workspace"}
          <small>Workspace · {(scene.items?.length || 0) + (scene.nodes?.length || 0)} items</small>
        </button>)}
      </div>
    </section>
    {activeView && <aside className="orb-emitted-library" aria-label={`${activeView} from Pearl`}>
      <div>
        <span>{activeView === "library" ? "Reef" : activeView}</span>
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
              {visibleObjects.map(([name, description, target]) => <button type="button" key={name} onClick={() => {
                const emit = target?.emit || "library";
                onView(emit === "library" ? "library" : emit, target);
              }}>
                <i /> <b>{name}</b><small>{description}</small>
              </button>)}
              {!visibleObjects.length && <span role="status">No library areas match “{query}”.</span>}
            </nav>
          </>}
    </aside>}
  </main>;
}

function SceneStage({
  scene,
  view = "Stage",
  onMaterialDrop,
  onMaterialMove,
  onMaterialDelete,
  onContextAdd,
  semanticOrbActions,
  onOpenStudio,
  onOpenGuide,
}) {
  const [selectedMaterialId, setSelectedMaterialId] = useState(null);
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
  const sceneItemIds = useMemo(() => (scene?.items || []).map((item) => item.id).filter(Boolean), [scene]);

  useEffect(() => {
    function onKey(event) {
      if (event.target?.closest?.("input,textarea,select,[contenteditable='true']")) return;
      if ((event.key === "Delete" || event.key === "Backspace") && selectedMaterialId) {
        event.preventDefault();
        onMaterialDelete?.(selectedMaterialId);
        setSelectedMaterialId(null);
      }
    }
    function onChromeDelete() {
      if (!selectedMaterialId) return;
      onMaterialDelete?.(selectedMaterialId);
      setSelectedMaterialId(null);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("lens:scene-delete-selection", onChromeDelete);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("lens:scene-delete-selection", onChromeDelete);
    };
  }, [selectedMaterialId, onMaterialDelete]);

  return <main
    className="orb-black-stage"
    aria-label={`Scene ${scene?.name || scene?.id || "untitled"}`}
    data-stage-view={view.toLowerCase()}
    data-testid="scene-stage-surface"
    tabIndex={0}
    onDoubleClick={(event) => {
      if (event.target.closest?.("article,button,input,.semantic-orb-capsule,.pearl-scene-chrome")) return;
      semanticOrbActions?.create?.({
        placement: { x: event.clientX - innerWidth / 2, y: event.clientY - innerHeight / 2 },
      });
    }}
    onDragOver={(event) => {
      if (shouldAcceptSceneStageTransfer(event.dataTransfer?.types || [])) {
        event.preventDefault();
        event.dataTransfer.dropEffect = event.altKey ? "copy" : "move";
      }
    }}
    onPaste={async (event) => {
      if (event.target?.closest?.("input,textarea,select,[contenteditable='true']")) return;
      const text = event.clipboardData?.getData("text/plain")?.trim();
      const files = [...(event.clipboardData?.files || [])];
      if (!text && !files.length) return;
      event.preventDefault();
      const worldPoint = { x: 0, y: -24 };
      for (const file of files) {
        try {
          const extracted = await extractTextFromFile(file);
          const item = materialFromIngestedText({
            text: extracted.text,
            filename: extracted.filename,
            mime: extracted.mime,
            sourceKind: "file",
          });
          if (item) onMaterialDrop?.(item, worldPoint);
        } catch {
          /* skip unreadable clipboard files */
        }
      }
      if (text) {
        const item = materialFromIngestedText({ text, sourceKind: "paste" });
        if (item) onMaterialDrop?.(item, worldPoint);
      }
    }}
    onDrop={async (event) => {
      event.preventDefault();
      const worldPoint = { x: event.clientX - innerWidth / 2, y: event.clientY - innerHeight / 2 };
      const files = [...(event.dataTransfer?.files || [])];
      if (files.length) {
        for (const [index, file] of files.entries()) {
          try {
            const extracted = await extractTextFromFile(file);
            const item = materialFromIngestedText({
              text: extracted.text,
              filename: extracted.filename,
              mime: extracted.mime,
              sourceKind: "file",
              id: `ingest:file:${file.name}:${file.lastModified || Date.now()}:${index}`,
            });
            if (item) onMaterialDrop?.(item, { x: worldPoint.x + index * 24, y: worldPoint.y + index * 24 });
          } catch (reason) {
            const item = materialFromIngestedText({
              text: `[Could not read ${file.name}: ${reason?.message || "unsupported"}]`,
              filename: file.name,
              sourceKind: "file",
            });
            if (item) onMaterialDrop?.(item, worldPoint);
          }
        }
        return;
      }
      const plain = event.dataTransfer?.getData("text/plain")?.trim();
      const portable = event.dataTransfer?.getData("application/x-lens-object");
      if (!portable && plain) {
        const item = materialFromIngestedText({ text: plain, sourceKind: "drop-text" });
        if (item) onMaterialDrop?.(item, worldPoint);
        return;
      }
      if (!portable) return;
      try {
        const source = JSON.parse(portable);
        const resolved = resolveSceneMaterialDrop({
          source,
          sceneId: scene?.id,
          sceneItemIds,
          altKey: event.altKey,
          worldPoint,
        });
        if (resolved.action === "move") onMaterialMove?.(resolved.id, resolved.worldPoint);
        else if (resolved.action === "materialize") onMaterialDrop?.(resolved.item, resolved.worldPoint);
      } catch {
        /* only typed Lens material enters a Scene */
      }
    }}
  >
    {!materials.length && !(scene?.semanticOrbs || []).filter((orb) => !orb.archived).length
      ? <section className="orb-stage-empty" data-testid="scene-empty" data-zero-demand="true">
          <h1>Nothing here yet</h1>
          <p>Ask your Companion what you want — pearls appear here to play with.</p>
          <div className="orb-stage-empty-actions">
            <button type="button" className="orb-primary" onClick={() => window.dispatchEvent(new CustomEvent("lens:companion-expand"))}>Talk to Companion</button>
          </div>
        </section>
      : view === "Table"
        ? <table className="orb-stage-table"><thead><tr><th>Material</th><th>Kind</th><th>Lineage</th></tr></thead><tbody>
            {materials.map((material) => <tr
              key={material.id}
              data-selected={selectedMaterialId === material.id ? "true" : undefined}
              onClick={() => setSelectedMaterialId(material.id)}
            ><td>{String(material.label).slice(0, 180)}</td><td>{material.materialKind}</td><td>{material.parentId || material.sourceId || "root"}</td></tr>)}
          </tbody></table>
        : <section className={`orb-stage-materials view-${view.toLowerCase()}`} aria-label={`${view} materials`}>
            {materials.map((material, index) => <article
              key={material.id}
              draggable="true"
              data-material-id={material.id}
              data-material-kind={material.materialKind}
              data-selected={selectedMaterialId === material.id ? "true" : undefined}
              onClick={(event) => {
                if (event.target.closest("button")) return;
                setSelectedMaterialId(material.id);
              }}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "copyMove";
                event.dataTransfer.setData("text/plain", String(material.label));
                event.dataTransfer.setData("application/x-lens-object", JSON.stringify({
                  ...material,
                  sceneId: scene?.id,
                }));
              }}
              style={view === "Stage" ? {
                "--material-x": `${50 + Math.max(-42, Math.min(42, (Number(material.x) || index * 80) / 20))}%`,
                "--material-y": `${48 + Math.max(-35, Math.min(35, (Number(material.y) || index * 60) / 24))}%`,
              } : undefined}
            >
              <small>{material.materialKind}</small>
              <p>{String(material.label).slice(0, 420)}</p>
              {view === "Timeline" && <time>{material.createdAt || material.updatedAt || `Step ${index + 1}`}</time>}
              <button type="button" className="orb-material-context-action" onClick={() => onContextAdd(material)}>Add to working memory</button>
              <button type="button" className="orb-material-context-action" onClick={() => semanticOrbActions?.create?.({
                material,
                placement: { x: Number(material.x) || index * 64, y: Number(material.y) || index * 48 },
              })}>Make pearl</button>
              <button type="button" className="orb-material-context-action danger" onClick={() => {
                onMaterialDelete?.(material.id);
                if (selectedMaterialId === material.id) setSelectedMaterialId(null);
              }}>Delete</button>
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

function PearlSceneChrome({
  sceneName,
  outputFrameOpen,
  selectedCount = 0,
  onHome,
  onToggleFrame,
  onPlacePearl,
  onDeleteSelection,
  onOpenCompanionHint,
}) {
  return <header className="pearl-scene-chrome" data-testid="pearl-scene-chrome" data-companion-first="true" data-zero-demand="true" aria-label="Scene navigation">
    <div className="pearl-scene-chrome-primary">
      <button type="button" data-testid="scene-home" onClick={onHome}>← Reef</button>
      <div className="pearl-scene-chrome-title">
        <span>{outputFrameOpen ? "Output Frame" : "Playing with pearls"}</span>
        <b>{sceneName || "Untitled workspace"}</b>
        <small>{outputFrameOpen
          ? "Optional writing surface — Companion still works. Esc returns to pearls."
          : "Talk to Companion, place a pearl, or open Studio on a pearl."}</small>
      </div>
    </div>
    <div className="pearl-scene-chrome-actions">
      <button type="button" data-testid="scene-ask-pearl" className="pearl-scene-primary-action" onClick={onOpenCompanionHint}>Talk to Companion</button>
      {!outputFrameOpen && <button type="button" data-testid="scene-place-pearl" onClick={onPlacePearl}>New pearl</button>}
      <button
        type="button"
        data-testid="scene-toggle-frame"
        className="pearl-scene-secondary-action"
        aria-pressed={outputFrameOpen}
        onClick={onToggleFrame}
      >
        {outputFrameOpen ? "Back to Scene" : "Output Frame"}
      </button>
      <button
        type="button"
        className="danger"
        data-testid="scene-delete"
        onClick={onDeleteSelection}
        title="Delete selected item (or press Delete / Backspace)"
      >Delete</button>
    </div>
  </header>;
}

export default function OrbUniverseShell({ StageComponent }) {
  const route = useRoute();
  const supaAuth = useSupabaseSession();
  const [authOpen, setAuthOpen] = useState(() => isSupabaseConfigured() && Boolean(supaAuth.bootAuthError));
  const [authBootError, setAuthBootError] = useState(supaAuth.bootAuthError);
  const [syncEnabled, setSyncEnabled] = useState(() => boardSyncEnabled());
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
  const [emittedView, setEmittedView] = useState(() => {
    if (route.kind === "library" && route.section === "settings") return "settings";
    if (route.kind === "library" && route.section === "packages") return "packages";
    if (route.kind === "library" && route.section === "tasks") return "tasks";
    return null;
  });
  const [settingsPanel, setSettingsPanel] = useState(() => {
    const query = new URLSearchParams(typeof location !== "undefined" ? location.search : "");
    if (query.get("vocabulary")) return "vocabulary";
    if (query.get("connectors")) return "connectors";
    if (query.get("sync")) return "sync";
    return "account";
  });
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
  const [guideOpen, setGuideOpen] = useState(false);
  const [welcomeDismissed, setWelcomeDismissed] = useState(() => readJson(PEARL_WELCOME_STORAGE_KEY, null)?.dismissed === true);
  const [companionExpanded, setCompanionExpanded] = useState(false);
  const [sceneView, setSceneView] = useState("Stage");
  const [outputToolsOpen, setOutputToolsOpen] = useState(false);
  const [outputFrameOpen, setOutputFrameOpen] = useState(() => wantsOutputFrameFromSearch(location.search));
  orbRef.current = orb;

  const openEmittedView = useCallback((view, meta = null) => {
    if (view === "taste") {
      const fromRuntime = typeof window !== "undefined" ? window.__lensOrbRuntime?.candidates?.() : null;
      const seeded = Array.isArray(meta?.candidates) ? meta.candidates : null;
      const next = (seeded?.length ? seeded : null) || (fromRuntime?.length ? fromRuntime : null);
      if (next?.length) {
        setOrb((value) => createOrbState({ ...value, candidates: next }));
      }
    }
    setEmittedView(view);
    if (meta?.panel) setSettingsPanel(meta.panel);
    if (view === "settings" && !meta?.panel) setSettingsPanel("account");
  }, []);

  useEffect(() => {
    if (supaAuth.passwordRecovery || supaAuth.bootAuthError) {
      setAuthOpen(true);
      if (supaAuth.bootAuthError) setAuthBootError(supaAuth.bootAuthError);
    }
  }, [supaAuth.passwordRecovery, supaAuth.bootAuthError]);

  useEffect(() => {
    if (route.kind === "library" && route.section === "settings") openEmittedView("settings", { panel: settingsPanel || "account" });
    else if (route.kind === "library" && route.section === "packages") openEmittedView("packages");
    else if (route.kind === "library" && route.section === "tasks") openEmittedView("tasks");
  }, [route.kind, route.section, openEmittedView, settingsPanel]);

  useEffect(() => {
    setSceneView("Stage");
    // Scene entry never silently focuses the paper — only explicit ?frame= / audit URLs.
    setOutputFrameOpen(wantsOutputFrameFromSearch(location.search));
    setOutputToolsOpen(false);
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

  const openGuide = useCallback(() => {
    try {
      localStorage.setItem(PEARL_GUIDE_STORAGE_KEY, JSON.stringify(recordPearlGuideOpen(readJson(PEARL_GUIDE_STORAGE_KEY, null))));
    } catch {
      /* guide open still works without persistence */
    }
    setGuideOpen(true);
  }, []);

  useEffect(() => {
    const open = () => setGuideOpen(true);
    window.addEventListener("lens:open-pearl-guide", open);
    return () => window.removeEventListener("lens:open-pearl-guide", open);
  }, []);

  useEffect(() => {
    const openTaste = (event) => {
      openEmittedView("taste", { candidates: event?.detail?.candidates || null });
    };
    window.addEventListener("lens:open-taste-constellation", openTaste);
    return () => window.removeEventListener("lens:open-taste-constellation", openTaste);
  }, [openEmittedView]);

  useEffect(() => {
    registerDirectorVerbs({
      openAuth: async () => {
        if (!isSupabaseConfigured()) {
          const blocker = describeAccountsUnavailable();
          openEmittedView("settings", { panel: "account" });
          setPrivacyNotice({ title: blocker.title, detail: blocker.message });
          return {
            effectId: `shell-auth-blocker:${Date.now()}`,
            effects: ["auth-blocker"],
            executionCode: "needs-credentials",
            message: blocker.message,
          };
        }
        setAuthOpen(true);
        return { effectId: `shell-auth-open:${Date.now()}`, effects: ["auth-opened"] };
      },
      signOut: async () => {
        if (!isSupabaseConfigured()) {
          const blocker = describeAccountsUnavailable();
          openEmittedView("settings", { panel: "account" });
          return {
            effectId: `shell-sign-out-blocker:${Date.now()}`,
            effects: ["auth-blocker"],
            executionCode: "needs-credentials",
            message: blocker.message,
          };
        }
        await getSupabase()?.auth.signOut({ scope: "local" }).catch(() => {});
        return { effectId: `shell-sign-out:${Date.now()}`, effects: ["signed-out"] };
      },
      navigateHome: async () => {
        navigateHome();
        return { effectId: `shell-home:${Date.now()}`, effects: ["navigated-home"] };
      },
      navigateBack: async () => {
        navigateBackOrHome();
        return { effectId: `shell-back:${Date.now()}`, effects: ["navigated-back"] };
      },
      openLibrary: async () => {
        navigate("/library");
        return { effectId: `shell-library:${Date.now()}`, effects: ["opened-library"] };
      },
      openToolbox: async () => {
        navigate("/toolbox");
        return { effectId: `shell-toolbox:${Date.now()}`, effects: ["opened-toolbox"] };
      },
      openSettings: async (a) => {
        openEmittedView("settings", { panel: a?.panel || "account" });
        return { effectId: `shell-settings:${Date.now()}`, effects: ["settings-opened"] };
      },
      openEncodeAnything: async () => {
        openEmittedView("encode");
        return { effectId: `shell-encode:${Date.now()}`, effects: ["encode-opened"] };
      },
      openPackageRegistry: async () => {
        navigate("/packages");
        openEmittedView("packages");
        return { effectId: `shell-packages:${Date.now()}`, effects: ["packages-opened"] };
      },
      openExtensionDownload: async () => {
        navigate("/install");
        return { effectId: `shell-install:${Date.now()}`, effects: ["install-opened"] };
      },
      closeSurface: async () => {
        setEmittedView(null);
        setGuideOpen(false);
        setCompanionExpanded(false);
        return { effectId: `shell-close:${Date.now()}`, effects: ["surface-closed"] };
      },
    });
  }, [openEmittedView]);

  const openSceneRouteRef = useRef(null);
  useEffect(() => {
    function onOpenScene(event) {
      const detail = event?.detail && typeof event.detail === "object" ? event.detail : {};
      openSceneRouteRef.current?.({
        withOutputFrame: detail.withOutputFrame === true,
        source: detail.source || "lens:shell-open-scene",
      });
    }
    document.addEventListener("lens:shell-open-scene", onOpenScene);
    return () => document.removeEventListener("lens:shell-open-scene", onOpenScene);
  }, []);

  const decideApprovalRef = useRef(null);
  const handleShellEscape = useCallback(() => {
    const action = nextEscapeAction({
      approvalPending: Boolean(pendingApproval),
      companionExpanded,
      emittedView,
      outputFrameOpen,
      cursorMode,
      guideOpen,
      welcomeOpen: !welcomeDismissed && route.path === "/" && (sceneWorkspace.scenes || []).length === 0,
      installRoute: route.kind === "install",
      studioOpen: false,
      sceneRoute: route.kind === "stage",
    });
    if (action === "cancelApproval") {
      decideApprovalRef.current?.("reject");
      return;
    }
    if (action === "collapseCompanion") {
      setCompanionExpanded(false);
      window.dispatchEvent(new CustomEvent("lens:companion-collapse"));
      return;
    }
    if (action === "closeEmission") {
      setEmittedView(null);
      return;
    }
    if (action === "closeOutputFrame") {
      setOutputFrameOpen(false);
      setOutputToolsOpen(false);
      return;
    }
    if (action === "exitCursor") {
      setCursorModeState(false);
      return;
    }
    if (action === "closeGuide") {
      setGuideOpen(false);
      return;
    }
    if (action === "dismissWelcome") {
      try {
        localStorage.setItem(PEARL_WELCOME_STORAGE_KEY, JSON.stringify({ dismissed: true, at: new Date().toISOString() }));
      } catch { /* ignore */ }
      setWelcomeDismissed(true);
      return;
    }
    if (action === "leaveInstall" || action === "leaveScene") {
      navigateHome();
    }
  }, [pendingApproval, companionExpanded, emittedView, outputFrameOpen, cursorMode, guideOpen, welcomeDismissed, route.path, route.kind, sceneWorkspace.scenes]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== "Escape") return;
      if (event.target?.closest?.("input,textarea,[contenteditable=true]")) return;
      event.preventDefault();
      handleShellEscape();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleShellEscape]);

  useEffect(() => {
    const onShellAction = (event) => {
      const action = event.detail?.action;
      if (action === "openAuth") {
        if (!isSupabaseConfigured()) {
          const blocker = describeAccountsUnavailable();
          openEmittedView("settings", { panel: "account" });
          setPrivacyNotice({ title: blocker.title, detail: blocker.message });
        } else {
          setAuthOpen(true);
        }
      }
      if (action === "signOut") {
        getSupabase()?.auth.signOut({ scope: "local" }).catch(() => {});
        setAuthOpen(false);
      }
      if (action === "navigateHome") navigateHome();
      if (action === "navigateBack") navigateBackOrHome();
      if (action === "openSettings") openEmittedView("settings", { panel: event.detail?.panel || "account" });
      if (action === "openEncode") openEmittedView("encode");
      if (action === "openPackages" || action === "openPackageRegistry") {
        navigate("/packages");
        openEmittedView("packages");
      }
      if (action === "openInstall" || action === "openExtensionDownload") {
        navigate("/install");
      }
      if (action === "openOutputFrame" || action === "openPageCanvas") {
        setOutputFrameOpen(true);
      }
      if (action === "closeOutputFrame" || action === "closePageCanvas") {
        setOutputFrameOpen(false);
        setOutputToolsOpen(false);
      }
      if (action === "closeSurface") {
        setEmittedView(null);
        setGuideOpen(false);
        setCompanionExpanded(false);
      }
      if (action === "openLibrary") {
        navigate("/library");
      }
      if (action === "openToolbox") {
        navigate("/toolbox");
      }
    };
    window.addEventListener(SHELL_ACTION_EVENT, onShellAction);
    return () => window.removeEventListener(SHELL_ACTION_EVENT, onShellAction);
  }, [openEmittedView, route.kind]);

  // Zero-demand: no quick-action walls on the Mother Pearl. Reach overflow via chat intent.
  const pearlNavQuickActions = useMemo(() => [], []);

  const dismissWelcome = useCallback(() => {
    try {
      localStorage.setItem(PEARL_WELCOME_STORAGE_KEY, JSON.stringify({ dismissed: true, at: new Date().toISOString() }));
    } catch {
      /* dismissal still applies for this session */
    }
    setWelcomeDismissed(true);
  }, []);

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
        if (!execution) {
          detail.reject?.(new Error("Create or open a workspace first — the pearl could not be placed."));
          return;
        }
        detail.resolve?.({
          completed: true,
          id: execution.result?.id || null,
          result: execution.result,
          object: execution.result?.object || null,
        });
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
    const recognizer = createTripleSpaceRecognizer({ intervalMs: ORB_CURSOR_TRIPLE_SPACE_MS });
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
      sequenceTimer = window.setTimeout(clearSequence, ORB_CURSOR_TRIPLE_SPACE_MS + 40);
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
    if (/^(?:help|guide|how do i\b.*|how does (?:this|pearl) work\??|what can (?:you|pearl) do\??|show me how\b.*|open (?:the )?(?:pearl )?(?:guide|help))$/i.test(recorded.entry.normalized)) {
      openGuide();
      next = transitionOrb(next, "executing", { taskId: recorded.entry.id, commandId: "openPearlGuide" });
      setOrb(transitionOrb(next, "completed", { taskId: recorded.entry.id, commandId: "openPearlGuide", effectId: `guide:${Date.now()}` }));
      return;
    }
    if (/^(?:sign(?: me)? in|log(?: me)? in|open (?:sign[- ]?in|account))$/i.test(recorded.entry.normalized)) {
      if (!isSupabaseConfigured()) {
        const blocker = describeAccountsUnavailable();
        openEmittedView("settings", { panel: "account" });
        setPrivacyNotice({ title: blocker.title, detail: blocker.message });
      } else {
        setAuthOpen(true);
      }
      next = transitionOrb(next, "executing", { taskId: recorded.entry.id, commandId: "openAuth" });
      setOrb(transitionOrb(next, "completed", { taskId: recorded.entry.id, commandId: "openAuth", effectId: `auth:${Date.now()}` }));
      return;
    }
    if (/^(?:sign(?: me)? out|log(?: me)? out)$/i.test(recorded.entry.normalized)) {
      getSupabase()?.auth.signOut({ scope: "local" }).catch(() => {});
      next = transitionOrb(next, "executing", { taskId: recorded.entry.id, commandId: "signOut" });
      setOrb(transitionOrb(next, "completed", { taskId: recorded.entry.id, commandId: "signOut", effectId: `signout:${Date.now()}` }));
      return;
    }
    const shellNavIntent = matchShellNavigationIntent(recorded.entry.normalized);
    if (shellNavIntent === "navigateHome") {
      navigateHome();
      next = transitionOrb(next, "executing", { taskId: recorded.entry.id, commandId: "navigateHome" });
      setOrb(transitionOrb(next, "completed", { taskId: recorded.entry.id, commandId: "navigateHome", effectId: `home:${Date.now()}` }));
      return;
    }
    if (shellNavIntent === "navigateBack") {
      navigateBackOrHome();
      next = transitionOrb(next, "executing", { taskId: recorded.entry.id, commandId: "navigateBack" });
      setOrb(transitionOrb(next, "completed", { taskId: recorded.entry.id, commandId: "navigateBack", effectId: `back:${Date.now()}` }));
      return;
    }
    if (shellNavIntent === "openLibrary") {
      navigate("/library");
      next = transitionOrb(next, "executing", { taskId: recorded.entry.id, commandId: "openLibrary" });
      setOrb(transitionOrb(next, "completed", { taskId: recorded.entry.id, commandId: "openLibrary", effectId: `library:${Date.now()}` }));
      return;
    }
    if (shellNavIntent === "openToolbox") {
      navigate("/toolbox");
      next = transitionOrb(next, "executing", { taskId: recorded.entry.id, commandId: "openToolbox" });
      setOrb(transitionOrb(next, "completed", { taskId: recorded.entry.id, commandId: "openToolbox", effectId: `toolbox:${Date.now()}` }));
      return;
    }
    if (shellNavIntent === "openSettings") {
      openEmittedView("settings", { panel: "account" });
      next = transitionOrb(next, "executing", { taskId: recorded.entry.id, commandId: "openSettings" });
      setOrb(transitionOrb(next, "completed", { taskId: recorded.entry.id, commandId: "openSettings", effectId: `settings:${Date.now()}` }));
      return;
    }
    if (shellNavIntent === "openEncodeAnything"
      || /^(?:make (?:this|it) a pearl|import (?:this |my )?(?:chat|transcript|pdf|docs?|material)|compile (?:this )?(?:automation|prompt))$/i.test(recorded.entry.normalized)) {
      openEmittedView("encode");
      next = transitionOrb(next, "executing", { taskId: recorded.entry.id, commandId: "openEncodeAnything" });
      setOrb(transitionOrb(next, "completed", { taskId: recorded.entry.id, commandId: "openEncodeAnything", effectId: `encode:${Date.now()}` }));
      return;
    }
    if (shellNavIntent === "openPackageRegistry") {
      navigate("/packages");
      openEmittedView("packages");
      next = transitionOrb(next, "executing", { taskId: recorded.entry.id, commandId: "openPackageRegistry" });
      setOrb(transitionOrb(next, "completed", { taskId: recorded.entry.id, commandId: "openPackageRegistry", effectId: `packages:${Date.now()}` }));
      return;
    }
    if (shellNavIntent === "openExtensionDownload") {
      navigate("/install");
      next = transitionOrb(next, "executing", { taskId: recorded.entry.id, commandId: "openExtensionDownload" });
      setOrb(transitionOrb(next, "completed", { taskId: recorded.entry.id, commandId: "openExtensionDownload", effectId: `install:${Date.now()}` }));
      return;
    }
    if (shellNavIntent === "openScene") {
      next = transitionOrb(next, "executing", { taskId: recorded.entry.id, commandId: "openScene" });
      setOrb(transitionOrb(next, "completed", { taskId: recorded.entry.id, commandId: "openScene", effectId: "route:scene" }));
      openSceneRoute({ withOutputFrame: false, source: "companion-open-scene" });
      return;
    }
    if (shellNavIntent === "openOutputFrame"
      || /^(?:open|show)(?: the)? (?:output )?frame$|^(?:open|show)(?: the)? output frame$/i.test(recorded.entry.normalized)) {
      openSceneRoute({ withOutputFrame: true, source: "companion-open-output-frame" });
      next = transitionOrb(next, "executing", { taskId: recorded.entry.id, commandId: "openOutputFrame" });
      setOrb(transitionOrb(next, "completed", { taskId: recorded.entry.id, commandId: "openOutputFrame", effectId: `output-frame:${Date.now()}` }));
      return;
    }
    const remixIntent = parsePearlRemixCommand(recorded.entry.raw || recorded.entry.normalized);
    // Companion remix/gauntlet intents work on Scene and Reef without Output Frame.
    // Scene-local mutations resolve a sceneId; gauntlet wear resolves pearls across the shelf.
    const companionSurfaceOk = route.kind === "stage" || route.kind === "home" || route.kind === "library";
    function resolveRemixScene(workspace = loadSceneWorkspace()) {
      if (route.kind === "stage") return activeStageScene(workspace);
      const withPearls = (workspace.scenes || []).find((entry) =>
        (entry.semanticOrbs || []).some((orb) => !orb.archived));
      return withPearls || (workspace.scenes || [])[0] || null;
    }
    function reefPearlCatalog(workspace = loadSceneWorkspace()) {
      return collectReefPearls(workspace.scenes || []);
    }
    if (remixIntent?.verb === "discoverFormingPearls" && companionSurfaceOk) {
      next = transitionOrb(next, "executing", { taskId: recorded.entry.id, commandId: "discoverFormingPearls" });
      setOrb(next);
      try {
        let text = remixIntent.args?.text || "";
        if (!text) {
          const contextDump = (orbRef.current?.context || [])
            .map((item) => item.text || item.label || "")
            .filter(Boolean)
            .join("\n\n");
          if (contextDump.trim().length >= 40) text = contextDump;
        }
        if (!text) {
          try { text = await navigator.clipboard.readText(); } catch { text = ""; }
        }
        if (!text?.trim()) {
          setOrb(transitionOrb(next, "blocked", {
            taskId: recorded.entry.id,
            evidence: { boundary: "Paste a chat, docs, or drafts (or drop them onto the Companion) to discover forming pearls." },
          }));
          return;
        }
        const workspace = loadSceneWorkspace();
        let scene = resolveRemixScene(workspace);
        if (!scene) {
          scene = createScene({ id: `scene-${Date.now()}`, name: "Import shelf" });
          persistSceneWorkspace({ ...workspace, scenes: [...(workspace.scenes || []), scene], activeSceneId: scene.id });
        }
        const discovery = discoverFormingPearlsFromImport(text, {
          source: "companion-import",
          maxPearls: MAX_FORMING_PEARLS,
        });
        const createdIds = [];
        for (const entry of discovery.pearls) {
          const created = await applySemanticOrbCommand("createSemanticOrb", {
            sceneId: scene.id,
            activate: false,
            orb: {
              name: entry.pearl.name,
              representation: entry.pearl.representation,
              workingSet: entry.pearl.workingSet,
              moves: entry.organization.moves,
              functions: entry.organization.functions,
              lenses: entry.organization.lenses,
              provenance: entry.pearl.provenance,
            },
          });
          const id = created?.result?.id || created?.id;
          if (id) createdIds.push(id);
        }
        setOrb(transitionOrb(orbRef.current || next, "completed", {
          taskId: recorded.entry.id,
          commandId: "discoverFormingPearls",
          effectId: `forming:${createdIds.length}:${Date.now()}`,
          evidence: {
            title: discovery.reason,
            preview: true,
            steps: createdIds.length
              ? [`Materialized ${createdIds.length} context pearl${createdIds.length === 1 ? "" : "s"} on the shelf`]
              : [discovery.reason],
          },
        }));
      } catch (error) {
        setOrb(transitionOrb(next, "blocked", {
          taskId: recorded.entry.id,
          evidence: { boundary: error?.message || "Could not discover forming pearls." },
        }));
      }
      return;
    }
    if (remixIntent?.verb === "organizePearl" && companionSurfaceOk) {
      next = transitionOrb(next, "executing", { taskId: recorded.entry.id, commandId: "organizePearl" });
      setOrb(next);
      try {
        const workspace = loadSceneWorkspace();
        const needle = String(remixIntent.args?.name || remixIntent.args?.id || "").trim();
        const matched = findWorkspacePearl(workspace.scenes || [], needle);
        const scene = matched?.scene || resolveRemixScene(workspace);
        const activeId = matched?.id
          || scene?.activeSemanticOrbId
          || (scene?.semanticOrbs || []).find((orb) => !orb.archived)?.id;
        if (!scene || !activeId) throw new Error("Create or select a context pearl with dump material first.");
        const extraText = (orbRef.current?.context || [])
          .map((item) => String(item.text || item.label || "").trim())
          .filter(Boolean)
          .join("\n\n");
        await applySemanticOrbCommand("organizePearl", {
          id: activeId,
          sceneId: scene.id,
          ...(extraText ? { extraText } : {}),
        });
        setOrb(transitionOrb(orbRef.current || next, "completed", {
          taskId: recorded.entry.id,
          commandId: "organizePearl",
          effectId: `organize:${activeId}:${Date.now()}`,
        }));
      } catch (error) {
        setOrb(transitionOrb(next, "blocked", {
          taskId: recorded.entry.id,
          evidence: { boundary: error?.message || "Nothing to organize." },
        }));
      }
      return;
    }
    // wearPearl must demonstrate via App director (ghost cursor move shelf → gauntlet).
    if (remixIntent?.verb === "removeWornPearl" && companionSurfaceOk) {
      next = transitionOrb(next, "executing", { taskId: recorded.entry.id, commandId: "removeWornPearl" });
      setOrb(next);
      try {
        const workspace = loadSceneWorkspace();
        const catalog = reefPearlCatalog(workspace);
        const needle = String(remixIntent.args?.name || remixIntent.args?.id || "").trim();
        const match = needle ? findWorkspacePearl(workspace.scenes || [], needle) : null;
        removePearlIdFromGauntlet(match?.id || null);
        const gauntlet = loadGauntletState();
        const orbit = loadWornOrbitState();
        const byId = new Map(catalog.map((entry) => [entry.id, entry]));
        document.dispatchEvent(new CustomEvent("lens:worn-pearls-changed", {
          detail: {
            pearlIds: orbit.pearlIds,
            primaryPearlId: orbit.primaryPearlId,
            packs: gauntlet.pearlIds.map((id) => {
              const entry = byId.get(id);
              return { pearlId: id, id, name: entry?.name || id, aesthetic: entry?.aesthetic || null };
            }),
            gauntlet: {
              slots: gauntlet.slots,
              activeSlot: gauntlet.activeSlot,
              filled: gauntlet.filled,
              capacity: MAX_GAUNTLET_SLOTS,
            },
          },
        }));
        setOrb(transitionOrb(orbRef.current || next, "completed", {
          taskId: recorded.entry.id,
          commandId: "removeWornPearl",
          effectId: `unwear:${Date.now()}`,
        }));
      } catch (error) {
        setOrb(transitionOrb(next, "blocked", {
          taskId: recorded.entry.id,
          evidence: { boundary: error?.message || "Could not clear gauntlet socket." },
        }));
      }
      return;
    }
    if (remixIntent?.verb === "mergeSemanticOrbs" && companionSurfaceOk) {
      next = transitionOrb(next, "executing", { taskId: recorded.entry.id, commandId: "mergeSemanticOrbs" });
      setOrb(next);
      try {
        const workspace = loadSceneWorkspace();
        const scene = resolveRemixScene(workspace);
        const ids = (scene?.semanticOrbs || []).filter((entry) => !entry.archived).slice(0, 4).map((entry) => entry.id);
        if (!scene || ids.length < 2) throw new Error("Select or create at least two context pearls to merge.");
        await applySemanticOrbCommand("mergeSemanticOrbs", { ids, sceneId: scene.id });
        setOrb(transitionOrb(orbRef.current || next, "completed", {
          taskId: recorded.entry.id,
          commandId: "mergeSemanticOrbs",
          effectId: `merge:${ids.join("+")}:${Date.now()}`,
        }));
      } catch (error) {
        setOrb(transitionOrb(next, "blocked", {
          taskId: recorded.entry.id,
          evidence: { boundary: error?.message || "Could not merge pearls." },
        }));
      }
      return;
    }
    if (remixIntent?.verb === "synthesizeSemanticOrbs" && companionSurfaceOk) {
      next = transitionOrb(next, "executing", { taskId: recorded.entry.id, commandId: "synthesizeSemanticOrbs" });
      setOrb(next);
      try {
        const workspace = loadSceneWorkspace();
        const scene = resolveRemixScene(workspace);
        const ids = (scene?.semanticOrbs || []).filter((entry) => !entry.archived).slice(0, 4).map((entry) => entry.id);
        if (!scene || ids.length < 2) throw new Error("Select or create at least two context pearls to synthesize.");
        await applySemanticOrbCommand("synthesizeSemanticOrbs", {
          ids,
          sceneId: scene.id,
          mode: remixIntent.args?.mode || "mutual",
          instruction: remixIntent.args?.instruction,
        });
        setOrb(transitionOrb(orbRef.current || next, "completed", {
          taskId: recorded.entry.id,
          commandId: "synthesizeSemanticOrbs",
          effectId: `synthesize:${ids.join("+")}:${Date.now()}`,
        }));
      } catch (error) {
        setOrb(transitionOrb(next, "blocked", {
          taskId: recorded.entry.id,
          evidence: { boundary: error?.message || "Could not synthesize pearls." },
        }));
      }
      return;
    }
    if (remixIntent?.verb === "createCounterPearl" && companionSurfaceOk) {
      next = transitionOrb(next, "executing", { taskId: recorded.entry.id, commandId: "createCounterPearl" });
      setOrb(next);
      try {
        const workspace = loadSceneWorkspace();
        const needle = String(remixIntent.args?.name || remixIntent.args?.id || "").trim();
        const matched = findWorkspacePearl(workspace.scenes || [], needle);
        const scene = matched?.scene || resolveRemixScene(workspace);
        const activeId = matched?.id
          || scene?.activeSemanticOrbId
          || (scene?.semanticOrbs || []).find((orb) => !orb.archived)?.id;
        if (!scene || !activeId) throw new Error("Create or select a context pearl first.");
        await applySemanticOrbCommand("createCounterPearl", {
          id: activeId,
          sceneId: scene.id,
          instruction: remixIntent.args?.instruction || recorded.entry.raw,
        });
        setOrb(transitionOrb(orbRef.current || next, "completed", {
          taskId: recorded.entry.id,
          commandId: "createCounterPearl",
          effectId: `counter:${activeId}:${Date.now()}`,
        }));
      } catch (error) {
        setOrb(transitionOrb(next, "blocked", {
          taskId: recorded.entry.id,
          evidence: { boundary: error?.message || "Could not create counter pearl." },
        }));
      }
      return;
    }
    if (remixIntent?.verb === "openPearlStudio" && companionSurfaceOk) {
      next = transitionOrb(next, "executing", { taskId: recorded.entry.id, commandId: "openPearlStudio" });
      setOrb(next);
      try {
        const workspace = loadSceneWorkspace();
        const scene = resolveRemixScene(workspace);
        const pearlId = scene?.activeSemanticOrbId
          || (scene?.semanticOrbs || []).find((orb) => !orb.archived)?.id
          || reefPearlCatalog(workspace)[0]?.id;
        if (!pearlId) throw new Error("Create a pearl first, then ask to open Studio.");
        try { await window.__pearlPrivacy?.flush?.(); } catch { /* best effort */ }
        window.dispatchEvent(new CustomEvent("lens:open-pearl-studio", { detail: { pearlId } }));
        setOrb(transitionOrb(orbRef.current || next, "completed", {
          taskId: recorded.entry.id,
          commandId: "openPearlStudio",
          effectId: `studio:${pearlId}:${Date.now()}`,
        }));
      } catch (error) {
        setOrb(transitionOrb(next, "blocked", {
          taskId: recorded.entry.id,
          evidence: { boundary: error?.message || "Could not open Pearl Studio." },
        }));
      }
      return;
    }
    if (remixIntent?.verb === "splitSemanticOrb" && companionSurfaceOk) {
      next = transitionOrb(next, "executing", { taskId: recorded.entry.id, commandId: "splitSemanticOrb" });
      setOrb(next);
      try {
        const workspace = loadSceneWorkspace();
        const scene = resolveRemixScene(workspace);
        const activeId = scene?.activeSemanticOrbId
          || (scene?.semanticOrbs || []).find((orb) => !orb.archived)?.id;
        if (!scene || !activeId) throw new Error("Create or select a pearl first, then say “split this pearl”.");
        await applySemanticOrbCommand("splitSemanticOrb", { id: activeId, sceneId: scene.id });
        setOrb(transitionOrb(orbRef.current || next, "completed", {
          taskId: recorded.entry.id,
          commandId: "splitSemanticOrb",
          effectId: `split:${activeId}:${Date.now()}`,
        }));
      } catch (error) {
        setOrb(transitionOrb(next, "blocked", {
          taskId: recorded.entry.id,
          evidence: { boundary: error?.message || "Could not split the pearl." },
        }));
      }
      return;
    }
    const rolePearlIntent = parseInvestorRolePearlCommand(recorded.entry.raw || recorded.entry.normalized);
    if (rolePearlIntent && companionSurfaceOk) {
      next = transitionOrb(next, "executing", { taskId: recorded.entry.id, commandId: "createRolePearl" });
      setOrb(next);
      try {
        const workspace = loadSceneWorkspace();
        let scene = resolveRemixScene(workspace);
        if (!scene) {
          scene = createScene({
            id: `scene-${Date.now()}`,
            name: "Investor shelf",
            metadata: { createdFrom: "role-pearl-scaffold" },
          });
          persistSceneWorkspace({
            ...workspace,
            scenes: [...(workspace.scenes || []), scene],
            activeSceneId: scene.id,
          });
        }
        const scaffold = buildInvestorRolePearlScaffold({
          utterance: recorded.entry.raw || recorded.entry.normalized,
          firm: rolePearlIntent.args.firm,
          role: rolePearlIntent.args.role,
          name: rolePearlIntent.args.name,
        });
        const created = await applySemanticOrbCommand("createRolePearl", {
          sceneId: scene.id,
          role: scaffold.role,
          firm: scaffold.firm,
          name: scaffold.pearl.name,
          utterance: recorded.entry.raw || recorded.entry.normalized,
          activate: true,
          openStudio: rolePearlIntent.args.openStudio !== false,
          wear: rolePearlIntent.args.wear !== false,
        });
        const createdId = created?.result?.id || created?.id;
        if (createdId && rolePearlIntent.args.wear !== false) {
          try {
            wearPearlIdInGauntlet(createdId, { replace: false });
          } catch {
            // Shelf still holds the pearl when gauntlet is full.
          }
        }
        if (createdId && rolePearlIntent.args.openStudio !== false) {
          // Flush vault before Studio remount so the new pearl entity is readable.
          try { await window.__pearlPrivacy?.flush?.(); } catch { /* best effort */ }
          window.dispatchEvent(new CustomEvent("lens:open-pearl-studio", { detail: { pearlId: createdId } }));
        }
        setOrb(transitionOrb(orbRef.current || next, "completed", {
          taskId: recorded.entry.id,
          commandId: "createRolePearl",
          effectId: `role-pearl:${createdId || scaffold.pearl.name}:${Date.now()}`,
          evidence: {
            title: `Created “${scaffold.pearl.name}”`,
            steps: [
              "Investment memo + Diligence Functions",
              `${scaffold.organization.lenses[0]?.name || "Investor lens"}`,
              `${scaffold.organization.moves.length} Moves · Studio inspectable`,
              rolePearlIntent.args.wear !== false ? "Worn on the gauntlet" : "On the shelf",
              "Deterministic scaffold — live firm research needs credentials",
            ],
          },
        }));
      } catch (error) {
        setOrb(transitionOrb(next, "blocked", {
          taskId: recorded.entry.id,
          evidence: { boundary: error?.message || "Could not create the investor pearl." },
        }));
      }
      return;
    }

    // Pearl creation must go through App runtime + director (ghost cursor).
    // Never silent-mutate here — that taught users nothing and failed stress audits.
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
      publishCompanionApproval({ title: "Delete this profile’s local Pearl metadata?", steps: ["Account data is untouched", "A local deletion receipt is created"] });
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
      openSceneRoute({ withOutputFrame: false, source: "companion-open-scene" });
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
    // Current Pearl vision tour stays on Reef — do not open classic Output Frame.
    const capabilityDemoIntent = parsePearlCapabilityDemoCommand(
      recorded.entry.raw || recorded.entry.normalized,
    );
    // Legacy Stage demos still need the Output Frame paper surface for ghost cursor targets.
    const demoIntent = capabilityDemoIntent
      ? null
      : parseSafeDemonstrationCommand(
        recorded.entry.raw || recorded.entry.normalized,
        ((orbRef.current?.context || []).length === 0),
      );
    if (capabilityDemoIntent) {
      window.dispatchEvent(new CustomEvent("lens:companion-expand"));
      navigateHome();
      next = transitionOrb(next, "executing", {
        taskId: recorded.entry.id,
        commandId: "playPearlCapabilityDemo",
        evidence: { title: findDemo(PEARL_CAPABILITY_DEMO_ID)?.title || "Watch what Pearl can do" },
      });
    } else if (demoIntent) {
      window.dispatchEvent(new CustomEvent("lens:companion-expand"));
      if (route.kind === "stage") setOutputFrameOpen(true);
      else {
        // Open a Scene + Output Frame so months of director harness can play for real.
        try {
          const workspace = loadSceneWorkspace();
          let scene = (workspace.scenes || [])[0];
          if (!scene) {
            scene = createScene({ id: `scene-${Date.now()}`, name: "Demo Scene" });
            persistSceneWorkspace({
              ...workspace,
              scenes: [...(workspace.scenes || []), scene],
              activeSceneId: scene.id,
            });
          }
          setOutputFrameOpen(true);
          navigate(`/scene/${encodeURIComponent(scene.id)}`);
        } catch {
          /* navigation best-effort; runtime may still execute */
        }
      }
      next = transitionOrb(next, "executing", {
        taskId: recorded.entry.id,
        commandId: demoIntent.verb || "runDirectorDemo",
        evidence: { title: findDemo(demoIntent.demoId)?.title || "Demonstrating…" },
      });
    }

    // Prefer the full App companion runtime (director + animations) whenever it is
    // mounted — including from Reef. Never silent-no-op when the bridge is ready.
    setOrb(next);
    const controller = new AbortController();
    activeRunAbortRef.current = controller;
    try {
      // Give newly navigated Scene a beat to mount App + register __lensOrbRuntime.
      if (demoIntent || capabilityDemoIntent) {
        await new Promise((resolve) => setTimeout(resolve, 450));
      }
      const runtime = await waitForOrbRuntime((demoIntent || capabilityDemoIntent || route.kind === "stage") ? 12_000 : 8_000);
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
            publishCompanionApproval(null);
            approvalResolverRef.current = null;
            return null;
          }
          setOrb((value) => value.phase === "approval" ? value : transitionOrb(value, "approval", {
            taskId: recorded.entry.id,
            evidence: { title: plan.title, preview: true },
          }));
          publishCompanionApproval(plan);
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
        publishCompanionApproval({ title: "Clear selected workspace domains?", steps });
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
      const execution = result?.execution || null;
      const problem = execution
        && (execution.status === "blocked" || execution.status === "failed" || execution.status === "cancelled");
      const chatText = problem
        ? (execution
          ? `${execution.status === "cancelled" ? "Cancelled" : execution.status === "failed" ? "Failed" : "Blocked"}: ${execution.message} [${execution.code}]`
          : result?.text)
        : (result?.text || execution?.message || "Done.");
      if (chatText) {
        window.dispatchEvent(new CustomEvent("lens:companion-expand"));
        window.dispatchEvent(new CustomEvent("lens:companion-notice", {
          detail: { id: `run:${recorded.entry.id}`, text: chatText, transient: false },
        }));
      }
      if (result?.visible || problem) {
        if (execution) recordAndLogExecution(execution);
        const boundary = execution
          ? `${execution.message} [${execution.code}]`
          : result.text;
        setOrb((value) => value.phase === "blocked" ? value : transitionOrb(value, "blocked", {
          taskId: recorded.entry.id,
          evidence: {
            boundary,
            code: execution?.code,
            stage: execution?.stage,
          },
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
          evidence: result?.text
            ? { title: result.text }
            : { title: execution?.message || "Done", code: execution?.code },
        });
      });
    } catch (error) {
      if (error.name === "AbortError" || controller.signal.aborted) {
        recordAndLogExecution({
          status: "cancelled",
          code: EXECUTION_CODES.ABORTED,
          message: "Stopped by user",
          stage: "execute",
        });
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
            evidence: { boundary: "Stopped by user", code: "aborted" },
          }],
        }));
        return;
      }
      const runtimeStarting = /did not become ready/i.test(error?.message || "");
      const fallbackBoundary = runtimeStarting
        ? "Companion runtime is still starting — click the Companion Pearl again in a moment, or try “open a new scene”."
        : (error.message || "That action could not be completed.");
      const execution = mapErrorToExecutionResult(error, {
        stage: "execute",
        code: runtimeStarting ? EXECUTION_CODES.RUNTIME_UNAVAILABLE : undefined,
        message: runtimeStarting ? fallbackBoundary : undefined,
      });
      recordAndLogExecution(execution);
      const boundary = `${execution.message} [${execution.code}]`;
      setOrb((value) => {
        if (value.phase === "blocked") return value;
        const recoverable = ["executing", "paused"].includes(value.phase)
          ? transitionOrb(value, "recovery", { taskId: recorded.entry.id, evidence: { error: error.message } })
          : value;
        return transitionOrb(recoverable, "blocked", { taskId: recorded.entry.id, evidence: { boundary, code: execution.code } });
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
    publishCompanionApproval(null);
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

  function publishCompanionApproval(plan) {
    setPendingApproval(plan);
    try {
      window.dispatchEvent(new CustomEvent("lens:companion-expand"));
      window.dispatchEvent(new CustomEvent("lens:companion-approval", {
        detail: plan
          ? {
              id: plan.id || `approval:${Date.now()}`,
              title: plan.title || "Confirm this action",
              steps: Array.isArray(plan.steps) ? plan.steps : [],
            }
          : null,
      }));
    } catch {
      /* private mode */
    }
  }

  function decideApproval(decision) {
    const resolve = approvalResolverRef.current;
    approvalResolverRef.current = null;
    setPendingApproval(null);
    try {
      window.dispatchEvent(new CustomEvent("lens:companion-approval", { detail: null }));
    } catch {
      /* private mode */
    }
    resolve?.({ decision });
  }
  decideApprovalRef.current = decideApproval;

  useEffect(() => {
    function onChatApprovalDecision(event) {
      const decision = event.detail?.decision === "accept" ? "accept" : "reject";
      decideApprovalRef.current?.(decision);
    }
    window.addEventListener("lens:companion-approval-decision", onChatApprovalDecision);
    return () => window.removeEventListener("lens:companion-approval-decision", onChatApprovalDecision);
  }, []);

  function renderPearlEmission() {
    if (!emittedView) return null;
    const title = emittedView === "context" ? "What Pearl noticed"
      : emittedView === "actions" ? "Actions"
      : emittedView === "taste" ? "Choices"
      : emittedView === "scene" ? "View"
      : emittedView === "privacy" ? (privacyNotice?.title || "Privacy")
      : emittedView === "settings" ? "Account & privacy"
      : emittedView === "encode" ? "Encode anything"
      : emittedView === "packages" ? "Cognitive Packages"
      : emittedView === "tasks" ? "Activity"
      : "Saved work";
    return <aside className="orb-stage-emission" data-emitted-view={emittedView} aria-label={`${emittedView} view from Pearl`}>
      <button type="button" onClick={() => setEmittedView(null)}>Close</button>
      <b>{title}</b>
      {emittedView === "actions"
        ? <PearlActionPalette onRun={executePearlAction} />
        : emittedView === "scene"
          ? <nav className="pearl-scene-actions" aria-label="Scene and Output Frame actions">
              <button type="button" onClick={() => navigateHome()}>Reef</button>
              <button type="button" aria-pressed={outputFrameOpen} onClick={() => setOutputFrameOpen((value) => !value)}>
                {outputFrameOpen ? "Back to Scene" : "Open Output Frame"}
              </button>
              {[["Stage", "Space"], ["Gallery", "Grid"], ["Graph", "Connections"], ["Table", "Details"], ["Timeline", "Sequence"]].map(([option, optionLabel]) => <button
                type="button"
                key={option}
                aria-pressed={!outputFrameOpen && sceneView === option}
                onClick={() => { setOutputFrameOpen(false); setSceneView(option); }}
              >{optionLabel}</button>)}
            </nav>
          : emittedView === "settings"
            ? <AccountPrivacyPanel
                session={supaAuth.session}
                sessionResolved={supaAuth.sessionResolved}
                accountsConfigured={isSupabaseConfigured()}
                syncEnabled={syncEnabled}
                onSignIn={() => {
                  if (!isSupabaseConfigured()) {
                    const blocker = describeAccountsUnavailable();
                    setPrivacyNotice({ title: blocker.title, detail: blocker.message });
                    return;
                  }
                  setAuthOpen(true);
                }}
                onSignOut={() => getSupabase()?.auth.signOut({ scope: "local" }).catch(() => {})}
                onToggleSync={(enabled) => {
                  if (enabled && !supaAuth.session?.user) {
                    setPrivacyNotice({
                      title: "Sign in required for sync",
                      detail: "Account sync needs a signed-in session. Sign in first, then enable sync.",
                    });
                    return;
                  }
                  setBoardSyncEnabled(enabled);
                  setSyncEnabled(enabled);
                  window.dispatchEvent(new CustomEvent("pearl-board-sync-consent", { detail: { enabled } }));
                  setPrivacyNotice({
                    title: enabled ? "Sync enabled for this profile" : "Local only",
                    detail: enabled
                      ? "Account sync is opt-in and is not end-to-end vault encryption."
                      : "No Pearl metadata will sync.",
                  });
                }}
                onLock={() => command("lock my pearls")}
                onUnlock={() => command("unlock my pearls")}
                onDeleteLocal={() => command("delete my local pearl data")}
              />
            : emittedView === "encode"
              ? <EncodeAnythingPanel embedded onClose={() => setEmittedView(null)} onCompiled={({ pearl, entity }) => {
                setPrivacyNotice({ title: "Automation Pearl saved locally", detail: "Review before enabling model or research disclosure." });
                if (route.kind === "stage") {
                  const evidenceText = (pearl?.material?.evidence || pearl?.evidence || [])
                    .map((entry) => entry.content || entry.verbatim || entry.text || "")
                    .filter(Boolean)
                    .join("\n\n");
                  const label = pearl?.identity?.name || entity?.identity?.name || "Automation Pearl";
                  semanticOrbActions.create({
                    placement: { x: 0, y: -40 },
                    material: {
                      id: pearl?.id || entity?.id || `automation:${Date.now()}`,
                      kind: "automation",
                      label,
                      name: label,
                      text: evidenceText || pearl?.identity?.description || label,
                    },
                  }).catch(() => {
                    /* local automation store already persisted */
                  });
                }
              }} />
            : emittedView === "packages"
              ? <CognitivePackageRegistry
                  embedded
                  accountId={supaAuth.session?.user?.id || null}
                  onClose={() => setEmittedView(null)}
                />
            : emittedView === "tasks"
              ? <p role="status">Your Reef is home — all pearls spread out for mix, match, and merge. Create a Scene to begin, or continue from the extension.</p>
            : emittedView === "privacy"
              ? <span>{privacyNotice?.detail}</span>
              : emittedView === "context"
                ? <ContextInspector items={orb.context || []} onChange={updateOrbContext} onRemove={removeOrbContext} />
                : emittedView === "lenses"
                  ? <LensAtmosphereInspector lenses={orb.lenses || []} onChange={updateOrbLens} onRemove={removeOrbLens} />
                  : emittedView === "taste"
                    ? <CandidateInspector candidates={orb.candidates || []} onTaste={tasteCandidate} />
                    : libraryObjects.slice(0, 8).map(([name, description]) => <button type="button" key={name} onClick={() => openEmittedView("library")}>
                      <b>{name}</b><small>{description}</small>
                    </button>)}
    </aside>;
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
    if (!resolveSpeechRecognition()) {
      window.dispatchEvent(new CustomEvent("lens:companion-expand"));
      window.dispatchEvent(new CustomEvent("lens:companion-notice", {
        detail: {
          id: `voice-unavailable:${Date.now()}`,
          text: "Blocked: Voice isn’t available in this browser. Type your goal and press GO. [voice-unavailable]",
          transient: false,
        },
      }));
      setOrb((value) => createOrbState({
        ...value,
        phase: "blocked",
        trace: [...(value.trace || []), {
          id: `voice-unavailable:${Date.now()}`,
          from: value.phase,
          to: "blocked",
          at: new Date().toISOString(),
          evidence: { boundary: "Voice input is unavailable in this browser. Type the goal and press GO." },
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
      dispatch: (text, envelope = {}) => {
        if (voiceSessionRef.current === session) voiceSessionRef.current = null;
        // Same path as chat mic: open dock + run through companion runtime.
        window.dispatchEvent(new CustomEvent("lens:companion-expand"));
        if (envelope.empty || !String(text || "").trim()) {
          window.dispatchEvent(new CustomEvent("lens:companion-notice", {
            detail: {
              id: `empty-voice:${Date.now()}`,
              text: "Blocked: Heard nothing clear enough to run. Hold to speak, then release — or type and press GO. [empty-voice]",
              transient: false,
            },
          }));
          setOrb((value) => createOrbState({ ...value, phase: "idle" }));
          return;
        }
        command(text, { source: "voice", ...envelope });
      },
      captureSnapshot: () => [{ route: location.pathname, sceneId: route.sceneId || null }],
    });
    const attach = () => {
      if (!session.isActive() || generation !== voiceGenerationRef.current) return;
      const SpeechRecognitionImpl = resolveSpeechRecognition();
      if (!SpeechRecognitionImpl) throw new Error("speech-recognition-unavailable");
      const recognition = new SpeechRecognitionImpl();
      recognition.lang = navigator.language || "en-US";
      recognition.interimResults = true;
      recognition.continuous = true;
      recognition.onresult = (event) => session.ingest(event, generation);
      recognition.onerror = (event) => {
        if (event?.error === "not-allowed" || event?.error === "service-not-allowed") {
          finishVoice({ send: false });
          window.dispatchEvent(new CustomEvent("lens:companion-expand"));
          window.dispatchEvent(new CustomEvent("lens:companion-notice", {
            detail: {
              id: `voice-denied:${Date.now()}`,
              text: "Blocked: Microphone permission was denied. Allow mic for this site, then try again — or type and press GO. [permission-denied]",
              transient: false,
            },
          }));
          setOrb((value) => createOrbState({
            ...value,
            phase: "blocked",
            trace: [...(value.trace || []), {
              id: `voice-denied:${Date.now()}`,
              from: value.phase,
              to: "blocked",
              at: new Date().toISOString(),
              evidence: { boundary: "Microphone permission was not granted. Type and press GO." },
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

  async function applySemanticOrbCommand(name, args = {}) {
    const currentOrb = orbRef.current || createOrbState();
    const ready = ["idle", "completed"].includes(currentOrb.phase)
      ? currentOrb
      : createOrbState({ ...currentOrb, phase: "idle", effectId: null, commandId: null });
    let workspace = loadSceneWorkspace();
    // Honor explicit sceneId so Companion remix works from Reef (shelf) as well as Scene.
    const commandArgs = { ...args };
    const requestedSceneId = typeof commandArgs.sceneId === "string" ? commandArgs.sceneId : null;
    delete commandArgs.sceneId;
    let sceneId = requestedSceneId || route.sceneId || workspace.activeSceneId;
    let scene = workspace.scenes?.find((entry) => entry.id === sceneId);
    if (!scene && sceneId) {
      scene = createScene({ id: sceneId, name: "Shelf", metadata: { createdFrom: "recover-missing-scene" } });
      workspace = {
        ...workspace,
        scenes: [...(workspace.scenes || []), scene],
        activeSceneId: scene.id,
      };
      localStorage.setItem(UNIFIED_WORKSPACE_KEY, serializeUnifiedWorkspace(workspace));
      setSceneWorkspace(workspace);
    }
    // Creating a pearl from Reef / home should not require a prior Scene click.
    if (!scene && ["createSemanticOrb", "createRolePearl", "discoverFormingPearls"].includes(name)) {
      scene = createScene({
        id: `scene-${Date.now()}`,
        name: name === "createRolePearl" ? "Investor shelf" : "Shelf",
        metadata: { createdFrom: "auto-shelf-for-pearl" },
      });
      sceneId = scene.id;
      workspace = {
        ...workspace,
        scenes: [...(workspace.scenes || []), scene],
        activeSceneId: scene.id,
      };
      localStorage.setItem(UNIFIED_WORKSPACE_KEY, serializeUnifiedWorkspace(workspace));
      setSceneWorkspace(workspace);
    }
    if (!scene) {
      console.error("Open a workspace before creating a pearl");
      setOrb((value) => createOrbState({
        ...value,
        phase: "blocked",
        trace: [...(value.trace || []), {
          id: `semantic-orb-blocked:${Date.now()}`,
          from: value.phase,
          to: "blocked",
          at: new Date().toISOString(),
          evidence: { boundary: "Create or open a workspace first." },
        }],
      }));
      return null;
    }
    const execution = await executeOrbCommand({
      orb: ready,
      command: name,
      state: {
        semanticOrbs: scene.semanticOrbs || [],
        activeSemanticOrbId: scene.activeSemanticOrbId || null,
        orbWorkers: scene.orbWorkers || {},
      },
      // Re-inject sceneId for domain commands that persist it on the pearl.
      args: { ...commandArgs, sceneId },
      taskId: `semantic-orb:${name}:${Date.now()}`,
      observe: async ({ result }) => ({ effects: result.effects }),
    });
    const updated = updateSceneWorkspace(workspace, sceneId, (current) => ({
      ...current,
      semanticOrbs: execution.state.semanticOrbs,
      activeSemanticOrbId: execution.state.activeSemanticOrbId,
      orbWorkers: execution.state.orbWorkers || current.orbWorkers || {},
    }));
    const restore = persistWorkspace(updated);
    const nextScene = updated.scenes.find((entry) => entry.id === sceneId);
    const activeCapsule = nextScene.semanticOrbs.find((entry) => entry.id === nextScene.activeSemanticOrbId);
    const workingSet = activeCapsule?.workingSet || nextScene.workingSet || {};
    const workers = nextScene.orbWorkers?.[nextScene.activeSemanticOrbId] || execution.result?.workers || [];
    const nextOrb = createOrbState({
      ...execution.orb,
      activeSemanticOrbId: nextScene.activeSemanticOrbId || null,
      context: workingSet.context || [],
      lenses: workingSet.lenses || [],
      workers,
    });
    orbUndoRef.current = { orb: currentOrb, restore };
    orbRedoRef.current = null;
    setHasOrbUndo(true);
    setHasOrbRedo(false);
    orbRef.current = nextOrb;
    setOrb(nextOrb);
    const pearlId = execution.result?.id
      || args.parentId
      || args.id
      || nextScene.activeSemanticOrbId
      || null;
    try {
      const animation = pearlAnimationForCommand(name, {
        effectReceiptId: execution.effectId || `orb:${name}`,
      });
      if (pearlId) {
        document.dispatchEvent(new CustomEvent("lens:pearl-host-animation", {
          detail: { pearlId, semantic: animation.semantic, durationMs: animation.durationMs },
        }));
      }
      const host = pearlId
        ? document.querySelector(`[data-semantic-orb-id="${pearlId}"]`)
        : document.querySelector(".companion-orb");
      const box = host?.getBoundingClientRect?.();
      const from = box
        ? { x: box.left + box.width / 2, y: box.top + box.height / 2 }
        : { x: window.innerWidth / 2, y: window.innerHeight * 0.72 };
      const count = execution.result?.workers?.length
        || execution.result?.objects?.length
        || args.specs?.length
        || undefined;
      dispatchPearlPowerFx(powerFxForAnimation(animation, {
        pearlId,
        from,
        count,
        specs: args.specs,
        kind: execution.result?.powerFx?.kind,
      }));
    } catch {
      /* animation is best-effort; domain effect already committed */
    }
    return execution;
  }

  const semanticOrbActions = {
    create: ({ placement = { x: 0, y: 0 }, material = null, name = null } = {}) => applySemanticOrbCommand("createSemanticOrb", {
      sceneId: route.sceneId,
      placement,
      activate: true,
      ...(material
        ? { material: { ...material, label: material.label || material.name || name || undefined } }
        : { orb: { name: name || `New pearl · ${new Date().toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` } }),
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
    synthesize: (ids, options = {}) => applySemanticOrbCommand("synthesizeSemanticOrbs", {
      ids,
      sceneId: route.sceneId,
      mode: options.mode,
      instruction: options.instruction,
      name: options.name,
    }),
    organize: (id, options = {}) => applySemanticOrbCommand("organizePearl", {
      id,
      extraText: options.extraText,
      sceneId: route.sceneId,
    }),
    counter: (id, options = {}) => applySemanticOrbCommand("createCounterPearl", {
      id,
      name: options.name,
      instruction: options.instruction,
      sceneId: route.sceneId,
    }),
    split: (id) => applySemanticOrbCommand("splitSemanticOrb", { id, sceneId: route.sceneId }),
    duplicate: (id) => applySemanticOrbCommand("duplicateSemanticOrb", { id }),
    delete: async (id) => {
      try {
        return await applySemanticOrbCommand("deleteSemanticOrb", { id });
      } catch (error) {
        console.error("deleteSemanticOrb failed; archiving pearl instead.", error);
        return applySemanticOrbCommand("archiveSemanticOrb", { id, archived: true });
      }
    },
    spawnWorkers: (parentId, specs) => applySemanticOrbCommand("createWorker", {
      parentId, specs, sceneId: route.sceneId,
    }),
    fuseWorkers: (parentId, workerIds) => applySemanticOrbCommand("mergeWorkers", { parentId, workerIds }),
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

  function persistSceneWorkspace(nextWorkspace, { previousStorage, currentOrb } = {}) {
    const serialized = serializeUnifiedWorkspace(nextWorkspace);
    localStorage.setItem(UNIFIED_WORKSPACE_KEY, serialized);
    setSceneWorkspace(JSON.parse(serialized));
    if (previousStorage !== undefined) {
      orbUndoRef.current = {
        orb: currentOrb || orbRef.current,
        restore() {
          if (previousStorage == null) localStorage.removeItem(UNIFIED_WORKSPACE_KEY);
          else localStorage.setItem(UNIFIED_WORKSPACE_KEY, previousStorage);
          setSceneWorkspace(loadSceneWorkspace());
        },
      };
      orbRedoRef.current = null;
      setHasOrbUndo(true);
      setHasOrbRedo(false);
    }
  }

  function activeStageScene(workspace = loadSceneWorkspace()) {
    return (workspace.scenes || []).find((entry) => entry.id === route.sceneId)
      || createScene({ id: route.sceneId || `scene-${Date.now()}` });
  }

  function moveMaterialOnStage(itemId, worldPoint) {
    if (!itemId) return;
    const workspace = loadSceneWorkspace();
    const scene = activeStageScene(workspace);
    if (!(scene.items || []).some((item) => item.id === itemId)) return;
    const previousStorage = localStorage.getItem(UNIFIED_WORKSPACE_KEY);
    const nextScene = createScene({
      ...scene,
      items: (scene.items || []).map((item) => item.id === itemId
        ? { ...item, x: Number(worldPoint?.x) || 0, y: Number(worldPoint?.y) || 0 }
        : item),
    });
    const scenes = (workspace.scenes || []).some((entry) => entry.id === scene.id)
      ? workspace.scenes.map((entry) => entry.id === scene.id ? nextScene : entry)
      : [...(workspace.scenes || []), nextScene];
    persistSceneWorkspace({
      ...workspace,
      scenes,
      activeSceneId: nextScene.id,
      items: nextScene.items,
      nodes: nextScene.nodes,
      camera: nextScene.camera,
      frames: nextScene.frames,
      orbInstances: nextScene.orbInstances,
      workingSet: nextScene.workingSet,
    }, { previousStorage });
  }

  function deleteMaterialOnStage(itemId) {
    if (!itemId) return;
    const workspace = loadSceneWorkspace();
    const scene = activeStageScene(workspace);
    if (!(scene.items || []).some((item) => item.id === itemId)
      && !(scene.nodes || []).some((node) => node.id === itemId)) {
      return;
    }
    const previousStorage = localStorage.getItem(UNIFIED_WORKSPACE_KEY);
    const nextScene = createScene({
      ...scene,
      items: (scene.items || []).filter((item) => item.id !== itemId),
      nodes: (scene.nodes || []).filter((node) => node.id !== itemId),
    });
    const scenes = (workspace.scenes || []).map((entry) => entry.id === scene.id ? nextScene : entry);
    persistSceneWorkspace({
      ...workspace,
      scenes,
      activeSceneId: nextScene.id,
      items: nextScene.items,
      nodes: nextScene.nodes,
      camera: nextScene.camera,
      frames: nextScene.frames,
      orbInstances: nextScene.orbInstances,
      workingSet: nextScene.workingSet,
    }, { previousStorage });
  }

  async function materializeOnStage(item, worldPoint) {
    const current = orbRef.current;
    const ready = ["idle", "completed"].includes(current.phase)
      ? current
      : createOrbState({ ...current, phase: "idle", effectId: null, commandId: null });
    const workspace = loadSceneWorkspace();
    const scene = activeStageScene(workspace);
    const sourceId = item.id || null;
    const copy = {
      ...item,
      id: `material:${globalThis.crypto?.randomUUID?.() || Date.now()}`,
      sceneId: scene.id,
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
    persistSceneWorkspace({
      ...workspace,
      scenes,
      activeSceneId: nextScene.id,
      items: nextScene.items,
      nodes: nextScene.nodes,
      camera: nextScene.camera,
      frames: nextScene.frames,
      orbInstances: nextScene.orbInstances,
      workingSet: nextScene.workingSet,
    }, { previousStorage, currentOrb: current });
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

  /** Open spatial Scene (pearls). Classic App rails/tools stay off — Studio owns Moves→Functions. */
  function openSceneRoute({
    withOutputFrame = false,
    source = "new-scene-control",
    forceNew = false,
  } = {}) {
    const workspace = loadSceneWorkspace();
    let scene = !forceNew && (
      (route.kind === "stage" && route.sceneId
        ? (workspace.scenes || []).find((entry) => entry.id === route.sceneId)
        : null)
      || (workspace.activeSceneId
        ? (workspace.scenes || []).find((entry) => entry.id === workspace.activeSceneId)
        : null)
      || (workspace.scenes || [])[0]
      || null
    );
    if (!scene) {
      const id = `scene-${globalThis.crypto?.randomUUID?.() || Date.now()}`;
      scene = createScene({
        id,
        name: "Untitled Scene",
        metadata: { createdFrom: source || "new-scene-control" },
      });
      const scenes = [...(workspace.scenes || []), scene];
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
    } else if (workspace.activeSceneId !== scene.id) {
      const serialized = serializeUnifiedWorkspace({
        ...workspace,
        scenes: workspace.scenes || [],
        activeSceneId: scene.id,
      });
      localStorage.setItem(UNIFIED_WORKSPACE_KEY, serialized);
      setSceneWorkspace(JSON.parse(serialized));
    }
    if (route.kind !== "stage" || route.sceneId !== scene.id) {
      navigate(`/scene/${encodeURIComponent(scene.id)}`);
    }
    setOutputFrameOpen(Boolean(withOutputFrame));
    setOutputToolsOpen(false); // never emit classic App rails in Pearl shell
  }

  function createBlankScene(options = {}) {
    openSceneRoute({
      withOutputFrame: options?.withOutputFrame === true,
      source: options?.source || "new-scene-control",
      forceNew: options?.forceNew === true || !options?.source,
    });
  }
  openSceneRouteRef.current = openSceneRoute;

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
    setOutputFrameOpen(false);
    navigate(`/scene/${encodeURIComponent(id)}`);
  }

  // Result-pearl handoff stays on Reef until the user explicitly continues —
  // never auto-materialize a Scene or open Output Frame without intent.

  async function openActivePearlStudio(selectedPearl = null, studioOptions = {}) {
    const scene = (sceneWorkspace.scenes || []).find((entry) => entry.id === (route.sceneId || sceneWorkspace.activeSceneId));
    // Reef shelf entries are { id, name, sceneId, orb } — prefer the embedded orb payload.
    const fromShelf = selectedPearl?.orb && typeof selectedPearl.orb === "object" ? selectedPearl.orb : selectedPearl;
    const active = fromShelf || scene?.semanticOrbs?.find((entry) => entry.id === scene.activeSemanticOrbId)
      || scene?.semanticOrbs?.[0]
      || {
        id: `primary:${scene?.id || "workspace"}`,
        kind: "primary",
        name: scene?.name || "Pearl",
        workingSet: { context: orb.context || [], lenses: orb.lenses || [] },
        candidates: orb.candidates || [],
        workers: orb.workers || [],
      };
    let entity = createPearlEntity(active);
    let store;
    try { store = JSON.parse(localStorage.getItem(PEARL_STORE_KEY) || "null"); } catch { store = null; }
    store ||= { version: 1, entities: {} };
    const existing = store.entities?.[entity.id];
    const existingHasOrderedMoves = (existing?.functions || []).some((fn) => (
      (fn.steps || fn.graph?.nodes || fn.definition?.steps || []).length > 0
    )) || (existing?.cognition?.layers || []).some((layer) => (
      layer.kind === "function"
      && (layer.definition?.steps || layer.steps || layer.definition?.graph?.nodes || []).length > 0
    ));
    // Preserve Companion/Studio Function-move edits when the shelf orb is stale.
    // Prefer the canonical store entity wholesale — createPearlEntity rebuilds
    // functions from cognition, so partial merges can drop ordered steps.
    // Always prefer a non-empty shelf systemPrompt when the store entity lacks one.
    if (existing && (existingHasOrderedMoves || (existing.revision || 0) > (entity.revision || 0))) {
      const shelfPrompt = active?.systemPrompt || entity.systemPrompt;
      entity = createPearlEntity({
        ...existing,
        systemPrompt: existing.systemPrompt || shelfPrompt || entity.systemPrompt,
      });
    }
    localStorage.setItem(PEARL_STORE_KEY, JSON.stringify({
      ...store,
      entities: { ...(store.entities || {}), [entity.id]: entity },
      activePearlId: entity.id,
      updatedAt: Date.now(),
    }));
    const ref = createWebPearlStudioReference(entity.id);
    // Flush vault before popup/reload so Studio remount can read the entity + ref.
    await openPearlStudioDocument(ref, {
      pearlId: entity.id,
      preferSameWindow: studioOptions.preferSameWindow !== false,
      allowReloadFallback: studioOptions.allowReloadFallback !== false,
    });
  }

  useEffect(() => {
    const open = (event) => {
      const pearlId = event.detail?.pearlId;
      let selected = pearlId
        ? (sceneWorkspace.scenes || []).flatMap((scene) => scene.semanticOrbs || []).find((entry) => entry.id === pearlId)
        : null;
      // React state can lag createRolePearl persistence — read the latest shelf.
      if (pearlId && !selected) {
        try {
          const workspace = loadSceneWorkspace();
          selected = (workspace.scenes || [])
            .flatMap((scene) => scene.semanticOrbs || [])
            .find((entry) => entry.id === pearlId)
            || (workspace.semanticOrbs || []).find((entry) => entry.id === pearlId)
            || null;
        } catch {
          selected = null;
        }
      }
      void openActivePearlStudio(selected, {
        preferSameWindow: event.detail?.preferSameWindow,
        allowReloadFallback: event.detail?.allowReloadFallback,
      });
    };
    window.addEventListener("lens:open-pearl-studio", open);
    return () => window.removeEventListener("lens:open-pearl-studio", open);
  });

  const routedScene = (sceneWorkspace.scenes || []).find((scene) => scene.id === route.sceneId)
    || createScene({ id: route.sceneId || "untitled", name: route.sceneId || "Untitled Scene" });

  if (route.kind === "stage") {
    return <div className="orb-stage-shell" data-semantic-anchor="scene-stage" data-output-frame={outputFrameOpen ? "open" : "closed"}>
      <PearlSceneChrome
        sceneName={routedScene?.name || routedScene?.id || "Untitled workspace"}
        outputFrameOpen={outputFrameOpen}
        onHome={() => navigateHome()}
        onToggleFrame={() => {
          setOutputFrameOpen((value) => !value);
          setOutputToolsOpen(false);
        }}
        onPlacePearl={() => {
          try { semanticOrbActions.create({ placement: { x: 0, y: -40 } }); }
          catch (error) { console.error("Create pearl failed", error); }
        }}
        onDeleteSelection={() => {
          window.dispatchEvent(new CustomEvent(outputFrameOpen
            ? "lens:delete-selection"
            : "lens:scene-delete-selection"));
        }}
        onOpenCompanionHint={() => window.dispatchEvent(new CustomEvent("lens:companion-expand"))}
      />
      {outputFrameOpen && <p className="pearl-frame-banner" data-testid="output-frame-label">
        Output Frame — optional writing surface. Companion still runs from here. “Back to Scene” or Esc leaves.
      </p>}
      <SurfaceErrorBoundary
        label="Scene surface"
        title="This workspace crashed"
        detail="Retry the workspace, or go home to the Reef. Your other pearls stay on this device."
        onHome={() => navigateHome()}
        onReset={() => {
          setOutputFrameOpen(false);
          setOutputToolsOpen(false);
          setSceneWorkspace(loadSceneWorkspace());
        }}
      >
        {/* Always mount App so CompanionChat + director/ghost-cursor runtime stay alive. */}
        <div
          className={outputFrameOpen ? "orb-output-frame-host" : "orb-runtime-host"}
          data-semantic-anchor={outputFrameOpen ? "output-frame" : "companion-runtime"}
          aria-hidden={outputFrameOpen ? undefined : "true"}
        >
          <StageComponent key={route.sceneId || "untitled"} sceneId={route.sceneId} pearlShell />
        </div>
        {!outputFrameOpen && <SceneStage
              scene={routedScene}
              view={sceneView}
              onMaterialDrop={materializeOnStage}
              onMaterialMove={moveMaterialOnStage}
              onMaterialDelete={deleteMaterialOnStage}
              onContextAdd={addOrbContext}
              semanticOrbActions={semanticOrbActions}
              onOpenStudio={openActivePearlStudio}
              onOpenGuide={openGuide}
            />}
      </SurfaceErrorBoundary>
      {!cursorMode && <CompanionOrb key="stage-orb" featured state={orb} onStateChange={setOrb} onCommand={command} onStop={stopOrb} onUndo={undoOrbEffect} onRedo={hasOrbRedo ? redoOrbEffect : undefined}
        onVoiceStart={beginVoice} onVoiceEnd={endVoice} onContextAdd={addOrbContext} onLensAdd={addOrbLens} onEmitView={openEmittedView}
        onOrbCreate={() => {
          const context = orbRef.current?.context || orb.context || [];
          const dumpText = context
            .map((item) => String(item.text || item.label || item.name || "").trim())
            .filter(Boolean)
            .join("\n\n");
          if (dumpText) {
            semanticOrbActions.create({
              placement: { x: 0, y: 0 },
              name: dumpText.slice(0, 48),
              material: {
                id: `orb-dump:${Date.now()}`,
                kind: "dump",
                label: dumpText.slice(0, 48),
                text: dumpText,
                items: context,
              },
            });
            return;
          }
          semanticOrbActions.create({ placement: { x: 0, y: 0 }, name: "Context pearl" });
        }}
        cursorMode={cursorMode} onCursorToggle={(enabled) => setCursorMode(enabled, "control")}
        onOpenStudio={openActivePearlStudio}
        onExpandedChange={(value) => {
          setCompanionExpanded(value);
          if (value) window.dispatchEvent(new CustomEvent("lens:companion-expand"));
        }}
        hint="Talk · type · GO"
        quickActions={pearlNavQuickActions}
        approval={pendingApproval} onApproval={decideApproval} onWorkerCancel={cancelWorker} />}
      {guideOpen && <PearlGuidePanel onClose={() => setGuideOpen(false)} onTry={(text) => { setGuideOpen(false); command(text); }} />}
      {cursorMode && !externalCursorMode && <OrbCursorLayer state={orb} onDisable={() => setCursorMode(false, "control")} />}
      {cursorMode && <button type="button" className="pearl-cursor-escape" onClick={() => setCursorMode(false, "control")}>Esc</button>}
      <span className="sr-only" role="status" aria-live="polite">{cursorMode ? "Pearl cursor on" : "Pearl cursor off"}</span>
      {renderPearlEmission()}
      {(authOpen || supaAuth.passwordRecovery) && <AuthOverlay
        forced={supaAuth.passwordRecovery && isSupabaseConfigured()}
        accountEmail={supaAuth.session?.user?.email || null}
        bootError={authBootError}
        onClose={() => {
          setAuthOpen(false);
          setAuthBootError(null);
          if (supaAuth.passwordRecovery) supaAuth.clearPasswordRecovery();
        }}
        onPasswordUpdated={() => {
          supaAuth.clearPasswordRecovery();
          setAuthOpen(false);
          setAuthBootError(null);
        }}
      />}
    </div>;
  }

  const showInstall = route.kind === "install";
  const freshRoot = !showInstall
    && route.path === "/"
    && (sceneWorkspace.scenes || []).length === 0
    && continuationMaterialCount(extensionHandoff) === 0
    && !route.handoff;
  const showWelcome = freshRoot && !welcomeDismissed && !companionExpanded && !guideOpen && !cursorMode && !emittedView;
  return <div className="orb-universe">
    {showInstall
      ? <InstallLanding install={install} onContinue={continueToLibrary} onRetry={refreshInstall} onHome={() => navigateHome()} />
      : <LibraryHome
          route={route}
          scenes={sceneWorkspace.scenes || []}
          onCreateScene={createBlankScene}
          onOpenGuide={openGuide}
          onContinueHandoff={continueExtensionWork}
          extensionHandoff={extensionHandoff}
          handoffStatus={handoffStatus}
          onRetryHandoff={refreshHandoff}
          activeView={emittedView}
          onView={openEmittedView}
          install={install}
          context={orb.context || []}
          lenses={orb.lenses || []}
          candidates={orb.candidates || []}
          onContextChange={updateOrbContext}
          onContextRemove={removeOrbContext}
          onLensChange={updateOrbLens}
          onLensRemove={removeOrbLens}
          onCandidateTaste={tasteCandidate}
          onOpenStudio={openActivePearlStudio}
          onWearPearl={(pearl) => {
            const runtime = globalThis.__lensOrbRuntime;
            if (typeof runtime?.execute === "function") {
              void runtime.execute([{ verb: "wearPearl", args: { id: pearl.id } }], { title: "Wear" });
              return;
            }
            void command(`put ${pearl.name || pearl.id} in the gauntlet`);
          }}
        />}
    {/* Keep ONE stable App + CompanionChat for Reef. Never bind sceneId here — that remounts
        chat (wiping messages) and fights Scene's runtime over __lensOrbRuntime. */}
    {!showInstall && <div className="orb-runtime-host" data-semantic-anchor="companion-runtime" aria-hidden="true">
      <StageComponent key="reef-companion-runtime" sceneId={null} pearlShell />
    </div>}
    {!cursorMode && <CompanionOrb
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
      onEmitView={openEmittedView}
      onOrbCreate={() => {
        const context = orbRef.current?.context || orb.context || [];
        const dumpText = context
          .map((item) => String(item.text || item.label || item.name || "").trim())
          .filter(Boolean)
          .join("\n\n");
        if (dumpText) {
          void command(`make a pearl from this: ${dumpText.slice(0, 1200)}`);
          return;
        }
        void command("make a pearl about new context");
      }}
      cursorMode={cursorMode}
      onCursorToggle={(enabled) => setCursorMode(enabled, "control")}
      approval={pendingApproval}
      onApproval={decideApproval}
      onWorkerCancel={cancelWorker}
      onOpenStudio={openActivePearlStudio}
      onExpandedChange={(value) => {
        setCompanionExpanded(value);
        if (value) window.dispatchEvent(new CustomEvent("lens:companion-expand"));
      }}
      quickActions={pearlNavQuickActions}
      hint="Talk · type · GO"
    />}
    {showWelcome && <PearlWelcome
      onAsk={() => { dismissWelcome(); window.dispatchEvent(new CustomEvent("lens:companion-expand")); }}
      onDismiss={dismissWelcome}
      onShellNav={(screen) => {
        if (screen.id === "reef") {
          navigateHome();
          return;
        }
        if (screen.id === "scene") {
          createBlankScene({ source: "welcome-shell-nav" });
          return;
        }
        if (screen.id === "install") {
          navigate("/install");
          return;
        }
        if (screen.emit) {
          openEmittedView(screen.emit, screen.id === "settings" ? { panel: "account" } : undefined);
          if (screen.path) navigate(screen.path);
          return;
        }
        if (screen.path) navigate(screen.path);
      }}
    />}
    {guideOpen && <PearlGuidePanel onClose={() => setGuideOpen(false)} onTry={(text) => { setGuideOpen(false); command(text); }} />}
    {cursorMode && <button type="button" className="pearl-cursor-escape" onClick={() => setCursorMode(false, "control")}>Esc</button>}
    <PearlPowerFxOverlay />
    {renderPearlEmission()}
    {(authOpen || supaAuth.passwordRecovery) && <AuthOverlay
      forced={supaAuth.passwordRecovery && isSupabaseConfigured()}
      accountEmail={supaAuth.session?.user?.email || null}
      bootError={authBootError}
      onClose={() => {
        setAuthOpen(false);
        setAuthBootError(null);
        if (supaAuth.passwordRecovery) supaAuth.clearPasswordRecovery();
      }}
      onPasswordUpdated={() => {
        supaAuth.clearPasswordRecovery();
        setAuthOpen(false);
        setAuthBootError(null);
      }}
    />}
  </div>;
}

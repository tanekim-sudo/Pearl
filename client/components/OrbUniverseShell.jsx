import React, { useCallback, useEffect, useMemo, useState } from "react";
import CompanionOrb from "./CompanionOrb.jsx";
import OrbCursorLayer from "./OrbCursorLayer.jsx";
import { createOrbState, recordOrbUtterance, transitionOrb } from "../../shared/orb-runtime.js";
import {
  ORB_CURSOR_EVENT,
  ORB_CURSOR_STORAGE_KEY,
  normalizeOrbCursorPreference,
} from "../../shared/orb-cursor.js";
import { checkTrustedExtensionInstallation, detectExtensionBrowser, trackExtensionFunnel, validChromeStoreUrl } from "../lib/extension-funnel.js";

export const ORB_CONTINUE_KEY = "lens.orb-universe.continued.v1";

export function parseOrbRoute(locationLike = globalThis.location) {
  const path = String(locationLike?.pathname || "/").replace(/\/+$/, "") || "/";
  const audit = new URLSearchParams(locationLike?.search || "");
  if ([...audit.keys()].some((key) => /(?:audit|tour|brush|cognitive|learn)/i.test(key))) {
    return { kind: "stage", path, sceneId: "release-audit", legacyAudit: true };
  }
  if (/^\/(?:stage|scene)(?:\/|$)/.test(path)) return { kind: "stage", path, sceneId: path.split("/")[2] || null };
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

function LibraryHome({ route, activeView, onView }) {
  const title = route.section && route.section !== "library"
    ? route.section[0].toUpperCase() + route.section.slice(1)
    : "Your cognitive universe";
  return <main className="orb-library-home">
    <header className="orb-universe-head">
      <a href="/library" onClick={(event) => { event.preventDefault(); navigate("/library"); }}>LENS</a>
      <span>Extension connected · local universe</span>
      <button type="button" onClick={() => onView(activeView === "library" ? null : "library")}>Library</button>
    </header>
    <section className="orb-home-intro">
      <div className="orb-kicker">Extension-first · Stage on demand</div>
      <h1>{title}</h1>
      <p>Speak a goal, bring material close, or resume a thought.</p>
    </section>
    <section className="orb-recent-orbit" aria-label="Recent scenes and tasks">
      <button className="recent-scene scene-a" onClick={() => navigate("/scene/investor-notes")}><i />Investor notes<small>Scene · 2 hours ago</small></button>
      <button className="recent-scene scene-b" onClick={() => navigate("/tasks")}><i />Research synthesis<small>Task · checkpoint ready</small></button>
      <button className="recent-scene scene-c" onClick={() => navigate("/scene/untitled")}><i />New Scene<small>Begin with an empty working set</small></button>
    </section>
    <p className="orb-home-prompt">Hold the orb to speak · click for command · drag material into its orbit</p>
    {activeView && <aside className="orb-emitted-library" aria-label={`${activeView} emitted by orb`}>
      <div>
        <span>{activeView === "library" ? "Cognitive library" : activeView}</span>
        <button type="button" aria-label="Close emitted view" onClick={() => onView(null)}>×</button>
      </div>
      <input aria-label="Search cognitive library" placeholder="Search Moves, Functions, Lenses, Scenes…" />
      <nav>
        {libraryObjects.map(([name, description, href]) => <a key={name} href={href}>
          <i /> <b>{name}</b><small>{description}</small>
        </a>)}
      </nav>
    </aside>}
  </main>;
}

export default function OrbUniverseShell({ StageComponent }) {
  const route = useRoute();
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
    document.addEventListener(ORB_CURSOR_EVENT, syncExtensionCursor);
    document.addEventListener("lens:orb-cursor-command", commandCursor);
    return () => {
      document.removeEventListener(ORB_CURSOR_EVENT, syncExtensionCursor);
      document.removeEventListener("lens:orb-cursor-command", commandCursor);
    };
  }, [setCursorMode]);

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
    const recorded = recordOrbUtterance(orb, raw, {
      id: `web:${Date.now()}`,
      targetSnapshot: [{ route: route.path }],
    });
    let current = recorded.state.phase === "idle"
      ? recorded.state
      : createOrbState({
          ...recorded.state,
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
        onPhase(phase) {
          const mapped = phaseMap[phase];
          if (!mapped) return;
          setOrb((value) => value.phase === mapped ? value : transitionOrb(value, mapped, { taskId: recorded.entry.id }));
        },
        onPlan(plan) {
          if (!plan) return null;
          setOrb((value) => value.phase === "approval" ? value : transitionOrb(value, "approval", {
            taskId: recorded.entry.id,
            evidence: { title: plan.title, preview: true },
          }));
          return Promise.resolve({ decision: "reject" });
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
        const executing = value.phase === "executing"
          ? value
          : transitionOrb(value, "executing", { taskId: recorded.entry.id, commandId: "companion-plan" });
        return transitionOrb(executing, "completed", {
          taskId: recorded.entry.id,
          commandId: "companion-plan",
          effectId: `companion:${recorded.entry.id}`,
        });
      });
    } catch (error) {
      setOrb((value) => {
        if (value.phase === "blocked") return value;
        const recoverable = ["executing", "paused"].includes(value.phase)
          ? transitionOrb(value, "recovery", { taskId: recorded.entry.id, evidence: { error: error.message } })
          : value;
        return transitionOrb(recoverable, "blocked", { taskId: recorded.entry.id, evidence: { boundary: error.message } });
      });
    }
  }

  async function undoOrbEffect() {
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

  function beginVoice() {
    setOrb((value) => {
      const ready = ["idle", "completed"].includes(value.phase) ? value : createOrbState({ ...value, phase: "idle", effectId: null, commandId: null });
      return transitionOrb(ready, "listening", { taskId: `voice:${Date.now()}` });
    });
  }

  function endVoice() {
    setOrb((value) => value.phase === "listening"
      ? createOrbState({ ...value, phase: "idle", taskId: value.taskId })
      : value);
  }

  function addOrbContext(item) {
    setOrb((value) => ({
      ...value,
      context: [...(value.context || []).filter((entry) => entry.id !== item.id), item].slice(-12),
      phase: "completed",
      effectId: `context:${item.id}`,
      trace: [...(value.trace || []), {
        id: `context:${item.id}`,
        from: value.phase,
        to: "completed",
        commandId: "addOrbContext",
        effectId: `context:${item.id}`,
        at: new Date().toISOString(),
        evidence: { observed: ["orb-context-added"], label: item.label },
      }],
    }));
  }

  if (route.kind === "stage") {
    return <div className="orb-stage-shell" data-semantic-anchor="scene-stage">
      <div className="orb-stage-bar">
        <a href="/library" onClick={(event) => { event.preventDefault(); navigate("/library"); }}>← Library</a>
        <button type="button" onClick={() => setOutputFrameOpen((value) => !value)}>{outputFrameOpen ? "Close Output Frame" : "Open Output Frame"}</button>
      </div>
      <div className="orb-output-frame-host" data-semantic-anchor="output-frame" hidden={!outputFrameOpen}><StageComponent sceneId={route.sceneId} /></div>
      {!outputFrameOpen && (
        <main className="orb-black-stage" aria-label={`Scene ${route.sceneId || "untitled"}`}>
          <div className="orb-stage-context"><span>Scene</span><b>{route.sceneId || "Untitled Scene"}</b><small>Empty working set · add material through the orb, extension, or library</small></div>
          <nav className="orb-adaptive-views" aria-label="Adaptive Scene views">
            {["Stage", "Gallery", "Graph", "Table", "Timeline", "Frame"].map((view) => <button type="button" key={view}>{view}</button>)}
          </nav>
          <section className="orb-stage-empty">
            <span className="orb-stage-locus" aria-hidden="true" />
            <h1>Bring material into this Scene.</h1>
            <p>Drag onto the orb, speak a goal, or open a saved working set. Nothing is created until you choose it.</p>
          </section>
        </main>
      )}
      {!cursorMode && <CompanionOrb key="stage-orb" featured state={orb} onStateChange={setOrb} onCommand={command} onUndo={undoOrbEffect}
        onVoiceStart={beginVoice} onVoiceEnd={endVoice} onContextAdd={addOrbContext} onEmitView={setEmittedView}
        cursorMode={cursorMode} onCursorToggle={(enabled) => setCursorMode(enabled, "control")} />}
      {cursorMode && !externalCursorMode && <OrbCursorLayer state={orb} onDisable={() => setCursorMode(false, "control")} />}
      <span className="sr-only" role="status" aria-live="polite">{cursorMode ? "Orb cursor on" : "Orb cursor off"}</span>
      {emittedView && <aside className="orb-stage-emission" aria-label={`${emittedView} view emitted by orb`}>
        <button type="button" onClick={() => setEmittedView(null)}>Close</button>
        <b>{emittedView === "context" ? "Working context" : "Cognitive library"}</b>
        {emittedView === "context"
          ? (orb.context || []).map((item) => <span key={item.id}>{item.label}</span>)
          : libraryObjects.slice(0, 5).map(([name]) => <span key={name}>{name}</span>)}
      </aside>}
    </div>;
  }

  const showInstall = route.kind === "install" || (route.kind === "home" && !continued && install.status !== "installed");
  return <div className="orb-universe">
    {showInstall ? <InstallLanding install={install} onContinue={continueToLibrary} /> : <LibraryHome route={route} activeView={emittedView} onView={setEmittedView} />}
    {!showInstall && !cursorMode && <CompanionOrb key="home-orb" featured state={orb} onStateChange={setOrb} onCommand={command}
      onVoiceStart={beginVoice} onVoiceEnd={endVoice} onContextAdd={addOrbContext} onEmitView={setEmittedView}
      cursorMode={cursorMode} onCursorToggle={(enabled) => setCursorMode(enabled, "control")} />}
    {!showInstall && cursorMode && !externalCursorMode && <OrbCursorLayer state={orb} onDisable={() => setCursorMode(false, "control")} />}
    {!showInstall && <span className="sr-only" role="status" aria-live="polite">{cursorMode ? "Orb cursor on" : "Orb cursor off"}</span>}
  </div>;
}

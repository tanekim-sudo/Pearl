import React, { useEffect, useMemo, useState } from "react";
import CompanionOrb from "./CompanionOrb.jsx";
import { createOrbState, recordOrbUtterance, transitionOrb } from "../../shared/orb-runtime.js";
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

function Nav({ route }) {
  return <nav className="orb-home-nav" aria-label="Lens">
    <a href="/library" onClick={(event) => { event.preventDefault(); navigate("/library"); }}>Lens</a>
    <a className={route.section === "packages" ? "active" : ""} href="/packages" onClick={(event) => { event.preventDefault(); navigate("/packages"); }}>Packages</a>
    <a className={route.section === "tasks" ? "active" : ""} href="/tasks" onClick={(event) => { event.preventDefault(); navigate("/tasks"); }}>Tasks</a>
    <a className={route.section === "settings" ? "active" : ""} href="/settings" onClick={(event) => { event.preventDefault(); navigate("/settings"); }}>Settings</a>
  </nav>;
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
      <CompanionOrb compact state={createOrbState()} />
    </div>
  </main>;
}

const cards = [
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

function LibraryHome({ route }) {
  const title = route.section && route.section !== "library"
    ? route.section[0].toUpperCase() + route.section.slice(1)
    : "Cognitive library";
  return <>
    <Nav route={route} />
    <main className="orb-library-home">
      <div className="orb-kicker">Extension-first · Stage on demand</div>
      <h1>{title}</h1>
      <p>Moves, Functions, Lenses, reusable packages, saved Scenes, and verified task history—without opening a blank workspace.</p>
      <div className="orb-actions">
        <button className="orb-primary" type="button" onClick={() => navigate(`/scene/${crypto.randomUUID()}`)}>New Scene</button>
        <button className="orb-secondary" type="button" onClick={() => navigate("/install")}>Extension setup</button>
      </div>
      <section className="orb-library-grid" aria-label="Cognitive toolbox">
        {cards.map(([name, description, href, size]) => (
          <a key={name} className={`orb-library-card ${size || ""}`} href={href} onClick={(event) => {
            if (!href.includes("?")) {
              event.preventDefault();
              navigate(href);
            }
          }}>
            <b>{name}</b><span>{description}</span>
          </a>
        ))}
      </section>
    </main>
  </>;
}

export default function OrbUniverseShell({ StageComponent }) {
  const route = useRoute();
  const [install, setInstall] = useState({ status: "checking", trusted: false });
  const [continued, setContinued] = useState(() => localStorage.getItem(ORB_CONTINUE_KEY) === "true");
  const [orb, setOrb] = useState(() => createOrbState());
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
          <aside className="orb-context-drawer" aria-label="Contextual library drawer">
            <b>Library</b><span>Moves</span><span>Functions</span><span>Lenses</span><span>Packages</span>
          </aside>
        </main>
      )}
      <CompanionOrb state={orb} onStateChange={setOrb} onCommand={command} onUndo={undoOrbEffect} />
    </div>;
  }

  const showInstall = route.kind === "install" || (route.kind === "home" && !continued && install.status !== "installed");
  return <div className="orb-universe">
    {showInstall ? <InstallLanding install={install} onContinue={continueToLibrary} /> : <LibraryHome route={route} />}
    {!showInstall && <CompanionOrb state={orb} onStateChange={setOrb} onCommand={command} />}
  </div>;
}

import { createInsertionPlan } from "../../../shared/lens-runtime.js";
import {
  ORB_CURSOR_EVENT,
  ORB_CURSOR_SEQUENCE_ATTRIBUTE,
  createTripleSpaceRecognizer,
  orbCursorPresentation,
} from "../../../shared/orb-cursor.js";
import { createMessage, validateMessage } from "../core/messages.js";
import { sanitizeHtml } from "../core/security.js";
import { applySpecialistPlan, detectAdapter } from "./adapters/specialists.js";
import { createHighlighter } from "./highlighter.js";
import { captureNativeSelection, selectionRects } from "./selection.js";
import { createPearlPageCanvas, pearlCanvasPdfBytes } from "./page-canvas.js";
import { createResultPearlLayer } from "./result-pearls.js";
import { canonicalPageIdentity } from "../../../shared/pearl-page-canvas.js";
import { PHYSICAL_PEARL_CSS, physicalPearlMarkup } from "../../../shared/physical-pearl.js";
import { createPearlGestureArbiter } from "../../../shared/pearl-gesture-arbiter.js";
import { pearlSurroundingFromColor } from "../../../shared/pearl-visual-contract.js";
import {
  ensurePearlPowerFxStyles,
  filamentPath,
  normalizePowerFx,
  radialFissionPoints,
} from "../../../shared/pearl-power-fx.js";
import { findOnScreenMatching, matchRectsForPowerFx } from "../../../shared/pearl-screen-match.js";
import { normalizePearlAesthetic, pearlAestheticStyle } from "../../../shared/pearl-aesthetic.js";
import { MAX_WORN_ORBIT_PEARLS } from "../../../shared/companion-pearl-orbit.js";
import { gauntletSocketLayout, MAX_GAUNTLET_SLOTS } from "../../../shared/companion-pearl-gauntlet.js";

const highlighter = createHighlighter();
const captured = new Map();

function mountPageOrb() {
  if (document.getElementById("lens-orb-overlay-host") || !document.documentElement) return;
  const host = document.createElement("div");
  host.id = "lens-orb-overlay-host";
  host.style.cssText = "all:initial;position:fixed;right:18px;top:42%;z-index:2147483646;pointer-events:none";
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `
    :host{all:initial;color-scheme:dark}
    *{box-sizing:border-box}
    .shell{--focus:#d8ddd9;--pearl-light-x:0;--pearl-light-y:0;--pearl-motion:0;position:relative;width:36px;height:36px;font:11px/1.3 Inter,ui-sans-serif,system-ui,sans-serif;color:#eeede8;touch-action:none;user-select:none}
    button{font:inherit;color:inherit;cursor:pointer}
    .orb{position:absolute;inset:0;width:36px;height:36px;padding:0;display:grid;place-items:center;border:0;border-radius:50%;background:transparent;filter:none;touch-action:none;pointer-events:auto}
    svg{width:36px;height:36px;overflow:visible}.pearl{transform-origin:50px 50px;animation:respire 4s ease-in-out infinite}.shadow{fill:rgba(0,0,0,.16);filter:blur(1.1px)}.state{fill:none;stroke:rgba(232,239,235,.4);stroke-width:.8;opacity:0;stroke-dasharray:2 4}.core{stroke:rgba(255,255,255,.46);stroke-width:.62}.nucleus{mix-blend-mode:soft-light;opacity:.58;transform:translate(calc(var(--pearl-light-x) * -1px),calc(var(--pearl-light-y) * -.8px));transition:opacity .24s ease-out,transform .22s ease-out}.nacre{mix-blend-mode:screen;opacity:calc(.34 + var(--pearl-motion) * .3);transform:translate(calc(var(--pearl-light-x) * 2px),calc(var(--pearl-light-y) * 1.7px));transform-origin:50px 50px;transition:opacity .24s ease-out,transform .18s ease-out}.reflection{fill:rgba(58,69,69,.1);filter:blur(2.2px);transform:translate(calc(var(--pearl-light-x) * -1.2px),calc(var(--pearl-light-y) * -1px));transition:transform .22s ease-out}.rim{stroke-width:.8}.glint{fill:rgba(255,255,255,.26);filter:blur(.45px)}.pinlight{fill:#fff;opacity:.96}
    .shell[data-state=listening] .nucleus,.shell[data-state=absorbing] .nucleus,.shell[data-state=planning] .nucleus{opacity:.82;filter:sepia(.1) saturate(1.06)}.shell[data-state=absorbing] .state,.shell[data-state=planning] .state{opacity:.55}.shell[data-state=branching] .nacre{opacity:.68}.shell[data-state=blocked] .pearl{filter:saturate(.45) brightness(.88)}.shell[data-state=blocked] .nucleus{opacity:.3}
    .phase{position:absolute;top:40px;right:0;white-space:nowrap;text-align:right;color:var(--field-text);background:transparent;padding:2px 0;opacity:0}.shell.dock-left .phase{right:auto;left:0;text-align:left}.shell:not([data-state=idle]) .phase{opacity:.62}
    .orbit{position:absolute;left:18px;top:18px;width:0;height:0;pointer-events:none}.context-dot,.lens-ring,.candidate,.worn-addon,.gauntlet-socket{position:absolute}.context-dot{width:1px;height:10px;border:0;background:linear-gradient(rgba(238,244,240,.06),rgba(238,244,240,.46),rgba(238,244,240,.06));transform:translate(-50%,-50%) rotate(calc(var(--i)*72deg)) translateX(44px)}.lens-ring{width:76px;height:76px;transform:translate(-50%,-50%);border:1px solid rgba(224,235,230,.22);border-radius:50%;opacity:0}.shell.lens .lens-ring{opacity:.55}.candidate{width:16px;height:16px;color:transparent;font-size:0;transform:translate(-50%,-50%) rotate(calc(125deg + var(--i)*28deg)) translateX(56px);opacity:0}.candidate>span:last-child{display:none}.shell.candidates .candidate{opacity:.72}.worn-addon,.gauntlet-socket{width:18px;height:18px;transform:translate(-50%,-50%) rotate(var(--worn-angle,0deg)) translateX(var(--worn-radius,48px)) rotate(calc(-1 * var(--worn-angle,0deg)));opacity:.9}.worn-addon .physical-pearl,.gauntlet-socket .physical-pearl{width:18px;height:18px}.gauntlet-socket.empty{opacity:.72;border:1px solid rgba(140,170,185,.3);border-radius:50%;background:radial-gradient(circle at 50% 42%,rgba(180,210,220,.05) 0 28%,transparent 58%),radial-gradient(circle at 50% 50%,rgba(10,16,20,.72) 0 46%,rgba(18,28,34,.4) 70%,transparent 100%);box-shadow:inset 0 0 0 1px rgba(0,0,0,.35)}.gauntlet-socket.filled{filter:saturate(1.28) brightness(1.08)}.gauntlet-socket.filled .physical-pearl{filter:saturate(1.18) contrast(1.06)}.gauntlet-socket.active{outline:1px solid rgba(180,230,245,.7)}.shell.open .orbit{opacity:.18}.shell.cursor-mode .worn-addon,.shell.cursor-mode .gauntlet-socket{display:none}
    .emission{position:absolute;right:48px;top:-100px;width:300px;display:none;padding:14px 0 14px 16px;color:#efeee8;background:rgba(9,11,12,.98);border:0;border-left:1px solid rgba(235,240,237,.24);border-radius:0;box-shadow:none;pointer-events:auto}.shell.open .emission{display:grid;gap:8px}.emission header{display:flex;align-items:center;justify-content:space-between;padding-right:12px;color:#8e9390;font-size:9px;letter-spacing:.1em;text-transform:uppercase}.emission header b{color:#efeee8;font-weight:600}.emission button,.emission input{min-height:40px;border:0;border-bottom:1px solid rgba(255,255,255,.11);border-radius:0;background:transparent;color:#efeee8;padding:7px;text-align:left}.emission input{width:100%;outline:none}.emission nav{display:grid;grid-template-columns:repeat(3,1fr);gap:0;border-bottom:1px solid rgba(255,255,255,.1)}.emission nav button{text-align:center;font-size:10px}.emission nav button[aria-current=true]{color:var(--focus);border-color:var(--focus)}.view{display:none;gap:0}.view.active{display:grid}.context-list{color:#aaa89f}.context-list b{color:#efeee8}.taste{display:flex;gap:0}.taste button{text-align:center;flex:1}.minimize{position:absolute;right:auto;left:-44px;top:0;width:36px;height:36px;display:none;place-items:center;border:1px solid rgba(255,255,255,.18);border-radius:50%;background:#0e1112}.shell.open .minimize{display:grid}.shell.minimized{width:36px;height:36px}.shell.minimized .orb,.shell.minimized svg{width:36px;height:36px}.shell.minimized .emission,.shell.minimized .orbit{display:none}
    .shell.dock-left .emission{left:48px;right:auto}
    .shell.cursor-mode{width:18px;height:18px;pointer-events:none}.shell.cursor-mode .orb{inset:auto;width:18px;height:18px;pointer-events:none;filter:none}.shell.cursor-mode svg{width:18px;height:18px}.shell.cursor-mode .emission,.shell.cursor-mode .orbit,.shell.cursor-mode .minimize,.shell.cursor-mode .phase{display:none!important}.shell.cursor-mode[data-cursor-presentation=text]{opacity:.72}.shell.cursor-mode[data-cursor-presentation=action] .physical-pearl__hotspot{stroke-width:3}.shell.cursor-mode[data-cursor-presentation=grab] .physical-pearl__nucleus{transform:translate(-1px,1px)}.shell.cursor-mode[data-cursor-presentation=resize]{opacity:.78}.shell.cursor-mode.pressed .orb{transform:scale(.94)}
    .shell .emission{right:48px}.shell.dock-left .emission{left:48px;right:auto}
    .emission form{display:grid;grid-template-columns:minmax(0,1fr) 40px}.emission form input{min-width:0}.emission form button{padding:0;text-align:center}.emission>[data-action=contextual]{width:100%;color:#aeb3b0}
    .emission{color:var(--field-text);background:linear-gradient(90deg,var(--field-edge),transparent 18px),var(--field-bg);border-color:var(--field-line);box-shadow:inset 1px 0 rgba(255,255,255,.08)}
    .emission button,.emission input,.emission>[data-action=contextual]{color:var(--field-text);border-color:var(--field-line);font-weight:420;letter-spacing:.005em}
    .emission input:focus-visible{outline:0;border-bottom-color:var(--field-text)}
    .nacre-fold{mix-blend-mode:screen;opacity:calc(.1 + var(--pearl-motion) * .2);transform:translate(calc(var(--pearl-light-x) * -1.4px),calc(var(--pearl-light-y) * -1.1px));transition:opacity .4s ease-out,transform .52s cubic-bezier(.18,.82,.2,1.08)}
    .pearl{animation:pearl-mass 4s ease-in-out infinite}.nucleus{animation:pearl-ember 8s ease-in-out infinite;transition:opacity .52s ease-out,transform .52s cubic-bezier(.18,.82,.2,1.08)}.nacre{transition:opacity .38s ease-out,transform .38s cubic-bezier(.18,.82,.2,1.08)}
    button:focus-visible,input:focus-visible{outline:1px solid var(--field-text);outline-offset:3px}
    @keyframes respire{0%,100%{transform:scale(.98)}50%{transform:scale(1.02)}}
    @keyframes pearl-mass{0%,100%{transform:scale(.98) rotate(-.12deg)}50%{transform:scale(1.02) rotate(.12deg)}}
    @keyframes pearl-ember{0%,100%{opacity:.54}50%{opacity:.62}}
    @media(max-width:620px){.emission{right:48px;width:min(300px,calc(100vw - 76px))}}
    @media(prefers-reduced-motion:reduce){.pearl,.state,.nucleus,.nacre,.nacre-fold{animation:none!important}.nucleus,.nacre,.nacre-fold,.reflection{transform:none!important;transition:none!important}.shell.cursor-mode.pressed .orb{transform:none}}
    @media(prefers-contrast:more){.core{stroke:#fff}.emission{border:1px solid #fff}}
    ${PHYSICAL_PEARL_CSS}
  `;
  const shell = document.createElement("div");
  shell.className = "shell";
  shell.dataset.state = "idle";
  const orb = document.createElement("button");
  orb.className = "orb";
  orb.type = "button";
  orb.setAttribute("aria-label", "Pearl. Hold to speak, click to expand, drag to move, or drop material here");
  orb.setAttribute("aria-expanded", "false");
  orb.innerHTML = `${physicalPearlMarkup({ id: "page-primary-pearl", variant: "primary", state: "idle", size: 36, decorative: true })}<span class="phase">Listening</span>`;
  const orbit = document.createElement("div");
  orbit.className = "orbit";
  orbit.innerHTML = `<span class="lens-ring"></span>${[0,1,2,3,4].map((i) => `<span class="context-dot" style="--i:${i}" hidden></span>`).join("")}`;
  const emission = document.createElement("section");
  emission.className = "emission";
  emission.setAttribute("aria-label", "Pearl command");
  emission.innerHTML = `<form><input aria-label="Tell Pearl your goal" placeholder="What do you want?"><button type="submit" aria-label="GO — run staged command">→</button></form><button type="button" data-action="contextual">Keep selection</button><span hidden data-context-count></span><span hidden data-active-lens></span><span hidden data-candidate-count></span>`;
  const minimize = document.createElement("button");
  minimize.className = "minimize";
  minimize.type = "button";
  minimize.setAttribute("aria-label", "Minimize Pearl");
  minimize.textContent = "−";
  shell.append(orbit, orb, emission);
  shadow.append(style, shell);
  document.documentElement.append(host);
  const pageColor = getComputedStyle(document.body || document.documentElement).backgroundColor.match(/\d+(?:\.\d+)?/g)?.map(Number) || [255, 255, 255];
  const pageLuminance = (pageColor[0] * .2126 + pageColor[1] * .7152 + pageColor[2] * .0722) / 255;
  const lightSurface = pageColor[3] === 0 || pageLuminance > .5;
  host.style.setProperty("--field-bg", lightSurface ? "rgba(250,250,247,.9)" : "rgba(9,11,12,.9)");
  host.style.setProperty("--field-text", lightSurface ? "#262a29" : "#efeee9");
  host.style.setProperty("--field-line", lightSurface ? "rgba(21,25,24,.18)" : "rgba(239,242,239,.16)");
  host.style.setProperty("--field-edge", lightSurface ? "rgba(255,255,255,.7)" : "rgba(255,255,255,.08)");

  let press = null;
  let holdTimer = null;
  let moved = false;
  let contextCount = 0;
  let pendingPearlCapture = null;
  const renderCandidates = (outputs = []) => {
    orbit.querySelectorAll(".candidate").forEach((candidate) => candidate.remove());
    outputs.slice(0, 3).forEach((output, index) => {
      const candidate = document.createElement("span");
      candidate.className = "candidate";
      candidate.style.setProperty("--i", index);
      candidate.innerHTML = physicalPearlMarkup({ id: `page-candidate-${index}`, variant: "candidate", state: "new", size: 16, decorative: true });
      const label = document.createElement("span");
      label.textContent = String(output.distinction || output.text || `Candidate ${index + 1}`).trim().split(/\s+/).slice(0, 6).join(" ");
      candidate.appendChild(label);
      orbit.appendChild(candidate);
    });
  };
  const hydrate = (session) => {
    if (!session) return;
    contextCount = Math.min(5, Array.isArray(session.fragments) ? session.fragments.length : contextCount);
    shell.querySelectorAll(".context-dot").forEach((dot, index) => { dot.hidden = index >= contextCount; });
    shell.querySelector("[data-context-count]").textContent = contextCount ? `${contextCount} captured context ${contextCount === 1 ? "object" : "objects"}` : "No material yet";
    shell.querySelector('[data-action="contextual"]').textContent = contextCount ? "Keep this" : "Notice selection";
    shell.classList.toggle("lens", Boolean(session.generator));
    shell.querySelector("[data-active-lens]").textContent = session.generator ? `${session.generator.name || session.generator.title || "Active Lens"} · active` : "New chat · no active Lens";
    const outputs = session.results?.flatMap((run) => run.outputs || []) || [];
    shell.classList.toggle("candidates", outputs.length > 0);
    shell.querySelector("[data-candidate-count]").textContent = outputs.length ? `${outputs.length} staged candidate${outputs.length === 1 ? "" : "s"}` : "No staged candidates";
    renderCandidates(outputs);
    if ((contextCount > 0 || session.generator || outputs.length > 0) && shell.dataset.state === "blocked") setState("idle");
  };
  const syncSession = (changes, area) => {
    if (area === "session" && changes.lensEverywhereSession?.newValue) hydrate(changes.lensEverywhereSession.newValue);
  };
  globalThis.chrome?.storage?.onChanged?.addListener(syncSession);
  window.addEventListener("pagehide", () => globalThis.chrome?.storage?.onChanged?.removeListener(syncSession), { once: true });
  let cursorEnabled = false;
  let cursorFrame = 0;
  let cursorPoint = { x: innerWidth / 2, y: innerHeight / 2 };
  let cursorMotion = { x: innerWidth / 2, y: innerHeight / 2, vx: 0, vy: 0, at: 0 };
  let lightPoint = { x: 0, y: 0, at: 0 };
  let lightTimer = 0;
  let sequenceTimer = 0;
  let sequenceScroll = null;
  const recognizer = createTripleSpaceRecognizer({ intervalMs: 650 });
  const dockedStyle = () => ({
    left: host.style.left,
    right: host.style.right,
    top: host.style.top,
  });
  let docked = dockedStyle();
  const notifyCursorMode = () => {
    document.documentElement.setAttribute("data-lens-orb-cursor-active", String(cursorEnabled));
    document.dispatchEvent(new Event(ORB_CURSOR_EVENT));
  };
  const renderCursor = (now = performance.now()) => {
    if (!cursorEnabled) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const elapsed = Math.min(48, cursorMotion.at ? now - cursorMotion.at : 16);
    if (reduced || elapsed > 40) {
      cursorMotion.vx = 0;
      cursorMotion.vy = 0;
    } else {
      const decay = Math.exp(-elapsed / 54);
      cursorMotion.vx *= decay;
      cursorMotion.vy *= decay;
    }
    cursorMotion.at = now;
    shell.style.setProperty("--pearl-light-x", String(reduced ? 0 : Math.max(-1, Math.min(1, cursorMotion.vx / 420))));
    shell.style.setProperty("--pearl-light-y", String(reduced ? 0 : Math.max(-1, Math.min(1, cursorMotion.vy / 420))));
    shell.style.setProperty("--pearl-motion", String(reduced ? 0 : Math.min(1, Math.hypot(cursorMotion.vx, cursorMotion.vy) / 900)));
    if (!reduced && Math.hypot(cursorMotion.vx, cursorMotion.vy) > 4) {
      cursorFrame = requestAnimationFrame(renderCursor);
    } else {
      cursorFrame = 0;
    }
  };
  const clearSpaceSequence = () => {
    recognizer.reset();
    sequenceScroll = null;
    window.clearTimeout(sequenceTimer);
    document.documentElement.removeAttribute(ORB_CURSOR_SEQUENCE_ATTRIBUTE);
  };
  const setCursorEnabled = async (next, { source = "control", persist = true } = {}) => {
    const value = next === true;
    if (value === cursorEnabled) return cursorEnabled;
    if (value) docked = dockedStyle();
    cursorEnabled = value;
    shell.classList.toggle("cursor-mode", value);
    shell.classList.remove("open", "minimized");
    shell.dataset.cursorPresentation = "precision";
    const visual = shell.querySelector(".physical-pearl");
    if (visual) {
      visual.dataset.pearlVariant = value ? "cursor" : "primary";
      visual.setAttribute("width", value ? "18" : "36");
      visual.setAttribute("height", value ? "18" : "36");
    }
    host.style.pointerEvents = value ? "none" : "";
    orb.setAttribute("aria-expanded", "false");
    if (value) {
      cursorMotion.x = cursorPoint.x;
      cursorMotion.y = cursorPoint.y;
      host.style.left = `${cursorMotion.x - 9}px`;
      host.style.right = "auto";
      host.style.top = `${cursorMotion.y - 9}px`;
      renderCursor();
    }
    else {
      cancelAnimationFrame(cursorFrame);
      cursorFrame = 0;
      host.style.left = docked.left;
      host.style.right = docked.right || "18px";
      host.style.top = docked.top || "42%";
      shell.classList.remove("pressed");
    }
    notifyCursorMode();
    if (persist) {
      try {
        await send("orb-cursor-set", { enabled: value, source });
      } catch {
        if (value) return setCursorEnabled(false, { source: "recovery", persist: false });
      }
    }
    return cursorEnabled;
  };
  const toggleCursor = (source = "control") => setCursorEnabled(!cursorEnabled, { source });
  const onCursorMove = (event) => {
    const now = event.timeStamp || performance.now();
    if (!cursorEnabled) {
      const bounds = orb.getBoundingClientRect();
      const x = Math.max(-1, Math.min(1, (event.clientX - bounds.left - bounds.width / 2) / 80));
      const y = Math.max(-1, Math.min(1, (event.clientY - bounds.top - bounds.height / 2) / 80));
      const speed = Math.min(1, Math.hypot(x - lightPoint.x, y - lightPoint.y) * 120 / Math.max(16, now - lightPoint.at));
      shell.style.setProperty("--pearl-light-x", x.toFixed(3));
      shell.style.setProperty("--pearl-light-y", y.toFixed(3));
      shell.style.setProperty("--pearl-motion", speed.toFixed(3));
      window.clearTimeout(lightTimer);
      lightTimer = window.setTimeout(() => shell.style.setProperty("--pearl-motion", "0"), 140);
      lightPoint = { x, y, at: now };
      return;
    }
    const elapsed = Math.max(8, Math.min(48, now - (cursorMotion.at || now - 16)));
    cursorPoint = { x: event.clientX, y: event.clientY };
    cursorMotion.vx = (cursorPoint.x - cursorMotion.x) / elapsed * 1000;
    cursorMotion.vy = (cursorPoint.y - cursorMotion.y) / elapsed * 1000;
    cursorMotion.x = cursorPoint.x;
    cursorMotion.y = cursorPoint.y;
    cursorMotion.at = now;
    host.style.left = `${cursorMotion.x - 9}px`;
    host.style.right = "auto";
    host.style.top = `${cursorMotion.y - 9}px`;
    shell.dataset.cursorPresentation = orbCursorPresentation(event.target, (target) => getComputedStyle(target));
    if (!cursorFrame) cursorFrame = requestAnimationFrame(renderCursor);
  };
  const onCursorDown = (event) => {
    if (cursorEnabled && event.button === 0) shell.classList.add("pressed");
  };
  const onCursorUp = () => shell.classList.remove("pressed");
  const onCursorKey = (event) => {
    if (event.key === "Escape" && shell.classList.contains("open")) {
      shell.classList.remove("open");
      orb.setAttribute("aria-expanded", "false");
      event.preventDefault();
      return;
    }
    if (event.key === "Escape" && cursorEnabled) {
      event.preventDefault();
      event.stopPropagation();
      setCursorEnabled(false, { source: "control" });
      return;
    }
    const result = recognizer.accept(event);
    if (!result.accepted) {
      clearSpaceSequence();
      return;
    }
    if (result.count === 1) sequenceScroll = { x: scrollX, y: scrollY };
    document.documentElement.setAttribute(ORB_CURSOR_SEQUENCE_ATTRIBUTE, "true");
    window.clearTimeout(sequenceTimer);
    sequenceTimer = window.setTimeout(clearSpaceSequence, 690);
    if (!result.matched) return;
    event.preventDefault();
    event.stopPropagation();
    if (sequenceScroll && (scrollX !== sequenceScroll.x || scrollY !== sequenceScroll.y)) {
      scrollTo(sequenceScroll.x, sequenceScroll.y);
    }
    clearSpaceSequence();
    toggleCursor("triple-space");
  };
  const setState = (state) => {
    shell.dataset.state = state;
    const visual = shell.querySelector(".physical-pearl");
    if (visual) visual.dataset.pearlState = state === "blocked" ? "blocked" : state === "listening" ? "listening" : ["absorbing", "planning", "branching"].includes(state) ? "executing" : "idle";
    shell.querySelector(".phase").textContent = state === "listening" ? "Listening" : state === "absorbing" ? "Adding context" : state;
  };
  const toggle = () => {
    const open = !shell.classList.contains("open");
    shell.classList.toggle("open", open);
    orb.setAttribute("aria-expanded", String(open));
    if (open) requestAnimationFrame(() => emission.querySelector("input")?.focus());
  };
  const gesture = createPearlGestureArbiter({
    onSingle: toggle,
    onTriple: () => send("pearl-open-studio", {}).catch(() => {
      shell.querySelector(".phase").textContent = "Studio could not open";
      setState("blocked");
    }),
  });
  const minimizeOrb = () => {
    shell.classList.toggle("minimized");
    shell.classList.remove("open");
    orb.setAttribute("aria-expanded", "false");
  };
  const absorb = async (settle = true) => {
    setState("absorbing");
    await send("toggle-highlighter", { enabled: true }).catch(() => {});
    const response = await send("capture-selection").catch(() => null);
    if (!response) {
      setState("blocked");
      shell.querySelector(".phase").textContent = "Select page material, then retry";
      return null;
    }
    const added = response.fragments?.length || 1;
    contextCount = Math.min(5, contextCount + added);
    shell.querySelectorAll(".context-dot").forEach((dot, index) => { dot.hidden = index >= contextCount; });
    shell.querySelector("[data-context-count]").textContent = `${contextCount} captured context ${contextCount === 1 ? "object" : "objects"}`;
    shell.querySelector('[data-action="contextual"]').textContent = "Keep this";
    send("get-session").then(hydrate).catch(() => {});
    if (settle) window.setTimeout(() => setState("idle"), 700);
    return response;
  };
  const makePearl = async () => {
    const preselected = await pendingPearlCapture;
    pendingPearlCapture = null;
    const captured = preselected?.length
      ? await send("fragments-changed", { fragments: preselected }).catch(() => null)
      : await absorb(false);
    if (!captured) return;
    if (preselected?.length) {
      contextCount = Math.min(5, contextCount + preselected.length);
      shell.querySelectorAll(".context-dot").forEach((dot, index) => { dot.hidden = index >= contextCount; });
      shell.querySelector("[data-context-count]").textContent = `${contextCount} captured context ${contextCount === 1 ? "object" : "objects"}`;
      shell.querySelector('[data-action="contextual"]').textContent = "Keep this";
    }
    const response = await send("make-pearl", { idempotencyKey: `page-pearl:${Date.now()}` }).catch(() => null);
    if (!response?.pearl) {
      setState("blocked");
      shell.querySelector(".phase").textContent = "Select page material, then retry";
      return;
    }
    setState("settling");
    shell.querySelector(".phase").textContent = `Pearl made · ${response.pearl.name}`;
    window.setTimeout(() => setState("idle"), 1600);
  };
  orb.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    orb.setPointerCapture(event.pointerId);
    const rect = host.getBoundingClientRect();
    press = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
    moved = false;
    holdTimer = window.setTimeout(() => {
      if (!moved) {
        gesture.hold({ pointerId: event.pointerId });
        setState("listening");
      }
    }, 420);
  });
  orb.addEventListener("pointermove", (event) => {
    if (!press || press.id !== event.pointerId) return;
    const dx = event.clientX - press.x;
    const dy = event.clientY - press.y;
    if (Math.hypot(dx, dy) < 4) return;
    moved = true;
    window.clearTimeout(holdTimer);
    host.style.right = "auto";
    host.style.left = `${Math.max(8, Math.min(innerWidth - shell.offsetWidth - 8, press.left + dx))}px`;
    host.style.top = `${Math.max(8, Math.min(innerHeight - shell.offsetHeight - 8, press.top + dy))}px`;
  });
  orb.addEventListener("pointerup", (event) => {
    window.clearTimeout(holdTimer);
    if (shell.dataset.state === "listening") {
      gesture.reset();
      setState("idle");
    }
    else gesture.release({ at: event.timeStamp, x: event.clientX, y: event.clientY, dragged: moved, pointerType: event.pointerType });
    if (moved) {
      const rect = host.getBoundingClientRect();
      if (rect.left > innerWidth / 2) { host.style.left = "auto"; host.style.right = "18px"; shell.classList.remove("dock-left"); }
      else { host.style.left = "18px"; host.style.right = "auto"; shell.classList.add("dock-left"); }
    }
    press = null;
  });
  orb.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.shiftKey) {
      event.preventDefault();
      gesture.keyboard(event);
    }
  });
  orb.addEventListener("dragover", (event) => event.preventDefault());
  orb.addEventListener("drop", async (event) => {
    event.preventDefault();
    const portable = event.dataTransfer?.getData("application/x-lens-object");
    const text = event.dataTransfer?.getData("text/plain")?.trim();
    let object = null;
    try { object = portable ? JSON.parse(portable) : null; } catch { /* plain text is still explicit material */ }
    if (object && ["lens", "generator"].includes(object.kind || object.type)) {
      setState("absorbing");
      await send("set-generator", { generator: object }).catch(() => null);
      shell.classList.add("lens");
      shell.querySelector("[data-active-lens]").textContent = `${object.name || object.label || "Lens"} · active`;
      window.setTimeout(() => setState("idle"), 700);
      return;
    }
    if (object && ["move", "function", "operator"].includes(object.kind || object.type || object.libraryKind)) {
      setState("planning");
      await send("queue-lens", { lens: object }).catch(() => null);
      window.setTimeout(() => setState("idle"), 700);
      return;
    }
    if (!text && !object) return;
    setState("absorbing");
    await send("fragments-changed", { fragments: [{
      ...(object || {}),
      id: object?.id || `orb-drop:${Date.now()}`,
      quote: String(object?.quote || object?.text || text).slice(0, 50_000),
      provenance: object?.provenance || { title: document.title, origin: location.origin, url: location.href, capturedAt: new Date().toISOString() },
    }] }).catch(() => {});
    contextCount = Math.min(5, contextCount + 1);
    shell.querySelectorAll(".context-dot").forEach((dot, index) => { dot.hidden = index >= contextCount; });
    window.setTimeout(() => setState("idle"), 700);
  });
  minimize.addEventListener("click", minimizeOrb);
  emission.addEventListener("pointerdown", (event) => {
    if (!event.target.closest('[data-action="contextual"]')) return;
    try {
      pendingPearlCapture = Promise.resolve(captureNativeSelection());
    } catch {
      pendingPearlCapture = Promise.resolve([]);
    }
  });
  emission.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "contextual") {
      makePearl();
      shell.classList.remove("open");
      orb.setAttribute("aria-expanded", "false");
    }
  });
  emission.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = emission.querySelector("input");
    const intent = input?.value?.trim();
    if (!intent) return;
    send("open-side-panel", { intent }).catch(() => {});
    input.value = "";
    shell.classList.remove("open");
    orb.setAttribute("aria-expanded", "false");
  });
  addEventListener("pointerdown", (event) => {
    if (!shell.classList.contains("open") || event.composedPath().includes(host)) return;
    shell.classList.remove("open");
    orb.setAttribute("aria-expanded", "false");
  }, true);
  addEventListener("pointermove", onCursorMove, { capture: true, passive: true });
  addEventListener("pointerdown", onCursorDown, { capture: true, passive: true });
  addEventListener("pointerup", onCursorUp, { capture: true, passive: true });
  addEventListener("pointercancel", onCursorUp, { capture: true, passive: true });
  addEventListener("keydown", onCursorKey, true);
  send("orb-cursor-get").then((value) => {
    if (value?.enabled) setCursorEnabled(true, { source: "restore", persist: true });
  }).catch(() => {});
  const surroundingColor = getComputedStyle(document.body || document.documentElement).backgroundColor.match(/[\d.]+/g)?.map(Number) || [];
  const surrounding = (document.body?.innerText?.length || 0) > 4_000
    ? "text-heavy"
    : pearlSurroundingFromColor({ r: surroundingColor[0], g: surroundingColor[1], b: surroundingColor[2], a: surroundingColor[3] });
  shell.querySelector(".physical-pearl")?.setAttribute("data-pearl-surrounding", surrounding);
  send("get-session").then(hydrate).catch(() => {});
  return {
    hydrate,
    setEnabled: setCursorEnabled,
    toggle: toggleCursor,
    animate(animation) {
      const visual = shell.querySelector(".physical-pearl");
      if (!visual || !animation?.semantic) return false;
      visual.dataset.pearlAnimation = animation.semantic;
      if (["absorbing", "planning", "branching", "executing"].includes(animation.semantic) || animation.semantic === "charge" || animation.semantic === "stream") {
        setState("planning");
      }
      window.setTimeout(() => {
        if (visual.dataset.pearlAnimation === animation.semantic) delete visual.dataset.pearlAnimation;
        if (shell.dataset.state === "planning") setState("idle");
      }, Math.max(0, Number(animation.durationMs) || 0) + 40);
      return true;
    },
    powerFx(effect) {
      return playExtensionPowerFx(effect, host);
    },
    applyAesthetic(aestheticInput) {
      if (!aestheticInput) return false;
      const aesthetic = normalizePearlAesthetic(aestheticInput);
      const vars = pearlAestheticStyle(aesthetic);
      const visual = shell.querySelector(".physical-pearl") || shell.querySelector(".orb");
      const hostNode = visual?.closest?.(".physical-pearl") ? visual : shell.querySelector(".orb");
      const target = hostNode || shell;
      target.dataset.pearlAesthetic = aesthetic.preset;
      target.dataset.pearlSurrounding = aesthetic.surrounding;
      for (const [key, value] of Object.entries(vars)) target.style.setProperty(key, value);
      return true;
    },
    setWornOrbit(packs = [], options = {}) {
      orbit.querySelectorAll(".worn-addon, .gauntlet-socket").forEach((node) => node.remove());
      const list = (Array.isArray(packs) ? packs : []).slice(0, MAX_WORN_ORBIT_PEARLS);
      const byId = Object.fromEntries(list.map((pack) => [pack.pearlId || pack.id, pack]));
      const slotIds = Array.isArray(options.slots)
        ? options.slots.slice(0, MAX_GAUNTLET_SLOTS)
        : list.map((pack) => pack.pearlId || pack.id);
      while (slotIds.length < MAX_GAUNTLET_SLOTS) slotIds.push(null);
      const layouts = gauntletSocketLayout({ radius: 48, startDeg: -110 });
      const activeSlot = Number.isInteger(options.activeSlot) ? options.activeSlot : slotIds.findIndex(Boolean);
      layouts.forEach((layout, index) => {
        const pearlId = slotIds[index];
        const pack = pearlId ? byId[pearlId] || { pearlId, name: pearlId } : null;
        const node = document.createElement("span");
        node.className = `gauntlet-socket${pack ? " filled worn-addon" : " empty"}${activeSlot === index ? " active" : ""}`;
        node.title = pack ? (pack.name || pack.pearlId || "Active pearl") : `Empty gauntlet socket ${index + 1}`;
        Object.assign(node.style, layout.css || {});
        if (pack) {
          node.innerHTML = physicalPearlMarkup({
            id: `page-worn-${index}`,
            variant: "semantic",
            state: activeSlot === index ? "listening" : "idle",
            size: 18,
            decorative: true,
            aesthetic: pack.aesthetic || null,
          });
        }
        orbit.append(node);
      });
      return list.length;
    },
    seekTo(point, durationMs = 700) {
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
      const box = host.getBoundingClientRect();
      const from = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
      playExtensionPowerFx({ kind: "seek", from, to: point, durationMs });
      const startLeft = Number.parseFloat(host.style.left || "0") || box.left;
      const startTop = Number.parseFloat(host.style.top || "0") || box.top;
      host.style.right = "auto";
      host.style.left = `${startLeft}px`;
      host.style.top = `${startTop}px`;
      host.style.transition = matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "none"
        : `left ${durationMs}ms cubic-bezier(.2,.7,.2,1), top ${durationMs}ms cubic-bezier(.2,.7,.2,1)`;
      requestAnimationFrame(() => {
        host.style.left = `${Math.max(8, point.x - 9)}px`;
        host.style.top = `${Math.max(8, point.y - 9)}px`;
      });
      window.setTimeout(() => { host.style.transition = ""; }, durationMs + 40);
      return true;
    },
    findMatching(condition, options = {}) {
      const result = findOnScreenMatching(document.body, condition, options);
      const rects = matchRectsForPowerFx(result);
      const box = host.getBoundingClientRect();
      const from = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
      playExtensionPowerFx({ kind: "filament", from, toRects: rects });
      this.animate({ semantic: "filament", durationMs: 900 });
      return result;
    },
    get enabled() { return cursorEnabled; },
    destroy() {
      clearSpaceSequence();
      window.clearTimeout(lightTimer);
      cancelAnimationFrame(cursorFrame);
      removeEventListener("pointermove", onCursorMove, true);
      removeEventListener("pointerdown", onCursorDown, true);
      removeEventListener("pointerup", onCursorUp, true);
      removeEventListener("pointercancel", onCursorUp, true);
      removeEventListener("keydown", onCursorKey, true);
      cursorEnabled = false;
      notifyCursorMode();
      host.remove();
    },
  };
}

function playExtensionPowerFx(effect, orbHost = null) {
  ensurePearlPowerFxStyles(document);
  const fx = normalizePowerFx(effect);
  let layer = document.getElementById("lens-pearl-power-fx");
  if (!layer) {
    layer = document.createElement("div");
    layer.id = "lens-pearl-power-fx";
    layer.className = "pearl-power-fx-host";
    layer.setAttribute("aria-hidden", "true");
    document.documentElement.appendChild(layer);
  }
  const stamp = document.createElement("div");
  stamp.dataset.fxId = fx.id;
  stamp.style.cssText = "position:absolute;inset:0;pointer-events:none";
  if (fx.kind === "filament" || fx.toRects.length) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "pearl-power-fx__layer");
    svg.style.cssText = "position:absolute;inset:0;width:100%;height:100%;overflow:visible";
    for (const rect of fx.toRects) {
      const to = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("class", "pearl-power-fx__filament");
      path.setAttribute("d", filamentPath(fx.from, to));
      svg.appendChild(path);
      const mark = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      mark.setAttribute("class", "pearl-power-fx__mark");
      mark.setAttribute("x", String(rect.x - 2));
      mark.setAttribute("y", String(rect.y - 2));
      mark.setAttribute("width", String(Math.max(8, rect.width + 4)));
      mark.setAttribute("height", String(Math.max(8, rect.height + 4)));
      mark.setAttribute("rx", "3");
      svg.appendChild(mark);
    }
    stamp.appendChild(svg);
  }
  if (fx.kind === "fission" || fx.kind === "echo") {
    const satellites = fx.satellites.length ? fx.satellites : radialFissionPoints(fx.from, fx.count);
    for (const satellite of satellites) {
      const node = document.createElement("div");
      node.className = "pearl-power-fx__satellite";
      node.dataset.kind = fx.kind;
      node.style.left = `${fx.from.x}px`;
      node.style.top = `${fx.from.y}px`;
      node.style.setProperty("--dx", `${satellite.x - fx.from.x}px`);
      node.style.setProperty("--dy", `${satellite.y - fx.from.y}px`);
      node.style.setProperty("--fx-ms", `${fx.durationMs}ms`);
      stamp.appendChild(node);
    }
  }
  if (fx.kind === "burst" || fx.kind === "charge") {
    const ring = document.createElement("div");
    ring.className = fx.kind === "charge" ? "pearl-power-fx__charge-ring" : "pearl-power-fx__burst";
    ring.style.left = `${fx.from.x}px`;
    ring.style.top = `${fx.from.y}px`;
    stamp.appendChild(ring);
  }
  if (fx.kind === "seek" && fx.to) {
    const ghost = document.createElement("div");
    ghost.className = "pearl-power-fx__seek-ghost";
    ghost.style.left = `${fx.from.x}px`;
    ghost.style.top = `${fx.from.y}px`;
    ghost.style.setProperty("--dx", `${fx.to.x - fx.from.x}px`);
    ghost.style.setProperty("--dy", `${fx.to.y - fx.from.y}px`);
    ghost.style.setProperty("--fx-ms", `${fx.durationMs}ms`);
    stamp.appendChild(ghost);
  }
  layer.appendChild(stamp);
  if (orbHost && (fx.kind === "charge" || fx.kind === "filament")) {
    const visual = orbHost.shadowRoot?.querySelector?.(".physical-pearl");
    if (visual) {
      visual.dataset.pearlAnimation = fx.kind === "charge" ? "charge" : "filament";
      window.setTimeout(() => { delete visual.dataset.pearlAnimation; }, fx.durationMs + 40);
    }
  }
  window.setTimeout(() => stamp.remove(), Math.max(320, fx.durationMs) + 80);
  return true;
}

async function send(type, payload = {}) {
  const response = await globalThis.chrome?.runtime?.sendMessage(createMessage(type, payload));
  if (response?.ok === false) throw new Error(response.error || "extension request failed");
  return response?.value ?? response;
}

const pageOrb = mountPageOrb();
const pageCanvas = createPearlPageCanvas({ send });
const resultPearls = createResultPearlLayer({ send });
send("result-pearl-get", { pageIdentity: canonicalPageIdentity(location.href) })
  .then((value) => resultPearls.hydrate(value?.results || []))
  .catch(() => {});

async function capture() {
  if (!highlighter.enabled) return [];
  const fragments = captureNativeSelection();
  const rects = selectionRects();
  for (const fragment of fragments) {
    captured.set(fragment.id, fragment);
    highlighter.add(fragment.id, rects);
  }
  if (fragments.length) await send("fragments-changed", { fragments });
  return fragments;
}

document.addEventListener("mouseup", () => queueMicrotask(() => capture().catch(() => {})), true);
document.addEventListener("keyup", (event) => {
  if (event.key === "Shift" || event.key.startsWith("Arrow")) queueMicrotask(() => capture().catch(() => {}));
}, true);
globalThis.addEventListener("scroll", highlighter.rerender, { passive: true });
globalThis.addEventListener("pagehide", () => {
  send("clear-fragments", { navigation: true }).catch(() => {});
  send("orb-cursor-set", { enabled: false, source: "navigation" }).catch(() => {});
  pageOrb?.destroy();
  highlighter.destroy();
});

globalThis.chrome?.runtime?.onMessage.addListener((message, _sender, respond) => {
  const validated = validateMessage(message);
  if (!validated.ok) {
    respond({ ok: false, error: validated.error });
    return false;
  }
  const { type, payload } = validated.value;
  Promise.resolve().then(async () => {
    if (type === "toggle-highlighter") return { ok: true, enabled: highlighter.toggle(payload.enabled) };
    if (type === "toggle-orb-cursor") {
      const enabled = await pageOrb?.setEnabled(payload.enabled ?? !pageOrb.enabled, { source: payload.source || "control" });
      return { ok: true, enabled };
    }
    if (type === "capture-selection") return { ok: true, fragments: await capture(), adapter: detectAdapter() };
    if (type === "capture-page-text") {
      const limit = Math.max(200, Math.min(24_000, Number(payload.limit) || 12_000));
      const root = document.querySelector("main, article, [role='main'], .deck, .slides") || document.body;
      const text = String(root?.innerText || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, limit);
      return {
        ok: true,
        text,
        quote: text,
        title: document.title || "",
        url: location.href,
        characters: text.length,
        adapter: detectAdapter(),
      };
    }
    if (type === "page-canvas-state") {
      pageCanvas.hydrate(payload.canvas || null);
      return { ok: true };
    }
    if (type === "page-canvas-export-pdf") return { ok: true, ...pageCanvas.downloadPdf() };
    if (type === "result-pearl-layout-request") return { ok: true, ...resultPearls.layout(payload) };
    if (type === "output-routing-observe") return { ok: true, observation: resultPearls.observe() };
    if (type === "pearl-effect-animation") return { ok: true, animated: pageOrb?.animate(payload.animation) === true, receiptId: payload.effectReceiptId || null };
    if (type === "pearl-power-fx") {
      const box = pageOrb ? document.getElementById("lens-orb-overlay-host")?.getBoundingClientRect() : null;
      const from = payload.from || (box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : { x: innerWidth - 36, y: innerHeight * 0.42 });
      return { ok: true, played: pageOrb?.powerFx({ ...payload, from }) === true };
    }
    if (type === "pearl-seek-to") {
      return { ok: true, sought: pageOrb?.seekTo(payload.point || payload, payload.durationMs) === true };
    }
    if (type === "pearl-find-matching") {
      const result = pageOrb?.findMatching(payload.condition, { limit: payload.limit }) || findOnScreenMatching(document.body, payload.condition, { limit: payload.limit });
      return { ok: true, result };
    }
    if (type === "pearl-aesthetic-apply") {
      return { ok: true, applied: pageOrb?.applyAesthetic(payload.aesthetic) === true };
    }
    if (type === "pearl-worn-orbit") {
      const packs = Array.isArray(payload.packs)
        ? payload.packs
        : (payload.pearlIds || []).map((pearlId) => ({ pearlId, name: pearlId }));
      return {
        ok: true,
        count: pageOrb?.setWornOrbit(packs.slice(0, MAX_GAUNTLET_SLOTS), {
          slots: payload.slots,
          activeSlot: payload.activeSlot,
          capacity: payload.capacity || MAX_GAUNTLET_SLOTS,
        }) ?? 0,
      };
    }
    if (type === "output-placement-effect") {
      const destination = payload.destination || {};
      if (destination.type === "clipboard") {
        await navigator.clipboard.writeText(String(payload.text || ""));
        return { ok: true, effect: { type: "clipboard", characters: String(payload.text || "").length } };
      }
      if (destination.type === "download" || destination.type === "pdf") {
        const pdf = destination.type === "pdf";
        const bytes = pdf
          ? pearlCanvasPdfBytes({ pearlId: payload.resultId, artifacts: [{ type: "output", text: String(payload.text || "") }] })
          : String(payload.text || "");
        const blob = new Blob([bytes], { type: pdf ? "application/pdf" : destination.file?.type || "text/plain" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = String(destination.file?.name || (pdf ? "pearl-output.pdf" : "pearl-output.txt")).replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 180);
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1_000);
        return { ok: true, effect: { type: destination.type, bytes: blob.size, fileName: anchor.download } };
      }
      throw new Error("the confirmed output destination is unsupported on this page");
    }
    if (type === "result-pearl-state") {
      resultPearls.hydrate(payload.results || []);
      return { ok: true };
    }
    if (type === "remove-fragment") {
      captured.delete(payload.id);
      highlighter.remove(payload.id);
      return { ok: true };
    }
    if (type === "clear-fragments") {
      captured.clear();
      highlighter.clear();
      pageOrb?.hydrate({ fragments: [], generator: null, results: [] });
      return { ok: true };
    }
    if (type === "result-action") {
      const proposedText = String(payload.text || "");
      const plan = createInsertionPlan({
        ...payload.plan,
        proposedText,
        machineKind: payload.machineKind,
        outputSpec: payload.outputSpec,
        originalHtml: sanitizeHtml(payload.plan?.originalHtml || ""),
        adapter: payload.plan?.adapter || detectAdapter(),
      });
      if (["copy", "open"].includes(plan.operation)) return { ok: false, fallback: plan.operation };
      return applySpecialistPlan(plan);
    }
    return { ok: false, error: "message not supported in content bridge" };
  }).then(respond, (error) => respond({ ok: false, error: error.message }));
  return true;
});

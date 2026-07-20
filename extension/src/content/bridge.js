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

const highlighter = createHighlighter();
const captured = new Map();

function mountPageOrb() {
  if (document.getElementById("lens-orb-overlay-host") || !document.documentElement) return;
  const host = document.createElement("div");
  host.id = "lens-orb-overlay-host";
  host.style.cssText = "all:initial;position:fixed;right:18px;top:42%;z-index:2147483646";
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `
    :host{all:initial;color-scheme:dark}
    *{box-sizing:border-box}
    .shell{--focus:#d8ddd9;--pearl-light-x:0;--pearl-light-y:0;--pearl-motion:0;position:relative;width:36px;height:36px;font:11px/1.3 Inter,ui-sans-serif,system-ui,sans-serif;color:#eeede8;touch-action:none;user-select:none}
    button{font:inherit;color:inherit;cursor:pointer}
    .orb{position:absolute;inset:0;width:36px;height:36px;padding:0;display:grid;place-items:center;border:0;border-radius:50%;background:transparent;filter:none;touch-action:none}
    svg{width:36px;height:36px;overflow:visible}.pearl{transform-origin:50px 50px;animation:respire 4s ease-in-out infinite}.shadow{fill:rgba(0,0,0,.16);filter:blur(1.1px)}.state{fill:none;stroke:rgba(232,239,235,.4);stroke-width:.8;opacity:0;stroke-dasharray:2 4}.core{stroke:rgba(255,255,255,.46);stroke-width:.62}.nucleus{mix-blend-mode:soft-light;opacity:.58;transform:translate(calc(var(--pearl-light-x) * -1px),calc(var(--pearl-light-y) * -.8px));transition:opacity .24s ease-out,transform .22s ease-out}.nacre{mix-blend-mode:screen;opacity:calc(.34 + var(--pearl-motion) * .3);transform:translate(calc(var(--pearl-light-x) * 2px),calc(var(--pearl-light-y) * 1.7px));transform-origin:50px 50px;transition:opacity .24s ease-out,transform .18s ease-out}.reflection{fill:rgba(58,69,69,.1);filter:blur(2.2px);transform:translate(calc(var(--pearl-light-x) * -1.2px),calc(var(--pearl-light-y) * -1px));transition:transform .22s ease-out}.rim{stroke-width:.8}.glint{fill:rgba(255,255,255,.26);filter:blur(.45px)}.pinlight{fill:#fff;opacity:.96}
    .shell[data-state=listening] .nucleus,.shell[data-state=absorbing] .nucleus,.shell[data-state=planning] .nucleus{opacity:.82;filter:sepia(.1) saturate(1.06)}.shell[data-state=absorbing] .state,.shell[data-state=planning] .state{opacity:.55}.shell[data-state=branching] .nacre{opacity:.68}.shell[data-state=blocked] .pearl{filter:saturate(.45) brightness(.88)}.shell[data-state=blocked] .nucleus{opacity:.3}
    .phase{position:absolute;top:40px;left:50%;transform:translateX(-50%);white-space:nowrap;color:#5d5544;background:rgba(250,248,240,.92);padding:2px 5px;border-radius:2px;opacity:0}.shell:not([data-state=idle]) .phase{opacity:1}
    .orbit{position:absolute;left:18px;top:18px;width:0;height:0;pointer-events:none}.context-dot,.lens-ring,.candidate{position:absolute}.context-dot{width:6px;height:6px;border:1px solid rgba(238,244,240,.34);border-radius:50%;background:#eef0eb;transform:translate(-50%,-50%) rotate(calc(var(--i)*72deg)) translateX(44px)}.lens-ring{width:76px;height:76px;transform:translate(-50%,-50%);border:1px solid rgba(224,235,230,.22);border-radius:50%;opacity:0}.shell.lens .lens-ring{opacity:.55}.candidate{width:5px;height:5px;color:transparent;font-size:0;transform:translate(-50%,-50%) rotate(calc(125deg + var(--i)*28deg)) translateX(56px);opacity:0}.candidate i{display:block;width:5px;height:5px;margin:0;border-radius:50%;background:#d9dfdc;box-shadow:0 0 7px rgba(186,213,205,.42)}.shell.candidates .candidate{opacity:.72}.shell.open .orbit{opacity:.18}
    .emission{position:absolute;right:106px;top:-60px;width:260px;display:none;padding:15px;color:#efeee8;background:rgba(16,20,20,.86);border:1px solid rgba(235,240,237,.13);border-radius:18px;box-shadow:0 24px 65px rgba(0,0,0,.32),inset 0 1px rgba(255,255,255,.025);backdrop-filter:blur(24px) saturate(112%)}.shell.open .emission{display:grid;gap:10px}.emission header{display:flex;align-items:center;justify-content:space-between;color:#aeb3b0}.emission header b{color:#efeee8;font-weight:580}.emission button,.emission input{min-height:34px;border:0;border-bottom:1px solid rgba(255,255,255,.11);border-radius:0;background:transparent;color:#efeee8;padding:7px;text-align:left}.emission input{width:100%;outline:none}.emission nav{display:grid;grid-template-columns:repeat(3,1fr);gap:0}.emission nav button{text-align:center;font-size:10px}.emission nav button[aria-current=true]{color:var(--focus);border-color:var(--focus)}.view{display:none;gap:7px}.view.active{display:grid}.context-list{color:#aaa89f}.context-list b{color:#efeee8}.taste{display:flex;gap:5px}.taste button{text-align:center;flex:1}.minimize{position:absolute;right:-8px;top:-8px;width:22px;height:22px;display:none;place-items:center;border:1px solid rgba(255,255,255,.14);border-radius:50%;background:rgba(14,17,18,.9)}.shell.open .minimize{display:grid}.shell.minimized{width:36px;height:36px}.shell.minimized .orb,.shell.minimized svg{width:36px;height:36px}.shell.minimized .emission,.shell.minimized .orbit{display:none}
    .shell.dock-left .emission{left:106px;right:auto;border-right:0;border-left:1px solid rgba(236,226,198,.28)}
    .shell.cursor-mode{width:28px;height:28px;pointer-events:none}.shell.cursor-mode .orb{inset:auto;width:28px;height:28px;pointer-events:none;filter:none}.shell.cursor-mode svg{width:28px;height:28px}.shell.cursor-mode .emission,.shell.cursor-mode .orbit,.shell.cursor-mode .minimize,.shell.cursor-mode .phase{display:none!important}.shell.cursor-mode[data-cursor-presentation=text]{width:28px;height:28px;opacity:.72}.shell.cursor-mode[data-cursor-presentation=action]{width:32px;height:32px}.shell.cursor-mode[data-cursor-presentation=grab]{width:34px;height:34px}.shell.cursor-mode[data-cursor-presentation=resize]{width:28px;height:28px;opacity:.78}.shell.cursor-mode.pressed .orb{transform:scale(.82)}
    .shell .emission{right:46px}.shell.dock-left .emission{left:46px;right:auto}
    button:focus-visible,input:focus-visible{outline:1px solid #fff;outline-offset:3px}
    @keyframes respire{0%,100%{transform:scale(.98)}50%{transform:scale(1.02)}}
    @media(max-width:620px){.emission{right:82px;width:min(260px,calc(100vw - 110px))}}
    @media(prefers-reduced-motion:reduce){.pearl,.state,.nacre{animation:none!important}.nacre,.reflection{transform:none!important;transition:none!important}.shell.cursor-mode.pressed .orb{transform:none}}
    @media(prefers-contrast:more){.core{stroke:#fff}.emission{border:1px solid #fff}}
  `;
  const shell = document.createElement("div");
  shell.className = "shell";
  shell.dataset.state = "idle";
  const orb = document.createElement("button");
  orb.className = "orb";
  orb.type = "button";
  orb.setAttribute("aria-label", "Pearl. Hold to speak, click to expand, drag to move, or drop material here");
  orb.setAttribute("aria-expanded", "false");
  orb.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="pearl-core" cx="39%" cy="58%" r="72%"><stop offset="0" stop-color="#fffaf0"/><stop offset=".3" stop-color="#f5f0e7"/><stop offset=".68" stop-color="#e7e6de"/><stop offset=".88" stop-color="#d1d4ce"/><stop offset="1" stop-color="#aeb3af"/></radialGradient><radialGradient id="pearl-nucleus" cx="38%" cy="62%" r="58%"><stop offset="0" stop-color="#f2d9ce" stop-opacity=".52"/><stop offset=".36" stop-color="#d2e2da" stop-opacity=".34"/><stop offset=".72" stop-color="#eadcb9" stop-opacity=".15"/><stop offset="1" stop-color="#c6ced0" stop-opacity="0"/></radialGradient><linearGradient id="pearl-nacre" x1="8%" y1="14%" x2="92%" y2="84%"><stop offset="0" stop-color="#dfbfb9" stop-opacity=".11"/><stop offset=".31" stop-color="#bfd8ce" stop-opacity=".28"/><stop offset=".53" stop-color="#f2e4c2" stop-opacity=".18"/><stop offset=".72" stop-color="#d9bdba" stop-opacity=".21"/><stop offset="1" stop-color="#bdd3cc" stop-opacity=".1"/></linearGradient><linearGradient id="pearl-rim" x1="18%" y1="8%" x2="82%" y2="92%"><stop offset="0" stop-color="#fff" stop-opacity=".78"/><stop offset=".5" stop-color="#edf2ee" stop-opacity=".18"/><stop offset=".82" stop-color="#78817e" stop-opacity=".35"/><stop offset="1" stop-color="#f4ecdf" stop-opacity=".48"/></linearGradient></defs><circle class="state" cx="50" cy="50" r="47"/><ellipse class="shadow" cx="51" cy="95" rx="25" ry="2"/><g class="pearl"><circle class="core" cx="50" cy="50" r="43" fill="url(#pearl-core)"/><ellipse class="nucleus" cx="43" cy="57" rx="25" ry="29" fill="url(#pearl-nucleus)"/><circle class="nacre" cx="50" cy="50" r="41.5" fill="url(#pearl-nacre)"/><ellipse class="reflection" cx="58" cy="62" rx="28" ry="17"/><circle class="rim" cx="50" cy="50" r="42.2" fill="none" stroke="url(#pearl-rim)"/><ellipse class="glint" cx="33" cy="28" rx="8" ry="4.5" transform="rotate(-38 33 28)"/><circle class="pinlight" cx="27.5" cy="22.5" r="2"/></g></svg><span class="phase">Listening</span>`;
  const orbit = document.createElement("div");
  orbit.className = "orbit";
  orbit.innerHTML = `<span class="lens-ring"></span>${[0,1,2,3,4].map((i) => `<span class="context-dot" style="--i:${i}" hidden></span>`).join("")}${["Question assumptions","Find strongest signal","Offer contrary path"].map((text, i) => `<span class="candidate" style="--i:${i}"><i></i>${text}</span>`).join("")}`;
  const emission = document.createElement("section");
  emission.className = "emission";
  emission.setAttribute("aria-label", "Views emitted by Pearl");
  emission.innerHTML = `<header><b>Pearl</b><span>The world is your oyster</span></header><nav>${["command","context","lens","plan","taste","more"].map((view, i) => `<button type="button" data-view="${view}" aria-current="${i === 0}">${view}</button>`).join("")}</nav><div class="view active" data-panel="command"><input aria-label="Tell Pearl your goal" placeholder="Tell Pearl your goal…"><button type="button" data-action="pearl">Make a pearl from this</button><button type="button" data-action="capture">Add to working context</button><button type="button" data-action="cursor">Become the cursor</button><button type="button" data-action="panel">Expand Pearl</button></div><div class="view context-list" data-panel="context"><b>Working context</b><span data-context-count>No material yet</span><button type="button" data-action="pearl">Make a pearl from current selection</button></div><div class="view" data-panel="lens"><b>Lens atmosphere</b><span data-active-lens>New chat · no active Lens</span><button type="button" data-action="panel">Choose Lens in Pearl</button></div><div class="view" data-panel="plan"><b>Bounded plan</b><span>1 · Notice explicit material</span><span>2 · Shape the pearl</span><span>3 · Review candidates</span></div><div class="view" data-panel="taste"><b>Candidate constellation</b><span data-candidate-count>No staged candidates</span><div class="taste"><button>Yes</button><button>No</button><button>More like this</button></div></div><div class="view" data-panel="more"><button type="button" data-action="cursor">Become the cursor</button><button type="button" data-action="minimize">Minimize Pearl</button><button type="button" data-action="dock">Dock right</button><button type="button" data-action="panel">Open side panel</button></div>`;
  const minimize = document.createElement("button");
  minimize.className = "minimize";
  minimize.type = "button";
  minimize.setAttribute("aria-label", "Minimize Pearl");
  minimize.textContent = "−";
  shell.append(orbit, orb, emission, minimize);
  shadow.append(style, shell);
  document.documentElement.append(host);

  let press = null;
  let holdTimer = null;
  let moved = false;
  let contextCount = 0;
  let pendingPearlCapture = null;
  const hydrate = (session) => {
    if (!session) return;
    contextCount = Math.min(5, session.fragments?.length || contextCount);
    shell.querySelectorAll(".context-dot").forEach((dot, index) => { dot.hidden = index >= contextCount; });
    shell.querySelector("[data-context-count]").textContent = contextCount ? `${contextCount} captured context ${contextCount === 1 ? "object" : "objects"}` : "No material yet";
    shell.classList.toggle("lens", Boolean(session.generator));
    shell.querySelector("[data-active-lens]").textContent = session.generator ? `${session.generator.name || session.generator.title || "Active Lens"} · active` : "New chat · no active Lens";
    const outputs = session.results?.flatMap((run) => run.outputs || []) || [];
    shell.classList.toggle("candidates", outputs.length > 0);
    shell.querySelector("[data-candidate-count]").textContent = outputs.length ? `${outputs.length} staged candidate${outputs.length === 1 ? "" : "s"}` : "No staged candidates";
    shell.querySelectorAll(".candidate").forEach((candidate, index) => {
      candidate.style.display = index < outputs.length ? "" : "none";
      if (outputs[index]) candidate.lastChild.textContent = String(outputs[index].distinction || outputs[index].text || `Candidate ${index + 1}`).trim().split(/\s+/).slice(0, 6).join(" ");
    });
  };
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
    host.style.pointerEvents = value ? "none" : "";
    orb.setAttribute("aria-expanded", "false");
    if (value) {
      cursorMotion.x = cursorPoint.x;
      cursorMotion.y = cursorPoint.y;
      host.style.left = `${cursorMotion.x - 14}px`;
      host.style.right = "auto";
      host.style.top = `${cursorMotion.y - 14}px`;
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
    host.style.left = `${cursorMotion.x - 14}px`;
    host.style.right = "auto";
    host.style.top = `${cursorMotion.y - 14}px`;
    shell.dataset.cursorPresentation = orbCursorPresentation(event.target, (target) => getComputedStyle(target));
    if (!cursorFrame) cursorFrame = requestAnimationFrame(renderCursor);
  };
  const onCursorDown = (event) => {
    if (cursorEnabled && event.button === 0) shell.classList.add("pressed");
  };
  const onCursorUp = () => shell.classList.remove("pressed");
  const onCursorKey = (event) => {
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
    shell.querySelector(".phase").textContent = state === "listening" ? "Listening" : state === "absorbing" ? "Adding context" : state;
  };
  const toggle = () => {
    const open = !shell.classList.contains("open");
    shell.classList.toggle("open", open);
    orb.setAttribute("aria-expanded", String(open));
  };
  const minimizeOrb = () => {
    shell.classList.toggle("minimized");
    shell.classList.remove("open");
    orb.setAttribute("aria-expanded", "false");
  };
  const absorb = async (settle = true) => {
    setState("absorbing");
    await send("toggle-highlighter", { enabled: true }).catch(() => {});
    const response = await send("capture-selection").catch(() => null);
    if (!response?.ok) {
      setState("blocked");
      shell.querySelector(".phase").textContent = "Select page material, then retry";
      return null;
    }
    const added = response?.value?.fragments?.length || response?.fragments?.length || 1;
    contextCount = Math.min(5, contextCount + added);
    shell.querySelectorAll(".context-dot").forEach((dot, index) => { dot.hidden = index >= contextCount; });
    shell.querySelector("[data-context-count]").textContent = `${contextCount} captured context ${contextCount === 1 ? "object" : "objects"}`;
    emission.querySelectorAll("[data-view]").forEach((item) => item.setAttribute("aria-current", String(item.dataset.view === "context")));
    emission.querySelectorAll("[data-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === "context"));
    send("get-session").then((response) => hydrate(response?.value)).catch(() => {});
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
    }
    const response = await send("make-pearl", { idempotencyKey: `page-pearl:${Date.now()}` }).catch(() => null);
    if (!response?.ok || !response?.value?.pearl) {
      setState("blocked");
      shell.querySelector(".phase").textContent = "Select page material, then retry";
      return;
    }
    setState("settling");
    shell.querySelector(".phase").textContent = `Pearl made · ${response.value.pearl.name}`;
    window.setTimeout(() => setState("idle"), 1600);
  };
  orb.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    orb.setPointerCapture(event.pointerId);
    const rect = host.getBoundingClientRect();
    press = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
    moved = false;
    holdTimer = window.setTimeout(() => { if (!moved) setState("listening"); }, 420);
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
  orb.addEventListener("pointerup", () => {
    window.clearTimeout(holdTimer);
    if (shell.dataset.state === "listening") setState("idle");
    else if (!moved) toggle();
    if (moved) {
      const rect = host.getBoundingClientRect();
      if (rect.left > innerWidth / 2) { host.style.left = "auto"; host.style.right = "18px"; shell.classList.remove("dock-left"); }
      else { host.style.left = "18px"; host.style.right = "auto"; shell.classList.add("dock-left"); }
    }
    press = null;
  });
  orb.addEventListener("dragover", (event) => event.preventDefault());
  orb.addEventListener("drop", async (event) => {
    event.preventDefault();
    const text = event.dataTransfer?.getData("text/plain")?.trim();
    if (!text) return;
    setState("absorbing");
    await send("fragments-changed", { fragments: [{
      id: `orb-drop:${Date.now()}`,
      quote: text.slice(0, 50_000),
      provenance: { title: document.title, origin: location.origin, url: location.href, capturedAt: new Date().toISOString() },
    }] }).catch(() => {});
    contextCount = Math.min(5, contextCount + 1);
    shell.querySelectorAll(".context-dot").forEach((dot, index) => { dot.hidden = index >= contextCount; });
    window.setTimeout(() => setState("idle"), 700);
  });
  minimize.addEventListener("click", minimizeOrb);
  emission.addEventListener("pointerdown", (event) => {
    if (!event.target.closest('[data-action="pearl"]')) return;
    try {
      pendingPearlCapture = Promise.resolve(captureNativeSelection());
    } catch {
      pendingPearlCapture = Promise.resolve([]);
    }
  });
  emission.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-view]");
    if (tab) {
      emission.querySelectorAll("[data-view]").forEach((item) => item.setAttribute("aria-current", String(item === tab)));
      emission.querySelectorAll("[data-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === tab.dataset.view));
      if (tab.dataset.view === "taste" && shell.classList.contains("candidates")) setState("branching");
      return;
    }
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "capture") absorb();
    if (action === "pearl") makePearl();
    if (action === "cursor") toggleCursor("control");
    if (action === "minimize") minimizeOrb();
    if (action === "dock") { host.style.left = "auto"; host.style.right = "18px"; shell.classList.remove("dock-left"); }
    if (action === "panel") send("open-side-panel").catch(() => {});
  });
  addEventListener("pointermove", onCursorMove, { capture: true, passive: true });
  addEventListener("pointerdown", onCursorDown, { capture: true, passive: true });
  addEventListener("pointerup", onCursorUp, { capture: true, passive: true });
  addEventListener("pointercancel", onCursorUp, { capture: true, passive: true });
  addEventListener("keydown", onCursorKey, true);
  send("orb-cursor-get").then((value) => {
    if (value?.enabled) setCursorEnabled(true, { source: "restore", persist: true });
  }).catch(() => {});
  send("get-session").then((response) => hydrate(response?.value)).catch(() => {});
  return {
    setEnabled: setCursorEnabled,
    toggle: toggleCursor,
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

async function send(type, payload = {}) {
  return globalThis.chrome?.runtime?.sendMessage(createMessage(type, payload));
}

const pageOrb = mountPageOrb();

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
    if (type === "remove-fragment") {
      captured.delete(payload.id);
      highlighter.remove(payload.id);
      return { ok: true };
    }
    if (type === "clear-fragments") {
      captured.clear();
      highlighter.clear();
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

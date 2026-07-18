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
const PAGE_ORB_RAYS = [
  [4, 13, 35, 2], [43, 18, 36, -1], [82, 11, 34, 1], [129, 18, 36, 2],
  [174, 14, 35, -1], [220, 19, 36, 1], [266, 12, 34, -2], [309, 17, 36, 1], [341, 15, 35, -1],
];

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
    .shell{--focus:#ddcda3;position:relative;width:96px;height:96px;font:11px/1.3 Inter,ui-sans-serif,system-ui,sans-serif;color:#eeede8;touch-action:none;user-select:none}
    button{font:inherit;color:inherit;cursor:pointer}
    .orb{position:absolute;inset:0;width:96px;height:96px;padding:0;display:grid;place-items:center;border:0;border-radius:50%;background:radial-gradient(circle,rgba(8,9,9,.17) 0 28%,rgba(8,9,9,.055) 42%,transparent 70%);filter:drop-shadow(0 5px 18px rgba(216,194,141,.24));touch-action:none}
    svg{width:96px;height:96px;overflow:visible}.rays{transform-origin:50px 50px;animation:respire 8s cubic-bezier(.22,.72,.18,1) infinite}.rays path{fill:none;stroke:rgba(155,130,72,.9);stroke-width:1.15;stroke-linecap:round;opacity:.72}.rays path:nth-child(2n){stroke-width:.72;opacity:.48}.halo,.state{fill:none;stroke:rgba(137,110,51,.48);stroke-width:.9}.state{opacity:0;stroke-dasharray:2 4}.core{fill:#fbf8ed;stroke:rgba(116,91,37,.82);stroke-width:1}.glint{fill:#fff;opacity:.72}
    .shell[data-state=listening] .rays{animation:listen 1.1s ease-in-out infinite}.shell[data-state=listening] .state{opacity:1;animation:turn 4s linear infinite}.shell[data-state=absorbing] .halo{stroke:var(--focus);animation:absorb .7s ease-out}.shell[data-state=planning] .state{opacity:.75}.shell[data-state=branching] .rays path{animation:branch 1s ease-out both}
    .phase{position:absolute;top:92px;left:50%;transform:translateX(-50%);white-space:nowrap;color:#5d5544;background:rgba(250,248,240,.92);padding:2px 5px;border-radius:2px;opacity:0}.shell:not([data-state=idle]) .phase{opacity:1}
    .orbit{position:absolute;left:48px;top:48px;width:0;height:0;pointer-events:none}.context-dot,.lens-ring,.candidate{position:absolute}.context-dot{width:8px;height:8px;border:1px solid #796943;border-radius:50%;background:#f7f4e9;box-shadow:0 0 10px rgba(216,194,141,.48);transform:translate(-50%,-50%) rotate(calc(var(--i)*72deg)) translateX(68px)}.lens-ring{width:126px;height:126px;transform:translate(-50%,-50%);border:1px solid rgba(123,98,43,.62);border-radius:50%;opacity:0}.shell.lens .lens-ring{opacity:1}.candidate{width:108px;color:#39362f;transform:translate(-50%,-50%) rotate(calc(125deg + var(--i)*28deg)) translateX(112px) rotate(calc(-125deg - var(--i)*28deg));opacity:0}.candidate i{display:inline-block;width:5px;height:5px;margin-right:5px;border-radius:50%;background:#7e6b3e;box-shadow:0 0 7px #bda66d}.shell.candidates .candidate{opacity:1}
    .emission{position:absolute;right:106px;top:-60px;width:260px;display:none;padding:14px 14px 12px;color:#efeee8;background:rgba(7,8,8,.97);border-right:1px solid rgba(236,226,198,.28);box-shadow:0 18px 55px rgba(0,0,0,.38)}.shell.open .emission{display:grid;gap:10px}.emission header{display:flex;align-items:center;justify-content:space-between;color:#aaa89f}.emission header b{color:#efeee8;font-weight:580}.emission button,.emission input{min-height:34px;border:0;border-bottom:1px solid rgba(255,255,255,.14);border-radius:0;background:transparent;color:#efeee8;padding:7px;text-align:left}.emission input{width:100%;outline:none}.emission nav{display:grid;grid-template-columns:repeat(3,1fr);gap:0}.emission nav button{text-align:center;font-size:10px}.emission nav button[aria-current=true]{color:var(--focus);border-color:var(--focus)}.view{display:none;gap:7px}.view.active{display:grid}.context-list{color:#aaa89f}.context-list b{color:#efeee8}.taste{display:flex;gap:5px}.taste button{text-align:center;flex:1}.minimize{position:absolute;right:-8px;top:-8px;width:22px;height:22px;display:none;place-items:center;border:1px solid rgba(255,255,255,.18);border-radius:50%;background:#090a0a}.shell.open .minimize{display:grid}.shell.minimized{width:36px;height:36px}.shell.minimized .orb,.shell.minimized svg{width:36px;height:36px}.shell.minimized .emission,.shell.minimized .orbit{display:none}
    .shell.dock-left .emission{left:106px;right:auto;border-right:0;border-left:1px solid rgba(236,226,198,.28)}
    .shell.cursor-mode{width:26px;height:26px;pointer-events:none}.shell.cursor-mode .orb{inset:auto;width:26px;height:26px;pointer-events:none;filter:drop-shadow(0 0 8px rgba(216,194,141,.55))}.shell.cursor-mode svg{width:34px;height:34px}.shell.cursor-mode .core{r:12}.shell.cursor-mode .glint{r:2.5}.shell.cursor-mode .emission,.shell.cursor-mode .orbit,.shell.cursor-mode .minimize,.shell.cursor-mode .phase{display:none!important}.shell.cursor-mode[data-cursor-presentation=text]{width:14px;height:22px}.shell.cursor-mode[data-cursor-presentation=text] .rays,.shell.cursor-mode[data-cursor-presentation=text] .halo{opacity:.28}.shell.cursor-mode[data-cursor-presentation=action] .halo{stroke:rgba(255,255,255,.8)}.shell.cursor-mode[data-cursor-presentation=grab]{width:32px;height:32px}.shell.cursor-mode[data-cursor-presentation=resize]{width:18px;height:18px}.shell.cursor-mode.pressed .orb{transform:scale(.8);filter:drop-shadow(0 0 13px rgba(255,246,213,.75))}
    button:focus-visible,input:focus-visible{outline:1px solid #fff;outline-offset:3px}
    @keyframes respire{0%,100%{transform:scale(.98);opacity:.5}50%{transform:scale(1.025);opacity:.82}}@keyframes listen{0%,100%{transform:scale(.92)}50%{transform:scale(1.12)}}@keyframes turn{to{transform:rotate(360deg)}}@keyframes absorb{from{r:31;opacity:1}to{r:46;opacity:0}}@keyframes branch{from{stroke-dasharray:0 40}to{stroke-dasharray:40 0}}
    @media(max-width:620px){.emission{right:82px;width:min(260px,calc(100vw - 110px))}}
    @media(prefers-reduced-motion:reduce){.rays,.state,.halo,.rays path{animation:none!important}}
    @media(prefers-contrast:more){.rays path{stroke:#fff;opacity:1}.emission{border:1px solid #fff}}
  `;
  const shell = document.createElement("div");
  shell.className = "shell";
  shell.dataset.state = "idle";
  const orb = document.createElement("button");
  orb.className = "orb";
  orb.type = "button";
  orb.setAttribute("aria-label", "Lens orb. Hold to speak, click to expand, drag to move, or drop material here");
  orb.setAttribute("aria-expanded", "false");
  orb.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true"><g class="rays">${PAGE_ORB_RAYS.map(([angle, start, end, bend]) => `<path d="M50 ${start} C${50 + bend} ${start + 7} ${50 - bend} ${end - 5} 50 ${end}" transform="rotate(${angle} 50 50)"/>`).join("")}</g><circle class="state" cx="50" cy="50" r="38"/><circle class="halo" cx="50" cy="50" r="30"/><circle class="core" cx="50" cy="50" r="19"/><circle class="glint" cx="44" cy="43" r="4"/></svg><span class="phase">Listening</span>`;
  const orbit = document.createElement("div");
  orbit.className = "orbit";
  orbit.innerHTML = `<span class="lens-ring"></span>${[0,1,2,3,4].map((i) => `<span class="context-dot" style="--i:${i}" hidden></span>`).join("")}${["Question assumptions","Find strongest signal","Offer contrary path"].map((text, i) => `<span class="candidate" style="--i:${i}"><i></i>${text}</span>`).join("")}`;
  const emission = document.createElement("section");
  emission.className = "emission";
  emission.setAttribute("aria-label", "Views emitted by the Lens orb");
  emission.innerHTML = `<header><b>Lens orb</b><span>Page context</span></header><nav>${["command","context","lens","plan","taste","more"].map((view, i) => `<button type="button" data-view="${view}" aria-current="${i === 0}">${view}</button>`).join("")}</nav><div class="view active" data-panel="command"><input aria-label="Tell the orb your goal" placeholder="Tell the orb your goal…"><button type="button" data-action="capture">Absorb selection</button><button type="button" data-action="cursor">Become the cursor</button><button type="button" data-action="panel">Expand this orb</button></div><div class="view context-list" data-panel="context"><b>Working context</b><span data-context-count>No material yet</span><button type="button" data-action="capture">Absorb current selection</button></div><div class="view" data-panel="lens"><b>Lens atmosphere</b><span data-active-lens>New chat · no active Lens</span><button type="button" data-action="panel">Choose Lens in expanded orb</button></div><div class="view" data-panel="plan"><b>Bounded plan</b><span>1 · Observe explicit context</span><span>2 · Apply selected Lens</span><span>3 · Branch candidates</span></div><div class="view" data-panel="taste"><b>Candidate constellation</b><span data-candidate-count>No staged candidates</span><div class="taste"><button>Yes</button><button>No</button><button>More like this</button></div></div><div class="view" data-panel="more"><button type="button" data-action="cursor">Become the cursor</button><button type="button" data-action="minimize">Minimize orb</button><button type="button" data-action="dock">Dock right</button><button type="button" data-action="panel">Open side panel</button></div>`;
  const minimize = document.createElement("button");
  minimize.className = "minimize";
  minimize.type = "button";
  minimize.setAttribute("aria-label", "Minimize Lens orb");
  minimize.textContent = "−";
  shell.append(orbit, orb, emission, minimize);
  shadow.append(style, shell);
  document.documentElement.append(host);

  let press = null;
  let holdTimer = null;
  let moved = false;
  let contextCount = 0;
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
  const renderCursor = () => {
    cursorFrame = 0;
    if (!cursorEnabled) return;
    host.style.left = `${cursorPoint.x - 13}px`;
    host.style.right = "auto";
    host.style.top = `${cursorPoint.y - 13}px`;
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
    if (value) renderCursor();
    else {
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
    if (!cursorEnabled) return;
    cursorPoint = { x: event.clientX, y: event.clientY };
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
  const absorb = async () => {
    setState("absorbing");
    await send("toggle-highlighter", { enabled: true }).catch(() => {});
    const response = await send("capture-selection").catch(() => null);
    const added = response?.value?.fragments?.length || response?.fragments?.length || 1;
    contextCount = Math.min(5, contextCount + added);
    shell.querySelectorAll(".context-dot").forEach((dot, index) => { dot.hidden = index >= contextCount; });
    shell.querySelector("[data-context-count]").textContent = `${contextCount} captured context ${contextCount === 1 ? "object" : "objects"}`;
    emission.querySelectorAll("[data-view]").forEach((item) => item.setAttribute("aria-current", String(item.dataset.view === "context")));
    emission.querySelectorAll("[data-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === "context"));
    send("get-session").then((response) => hydrate(response?.value)).catch(() => {});
    window.setTimeout(() => setState("idle"), 700);
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

import { createInsertionPlan } from "../../../shared/lens-runtime.js";
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
  host.style.cssText = "all:initial;position:fixed;right:10px;top:42%;z-index:2147483646";
  const shadow = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = `
    :host{all:initial}
    .shell{font:12px/1.3 system-ui,sans-serif;color:#eeede8;display:flex;align-items:center;gap:8px}
    button{font:inherit;color:inherit;border:1px solid rgba(255,255,255,.22);background:rgba(8,9,9,.96);border-radius:3px;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.28)}
    .orb{width:48px;height:48px;padding:0;display:grid;place-items:center;border:0;border-radius:50%;background:rgba(8,9,9,.88);filter:drop-shadow(0 4px 14px rgba(216,194,141,.1))}
    svg{width:42px;height:42px;overflow:visible}.rays{transform-origin:50px 50px;animation:respire 9s cubic-bezier(.22,.72,.18,1) infinite}.rays path{fill:none;stroke:rgba(228,214,177,.72);stroke-width:1.15;stroke-linecap:round;opacity:.55}.rays path:nth-child(2n){stroke-width:.8;opacity:.35}.halo{fill:none;stroke:rgba(232,221,190,.22);stroke-width:.8}.core{fill:#f7f5ed;stroke:rgba(216,194,141,.68);stroke-width:1}.actions{display:none;gap:5px;padding:6px;background:rgba(8,9,9,.96);border:1px solid rgba(255,255,255,.14);border-radius:3px}.shell.open .actions{display:flex}.actions button{min-height:36px;padding:6px 10px}
    button:focus-visible{outline:1px solid #fff;outline-offset:3px}@keyframes respire{0%,100%{transform:scale(.985);opacity:.48}50%{transform:scale(1.015);opacity:.68}}
    @media(prefers-reduced-motion:reduce){.rays{animation:none}}
    @media(prefers-contrast:more){button,.actions{border-color:rgba(255,255,255,.62)}}
  `;
  const shell = document.createElement("div");
  shell.className = "shell";
  const orb = document.createElement("button");
  orb.className = "orb";
  orb.type = "button";
  orb.setAttribute("aria-label", "Open Lens orb controls");
  orb.setAttribute("aria-expanded", "false");
  orb.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true"><g class="rays">${PAGE_ORB_RAYS.map(([angle, start, end, bend]) => `<path d="M50 ${start} C${50 + bend} ${start + 7} ${50 - bend} ${end - 5} 50 ${end}" transform="rotate(${angle} 50 50)"/>`).join("")}</g><circle class="halo" cx="50" cy="50" r="30"/><circle class="core" cx="50" cy="50" r="19"/></svg>`;
  const actions = document.createElement("div");
  actions.className = "actions";
  const captureButton = document.createElement("button");
  captureButton.type = "button";
  captureButton.textContent = "Capture selection";
  captureButton.addEventListener("click", () => send("capture-selection").catch(() => {}));
  const highlightButton = document.createElement("button");
  highlightButton.type = "button";
  highlightButton.textContent = "Highlight";
  highlightButton.addEventListener("click", () => send("toggle-highlighter", { enabled: true }).catch(() => {}));
  orb.addEventListener("click", () => {
    const open = !shell.classList.contains("open");
    shell.classList.toggle("open", open);
    orb.setAttribute("aria-expanded", String(open));
  });
  actions.append(captureButton, highlightButton);
  shell.append(orb, actions);
  shadow.append(style, shell);
  document.documentElement.append(host);
}

mountPageOrb();

async function send(type, payload = {}) {
  return globalThis.chrome?.runtime?.sendMessage(createMessage(type, payload));
}

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

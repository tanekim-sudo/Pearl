import { createInsertionPlan } from "../../../shared/lens-runtime.js";
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
  host.style.cssText = "all:initial;position:fixed;right:10px;top:42%;z-index:2147483646";
  const shadow = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = `
    :host{all:initial}
    .shell{font:12px/1.3 system-ui,sans-serif;color:#f8f5ed;display:flex;align-items:center;gap:6px}
    button{font:inherit;color:inherit;border:1px solid rgba(255,255,255,.2);background:#111;border-radius:999px;cursor:pointer;box-shadow:0 7px 24px rgba(0,0,0,.3)}
    .orb{width:48px;height:48px;padding:0;display:grid;place-items:center;filter:drop-shadow(0 5px 12px rgba(225,173,43,.35))}
    svg{width:42px;height:42px;overflow:visible}.rays{transform-origin:50px 50px;animation:breathe 4.5s ease-in-out infinite}.rays path{fill:none;stroke:#efd184;stroke-width:4;stroke-linecap:round}.core{fill:#fffdf3;stroke:#d6a631;stroke-width:3}.actions{display:none;gap:5px;padding:5px;background:rgba(12,12,12,.94);border-radius:999px}.shell.open .actions{display:flex}.actions button{min-height:36px;padding:6px 10px}
    button:focus-visible{outline:2px solid #fff;outline-offset:2px}@keyframes breathe{0%,100%{transform:scale(.92);opacity:.7}50%{transform:scale(1.06);opacity:1}}
    @media(prefers-reduced-motion:reduce){.rays{animation:none}}
  `;
  const shell = document.createElement("div");
  shell.className = "shell";
  const orb = document.createElement("button");
  orb.className = "orb";
  orb.type = "button";
  orb.setAttribute("aria-label", "Open Lens orb controls");
  orb.setAttribute("aria-expanded", "false");
  orb.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true"><g class="rays">${Array.from({ length: 12 }, (_, index) => `<path d="M50 8 C49 22 52 28 50 37" transform="rotate(${index * 30} 50 50)"/>`).join("")}</g><circle class="core" cx="50" cy="50" r="20"/></svg>`;
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

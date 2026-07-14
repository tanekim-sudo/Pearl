import { createInsertionPlan } from "../../../shared/lens-runtime.js";
import { createMessage, validateMessage } from "../core/messages.js";
import { sanitizeHtml } from "../core/security.js";
import { applySpecialistPlan, detectAdapter } from "./adapters/specialists.js";
import { createHighlighter } from "./highlighter.js";
import { captureNativeSelection, selectionRects } from "./selection.js";

const highlighter = createHighlighter();
const captured = new Map();

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

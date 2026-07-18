export const ORB_CURSOR_VERSION = 1;
export const ORB_CURSOR_STORAGE_KEY = "lens.orb.cursor.v1";
export const ORB_CURSOR_EVENT = "lens:orb-cursor-mode";
export const ORB_CURSOR_SEQUENCE_ATTRIBUTE = "data-lens-orb-space-sequence";

const EDITABLE_SELECTOR = [
  "input",
  "textarea",
  "select",
  "[contenteditable]:not([contenteditable='false'])",
  "[role='textbox']",
  ".monaco-editor",
  ".CodeMirror",
  ".cm-editor",
  ".ProseMirror",
].join(",");

const ACTION_SELECTOR = [
  "a[href]",
  "button",
  "summary",
  "[role='button']",
  "[role='link']",
  "[role='menuitem']",
  "[role='option']",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function closest(target, selector) {
  if (!target || typeof target.closest !== "function") return null;
  try {
    return target.closest(selector);
  } catch {
    return null;
  }
}

export function isOrbCursorEditableTarget(target) {
  return Boolean(closest(target, EDITABLE_SELECTOR));
}

export function isOrbCursorInteractiveTarget(target) {
  return Boolean(closest(target, ACTION_SELECTOR));
}

export function orbCursorPresentation(target, computedStyle) {
  if (isOrbCursorEditableTarget(target)) return "text";
  const draggable = closest(target, "[draggable='true']");
  if (draggable) return "grab";
  const style = typeof computedStyle === "function" && target
    ? computedStyle(target)
    : null;
  const cursor = String(style?.cursor || "").toLowerCase();
  if (cursor.includes("resize")) return "resize";
  if (cursor === "text" || cursor === "vertical-text") return "text";
  if (cursor === "grab" || cursor === "grabbing" || cursor === "move") return "grab";
  if (isOrbCursorInteractiveTarget(target) || cursor === "pointer") return "action";
  return "precision";
}

export function createTripleSpaceRecognizer({
  intervalMs = 650,
  now = () => Date.now(),
} = {}) {
  let presses = [];

  function reset() {
    presses = [];
  }

  function accept(event = {}) {
    if (
      event.key !== " " ||
      event.repeat ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      isOrbCursorEditableTarget(event.target) ||
      isOrbCursorInteractiveTarget(event.target)
    ) {
      reset();
      return { accepted: false, matched: false, count: 0 };
    }
    const at = Number.isFinite(event.timeStamp) && event.timeStamp > 0
      ? event.timeStamp
      : now();
    presses = presses.filter((value) => at - value <= intervalMs);
    presses.push(at);
    const count = presses.length;
    if (count < 3) return { accepted: true, matched: false, count };
    reset();
    return { accepted: true, matched: true, count: 3 };
  }

  return {
    accept,
    reset,
    get count() {
      return presses.length;
    },
  };
}

export function normalizeOrbCursorPreference(value = {}) {
  return Object.freeze({
    version: ORB_CURSOR_VERSION,
    enabled: value.enabled === true,
    source: ["triple-space", "control", "companion", "restore"].includes(value.source)
      ? value.source
      : "control",
    updatedAt: Number.isFinite(value.updatedAt) ? value.updatedAt : Date.now(),
  });
}

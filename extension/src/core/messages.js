export const MESSAGE_VERSION = 1;

export const MESSAGE_TYPES = Object.freeze([
  "capture-selection",
  "make-pearl",
  "fragments-changed",
  "remove-fragment",
  "clear-fragments",
  "toggle-highlighter",
  "toggle-orb-cursor",
  "orb-cursor-get",
  "orb-cursor-set",
  "open-side-panel",
  "get-session",
  "pearl-state-get",
  "session-state",
  "queue-lens",
  "reorder-queue",
  "remove-queue",
  "set-generator",
  "go",
  "cancel-run",
  "taste-feedback",
  "capture-visible-tab",
  "critique-start",
  "critique-ingest",
  "critique-stop",
  "model-catalog",
  "compose-library-objects",
  "invoke-primitive",
  "reorder-primitive",
  "set-generation-branches",
  "arm-merge-preview",
  "open-web-handoff",
  "personal-command-save",
  "open-cognitive-pull-request",
  "result-action",
  "copy-result",
  "open-artifact",
  "auth-login",
  "auth-logout",
  "auth-status",
  "privacy-lock",
  "privacy-unlock",
  "privacy-delete-local",
  "library-refresh",
  "library-import-preview",
  "library-import",
  "library-pending",
  "infer-before-after",
  "page-canvas-get",
  "page-canvas-command",
  "page-canvas-create-textbox",
  "page-canvas-state",
  "page-canvas-export-pdf",
  "page-canvas-blob-store",
  "page-canvas-blob-read",
  "page-canvas-blob-delete",
  "pearl-audio-search",
  "pearl-audio-upload",
  "pearl-audio-add",
  "pearl-audio-control",
  "pearl-audio-save-offline",
  "pearl-audio-delete",
  "pearl-audio-status",
  "result-pearl-layout-request",
  "result-pearl-get",
  "result-pearl-state",
  "result-pearl-command",
  "result-pearl-open-tab",
  "result-pearl-open-web",
  "result-pearl-create-region",
  "result-pearl-redeem",
  "result-pearl-cancel",
  "result-pearl-retry",
]);

const allowedKeys = new Set(["version", "type", "requestId", "payload"]);

export function createMessage(type, payload = {}, requestId = "") {
  if (!MESSAGE_TYPES.includes(type)) throw new Error(`unsupported message type: ${type}`);
  return { version: MESSAGE_VERSION, type, requestId: String(requestId || globalThis.crypto?.randomUUID?.() || ""), payload };
}

export function validateMessage(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, error: "message must be an object" };
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) return { ok: false, error: "unexpected message field" };
  if (value.version !== MESSAGE_VERSION) return { ok: false, error: "unsupported message version" };
  if (!MESSAGE_TYPES.includes(value.type)) return { ok: false, error: "unsupported message type" };
  if (value.payload != null && (typeof value.payload !== "object" || Array.isArray(value.payload))) {
    return { ok: false, error: "payload must be an object" };
  }
  const limit = value.type === "page-canvas-blob-store" || value.type.startsWith("library-import")
    ? 10 * 1024 * 1024
    : 512_000;
  if (JSON.stringify(value).length > limit) return { ok: false, error: "message too large" };
  return { ok: true, value };
}

export function assertTrustedSender(sender, expectedExtensionId) {
  if (!sender) throw new Error("missing sender");
  if (expectedExtensionId && sender.id !== expectedExtensionId) throw new Error("untrusted extension sender");
  const url = sender.url || sender.tab?.url || "";
  if (url && !/^(https?:|chrome-extension:|moz-extension:)/.test(url)) throw new Error("unsupported sender protocol");
  return true;
}

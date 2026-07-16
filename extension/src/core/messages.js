export const MESSAGE_VERSION = 1;

export const MESSAGE_TYPES = Object.freeze([
  "capture-selection",
  "fragments-changed",
  "remove-fragment",
  "clear-fragments",
  "toggle-highlighter",
  "get-session",
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
  "result-action",
  "copy-result",
  "open-artifact",
  "auth-login",
  "auth-status",
  "library-refresh",
  "library-import-preview",
  "library-import",
  "library-pending",
  "infer-before-after",
]);

const allowedKeys = new Set(["version", "type", "requestId", "payload"]);

export function createMessage(type, payload = {}, requestId = "") {
  if (!MESSAGE_TYPES.includes(type)) throw new Error(`unsupported message type: ${type}`);
  return { version: MESSAGE_VERSION, type, requestId: String(requestId || ""), payload };
}

export function validateMessage(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, error: "message must be an object" };
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) return { ok: false, error: "unexpected message field" };
  if (value.version !== MESSAGE_VERSION) return { ok: false, error: "unsupported message version" };
  if (!MESSAGE_TYPES.includes(value.type)) return { ok: false, error: "unsupported message type" };
  if (value.payload != null && (typeof value.payload !== "object" || Array.isArray(value.payload))) {
    return { ok: false, error: "payload must be an object" };
  }
  const limit = value.type.startsWith("library-import") ? 10 * 1024 * 1024 : 512_000;
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

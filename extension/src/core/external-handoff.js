export const TRUSTED_WEB_ORIGINS = Object.freeze([
  "https://representation-eta.vercel.app",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

function trustedOrigin(sender = {}) {
  let origin;
  try {
    origin = new URL(sender.url || sender.origin || "").origin;
  } catch {
    throw new Error("missing sender origin");
  }
  if (!TRUSTED_WEB_ORIGINS.includes(origin)) throw new Error("untrusted Lens origin");
  return origin;
}

export function validateExternalAction(raw, sender = {}) {
  const origin = trustedOrigin(sender);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("invalid external message");
  if (Object.keys(raw).some((key) => !["type", "version", "nonce"].includes(key))) {
    throw new Error("invalid external message");
  }
  if (!["lens-install-check", "lens-extension-open"].includes(raw.type)
    || raw.version !== 1
    || !/^[a-zA-Z0-9_-]{16,128}$/.test(raw.nonce || "")) {
    throw new Error("invalid external schema");
  }
  return { origin, type: raw.type, nonce: raw.nonce };
}

export function validateExternalHandoff(raw, sender = {}) {
  const origin = trustedOrigin(sender);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("invalid handoff message");
  if (Object.keys(raw).some((key) => !["type", "version", "nonce", "bundle"].includes(key))) {
    throw new Error("invalid handoff message");
  }
  if (raw.type !== "lens-library-handoff" || raw.version !== 1 || !/^[a-zA-Z0-9_-]{16,128}$/.test(raw.nonce || "")) {
    throw new Error("invalid handoff schema");
  }
  if (!raw.bundle || typeof raw.bundle !== "object") throw new Error("library bundle required");
  return { origin, bundle: raw.bundle, nonce: raw.nonce };
}

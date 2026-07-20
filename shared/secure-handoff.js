export const SECURE_HANDOFF_VERSION = 1;
export const SECURE_HANDOFF_TTL_MS = 2 * 60_000;
export const SECURE_HANDOFF_MAX_BYTES = 512_000;

const noncePattern = /^[a-f0-9]{32,128}$/i;

function boundedPayload(payload) {
  const serialized = JSON.stringify(payload);
  if (new TextEncoder().encode(serialized).byteLength > SECURE_HANDOFF_MAX_BYTES) {
    throw new Error("approved handoff exceeds the local disclosure limit");
  }
  return structuredClone(payload);
}

export function createSecureHandoff(input, now = Date.now()) {
  if (!noncePattern.test(String(input.nonce || ""))) throw new Error("invalid handoff nonce");
  if (!input.profileHash || !input.origin || !input.scope) throw new Error("handoff binding is incomplete");
  return {
    version: SECURE_HANDOFF_VERSION,
    nonce: input.nonce,
    profileHash: String(input.profileHash),
    tabId: Number.isInteger(input.tabId) ? input.tabId : null,
    origin: new URL(input.origin).origin,
    scope: String(input.scope).slice(0, 80),
    payload: boundedPayload(input.payload),
    createdAt: now,
    expiresAt: now + Math.min(SECURE_HANDOFF_TTL_MS, Math.max(1_000, Number(input.ttlMs) || SECURE_HANDOFF_TTL_MS)),
  };
}

export function consumeSecureHandoff(records, nonce, claims, now = Date.now()) {
  const next = { ...(records || {}) };
  const record = next[nonce];
  delete next[nonce];
  if (!record || record.version !== SECURE_HANDOFF_VERSION) throw new Error("handoff is unavailable");
  if (record.expiresAt < now) throw new Error("handoff expired");
  if (record.profileHash !== claims.profileHash) throw new Error("handoff profile mismatch");
  if (record.origin !== new URL(claims.origin).origin) throw new Error("handoff origin mismatch");
  if (record.scope !== claims.scope) throw new Error("handoff scope mismatch");
  if (record.tabId != null && record.tabId !== claims.tabId) throw new Error("handoff tab mismatch");
  return { records: next, payload: structuredClone(record.payload), record: { ...record, payload: undefined } };
}

export function pruneSecureHandoffs(records, now = Date.now()) {
  return Object.fromEntries(Object.entries(records || {}).filter(([, record]) =>
    record?.version === SECURE_HANDOFF_VERSION && record.expiresAt >= now
  ));
}

// Long enough to cover Web Speech replay/restart and pointer/submit fan-out,
// while explicit new envelopes still permit a genuine repeated command.
const DEFAULT_DEDUPE_MS = 15_000;

export function normalizeCompanionRequest(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function companionRequestFingerprint(value) {
  return normalizeCompanionRequest(value)
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * Synchronous submission lock. React state is intentionally not used here:
 * key, form, speech, and pointer events can all fire before a render commits.
 */
export function createCompanionSubmitGuard({ dedupeMs = DEFAULT_DEDUPE_MS, now = () => Date.now() } = {}) {
  let active = null;
  const consumed = new Map();
  let sequence = 0;

  return {
    begin(rawText, envelope = {}) {
      const text = normalizeCompanionRequest(rawText);
      if (!text || active) return null;
      const at = now();
      for (const [key, consumedAt] of consumed) {
        if (at - consumedAt >= dedupeMs) consumed.delete(key);
      }
      const source = envelope.source || "unknown";
      const sessionGeneration = envelope.sessionGeneration ?? null;
      const utteranceId = envelope.utteranceId || null;
      const requestId = envelope.requestId || `companion-${++sequence}`;
      const fingerprint = companionRequestFingerprint(text);
      const eventKey = utteranceId
        ? `${source}:${sessionGeneration ?? "none"}:${utteranceId}`
        : envelope.eventId
          ? `event:${envelope.eventId}`
          : null;
      if (eventKey && consumed.has(eventKey)) return null;
      // Event paths without an envelope (Enter + form submit, click + submit)
      // are deduped semantically. Voice retries use a fresh utterance id.
      const semanticKey = eventKey ? null : fingerprint;
      if (semanticKey && consumed.has(semanticKey)) return null;
      const controller = new AbortController();
      const run = {
        id: requestId,
        requestId,
        utteranceId,
        source,
        sessionGeneration,
        fingerprint,
        text,
        at,
        signal: controller.signal,
        controller,
        consumedKeys: [eventKey, semanticKey].filter(Boolean),
      };
      active = run;
      if (eventKey) consumed.set(eventKey, at);
      if (semanticKey) consumed.set(semanticKey, at);
      return run;
    },
    finish(id) {
      if (active?.id === id) active = null;
    },
    /**
     * Clear the active lock and release this run's dedupe keys so the user can
     * immediately retry after a blocker / failure (e.g. needs-credentials hang).
     */
    release(id = active?.id) {
      const run = active?.id === id ? active : null;
      if (!run) {
        if (active?.id === id) active = null;
        return null;
      }
      active = null;
      for (const key of run.consumedKeys || []) consumed.delete(key);
      return run;
    },
    resetDedupe() {
      // Kept for API compatibility. Consumed event envelopes must not be
      // cleared by focus/change/confirmation effects.
    },
    cancel(id = active?.id) {
      if (!active || active.id !== id) return null;
      const cancelled = active;
      active = null;
      for (const key of cancelled.consumedKeys || []) consumed.delete(key);
      cancelled.controller.abort();
      return cancelled;
    },
    active() {
      return active;
    },
  };
}

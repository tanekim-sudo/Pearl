// Covers event fan-out from one gesture without blocking a deliberate retry.
const DEFAULT_DEDUPE_MS = 5;

export function normalizeCompanionRequest(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

/**
 * Synchronous submission lock. React state is intentionally not used here:
 * key, form, speech, and pointer events can all fire before a render commits.
 */
export function createCompanionSubmitGuard({ dedupeMs = DEFAULT_DEDUPE_MS, now = () => Date.now() } = {}) {
  let active = null;
  let last = null;
  let sequence = 0;

  return {
    begin(rawText) {
      const text = normalizeCompanionRequest(rawText);
      if (!text || active) return null;
      const at = now();
      if (last?.text === text && at - last.at < dedupeMs) return null;
      const run = { id: `companion-${++sequence}`, text, at };
      active = run;
      last = run;
      return run;
    },
    finish(id) {
      if (active?.id === id) active = null;
    },
    resetDedupe() {
      last = null;
    },
    active() {
      return active;
    },
  };
}

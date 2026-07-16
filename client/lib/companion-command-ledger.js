export const COMPANION_COMMAND_LEDGER_VERSION = 1;
export const COMPANION_COMMAND_LEDGER_KEY = "lens.companion.command-ledger.v1";
const MAX_ENTRIES = 100;

const clone = (value) => structuredClone(value);
const id = () => globalThis.crypto?.randomUUID?.() || `command-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function loadCommandLedger(storage = globalThis.localStorage) {
  try {
    const value = JSON.parse(storage?.getItem(COMPANION_COMMAND_LEDGER_KEY) || "{}");
    return {
      version: COMPANION_COMMAND_LEDGER_VERSION,
      entries: Array.isArray(value.entries) ? value.entries.slice(-MAX_ENTRIES) : [],
    };
  } catch {
    return { version: COMPANION_COMMAND_LEDGER_VERSION, entries: [] };
  }
}

function save(ledger, storage) {
  const next = { version: COMPANION_COMMAND_LEDGER_VERSION, entries: ledger.entries.slice(-MAX_ENTRIES) };
  storage?.setItem(COMPANION_COMMAND_LEDGER_KEY, JSON.stringify(next));
  return next;
}

export function beginCommand(rawInput, options = {}, storage = globalThis.localStorage) {
  const ledger = loadCommandLedger(storage);
  const entry = {
    id: options.id || id(),
    rawInput: String(rawInput || "").trim().slice(0, 8000),
    normalizedClauses: options.normalizedClauses || [],
    source: options.source || "companion",
    plan: options.plan || null,
    argsSnapshot: options.argsSnapshot || null,
    confirmation: options.confirmation || null,
    status: options.status || "received",
    effects: [],
    failure: null,
    undoCheckpoint: options.undoCheckpoint || null,
    references: options.references || [],
    retryOf: options.retryOf || null,
    createdAt: options.createdAt || Date.now(),
    updatedAt: options.createdAt || Date.now(),
  };
  save({ ...ledger, entries: [...ledger.entries, entry] }, storage);
  return entry;
}

export function updateCommand(entryId, patch, storage = globalThis.localStorage) {
  const ledger = loadCommandLedger(storage);
  let changed = null;
  const entries = ledger.entries.map((entry) => {
    if (entry.id !== entryId) return entry;
    changed = {
      ...entry,
      ...clone(patch || {}),
      id: entry.id,
      rawInput: entry.rawInput,
      updatedAt: Date.now(),
    };
    return changed;
  });
  save({ ...ledger, entries }, storage);
  return changed;
}

export function lastRecoverableCommand(storage = globalThis.localStorage) {
  return [...loadCommandLedger(storage).entries].reverse().find((entry) =>
    entry.rawInput &&
    !entry.retryOf &&
    ["received", "planned", "failed"].includes(entry.status)
  ) || null;
}

export function isRetryRequest(text) {
  return /^(?:please\s+)?(?:you (?:did not|didn't) execute my last command|retry(?: that| it)?|do it again|try that again)$/i
    .test(String(text || "").trim());
}

export function publicCompanionError(error) {
  const message = String(error?.message || error || "");
  if (error?.name === "AbortError") return "That action was stopped. Nothing else changed.";
  if (/fetch failed|network|timeout|gateway/i.test(message)) {
    return "The planning service is unavailable right now. Your workspace was not changed.";
  }
  if (/plan\.|schema|supported workspace query|is not accepted by|must be|unknown capability|invalid companion plan|referenceerror|is not defined/i.test(message)) {
    return "I could not validate that action safely. Your workspace was not changed; you can retry it.";
  }
  return "That action could not be completed safely. Your workspace was not changed.";
}

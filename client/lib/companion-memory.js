export const COMPANION_MEMORY_VERSION = 1;
export const ANONYMOUS_COMPANION_SCOPE = "anonymous";
const PREFIX = "lens.companion.memory.v1:";
const MAX_ACTIONS = 20;
const MAX_REFS = 40;
const MAX_MEMORIES = 80;

export function companionMemoryKey(userId) {
  return PREFIX + (userId || ANONYMOUS_COMPANION_SCOPE);
}

export function emptyCompanionMemory() {
  return {
    version: COMPANION_MEMORY_VERSION,
    identity: "",
    role: "",
    goals: [],
    preferences: { autonomy: "preview-complex" },
    references: { lenses: [], generators: [], paths: [] },
    actions: [],
    memories: [],
    // Zero-demand: never quiz the user before helping. Memory can still fill in passively.
    interviewComplete: true,
    interviewPaused: true,
    updatedAt: null,
  };
}

function compact(memory) {
  const base = emptyCompanionMemory();
  const rawIdentity = String(memory?.identity || "").slice(0, 120);
  // Repair profiles polluted by the original onboarding routing bug.
  const identityLooksLikeCommand =
    rawIdentity.split(/\s+/).length > 5 &&
    /\b(clear|delete|remove|wipe|get rid|functions?|drawings?|ai stuff)\b/i.test(rawIdentity);
  return {
    ...base,
    ...memory,
    version: COMPANION_MEMORY_VERSION,
    identity: identityLooksLikeCommand ? "" : rawIdentity,
    role: String(memory?.role || "").slice(0, 240),
    goals: Array.isArray(memory?.goals) ? memory.goals.slice(-8).map((v) => String(v).slice(0, 300)) : [],
    preferences: {
      ...base.preferences,
      ...(memory?.preferences && typeof memory.preferences === "object" ? memory.preferences : {}),
      autonomy: ["act-immediately", "preview-complex", "always-preview"].includes(
        memory?.preferences?.autonomy
      )
        ? memory.preferences.autonomy
        : base.preferences.autonomy,
    },
    references: Object.fromEntries(
      ["lenses", "generators", "paths"].map((kind) => [
        kind,
        Array.isArray(memory?.references?.[kind]) ? memory.references[kind].slice(-MAX_REFS) : [],
      ])
    ),
    actions: Array.isArray(memory?.actions) ? memory.actions.slice(-MAX_ACTIONS) : [],
    memories: Array.isArray(memory?.memories)
      ? memory.memories
          .filter((entry) => !entry.expiresAt || Date.parse(entry.expiresAt) > Date.now())
          .slice(-MAX_MEMORIES)
          .map(normalizeMemoryEntry)
      : [],
    interviewComplete: memory?.interviewComplete == null
      ? true
      : Boolean(memory.interviewComplete),
    interviewPaused: memory?.interviewPaused == null
      ? true
      : Boolean(memory.interviewPaused),
    updatedAt: memory?.updatedAt || null,
  };
}

export function loadCompanionMemory(userId, storage = globalThis.localStorage) {
  if (!storage) return emptyCompanionMemory();
  try {
    return compact(JSON.parse(storage.getItem(companionMemoryKey(userId)) || "{}"));
  } catch {
    return emptyCompanionMemory();
  }
}

export function saveCompanionMemory(userId, patch, storage = globalThis.localStorage) {
  const next = compact({
    ...loadCompanionMemory(userId, storage),
    ...patch,
    updatedAt: new Date().toISOString(),
  });
  storage?.setItem(companionMemoryKey(userId), JSON.stringify(next));
  return next;
}

export function clearCompanionMemory(userId, storage = globalThis.localStorage) {
  storage?.removeItem(companionMemoryKey(userId));
  return emptyCompanionMemory();
}

export function rememberCompanionAction(userId, summary, storage = globalThis.localStorage) {
  const current = loadCompanionMemory(userId, storage);
  return saveCompanionMemory(
    userId,
    { actions: [...current.actions, { summary: String(summary).slice(0, 240), at: new Date().toISOString() }] },
    storage
  );
}

export function rememberCompanionReference(userId, kind, reference, storage = globalThis.localStorage) {
  if (!["lenses", "generators", "paths"].includes(kind) || !reference) {
    return loadCompanionMemory(userId, storage);
  }
  const current = loadCompanionMemory(userId, storage);
  const key = reference.id || reference.name;
  const refs = [
    ...current.references[kind].filter((entry) => (entry.id || entry.name) !== key),
    {
      ...reference,
      provenance: reference.provenance || { kind: "companion-reference", sourceId: reference.id || null },
      confidence: Number.isFinite(reference.confidence) ? reference.confidence : 1,
      scope: reference.scope || (userId ? "account" : "anonymous"),
      expiresAt: reference.expiresAt || null,
    },
  ];
  return saveCompanionMemory(
    userId,
    { references: { ...current.references, [kind]: refs.slice(-MAX_REFS) } },
    storage
  );
}

function normalizeMemoryEntry(entry = {}) {
  return {
    id: String(entry.id || globalThis.crypto?.randomUUID?.() || `memory-${Date.now()}`),
    value: String(entry.value || entry.summary || "").slice(0, 1_000),
    provenance: entry.provenance && typeof entry.provenance === "object"
      ? entry.provenance
      : { kind: "explicit-user-memory", sourceId: null },
    confidence: Math.max(0, Math.min(1, Number.isFinite(entry.confidence) ? entry.confidence : 1)),
    scope: ["session", "workspace", "account", "anonymous"].includes(entry.scope) ? entry.scope : "session",
    createdAt: entry.createdAt || new Date().toISOString(),
    expiresAt: entry.expiresAt || null,
  };
}

export function rememberCompanionMemory(userId, entry, storage = globalThis.localStorage) {
  const current = loadCompanionMemory(userId, storage);
  const normalized = normalizeMemoryEntry(entry);
  return saveCompanionMemory(userId, {
    memories: [
      ...current.memories.filter((memory) => memory.id !== normalized.id),
      normalized,
    ].slice(-MAX_MEMORIES),
  }, storage);
}

export function forgetCompanionMemory(userId, memoryId, storage = globalThis.localStorage) {
  const current = loadCompanionMemory(userId, storage);
  return saveCompanionMemory(userId, {
    memories: current.memories.filter((entry) => entry.id !== memoryId),
  }, storage);
}

export function setCompanionAutonomy(userId, autonomy, storage = globalThis.localStorage) {
  if (!["act-immediately", "preview-complex", "always-preview"].includes(autonomy)) {
    throw new Error("invalid companion autonomy preference");
  }
  const current = loadCompanionMemory(userId, storage);
  return saveCompanionMemory(
    userId,
    { preferences: { ...current.preferences, autonomy } },
    storage
  );
}

/** Adopt anonymous context once, without overwriting account-owned fields. */
export function adoptAnonymousCompanionMemory(userId, storage = globalThis.localStorage) {
  if (!userId || !storage) return loadCompanionMemory(userId, storage);
  const account = loadCompanionMemory(userId, storage);
  const anonymous = loadCompanionMemory(null, storage);
  const adoptedMarker = `${PREFIX}adopted:${userId}`;
  if (storage.getItem(adoptedMarker)) return account;
  const merged = saveCompanionMemory(
    userId,
    {
      identity: account.identity || anonymous.identity,
      role: account.role || anonymous.role,
      goals: [...new Set([...anonymous.goals, ...account.goals])].slice(-8),
      interviewComplete: account.interviewComplete || anonymous.interviewComplete,
      references: Object.fromEntries(
        ["lenses", "generators", "paths"].map((kind) => [
          kind,
          [...new Map([...anonymous.references[kind], ...account.references[kind]].map((ref) => [ref.id || ref.name, ref])).values()],
        ])
      ),
      actions: [...anonymous.actions, ...account.actions].slice(-MAX_ACTIONS),
      memories: [...anonymous.memories, ...account.memories]
        .filter((entry, index, entries) => entries.findIndex((candidate) => candidate.id === entry.id) === index)
        .slice(-MAX_MEMORIES),
    },
    storage
  );
  storage.setItem(adoptedMarker, "1");
  storage.removeItem(companionMemoryKey(null));
  return merged;
}

export function nextInterviewPrompt(memory) {
  // Zero-demand default: never quiz unless an explicit incomplete interview is resumed.
  if (memory.interviewPaused || memory.interviewComplete) return null;
  if (!memory.identity) return "Who are you?";
  if (!memory.role) return "What do you do?";
  return "What should I do first?";
}

export function applyInterviewAnswer(memory, answer) {
  const value = String(answer || "").trim();
  if (!memory.identity) return { ...memory, identity: value };
  if (!memory.role) return { ...memory, role: value };
  return { ...memory, goals: [...memory.goals, value].slice(-8), interviewComplete: true };
}

export function pauseCompanionInterview(userId, storage = globalThis.localStorage) {
  return saveCompanionMemory(userId, { interviewPaused: true }, storage);
}

export function resumeCompanionInterview(userId, storage = globalThis.localStorage) {
  return saveCompanionMemory(userId, { interviewPaused: false }, storage);
}

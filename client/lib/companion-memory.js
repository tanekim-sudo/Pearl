export const COMPANION_MEMORY_VERSION = 1;
export const ANONYMOUS_COMPANION_SCOPE = "anonymous";
const PREFIX = "lens.companion.memory.v1:";
const MAX_ACTIONS = 20;
const MAX_REFS = 40;

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
    interviewComplete: false,
    interviewPaused: false,
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
    interviewPaused: Boolean(memory?.interviewPaused),
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
  const refs = [...current.references[kind].filter((entry) => (entry.id || entry.name) !== key), reference];
  return saveCompanionMemory(
    userId,
    { references: { ...current.references, [kind]: refs.slice(-MAX_REFS) } },
    storage
  );
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
    },
    storage
  );
  storage.setItem(adoptedMarker, "1");
  storage.removeItem(companionMemoryKey(null));
  return merged;
}

export function nextInterviewPrompt(memory) {
  if (memory.interviewPaused) return null;
  if (!memory.identity) return "Who are you?";
  if (!memory.role) return "What do you do?";
  if (!memory.interviewComplete) return "What should I do first?";
  return null;
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

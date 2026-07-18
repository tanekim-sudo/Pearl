import { commandContract, executeDomainCommand } from "./domain-commands.js";

export const ORB_RUNTIME_VERSION = 1;
export const ORB_STATES = Object.freeze([
  "idle",
  "listening",
  "interpreting",
  "planning",
  "researching",
  "executing",
  "branching",
  "approval",
  "blocked",
  "completed",
  "paused",
  "recovery",
]);

const TRANSITIONS = Object.freeze({
  idle: ["listening", "interpreting", "planning", "executing", "paused", "recovery"],
  listening: ["interpreting", "idle", "paused", "blocked"],
  interpreting: ["planning", "executing", "approval", "blocked", "idle"],
  planning: ["researching", "executing", "branching", "approval", "blocked", "paused"],
  researching: ["planning", "executing", "blocked", "paused"],
  executing: ["completed", "blocked", "paused", "recovery", "branching"],
  branching: ["executing", "completed", "blocked", "paused"],
  approval: ["executing", "idle", "blocked"],
  blocked: ["planning", "recovery", "idle"],
  completed: ["idle", "listening", "executing", "branching"],
  paused: ["planning", "executing", "idle", "recovery"],
  recovery: ["planning", "executing", "completed", "blocked", "idle"],
});

const clone = (value) => structuredClone(value);
const nowIso = (now = Date.now()) => new Date(now).toISOString();

export function createOrbState(overrides = {}) {
  return {
    version: ORB_RUNTIME_VERSION,
    phase: "idle",
    taskId: null,
    effectId: null,
    commandId: null,
    placement: { x: 28, y: 28, dock: "bottom-right", minimized: false, manual: false },
    activeIntent: null,
    context: [],
    ledger: [],
    trace: [],
    updatedAt: nowIso(),
    ...clone(overrides),
  };
}

export function transitionOrb(state, phase, event = {}) {
  const current = state?.phase || "idle";
  if (!ORB_STATES.includes(phase)) throw new Error(`unknown orb state "${phase}"`);
  if (phase !== current && !TRANSITIONS[current]?.includes(phase)) {
    throw new Error(`invalid orb transition ${current} → ${phase}`);
  }
  const at = event.at || nowIso();
  return {
    ...state,
    phase,
    taskId: event.taskId ?? state.taskId ?? null,
    effectId: event.effectId ?? state.effectId ?? null,
    commandId: event.commandId ?? state.commandId ?? null,
    updatedAt: at,
    trace: [...(state.trace || []), {
      id: event.traceId || `${event.taskId || state.taskId || "orb"}:${(state.trace || []).length + 1}`,
      from: current,
      to: phase,
      taskId: event.taskId ?? state.taskId ?? null,
      effectId: event.effectId ?? state.effectId ?? null,
      commandId: event.commandId ?? state.commandId ?? null,
      at,
      evidence: event.evidence || null,
    }].slice(-500),
  };
}

export function setOrbPlacement(state, placement) {
  const x = Number(placement?.x);
  const y = Number(placement?.y);
  return {
    ...state,
    placement: {
      ...state.placement,
      ...placement,
      x: Number.isFinite(x) ? x : state.placement.x,
      y: Number.isFinite(y) ? y : state.placement.y,
      manual: placement?.manual ?? true,
    },
    updatedAt: nowIso(),
  };
}

export function normalizeOrbUtterance(raw) {
  return String(raw || "")
    .normalize("NFKC")
    .replace(/\b(?:um+|uh+|erm|please)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function recordOrbUtterance(state, raw, options = {}) {
  const normalized = normalizeOrbUtterance(raw);
  const id = options.id || `utterance:${options.sessionId || "local"}:${options.sequence ?? (state.ledger || []).length + 1}`;
  const existing = (state.ledger || []).find((entry) => entry.id === id);
  if (existing) return { state, entry: existing, duplicate: true };
  const entry = {
    id,
    raw: String(raw || ""),
    normalized,
    at: options.at || nowIso(),
    targetSnapshot: clone(options.targetSnapshot || []),
    contextSnapshot: clone(options.contextSnapshot || []),
    status: "recorded",
    dispatchId: null,
    correctionOf: options.correctionOf || null,
  };
  return { state: { ...state, ledger: [...(state.ledger || []), entry].slice(-1000) }, entry, duplicate: false };
}

export function markUtteranceDispatched(state, utteranceId, dispatchId) {
  let found = false;
  const ledger = (state.ledger || []).map((entry) => {
    if (entry.id !== utteranceId) return entry;
    found = true;
    if (entry.dispatchId && entry.dispatchId !== dispatchId) throw new Error("utterance already dispatched");
    return { ...entry, status: "dispatched", dispatchId };
  });
  if (!found) throw new Error("utterance not found");
  return { ...state, ledger };
}

export async function executeOrbCommand({
  orb,
  command,
  state,
  args,
  taskId,
  dispatchId,
  observe,
  persist,
  rollback,
  idFactory,
  now,
}) {
  const contract = commandContract(command);
  if (!contract) throw new Error(`unknown canonical command "${command}"`);
  const commandId = dispatchId || `${command}:${taskId || crypto.randomUUID()}`;
  let runtime = transitionOrb(orb, "executing", { taskId, commandId });
  const execution = await executeDomainCommand(command, state, args, { persist, rollback, idFactory, now });
  const expected = contract.observableEffects || [];
  const observation = await observe?.({ command, commandId, result: execution.result, expected });
  const observedEffects = new Set(observation?.effects || execution.result?.effects || []);
  const missing = expected.filter((effect) => !observedEffects.has(effect));
  if (missing.length) {
    await rollback?.(execution.undo(), { command, error: new Error(`unverified effects: ${missing.join(", ")}`) });
    runtime = transitionOrb(runtime, "recovery", {
      taskId,
      commandId,
      evidence: { missing, observation: observation || null },
    });
    throw Object.assign(new Error(`command effects were not verified: ${missing.join(", ")}`), { orb: runtime });
  }
  const effectId = observation?.effectId || `${commandId}:effect`;
  runtime = transitionOrb(runtime, "completed", {
    taskId,
    commandId,
    effectId,
    evidence: { expected, observed: [...observedEffects] },
  });
  return {
    ...execution,
    orb: runtime,
    verification: { fresh: true, commandId, effectId, expected, observed: [...observedEffects] },
    animationTrace: { commandId, effectId, disabledSafe: true },
  };
}

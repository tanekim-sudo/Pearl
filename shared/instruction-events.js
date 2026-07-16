import { contentFingerprint } from "./lens-grammar.js";
import { normalizeOutputSpec, suggestedOutputSpec } from "./output-specifications.js";
import { normalizeLibraryObject } from "./library-objects.js";

export const INSTRUCTION_EVENT_VERSION = 1;
export const INSTRUCTION_ROLES = Object.freeze(["user-instruction", "assistant-output", "system-context", "tool-result", "unknown"]);
const ROLES = new Set(INSTRUCTION_ROLES);
const MAX_INSTRUCTION = 120_000;
const MAX_REFS = 100;
const BLOCKED_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function assertPlain(value, depth = 0, seen = new WeakSet()) {
  if (depth > 20) throw new Error("instruction event exceeds depth limit");
  if (value == null || ["string", "number", "boolean"].includes(typeof value)) return;
  if (typeof value !== "object" || value instanceof Date) throw new Error("instruction event must contain plain data");
  if (seen.has(value)) throw new Error("instruction event contains a cycle");
  seen.add(value);
  for (const key of Object.keys(value)) {
    if (BLOCKED_KEYS.has(key)) throw new Error("instruction event contains an unsafe key");
    assertPlain(value[key], depth + 1, seen);
  }
  seen.delete(value);
}

const boundedRef = (value = {}) => ({
  id: String(value.id || "").slice(0, 256),
  type: String(value.type || value.machineKind || "text").slice(0, 80),
  role: String(value.role || "").slice(0, 80),
});

export function createInstructionEvent(value = {}, options = {}) {
  assertPlain(value);
  const instruction = String(value.instruction || value.sourceInstruction || "").slice(0, MAX_INSTRUCTION);
  if (!instruction.trim()) throw new Error("instruction event requires user-owned instruction text");
  const role = ROLES.has(value.role) ? value.role : "unknown";
  if (role === "system-context") throw new Error("system/private context cannot be captured as a Move");
  const event = {
    kind: "instruction-event",
    version: INSTRUCTION_EVENT_VERSION,
    id: String(value.id || options.id || globalThis.crypto?.randomUUID?.() || `instruction-${Date.now()}`),
    role,
    sourceInstruction: instruction,
    inputRefs: (value.inputRefs || []).slice(0, MAX_REFS).map(boundedRef),
    outputRefs: (value.outputRefs || []).slice(0, MAX_REFS).map(boundedRef),
    inputRequirement: {
      type: String(value.inputRequirement?.type || value.inputRefs?.[0]?.type || "text").slice(0, 80),
      arity: Math.max(1, Math.min(MAX_REFS, Number(value.inputRequirement?.arity) || Math.max(1, value.inputRefs?.length || 1))),
    },
    outputSpec: value.outputSpec ? normalizeOutputSpec(value.outputSpec) : null,
    modelProvenance: value.modelProvenance ? {
      requestedModel: String(value.modelProvenance.requestedModel || "").slice(0, 256),
      resolvedModel: String(value.modelProvenance.resolvedModel || "").slice(0, 256),
      gateway: String(value.modelProvenance.gateway || "").slice(0, 120),
      fallback: !!value.modelProvenance.fallback,
    } : null,
    lensContextFingerprint: String(value.lensContextFingerprint || "").slice(0, 256),
    status: ["succeeded", "failed", "cancelled", "draft"].includes(value.status) ? value.status : "draft",
    source: {
      surface: String(value.source?.surface || options.surface || "web").slice(0, 80),
      objectId: String(value.source?.objectId || "").slice(0, 256),
      sessionId: String(value.source?.sessionId || "").slice(0, 256),
      clauseId: String(value.source?.clauseId || "").slice(0, 256),
    },
    at: Number(value.at) || Date.now(),
  };
  event.fingerprint = contentFingerprint({
    instruction: instruction.replace(/\r\n/g, "\n").trim(),
    role,
    inputRequirement: event.inputRequirement,
  });
  return event;
}

export function deterministicMoveName(instruction) {
  const first = String(instruction || "").replace(/\s+/g, " ").trim().split(/[.!?\n]/)[0];
  const withoutLead = first.replace(/^(?:please|could you|can you|i want you to|would you)\s+/i, "");
  return (withoutLead || "Captured instruction").slice(0, 72);
}

function templateFromEvidence(event, options) {
  const exact = event.sourceInstruction;
  const span = options.inputSpan;
  if (!span) return exact;
  const start = Number(span.start);
  const end = Number(span.end);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > exact.length) {
    throw new Error("input span must be an exact bounded source range");
  }
  return `${exact.slice(0, start)}{input}${exact.slice(end)}`;
}

export function captureMoveFromInstruction(rawEvent, options = {}) {
  const event = createInstructionEvent(rawEvent, options);
  if (!["user-instruction", "unknown", "assistant-output"].includes(event.role)) {
    throw new Error("this source role is not eligible for Move capture");
  }
  if (event.role !== "user-instruction" && options.confirmInstruction !== true && options.infer !== true) {
    return {
      status: "choice-required",
      event,
      choices: ["use-text-as-instruction", "infer-producing-move"],
      warning: event.role === "assistant-output"
        ? "This is assistant output, not the instruction that produced it."
        : "The selected text has an unknown role.",
    };
  }
  const promptTemplate = templateFromEvidence(event, options);
  const move = normalizeLibraryObject({
    kind: "move",
    schemaVersion: 2,
    id: options.id,
    stableId: options.id,
    version: 1,
    name: options.name || deterministicMoveName(promptTemplate),
    prompt: promptTemplate,
    promptTemplate,
    sourceInstruction: event.sourceInstruction,
    inputRequirements: event.inputRequirement,
    outputSpec: event.outputSpec || suggestedOutputSpec({ name: deterministicMoveName(promptTemplate), prompt: promptTemplate }),
    modelPreference: options.modelPreference || (
      event.modelProvenance?.resolvedModel ? { mode: "creator-recommended", model: event.modelProvenance.resolvedModel } : null
    ),
    provenance: {
      kind: "captured-instruction",
      private: true,
      instructionEventId: event.id,
      instructionFingerprint: event.fingerprint,
      source: event.source,
      resultStatus: event.status,
      lensContextFingerprint: event.lensContextFingerprint || null,
    },
  }, options);
  return {
    status: event.status === "failed" || event.status === "cancelled" ? "captured-with-warning" : "captured",
    event,
    move,
    warning: event.status === "failed" || event.status === "cancelled" ? "This instruction was not proven by a successful run." : null,
  };
}

export function findEquivalentMove(eventValue, objects = []) {
  const event = eventValue?.kind === "instruction-event" ? eventValue : createInstructionEvent(eventValue);
  return objects.find((object) => object.kind === "move" && (
    object.provenance?.instructionFingerprint === event.fingerprint
    || String(object.promptTemplate || object.prompt || "").replace(/\r\n/g, "\n").trim() === event.sourceInstruction.replace(/\r\n/g, "\n").trim()
  )) || null;
}

export function mergeInstructionEventJournal(current = [], incoming = []) {
  const byId = new Map();
  for (const raw of [...current, ...incoming]) {
    const event = raw?.kind === "instruction-event" ? raw : createInstructionEvent(raw);
    const previous = byId.get(event.id);
    if (!previous || Number(event.updatedAt || event.at) >= Number(previous.updatedAt || previous.at)) {
      byId.set(event.id, { ...event, private: event.private !== false, active: event.active !== false });
    }
  }
  return [...byId.values()].sort((a, b) => a.at - b.at);
}

export function recordInstructionExecution(eventValue, result = {}) {
  const event = eventValue?.kind === "instruction-event" ? structuredClone(eventValue) : createInstructionEvent(eventValue);
  return {
    ...event,
    outputRefs: (result.outputRefs || event.outputRefs || []).slice(0, MAX_REFS).map(boundedRef),
    outputSpec: result.outputSpec ? normalizeOutputSpec(result.outputSpec) : event.outputSpec,
    modelProvenance: result.modelProvenance || event.modelProvenance,
    status: ["succeeded", "failed", "cancelled"].includes(result.status) ? result.status : event.status,
    executionId: String(result.executionId || "").slice(0, 256),
    updatedAt: Number(result.at) || Date.now(),
  };
}

export function undoInstructionEvent(journal = [], eventId, now = Date.now()) {
  let found = false;
  const events = journal.map((event) => {
    if (event.id !== eventId || event.active === false) return event;
    found = true;
    return { ...event, active: false, retractedAt: now, updatedAt: now };
  });
  return { events, changed: found };
}

export function suggestRecurringInstructions(journal = [], { minimum = 2 } = {}) {
  const groups = new Map();
  for (const event of journal) {
    if (event.active === false || event.status !== "succeeded") continue;
    const list = groups.get(event.fingerprint) || [];
    list.push(event);
    groups.set(event.fingerprint, list);
  }
  return [...groups.values()]
    .filter((events) => events.length >= Math.max(2, minimum))
    .map((events) => ({
      fingerprint: events[0].fingerprint,
      count: events.length,
      sourceInstruction: events[0].sourceInstruction,
      eventIds: events.map((event) => event.id),
      suggestion: "save-as-move",
      private: true,
    }))
    .sort((a, b) => b.count - a.count);
}

export function exportInstructionEventJournal(journal = [], { includePrivateText = false } = {}) {
  return {
    version: INSTRUCTION_EVENT_VERSION,
    exportedAt: new Date().toISOString(),
    privacy: includePrivateText ? "explicit-private-text-included" : "metadata-only",
    events: journal.map((event) => ({
      id: event.id,
      fingerprint: event.fingerprint,
      role: event.role,
      status: event.status,
      active: event.active !== false,
      at: event.at,
      source: { surface: event.source?.surface || "" },
      inputRequirement: event.inputRequirement,
      outputSpec: event.outputSpec,
      modelProvenance: event.modelProvenance,
      ...(includePrivateText ? { sourceInstruction: event.sourceInstruction } : {}),
    })),
  };
}

import { contentFingerprint } from "./lens-grammar.js";
import { normalizeOutputSpec } from "./output-specifications.js";

export const GENERATION_PLAN_VERSION = 1;
export const GENERATION_BATCH_VERSION = 1;
export const TASTE_FEEDBACK_VERSION = 1;
export const GENERATION_LIMITS = Object.freeze({
  interactiveCandidates: 20,
  parallelism: 8,
  modelId: 256,
  budgetUsd: 100,
  nesting: 20,
});

const MODES = new Set(["auto", "single", "exact", "weighted", "compare"]);
const STOP_POLICIES = new Set(["complete", "first-accepted", "manual"]);
const CANDIDATE_STATUSES = new Set(["pending", "running", "streaming", "completed", "failed", "cancelled"]);
const BLOCKED_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function assertPlain(value, path = "generation", depth = 0, seen = new WeakSet()) {
  if (depth > GENERATION_LIMITS.nesting) throw new Error(`${path} exceeds maximum depth`);
  if (value == null || ["string", "number", "boolean"].includes(typeof value)) return;
  if (typeof value !== "object" || value instanceof Date) throw new Error(`${path} must contain plain data`);
  if (seen.has(value)) throw new Error(`${path} contains a cycle`);
  seen.add(value);
  for (const key of Object.keys(value)) {
    if (BLOCKED_KEYS.has(key)) throw new Error(`${path} contains an unsafe key`);
    assertPlain(value[key], `${path}.${key}`, depth + 1, seen);
  }
  seen.delete(value);
}

const bounded = (value, max = 1000) => String(value ?? "").slice(0, max);
const modelId = (value) => {
  const id = bounded(value || "auto", GENERATION_LIMITS.modelId).trim();
  if (id === "auto") return id;
  if (!/^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._:/-]*$/i.test(id)) throw new Error(`invalid model ID "${id}"`);
  return id;
};
const int = (value, fallback, min, max) => Math.max(min, Math.min(max, Math.floor(Number(value) || fallback)));
const finite = (value, fallback, min, max) => Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : fallback));

export function defaultGenerationPlan() {
  return {
    version: GENERATION_PLAN_VERSION,
    candidateCount: 1,
    assignment: { mode: "auto", model: "auto", slots: [], groups: [] },
    temperature: null,
    diversity: 0.5,
    seed: null,
    parallelism: 1,
    budget: { maxUsd: 1, maxLatencyMs: 120_000 },
    perStructuralOutputVariants: null,
    stopPolicy: "complete",
    moreLikeThis: { count: 3, diversity: 0.35, modelStrategy: "inherit" },
  };
}

export function normalizeGenerationPlan(value = {}, options = {}) {
  assertPlain(value);
  const defaults = defaultGenerationPlan();
  const count = int(value.candidateCount ?? value.count, 1, 1, GENERATION_LIMITS.interactiveCandidates);
  const rawAssignment = value.assignment || {};
  const mode = MODES.has(rawAssignment.mode) ? rawAssignment.mode : "auto";
  const assignment = {
    mode,
    model: modelId(rawAssignment.model || value.model || "auto"),
    slots: (rawAssignment.slots || []).slice(0, count).map(modelId),
    groups: (rawAssignment.groups || []).slice(0, GENERATION_LIMITS.interactiveCandidates).map((group) => ({
      model: modelId(group?.model),
      count: int(group?.count, 1, 1, GENERATION_LIMITS.interactiveCandidates),
      weight: finite(group?.weight, 1, 0.01, 100),
    })),
  };
  if (mode === "exact" && assignment.slots.length !== count) throw new Error("exact model assignment must provide one model per candidate");
  if (mode === "weighted" && !assignment.groups.length) throw new Error("weighted model assignment requires at least one group");
  if (mode === "compare" && !assignment.slots.length) throw new Error("compare mode requires model slots");
  const plan = {
    version: GENERATION_PLAN_VERSION,
    candidateCount: mode === "compare" ? assignment.slots.length : count,
    assignment,
    temperature: value.temperature == null ? null : finite(value.temperature, 0.7, 0, 2),
    diversity: finite(value.diversity, defaults.diversity, 0, 1),
    seed: value.seed == null ? null : int(value.seed, 1, 0, 2 ** 31 - 1),
    parallelism: int(value.parallelism, Math.min(count, 4), 1, GENERATION_LIMITS.parallelism),
    budget: {
      maxUsd: finite(value.budget?.maxUsd, defaults.budget.maxUsd, 0, GENERATION_LIMITS.budgetUsd),
      maxLatencyMs: int(value.budget?.maxLatencyMs, defaults.budget.maxLatencyMs, 1000, 600_000),
    },
    perStructuralOutputVariants: value.perStructuralOutputVariants == null
      ? null
      : int(value.perStructuralOutputVariants, 1, 1, GENERATION_LIMITS.interactiveCandidates),
    stopPolicy: STOP_POLICIES.has(value.stopPolicy) ? value.stopPolicy : defaults.stopPolicy,
    moreLikeThis: {
      count: int(value.moreLikeThis?.count, defaults.moreLikeThis.count, 1, GENERATION_LIMITS.interactiveCandidates),
      diversity: finite(value.moreLikeThis?.diversity, defaults.moreLikeThis.diversity, 0, 1),
      modelStrategy: ["inherit", "auto", "explicit"].includes(value.moreLikeThis?.modelStrategy)
        ? value.moreLikeThis.modelStrategy
        : "inherit",
      model: value.moreLikeThis?.model ? modelId(value.moreLikeThis.model) : null,
    },
  };
  plan.fingerprint = contentFingerprint({ ...plan, fingerprint: undefined });
  return plan;
}

export function resolveGenerationAssignments(planValue, compatibleModelIds = []) {
  const plan = normalizeGenerationPlan(planValue);
  const compatible = new Set(compatibleModelIds);
  const ensureCompatible = (id) => {
    if (id !== "auto" && compatible.size && !compatible.has(id)) throw new Error(`model "${id}" is incompatible with this task`);
    return id;
  };
  let assignments;
  if (plan.assignment.mode === "single") assignments = Array(plan.candidateCount).fill(ensureCompatible(plan.assignment.model));
  else if (plan.assignment.mode === "exact" || plan.assignment.mode === "compare") assignments = plan.assignment.slots.map(ensureCompatible);
  else if (plan.assignment.mode === "weighted") {
    assignments = plan.assignment.groups.flatMap((group) => Array(group.count).fill(ensureCompatible(group.model)));
    if (assignments.length < plan.candidateCount) {
      const weighted = [...plan.assignment.groups].sort((a, b) => b.weight - a.weight);
      while (assignments.length < plan.candidateCount) assignments.push(ensureCompatible(weighted[assignments.length % weighted.length].model));
    }
    assignments = assignments.slice(0, plan.candidateCount);
  } else assignments = Array(plan.candidateCount).fill("auto");
  return assignments.map((requestedModel, index) => ({ index, requestedModel }));
}

export function deriveComposedGenerationPlan(leftValue, rightValue, override = null) {
  if (override) return normalizeGenerationPlan(override);
  const left = normalizeGenerationPlan(leftValue || {});
  const right = normalizeGenerationPlan(rightValue || {});
  return normalizeGenerationPlan({
    ...right,
    candidateCount: 1,
    assignment: { mode: "auto", model: "auto" },
    moreLikeThis: right.moreLikeThis,
    recommendations: [left.fingerprint, right.fingerprint],
  });
}

export function createGenerationBatch(value = {}, options = {}) {
  assertPlain(value);
  const plan = normalizeGenerationPlan(value.generationPlan || value.plan);
  const assignments = resolveGenerationAssignments(plan, value.compatibleModelIds || []);
  const id = bounded(value.id || options.id || globalThis.crypto?.randomUUID?.() || `batch-${Date.now()}`, 256);
  const outputSpec = normalizeOutputSpec(value.outputSpec, value.artifact || {});
  const candidates = assignments.map(({ index, requestedModel }) => ({
    id: bounded(value.candidateIds?.[index] || `${id}:candidate-${index + 1}`, 256),
    version: GENERATION_BATCH_VERSION,
    batchId: id,
    index,
    sourceNodeId: bounded(value.sourceNodeId, 256),
    parentCandidateId: bounded(value.parentCandidateId, 256) || null,
    status: "pending",
    requestedModel,
    resolvedModel: null,
    providerRoute: null,
    fallback: false,
    typedResult: null,
    outputSpec,
    feedback: null,
    provenance: null,
    error: null,
  }));
  return {
    kind: "generation-batch",
    version: GENERATION_BATCH_VERSION,
    id,
    idempotencyKey: bounded(value.idempotencyKey || id, 256),
    sourceNodeId: bounded(value.sourceNodeId, 256),
    inputRefs: (value.inputRefs || []).slice(0, 100).map((ref) => ({ id: bounded(ref?.id, 256), type: bounded(ref?.type, 80) })),
    artifactRef: value.artifactRef ? { id: bounded(value.artifactRef.id, 256), version: int(value.artifactRef.version, 1, 1, 1_000_000), kind: bounded(value.artifactRef.kind, 40) } : null,
    lensRefs: (value.lensRefs || []).slice(0, 20).map((ref) => ({ id: bounded(ref?.id, 256), version: int(ref?.version, 1, 1, 1_000_000), contextFingerprint: bounded(ref?.contextFingerprint, 256) })),
    generationPlan: plan,
    structuralOutputSpec: outputSpec,
    parentCandidateId: bounded(value.parentCandidateId, 256) || null,
    status: "pending",
    focusedCandidateId: candidates[0]?.id || null,
    candidates,
    createdAt: Number(value.createdAt) || Date.now(),
    private: true,
  };
}

export function updateCandidate(batchValue, candidateId, patch = {}) {
  assertPlain(patch);
  const found = batchValue.candidates.some((candidate) => candidate.id === candidateId);
  if (!found) throw new Error("candidate not found");
  const candidates = batchValue.candidates.map((candidate) => {
    if (candidate.id !== candidateId) return candidate;
    const status = CANDIDATE_STATUSES.has(patch.status) ? patch.status : candidate.status;
    return {
      ...candidate,
      ...patch,
      id: candidate.id,
      batchId: candidate.batchId,
      status,
      requestedModel: candidate.requestedModel,
      fallback: patch.fallback == null ? candidate.fallback : !!patch.fallback,
    };
  });
  const active = candidates.some((candidate) => ["pending", "running", "streaming"].includes(candidate.status));
  const completed = candidates.some((candidate) => candidate.status === "completed");
  return { ...batchValue, candidates, status: active ? "running" : completed ? "completed" : "failed" };
}

export function recordTasteFeedback(batchValue, candidateId, decision, options = {}) {
  if (!["accepted", "rejected", "undecided"].includes(decision)) throw new Error("invalid taste decision");
  const feedback = decision === "undecided" ? null : normalizeTasteFeedback({
    decision,
    ...options,
  });
  let batch = updateCandidate(batchValue, candidateId, { feedback });
  const undecided = batch.candidates.find((candidate) => !candidate.feedback && candidate.id !== candidateId);
  batch = { ...batch, focusedCandidateId: undecided?.id || candidateId };
  return batch;
}

export function normalizeTasteFeedback(value = {}) {
  assertPlain(value, "tasteFeedback");
  if (!["accepted", "rejected"].includes(value.decision)) throw new Error("taste feedback decision must be accepted or rejected");
  return {
    version: TASTE_FEEDBACK_VERSION,
    decision: value.decision,
    reason: bounded(value.reason, 2000),
    private: value.remember !== true && value.remembered !== true,
    remembered: value.remember === true || value.remembered === true,
    at: Number(value.at) || Date.now(),
  };
}

export function moreLikeThisPlan(batchValue, candidateId, options = {}) {
  const candidate = batchValue.candidates.find((entry) => entry.id === candidateId);
  if (!candidate || candidate.status !== "completed") throw new Error("more-like-this requires a completed candidate");
  const count = int(options.count, batchValue.generationPlan.moreLikeThis.count, 1, GENERATION_LIMITS.interactiveCandidates);
  const siblings = batchValue.candidates.filter((entry) => entry.id !== candidateId && entry.status === "completed");
  return {
    parentCandidateId: candidate.id,
    generationPlan: normalizeGenerationPlan({
      ...batchValue.generationPlan,
      candidateCount: count,
      diversity: options.diversity ?? batchValue.generationPlan.moreLikeThis.diversity,
      assignment: options.model
        ? { mode: "single", model: options.model }
        : candidate.requestedModel === "auto"
          ? { mode: "auto", model: "auto" }
          : { mode: "single", model: candidate.requestedModel },
    }),
    exemplar: { candidateId: candidate.id, typedResult: candidate.typedResult },
    positiveExamples: [candidate, ...siblings.filter((entry) => entry.feedback?.decision === "accepted")].slice(0, 3)
      .map((entry) => ({ candidateId: entry.id, typedResult: entry.typedResult })),
    negativeExamples: siblings.filter((entry) => entry.feedback?.decision === "rejected").slice(0, 3)
      .map((entry) => ({ candidateId: entry.id, typedResult: entry.typedResult, reason: entry.feedback.reason })),
    preserve: (options.preserve || []).slice(0, 20).map((entry) => bounded(entry, 500)),
    change: (options.change || []).slice(0, 20).map((entry) => bounded(entry, 500)),
    private: true,
  };
}

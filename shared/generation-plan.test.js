import test from "node:test";
import assert from "node:assert/strict";
import {
  comparativeLabels,
  createGenerationBatch,
  deriveComposedGenerationPlan,
  moreLikeThisPlan,
  normalizeBranchSpec,
  normalizeDifferentiationLabel,
  normalizeGenerationPlan,
  recordTasteFeedback,
  resolveGenerationAssignments,
  updateCandidate,
} from "./generation-plan.js";

const multiOutput = {
  version: 1,
  mode: "custom",
  machineKind: "multi",
  semanticType: "Brief AND Memo",
  cardinality: { min: 2, max: 2 },
  branches: [
    { id: "brief", label: "One-page brief", spec: { version: 1, mode: "custom", machineKind: "richText", semanticType: "brief", cardinality: { min: 1, max: 1 }, branches: [] } },
    { id: "memo", label: "Investment memo", spec: { version: 1, mode: "custom", machineKind: "richText", semanticType: "memo", cardinality: { min: 1, max: 1 }, branches: [] } },
  ],
};

test("migrates existing artifacts to one Auto candidate independently of structural output cardinality", () => {
  const plan = normalizeGenerationPlan({});
  assert.equal(plan.candidateCount, 1);
  assert.equal(plan.assignment.mode, "auto");
  const batch = createGenerationBatch({ id: "b", plan, outputSpec: multiOutput });
  assert.equal(batch.candidates.length, 1);
  assert.equal(batch.structuralOutputSpec.branches.length, 2);
});

test("resolves all-auto, single, exact, weighted, and compare assignments", () => {
  assert.deepEqual(resolveGenerationAssignments({ count: 5 }).map((entry) => entry.requestedModel), Array(5).fill("auto"));
  assert.deepEqual(resolveGenerationAssignments({
    count: 3, assignment: { mode: "single", model: "anthropic/claude-opus-4.8" },
  }).map((entry) => entry.requestedModel), Array(3).fill("anthropic/claude-opus-4.8"));
  assert.deepEqual(resolveGenerationAssignments({
    count: 3, assignment: { mode: "exact", slots: ["a/model", "b/model", "auto"] },
  }).map((entry) => entry.requestedModel), ["a/model", "b/model", "auto"]);
  assert.deepEqual(resolveGenerationAssignments({
    count: 5,
    assignment: { mode: "weighted", groups: [{ model: "a/model", count: 2 }, { model: "b/model", count: 2 }, { model: "auto", count: 1 }] },
  }).map((entry) => entry.requestedModel), ["a/model", "a/model", "b/model", "b/model", "auto"]);
  assert.equal(normalizeGenerationPlan({
    count: 10, assignment: { mode: "compare", slots: ["a/model", "b/model"] },
  }).candidateCount, 2);
});

test("validates model compatibility, counts, and malformed input", () => {
  assert.equal(normalizeGenerationPlan({ count: 999 }).candidateCount, 20);
  assert.throws(() => normalizeGenerationPlan({ count: 2, assignment: { mode: "exact", slots: ["a/model"] } }), /one model per candidate/);
  assert.throws(() => resolveGenerationAssignments(
    { assignment: { mode: "single", model: "a/model" } },
    ["b/model"],
  ), /incompatible/);
  assert.throws(() => normalizeGenerationPlan(JSON.parse('{"__proto__":{"polluted":true}}')), /unsafe key/);
});

test("feedback is reversible, advances focus, and remains private by default", () => {
  let batch = createGenerationBatch({ id: "b", plan: { count: 3 }, outputSpec: { semanticType: "text", machineKind: "text" } });
  batch = recordTasteFeedback(batch, "b:candidate-1", "accepted", { reason: "concrete" });
  assert.equal(batch.candidates[0].feedback.private, true);
  assert.equal(batch.focusedCandidateId, "b:candidate-2");
  batch = recordTasteFeedback(batch, "b:candidate-1", "undecided");
  assert.equal(batch.candidates[0].feedback, null);
});

test("more-like-this creates child strategy with bounded positive and negative examples", () => {
  let batch = createGenerationBatch({ id: "b", plan: { count: 3 }, outputSpec: { semanticType: "text", machineKind: "text" } });
  for (const candidate of batch.candidates) {
    batch = updateCandidate(batch, candidate.id, { status: "completed", typedResult: [{ text: candidate.id }] });
  }
  batch = recordTasteFeedback(batch, "b:candidate-1", "accepted");
  batch = recordTasteFeedback(batch, "b:candidate-2", "rejected", { reason: "generic" });
  const child = moreLikeThisPlan(batch, "b:candidate-1", { count: 5, preserve: ["specificity"] });
  assert.equal(child.parentCandidateId, "b:candidate-1");
  assert.equal(child.generationPlan.candidateCount, 5);
  assert.equal(child.negativeExamples[0].reason, "generic");
  assert.deepEqual(child.preserve, ["specificity"]);
});

test("composition never multiplies operand candidate counts", () => {
  const plan = deriveComposedGenerationPlan({ count: 5 }, { count: 4 });
  assert.equal(plan.candidateCount, 1);
  assert.equal(plan.assignment.mode, "auto");
});

test("BranchSpecs preserve branch-specific cognition independently of structural outputs", () => {
  const plan = normalizeGenerationPlan({
    branchSpecs: [
      { id: "optimistic", name: "Optimistic growth through partnerships", instruction: "Build the optimistic case.", model: "a/model" },
      { id: "conservative", name: "Conservative cash preservation path", instruction: "Protect cash and downside.", model: "b/model" },
      { id: "opposition", name: "Opposition case demand overstated", instruction: "Invert the thesis and challenge demand.", model: "auto" },
    ],
  });
  assert.equal(plan.version, 2);
  assert.equal(plan.candidateCount, 3);
  assert.deepEqual(plan.branchSpecs.map((branch) => branch.id), ["optimistic", "conservative", "opposition"]);
  const batch = createGenerationBatch({ id: "parallel", plan, outputSpec: multiOutput });
  assert.equal(batch.candidates.length, 3);
  assert.equal(batch.structuralOutputSpec.branches.length, 2);
  assert.equal(batch.candidates[1].branchSpec.instruction, "Protect cash and downside.");
  assert.deepEqual(batch.candidates.map((candidate) => candidate.requestedModel), ["a/model", "b/model", "auto"]);
});

test("BranchSpec migration is stable, bounded, and rejects unsafe provider options", () => {
  const branch = normalizeBranchSpec({ name: "A", count: 99, providerOptions: { temperature: 0.4 } });
  assert.equal(branch.id, "branch-1");
  assert.equal(branch.count, 20);
  assert.throws(() => normalizeBranchSpec(JSON.parse('{"providerOptions":{"__proto__":{"polluted":true}}}')), /unsafe key/);
});

test("comparative differentiation labels are unique Unicode-safe 3–8 words", () => {
  const labels = comparativeLabels([
    { name: "Conservative cash preservation path" },
    { name: "Conservative cash preservation path" },
    { name: "反対視点 需要 過大評価 ケース" },
  ]);
  assert.equal(new Set(labels.map((label) => label.normalize("NFKC").toLocaleLowerCase())).size, 3);
  for (const label of labels) {
    const count = label.trim().split(/\s+/u).length;
    assert.ok(count >= 3 && count <= 8, `${label} has ${count} words`);
  }
  assert.equal(normalizeDifferentiationLabel("too short"), "Distinct sibling perspective");
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveOutputSpec,
  inferSemanticOutput,
  migrateOperatorOutputSpecs,
  normalizeOutputSpec,
  outputContractLabel,
  outputContractPrompt,
  resetOutputSpec,
  suggestedOutputSpec,
  typedExecutionOutputs,
  validateOutputSpec,
} from "./output-specifications.js";
import { TRANSFORM_PRIMITIVES } from "./transform-primitives.js";

const mapOf = (...ops) => Object.fromEntries(ops.map((op) => [op.id, op]));

test("built-in primitives have curated deterministic semantic defaults", () => {
  const specs = Object.fromEntries(TRANSFORM_PRIMITIVES.map((op) => [op.name.toLowerCase(), suggestedOutputSpec(op)]));
  assert.equal(specs.research.semanticType, "annotated source brief");
  assert.equal(specs.branch.machineKind, "list");
  assert.equal(specs.merge.semanticType, "structured synthesis");
});

test("prose output inference prefers explicit instructions with a bounded fallback", () => {
  assert.equal(inferSemanticOutput({ name: "Diligence", prompt: "Return an investment memo." }), "investment memo");
  assert.equal(inferSemanticOutput({ name: "Build Counterexample List" }), "Counterexample List");
  assert.equal(inferSemanticOutput({}), "transformed text");
});

test("linear pipelines derive from their terminal function and update with child edits", () => {
  const a = { id: "a", kind: "prompt", name: "Collect evidence", prompt: "Return evidence." };
  const b = { id: "b", kind: "prompt", name: "One-page brief", prompt: "Write a one-page brief." };
  const root = { id: "root", kind: "pipeline", name: "Briefing", steps: ["a", "b"] };
  let map = mapOf(root, a, b);
  assert.equal(deriveOutputSpec(root, map).semanticType, "one-page brief");
  const edited = { ...b, outputSpec: { ...suggestedOutputSpec(b), mode: "custom", semanticType: "investment memo" } };
  map = mapOf(root, a, edited);
  assert.equal(deriveOutputSpec(root, map).semanticType, "investment memo");
});

test("parallel branches retain stable IDs, order, and an A AND B label", () => {
  const prefix = { id: "prefix", kind: "prompt", name: "Analyze", prompt: "Analyze." };
  const brief = { id: "brief", kind: "prompt", name: "One-page brief", prompt: "Write a one-page brief." };
  const memo = { id: "memo", kind: "prompt", name: "Investment memo", prompt: "Return an investment memo." };
  const fork = { id: "fork", kind: "pipeline", fork: true, name: "Outputs", steps: ["brief", "memo"] };
  const root = { id: "root", kind: "pipeline", name: "Diligence", steps: ["prefix", "fork"] };
  const spec = deriveOutputSpec(root, mapOf(root, prefix, fork, brief, memo));
  assert.equal(outputContractLabel(spec), "One Page Brief AND Investment Memo");
  assert.deepEqual(spec.branches.map((branch) => branch.id), [
    "branch:fork>brief",
    "branch:fork>memo",
  ]);
});

test("nested branches recurse, preserve leaf order, and dedupe truly identical contracts", () => {
  const x = { id: "x", kind: "prompt", name: "Table", prompt: "Return a table." };
  const y = { id: "y", kind: "prompt", name: "Table copy", outputSpec: { ...suggestedOutputSpec(x), mode: "custom" } };
  const z = { id: "z", kind: "prompt", name: "Counterexample list", prompt: "Return a counterexample list." };
  const inner = { id: "inner", kind: "pipeline", fork: true, steps: ["y", "z"] };
  const outer = { id: "outer", kind: "pipeline", fork: true, steps: ["x", "inner"] };
  const root = { id: "root", kind: "pipeline", steps: ["outer"] };
  const spec = deriveOutputSpec(root, mapOf(root, outer, inner, x, y, z));
  assert.deepEqual(spec.branches.map((branch) => branch.label), ["table", "counterexample list"]);
});

test("cycles are bounded and reported without throwing", () => {
  const a = { id: "a", kind: "pipeline", name: "A", steps: ["b"] };
  const b = { id: "b", kind: "pipeline", name: "B", steps: ["a"] };
  const spec = deriveOutputSpec(a, mapOf(a, b));
  assert.equal(spec.derivation.cycleDetected, true);
});

test("custom overrides remain stable, reset returns deterministic suggestions", () => {
  const op = { id: "memo", kind: "prompt", name: "Diligence", prompt: "Analyze." };
  const custom = normalizeOutputSpec({
    ...suggestedOutputSpec(op),
    mode: "custom",
    semanticType: "investment memo",
    machineKind: "richText",
  }, op);
  assert.equal(deriveOutputSpec({ ...op, outputSpec: custom }, { memo: op }).semanticType, "investment memo");
  assert.equal(resetOutputSpec({ ...op, outputSpec: custom }).mode, "suggested");
});

test("legacy operators migrate without losing fields and imports retain specifications", () => {
  const [migrated] = migrateOperatorOutputSpecs([{ id: "legacy", name: "Comparison", prompt: "Return a structured comparison.", privateField: "keep" }]);
  assert.equal(migrated.privateField, "keep");
  assert.equal(migrated.outputSpec.version, 1);
  assert.equal(migrated.outputSpec.semanticType, "structured comparison");
});

test("malformed, unsafe, oversized, duplicate, and reserved data is rejected", () => {
  const polluted = JSON.parse('{"version":1,"machineKind":"text","semanticType":"x","cardinality":{"min":1,"max":1},"__proto__":{"polluted":true}}');
  assert.throws(() => normalizeOutputSpec(polluted), /unsafe key/);
  assert.throws(() => normalizeOutputSpec({ schema: { value: "x".repeat(9000) } }), /too large/);
  const duplicate = {
    version: 1,
    mode: "override",
    machineKind: "multi",
    semanticType: "A AND A",
    cardinality: { min: 2, max: 2 },
    branches: [
      { id: "a", label: "same", spec: suggestedOutputSpec({ name: "same" }) },
      { id: "b", label: "same", spec: suggestedOutputSpec({ name: "same" }) },
    ],
  };
  assert.match(validateOutputSpec(duplicate).errors.join(" "), /duplicate/);
  assert.throws(() => normalizeOutputSpec({ ...duplicate, branches: [duplicate.branches[0], { ...duplicate.branches[1], label: "output" }] }), /reserved/);
});

test("runtime prompts and separately typed results retain branch provenance", () => {
  const spec = normalizeOutputSpec({
    version: 1,
    mode: "override",
    machineKind: "multi",
    branches: [
      { id: "brief", label: "one-page brief", spec: suggestedOutputSpec({ name: "brief" }) },
      { id: "memo", label: "investment memo", spec: suggestedOutputSpec({ name: "memo" }) },
    ],
  });
  assert.match(outputContractPrompt(spec), /one-page brief \[richText; brief\]/i);
  const outputs = typedExecutionOutputs(["brief text", "memo text"], spec, {}, { runId: "run" });
  assert.deepEqual(outputs.map((output) => output.branchId), ["brief", "memo"]);
  assert.deepEqual(outputs.map((output) => output.semanticType), ["one-page brief", "investment memo"]);
  assert.notEqual(outputs[0].id, outputs[1].id);
});

import test from "node:test";
import assert from "node:assert/strict";

import { runFunctionTestBench, validateFunctionStructure } from "./function-test-bench.js";

test("Function test bench validates dependency closure before execution", () => {
  const root = { id: "fn", name: "Workflow", kind: "pipeline", steps: ["missing"] };
  const result = validateFunctionStructure(root, [root]);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /Missing dependencies/);
});

test("Function test bench exercises fixtures, holdouts, models, compatibility and surface flows", async () => {
  const step = { id: "step", name: "Uppercase", kind: "prompt", prompt: "uppercase" };
  const root = { id: "fn", name: "Workflow", kind: "pipeline", steps: ["step"] };
  const result = await runFunctionTestBench({
    function: root,
    operators: [root, step],
    fixtures: [{ id: "fixture-a", input: "alpha", expected: "ALPHA" }],
    holdouts: [{ id: "holdout-a", input: "beta", expected: "BETA" }],
    models: ["model-a", "model-b"],
    runner: async (_fn, input) => input.toUpperCase(),
    evaluator: async ({ output, expected }) => ({ passed: output === expected, evidence: ["exact"] }),
    compatibility: async ({ closure }) => closure.ids.map((stableId) => ({ stableId, status: "compatible" })),
    browserFlows: [{ id: "web", surface: "web", run: async () => ({ passed: true, evidence: ["trace"] }) }],
    extensionFlows: [{ id: "extension", surface: "extension", run: async () => ({ passed: true, evidence: ["trace"] }) }],
  });
  assert.equal(result.status, "verified");
  assert.equal(result.runs.length, 4);
  assert.equal(result.summary.holdouts, 1);
  assert.deepEqual(new Set(result.runs.map((entry) => entry.model)), new Set(["model-a", "model-b"]));
  assert.equal(result.flows.length, 2);
});

test("Function test bench returns failed run evidence instead of false success", async () => {
  const step = { id: "step", name: "Step", kind: "prompt" };
  const root = { id: "fn", name: "Workflow", kind: "pipeline", steps: ["step"] };
  const result = await runFunctionTestBench({
    function: root,
    operators: [root, step],
    holdouts: [{ input: "input", expected: "expected" }],
    runner: async () => "wrong",
  });
  assert.equal(result.status, "failed");
  assert.equal(result.runs[0].status, "failed");
});

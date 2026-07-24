import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { reorderStep } from "../../shared/function-step-ops.js";
import {
  editorOpsToPearlFunction,
  pearlFunctionToEditorSeed,
} from "./pearl-function-tree-bridge.js";

describe("pearl-function-tree-bridge", () => {
  const fn = {
    id: "fn-memo",
    name: "Investment memo",
    steps: [
      { id: "m1", name: "Frame the thesis", description: "Frame" },
      { id: "m2", name: "Assess market and moat", description: "Market" },
      { id: "m3", name: "Write recommendation", description: "Rec" },
    ],
  };

  it("round-trips pearl Function ↔ LensTreeEditor draft ops", () => {
    const seed = pearlFunctionToEditorSeed(fn);
    assert.equal(seed.rootId, "fn-memo");
    assert.equal(seed.seedRoot.kind, "pipeline");
    assert.deepEqual(seed.seedRoot.steps, ["m1", "m2", "m3"]);
    const back = editorOpsToPearlFunction(fn, seed.seedOps, seed.rootId);
    assert.deepEqual(back.steps.map((step) => step.name), [
      "Frame the thesis",
      "Assess market and moat",
      "Write recommendation",
    ]);
  });

  it("reorders through the original reorderStep algorithm then saves back", () => {
    const seed = pearlFunctionToEditorSeed(fn);
    const nextOps = reorderStep(seed.seedOps, seed.rootId, 0, 2);
    const back = editorOpsToPearlFunction(fn, nextOps, seed.rootId);
    assert.deepEqual(back.steps.map((step) => step.name), [
      "Assess market and moat",
      "Frame the thesis",
      "Write recommendation",
    ]);
  });
});

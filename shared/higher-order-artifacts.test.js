import test from "node:test";
import assert from "node:assert/strict";
import { applyArtifactPatch, createArtifactPatch, createArtifactRef, testArtifactPatchIsolated } from "./higher-order-artifacts.js";

test("higher-order patches are bounded, selective, versioned, and stale-safe", async () => {
  const source = createArtifactRef({ id: "fn-1", version: 3, kind: "function", snapshot: { title: "Review", steps: [{ prompt: "Summarize" }] } });
  const patch = createArtifactPatch({
    source,
    purpose: "Make evidence grounded",
    operations: [
      { id: "title", op: "replace", path: "/title", value: "Evidence Review" },
      { id: "prompt", op: "replace", path: "/steps/0/prompt", value: "Summarize with cited evidence" },
    ],
  });
  const applied = applyArtifactPatch(source, patch, { acceptedHunkIds: ["prompt"] });
  assert.equal(applied.artifact.version, 4);
  assert.equal(applied.artifact.snapshot.title, "Review");
  assert.match(applied.artifact.snapshot.steps[0].prompt, /cited/);
  assert.deepEqual(applied.receipt.rejectedHunkIds, ["title"]);
  assert.throws(() => applyArtifactPatch({ ...source, version: 4 }, patch), /stale/);
  const report = await testArtifactPatchIsolated(source, patch, { fixtures: [{ input: "a" }], evaluate: async () => ({ passed: true }) });
  assert.equal(report.passed, true);
});

test("higher-order patches cannot modify protected registries or recurse without bounds", () => {
  const source = createArtifactRef({ id: "move-1", version: 1, kind: "move", snapshot: { promptTemplate: "Challenge" } });
  assert.throws(() => createArtifactPatch({ source, operations: [{ op: "replace", path: "/commandRegistry/x", value: "unsafe" }] }), /protected/);
  assert.throws(() => createArtifactPatch({ source, depth: 5, operations: [{ op: "replace", path: "/promptTemplate", value: "Safe" }] }), /depth/);
});

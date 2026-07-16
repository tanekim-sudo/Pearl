import test from "node:test";
import assert from "node:assert/strict";
import { startGenerationBatch } from "./generation-runner.js";

test("exposes placeholders immediately and persists partial candidate outcomes", async () => {
  const events = [];
  const handle = startGenerationBatch({
    artifactRef: { kind: "move", id: "move-a", version: 1 },
    generationPlan: { candidateCount: 3, assignment: { mode: "auto" }, parallelism: 2 },
    structuralOutputSpec: { semanticType: "text", machineKind: "text", cardinality: { min: 1, max: 1 } },
  }, {
    executeCandidate: async ({ candidate }) => {
      if (candidate.index === 1) throw Object.assign(new Error("provider failed"), { retryable: true });
      return {
        output: `candidate ${candidate.index + 1}`,
        provenance: { resolvedModel: "provider/model", providerRoute: "mock" },
      };
    },
    onCandidate: (event) => events.push(event.type),
  });
  assert.equal(handle.batch.candidates.length, 3);
  assert.ok(handle.batch.candidates.every((candidate) => ["pending", "running"].includes(candidate.status)));
  const batch = await handle.done;
  assert.equal(batch.candidates.filter((candidate) => candidate.status === "completed").length, 2);
  assert.equal(batch.candidates.filter((candidate) => candidate.status === "failed").length, 1);
  assert.ok(events.includes("candidate-started"));
  assert.ok(events.includes("candidate-completed"));
  assert.ok(events.includes("candidate-failed"));
});

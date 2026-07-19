import test from "node:test";
import assert from "node:assert/strict";
import {
  continuationItems,
  continuationMaterial,
  continuationMaterialCount,
} from "./extension-continuation.js";

const handoff = {
  handoff: { surface: "semantic-orb-scene", createdAt: 42 },
  semanticOrbs: [{ id: "orb-a" }],
  session: {
    fragments: [{
      id: "fragment-a",
      quote: "Explicit page selection",
      sourceUrl: "https://example.com/source",
      capturedAt: 12,
    }],
    results: [{
      id: "run-a",
      outputs: [{ id: "candidate-a", text: "Reviewed candidate", outputSpec: { machineKind: "text" } }],
    }],
  },
};

test("extension continuation preserves explicit sources and candidate provenance", () => {
  const items = continuationItems(handoff);
  assert.equal(continuationMaterialCount(handoff), 3);
  assert.deepEqual(items.map((item) => item.id), ["fragment-a", "candidate-a"]);
  assert.equal(items[0].provenance.sourceUrl, "https://example.com/source");
  assert.equal(items[1].provenance.runId, "run-a");
  assert.deepEqual(items[1].provenance.outputSpec, { machineKind: "text" });
});

test("extension continuation group references carried items without duplicating payloads", () => {
  const material = continuationMaterial(handoff, {
    id: "working-set-a",
    surface: "semantic-orb-scene",
    now: 99,
  });
  assert.equal(material.id, "working-set-a");
  assert.deepEqual(material.sourceIds, ["fragment-a", "candidate-a"]);
  assert.equal(material.text, undefined);
  assert.equal(material.provenance.handoff, "semantic-orb-scene");
  assert.equal(material.provenance.createdAt, 42);
});

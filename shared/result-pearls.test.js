import test from "node:test";
import assert from "node:assert/strict";
import { executeDomainCommand } from "./domain-commands.js";
import {
  placeResultPearls,
  redirectResultPearl,
  resultPearlChatMessage,
  spawnResultPearl,
  undoResultPearl,
  updateResultPearl,
} from "./result-pearls.js";

function result(overrides = {}) {
  return spawnResultPearl({
    id: "result:a",
    pearlId: "pearl:a",
    pageIdentity: "https://example.test/article",
    text: "private transformed output",
    sourceRefs: [{ id: "source:a" }],
    lens: { id: "lens:a", version: 2, strength: .8 },
    execution: { model: "configured", runId: "run:a" },
    branch: { index: 0, total: 2 },
    outputSpec: { kind: "text" },
    disclosureReceipt: { id: "receipt:a", disclosedCharacters: 20 },
    lineage: [{ id: "source:a" }],
    provenance: { sources: [{ title: "Source", url: "https://example.test/article" }] },
    ...overrides,
  });
}

test("nearest margin placement avoids source, controls, and sibling pearls", () => {
  const placements = placeResultPearls({
    anchor: { x: 420, y: 160, width: 320, height: 100 },
    viewport: { width: 1200, height: 700, scrollX: 0, scrollY: 400, devicePixelRatio: 2 },
    obstacles: [{ x: 752, y: 185, width: 40, height: 40 }],
    count: 4,
  });
  assert.equal(placements.length, 4);
  assert.equal(new Set(placements.map((entry) => `${entry.x}:${entry.y}`)).size, 4);
  assert.ok(placements.every((entry) => entry.x > 740));
  assert.ok(placements.every((entry) => entry.y >= 400));
  assert.ok(placements.every((entry) => entry.devicePixelRatio === 2));
});

test("narrow pages dock safely without overlapping branches", () => {
  const placements = placeResultPearls({
    anchor: { x: 4, y: 100, width: 312, height: 40 },
    viewport: { width: 320, height: 480 },
    count: 3,
  });
  assert.ok(placements.every((entry) => entry.docked));
  assert.equal(new Set(placements.map((entry) => entry.y)).size, 3);
  assert.ok(placements.every((entry) => entry.x >= 8 && entry.x + entry.width <= 312));
});

test("persisted result Pearl retains exact provenance across expansion and redirect", () => {
  const original = result();
  const expanded = updateResultPearl(original, { expanded: true, status: "opened", openedAt: Date.now() });
  const redirected = redirectResultPearl(expanded, { type: "new-tab" });
  assert.equal(redirected.id, original.id);
  assert.equal(redirected.outputId, original.outputId);
  assert.deepEqual(redirected.sourceRefs, original.sourceRefs);
  assert.deepEqual(redirected.disclosureReceipt, original.disclosureReceipt);
  assert.equal(redirected.destination.type, "new-tab");
  assert.equal(redirected.expanded, true);
});

test("canonical commands open the same object and select an existing canvas region", async () => {
  const original = result();
  const initial = {
    resultPearls: { [original.id]: original },
    pageCanvases: {
      "pearl:a::https://example.test/article": {
        artifacts: [{ id: "region:a", type: "text", text: "", box: { x: 10, y: 20, width: 200, height: 100 } }],
      },
    },
  };
  const opened = await executeDomainCommand("openResultPearlInTab", initial, { resultId: original.id });
  assert.equal(opened.state.resultPearls[original.id].id, original.id);
  assert.equal(opened.state.resultPearls[original.id].destination.type, "new-tab");

  const selected = await executeDomainCommand("selectResultPlacementRegion", opened.state, {
    resultId: original.id,
    pearlId: original.pearlId,
    pageIdentity: original.pageIdentity,
    artifactId: "region:a",
    kind: "canvas-region",
  });
  assert.equal(selected.state.resultPearls[original.id].destination.targetId, "region:a");
  assert.equal(selected.state.resultPearls[original.id].destination.type, "canvas-region");
});

test("chat presentation keeps branches, linked source, and citations", () => {
  const message = resultPearlChatMessage(result());
  assert.equal(message.resultPearlId, "result:a");
  assert.equal(message.branches[0].index, 0);
  assert.equal(message.citations[0].title, "Source");
  assert.equal(message.sourceRefs[0].id, "source:a");
});

test("failed result Pearls stay visible and recoverable", () => {
  const failed = result({ status: "failed", failure: { code: "OFFLINE", recoverable: true }, text: "" });
  assert.equal(failed.status, "failed");
  assert.equal(failed.failure.recoverable, true);
  assert.equal(failed.checkpoint.sourceRefs[0].id, "source:a");
});

test("destination and placement changes retain a reversible checkpoint", () => {
  const original = result({ placement: { x: 20, y: 30, width: 32, height: 32 } });
  const redirected = redirectResultPearl(original, { type: "chat", targetId: "chat:a" });
  const restored = undoResultPearl(redirected);
  assert.equal(restored.destination.type, "margin-pearl");
  assert.deepEqual(restored.placement, original.placement);
  assert.equal(restored.checkpoint.type, "undo");
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  appendItemHistory,
  buildItemTimeline,
  createHistoryEvent,
  isReplayableItem,
  itemSnapshot,
  replayStepDuration,
  truncatePreview,
} from "./item-history.js";

describe("item-history", () => {
  it("isReplayableItem accepts paper objects", () => {
    assert.equal(isReplayableItem({ type: "text", side: "paper" }), true);
    assert.equal(isReplayableItem({ type: "link" }), false);
    assert.equal(isReplayableItem({ type: "text", side: "ai" }), false);
  });

  it("itemSnapshot captures essentials", () => {
    const snap = itemSnapshot({ id: "a", type: "text", x: 1, y: 2, text: "hi", w: 200 });
    assert.deepEqual(snap, { id: "a", type: "text", x: 1, y: 2, text: "hi", w: 200 });
  });

  it("buildItemTimeline synthesizes born step", () => {
    const item = { id: "t1", type: "text", side: "paper", text: "Hello", x: 10, y: 20, w: 240, bornAt: 1000 };
    const timeline = buildItemTimeline("t1", { item, allItems: [item], aiNodes: [], pages: [], historyLog: {} });
    assert.ok(timeline);
    assert.equal(timeline.steps.length, 1);
    assert.equal(timeline.steps[0].kind, "born");
    assert.equal(timeline.steps[0].arrived, true);
  });

  it("buildItemTimeline uses recorded events", () => {
    const item = { id: "t1", type: "text", side: "paper", text: "Hello", bornAt: 1000 };
    const log = {
      t1: [
        createHistoryEvent("born", { itemSnapshot: itemSnapshot(item) }),
        createHistoryEvent("transfer-to-ai", { aiNodeId: "n1" }),
      ],
    };
    const timeline = buildItemTimeline("t1", { item, allItems: [item], aiNodes: [], pages: [], historyLog: log });
    assert.equal(timeline.steps.length, 2);
    assert.equal(timeline.steps[1].kind, "transfer-to-ai");
  });

  it("appendItemHistory accumulates per item", () => {
    const ev = createHistoryEvent("edit", { textDiff: "a→b" });
    const next = appendItemHistory({}, "x", ev);
    assert.equal(next.x.length, 1);
    assert.equal(appendItemHistory(next, "x", ev).x.length, 2);
  });

  it("replayStepDuration varies by kind", () => {
    assert.ok(replayStepDuration("transfer-to-ai") >= replayStepDuration("edit"));
  });

  it("truncatePreview shortens long strings", () => {
    assert.ok(truncatePreview("a".repeat(200), 40).endsWith("…"));
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  appendItemHistory,
  buildItemTimeline,
  buildOperatorStages,
  buildPerceptualCaptureFromItem,
  createHistoryEvent,
  historyEventToPerceptualStep,
  isReplayableItem,
  itemSnapshot,
  shouldRecordHistory,
  timelineToPerceptualSteps,
  truncatePreview,
} from "./item-history.js";

describe("item-history", () => {
  it("isReplayableItem accepts paper objects", () => {
    assert.equal(isReplayableItem({ type: "text", side: "paper" }), true);
    assert.equal(isReplayableItem({ type: "link" }), false);
    assert.equal(isReplayableItem({ type: "text", side: "ai" }), false);
  });

  it("shouldRecordHistory only tracks operator stages", () => {
    assert.equal(shouldRecordHistory("expand"), true);
    assert.equal(shouldRecordHistory("saved-as-function"), true);
    assert.equal(shouldRecordHistory("transfer-to-ai"), false);
    assert.equal(shouldRecordHistory("edit"), false);
    assert.equal(shouldRecordHistory("born"), false);
  });

  it("itemSnapshot captures essentials", () => {
    const snap = itemSnapshot({ id: "a", type: "text", x: 1, y: 2, text: "hi", w: 200 });
    assert.deepEqual(snap, { id: "a", type: "text", x: 1, y: 2, text: "hi", w: 200 });
  });

  it("buildOperatorStages returns empty when no operators", () => {
    const item = { id: "t1", type: "text", side: "paper", text: "Hello", bornAt: 1000 };
    const result = buildOperatorStages("t1", { item, aiNodes: [], pages: [], historyLog: {} });
    assert.ok(result);
    assert.equal(result.stages.length, 0);
  });

  it("buildOperatorStages uses recorded expand events only", () => {
    const item = { id: "t1", type: "text", side: "paper", text: "Hello", bornAt: 1000 };
    const log = {
      t1: [
        createHistoryEvent("transfer-to-ai", { aiNodeId: "n1" }),
        createHistoryEvent("expand", { opName: "reframe", outputPreview: "Reframed" }),
      ],
    };
    const result = buildOperatorStages("t1", { item, aiNodes: [], pages: [], historyLog: log });
    assert.equal(result.stages.length, 1);
    assert.equal(result.stages[0].opName, "reframe");
  });

  it("buildOperatorStages infers via on item", () => {
    const item = {
      id: "t1",
      type: "text",
      side: "paper",
      text: "Hello",
      bornAt: 1000,
      via: { name: "expand", id: "op1" },
    };
    const result = buildOperatorStages("t1", { item, aiNodes: [], pages: [], historyLog: {} });
    assert.equal(result.stages.length, 1);
    assert.equal(result.stages[0].opName, "expand");
  });

  it("buildItemTimeline maps stages to steps", () => {
    const item = { id: "t1", type: "text", side: "paper", text: "Hello", bornAt: 1000 };
    const log = {
      t1: [createHistoryEvent("expand", { opName: "summarize", outputPreview: "Short" })],
    };
    const timeline = buildItemTimeline("t1", { item, aiNodes: [], pages: [], historyLog: log });
    assert.equal(timeline.steps.length, 1);
    assert.equal(timeline.steps[0].caption, "summarize");
  });

  it("appendItemHistory accumulates per item", () => {
    const ev = createHistoryEvent("expand", { opName: "expand" });
    const next = appendItemHistory({}, "x", ev);
    assert.equal(next.x.length, 1);
    assert.equal(appendItemHistory(next, "x", ev).x.length, 2);
  });

  it("truncatePreview shortens long strings", () => {
    assert.ok(truncatePreview("a".repeat(200), 40).endsWith("…"));
  });

  it("historyEventToPerceptualStep maps expand events", () => {
    const step = historyEventToPerceptualStep({ kind: "expand", opName: "expand" });
    assert.equal(step.name, "expand");
    assert.equal(step.moveRef.name, "expand");
  });

  it("timelineToPerceptualSteps skips empty threads", () => {
    const result = buildOperatorStages("t1", {
      item: { id: "t1", type: "text", side: "paper", text: "Hello", bornAt: 1000 },
      aiNodes: [],
      pages: [],
      historyLog: {},
    });
    assert.equal(timelineToPerceptualSteps(result).length, 0);
  });

  it("buildPerceptualCaptureFromItem captures expand lineage", () => {
    const item = { id: "t1", type: "text", side: "paper", text: "Hello", bornAt: 1000 };
    const log = {
      t1: [createHistoryEvent("expand", { opName: "expand", outputPreview: "Hello world" })],
    };
    const cap = buildPerceptualCaptureFromItem("t1", {
      item,
      aiNodes: [],
      pages: [],
      historyLog: log,
    });
    assert.equal(cap.canCapture, true);
    assert.equal(cap.steps.length, 1);
    assert.equal(cap.steps[0].name, "expand");
  });
});

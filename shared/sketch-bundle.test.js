import test from "node:test";
import assert from "node:assert/strict";
import {
  recordingItemTags,
  registerRecordingItem,
  buildItemSessionPatch,
  gatherSketchBundle,
  bundleLabel,
  itemBelongsToSession,
} from "./sketch-bundle.js";

test("recordingItemTags returns session ids while recording", () => {
  const rec = { id: "s1", recording: true };
  assert.deepEqual(recordingItemTags(rec), {
    paperSessionId: "s1",
    recordingSessionId: "s1",
  });
  assert.deepEqual(recordingItemTags({ id: "s1", recording: false }), {});
  assert.deepEqual(recordingItemTags(null), {});
});

test("registerRecordingItem tracks unique item ids", () => {
  const rec = { id: "s1", recording: true, itemIds: [] };
  registerRecordingItem(rec, "a");
  registerRecordingItem(rec, "a");
  registerRecordingItem(rec, "b");
  assert.deepEqual(rec.itemIds, ["a", "b"]);
});

test("buildItemSessionPatch applies transcript as instructionText", () => {
  const patch = buildItemSessionPatch({ id: "s1", transcript: "  circle the bug  " });
  assert.equal(patch.paperSessionId, "s1");
  assert.equal(patch.instructionText, "circle the bug");
});

test("gatherSketchBundle expands to full session items", () => {
  const sessions = [
    {
      id: "sess1",
      transcript: "draw the arrow",
      strokes: [{ id: "st1", points: [{ x: 1, y: 2, t: 0 }] }],
      voiceSegments: [],
      annotations: [],
      itemIds: ["txt1"],
    },
  ];
  const pageItems = [
    { id: "st1", type: "stroke", paperSessionId: "sess1", points: [{ x: 1, y: 2 }] },
    { id: "st2", type: "stroke", paperSessionId: "sess1", points: [{ x: 3, y: 4 }] },
    { id: "txt1", type: "text", paperSessionId: "sess1", text: "note" },
    { id: "other", type: "stroke", points: [{ x: 0, y: 0 }] },
  ];
  const bundle = gatherSketchBundle({
    selectedIds: ["st1"],
    pageItems,
    sessions,
  });
  assert.equal(bundle.type, "sketch-bundle");
  assert.equal(bundle.sessionId, "sess1");
  assert.deepEqual(bundle.strokeIds.sort(), ["st1", "st2"]);
  assert.deepEqual(bundle.itemIds, ["txt1"]);
  assert.equal(bundle.transcript, "draw the arrow");
});

test("gatherSketchBundle from instructionText-only strokes", () => {
  const pageItems = [
    { id: "st1", type: "stroke", instructionText: "this is the login flow", points: [{ x: 1, y: 2 }] },
  ];
  const bundle = gatherSketchBundle({ selectedIds: ["st1"], pageItems, sessions: [] });
  assert.equal(bundle.transcript, "this is the login flow");
  assert.equal(bundle.sessionId, null);
});

test("itemBelongsToSession matches paper or recording id", () => {
  assert.equal(itemBelongsToSession({ paperSessionId: "a" }, "a"), true);
  assert.equal(itemBelongsToSession({ recordingSessionId: "a" }, "a"), true);
  assert.equal(itemBelongsToSession({ paperSessionId: "b" }, "a"), false);
});

test("bundleLabel prefers transcript snippet", () => {
  assert.equal(bundleLabel({ transcript: "explain the diagram" }), "explain the diagram");
  assert.equal(bundleLabel({ strokeIds: ["a"] }), "sketch + voice");
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  beginPlacementExecution,
  cancelPlacementRequest,
  completePlacementExecution,
  confirmPlacementRequest,
  createOutputRoutingRequest,
  interpretPlacementAnswer,
} from "./output-routing.js";

const result = {
  id: "result:1",
  updatedAt: 4,
  checkpoint: { id: "checkpoint:1" },
  branch: { id: "branch:1" },
};
const observation = {
  selection: {
    targetId: "paragraph:1",
    quote: "A bounded selected paragraph",
    editable: true,
    geometry: { x: 10, y: 20, width: 200, height: 30, coordinateSpace: "document" },
  },
  selectedCanvasArtifact: { id: "box:1", text: "My box", box: { x: 4, y: 5, width: 300, height: 180 } },
  targetRevision: 7,
};

test("every destination family interprets into an explicit confirmation", () => {
  const cases = new Map([
    ["keep it here", "margin-pearl"],
    ["put it in the box I made", "existing-textbox"],
    ["make a new text box under this paragraph", "companion-region"],
    ["put it in my drawn region", "user-region"],
    ["insert at the caret", "native-insert"],
    ["replace this selection", "native-replace"],
    ["show it in chat", "chat"],
    ["open it in an editable Pearl Studio tab", "pearl-studio"],
    ["put it in the web Scene", "web-scene"],
    ["put it in the Output Frame", "output-frame"],
    ["copy it", "clipboard"],
    ["download a file", "download"],
    ["export PDF", "pdf"],
  ]);
  for (const [answer, type] of cases) {
    const request = createOutputRoutingRequest(result);
    const interpreted = interpretPlacementAnswer(answer, request, observation);
    assert.equal(interpreted.request.stage, "confirming", answer);
    assert.equal(interpreted.plan.destination.type, type, answer);
    assert.equal(interpreted.plan.confirmed, false);
    assert.ok(interpreted.plan.idempotencyKey);
    assert.match(interpreted.plan.summary, /\?$/);
  }
});

test("ambiguous deixis asks one clarification and never guesses", () => {
  const request = createOutputRoutingRequest(result);
  const interpreted = interpretPlacementAnswer("put it there", request, {});
  assert.equal(interpreted.plan, null);
  assert.equal(interpreted.request.stage, "clarifying");
  assert.equal(interpreted.request.clarification, "Which box, selection, or page area should receive it?");
});

test("multi-branch routing requires scope before confirmation", () => {
  const request = createOutputRoutingRequest(result, { branches: [{ id: "a" }, { id: "b" }] });
  const ambiguous = interpretPlacementAnswer("download it", request, observation);
  assert.equal(ambiguous.plan, null);
  assert.match(ambiguous.request.clarification, /all branches together/);
  const explicit = interpretPlacementAnswer("download all branches together", request, observation);
  assert.equal(explicit.plan.branchScope.mode, "all");
});

test("target changes invalidate confirmation and duplicate execution is idempotent", () => {
  const request = createOutputRoutingRequest(result);
  const interpreted = interpretPlacementAnswer("replace this selection", request, observation).request;
  const stale = confirmPlacementRequest(interpreted, 8);
  assert.equal(stale.stage, "confirming");
  assert.match(stale.clarification, /changed/);
  const confirmed = confirmPlacementRequest(interpreted, 7);
  assert.equal(confirmed.stage, "confirmed");
  const begun = beginPlacementExecution(confirmed);
  assert.equal(begun.duplicate, false);
  const placed = completePlacementExecution(begun.request, { mutationId: "m1" });
  const duplicate = beginPlacementExecution({ ...confirmed, executedKeys: placed.executedKeys });
  assert.equal(duplicate.duplicate, true);
});

test("cancel preserves the exact staged checkpoint", () => {
  const request = createOutputRoutingRequest(result);
  const cancelled = cancelPlacementRequest(request);
  assert.equal(cancelled.stage, "cancelled");
  assert.deepEqual(cancelled.checkpoint, result.checkpoint);
});

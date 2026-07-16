import test from "node:test";
import assert from "node:assert/strict";
import {
  captureMoveFromInstruction,
  createInstructionEvent,
  exportInstructionEventJournal,
  findEquivalentMove,
  mergeInstructionEventJournal,
  recordInstructionExecution,
  suggestRecurringInstructions,
  undoInstructionEvent,
} from "./instruction-events.js";

test("captures exact user instruction privately and verbatim without a model", () => {
  const raw = "Keep  double spaces.\nAnd line breaks.";
  const result = captureMoveFromInstruction({
    id: "event-1",
    role: "user-instruction",
    instruction: raw,
    status: "succeeded",
    inputRefs: [{ id: "input", type: "text" }],
    outputRefs: [{ id: "output", type: "richText" }],
  }, { id: "move-1" });
  assert.equal(result.status, "captured");
  assert.equal(result.move.prompt, raw);
  assert.equal(result.move.sourceInstruction, raw);
  assert.equal(result.move.provenance.private, true);
});

test("assistant output requires an explicit role choice", () => {
  const result = captureMoveFromInstruction({
    role: "assistant-output",
    instruction: "A polished answer",
  });
  assert.equal(result.status, "choice-required");
  assert.deepEqual(result.choices, ["use-text-as-instruction", "infer-producing-move"]);
});

test("typed input substitution requires an exact supplied source span", () => {
  const instruction = "Summarize THIS SOURCE as bullets";
  const result = captureMoveFromInstruction({
    role: "user-instruction",
    instruction,
  }, { inputSpan: { start: 10, end: 21 } });
  assert.equal(result.move.prompt, "Summarize {input} as bullets");
  assert.throws(() => captureMoveFromInstruction(
    { role: "user-instruction", instruction },
    { inputSpan: { start: 100, end: 101 } },
  ), /exact bounded source range/);
});

test("duplicate detection is stable and system context is ineligible", () => {
  const event = createInstructionEvent({ role: "user-instruction", instruction: "Compare evidence" }, { id: "event" });
  const captured = captureMoveFromInstruction(event, { id: "move" });
  assert.equal(findEquivalentMove(event, [captured.move]).id, "move");
  assert.throws(() => createInstructionEvent({ role: "system-context", instruction: "private system prompt" }), /cannot be captured/);
});

test("journals execution, recurrence, undo, idempotent sync, and private export", () => {
  const first = createInstructionEvent({ id: "one", role: "user-instruction", instruction: "Compare the evidence", status: "draft", at: 1 });
  const second = createInstructionEvent({ id: "two", role: "user-instruction", instruction: "Compare the evidence", status: "succeeded", at: 2 });
  const completed = recordInstructionExecution(first, {
    status: "succeeded",
    executionId: "run-one",
    outputRefs: [{ id: "output-one", type: "text" }],
    modelProvenance: { requestedModel: "auto", resolvedModel: "provider/model" },
    at: 3,
  });
  const journal = mergeInstructionEventJournal([completed], [completed, second]);
  assert.equal(journal.length, 2);
  assert.equal(suggestRecurringInstructions(journal)[0].count, 2);
  const undone = undoInstructionEvent(journal, "one", 4);
  assert.equal(undone.changed, true);
  assert.equal(undone.events.find((event) => event.id === "one").active, false);
  const safe = exportInstructionEventJournal(undone.events);
  assert.equal(safe.privacy, "metadata-only");
  assert.equal("sourceInstruction" in safe.events[0], false);
  assert.equal(exportInstructionEventJournal(journal, { includePrivateText: true }).events[0].sourceInstruction, "Compare the evidence");
});

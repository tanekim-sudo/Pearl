import test from "node:test";
import assert from "node:assert/strict";
import {
  adoptAnonymousCompanionMemory,
  applyInterviewAnswer,
  clearCompanionMemory,
  emptyCompanionMemory,
  loadCompanionMemory,
  nextInterviewPrompt,
  pauseCompanionInterview,
  rememberCompanionReference,
  saveCompanionMemory,
  resumeCompanionInterview,
  setCompanionAutonomy,
} from "./companion-memory.js";

function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

test("companion memory is isolated by authenticated user", () => {
  const store = storage();
  saveCompanionMemory("a", { identity: "Ada" }, store);
  saveCompanionMemory("b", { identity: "Grace" }, store);
  assert.equal(loadCompanionMemory("a", store).identity, "Ada");
  assert.equal(loadCompanionMemory("b", store).identity, "Grace");
  clearCompanionMemory("a", store);
  assert.equal(loadCompanionMemory("b", store).identity, "Grace");
});

test("anonymous memory is adopted once without overwriting account context", () => {
  const store = storage();
  saveCompanionMemory(null, { identity: "Ada", role: "researcher", goals: ["map this"] }, store);
  saveCompanionMemory("user-1", { role: "founder" }, store);
  const adopted = adoptAnonymousCompanionMemory("user-1", store);
  assert.equal(adopted.identity, "Ada");
  assert.equal(adopted.role, "founder");
  assert.deepEqual(adopted.goals, ["map this"]);
  assert.equal(loadCompanionMemory(null, store).identity, "");
  assert.deepEqual(adoptAnonymousCompanionMemory("user-1", store).goals, ["map this"]);
});

test("interview asks identity, role, then first goal and completes", () => {
  let memory = emptyCompanionMemory();
  assert.match(nextInterviewPrompt(memory), /who are you/i);
  memory = applyInterviewAnswer(memory, "Ada");
  assert.match(nextInterviewPrompt(memory), /what do you do/i);
  memory = applyInterviewAnswer(memory, "I research systems");
  assert.match(nextInterviewPrompt(memory), /do first/i);
  memory = applyInterviewAnswer(memory, "Map a product strategy");
  assert.equal(memory.interviewComplete, true);
  assert.equal(nextInterviewPrompt(memory), null);
});

test("commands pause onboarding idempotently until setup is explicitly resumed", () => {
  const store = storage();
  assert.match(nextInterviewPrompt(loadCompanionMemory(null, store)), /who are you/i);
  pauseCompanionInterview(null, store);
  pauseCompanionInterview(null, store);
  assert.equal(nextInterviewPrompt(loadCompanionMemory(null, store)), null);
  resumeCompanionInterview(null, store);
  assert.match(nextInterviewPrompt(loadCompanionMemory(null, store)), /who are you/i);
});

test("created references are compact and deduplicated", () => {
  const store = storage();
  rememberCompanionReference("a", "lenses", { id: "lens-1", name: "First" }, store);
  rememberCompanionReference("a", "lenses", { id: "lens-1", name: "Renamed" }, store);
  assert.deepEqual(loadCompanionMemory("a", store).references.lenses, [
    { id: "lens-1", name: "Renamed" },
  ]);
});

test("repairs identities polluted by swallowed commands", () => {
  const store = storage();
  saveCompanionMemory(null, {
    identity: "get rid fo all functions and drawings and ai stuff",
  }, store);
  assert.equal(loadCompanionMemory(null, store).identity, "");
});

test("autonomy is bounded, user-scoped, and explicit", () => {
  const store = storage();
  assert.equal(loadCompanionMemory("a", store).preferences.autonomy, "preview-complex");
  setCompanionAutonomy("a", "always-preview", store);
  assert.equal(loadCompanionMemory("a", store).preferences.autonomy, "always-preview");
  assert.equal(loadCompanionMemory("b", store).preferences.autonomy, "preview-complex");
  assert.throws(() => setCompanionAutonomy("a", "unbounded", store), /invalid/);
});

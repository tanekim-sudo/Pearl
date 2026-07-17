import test from "node:test";
import assert from "node:assert/strict";
import {
  adoptAnonymousCompanionMemory,
  applyInterviewAnswer,
  clearCompanionMemory,
  emptyCompanionMemory,
  loadCompanionMemory,
  forgetCompanionMemory,
  nextInterviewPrompt,
  pauseCompanionInterview,
  rememberCompanionReference,
  rememberCompanionMemory,
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
  const reference = loadCompanionMemory("a", store).references.lenses[0];
  assert.equal(reference.id, "lens-1");
  assert.equal(reference.name, "Renamed");
  assert.equal(reference.scope, "account");
  assert.equal(reference.confidence, 1);
});

test("inspectable memories retain provenance, confidence, scope, expiry, and forget control", () => {
  const store = storage();
  const saved = rememberCompanionMemory("a", {
    id: "preference-a",
    value: "Prefer evidence-first critiques",
    provenance: { kind: "explicit-user-memory", sourceId: "message-1" },
    confidence: 0.8,
    scope: "workspace",
    expiresAt: "2099-01-01T00:00:00.000Z",
  }, store);
  assert.equal(saved.memories[0].provenance.sourceId, "message-1");
  assert.equal(saved.memories[0].confidence, 0.8);
  assert.equal(saved.memories[0].scope, "workspace");
  assert.equal(forgetCompanionMemory("a", "preference-a", store).memories.length, 0);
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

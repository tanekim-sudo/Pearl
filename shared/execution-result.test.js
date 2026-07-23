import test from "node:test";
import assert from "node:assert/strict";
import {
  EXECUTION_CODES,
  companionCommandReply,
  createExecutionResult,
  ensureExecutionOnReply,
  formatCrashDiagnostic,
  formatExecutionChatMessage,
  inferExecutionCode,
  loadExecutionEvents,
  mapErrorToExecutionResult,
  normalizeCompanionCommandResult,
  recordExecutionEvent,
  clearExecutionEvents,
} from "./execution-result.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

test("createExecutionResult normalizes status, stage, and strips secret details", () => {
  const result = createExecutionResult({
    status: "blocked",
    code: EXECUTION_CODES.EMPTY_GAUNTLET,
    message: "Gauntlet working memory is empty — wear at least one pearl first.",
    stage: "execute",
    details: {
      verb: "evaluateWithGauntlet",
      apiKey: "sk-secret",
      pearlIds: ["pearl-1", "pearl-2"],
    },
  });
  assert.equal(result.status, "blocked");
  assert.equal(result.code, "empty-gauntlet");
  assert.equal(result.details.verb, "evaluateWithGauntlet");
  assert.deepEqual(result.details.pearlIds, ["pearl-1", "pearl-2"]);
  assert.equal(result.details.apiKey, undefined);
});

test("inferExecutionCode maps empty gauntlet, credentials, handoff, and network", () => {
  assert.equal(
    inferExecutionCode("Gauntlet working memory is empty — wear at least one pearl before evaluating"),
    EXECUTION_CODES.EMPTY_GAUNTLET,
  );
  assert.equal(
    inferExecutionCode(new Error("Live model critique needs credentials")),
    EXECUTION_CODES.NEEDS_CREDENTIALS,
  );
  assert.equal(inferExecutionCode(null, { reason: "missing-extension-id" }), EXECUTION_CODES.MISSING_EXTENSION_ID);
  assert.equal(inferExecutionCode(new Error("fetch failed")), EXECUTION_CODES.NETWORK_ERROR);
  assert.equal(inferExecutionCode(new Error("plan.root.steps[0].query: unsupported")), EXECUTION_CODES.VALIDATION_ERROR);
});

test("mapErrorToExecutionResult never leaks planner/schema internals", () => {
  const result = mapErrorToExecutionResult(new Error("plan.root.steps[0].query: is not a supported workspace query"));
  assert.equal(result.status, "failed");
  assert.equal(result.code, EXECUTION_CODES.VALIDATION_ERROR);
  assert.doesNotMatch(result.message, /plan\.root|supported workspace query/);
});

test("formatExecutionChatMessage includes status label and stable code", () => {
  const blocked = formatExecutionChatMessage({
    status: "blocked",
    code: EXECUTION_CODES.EMPTY_GAUNTLET,
    message: "Gauntlet working memory is empty — wear at least one pearl first.",
  });
  assert.match(blocked, /^Blocked:/);
  assert.match(blocked, /\[empty-gauntlet\]/);

  const success = formatExecutionChatMessage({
    status: "success",
    code: EXECUTION_CODES.OK,
    message: "Ran: navigated home.",
  });
  assert.equal(success, "Ran: navigated home.");
});

test("normalizeCompanionCommandResult maps silent success, visible blockers, and throws", () => {
  assert.equal(normalizeCompanionCommandResult(null).status, "success");
  assert.equal(normalizeCompanionCommandResult({ completed: true, effects: ["navigated-home"] }).code, "ok");

  const blocked = normalizeCompanionCommandResult({
    visible: true,
    text: "Gauntlet working memory is empty — wear at least one pearl before evaluating on-screen material.",
  });
  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.code, EXECUTION_CODES.EMPTY_GAUNTLET);

  const failed = normalizeCompanionCommandResult(null, new Error("fetch failed"));
  assert.equal(failed.status, "failed");
  assert.equal(failed.code, EXECUTION_CODES.NETWORK_ERROR);
});

test("companionCommandReply and ensureExecutionOnReply preserve chat contract", () => {
  const reply = companionCommandReply({
    status: "blocked",
    code: EXECUTION_CODES.NEEDS_CREDENTIALS,
    message: "Live model output needs credentials — nothing was invented.",
    stage: "api",
  });
  assert.equal(reply.completed, false);
  assert.equal(reply.visible, true);
  assert.match(reply.text, /\[needs-credentials\]/);
  assert.equal(reply.execution.code, "needs-credentials");

  const ensured = ensureExecutionOnReply({ visible: true, text: "Choose Ask, Plan, Agent, or Debug mode." });
  assert.equal(ensured.execution.status, "blocked");
  assert.ok(ensured.execution.code);
});

test("execution events persist in sessionStorage-like storage", () => {
  const storage = memoryStorage();
  clearExecutionEvents(storage);
  recordExecutionEvent({
    status: "blocked",
    code: EXECUTION_CODES.EMPTY_GAUNTLET,
    message: "empty",
  }, storage);
  recordExecutionEvent({
    status: "failed",
    code: EXECUTION_CODES.NETWORK_ERROR,
    message: "down",
  }, storage);
  const events = loadExecutionEvents(storage);
  assert.equal(events.length, 2);
  assert.equal(events[0].code, "empty-gauntlet");
  assert.equal(events[1].code, "network-error");
});

test("formatCrashDiagnostic exposes message and optional stack in dev", () => {
  const error = new Error("Cannot read properties of null");
  error.stack = "Error: Cannot read properties of null\n    at Foo (app.js:1:1)";
  const prod = formatCrashDiagnostic(error, { isDev: false });
  assert.match(prod.message, /Cannot read properties/);
  assert.ok(prod.digest);
  assert.equal(prod.stackSnippet, null);
  const dev = formatCrashDiagnostic(error, { isDev: true });
  assert.match(dev.stackSnippet, /at Foo/);
});

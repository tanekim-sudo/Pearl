import test from "node:test";
import assert from "node:assert/strict";

import { executeCompanionPlan } from "./companion-executor.js";

function tools(overrides = {}) {
  return {
    query: async () => [{ id: "a" }, { id: "b" }],
    action: async () => true,
    evaluate: async () => ({ text: "weak assumption", targetId: "a" }),
    research: async () => ({
      findings: ["fact"],
      sources: [{ title: "Source", url: "https://example.test", date: "2026-01-01" }],
    }),
    artifact: async () => true,
    checkpoint: async () => true,
    ...overrides,
  };
}

test("executes query, foreach, evaluation, and artifact composition", async () => {
  const calls = [];
  const plan = {
    version: 1,
    root: {
      kind: "sequence",
      steps: [
        { kind: "query", query: "selection", saveAs: "picked" },
        {
          kind: "foreach",
          in: "picked",
          limit: 2,
          step: {
            kind: "action",
            capability: "annotateFeedback",
            args: { target: "$item.id", text: "review", kind: "feedback" },
          },
        },
        { kind: "evaluate", target: "$picked", criteria: ["quality"], saveAs: "review" },
        { kind: "artifact", from: "review", placement: "beside-target", target: "a" },
      ],
    },
  };
  const result = await executeCompanionPlan(plan, tools({
    action: async (name, args) => calls.push({ name, args }),
  }));
  assert.equal(result.completed, true);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].args.target, "a");
});

test("cancellation and injected failure retain exact checkpoint semantics", async () => {
  let calls = 0;
  const plan = {
    version: 1,
    root: {
      kind: "sequence",
      steps: Array.from({ length: 25 }, (_, index) => ({
        kind: "action",
        id: `step-${index}`,
        capability: "pause",
        args: { ms: 1 },
      })),
    },
  };
  const result = await executeCompanionPlan(plan, tools({
    action: async () => {
      calls += 1;
      if (calls === 8) throw new Error("injected failure");
    },
  }));
  assert.equal(result.completed, false);
  assert.equal(result.checkpoint, 8);
  assert.equal(result.canRetry, true);
  assert.equal(result.canUndo, true);
  assert.match(result.error, /injected failure/);

  const controller = new AbortController();
  controller.abort();
  const cancelled = await executeCompanionPlan(plan, tools(), { signal: controller.signal });
  assert.equal(cancelled.cancelled, true);
  assert.equal(cancelled.checkpoint, 1);
});

test("research provenance is required before continuing", async () => {
  const plan = {
    version: 1,
    root: { kind: "research", question: "latest evidence", saveAs: "research" },
  };
  const result = await executeCompanionPlan(plan, tools({ research: async () => ({ sources: [] }) }));
  assert.equal(result.completed, false);
  assert.match(result.error, /no verifiable sources/);
});

test("binds structured creation results and resolves live stable IDs", async () => {
  const calls = [];
  const plan = {
    version: 1,
    root: {
      kind: "sequence",
      steps: [
        {
          kind: "action",
          id: "create-a",
          capability: "createFunction",
          args: { name: "A", steps: ["one"] },
          saveAs: "a",
        },
        {
          kind: "action",
          id: "create-b",
          capability: "createFunction",
          args: { name: "B", steps: ["two"] },
          saveAs: "b",
        },
        {
          kind: "action",
          id: "merge",
          capability: "mergeFunctions",
          args: { a: { $ref: "a" }, b: { $ref: "b" } },
          saveAs: "combined",
        },
      ],
    },
  };
  const result = await executeCompanionPlan(
    plan,
    tools({
      action: async (name, args) => {
        calls.push({ name, args });
        if (name === "createFunction") {
          return { type: "lens", lensId: `saved-${args.name.toLowerCase()}`, name: `${args.name} display` };
        }
        return { type: "lens", lensId: "saved-combined", name: "Combined" };
      },
    }),
    { runId: "dataflow-run" }
  );
  assert.equal(result.completed, true);
  assert.deepEqual(calls[2].args, { a: "saved-a", b: "saved-b" });
  assert.equal(result.values.combined.lensId, "saved-combined");
});

test("retry resumes after the exact checkpoint without duplicating completed creation", async () => {
  const counts = new Map();
  let failSecond = true;
  const plan = {
    version: 1,
    root: {
      kind: "sequence",
      steps: [
        {
          kind: "action",
          id: "a",
          capability: "createFunction",
          args: { name: "A", steps: [] },
          saveAs: "a",
        },
        {
          kind: "action",
          id: "b",
          capability: "createFunction",
          args: { name: "B", steps: [] },
          saveAs: "b",
        },
        {
          kind: "action",
          id: "merge",
          capability: "mergeFunctions",
          args: { a: { $ref: "a" }, b: { $ref: "b" } },
        },
      ],
    },
  };
  const action = async (_name, args, context) => {
    counts.set(context.idempotencyKey, (counts.get(context.idempotencyKey) || 0) + 1);
    if (context.idempotencyKey.endsWith(":b") && failSecond) {
      failSecond = false;
      throw new Error("B failed");
    }
    return { type: "lens", lensId: `lens-${args.name || "merged"}` };
  };
  const first = await executeCompanionPlan(plan, tools({ action }), { runId: "checkpoint-run" });
  assert.equal(first.completed, false);
  assert.deepEqual(first.completedStepIds, ["a"]);

  const second = await executeCompanionPlan(plan, tools({ action }), { resume: first.resume });
  assert.equal(second.completed, true);
  assert.equal(counts.get("checkpoint-run:a"), 1);
  assert.equal(counts.get("checkpoint-run:b"), 2);
  assert.equal(counts.get("checkpoint-run:merge"), 1);
});

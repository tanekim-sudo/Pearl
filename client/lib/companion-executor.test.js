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

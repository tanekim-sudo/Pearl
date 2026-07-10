import test from "node:test";
import assert from "node:assert/strict";

import {
  parseCompanionPlan,
  planNeedsPreview,
  validateCompanionPlan,
} from "./companion-plan.js";

const action = {
  kind: "action",
  capability: "arrangeItems",
  args: { targets: ["a", "b"], layout: "grid", options: { columns: 2 } },
};

test("validates composable plans and repairs fenced trailing commas", () => {
  const raw = `\`\`\`json
  {"version":1,"root":{"kind":"sequence","steps":[
    {"kind":"query","query":"selection","saveAs":"picked"},
    ${JSON.stringify(action)},
  ]}}
  \`\`\``;
  const plan = parseCompanionPlan(raw);
  assert.equal(plan.root.steps.length, 2);
  assert.equal(validateCompanionPlan(plan).stats.steps, 3);
});

test("rejects unsupported capabilities and invalid arguments before execution", () => {
  assert.throws(
    () =>
      validateCompanionPlan({
        version: 1,
        root: { kind: "action", capability: "pretendSuccess", args: {} },
      }),
    /unknown capability/
  );
  assert.throws(
    () =>
      validateCompanionPlan({
        version: 1,
        root: { ...action, args: { targets: "not-an-array", layout: "grid" } },
      }),
    /must be array/
  );
});

test("requires confirmation for destructive actions and finite loops", () => {
  assert.throws(
    () =>
      validateCompanionPlan({
        version: 1,
        root: { kind: "action", capability: "clearPaper", args: {} },
      }),
    /explicit confirmation/
  );
  assert.throws(
    () =>
      validateCompanionPlan({
        version: 1,
        root: { kind: "foreach", in: "selection", limit: 101, step: action },
      }),
    /1\.\.100/
  );
});

test("complex and research plans request a preview by default", () => {
  const plan = {
    version: 1,
    root: {
      kind: "research",
      question: "latest evidence",
      saveAs: "evidence",
    },
  };
  assert.equal(planNeedsPreview(plan), true);
  assert.equal(planNeedsPreview(plan, "act-immediately"), false);
});

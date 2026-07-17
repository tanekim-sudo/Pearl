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

test("uses canonical confirmation modes and finite loops", () => {
  assert.doesNotThrow(() =>
    validateCompanionPlan({
      version: 1,
      root: { kind: "action", capability: "clearPaper", args: {} },
    })
  );
  assert.throws(
    () =>
      validateCompanionPlan({
        version: 1,
        root: { kind: "action", capability: "deleteItem", args: { target: "item-1" } },
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

test("repairs misplaced confirmation metadata before capability validation", () => {
  const plan = parseCompanionPlan(JSON.stringify({
    version: 1,
    root: {
      kind: "sequence",
      steps: [
        { kind: "checkpoint", id: "confirm", mode: "confirm" },
        {
          kind: "action",
          id: "clear",
          capability: "clearPaper",
          args: { confirmed: true },
        },
      ],
    },
  }));
  assert.equal(plan.root.steps[1].confirmed, true);
  assert.deepEqual(plan.root.steps[1].args, {});
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

test("validates typed create-use-compose references in dependency order", () => {
  const plan = {
    version: 1,
    root: {
      kind: "sequence",
      steps: [
        {
          kind: "action",
          id: "memo",
          capability: "createFunction",
          args: { name: "Investment memo workflow", steps: ["Draft"] },
          saveAs: "memoLens",
        },
        {
          kind: "action",
          id: "evaluation",
          capability: "createFunction",
          args: { name: "Company evaluation workflow", steps: ["Evaluate"] },
          saveAs: "evaluationLens",
        },
        {
          kind: "action",
          id: "combine",
          capability: "mergeFunctions",
          args: { a: { $ref: "memoLens" }, b: { $ref: "evaluationLens" } },
          saveAs: "teamLens",
        },
      ],
    },
  };
  assert.equal(validateCompanionPlan(plan).stats.steps, 4);
});

test("rejects forward references, duplicate bindings, and resource type mismatches", () => {
  assert.throws(
    () =>
      validateCompanionPlan({
        version: 1,
        root: {
          kind: "sequence",
          steps: [
            {
              kind: "action",
              id: "merge",
              capability: "mergeFunctions",
              args: { a: { $ref: "future" }, b: "existing" },
            },
            {
              kind: "action",
              id: "create",
              capability: "createFunction",
              args: { name: "Future", steps: [] },
              saveAs: "future",
            },
          ],
        },
      }),
    /unknown or future/
  );
  assert.throws(
    () =>
      validateCompanionPlan({
        version: 1,
        root: {
          kind: "sequence",
          steps: [
            { kind: "action", id: "g", capability: "createMove", args: { name: "Atomic", prompt: "Do one thing." }, saveAs: "resource" },
            {
              kind: "action",
              id: "m",
              capability: "mergeFunctions",
              args: { a: { $ref: "resource" }, b: "existing" },
            },
          ],
        },
      }),
    /expects function.*produces move/
  );
});

test("repairs legacy future-name aliases into explicit result references", () => {
  const plan = parseCompanionPlan(
    JSON.stringify({
      version: 1,
      root: {
        kind: "sequence",
        steps: [
          {
            kind: "action",
            capability: "createFunction",
            args: { name: "Investment Memo Generator", steps: ["Draft"], saveAs: "investmentMemoGenerator" },
          },
          {
            kind: "action",
            capability: "applyFunction",
            args: { op: "investmentMemoGenerator", target: "existing-note" },
          },
        ],
      },
    })
  );
  assert.equal(plan.root.steps[0].saveAs, "investmentMemoGenerator");
  assert.deepEqual(plan.root.steps[1].args.op, { $ref: "investmentMemoGenerator" });
  assert.ok(plan.root.steps.every((step) => step.id));
});

test("validates generalized create-then-use plans across workspace domains", () => {
  const createLens = (id = "lens", saveAs = "lens") => ({
    kind: "action",
    id,
    capability: "createFunction",
    args: { name: `Visible ${id}`, steps: ["Observe", "Transform"] },
    saveAs,
  });
  const spawn = (id = "item", saveAs = "item") => ({
    kind: "action",
    id,
    capability: "spawnText",
    args: { text: `Material ${id}` },
    saveAs,
  });
  const sequence = (steps) => ({ version: 1, root: { kind: "sequence", steps } });
  const plans = [
    sequence([
      createLens(),
      spawn(),
      { kind: "action", id: "apply", capability: "applyFunction", args: { op: { $ref: "lens" }, target: { $ref: "item" } } },
    ]),
    sequence([
      createLens("a", "a"),
      createLens("b", "b"),
      { kind: "action", id: "merge", capability: "mergeFunctions", args: { a: { $ref: "a" }, b: { $ref: "b" } }, saveAs: "merged" },
    ]),
    sequence([
      createLens(),
      { kind: "action", id: "fork", capability: "forkFunction", args: { function: { $ref: "lens" } }, saveAs: "fork" },
    ]),
    sequence([
      createLens(),
      { kind: "action", id: "edit", capability: "editFunctionByInstruction", args: { function: { $ref: "lens" }, instruction: "Add a counterevidence branch" } },
    ]),
    sequence([
      { kind: "action", id: "generator", capability: "createLens", args: {}, saveAs: "generator" },
      spawn(),
      { kind: "action", id: "attach", capability: "addLensMaterial", args: { lens: { $ref: "generator" }, target: { $ref: "item" } } },
    ]),
    sequence([
      { kind: "action", id: "generator", capability: "createLens", args: {}, saveAs: "generator" },
      { kind: "action", id: "craft", capability: "inferFunctionFromLens", args: { lens: { $ref: "generator" } }, saveAs: "crafted" },
    ]),
    sequence([
      { kind: "action", id: "block-a", capability: "addBlock", args: { type: "text", text: "A" }, saveAs: "a" },
      { kind: "action", id: "block-b", capability: "addBlock", args: { type: "text", text: "B" }, saveAs: "b" },
      { kind: "action", id: "compare", capability: "transformMaterial", args: { mode: "compare", targets: [{ $ref: "a" }, { $ref: "b" }] } },
    ]),
    sequence([
      spawn("from", "from"),
      spawn("to", "to"),
      { kind: "action", id: "link", capability: "linkItems", args: { from: { $ref: "from" }, to: { $ref: "to" } } },
    ]),
    sequence([
      createLens(),
      { kind: "action", id: "open", capability: "openFunctionEditor", args: { op: { $ref: "lens" } } },
    ]),
    sequence([
      createLens(),
      { kind: "action", id: "extend", capability: "addFunctionStep", args: { op: { $ref: "lens" }, name: "Decide" } },
    ]),
    sequence([
      { kind: "action", id: "capture", capability: "captureThreadAsFunction", args: { target: "existing-node", name: "Captured path" }, saveAs: "captured" },
      { kind: "action", id: "fork", capability: "forkFunction", args: { function: { $ref: "captured" } } },
    ]),
    sequence([
      { kind: "action", id: "generator", capability: "createLens", args: {}, saveAs: "generator" },
      { kind: "action", id: "graduate", capability: "nameLens", args: { lens: { $ref: "generator" }, name: "Named Lens" } },
    ]),
  ];
  assert.equal(plans.length, 12);
  plans.forEach((plan) => assert.doesNotThrow(() => validateCompanionPlan(plan)));
});

test("validates transactional phases, exact migrations, assertions, approvals, and bounded workers", () => {
  const plan = {
    version: 1,
    root: {
      kind: "phase",
      id: "phase-a",
      steps: [
        { kind: "query", id: "dependencies", query: "dependencies", saveAs: "affected" },
        { kind: "approval", id: "approval", scope: "migration", affectedIds: ["fn-a"] },
        {
          kind: "migration",
          id: "migration",
          affectedIds: ["fn-a"],
          steps: [{
            kind: "transaction",
            id: "transaction",
            compensation: "restore-checkpoint",
            postconditions: [{ type: "exists", stableId: "fn-a" }],
            steps: [{ kind: "action", id: "edit", capability: "editMove", args: { move: "move-a", prompt: "updated" } }],
          }],
        },
        { kind: "assert", id: "assert", condition: { ref: "$affected", exists: true } },
        { kind: "worker", id: "review", worker: "privacy-reviewer", saveAs: "privacy" },
      ],
    },
  };
  assert.doesNotThrow(() => validateCompanionPlan(plan));
  assert.throws(
    () => validateCompanionPlan({
      version: 1,
      root: { kind: "worker", worker: "migration-analyst", mutating: true },
    }),
    /candidateSnapshotId/
  );
});

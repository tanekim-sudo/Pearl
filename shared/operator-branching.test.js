import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isForkStep,
  operatorHasFork,
  buildBranchPlan,
  branchOutputCount,
  branchOutputNames,
} from "./operator-branching.js";
import { migrateOperatorStore } from "./transform-primitives.js";
import "./lens-grammar.test.js";
import "./lens-grinding.test.js";
import "./lens-rack.test.js";

const mapOf = (ops) => Object.fromEntries(ops.map((o) => [o.id, o]));

// input → expand → fork( one-pager | memo-pipeline(research → memo) )
const forkedOps = [
  { id: "root", kind: "pipeline", name: "investment memo", top: true, steps: ["expand1", "fork1"] },
  { id: "expand1", kind: "prompt", name: "expand", prompt: "Unfold." },
  { id: "fork1", kind: "pipeline", fork: true, name: "fork", steps: ["onepager", "memoPipe"] },
  { id: "onepager", kind: "prompt", name: "make one pager", prompt: "One pager." },
  { id: "memoPipe", kind: "pipeline", name: "investment memo steps", steps: ["research1", "memo1"] },
  { id: "research1", kind: "prompt", name: "research", prompt: "Research." },
  { id: "memo1", kind: "prompt", name: "write memo", prompt: "Memo." },
];

describe("operator branching", () => {
  it("detects fork steps and forked subtrees", () => {
    const map = mapOf(forkedOps);
    assert.ok(isForkStep(map.fork1));
    assert.ok(!isForkStep(map.memoPipe));
    assert.ok(!isForkStep(map.expand1));
    assert.ok(operatorHasFork(map.root, map));
    assert.ok(!operatorHasFork(map.memoPipe, map));
  });

  it("linear operators have no fork and one output", () => {
    const ops = [
      { id: "r", kind: "pipeline", name: "linear", steps: ["a", "b"] },
      { id: "a", kind: "prompt", name: "a", prompt: "A." },
      { id: "b", kind: "prompt", name: "b", prompt: "B." },
    ];
    const map = mapOf(ops);
    assert.ok(!operatorHasFork(map.r, map));
    assert.equal(branchOutputCount(map.r, map), 1);
    const plan = buildBranchPlan(map.r, map);
    assert.deepEqual(plan.segments, ["a", "b"]);
    assert.equal(plan.branches, null);
  });

  it("compiles the investment-memo shape: shared prefix once, two leaf outputs", () => {
    const map = mapOf(forkedOps);
    const plan = buildBranchPlan(map.root, map);
    assert.deepEqual(plan.segments, ["expand1"]);
    assert.equal(plan.branches.length, 2);
    assert.deepEqual(plan.branches[0].segments, ["onepager"]);
    assert.equal(plan.branches[0].branches, null);
    // pipeline branch runs as one unit
    assert.deepEqual(plan.branches[1].segments, ["memoPipe"]);
    assert.equal(branchOutputCount(map.root, map), 2);
    assert.deepEqual(branchOutputNames(map.root, map), ["make one pager", "investment memo steps"]);
  });

  it("steps after a fork continue every branch", () => {
    const ops = [
      { id: "r", kind: "pipeline", name: "r", steps: ["a", "f", "tail"] },
      { id: "a", kind: "prompt", name: "a", prompt: "A." },
      { id: "f", kind: "pipeline", fork: true, name: "fork", steps: ["b1", "b2"] },
      { id: "b1", kind: "prompt", name: "b1", prompt: "B1." },
      { id: "b2", kind: "prompt", name: "b2", prompt: "B2." },
      { id: "tail", kind: "prompt", name: "tail", prompt: "T." },
    ];
    const map = mapOf(ops);
    const plan = buildBranchPlan(map.r, map);
    assert.deepEqual(plan.branches[0].segments, ["b1", "tail"]);
    assert.deepEqual(plan.branches[1].segments, ["b2", "tail"]);
  });

  it("nested forks multiply outputs", () => {
    const ops = [
      { id: "r", kind: "pipeline", name: "r", steps: ["f"] },
      { id: "f", kind: "pipeline", fork: true, name: "fork", steps: ["b1", "inner"] },
      { id: "b1", kind: "prompt", name: "b1", prompt: "B1." },
      { id: "inner", kind: "pipeline", name: "inner", steps: ["c", "f2"] },
      { id: "c", kind: "prompt", name: "c", prompt: "C." },
      { id: "f2", kind: "pipeline", fork: true, name: "fork2", steps: ["d1", "d2"] },
      { id: "d1", kind: "prompt", name: "d1", prompt: "D1." },
      { id: "d2", kind: "prompt", name: "d2", prompt: "D2." },
    ];
    const map = mapOf(ops);
    assert.equal(branchOutputCount(map.r, map), 3);
  });

  it("survives migrateOperatorStore round-trip unchanged", () => {
    const migrated = migrateOperatorStore(forkedOps);
    const map = mapOf(migrated);
    const root = migrated.find((o) => o.name === "investment memo");
    assert.ok(root, "forked root survives migration");
    assert.ok(operatorHasFork(root, map));
    assert.equal(branchOutputCount(root, map), 2);
    // fork flag and every sub-step preserved
    assert.ok(map.fork1?.fork);
    for (const id of ["expand1", "fork1", "onepager", "memoPipe", "research1", "memo1"]) {
      assert.ok(map[id], `step ${id} survives migration`);
    }
  });

  it("migration keeps sub-steps named after primitives (dragged-in chips)", () => {
    const saved = [
      { id: "top1", kind: "pipeline", name: "my lens", top: true, steps: ["s1", "s2"] },
      // a leaf pasted from the "expand" primitive chip: primitive name, no flag
      { id: "s1", kind: "prompt", name: "expand", prompt: "Unfold." },
      { id: "s2", kind: "prompt", name: "verdict", prompt: "Verdict." },
    ];
    const migrated = migrateOperatorStore(saved);
    const map = mapOf(migrated);
    assert.ok(map.s1, "primitive-named sub-step survives");
    assert.ok(map.s2);
    assert.deepEqual(map.top1.steps, ["s1", "s2"]);
    // canonical primitives still exactly once each
    assert.equal(migrated.filter((o) => o.primitive).length, 8);
  });

  it("old linear saved operators migrate exactly as before", () => {
    const saved = [
      { id: "x1", kind: "pipeline", name: "thesis", top: true, steps: ["y1"] },
      { id: "y1", kind: "prompt", name: "argue", prompt: "Argue." },
    ];
    const migrated = migrateOperatorStore(saved);
    const map = mapOf(migrated);
    assert.ok(map.x1);
    assert.ok(map.y1);
    assert.ok(!operatorHasFork(map.x1, map));
    assert.equal(branchOutputCount(map.x1, map), 1);
  });
});

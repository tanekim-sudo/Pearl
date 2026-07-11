import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildDraftMap,
  reorderStep,
  moveStep,
  removeStep,
  duplicateStep,
  addLeafStep,
  addBranchAtStep,
  mergeStepsSequential,
  opToClipboardTree,
  pasteTreeAt,
  ensurePipelineRoot,
  cloneSubtree,
  findParentId,
  isAncestor,
  nextSiblingId,
} from "./function-tree-editor.js";

const id = () => Math.random().toString(36).slice(2, 10);

function sampleTree() {
  const root = "r";
  const a = "a";
  const b = "b";
  const c = "c";
  const ops = [
    { id: root, kind: "pipeline", name: "root", steps: [a, b] },
    { id: a, kind: "prompt", name: "A", prompt: "do A" },
    { id: b, kind: "pipeline", name: "B group", steps: [c] },
    { id: c, kind: "prompt", name: "C", prompt: "do C" },
  ];
  return { ops, root };
}

describe("function-tree-editor", () => {
  it("reorders siblings within a pipeline", () => {
    const { ops, root } = sampleTree();
    const next = reorderStep(ops, root, 0, 2);
    const map = buildDraftMap(next);
    assert.deepEqual(map[root].steps, ["b", "a"]);
  });

  it("moves a step into a nested pipeline", () => {
    const { ops, root } = sampleTree();
    const next = moveStep(ops, "a", "b", 0);
    const map = buildDraftMap(next);
    assert.deepEqual(map[root].steps, ["b"]);
    assert.deepEqual(map["b"].steps, ["a", "c"]);
  });

  it("prevents moving a node into its descendant", () => {
    const { ops } = sampleTree();
    const next = moveStep(ops, "b", "c", 0);
    assert.equal(next, ops);
  });

  it("removes a step and its subtree", () => {
    const { ops, root } = sampleTree();
    const next = removeStep(ops, "b", root);
    const map = buildDraftMap(next);
    assert.deepEqual(map[root].steps, ["a"]);
    assert.ok(!map["b"]);
    assert.ok(!map["c"]);
  });

  it("duplicates a subtree as the next sibling", () => {
    const { ops, root } = sampleTree();
    const next = duplicateStep(ops, "a", id);
    const map = buildDraftMap(next);
    const dupIds = map[root].steps.filter((sid) => map[sid].name === "A");
    assert.equal(dupIds.length, 2);
    assert.notEqual(dupIds[0], dupIds[1]);
  });

  it("adds a leaf step at an index", () => {
    const { ops, root } = sampleTree();
    const { draftOps, stepId } = addLeafStep(ops, root, 1, { name: "X" }, id);
    const map = buildDraftMap(draftOps);
    assert.deepEqual(map[root].steps, ["a", stepId, "b"]);
    assert.equal(map[stepId].name, "X");
  });

  it("merges two siblings into a nested pipeline", () => {
    const { ops, root } = sampleTree();
    const next = mergeStepsSequential(ops, "a", "b", id);
    const map = buildDraftMap(next);
    assert.equal(map[root].steps.length, 1);
    const mergedId = map[root].steps[0];
    assert.deepEqual(map[mergedId].steps, ["a", "b"]);
    assert.ok(map[mergedId].mergedFrom);
  });

  it("pastes a tree at a parent index", () => {
    const { ops, root } = sampleTree();
    const tree = { name: "P", prompt: "paste me" };
    const { draftOps, stepId } = pasteTreeAt(ops, tree, root, 1, id);
    const map = buildDraftMap(draftOps);
    assert.equal(map[stepId].name, "P");
    assert.deepEqual(map[root].steps, ["a", stepId, "b"]);
  });

  it("wraps a leaf root in a pipeline", () => {
    const leaf = { id: "l", kind: "prompt", name: "solo", prompt: "x", top: true };
    const { draftOps, rootId } = ensurePipelineRoot([leaf], "l", id);
    const map = buildDraftMap(draftOps);
    assert.equal(rootId !== "l", true);
    assert.equal(map[rootId].kind, "pipeline");
    assert.deepEqual(map[rootId].steps, ["l"]);
  });

  it("detects ancestry", () => {
    const map = buildDraftMap(sampleTree().ops);
    assert.equal(isAncestor("b", "c", map), true);
    assert.equal(isAncestor("a", "c", map), false);
  });

  it("finds next sibling", () => {
    const map = buildDraftMap(sampleTree().ops);
    assert.equal(nextSiblingId("a", map), "b");
    assert.equal(nextSiblingId("b", map), null);
  });

  it("clones subtree with fresh ids", () => {
    const map = buildDraftMap(sampleTree().ops);
    const { ops, rootId } = cloneSubtree("b", map, id);
    assert.notEqual(rootId, "b");
    const newMap = buildDraftMap(ops);
    assert.equal(newMap[rootId].name, "B group");
    assert.notEqual(newMap[rootId].steps[0], "c");
  });

  it("branch from the tail step appends linearly", () => {
    const { ops, root } = sampleTree();
    const { draftOps, stepId, forked } = addBranchAtStep(ops, "b", { name: "next" }, id);
    assert.equal(forked, false);
    const map = buildDraftMap(draftOps);
    assert.deepEqual(map[root].steps, ["a", "b", stepId]);
    assert.equal(map[stepId].name, "next");
  });

  it("branch from a mid step forks the remainder", () => {
    const { ops, root } = sampleTree();
    const { draftOps, stepId, forked } = addBranchAtStep(ops, "a", { name: "one pager" }, id);
    assert.equal(forked, true);
    const map = buildDraftMap(draftOps);
    assert.equal(map[root].steps.length, 2);
    const forkId = map[root].steps[1];
    assert.ok(map[forkId].fork);
    assert.deepEqual(map[forkId].steps, ["b", stepId]);
  });

  it("places an upward strand before the existing branch lane", () => {
    const { ops, root } = sampleTree();
    const { draftOps, stepId } = addBranchAtStep(
      ops,
      "a",
      { name: "upward", branchSide: "before" },
      id
    );
    const map = buildDraftMap(draftOps);
    const fork = map[map[root].steps[1]];
    assert.deepEqual(fork.steps, [stepId, "b"]);
  });

  it("second branch from the same step joins the existing fork", () => {
    const { ops } = sampleTree();
    const first = addBranchAtStep(ops, "a", { name: "one pager" }, id);
    const second = addBranchAtStep(first.draftOps, "a", { name: "memo" }, id);
    assert.equal(second.forked, true);
    const map = buildDraftMap(second.draftOps);
    const fork = Object.values(map).find((o) => o.fork);
    assert.equal(fork.steps.length, 3);
    assert.deepEqual(fork.steps, ["b", first.stepId, second.stepId]);
  });

  it("branch from a leaf branch extends it into a lane", () => {
    const { ops } = sampleTree();
    const first = addBranchAtStep(ops, "a", { name: "one pager" }, id);
    const ext = addBranchAtStep(first.draftOps, first.stepId, { name: "polish" }, id);
    assert.equal(ext.forked, false);
    const map = buildDraftMap(ext.draftOps);
    const fork = Object.values(map).find((o) => o.fork);
    const laneId = fork.steps.find((sid) => map[sid].kind === "pipeline" && !map[sid].fork && map[sid].steps.includes(first.stepId));
    assert.ok(laneId, "branch leaf wrapped into a lane");
    assert.deepEqual(map[laneId].steps, [first.stepId, ext.stepId]);
  });

  it("fork flag survives clipboard round-trip", () => {
    const { ops, root } = sampleTree();
    const { draftOps } = addBranchAtStep(ops, "a", { name: "one pager" }, id);
    const map = buildDraftMap(draftOps);
    const tree = opToClipboardTree(map[root], map);
    assert.ok(tree.steps.some((s) => s.fork));
    const empty = [{ id: "r2", kind: "pipeline", name: "r2", steps: [] }];
    const { draftOps: pasted, stepId: pastedRoot } = pasteTreeAt(empty, tree, "r2", 0, id);
    const pmap = buildDraftMap(pasted);
    const pforks = Object.values(pmap).filter((o) => o.fork);
    assert.equal(pforks.length, 1);
    assert.equal(pforks[0].steps.length, 2);
    assert.ok(pmap[pastedRoot]);
  });
});

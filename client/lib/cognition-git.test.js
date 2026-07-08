import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  gitRefKind,
  lineageBreadcrumb,
  collectPipelineStepNames,
  diffStepSequences,
  makeCommit,
  appendCommit,
  groupLensesByRepo,
} from "./cognition-git.js";

const id = () => Math.random().toString(36).slice(2, 10);

describe("cognition-git", () => {
  it("classifies git ref kinds", () => {
    assert.equal(gitRefKind({ parentId: "p" }), "branch");
    assert.equal(gitRefKind({ forkedFrom: "f" }), "fork");
    assert.equal(gitRefKind({ mergedFrom: ["a", "b"] }), "merge");
    assert.equal(gitRefKind({ defaultBranch: true }), "main");
  });

  it("builds lineage breadcrumbs", () => {
    const byId = {
      r: { name: "root" },
      b: { name: "experiment" },
    };
    const crumbs = lineageBreadcrumb({ name: "leaf", parentId: "b", lineage: ["r", "b"] }, byId);
    assert.deepEqual(crumbs, ["root", "experiment", "leaf"]);
  });

  it("flattens pipeline step names", () => {
    const opMap = {
      root: { kind: "pipeline", steps: ["a", "b"] },
      a: { kind: "prompt", name: "Alpha" },
      b: { kind: "pipeline", steps: ["c"] },
      c: { kind: "prompt", name: "Charlie" },
    };
    assert.deepEqual(collectPipelineStepNames("root", opMap), ["Alpha", "Charlie"]);
  });

  it("diffs step sequences with LCS", () => {
    const { shared, onlyA, onlyB } = diffStepSequences(
      ["see", "compress", "deliver"],
      ["see", "expand", "deliver"]
    );
    assert.deepEqual(
      shared.map((x) => x.name),
      ["see", "deliver"]
    );
    assert.deepEqual(
      onlyA.map((x) => x.name),
      ["compress"]
    );
    assert.deepEqual(
      onlyB.map((x) => x.name),
      ["expand"]
    );
  });

  it("appends commits and bumps version", () => {
    const lens = { id: "l1", name: "test", version: 1 };
    const commit = makeCommit({ message: "add step", stepNames: ["a"], kind: "commit" }, id);
    const next = appendCommit(lens, commit);
    assert.equal(next.commits.length, 1);
    assert.equal(next.headCommitId, commit.id);
    assert.equal(next.version, 1);
  });

  it("groups lenses into repos with branches and forks", () => {
    const lenses = [
      { id: "main", name: "Main", updatedAt: 100 },
      { id: "br", name: "Branch", parentId: "main", lineage: ["main"], updatedAt: 50 },
      { id: "fk", name: "Fork", forkedFrom: "main", updatedAt: 30 },
    ];
    const repos = groupLensesByRepo(lenses);
    assert.equal(repos.length, 1);
    assert.equal(repos[0].root.id, "main");
    assert.equal(repos[0].branches.length, 1);
    assert.equal(repos[0].forks.length, 1);
  });
});

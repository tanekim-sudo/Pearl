import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEEP_FUNCTION_ARCHITECT_STANDARDS,
  countResearchLeaves,
  countDeliverLeaves,
  treeDepth,
  walkFunctionTree,
} from "./function-standards.js";

describe("function-standards", () => {
  it("exports deep architect standards with canvas vision", () => {
    assert.match(DEEP_FUNCTION_ARCHITECT_STANDARDS, /thinking canvas/i);
    assert.match(DEEP_FUNCTION_ARCHITECT_STANDARDS, /No artificial cap/i);
    assert.match(DEEP_FUNCTION_ARCHITECT_STANDARDS, /GOOD composite names/i);
  });

  it("walkFunctionTree visits all nodes", () => {
    const tree = {
      name: "root",
      steps: [
        { name: "a", steps: [{ name: "leaf", prompt: "x" }] },
        { name: "b", research: true, prompt: "y" },
      ],
    };
    const names = [];
    walkFunctionTree(tree, (n) => names.push(n.name));
    assert.deepEqual(names, ["root", "a", "leaf", "b"]);
  });

  it("counts research and deliver leaves", () => {
    const tree = {
      name: "root",
      steps: [
        { name: "research", research: true, prompt: "go" },
        { name: "deliver", prompt: "write" },
      ],
    };
    assert.equal(countResearchLeaves(tree), 1);
    assert.equal(countDeliverLeaves(tree), 1);
    assert.equal(treeDepth(tree), 2);
  });
});

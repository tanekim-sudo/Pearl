import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isInternalMetadataOutput,
  deliverableRewritePrompt,
  defaultDeliverLeaf,
} from "./deliverable-quality.js";
import {
  matchRoleTemplate,
  isResolveOnlyFunction,
  INVESTOR_FUNCTION_TREES,
  FOUNDER_FUNCTION_TREES,
  RESEARCHER_FUNCTION_TREES,
  WRITER_FUNCTION_TREES,
  treeDepth,
  countResearchLeaves,
  countDeliverLeaves,
} from "./role-templates.js";
import { isResolveLeaf, treeDepth as stdTreeDepth } from "./function-standards.js";

const ALL_ROLE_TREES = [
  ["investor", INVESTOR_FUNCTION_TREES],
  ["founder", FOUNDER_FUNCTION_TREES],
  ["researcher", RESEARCHER_FUNCTION_TREES],
  ["writer", WRITER_FUNCTION_TREES],
];

describe("deliverable quality", () => {
  it("detects internal ENTITY/SEARCH metadata", () => {
    const junk = `ENTITY: Legora
SECTOR: Legal tech
SEARCHTERMS: "Legora funding"`;
    assert.ok(isInternalMetadataOutput(junk));
    assert.ok(!isInternalMetadataOutput("## Thesis\nLegora is a legal tech platform."));
  });

  it("provides default deliver leaf when pipeline has only resolve steps", () => {
    const leaf = defaultDeliverLeaf("Build Thesis", "Full thesis");
    assert.match(leaf.prompt, /deliverable/i);
  });
});

describe("function standards", () => {
  it("flags resolve leaves", () => {
    assert.ok(isResolveLeaf({ name: "Identify Subject Entity", prompt: "Return ENTITY:" }));
    assert.ok(!isResolveLeaf({ name: "Draft Investment Thesis", prompt: "Write ## Thesis" }));
  });

  it("treeDepth matches role-templates helper", () => {
    const shallow = { name: "x", prompt: "y" };
    assert.equal(stdTreeDepth(shallow), 1);
    const deep = { name: "root", steps: [{ name: "a", steps: [{ name: "b", prompt: "c" }] }] };
    assert.equal(stdTreeDepth(deep), 3);
  });
});

describe("role templates", () => {
  it("matches private equity investor roles", () => {
    const t = matchRoleTemplate("private equity investor");
    assert.ok(t);
    assert.equal(t.id, "investor");
    assert.ok(t.trees.length >= 5);
  });

  it("matches founder, researcher, and writer roles", () => {
    assert.equal(matchRoleTemplate("startup founder")?.id, "founder");
    assert.equal(matchRoleTemplate("PhD researcher")?.id, "researcher");
    assert.equal(matchRoleTemplate("freelance writer")?.id, "writer");
  });

  for (const [roleId, trees] of ALL_ROLE_TREES) {
    it(`${roleId} curated trees are deep with research + deliver leaves`, () => {
      assert.ok(trees.length >= 5, roleId);
      for (const fn of trees) {
        assert.ok(fn.steps?.length >= 2, `${roleId}: ${fn.name} needs nested steps`);
        assert.ok(treeDepth(fn) >= 2, `${roleId}: ${fn.name} should be at least 2 levels deep`);
        assert.equal(countResearchLeaves(fn), 1, `${roleId}: ${fn.name} needs exactly one research leaf`);
        assert.ok(countDeliverLeaves(fn) >= 1, `${roleId}: ${fn.name} needs deliverable leaves`);
      }
    });
  }

  it("investment thesis tree is deeply nested", () => {
    const thesis = INVESTOR_FUNCTION_TREES.find((t) => t.name === "Build Investment Thesis");
    assert.ok(thesis);
    assert.ok(treeDepth(thesis) >= 3);
  });

  it("flags resolve-only junk functions", () => {
    const op = { id: "x", top: true, name: "Identify Subject Entity and Comp Universe", kind: "pipeline", steps: ["l1"] };
    const opMap = {
      x: op,
      l1: { id: "l1", kind: "prompt", prompt: "Return ENTITY: and SEARCH_TERMS:" },
    };
    assert.ok(isResolveOnlyFunction(op, opMap));
  });
});

describe("deliverableRewritePrompt", () => {
  it("includes function name", () => {
    assert.match(deliverableRewritePrompt("Build Thesis", "Full thesis"), /Build Thesis/);
  });
});

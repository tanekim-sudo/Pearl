import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  dedupeOperators,
  dedupeGenerators,
  dedupeTransformationRepos,
  operatorDupeKey,
} from "./operator-dedupe.js";

const leaf = (id, name, prompt) => ({ id, name, prompt, kind: "prompt", top: true });

describe("dedupeOperators", () => {
  it("collapses same-name same-content top-level ops, keeping the first", () => {
    const ops = [
      leaf("a1", "distill", "reduce to essence"),
      leaf("b1", "invert", "flip the claim"),
      leaf("a2", "distill", "reduce to essence"),
      leaf("a3", "Distill", "  Reduce to essence "),
    ];
    const { ops: next, idMap } = dedupeOperators(ops);
    assert.deepEqual(next.map((o) => o.id), ["a1", "b1"]);
    assert.equal(idMap.a2, "a1");
    assert.equal(idMap.a3, "a1");
  });

  it("keeps same-name ops whose content differs", () => {
    const ops = [leaf("a1", "distill", "reduce to essence"), leaf("a2", "distill", "different prompt")];
    const { ops: next, idMap } = dedupeOperators(ops);
    assert.equal(next.length, 2);
    assert.deepEqual(idMap, {});
  });

  it("drops duplicate pipelines with their exclusive subtrees", () => {
    const ops = [
      { id: "p1", name: "read deep", kind: "pipeline", steps: ["s1", "s2"], top: true },
      { id: "s1", name: "strip", prompt: "strip detail", kind: "prompt" },
      { id: "s2", name: "name", prompt: "name the core", kind: "prompt" },
      { id: "p2", name: "read deep", kind: "pipeline", steps: ["t1", "t2"], top: true },
      { id: "t1", name: "strip", prompt: "strip detail", kind: "prompt" },
      { id: "t2", name: "name", prompt: "name the core", kind: "prompt" },
    ];
    const { ops: next, idMap } = dedupeOperators(ops);
    assert.deepEqual(next.map((o) => o.id), ["p1", "s1", "s2"]);
    assert.equal(idMap.p2, "p1");
  });

  it("keeps shared steps still referenced by a surviving pipeline", () => {
    const ops = [
      { id: "p1", name: "read deep", kind: "pipeline", steps: ["s1"], top: true },
      { id: "s1", name: "strip", prompt: "strip detail", kind: "prompt" },
      { id: "p2", name: "read deep", kind: "pipeline", steps: ["s1"], top: true },
      { id: "p3", name: "other", kind: "pipeline", steps: ["s1"], top: true },
    ];
    const { ops: next } = dedupeOperators(ops);
    assert.ok(next.find((o) => o.id === "s1"));
    assert.ok(next.find((o) => o.id === "p3"));
    assert.ok(!next.find((o) => o.id === "p2"));
  });

  it("is idempotent", () => {
    const ops = [leaf("a1", "distill", "x"), leaf("a2", "distill", "x")];
    const once = dedupeOperators(ops).ops;
    const twice = dedupeOperators(once).ops;
    assert.deepEqual(twice, once);
  });
});

describe("operatorDupeKey", () => {
  it("matches structurally equal pipelines under different ids", () => {
    const a = { id: "p1", name: "read", kind: "pipeline", steps: ["s1"], top: true };
    const b = { id: "p2", name: "read", kind: "pipeline", steps: ["t1"], top: true };
    const map = {
      s1: { id: "s1", name: "strip", prompt: "strip detail" },
      t1: { id: "t1", name: "strip", prompt: "strip detail" },
    };
    assert.equal(operatorDupeKey(a, map), operatorDupeKey(b, map));
  });
});

describe("dedupeGenerators", () => {
  it("drops exact-duplicate generators keeping the oldest", () => {
    const list = [
      { id: "g2", title: "pressure", items: [{ type: "text", text: "hold" }], savedAt: 200 },
      { id: "g1", title: "pressure", items: [{ type: "text", text: "hold" }], savedAt: 100 },
      { id: "g3", title: "pressure", items: [{ type: "text", text: "different" }], savedAt: 300 },
    ];
    const next = dedupeGenerators(list);
    assert.deepEqual(next.map((g) => g.id), ["g1", "g3"]);
  });
});

describe("dedupeTransformationRepos", () => {
  it("drops same-name same-root repos keeping the oldest", () => {
    const list = [
      { id: "r1", name: "distill", opId: "a1", createdAt: 100 },
      { id: "r2", name: "distill", opId: "a1", createdAt: 200 },
      { id: "r3", name: "distill", opId: "b1", createdAt: 300 },
    ];
    const next = dedupeTransformationRepos(list);
    assert.deepEqual(next.map((r) => r.id), ["r1", "r3"]);
  });
});

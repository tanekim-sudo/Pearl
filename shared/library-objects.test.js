import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  captureFunctionFromLineage,
  classifyLegacyLibraryObject,
  createLensFromDrop,
  createMoveFromDrop,
  executeLibraryObject,
  migrateLibraryObjects,
  normalizeLibraryObject,
  validateLibraryObjects,
} from "./library-objects.js";

test("legacy taxonomy migrates idempotently to move function lens", () => {
  const legacy = [
    { id: "atomic", kind: "function", prompt: "Rewrite." },
    { id: "process", kind: "lens", steps: ["atomic"] },
    { id: "material", kind: "generator", items: [{ id: "i", text: "Evidence" }] },
  ];
  assert.deepEqual(legacy.map((value) => classifyLegacyLibraryObject(value).kind), ["move", "function", "lens"]);
  const once = migrateLibraryObjects(legacy);
  const twice = migrateLibraryObjects(once);
  assert.deepEqual(twice, once);
  assert.deepEqual(once.map((value) => value.kind), ["move", "function", "lens"]);
});

test("historical library fixture opens behaviorally and preserves safe unknown fields", () => {
  const fixture = JSON.parse(fs.readFileSync(new URL("./fixtures/library-history-v1.json", import.meta.url), "utf8"));
  const migrated = migrateLibraryObjects(fixture.objects, { now: 1 });
  assert.deepEqual(migrated.map((entry) => entry.kind), ["move", "function", "lens"]);
  assert.equal(migrated[0].prompt, "Rewrite clearly.");
  assert.equal(migrated[1].processGraph.nodes[0].ref.id, "legacy-atomic");
  assert.deepEqual(migrated[1].extensions.historicalUnknown, { preserve: true });
  assert.deepEqual(migrateLibraryObjects(migrated, { now: 1 }), migrated);
});

test("unsupported future major versions fail clearly", () => {
  assert.throws(
    () => normalizeLibraryObject({ id: "future", stableId: "future", kind: "move", schemaVersion: 99, prompt: "Act." }),
    /unsupported future library object version 99/
  );
});

test("drops preserve content, lineage, and material semantics", () => {
  const move = createMoveFromDrop({ text: "  Use this exact instruction.  " });
  assert.equal(move.prompt, "  Use this exact instruction.  ");
  const lens = createLensFromDrop({ id: "source", text: "Context" });
  assert.equal(lens.kind, "lens");
  assert.equal(lens.contextGraph.material[0].content, "Context");
  const captured = captureFunctionFromLineage({
    id: "result",
    history: [{ opId: move.id, opVersion: 1, outputIndex: 0 }],
  });
  const fn = captured.function;
  assert.equal(captured.eligible, true);
  assert.equal(fn.kind, "function");
  assert.equal(fn.processGraph.nodes.length, 1);
});

test("move is one call, function is ordered execution, lens is context only", async () => {
  const move = normalizeLibraryObject({ id: "m", kind: "move", prompt: "Rewrite." });
  const fn = normalizeLibraryObject({
    id: "f",
    kind: "function",
    processGraph: { nodes: [{ id: "n", ref: { id: "m", version: 1 } }], edges: [], outputs: [{ from: "n", select: null }] },
  });
  const lens = normalizeLibraryObject({ id: "l", kind: "lens", contextPolicy: "empty", contextGraph: { material: [], placements: [], relationships: [] } });
  assert.equal(validateLibraryObjects([move, fn, lens]).length, 3);
  let calls = 0;
  const callModel = async ({ input }) => { calls += 1; return `${input}!`; };
  assert.deepEqual((await executeLibraryObject(move, "x", { objects: [move], callModel })).outputs, ["x!"]);
  assert.equal(calls, 1);
  assert.deepEqual((await executeLibraryObject(fn, "y", { objects: [move, fn], callModel })).outputs, ["y!"]);
  assert.equal(calls, 2);
  await assert.rejects(() => executeLibraryObject(lens, "z", { objects: [lens], callModel }), /context/i);
});

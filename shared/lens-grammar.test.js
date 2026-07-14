import test from "node:test";
import assert from "node:assert/strict";
import {
  createCompoundOperator,
  createPendingStackGate,
  executeSequentialAlgebra,
  migrateOperatorGrammar,
  operatorOutputCount,
  previewComposition,
  previewCompositionSequence,
  validateCompoundDependencies,
} from "./lens-grammar.js";

function fixture() {
  const ops = [
    { id: "invert", name: "invert", kind: "prompt", prompt: "invert", outputType: "text" },
    { id: "ground", name: "ground", kind: "prompt", prompt: "ground", outputType: "text" },
    { id: "two", name: "two", kind: "prompt", prompt: "two", outputCount: 2 },
    { id: "three", name: "three", kind: "prompt", prompt: "three", outputCount: 3 },
    { id: "merge", name: "compare", kind: "prompt", prompt: "compare", inputArity: 2 },
  ];
  return Object.fromEntries(ops.map((op) => [op.id, op]));
}

test("composition order is explicit and structurally distinct", () => {
  const map = fixture();
  let n = 0;
  const ids = () => `new-${++n}`;
  const forward = createCompoundOperator(map.invert, map.ground, map, { idFactory: ids });
  const reverse = createCompoundOperator(map.ground, map.invert, map, { idFactory: ids });
  assert.equal(forward.preview.label, "invert → ground");
  assert.equal(reverse.preview.label, "ground → invert");
  assert.deepEqual(forward.ops[0].composition.components.map((c) => c.opId), ["invert", "ground"]);
  assert.deepEqual(reverse.ops[0].composition.components.map((c) => c.opId), ["ground", "invert"]);
  assert.notDeepEqual(forward.ops[0].steps, reverse.ops[0].steps);
});

test("N→M predicts cartesian outputs and guards expensive stacks", () => {
  const map = fixture();
  const preview = previewComposition(map.two, map.three, map, { confirmCap: 4 });
  assert.equal(preview.outputContract.count, 6);
  assert.equal(preview.requiresConfirmation, true);
  assert.throws(
    () => createCompoundOperator(map.two, map.three, map, { confirmCap: 4, idFactory: () => Math.random().toString() }),
    /confirmation required/
  );
});

test("multi-input second operators are incompatible", () => {
  const map = fixture();
  const preview = previewComposition(map.invert, map.merge, map);
  assert.equal(preview.ok, false);
  assert.match(preview.errors[0], /requires 2 inputs/);
});

test("sequential executor maps every A output across every B output with lineage", async () => {
  const outputs = await executeSequentialAlgebra(
    ["x"],
    async (x) => [`${x}-a1`, `${x}-a2`],
    async (x) => [`${x}-b1`, `${x}-b2`, `${x}-b3`]
  );
  assert.equal(outputs.length, 6);
  assert.equal(outputs[5].value, "x-a2-b3");
  assert.deepEqual(outputs[5].lineage[1], { step: 1, inputIndex: 1, outputIndex: 2 });
});

test("execution is cancellable and capped", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    executeSequentialAlgebra(["x"], async (x) => x, async (x) => x, { signal: controller.signal }),
    { name: "AbortError" }
  );
  await assert.rejects(
    executeSequentialAlgebra(["x"], async () => ["a", "b"], async () => ["1", "2"], { hardCap: 3 }),
    /output cap 3/
  );
});

test("fork counts multiply through later multi-output steps", () => {
  const map = fixture();
  map.a = { id: "a", name: "A", kind: "prompt", outputCount: 1 };
  map.b = { id: "b", name: "B", kind: "prompt", outputCount: 1 };
  map.fork = { id: "fork", name: "fork", kind: "pipeline", fork: true, steps: ["a", "b"] };
  map.root = { id: "root", name: "root", kind: "pipeline", steps: ["fork", "three"] };
  assert.equal(operatorOutputCount(map.root, map), 6);
});

test("migration gives legacy operators stable version-one contracts", () => {
  const migrated = migrateOperatorGrammar({ id: "old", name: "old", kind: "prompt", prompt: "x" });
  assert.equal(migrated.version, 1);
  assert.equal(migrated.inputType, "text");
  assert.equal(migrated.lensKind, "custom");
});

test("follow-latest compounds reject missing dependencies and cycles", () => {
  const compound = {
    id: "compound",
    composition: { linkMode: "latest", components: [{ opId: "missing", name: "gone" }] },
  };
  assert.deepEqual(validateCompoundDependencies(compound, {}).errors, ["missing component gone"]);
  const cyclic = {
    id: "cycle",
    composition: { linkMode: "latest", components: [{ opId: "cycle", name: "self" }] },
  };
  assert.match(validateCompoundDependencies(cyclic, { cycle: cyclic }).errors.join(" "), /cycle/);
});

test("pending brush queue has zero execution before explicit GO", async () => {
  const map = fixture();
  const gate = createPendingStackGate();
  let mutations = 0;
  gate.add(map.invert);
  gate.add(map.ground);
  gate.reorder(1, 0);
  assert.equal(mutations, 0);
  assert.deepEqual(gate.queue.map((op) => op.id), ["ground", "invert"]);
  const result = await gate.go("one", async () => {
    mutations += 1;
    return "done";
  });
  assert.equal(result.committed, true);
  assert.equal(mutations, 1);
});

test("duplicate GO commits exactly once and failures retain queue", async () => {
  const map = fixture();
  const gate = createPendingStackGate([map.invert, map.ground]);
  let calls = 0;
  await gate.go("same", async () => { calls += 1; });
  const duplicate = await gate.go("same", async () => { calls += 1; });
  assert.equal(duplicate.duplicate, true);
  assert.equal(calls, 1);
  const failed = await gate.go("failure", async () => { throw new Error("offline"); });
  assert.equal(failed.committed, false);
  assert.deepEqual(failed.queue.map((op) => op.id), ["invert", "ground"]);
});

test("pending and saved composition use the same order and output algebra", () => {
  const map = fixture();
  const pending = previewCompositionSequence([map.two, map.three], map);
  const saved = createCompoundOperator(map.two, map.three, map, {
    confirmed: true,
    idFactory: (() => { let id = 0; return () => `id-${++id}`; })(),
  });
  assert.deepEqual(pending.order, saved.preview.order);
  assert.equal(pending.predictedOutputCount, saved.preview.outputContract.count);
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  composeBrushStack,
  createExecutionRequest,
  createInsertionPlan,
  createLensRuntime,
  createMaterialFragment,
} from "./lens-runtime.js";

const fragment = () => createMaterialFragment({
  id: "f1",
  quote: "selected text",
  prefix: "before ",
  suffix: " after",
  url: "https://example.test/page",
  title: "Fixture",
});

test("material fragments are immutable and preserve bounded provenance", () => {
  const value = fragment();
  assert.equal(value.provenance.origin, "https://example.test");
  assert.ok(value.provenance.revision.startsWith("fnv1a-"));
  assert.throws(() => { value.quote = "changed"; }, TypeError);
});

test("queue and capture never execute before explicit GO", async () => {
  const runtime = createLensRuntime();
  let runs = 0;
  runtime.capture(fragment());
  runtime.queueLens({ id: "lens", name: "Lens" });
  assert.equal(runs, 0);
  const result = await runtime.go("once", async ({ queue, fragments }) => {
    runs += 1;
    return { queue, fragments };
  });
  assert.equal(result.committed, true);
  assert.equal(runs, 1);
  const duplicate = await runtime.go("once", async () => { runs += 1; });
  assert.equal(duplicate.duplicate, true);
  assert.equal(runs, 1);
});

test("execution disclosure is exact and insertion defaults safe", () => {
  const request = createExecutionRequest({
    fragments: [fragment()],
    queue: [{ id: "lens", version: 2 }],
    disclosedCharacters: 13,
  });
  assert.equal(request.disclosure.characters, 13);
  assert.equal(createInsertionPlan({ proposedText: "result", operation: "unknown" }).operation, "copy");
});

test("shared stack composition resolves ordered operators", () => {
  const operators = {
    a: { id: "a", name: "A", kind: "prompt", outputCount: 1 },
    b: { id: "b", name: "B", kind: "prompt", outputCount: 2 },
  };
  let id = 0;
  const result = composeBrushStack(
    [{ kind: "lens", id: "a" }, { kind: "lens", id: "b" }],
    (entry) => operators[entry.id],
    operators,
    { idFactory: () => `made-${++id}` }
  );
  assert.equal(result.ok, true);
  assert.equal(result.count, 2);
  assert.equal(result.label, "A → B");
});

import test from "node:test";
import assert from "node:assert/strict";
import { composeLibraryObjects, COMPOSITION_RESULT_MATRIX } from "./composition-algebra.js";
import { createLensFromDrop, createNewChatLens, normalizeLibraryObject } from "./library-objects.js";
import { createMaterial, resolveMaterialBridge } from "./material.js";

const move = (id) => normalizeLibraryObject({ kind: "move", schemaVersion: 2, id, name: id, prompt: id });
const fn = (id) => normalizeLibraryObject({
  kind: "function",
  schemaVersion: 2,
  id,
  name: id,
  processGraph: { nodes: [{ id: "n", ref: { id: "m", version: 1 } }], edges: [], outputs: [{ from: "n" }] },
});
const lens = (id) => createLensFromDrop([{ id: `${id}-source`, text: id }], {
  id,
  name: id,
  perceptualModel: { sections: { notice: [id] } },
});

test("all ordered 3x3 pairs compile through one exhaustive matrix", () => {
  const values = { move: move("m"), function: fn("f"), lens: lens("l") };
  for (const [leftKind, row] of Object.entries(COMPOSITION_RESULT_MATRIX)) {
    for (const [rightKind, expected] of Object.entries(row)) {
      const result = composeLibraryObjects(values[leftKind], values[rightKind]);
      assert.equal(result.resultKind, expected, `${leftKind} × ${rightKind}`);
      assert.equal(result.object.kind, expected);
    }
  }
});

test("composition is ordered, immutable, and deterministically fingerprinted", () => {
  const left = move("left");
  const right = lens("right");
  const snapshot = structuredClone({ left, right });
  const a = composeLibraryObjects(left, right);
  const b = composeLibraryObjects(left, right);
  const reversed = composeLibraryObjects(right, left);
  assert.equal(a.fingerprint, b.fingerprint);
  assert.notEqual(a.fingerprint, reversed.fingerprint);
  assert.deepEqual({ left, right }, snapshot);
  assert.equal(a.object.contextBindings[0].lens.id, "right");
});

test("a later empty Lens clears inherited context while an earlier empty Lens permits later context", () => {
  const rich = lens("rich");
  const empty = createNewChatLens();
  const cleared = composeLibraryObjects(rich, empty).object;
  assert.equal(cleared.contextPolicy, "empty");
  assert.equal(cleared.contextGraph.material.length, 0);
  const resetThenRich = composeLibraryObjects(empty, rich).object;
  assert.notEqual(resetThenRich.contextPolicy, "empty");
  assert.equal(resetThenRich.perceptualModel.sections.notice[0].text, "rich");
});

test("Material bridges are deterministic when possible and explicit otherwise", () => {
  const table = createMaterial({ machineKind: "table", content: [["a", "b"]] }, { id: "table" });
  const deterministic = resolveMaterialBridge(table, { machineKind: "text" });
  assert.equal(deterministic.status, "adapted");
  assert.equal(deterministic.bridge.deterministic, true);
  const modelBridge = resolveMaterialBridge(createMaterial({ machineKind: "image", content: "data:image/png;base64,AA" }), { machineKind: "table" });
  assert.equal(modelBridge.status, "bridge-required");
  assert.deepEqual(modelBridge.bridge.requiredCapabilities, ["vision"]);
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  createLensLibraryBundle,
  importLensLibrary,
  prepareLibraryInput,
  previewLibraryImport,
  validateLensLibraryBundle,
} from "./lens-library.js";

const operators = [
  { id: "primitive", name: "Primitive", primitive: true, prompt: "p", version: 1 },
  { id: "compound", name: "Compound", version: 2, steps: ["primitive"], composition: { components: [{ opId: "primitive", name: "Primitive" }] } },
];
const generators = [{
  id: "generator",
  name: "Evidence",
  version: 1,
  items: [{ id: "item", text: "owned", provenance: { url: "https://private.example" } }],
  accessToken: "never",
}];

test("library includes dependency closure and excludes private material by default", async () => {
  const bundle = await createLensLibraryBundle({ operators, generators });
  assert.deepEqual(bundle.lensPack.operators.map((entry) => entry.id).sort(), ["compound", "primitive"]);
  assert.equal(bundle.generators[0].items[0].text, "owned");
  assert.equal(bundle.generators[0].items[0].provenance, undefined);
  assert.equal(bundle.generators[0].accessToken, undefined);
  assert.equal((await validateLensLibraryBundle(bundle)).ok, true);
});

test("checksum catches mutation and legacy lens packs migrate", async () => {
  const bundle = await createLensLibraryBundle({ operators, generators: [] });
  bundle.lensPack.operators[0].name = "tampered";
  assert.match((await validateLensLibraryBundle(bundle)).error, /checksum/);
  const legacy = await prepareLibraryInput({ kind: "lens-pack", version: 1, name: "old", roots: ["primitive"], operators: [operators[0]], collections: [] });
  assert.equal(legacy.ok, true);
  const share = await prepareLibraryInput({
    v: 1,
    kind: "lens",
    lens: { name: "Shared", opTrees: [{ name: "Root", steps: [{ name: "Child", prompt: "Move" }] }] },
    meta: { name: "Shared" },
  });
  assert.equal(share.ok, true);
  assert.equal(share.bundle.lensPack.operators.length, 2);
});

test("preview and import are idempotent with safe defaults", async () => {
  const bundle = await createLensLibraryBundle({ operators, generators });
  const first = importLensLibrary(bundle, [], [], {}, () => "copy");
  const preview = previewLibraryImport(bundle, first.operators, first.generators);
  assert.ok(preview.lenses.every((entry) => entry.status === "exact-duplicate"));
  assert.ok(preview.generators.every((entry) => entry.status === "exact-duplicate"));
  const second = importLensLibrary(bundle, first.operators, first.generators, {}, () => "copy");
  assert.equal(second.operators.length, first.operators.length);
  assert.equal(second.generators.length, first.generators.length);
});

test("validator rejects missing dependencies and prototype pollution", async () => {
  const bundle = await createLensLibraryBundle({ operators, generators: [] });
  bundle.lensPack.operators = [operators[1]];
  bundle.integrity.payloadHash = "0".repeat(64);
  assert.match((await validateLensLibraryBundle(bundle)).error, /missing dependency/);
  const polluted = JSON.parse('{"kind":"lens-everywhere-library","version":1,"__proto__":{"polluted":true}}');
  assert.match((await validateLensLibraryBundle(polluted)).error, /unsafe key/);
});

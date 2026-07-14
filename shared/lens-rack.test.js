import test from "node:test";
import assert from "node:assert/strict";
import {
  createLensPack,
  dependentsFor,
  importLensPack,
  lensRackRecord,
  mergeRackMetadata,
  previewLensPackImport,
  selectRack,
} from "./lens-rack.js";

test("rack searches names, descriptions, tags, components and domains", () => {
  const records = [
    { id: "a", name: "Invert then ground", description: "", tags: ["argument"], componentNames: ["invert", "ground"], domains: ["writing"], type: "compound" },
    { id: "b", name: "Summarize", description: "Shorten prose", tags: [], componentNames: [], domains: [], type: "primitive" },
  ];
  assert.deepEqual(selectRack(records, { search: "ground" }).records.map((r) => r.id), ["a"]);
  assert.deepEqual(selectRack(records, { search: "writing", types: ["compound"] }).records.map((r) => r.id), ["a"]);
});

test("rack bounds rendering for 1000 records and sorts pinned first", () => {
  const records = Array.from({ length: 1000 }, (_, i) => ({ id: `${i}`, name: `Lens ${i}`, type: "custom", pinned: i === 999, lastUsedAt: i }));
  const selected = selectRack(records, { limit: 1000 });
  assert.equal(selected.total, 1000);
  assert.equal(selected.records.length, 120);
  assert.equal(selected.records[0].id, "999");
  assert.equal(selected.bounded, true);
});

test("dependency delete analysis includes built-from closure", () => {
  const ops = [
    { id: "leaf", kind: "prompt" },
    { id: "compound", kind: "pipeline", steps: ["leaf"] },
  ];
  assert.deepEqual(dependentsFor("leaf", ops).map((op) => op.id), ["compound"]);
});

test("pack export includes closure and excludes private grind examples by default", () => {
  const ops = [
    { id: "forged", name: "Forged", kind: "prompt", forgedFrom: { exampleIds: ["secret"] }, grindExamples: [{ input: "private" }] },
    { id: "root", name: "Root", kind: "pipeline", steps: ["forged"] },
  ];
  const pack = createLensPack(["root"], ops);
  assert.deepEqual(pack.operators.map((op) => op.id).sort(), ["forged", "root"]);
  const forged = pack.operators.find((op) => op.id === "forged");
  assert.deepEqual(forged.forgedFrom.exampleIds, []);
  assert.equal("grindExamples" in forged, false);
});

test("pack import previews duplicate/conflict and is idempotent", () => {
  const existing = [{ id: "a", name: "A", kind: "prompt", prompt: "one" }];
  const pack = createLensPack(["a"], existing);
  assert.equal(previewLensPackImport(pack, existing).entries[0].status, "duplicate");
  const once = importLensPack(pack, existing);
  const twice = importLensPack(pack, once.operators);
  assert.equal(once.operators.length, 1);
  assert.equal(twice.operators.length, 1);
  const conflictPack = { ...pack, operators: [{ ...pack.operators[0], prompt: "two" }] };
  assert.equal(previewLensPackImport(conflictPack, existing).entries[0].status, "conflict");
});

test("rack account metadata merges by stable id, version and content", () => {
  const remote = [{ id: "remote", stableId: "lens", version: 2, hash: "h", usageCount: 3, collectionIds: ["a"] }];
  const local = [{ id: "local", stableId: "lens", version: 2, hash: "h", usageCount: 5, collectionIds: ["b"] }];
  const merged = mergeRackMetadata(local, remote);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].usageCount, 5);
  assert.deepEqual(merged[0].collectionIds.sort(), ["a", "b"]);
});

test("legacy operators become compact rack records", () => {
  const record = lensRackRecord({ id: "old", name: "Old", kind: "prompt", primitive: true });
  assert.equal(record.version, 1);
  assert.equal(record.type, "primitive");
  assert.equal(record.stepCount, 1);
});

import test from "node:test";
import assert from "node:assert/strict";
import { compileLensContext, composeLenses } from "./lens-context.js";

const lens = (overrides = {}) => ({
  id: overrides.id || "lens-1", stableId: overrides.id || "lens-1", version: 1, kind: "lens", schemaVersion: 2,
  name: "Evidence", metadata: { tags: [], description: "", archivedAt: null }, createdAt: 1, updatedAt: 1,
  migration: { sourceKind: "lens", targetVersion: 2, classification: "explicit", reason: "canonical-v2", reversible: false, aliases: [] },
  extensions: {}, contextPolicy: "bounded", contextBudget: 100, priority: 0,
  inclusionPolicy: { private: true, includeSources: true, excludeSensitive: true },
  contextGraph: { material: [{ id: "m1", content: "Prefer primary evidence.", private: false, provenance: { title: "Source" } }], relationships: [], placements: [] },
  provenance: null, ...overrides,
});

test("empty New Chat Lens isolates and fingerprints context", () => {
  const value = compileLensContext([lens({ id: "new", name: "New chat", contextPolicy: "empty", contextBudget: 0, contextGraph: { material: [], relationships: [], placements: [] } })]);
  assert.equal(value.mode, "isolated");
  assert.equal(value.text, "");
  assert.ok(value.provenance.fingerprint);
});

test("rich Lens is bounded, sourced, and conflict-visible", () => {
  const a = lens();
  const b = lens({ id: "lens-2", priority: -1, contextGraph: { material: [{ id: "m2", key: "policy", content: "Secondary", private: false }], relationships: [], placements: [] } });
  a.contextGraph.material[0].key = "policy";
  const value = composeLenses([a, b], { budget: 40 }).envelope;
  assert.ok(value.characters <= 40);
  assert.equal(value.conflicts.length, 1);
  assert.equal(value.sources[0].title, "Source");
});

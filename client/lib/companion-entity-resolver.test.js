import test from "node:test";
import assert from "node:assert/strict";
import { resolveCompanionEntity } from "./companion-entity-resolver.js";

const snapshot = {
  selection: [{ id: "a", name: "Market note" }, { id: "b", name: "Risk table" }],
  objects: [{ id: "a", name: "Market note" }, { id: "b", name: "Risk table" }, { id: "c", name: "Conclusion" }],
  lenses: [{ id: "lens-1", name: "Skeptical investor" }],
  generators: [],
};

test("resolves stable IDs, ordinals, pronouns and names", () => {
  assert.equal(resolveCompanionEntity("lens-1", snapshot).entity.id, "lens-1");
  assert.equal(resolveCompanionEntity("the second one", snapshot).entity.id, "b");
  assert.equal(resolveCompanionEntity("it", snapshot, { lastCreated: snapshot.objects[2] }).entity.id, "c");
  assert.equal(resolveCompanionEntity("skeptical investor", snapshot).entity.id, "lens-1");
});

test("does not invent missing entities", () => {
  assert.equal(resolveCompanionEntity("nonexistent", snapshot).status, "unresolved");
});

import assert from "node:assert/strict";
import test from "node:test";
import { applyPearlEntityPatch, createPearlEntity } from "./pearl-entity.js";
import {
  labelPearlVersion,
  listPearlVersions,
  restorePearlVersion,
  snapshotPearlVersion,
} from "./pearl-version-history.js";

test("named snapshots and restores keep intermediate Pearl versions", () => {
  let entity = createPearlEntity({ id: "p1", name: "Draft A", results: [{ id: "r1", text: "Alpha" }] });
  entity = applyPearlEntityPatch(entity, {
    identity: { ...entity.identity, name: "Draft B" },
    results: [{ id: "r1", text: "Beta" }],
  }, { reason: "edit-1", idempotencyKey: "e1" }).entity;
  const named = snapshotPearlVersion(entity, "Review ready");
  entity = named.entity;
  entity = applyPearlEntityPatch(entity, {
    identity: { ...entity.identity, name: "Draft C" },
    results: [{ id: "r1", text: "Gamma" }],
  }, { reason: "edit-2", idempotencyKey: "e2" }).entity;

  const listed = listPearlVersions(entity);
  assert.equal(listed.current.preview.textPreview, "Gamma");
  assert.ok(listed.count >= 2);
  assert.ok(listed.versions.some((entry) => entry.label === "Review ready" && entry.named));

  const target = listed.versions.find((entry) => entry.label === "Review ready");
  const restored = restorePearlVersion(entity, target.id, { source: "test" });
  assert.equal(restored.entity.identity.name, "Draft B");
  assert.equal(restored.entity.results[0].text, "Beta");
  assert.ok(restored.entity.revision > entity.revision - 1);
  const after = listPearlVersions(restored.entity);
  assert.ok(after.versions.some((entry) => entry.label === "Review ready"));
  assert.ok(after.versions.some((entry) => /restored from/i.test(entry.reason) || /restored from/i.test(entry.label)));
});

test("labelPearlVersion names an automatic checkpoint without mutating content", () => {
  let entity = createPearlEntity({ id: "p2", name: "Memo" });
  entity = applyPearlEntityPatch(entity, {
    identity: { ...entity.identity, name: "Memo v2" },
  }, { reason: "auto", idempotencyKey: "a1" }).entity;
  const checkpointId = entity.history.checkpoints.at(-1).id;
  entity = labelPearlVersion(entity, checkpointId, "Client send");
  const listed = listPearlVersions(entity);
  assert.equal(listed.versions.find((entry) => entry.id === checkpointId)?.label, "Client send");
  assert.equal(entity.identity.name, "Memo v2");
});

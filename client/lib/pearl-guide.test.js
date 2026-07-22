import test from "node:test";
import assert from "node:assert/strict";
import {
  PEARL_GUIDE_SECTIONS,
  PEARL_GUIDE_STORAGE_KEY,
  PEARL_GUIDE_VERSION,
  guideSectionsFor,
  normalizePearlGuideRecord,
  recordPearlGuideOpen,
} from "./pearl-guide.js";

test("every guide section teaches at least one concrete reachable step", () => {
  assert.ok(PEARL_GUIDE_SECTIONS.length >= 6);
  for (const section of PEARL_GUIDE_SECTIONS) {
    assert.match(section.id, /^[a-z][a-z-]*$/);
    assert.ok(section.title.length > 3);
    assert.ok(section.summary.length > 10);
    assert.ok(section.items.length >= 1, `${section.id} has no items`);
    assert.ok(section.platforms.every((platform) => ["app", "extension"].includes(platform)));
    for (const item of section.items) {
      assert.ok(item.label.length > 2);
      assert.ok(item.detail.length > 10);
      assert.ok(
        typeof item.gesture === "string" || typeof item.command === "string",
        `${section.id}/${item.id} names neither a gesture nor a command`
      );
    }
  }
});

test("section ids and item ids are unique", () => {
  const sectionIds = PEARL_GUIDE_SECTIONS.map((section) => section.id);
  assert.equal(new Set(sectionIds).size, sectionIds.length);
  for (const section of PEARL_GUIDE_SECTIONS) {
    const itemIds = section.items.map((item) => item.id);
    assert.equal(new Set(itemIds).size, itemIds.length, `${section.id} repeats item ids`);
  }
});

test("platform filtering keeps shared sections and drops the other surface", () => {
  const app = guideSectionsFor("app");
  const extension = guideSectionsFor("extension");
  assert.ok(app.some((section) => section.id === "scenes"));
  assert.ok(!extension.some((section) => section.id === "scenes"));
  assert.ok(extension.some((section) => section.id === "go"));
  assert.ok(!app.some((section) => section.id === "go"));
  assert.ok(app.some((section) => section.id === "begin"));
  assert.ok(extension.some((section) => section.id === "begin"));
});

test("guide open record normalizes and increments", () => {
  assert.equal(PEARL_GUIDE_STORAGE_KEY, "lens.pearl.guide.v1");
  const fresh = normalizePearlGuideRecord(null);
  assert.deepEqual(fresh, { version: PEARL_GUIDE_VERSION, opens: 0, lastOpenedAt: null });
  const opened = recordPearlGuideOpen(fresh, "2026-07-21T00:00:00.000Z");
  assert.equal(opened.opens, 1);
  assert.equal(opened.lastOpenedAt, "2026-07-21T00:00:00.000Z");
  const again = recordPearlGuideOpen(opened, "2026-07-21T01:00:00.000Z");
  assert.equal(again.opens, 2);
  assert.equal(normalizePearlGuideRecord({ opens: -3, lastOpenedAt: 5 }).opens, 0);
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { compareSnapshotTimestamps, readLocalBoardSnapshot } from "./board-sync.js";

describe("compareSnapshotTimestamps", () => {
  it("picks newer snapshot", () => {
    assert.equal(compareSnapshotTimestamps("2026-06-02T00:00:00Z", "2026-06-01T00:00:00Z"), "local");
    assert.equal(compareSnapshotTimestamps("2026-06-01T00:00:00Z", "2026-06-02T00:00:00Z"), "remote");
    assert.equal(compareSnapshotTimestamps("2026-06-01T00:00:00Z", "2026-06-01T00:00:00Z"), "equal");
  });
});

describe("readLocalBoardSnapshot", () => {
  it("returns version and keys object", () => {
    const snap = readLocalBoardSnapshot();
    assert.equal(snap.version, 1);
    assert.ok(typeof snap.keys === "object");
    assert.ok(snap.savedAt);
  });
});

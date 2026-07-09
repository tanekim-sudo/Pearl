import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  compareSnapshotTimestamps,
  readLocalBoardSnapshot,
  mergeBoardSnapshots,
  snapshotHasContent,
  AI_NODES_KEY,
} from "./board-sync.js";

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

describe("snapshotHasContent", () => {
  it("detects meaningful work", () => {
    assert.equal(snapshotHasContent({ keys: {} }), false);
    assert.equal(
      snapshotHasContent({ keys: { "lens.board.items.v1": JSON.stringify([{ id: "a", type: "text" }]) } }),
      true
    );
    assert.equal(
      snapshotHasContent({ keys: { [AI_NODES_KEY]: JSON.stringify([{ id: "n1" }]) } }),
      true
    );
  });
});

describe("mergeBoardSnapshots", () => {
  it("merges id arrays with local winning conflicts and keeps both sides", () => {
    const local = {
      keys: {
        "lens.board.items.v1": JSON.stringify([
          { id: "a", type: "text", text: "local version" },
          { id: "b", type: "text", text: "only local" },
        ]),
        "lens.doc.title.v1": JSON.stringify("Anon board"),
      },
    };
    const remote = {
      keys: {
        "lens.board.items.v1": JSON.stringify([
          { id: "a", type: "text", text: "remote version" },
          { id: "c", type: "text", text: "only remote" },
        ]),
        "lens.theme.v1": JSON.stringify("chalk"),
      },
    };
    const merged = mergeBoardSnapshots(local, remote);
    const items = JSON.parse(merged.keys["lens.board.items.v1"]);
    assert.equal(items.length, 3);
    assert.equal(items.find((i) => i.id === "a").text, "local version");
    assert.ok(items.find((i) => i.id === "b"));
    assert.ok(items.find((i) => i.id === "c"));
    // scalar: local wins when present, remote fills gaps
    assert.equal(JSON.parse(merged.keys["lens.doc.title.v1"]), "Anon board");
    assert.equal(JSON.parse(merged.keys["lens.theme.v1"]), "chalk");
    assert.ok(merged.savedAt);
  });

  it("merges item history per item", () => {
    const local = {
      keys: { "lens.item.history.v1": JSON.stringify({ a: [{ kind: "born" }] }) },
    };
    const remote = {
      keys: { "lens.item.history.v1": JSON.stringify({ b: [{ kind: "expand" }] }) },
    };
    const merged = mergeBoardSnapshots(local, remote);
    const log = JSON.parse(merged.keys["lens.item.history.v1"]);
    assert.ok(log.a);
    assert.ok(log.b);
  });
});

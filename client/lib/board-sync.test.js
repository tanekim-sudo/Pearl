import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  compareSnapshotTimestamps,
  readLocalBoardSnapshot,
  mergeBoardSnapshots,
  snapshotHasContent,
  snapshotContainedIn,
  AI_NODES_KEY,
} from "./board-sync.js";

const OPERATORS_KEY = "lens.board.operators.v2";
const LENSES_KEY = "lens.lenses.v2";

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

  it("never duplicates same-content operators under fresh ids", () => {
    const account = {
      keys: {
        [OPERATORS_KEY]: JSON.stringify([
          { id: "op-remote", name: "distill", prompt: "reduce to essence", kind: "prompt", top: true },
        ]),
      },
    };
    const anon = {
      keys: {
        [OPERATORS_KEY]: JSON.stringify([
          { id: "op-anon", name: "distill", prompt: "reduce to essence", kind: "prompt", top: true },
          { id: "op-new", name: "invert", prompt: "flip it", kind: "prompt", top: true },
        ]),
      },
    };
    const merged = mergeBoardSnapshots(anon, account);
    const ops = JSON.parse(merged.keys[OPERATORS_KEY]);
    assert.deepEqual(ops.map((o) => o.id).sort(), ["op-new", "op-remote"]);
    assert.equal(ops.filter((o) => o.name === "distill").length, 1);
  });

  it("is idempotent — merging the same board twice adds nothing", () => {
    const anon = {
      keys: {
        [OPERATORS_KEY]: JSON.stringify([
          { id: "a1", name: "distill", prompt: "reduce to essence", kind: "prompt", top: true },
        ]),
        [LENSES_KEY]: JSON.stringify([
          { id: "g1", title: "pressure", items: [{ type: "text", text: "hold" }], savedAt: 100 },
        ]),
      },
    };
    const account = { keys: {} };
    const once = mergeBoardSnapshots(anon, account);
    // Simulate a re-import: same anonymous work again but under fresh ids.
    const reimport = {
      keys: {
        [OPERATORS_KEY]: JSON.stringify([
          { id: "a2", name: "distill", prompt: "reduce to essence", kind: "prompt", top: true },
        ]),
        [LENSES_KEY]: JSON.stringify([
          { id: "g2", title: "pressure", items: [{ type: "text", text: "hold" }], savedAt: 200 },
        ]),
      },
    };
    const twice = mergeBoardSnapshots(reimport, once);
    assert.equal(JSON.parse(twice.keys[OPERATORS_KEY]).length, 1);
    assert.equal(JSON.parse(twice.keys[LENSES_KEY]).length, 1);
  });
});

describe("snapshotContainedIn", () => {
  const board = (ops, lenses) => ({
    keys: {
      [OPERATORS_KEY]: JSON.stringify(ops),
      ...(lenses ? { [LENSES_KEY]: JSON.stringify(lenses) } : {}),
    },
  });

  it("true when every local record exists remotely by id or content", () => {
    const remote = board(
      [{ id: "r1", name: "distill", prompt: "reduce", kind: "prompt", top: true }],
      [{ id: "g1", title: "pressure", items: [{ type: "text", text: "hold" }] }]
    );
    const localSameId = board([{ id: "r1", name: "distill", prompt: "reduce", kind: "prompt", top: true }]);
    const localSameContent = board(
      [{ id: "x9", name: "distill", prompt: "reduce", kind: "prompt", top: true }],
      [{ id: "g9", title: "pressure", items: [{ type: "text", text: "hold" }] }]
    );
    assert.equal(snapshotContainedIn(localSameId, remote), true);
    assert.equal(snapshotContainedIn(localSameContent, remote), true);
  });

  it("false when local has genuinely new work", () => {
    const remote = board([{ id: "r1", name: "distill", prompt: "reduce", kind: "prompt", top: true }]);
    const local = board([{ id: "x1", name: "brand new", prompt: "novel", kind: "prompt", top: true }]);
    assert.equal(snapshotContainedIn(local, remote), false);
  });

  it("empty local is always contained", () => {
    assert.equal(snapshotContainedIn({ keys: {} }, { keys: {} }), true);
  });
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  extractFormingPearlCorpus,
  materialFromIngestedText,
  resolveSceneMaterialDrop,
  shouldAcceptSceneStageTransfer,
  shouldAutoOpenOutputFrameOnCommand,
  wantsOutputFrameFromSearch,
} from "./scene-stage-interactions.js";

test("Output Frame opens only from explicit frame/audit URL intent", () => {
  assert.equal(wantsOutputFrameFromSearch(""), false);
  assert.equal(wantsOutputFrameFromSearch("?view=stage"), false);
  assert.equal(wantsOutputFrameFromSearch("?frame=workspace"), true);
  assert.equal(wantsOutputFrameFromSearch("?frame=legacy"), true);
  assert.equal(wantsOutputFrameFromSearch("?audit=1"), true);
  assert.equal(shouldAutoOpenOutputFrameOnCommand(), false);
});

test("Scene stage accepts files and plain text transfers", () => {
  assert.equal(shouldAcceptSceneStageTransfer(["Files"]), true);
  assert.equal(shouldAcceptSceneStageTransfer(["text/plain"]), true);
  assert.equal(shouldAcceptSceneStageTransfer(["application/x-lens-object"]), true);
  assert.equal(shouldAcceptSceneStageTransfer(["application/json"]), false);
});

test("ingested text becomes stage material without a model", () => {
  const item = materialFromIngestedText({
    text: "Plain note for scene upload test.\nSecond paragraph.",
    filename: "note.txt",
    sourceKind: "file",
  });
  assert.equal(item.kind, "text");
  assert.match(item.text, /Plain note/);
  assert.equal(item.provenance.kind, "local-file-drop");
  assert.equal(item.provenance.filename, "note.txt");
  assert.equal(materialFromIngestedText({ text: "   " }), null);
});

test("forming-pearl corpus strips short commands but keeps pasted chat", () => {
  assert.equal(extractFormingPearlCorpus("import this chat and find the pearls that were already forming"), "");
  const pasted = `${"User: Can you summarize this investment memo as an LP briefing?\n\n".repeat(3)}find forming pearls`;
  assert.match(extractFormingPearlCorpus(pasted), /summarize this investment memo/);
});

test("dragging same-scene material moves instead of cloning", () => {
  const move = resolveSceneMaterialDrop({
    source: { id: "m1", sceneId: "scene-a", text: "note" },
    sceneId: "scene-a",
    sceneItemIds: ["m1"],
    worldPoint: { x: 40, y: -12 },
  });
  assert.equal(move.action, "move");
  assert.equal(move.id, "m1");
  assert.deepEqual(move.worldPoint, { x: 40, y: -12 });
});

test("Alt/Option drag of same-scene material explicitly duplicates", () => {
  const dup = resolveSceneMaterialDrop({
    source: { id: "m1", sceneId: "scene-a", text: "note" },
    sceneId: "scene-a",
    sceneItemIds: ["m1"],
    altKey: true,
    worldPoint: { x: 8, y: 8 },
  });
  assert.equal(dup.action, "materialize");
  assert.equal(dup.duplicate, true);
});

test("external material materializes once; semantic orbs are not cloned as materials", () => {
  const external = resolveSceneMaterialDrop({
    source: { id: "ctx-1", text: "from companion" },
    sceneId: "scene-a",
    sceneItemIds: [],
    worldPoint: { x: 0, y: 0 },
  });
  assert.equal(external.action, "materialize");
  assert.equal(external.duplicate, false);
  const orb = resolveSceneMaterialDrop({
    source: { kind: "semantic-orb", id: "orb-1", representation: { kind: "function" } },
    sceneId: "scene-a",
    sceneItemIds: [],
  });
  assert.equal(orb.action, "ignore");
});

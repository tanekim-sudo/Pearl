import test from "node:test";
import assert from "node:assert/strict";
import {
  activatePearlCanvas,
  bindPearlCanvasContext,
  canonicalPageIdentity,
  createPearlCanvasArtifact,
  deactivatePearlCanvas,
  deletePearlCanvasArtifacts,
  emptyPearlPageCanvas,
  normalizePearlPageCanvas,
  PEARL_CANVAS_QUOTAS,
  pearlCanvasKey,
  selectPearlCanvasArtifacts,
  setPearlCanvasDestination,
  setPearlCanvasMode,
  undoPearlCanvas,
  updatePearlCanvasArtifact,
} from "./pearl-page-canvas.js";

test("canonical page identity excludes queries, fragments, and protected schemes", () => {
  assert.equal(canonicalPageIdentity("https://example.test/path/?token=secret#private"), "https://example.test/path");
  assert.throws(() => canonicalPageIdentity("chrome://settings"), /protected browser pages/);
});

test("Pearl and page keys isolate canvas state without duplication", () => {
  const page = canonicalPageIdentity("https://example.test/article");
  assert.notEqual(pearlCanvasKey("pearl-a", page), pearlCanvasKey("pearl-b", page));
  assert.notEqual(pearlCanvasKey("pearl-a", page), pearlCanvasKey("pearl-a", canonicalPageIdentity("https://example.test/other")));
  let left = activatePearlCanvas(emptyPearlPageCanvas({ pearlId: "pearl-a", pageIdentity: page }));
  const right = emptyPearlPageCanvas({ pearlId: "pearl-b", pageIdentity: page });
  left = createPearlCanvasArtifact(left, { id: "text-a", type: "text", text: "private a", box: { x: 10, y: 20, width: 200, height: 80 } });
  assert.equal(left.artifacts.length, 1);
  assert.equal(right.artifacts.length, 0);
  assert.equal(createPearlCanvasArtifact(left, left.artifacts[0]).artifacts.length, 1);
});

test("all input modes preserve native pass-through as the safe resting mode", () => {
  let state = emptyPearlPageCanvas({ pearlId: "p", pageIdentity: "https://example.test/" });
  for (const mode of ["select-type", "pen", "highlighter", "eraser", "lasso", "image", "dom-select", "voice"]) {
    state = setPearlCanvasMode(state, mode);
    assert.equal(state.active, true);
    assert.equal(state.mode, mode);
  }
  state = deactivatePearlCanvas(state);
  assert.equal(state.active, false);
  assert.equal(state.mode, "native");
});

test("artifact edits, selection, context, destinations, deletion, and undo checkpoint exactly", () => {
  let state = activatePearlCanvas(emptyPearlPageCanvas({ pearlId: "p", pageIdentity: "https://example.test/" }));
  state = createPearlCanvasArtifact(state, { id: "box", type: "text", text: "", box: { x: 4, y: 8, width: 120, height: 60 } });
  state = updatePearlCanvasArtifact(state, "box", { text: "streamed result", box: { x: 12, y: 18, width: 240, height: 90 } });
  state = selectPearlCanvasArtifacts(state, ["box"]);
  state = bindPearlCanvasContext(state, [{ id: "ink-ctx", kind: "ink", ref: "box", summary: "user ink", provenance: { local: true } }]);
  state = setPearlCanvasDestination(state, { type: "canvas-textbox", targetId: "box" });
  const beforeDelete = structuredClone(state);
  state = deletePearlCanvasArtifacts(state, ["box"]);
  assert.equal(state.artifacts.length, 0);
  state = undoPearlCanvas(state);
  assert.deepEqual(state.artifacts, beforeDelete.artifacts);
  assert.equal(state.destination.targetId, "box");
  assert.equal(state.context[0].provenance.local, true);
});

test("canvas quotas reject oversized point, artifact, byte, and inline-image payloads recoverably", () => {
  const base = emptyPearlPageCanvas({ pearlId: "quota", pageIdentity: "https://example.test/" });
  const points = Array.from({ length: 20_000 }, (_, index) => ({ x: index, y: index }));
  assert.throws(() => normalizePearlPageCanvas({
    ...base,
    artifacts: Array.from({ length: 6 }, (_, index) => ({ id: `ink-${index}`, type: "ink", points })),
  }), (error) => error.code === "PEARL_CANVAS_QUOTA" && error.recoverable);
  assert.throws(() => normalizePearlPageCanvas({
    ...base,
    artifacts: Array.from({ length: PEARL_CANVAS_QUOTAS.artifacts + 1 }, (_, index) => ({ id: `text-${index}`, type: "text" })),
  }), /artifact quota/);
  assert.throws(() => createPearlCanvasArtifact(base, {
    id: "inline-image",
    type: "image",
    source: `data:image/png;base64,${"A".repeat(1_000)}`,
  }), /content-addressed/);
});

test("checkpoints use deduplicated artifact references and stay within budget", () => {
  let state = emptyPearlPageCanvas({ pearlId: "history", pageIdentity: "https://example.test/" });
  state = createPearlCanvasArtifact(state, { id: "note", type: "text", text: "a" });
  for (let index = 0; index < 30; index += 1) {
    state = updatePearlCanvasArtifact(state, "note", { text: `revision ${index}` });
  }
  assert.equal(state.checkpoints.length, PEARL_CANVAS_QUOTAS.checkpoints);
  assert.ok(state.checkpoints.every((entry) => Array.isArray(entry.artifactRefs) && !("artifacts" in entry)));
  assert.ok(Object.keys(state.artifactSnapshots).length <= PEARL_CANVAS_QUOTAS.checkpoints);
});

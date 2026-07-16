import test from "node:test";
import assert from "node:assert/strict";

import { avoidOverlaps, layoutObjects } from "./companion-geometry.js";
import { nearestMergeTarget, updateMergeProximity } from "./merge-proximity.js";

const objects = Array.from({ length: 100 }, (_, index) => ({
  id: `item-${index}`,
  x: 0,
  y: 0,
  width: 100,
  height: 50,
}));

test("grid layout handles one hundred objects deterministically", () => {
  const first = layoutObjects(objects, "grid", { columns: 10, gap: 10, anchor: { x: 20, y: 30 } });
  const second = layoutObjects(objects, "grid", { columns: 10, gap: 10, anchor: { x: 20, y: 30 } });
  assert.deepEqual(first, second);
  assert.deepEqual(first[0], { id: "item-0", x: 20, y: 30 });
  assert.deepEqual(first[11], { id: "item-11", x: 130, y: 90 });
});

test("stack/distribute preserve order and overlap repair separates collisions", () => {
  const stack = layoutObjects(objects.slice(0, 3), "stack", { gap: 5 });
  assert.deepEqual(stack.map((entry) => entry.y), [0, 55, 110]);
  const repaired = avoidOverlaps(
    [
      { id: "item-0", x: 0, y: 0 },
      { id: "item-1", x: 0, y: 0 },
    ],
    objects,
    { gap: 10 }
  );
  assert.equal(repaired[1].y, 60);
});

test("Merge proximity is screen-space stable across zoom and requires dwell with hysteresis", () => {
  const viewport = { left: 100, top: 50 };
  const nodes = [{ id: "a", x: 0, y: 0 }, { id: "b", x: 100, y: 100 }];
  for (const scale of [0.25, 1, 4]) {
    const camera = { x: 10, y: 20, scale };
    const pointer = { x: viewport.left + nodes[1].x * scale + camera.x + 60, y: viewport.top + nodes[1].y * scale + camera.y };
    assert.equal(nearestMergeTarget("a", pointer, nodes, camera, viewport)?.id, "b");
  }
  let state = updateMergeProximity({}, { candidateId: "b", distancePx: 60 }, 1000);
  assert.equal(state.armed, false);
  state = updateMergeProximity(state, { candidateId: "b", distancePx: 80 }, 1500);
  assert.equal(state.armed, true);
  state = updateMergeProximity(state, { candidateId: "b", distancePx: 97 }, 1600);
  assert.equal(state.armed, false);
});

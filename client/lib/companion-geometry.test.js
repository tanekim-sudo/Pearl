import test from "node:test";
import assert from "node:assert/strict";

import { avoidOverlaps, layoutObjects } from "./companion-geometry.js";

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

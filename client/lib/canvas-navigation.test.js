import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyWheelToCamera,
  isWheelZoomGesture,
  wheelPanDelta,
  wheelZoomFactor,
} from "./canvas-navigation.js";

describe("canvas-navigation", () => {
  const camera = { x: 100, y: 50, scale: 1 };

  it("detects pinch / modifier zoom gestures", () => {
    assert.equal(isWheelZoomGesture({ ctrlKey: true }), true);
    assert.equal(isWheelZoomGesture({ metaKey: true }), true);
    assert.equal(isWheelZoomGesture({ ctrlKey: false, metaKey: false }), false);
  });

  it("maps plain wheel to pan deltas", () => {
    assert.deepEqual(wheelPanDelta({ deltaX: 12, deltaY: -8 }), { dx: -12, dy: 8 });
  });

  it("plain wheel pans the camera", () => {
    const next = applyWheelToCamera(
      { deltaX: 10, deltaY: 0, ctrlKey: false, metaKey: false },
      camera,
      200,
      150
    );
    assert.equal(next.x, 90);
    assert.equal(next.y, 50);
    assert.equal(next.scale, 1);
  });

  it("ctrl+wheel zooms toward the cursor", () => {
    const next = applyWheelToCamera(
      { deltaY: -100, ctrlKey: true, metaKey: false },
      camera,
      200,
      150
    );
    assert.ok(next.scale > 1);
    assert.notEqual(next.x, 100);
  });

  it("wheelZoomFactor shrinks on positive deltaY", () => {
    assert.ok(wheelZoomFactor({ deltaY: 120 }) < 1);
    assert.ok(wheelZoomFactor({ deltaY: -120 }) > 1);
  });
});

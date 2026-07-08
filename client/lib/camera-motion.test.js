import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  lerp,
  easeInOutCubic,
  compensateCameraForViewportResize,
} from "./camera-motion.js";

describe("camera-motion", () => {
  it("lerps values", () => {
    assert.equal(lerp(0, 10, 0.5), 5);
  });

  it("eases in and out", () => {
    assert.equal(easeInOutCubic(0), 0);
    assert.equal(easeInOutCubic(1), 1);
    assert.ok(easeInOutCubic(0.5) > 0.4 && easeInOutCubic(0.5) < 0.6);
  });

  it("preserves world center when viewport resizes", () => {
    const cam = { x: 100, y: 80, scale: 1 };
    const next = compensateCameraForViewportResize(cam, 400, 300, 500, 300);
    const worldX = (400 / 2 - cam.x) / cam.scale;
    const screenX = worldX * next.scale + next.x;
    assert.equal(screenX, 500 / 2);
  });
});

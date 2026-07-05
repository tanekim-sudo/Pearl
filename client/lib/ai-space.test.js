import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_CONSTELLATION_SCALE,
  EXPLORE_ZOOM_SCALE,
  computeNodesBBox,
  fitAiConstellation,
  focusAiNode,
} from "./ai-space.js";

describe("ai-space", () => {
  it("computeNodesBBox includes node radii", () => {
    const bb = computeNodesBBox([
      { x: 100, y: 100, radius: 20 },
      { x: 400, y: 300, radius: 22 },
    ]);
    assert.equal(bb.minX, 80);
    assert.equal(bb.minY, 80);
    assert.equal(bb.maxX, 422);
    assert.equal(bb.maxY, 322);
  });

  it("fitAiConstellation uses low default scale for sparse graphs", () => {
    const cam = fitAiConstellation(
      [{ x: 0, y: 0, radius: 20 }, { x: 500, y: 400, radius: 20 }],
      400,
      300
    );
    assert.ok(cam.scale <= DEFAULT_CONSTELLATION_SCALE);
    assert.ok(cam.scale >= 0.12);
  });

  it("fitAiConstellation centers empty viewport at default scale", () => {
    const cam = fitAiConstellation([], 320, 240);
    assert.equal(cam.scale, DEFAULT_CONSTELLATION_SCALE);
    assert.equal(cam.x, 160);
    assert.equal(cam.y, 120);
  });

  it("focusAiNode centers node at exploration scale", () => {
    const node = { x: 200, y: 150, radius: 20 };
    const cam = focusAiNode(node, 400, 300, EXPLORE_ZOOM_SCALE);
    assert.equal(cam.scale, EXPLORE_ZOOM_SCALE);
    assert.equal(cam.x, 400 / 2 - 200 * EXPLORE_ZOOM_SCALE);
    assert.equal(cam.y, 300 / 2 - 150 * EXPLORE_ZOOM_SCALE);
  });
});

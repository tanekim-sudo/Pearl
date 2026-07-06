import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_CONSTELLATION_SCALE,
  EXPLORE_ZOOM_SCALE,
  AI_BLEND_ZOOM_START,
  AI_READING_ZOOM,
  AI_TEXT_ZOOM_FULL,
  computeNodesBBox,
  fitAiConstellation,
  fitTextFontSize,
  focusAiNode,
  focusAiNodeRead,
  nodeTextLayout,
  nodeTextLayoutAtBlend,
  zoomContentBlend,
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

  it("zoomContentBlend is zero in constellation and one at text zoom", () => {
    assert.equal(zoomContentBlend(AI_BLEND_ZOOM_START - 0.01), 0);
    assert.equal(zoomContentBlend(AI_TEXT_ZOOM_FULL), 1);
    const mid = zoomContentBlend((AI_BLEND_ZOOM_START + AI_TEXT_ZOOM_FULL) / 2);
    assert.ok(mid > 0.4 && mid < 0.6);
  });

  it("nodeTextLayout scales with node radius and text length", () => {
    const small = nodeTextLayout(20, 300);
    const big = nodeTextLayout(40, 300);
    assert.ok(big.w > small.w);
    assert.ok(big.h >= small.h);
    assert.ok(small.w >= 148);
    assert.equal(small.anchorY, -20);
  });

  it("fitTextFontSize shrinks for longer responses within bounds", () => {
    const short = fitTextFontSize(148, 60, 20);
    const long = fitTextFontSize(148, 5000, 20);
    assert.ok(short > long);
    assert.ok(long >= 4.6);
    assert.ok(short <= 9.5);
  });

  it("nodeTextLayoutAtBlend grows from inside the circle to full layout", () => {
    const inner = nodeTextLayoutAtBlend(20, 400, 0);
    const full = nodeTextLayoutAtBlend(20, 400, 1);
    assert.ok(full.w > inner.w);
    assert.ok(full.h > inner.h);
    assert.ok(full.fontSize > inner.fontSize);
  });

  it("focusAiNodeRead frames full text from the top", () => {
    const node = { x: 100, y: 50, radius: 30 };
    const layout = nodeTextLayout(30, 300);
    const cam = focusAiNodeRead(node, layout, 800, 600);
    assert.ok(Math.abs(node.x * cam.scale + cam.x - 400) < 1);
    const topY = (node.y + layout.anchorY) * cam.scale + cam.y;
    assert.ok(Math.abs(topY - 44) < 1);
    assert.ok(cam.scale <= AI_READING_ZOOM);
    const screenH = layout.h * cam.scale;
    assert.ok(screenH <= 600 * 0.92 + 1);
    assert.equal(zoomContentBlend(cam.scale), 1);
  });
});

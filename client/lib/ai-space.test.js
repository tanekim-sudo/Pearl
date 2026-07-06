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
  fitCardFontSize,
  focusAiNode,
  focusAiNodeCard,
  nodeCardLayout,
  readingCardForNode,
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

  it("nodeCardLayout scales the card with node radius", () => {
    const small = nodeCardLayout(20, 300);
    const big = nodeCardLayout(40, 300);
    assert.ok(big.w > small.w);
    assert.ok(big.h > small.h);
    assert.ok(small.w >= 110);
    assert.ok(small.h >= 84);
  });

  it("fitCardFontSize shrinks for longer responses within bounds", () => {
    const short = fitCardFontSize(120, 90, 60);
    const long = fitCardFontSize(120, 90, 5000);
    assert.ok(short > long);
    assert.ok(long >= 4.2);
    assert.ok(short <= 9);
    assert.equal(fitCardFontSize(120, 90, 0), 7);
  });

  it("readingCardForNode keeps a readable screen font at reading zoom", () => {
    const card = readingCardForNode(800, 600, "x".repeat(4000));
    assert.equal(card.targetScale, AI_READING_ZOOM);
    assert.ok(Math.abs(card.fontSize * card.targetScale - 15) < 0.05);
    assert.ok(card.w * card.targetScale <= 800 * 0.84);
  });

  it("focusAiNodeCard frames the card from the top like a chat message", () => {
    const node = { x: 100, y: 50, radius: 30 };
    const card = readingCardForNode(800, 600, "x".repeat(300));
    const cam = focusAiNodeCard(node, card, 800, 600);
    // node horizontally centered
    assert.ok(Math.abs(node.x * cam.scale + cam.x - 400) < 1);
    // card top sits at the top margin
    const topY = (node.y - card.h / 2) * cam.scale + cam.y;
    assert.ok(Math.abs(topY - 48) < 1);
    assert.equal(cam.scale, AI_READING_ZOOM);
    // deep zoom → text fully blended in
    assert.equal(zoomContentBlend(cam.scale), 1);
  });
});

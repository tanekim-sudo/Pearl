import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PAPER_WIDTH,
  PAPER_HEIGHT,
  PAPER_MARGIN,
  clampToPaper,
  clampTextWidth,
  bboxClampOffset,
  clampItemToPaper,
  fitPaperInView,
  maxTextWidth,
} from "./paper.js";

describe("paper bounds", () => {
  it("clamps coordinates inside paper", () => {
    assert.deepEqual(clampToPaper(-10, 2000), { x: 0, y: PAPER_HEIGHT });
    assert.deepEqual(clampToPaper(100, 100, PAPER_MARGIN), { x: 100, y: 100 });
  });

  it("limits text width to paper minus margins", () => {
    assert.equal(maxTextWidth(), PAPER_WIDTH - PAPER_MARGIN * 2);
    assert.equal(clampTextWidth(900), maxTextWidth());
    assert.equal(clampTextWidth(80), 120);
  });

  it("computes bbox clamp offset", () => {
    const off = bboxClampOffset({ minx: -20, miny: 10, maxx: 800, maxy: 50 });
    assert.equal(off.dx, PAPER_WIDTH - PAPER_MARGIN - 800);
    assert.equal(off.dy, PAPER_MARGIN - 10);
  });

  it("moves text items back onto the page", () => {
    const item = { type: "text", x: -40, y: 20, w: 200, text: "hello" };
    const bb = (it) => ({ minx: it.x, miny: it.y, maxx: it.x + it.w, maxy: it.y + 40 });
    const clamped = clampItemToPaper(item, bb);
    assert.ok(clamped.x >= PAPER_MARGIN);
  });

  it("clamps text width and x so content stays on the page", () => {
    const item = { type: "text", x: 700, y: 10, w: 900, text: "wide" };
    const bb = (it) => ({ minx: it.x, miny: it.y, maxx: it.x + it.w, maxy: it.y + 40 });
    const clamped = clampItemToPaper(item, bb);
    assert.equal(clamped.w, maxTextWidth());
    assert.ok(clamped.x + clamped.w <= PAPER_WIDTH - PAPER_MARGIN);
  });

  it("fitPaperInView centers the sheet", () => {
    const cam = fitPaperInView(900, 1200);
    assert.ok(cam.scale > 0 && cam.scale <= 1);
    assert.ok(cam.x > 0);
    assert.ok(cam.y > 0);
  });
});

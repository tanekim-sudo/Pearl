import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  clampColumnLayout,
  layoutAfterResizeDrag,
  MIN_COLUMN_W,
  MIN_PAPER_W,
  BOUNDARY_W,
} from "./column-layout.js";

describe("column-layout", () => {
  it("clamps side columns and preserves minimum paper width", () => {
    const grid = 1200;
    const next = clampColumnLayout({ left: 900, right: 900 }, grid);
    const paper = grid - next.left - next.right - BOUNDARY_W * 2;
    assert.ok(paper >= MIN_PAPER_W);
    assert.ok(next.left >= MIN_COLUMN_W);
    assert.ok(next.right >= MIN_COLUMN_W);
  });

  it("resizes left column when dragging the tools-paper seam", () => {
    const start = { left: 280, right: 340 };
    const next = layoutAfterResizeDrag("left", 100, 140, start);
    assert.equal(next.left, 320);
    assert.equal(next.right, 340);
  });

  it("resizes right column inversely when dragging the paper-ai seam", () => {
    const start = { left: 280, right: 340 };
    const next = layoutAfterResizeDrag("right", 100, 140, start);
    assert.equal(next.left, 280);
    assert.equal(next.right, 300);
  });
});

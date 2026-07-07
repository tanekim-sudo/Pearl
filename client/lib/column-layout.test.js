import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  clampColumnLayout,
  layoutAfterResizeDrag,
  snapColumnWidth,
  BOUNDARY_W,
} from "./column-layout.js";

describe("column-layout", () => {
  it("allows columns to collapse to zero width", () => {
    const next = clampColumnLayout({ left: 20, right: 340 }, 1200);
    assert.equal(next.left, 0);
    assert.ok(next.right >= 0);
  });

  it("fits both side columns within the grid", () => {
    const grid = 1200;
    const next = clampColumnLayout({ left: 900, right: 900 }, grid);
    const paper = grid - next.left - next.right - BOUNDARY_W * 2;
    assert.ok(paper >= 0);
    assert.ok(next.left >= 0);
    assert.ok(next.right >= 0);
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

  it("snaps narrow columns closed", () => {
    assert.equal(snapColumnWidth(0), 0);
    assert.equal(snapColumnWidth(30), 0);
    assert.equal(snapColumnWidth(80), 80);
  });
});

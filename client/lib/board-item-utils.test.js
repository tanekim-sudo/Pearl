import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  blockOriginAtPointer,
  blockOriginAtViewportCenter,
  TEXT_BOX_DEFAULT_W,
} from "./board-item-utils.js";

describe("board-item-utils placement", () => {
  it("anchors text top-left at pointer", () => {
    const o = blockOriginAtPointer("text", { x: 120, y: 80 });
    assert.equal(o.x, 120);
    assert.equal(o.y, 80);
    assert.equal(o.w, TEXT_BOX_DEFAULT_W);
  });

  it("anchors sticky top-left at pointer", () => {
    const o = blockOriginAtPointer("sticky", { x: 50, y: 60 });
    assert.equal(o.x, 50);
    assert.equal(o.y, 60);
  });

  it("centers diagram on viewport center", () => {
    const o = blockOriginAtViewportCenter("diagram", { x: 400, y: 300 });
    assert.ok(o.x < 400);
    assert.ok(o.y < 300);
  });
});

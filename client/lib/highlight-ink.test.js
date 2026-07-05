import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { itemsFromHighlightGesture, itemsTouchedByHighlightPath } from "./highlight-ink.js";

describe("highlight-ink selection", () => {
  const items = [
    { id: "a", type: "stroke", points: [{ x: 10, y: 10 }, { x: 50, y: 10 }] },
    { id: "b", type: "stroke", points: [{ x: 200, y: 200 }, { x: 240, y: 200 }] },
    { id: "c", type: "text", x: 10, y: 80, w: 120, text: "hello" },
  ];

  const worldToClient = (x, y) => ({ x, y });
  const blockWidth = (it) => it.w || 360;
  const itemHeight = () => 40;

  it("selects disconnected strokes touched along a path", () => {
    const points = [
      { x: 30, y: 10 },
      { x: 220, y: 200 },
    ];
    const hits = itemsTouchedByHighlightPath(points, 1, items, worldToClient, blockWidth, itemHeight);
    assert.ok(hits.includes("a"));
    assert.ok(hits.includes("b"));
  });

  it("merges path hits in itemsFromHighlightGesture", () => {
    const points = [{ x: 15, y: 85 }, { x: 25, y: 90 }];
    const hits = itemsFromHighlightGesture(points, 1, items, worldToClient, blockWidth, itemHeight, {
      isTransformableBlock: (it) => it.type === "text",
    });
    assert.ok(hits.includes("c"));
  });
});

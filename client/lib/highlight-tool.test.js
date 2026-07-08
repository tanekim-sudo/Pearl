import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  aiNodeHighlightDraggable,
  aiNodeHighlightMarkable,
  aiNodeTransferText,
  highlightTransferPreview,
  isHighlightTool,
} from "./highlight-tool.js";

describe("highlight-tool", () => {
  it("isHighlightTool recognizes the highlight utensil", () => {
    assert.equal(isHighlightTool("highlight"), true);
    assert.equal(isHighlightTool("select"), false);
  });

  it("aiNodeTransferText prefers golden fragment", () => {
    const node = {
      goldenFragment: "key insight",
      expandedText: "long body",
      preview: "short",
    };
    assert.equal(aiNodeTransferText(node), "key insight");
    assert.equal(aiNodeTransferText(node, "override"), "override");
  });

  it("aiNodeHighlightDraggable requires transferable text", () => {
    assert.equal(aiNodeHighlightDraggable({ expandedText: "hello" }), true);
    assert.equal(aiNodeHighlightDraggable({ label: "x" }), true);
    assert.equal(aiNodeHighlightDraggable({ loading: true }), false);
  });

  it("aiNodeHighlightMarkable needs expanded text and some zoom blend", () => {
    const node = { expandedText: "readable" };
    assert.equal(aiNodeHighlightMarkable(node, 0), false);
    assert.equal(aiNodeHighlightMarkable(node, 0.2), true);
    assert.equal(aiNodeHighlightMarkable({ preview: "x" }, 1), false);
  });

  it("highlightTransferPreview clips long strings", () => {
    const long = "a".repeat(220);
    const preview = highlightTransferPreview({ text: long, count: 2 });
    assert.ok(preview.length < 200);
    assert.ok(preview.includes("(+1)"));
  });
});

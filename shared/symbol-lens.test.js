import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractSymbolObjects,
  interpretSymbolStructural,
  viewingLensTreeFromSymbol,
  mergeSymbolInterpretation,
  normalizeSymbolRecord,
} from "./symbol-lens.js";

describe("symbol-lens", () => {
  it("describes a single object directly", () => {
    const t = interpretSymbolStructural({
      title: "Garden frame",
      items: [{ type: "text", text: "monastery courtyard as living system" }],
    });
    assert.match(t.meaning, /monastery courtyard/i);
    assert.equal(t.pattern, "single-object");
  });

  it("surfaces similarities across multiple objects", () => {
    const t = interpretSymbolStructural({
      title: "Systems",
      items: [
        { type: "text", text: "forest ecosystem feedback loops" },
        { type: "text", text: "market ecosystem feedback cycles" },
      ],
    });
    assert.match(t.meaning, /2 related objects/i);
    assert.match(t.meaning, /ecosystem|feedback/i);
    assert.equal(t.pattern, "multi-object-pattern");
  });

  it("extracts symbol surface objects", () => {
    const objects = extractSymbolObjects({
      items: [
        { type: "text", text: "alpha" },
        { type: "image" },
      ],
      symbolStroke: { points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
    });
    assert.equal(objects.length, 3);
  });

  it("merges LLM interpretation", () => {
    const base = interpretSymbolStructural({ title: "x", items: [] });
    const merged = mergeSymbolInterpretation(base, {
      meaning: "Sees organic growth patterns",
      viewPrompt: "Apply garden metaphor to material.",
    });
    assert.match(merged.meaning, /organic/i);
    assert.match(merged.viewPrompt, /garden/i);
  });

  it("builds viewing lens tree", () => {
    const tree = viewingLensTreeFromSymbol({
      title: "Investment frame",
      interpretation: { meaning: "PE thesis", viewPrompt: "Build thesis for entity." },
    });
    assert.ok(tree.name);
    assert.equal(tree.prompt, "Build thesis for entity.");
  });

  it("normalizes symbols without interpretation", () => {
    const s = normalizeSymbolRecord({
      kind: "symbol",
      title: "Note",
      items: [{ type: "text", text: "one clear idea" }],
    });
    assert.ok(s.interpretation?.meaning);
    assert.ok(s.viewLens?.prompt);
  });
});

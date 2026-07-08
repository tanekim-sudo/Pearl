import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  interpretSymbolStructural,
  viewingLensTreeFromSymbol,
  mergeSymbolInterpretation,
} from "./symbol-lens.js";

describe("symbol-lens", () => {
  it("builds structural interpretation from symbol items", () => {
    const t = interpretSymbolStructural({
      title: "Garden frame",
      items: [{ type: "text", text: "monastery courtyard as living system" }],
    });
    assert.ok(t.meaning);
    assert.ok(t.viewPrompt);
    assert.equal(t.portableMeta.title, "Garden frame");
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
});

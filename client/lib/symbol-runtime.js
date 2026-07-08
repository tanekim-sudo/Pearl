/**
 * Symbol interpretation and viewing-lens runtime.
 */

import {
  buildSymbolInterpretPrompt,
  interpretSymbolStructural,
  mergeSymbolInterpretation,
  viewingLensTreeFromSymbol,
} from "../../shared/symbol-lens.js";

function parseJsonFromModel(raw) {
  const text = (raw || "").trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() || text;
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(candidate.slice(start, end + 1));
    return null;
  }
}

/** Enrich a saved symbol with AI interpretation + default viewing lens. */
export async function interpretSymbolWithLLM(struct, runClaude, opts = {}) {
  const structural = interpretSymbolStructural(struct);
  if (!runClaude) {
    return {
      interpretation: structural,
      viewLens: viewingLensTreeFromSymbol({ ...struct, interpretation: structural }),
    };
  }
  try {
    const out = await runClaude(buildSymbolInterpretPrompt(struct), "", {
      system:
        "You interpret visual/text symbols for a thinking canvas. Output ONLY valid JSON. The viewPrompt must work on any new material.",
      maxTokens: opts.maxTokens || 2048,
    });
    const json = parseJsonFromModel(out);
    const interpretation = mergeSymbolInterpretation(structural, json);
    return {
      interpretation,
      viewLens: viewingLensTreeFromSymbol({ ...struct, interpretation }),
    };
  } catch {
    return {
      interpretation: structural,
      viewLens: viewingLensTreeFromSymbol({ ...struct, interpretation: structural }),
    };
  }
}

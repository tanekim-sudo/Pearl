/**
 * Symbol viewing lens — portable metadata + consistent re-application.
 */

export const SYMBOL_LENS_VERSION = 1;

/** Rule-based symbol reading when LLM is unavailable. */
export function interpretSymbolStructural(struct) {
  const texts = (struct?.items || [])
    .filter((it) => it.type === "text" && it.text?.trim())
    .map((it) => it.text.trim());
  const sample = texts.join(" ").slice(0, 400);
  const words = sample.split(/\s+/).filter((w) => w.length > 2);
  const title = struct?.title || words.slice(0, 4).join(" ") || "pattern";

  return {
    v: SYMBOL_LENS_VERSION,
    meaning: `A reusable pattern: ${title}`,
    pattern: "material-template",
    roles: words.length ? [{ role: "subject", exemplar: words[0] }] : [],
    viewPrompt: `Read the material through the lens of “${title}”. Preserve structure, swap content to fit the new subject. Return ONLY the transformed material.`,
    portableMeta: {
      title,
      itemCount: struct?.items?.length || 0,
      hasGlyph: !!struct?.symbolStroke,
      samplePreview: sample.slice(0, 120),
    },
  };
}

export function buildSymbolInterpretPrompt(struct) {
  const texts = (struct?.items || [])
    .filter((it) => it.type === "text" && it.text?.trim())
    .map((it) => it.text.slice(0, 300));
  const glyph = struct?.symbolStroke ? "has hand-drawn glyph" : "no glyph";
  return `Analyze this symbol/template and return JSON only:
{
  "meaning": "one sentence: what idea pattern this encodes",
  "pattern": "relational pattern label (e.g. metaphor-frame, checklist, comparison)",
  "roles": [{ "role": "semantic role", "exemplar": "example from source" }],
  "viewPrompt": "full prompt to re-apply this way of seeing to NEW material — same effect every time"
}

Symbol title: ${struct?.title || "untitled"}
Glyph: ${glyph}
Material samples:
${texts.map((t, i) => `${i + 1}. ${t}`).join("\n") || "(visual only)"}`;
}

export function mergeSymbolInterpretation(structural, llmJson) {
  if (!llmJson || typeof llmJson !== "object") return structural;
  return {
    ...structural,
    meaning: llmJson.meaning || structural.meaning,
    pattern: llmJson.pattern || structural.pattern,
    roles: llmJson.roles?.length ? llmJson.roles : structural.roles,
    viewPrompt: llmJson.viewPrompt || structural.viewPrompt,
  };
}

/** Default viewing lens tree from interpretation. */
export function viewingLensTreeFromSymbol(struct) {
  const interp = struct?.interpretation || interpretSymbolStructural(struct);
  const name = `see · ${struct?.title || "symbol"}`.slice(0, 48);
  return {
    name,
    description: interp.meaning,
    prompt: interp.viewPrompt,
  };
}

export function normalizeSymbolRecord(struct) {
  if (!struct) return null;
  return {
    ...struct,
    interpretation: struct.interpretation || null,
    viewLens: struct.viewLens || null,
    cognitiveTransfer: struct.cognitiveTransfer || null,
  };
}

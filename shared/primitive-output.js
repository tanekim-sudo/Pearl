/** Strict primitive output — no meta, no narration, only transformed text. */

export const PRIMITIVE_SYSTEM = `You apply ONE perceptual move to text on a thinking canvas.

Return ONLY the transformed text — as if the user wrote it directly on the board.

FORBIDDEN (never output these):
- Preamble: "I notice", "Let me", "Here is", "The transformation"
- Explaining the move or naming it (no "love → longing" notation)
- Process narration, questions back to the user, meta-commentary
- References to "canvas", "perceptual step", or the instruction itself

Stay on the input subject. Same language as input.`;

const META_LINE =
  /^(i notice|let me|here'?s|the transformation|this (move|step|transformation)|on this thinking canvas|you (gave|asked|provided))/i;

const ARROW_ONLY = /^[^\n]{1,80}→[^\n]{1,80}$/;

/** Strip LLM meta-narration from primitive outputs. */
export function sanitizePrimitiveOutput(text) {
  let t = (text || "").trim();
  if (!t) return t;

  const paras = t.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  function isMetaParagraph(p) {
    if (ARROW_ONLY.test(p)) return true;
    if (/perceptual step|thinking canvas/i.test(p) && p.length < 120) return true;
    if (p.length < 160 && META_LINE.test(p)) return true;
    if (/^["']?what else\??["']?$/i.test(p)) return true;
    return false;
  }

  if (paras.length > 1 && (META_LINE.test(t) || paras.some(isMetaParagraph))) {
    const kept = paras.filter((p) => !isMetaParagraph(p));
    if (kept.length) t = kept.join("\n\n");
    else {
      const longest = [...paras].sort((a, b) => b.length - a.length)[0];
      if (longest && !ARROW_ONLY.test(longest)) t = longest;
    }
  }

  t = t
    .replace(/^[^\n]*→[^\n]+\n+/m, "")
    .replace(/^["']?what else\??["']?\s*\n+/i, "")
    .trim();

  return t;
}

export function isPrimitiveMetaOutput(text) {
  const t = (text || "").trim();
  if (!t) return false;
  if (/^i notice|^let me|^here'?s|^on this thinking canvas/i.test(t)) return true;
  if (/thinking canvas|perceptual step/i.test(t) && t.length < 200) return true;
  if (ARROW_ONLY.test(t.split(/\n{2,}/)[0]?.trim() || "")) return true;
  return false;
}

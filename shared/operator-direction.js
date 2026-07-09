/** Perceptual direction — compression (paper/left) vs expansion (AI/right). */

export const COMPRESSION_PRIMITIVE_IDS = new Set(["op-compress", "op-merge"]);

export const EXPANSION_PRIMITIVE_IDS = new Set([
  "op-expand",
  "op-explore",
  "op-research",
  "op-invert",
  "op-reframe",
  "op-transcend",
]);

const COMPRESS_RE =
  /\b(compress|distill\w*|narrow|focus|summar\w*|reduce|simplif\w*|merge|speciali\w*|ground|release|combine|sharpen|condense|trim|tighten|essence|core|abstract|extract)\b/i;

const EXPAND_RE =
  /\b(expand|unfold|elaborat\w*|generaliz\w*|differentiat\w*|split|amplif\w*|invert|flip|reframe|translat\w*|harmoniz\w*|transcend|branch|broaden|extend|counter|explore|research|diverge|multiply|enrich|detail)\b/i;

function textSignals(op) {
  return [op?.name, op?.description, op?.prompt].filter(Boolean).join(" ");
}

/** @returns {'compress'|'expand'} */
export function getOperatorDirection(op) {
  if (!op) return "expand";

  if (op.direction === "compress" || op.direction === "expand") {
    return op.direction;
  }

  if (op.id && COMPRESSION_PRIMITIVE_IDS.has(op.id)) return "compress";
  if (op.id && EXPANSION_PRIMITIVE_IDS.has(op.id)) return "expand";

  const blob = textSignals(op);
  const compressHit = COMPRESS_RE.test(blob);
  const expandHit = EXPAND_RE.test(blob);

  if (compressHit && !expandHit) return "compress";
  if (expandHit && !compressHit) return "expand";
  if (compressHit && expandHit) {
    if (/\b(compress|distill|narrow|reduce|simplif|merge)\b/i.test(blob)) return "compress";
    return "expand";
  }

  return "expand";
}

export function isCompressionOperator(op) {
  return getOperatorDirection(op) === "compress";
}

export function isExpansionOperator(op) {
  return getOperatorDirection(op) === "expand";
}

/** Split a list into compression vs expansion buckets (stable order). */
export function partitionOperatorsByDirection(ops) {
  const compression = [];
  const expansion = [];
  for (const op of ops || []) {
    if (isCompressionOperator(op)) compression.push(op);
    else expansion.push(op);
  }
  return { compression, expansion };
}

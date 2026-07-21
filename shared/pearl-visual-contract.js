import { PHYSICAL_PEARL_CSS, PHYSICAL_PEARL_SIZES, physicalPearlMarkup } from "./physical-pearl.js";

export const PEARL_VISUAL_CONTRACT_VERSION = 1;
export const PEARL_VISUAL_REQUIRED_LAYERS = Object.freeze([
  "contact", "body", "subsurface--far", "nucleus", "subsurface--near", "caustic", "depth",
  "nacre", "environment", "reflection", "rim", "specular", "pinlight",
]);
export const PEARL_VISUAL_FAIL_CONDITIONS = Object.freeze([
  "plain-white-dot",
  "external-glow-or-halo",
  "muddy-idle-miniature",
  "saturated-nacre",
  "heavy-shadow",
  "generic-spinner-or-pulse",
  "competing-rounded-surface",
  "competing-gradient",
  "inconsistent-renderer",
  "missing-focus-or-status-semantics",
]);
export const PEARL_VISUAL_PERFORMANCE_BUDGET = Object.freeze({
  svgElements: 40,
  svgFilters: 1,
  markupBytes: 12_000,
  idleSizeMin: 28,
  idleSizeMax: 36,
  cursorSizeMin: 16,
  cursorSizeMax: 20,
  scaleExcursion: 0.02,
});

function count(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

export function inspectPearlVisualContract(options = {}) {
  const markup = physicalPearlMarkup({ id: "visual-contract", variant: options.variant || "primary", size: options.size || PHYSICAL_PEARL_SIZES.idle, surrounding: options.surrounding || "auto" });
  const missingLayers = PEARL_VISUAL_REQUIRED_LAYERS.filter((layer) => !markup.includes(`physical-pearl__${layer}`));
  const forbidden = [];
  const combined = `${markup}\n${PHYSICAL_PEARL_CSS}`;
  const patterns = [
    ["external-glow-or-halo", /\b(?:glow|halo|aura|bloom|neon|ray)\b|drop-shadow|box-shadow\s*:/i],
    ["generic-spinner-or-pulse", /\b(?:spinner|spin|pulse|confetti|bounce)\b/i],
    ["saturated-nacre", /#(?:ff00|00ff|00ffff|ff00ff|ffff00)/i],
    ["heavy-shadow", /blur\((?:[5-9]|\d{2,})px\)/i],
    ["plain-white-dot", /<circle[^>]+fill=["']#fff(?:fff)?["'][^>]*\/>/i],
  ];
  for (const [failure, pattern] of patterns) if (pattern.test(combined)) forbidden.push(failure);
  const metrics = {
    svgElements: count(markup, /<(?:circle|ellipse|path|g)\b/g),
    svgFilters: count(markup, /<filter\b/g),
    markupBytes: new TextEncoder().encode(markup).byteLength,
  };
  const budgetFailures = [
    metrics.svgElements > PEARL_VISUAL_PERFORMANCE_BUDGET.svgElements && "svg-elements",
    metrics.svgFilters > PEARL_VISUAL_PERFORMANCE_BUDGET.svgFilters && "svg-filters",
    metrics.markupBytes > PEARL_VISUAL_PERFORMANCE_BUDGET.markupBytes && "markup-bytes",
  ].filter(Boolean);
  return {
    version: PEARL_VISUAL_CONTRACT_VERSION,
    valid: !missingLayers.length && !forbidden.length && !budgetFailures.length,
    missingLayers,
    forbidden,
    budgetFailures,
    metrics,
  };
}

export function pearlSurroundingFromColor(rgb = {}) {
  const r = Math.max(0, Math.min(255, Number(rgb.r) || 0));
  const g = Math.max(0, Math.min(255, Number(rgb.g) || 0));
  const b = Math.max(0, Math.min(255, Number(rgb.b) || 0));
  const alpha = rgb.a == null ? 1 : Math.max(0, Math.min(1, Number(rgb.a)));
  if (alpha < 0.2) return "auto";
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max ? (max - min) / max : 0;
  if (saturation > 0.22) return "colored";
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance < 0.42 ? "dark" : "light";
}

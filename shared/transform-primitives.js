/** Transform primitive grammar — single source of truth for toolbox + highlighter. */

import { scaleEta } from "./eta.js";
import { PRIMITIVE_SYSTEM } from "./primitive-output.js";
import { migrateOperatorOutputSpecs } from "./output-specifications.js";

export { PRIMITIVE_SYSTEM };

/** Legacy phase overhead before ETA_SCALE (resolve / research). */
const PRIMITIVE_RESOLVE_ETA_MS = 18000;
const PRIMITIVE_RESEARCH_ETA_MS = 42000;

export const TRANSFORM_PRIMITIVES = [
  {
    id: "op-compress",
    name: "compress",
    kind: "prompt",
    primitive: true,
    primitiveMove: true,
    pair: "detail",
    inverse: "expand",
    resolveWhen: "never",
    researchWhen: "never",
    description: "Smallest invariant core",
    prompt: "Shorter.",
    maxTokens: 600,
    estimatedMs: 12000,
  },
  {
    id: "op-expand",
    name: "expand",
    kind: "prompt",
    primitive: true,
    primitiveMove: true,
    pair: "detail",
    inverse: "compress",
    resolveWhen: "never",
    researchWhen: "never",
    description: "Unfold implications and detail",
    prompt: "Unfold.",
    maxTokens: 1400,
    estimatedMs: 18000,
  },
  {
    id: "op-explore",
    name: "explore",
    kind: "prompt",
    primitive: true,
    primitiveMove: true,
    resolveWhen: "never",
    researchWhen: "never",
    description: "Open adjacent possibilities",
    prompt: "Explore nearby.",
    maxTokens: 1400,
    estimatedMs: 18000,
  },
  {
    id: "op-research",
    name: "research",
    kind: "prompt",
    primitive: true,
    primitiveMove: true,
    resolveWhen: "never",
    researchWhen: "always",
    description: "Ground in facts via web search",
    prompt: "Research and ground.",
    maxTokens: 2048,
    estimatedMs: 42000,
  },
  {
    id: "op-invert",
    name: "invert",
    kind: "prompt",
    primitive: true,
    primitiveMove: true,
    resolveWhen: "never",
    researchWhen: "never",
    description: "Flip polarity or assumption",
    prompt: "Opposite view.",
    maxTokens: 700,
    estimatedMs: 12000,
  },
  {
    id: "op-reframe",
    name: "reframe",
    kind: "prompt",
    primitive: true,
    primitiveMove: true,
    resolveWhen: "never",
    researchWhen: "never",
    description: "Move the vantage point",
    prompt: "Different angle.",
    maxTokens: 800,
    estimatedMs: 12000,
  },
  {
    id: "op-merge",
    name: "merge",
    kind: "prompt",
    primitive: true,
    primitiveMove: true,
    multiInput: true,
    resolveWhen: "never",
    researchWhen: "never",
    description: "Fuse several thoughts into one structure",
    prompt: "Fuse into one structure.",
    maxTokens: 1200,
    estimatedMs: 16000,
  },
  {
    id: "op-transcend",
    name: "transcend",
    kind: "prompt",
    primitive: true,
    primitiveMove: true,
    resolveWhen: "never",
    researchWhen: "never",
    description: "Ascend past a tension",
    prompt: "Past the tension.",
    maxTokens: 900,
    estimatedMs: 14000,
  },
];

export const PRIMITIVE_NAMES = new Set(TRANSFORM_PRIMITIVES.map((p) => p.name));

const LEGACY_DEFAULT_NAMES = new Set([
  "combine",
  "split",
  "sharpen",
  "expand",
  "counter",
  "simplify",
  "generalize",
  "specialize",
  "ground",
  "differentiate",
  "merge",
  "amplify",
  "reduce",
  "translate",
  "harmonize",
  "release",
]);

const SPARSE_CHARS = 500;

export function isSparseMaterial(material) {
  return (material || "").trim().length < SPARSE_CHARS;
}

/** Short notes or named entities that benefit from resolve + research before transforming. */
export function looksLikeEntity(material) {
  const t = (material || "").trim();
  if (!t) return false;
  if (/\b(startup|ai|inc|corp|llc|labs|tech|company|platform|app|sdk|api|saas|vc)\b/i.test(t)) return true;
  return t.split(/\s+/).length <= 8;
}

export function isTransformPrimitive(op) {
  if (!op?.primitive) return false;
  if (op.research || op.role) return false;
  if (op.kind === "pipeline") return false;
  return true;
}

/** @deprecated use isTransformPrimitive */
export function isFastPrimitive(op) {
  return isTransformPrimitive(op);
}

export function primitiveNeedsResolve(op, material) {
  if (!isTransformPrimitive(op)) return false;
  if (op.resolveWhen === "never") return false;
  if (op.resolveWhen === "sparse") return isSparseMaterial(material);
  return false;
}

export function primitiveNeedsResearch(op, material) {
  if (!isTransformPrimitive(op)) return false;
  if (op.researchWhen === "never") return false;
  if (op.researchWhen === "sparse") return isSparseMaterial(material) && looksLikeEntity(material);
  if (op.researchWhen === "always") return true;
  return false;
}

export function estimatePrimitiveMs(op, material) {
  let ms = op.estimatedMs || 15000;
  if (primitiveNeedsResolve(op, material)) ms += PRIMITIVE_RESOLVE_ETA_MS;
  if (primitiveNeedsResearch(op, material)) ms += PRIMITIVE_RESEARCH_ETA_MS;
  return scaleEta(ms);
}

/** Merge saved operators with canonical primitive definitions; keep user role/top functions. */
export function migrateOperatorStore(saved) {
  if (!Array.isArray(saved)) return migrateOperatorOutputSpecs(TRANSFORM_PRIMITIVES.map((p) => ({ ...p })));

  const userOps = saved.filter(
    (o) =>
      (o.move && !o.primitive) ||
      (o.top && !o.move) ||
      o.role ||
      o.captured ||
      (!o.primitive && !o.move && !LEGACY_DEFAULT_NAMES.has(o.name) && !PRIMITIVE_NAMES.has(o.name))
  );

  // Sub-steps of a kept function must survive even when they share a name
  // with a primitive or legacy default (e.g. an "expand" step dragged into a
  // branch) — otherwise the parent pipeline points at missing ids.
  const savedById = Object.fromEntries(saved.map((o) => [o.id, o]));
  const userIds = new Set(userOps.map((o) => o.id));
  const walkUserSteps = (id) => {
    const op = savedById[id];
    if (!op || userIds.has(id)) return;
    userIds.add(id);
    // Canonical / override primitives are re-added below under the same id.
    if (!(op.primitive && PRIMITIVE_NAMES.has(op.name))) userOps.push(op);
    if (op.kind === "pipeline") (op.steps || []).forEach(walkUserSteps);
  };
  for (const o of [...userOps]) {
    if (o.kind === "pipeline") (o.steps || []).forEach(walkUserSteps);
  }

  // Primitives are editable: a saved primitive-flagged op that keeps a
  // canonical name is the user's edit of that primitive — it replaces the
  // built-in. If the edit turned the primitive into a pipeline, keep its
  // whole step subtree alive too.
  const byId = Object.fromEntries(saved.map((o) => [o.id, o]));
  const overrides = saved.filter((o) => o.primitive && !o.role && !o.top && PRIMITIVE_NAMES.has(o.name));
  const overrideByName = new Map(overrides.map((o) => [o.name, o]));
  const keepIds = new Set();
  const walkSteps = (id) => {
    const op = byId[id];
    if (!op || keepIds.has(id)) return;
    keepIds.add(id);
    if (op.kind === "pipeline") (op.steps || []).forEach(walkSteps);
  };
  overrides.forEach((o) => (o.steps || []).forEach(walkSteps));
  const overrideSubtree = saved.filter(
    (o) => keepIds.has(o.id) && !overrideByName.has(o.name) && !userOps.some((u) => u.id === o.id)
  );

  return migrateOperatorOutputSpecs([
    ...TRANSFORM_PRIMITIVES.map((p) => {
      const edited = overrideByName.get(p.name);
      return edited ? { ...edited } : { ...p };
    }),
    ...overrideSubtree,
    ...userOps,
  ]);
}

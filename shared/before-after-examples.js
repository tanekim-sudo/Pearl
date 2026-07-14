import { normalizeOutputSpec, suggestedOutputSpec } from "./output-specifications.js";

export const BEFORE_AFTER_SCHEMA_VERSION = 1;
export const BEFORE_AFTER_LIMITS = Object.freeze({
  examples: 8,
  assetsPerSide: 4,
  textLength: 12_000,
  dataUrlBytes: 1_500_000,
  totalBytes: 6_000_000,
  strokes: 400,
  pointsPerStroke: 2_000,
  depth: 16,
});

const SAFE_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const BLOCKED_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const id = () => globalThis.crypto?.randomUUID?.() || `example-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const clean = (value, max) => String(value || "").trim().slice(0, max);

function assertPlain(value, depth = 0, seen = new WeakSet()) {
  if (depth > BEFORE_AFTER_LIMITS.depth) throw new Error("before/after example is too deeply nested");
  if (value == null || ["string", "number", "boolean"].includes(typeof value)) return;
  if (typeof value !== "object") throw new Error("before/after examples must contain plain data");
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    throw new Error("before/after examples must contain plain data");
  }
  if (seen.has(value)) throw new Error("before/after example contains a cycle");
  seen.add(value);
  for (const key of Object.keys(value)) {
    if (BLOCKED_KEYS.has(key)) throw new Error("before/after example contains an unsafe key");
    assertPlain(value[key], depth + 1, seen);
  }
  seen.delete(value);
}

function normalizeImage(asset = {}) {
  const mime = clean(asset.mime || String(asset.dataUrl || "").match(/^data:([^;,]+)/)?.[1], 80).toLowerCase();
  if (!SAFE_IMAGE_TYPES.has(mime)) throw new Error("Use a PNG, JPEG, or WebP image");
  const dataUrl = clean(asset.dataUrl, BEFORE_AFTER_LIMITS.dataUrlBytes * 2);
  if (!new RegExp(`^data:${mime.replace("+", "\\+")};base64,[a-zA-Z0-9+/=]+$`).test(dataUrl)) {
    throw new Error("Image data is invalid");
  }
  const bytes = Math.ceil((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75);
  if (bytes > BEFORE_AFTER_LIMITS.dataUrlBytes) throw new Error("Each image must be under 1.5 MB");
  const width = Math.max(1, Math.min(2048, Number(asset.width) || 1));
  const height = Math.max(1, Math.min(2048, Number(asset.height) || 1));
  if (width * height > 4_000_000) throw new Error("Image dimensions are too large");
  return { id: clean(asset.id, 100) || id(), kind: "image", mime, dataUrl, width, height, bytes };
}

function normalizeDrawing(asset = {}) {
  const strokes = (Array.isArray(asset.strokes) ? asset.strokes : [])
    .slice(0, BEFORE_AFTER_LIMITS.strokes)
    .map((stroke) => ({
      color: clean(stroke.color, 32) || "#171713",
      width: Math.max(0.5, Math.min(40, Number(stroke.width) || 2)),
      points: (Array.isArray(stroke.points) ? stroke.points : [])
        .slice(0, BEFORE_AFTER_LIMITS.pointsPerStroke)
        .map((point) => ({
          x: Math.max(0, Math.min(1, Number(point.x) || 0)),
          y: Math.max(0, Math.min(1, Number(point.y) || 0)),
          pressure: Math.max(0, Math.min(1, Number(point.pressure) || 0.5)),
        })),
    }))
    .filter((stroke) => stroke.points.length);
  return {
    id: clean(asset.id, 100) || id(),
    kind: "drawing",
    width: Math.max(1, Math.min(2048, Number(asset.width) || 640)),
    height: Math.max(1, Math.min(2048, Number(asset.height) || 360)),
    strokes,
    ...(asset.rasterDataUrl ? { rasterDataUrl: normalizeImage({ dataUrl: asset.rasterDataUrl, mime: "image/png", width: asset.width, height: asset.height }).dataUrl } : {}),
  };
}

export function emptyExample() {
  return {
    id: id(),
    counterexample: false,
    before: { text: "", assets: [], objectRefs: [] },
    after: { text: "", assets: [], objectRefs: [] },
  };
}

export function normalizeExampleSide(raw = {}) {
  const assets = (Array.isArray(raw.assets) ? raw.assets : [])
    .slice(0, BEFORE_AFTER_LIMITS.assetsPerSide)
    .map((asset) => asset?.kind === "drawing" ? normalizeDrawing(asset) : normalizeImage(asset));
  const objectRefs = (Array.isArray(raw.objectRefs) ? raw.objectRefs : [])
    .slice(0, BEFORE_AFTER_LIMITS.assetsPerSide)
    .map((ref) => ({ id: clean(ref?.id, 160), type: clean(ref?.type, 40), label: clean(ref?.label, 160) }))
    .filter((ref) => ref.id);
  return { text: clean(raw.text, BEFORE_AFTER_LIMITS.textLength), assets, objectRefs };
}

export function normalizeBeforeAfterExamples(raw = {}) {
  assertPlain(raw);
  const source = Array.isArray(raw) ? { examples: raw } : raw || {};
  const examples = (Array.isArray(source.examples) ? source.examples : [])
    .slice(0, BEFORE_AFTER_LIMITS.examples)
    .map((example) => ({
      id: clean(example?.id, 100) || id(),
      counterexample: !!example?.counterexample,
      before: normalizeExampleSide(example?.before),
      after: normalizeExampleSide(example?.after),
    }));
  const normalized = {
    version: BEFORE_AFTER_SCHEMA_VERSION,
    private: source.private !== false,
    examples: examples.length ? examples : [emptyExample()],
    updatedAt: Number(source.updatedAt) || Date.now(),
  };
  const bytes = JSON.stringify(normalized).length;
  if (bytes > BEFORE_AFTER_LIMITS.totalBytes) throw new Error("Before/after examples exceed the 6 MB draft limit");
  return normalized;
}

export function validateBeforeAfterExamples(raw, { requireComplete = false } = {}) {
  try {
    const value = normalizeBeforeAfterExamples(raw);
    const complete = value.examples.filter((example) => sideHasContent(example.before) && sideHasContent(example.after));
    if (requireComplete && !complete.length) throw new Error("Add content to both Before and After");
    return { ok: true, value, complete };
  } catch (error) {
    return { ok: false, error: error?.message || "Invalid before/after examples" };
  }
}

export function sideHasContent(side = {}) {
  return !!(clean(side.text, 1) || side.assets?.length || side.objectRefs?.length);
}

export function examplesForPublicExport(operator, { includePrivateExamples = false } = {}) {
  const portable = { ...operator };
  if (portable.learnedFrom?.examples) {
    portable.learnedFrom = includePrivateExamples
      ? { ...portable.learnedFrom, examplesPrivate: false }
      : {
          ...portable.learnedFrom,
          examples: [],
          examplesPrivate: true,
          exampleCount: portable.learnedFrom.exampleCount || portable.learnedFrom.examples.length,
        };
  }
  return portable;
}

export function normalizeInferenceResult(raw = {}) {
  assertPlain(raw);
  const operation = clean(raw.operation || raw.prompt || raw.instructions, 8_000);
  if (!operation) throw new Error("Inference response did not include reusable instructions");
  const fallback = { name: clean(raw.name, 80) || "Learned lens", description: clean(raw.summary, 600), prompt: operation };
  return {
    version: 1,
    name: clean(raw.name, 80) || "Learned lens",
    summary: clean(raw.summary || raw.description, 600),
    operation,
    invariants: (raw.invariants || []).slice(0, 12).map((value) => clean(value, 300)).filter(Boolean),
    changes: (raw.changes || []).slice(0, 12).map((value) => clean(value, 300)).filter(Boolean),
    inputRequirements: (raw.inputRequirements || []).slice(0, 12).map((value) => clean(value, 300)).filter(Boolean),
    outputSpec: normalizeOutputSpec(raw.outputSpec || suggestedOutputSpec(fallback), fallback),
    modality: {
      input: (raw.modality?.input || []).slice(0, 6).map((value) => clean(value, 30)),
      output: (raw.modality?.output || []).slice(0, 6).map((value) => clean(value, 30)),
      constraints: (raw.modality?.constraints || []).slice(0, 8).map((value) => clean(value, 240)),
    },
    confidence: Math.max(0, Math.min(1, Number(raw.confidence) || 0)),
    ambiguity: clean(raw.ambiguity, 600),
    alternatives: (raw.alternatives || []).slice(0, 3).map((alternative) => ({
      name: clean(alternative?.name, 80),
      operation: clean(alternative?.operation, 4_000),
      rationale: clean(alternative?.rationale, 400),
    })).filter((alternative) => alternative.name && alternative.operation),
  };
}

export function inferenceResultToOperator(result, examples, operatorId = id()) {
  const spec = normalizeInferenceResult(result);
  const normalizedExamples = normalizeBeforeAfterExamples(examples);
  return {
    id: operatorId,
    kind: "prompt",
    top: true,
    name: spec.name,
    description: spec.summary,
    prompt: spec.operation,
    outputSpec: { ...spec.outputSpec, mode: "custom" },
    learnedFrom: {
      schemaVersion: BEFORE_AFTER_SCHEMA_VERSION,
      examplesPrivate: true,
      exampleCount: normalizedExamples.examples.length,
      examples: normalizedExamples.examples,
      inference: {
        invariants: spec.invariants,
        changes: spec.changes,
        inputRequirements: spec.inputRequirements,
        modality: spec.modality,
        confidence: spec.confidence,
        ambiguity: spec.ambiguity,
      },
    },
  };
}

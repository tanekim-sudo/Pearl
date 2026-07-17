import { contentFingerprint } from "./lens-grammar.js";

export const LENS_PERCEPTUAL_MODEL_VERSION = 2;
export const LENS_PERCEPTUAL_SECTIONS = Object.freeze([
  "notice",
  "questions",
  "relationships",
  "concepts",
  "assumptions",
  "evidenceStandards",
  "scales",
  "transformations",
  "tensions",
  "blindSpots",
  "counterLenses",
  "preserve",
  "dimensions",
  "preferences",
  "antiPatterns",
  "exceptions",
  "positiveExamples",
  "negativeExamples",
  "pairedExamples",
  "critiques",
  "candidatePreferences",
  "vocabularyPatterns",
]);

const SECTION_SET = new Set(LENS_PERCEPTUAL_SECTIONS);
const BLOCKED_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const MAX_ITEMS = 200;
const MAX_TEXT = 4000;
const MAX_REFS = 100;

function assertPlain(value, path = "perceptualModel", depth = 0, seen = new WeakSet()) {
  if (depth > 20) throw new Error(`${path} exceeds maximum depth`);
  if (value == null || ["string", "number", "boolean"].includes(typeof value)) return;
  if (typeof value !== "object" || value instanceof Date) throw new Error(`${path} must contain plain data`);
  if (seen.has(value)) throw new Error(`${path} contains a cycle`);
  seen.add(value);
  for (const key of Object.keys(value)) {
    if (BLOCKED_KEYS.has(key)) throw new Error(`${path} contains unsafe key`);
    assertPlain(value[key], `${path}.${key}`, depth + 1, seen);
  }
  seen.delete(value);
}

const bounded = (value, max = MAX_TEXT) => String(value ?? "").slice(0, max);
const list = (value, fallback = []) => Array.isArray(value) ? value : value == null ? fallback : [value];
const confidence = (value) => value == null ? null : Math.max(0, Math.min(1, Number(value) || 0));
const evidenceRef = (value = {}) => ({
  sourceId: bounded(value.sourceId || value.id, 256),
  ...(value.range && Number.isInteger(Number(value.range.start)) && Number.isInteger(Number(value.range.end))
    ? { range: { start: Number(value.range.start), end: Number(value.range.end) } }
    : {}),
});

function normalizeFacet(value, section, index) {
  const source = typeof value === "string" ? { text: value } : value || {};
  const text = bounded(source.text ?? source.label ?? source.value ?? source.term).trim();
  const definition = bounded(source.definition ?? source.description).trim();
  if (!text && !definition) return null;
  const idSeed = contentFingerprint({ section, text, definition }).slice(0, 16);
  return {
    id: bounded(source.id || `${section}-${idSeed}`, 256),
    text,
    ...(definition ? { definition } : {}),
    enabled: source.enabled !== false,
    priority: Number.isFinite(Number(source.priority)) ? Number(source.priority) : index,
    confidence: confidence(source.confidence),
    strength: confidence(source.strength ?? source.weight),
    weight: Number.isFinite(Number(source.weight)) ? Math.max(-10, Math.min(10, Number(source.weight))) : 1,
    scope: bounded(source.scope || "", 500) || null,
    conditions: (source.conditions || []).slice(0, 20).map((entry) => bounded(entry, 1000)).filter(Boolean),
    source: source.source ? structuredClone(source.source) : null,
    pair: source.pair ? structuredClone(source.pair) : null,
    userConfirmed: source.userConfirmed === true || source.reviewStatus === "confirmed",
    expiresAt: source.expiresAt || null,
    reviewStatus: ["unreviewed", "confirmed", "rejected"].includes(source.reviewStatus)
      ? source.reviewStatus
      : "unreviewed",
    evidenceRefs: (source.evidenceRefs || []).slice(0, MAX_REFS).map(evidenceRef).filter((ref) => ref.sourceId),
    origin: source.origin === "user" ? "user" : source.origin === "migration" ? "migration" : "inference",
  };
}

export function emptyPerceptualModel() {
  return {
    version: LENS_PERCEPTUAL_MODEL_VERSION,
    sections: Object.fromEntries(LENS_PERCEPTUAL_SECTIONS.map((section) => [section, []])),
    profile: {
      purposes: ["perceptual"],
      domains: [],
      scopes: ["workspace"],
      privacy: { rawExamples: "private", exportDerivedOnly: true },
      contextBudget: 24_000,
      priority: 0,
    },
    inference: null,
    userEditedSections: [],
  };
}

export function normalizePerceptualModel(value = {}, options = {}) {
  assertPlain(value);
  const rawSections = value.sections || value;
  const sections = {};
  for (const section of LENS_PERCEPTUAL_SECTIONS) {
    const list = Array.isArray(rawSections?.[section]) ? rawSections[section] : [];
    sections[section] = list.slice(0, MAX_ITEMS).map((item, index) => normalizeFacet(item, section, index)).filter(Boolean);
  }
  const model = {
    version: LENS_PERCEPTUAL_MODEL_VERSION,
    sections,
    profile: {
      purposes: [...new Set(list(value.profile?.purposes || value.purpose, ["perceptual"])
        .map(String).filter((purpose) => ["perceptual", "taste/judgment", "domain-context", "empty/new-chat"].includes(purpose)))],
      domains: [...new Set(list(value.profile?.domains || value.domains).map((entry) => bounded(entry, 200)).filter(Boolean))].slice(0, 50),
      scopes: [...new Set(list(value.profile?.scopes, ["workspace"]).map((entry) => bounded(entry, 100)).filter(Boolean))].slice(0, 10),
      privacy: {
        rawExamples: ["private", "share-explicitly"].includes(value.profile?.privacy?.rawExamples) ? value.profile.privacy.rawExamples : "private",
        exportDerivedOnly: value.profile?.privacy?.exportDerivedOnly !== false,
      },
      contextBudget: Math.max(0, Math.min(Number(value.profile?.contextBudget) || 24_000, 120_000)),
      priority: Number.isFinite(Number(value.profile?.priority)) ? Number(value.profile.priority) : 0,
      lastRefinedAt: value.profile?.lastRefinedAt || null,
    },
    inference: value.inference ? {
      status: ["provisional", "inferred", "failed"].includes(value.inference.status) ? value.inference.status : "provisional",
      confidence: confidence(value.inference.confidence),
      ambiguity: bounded(value.inference.ambiguity, 2000),
      alternatives: (value.inference.alternatives || []).slice(0, 3).map((entry) => ({
        name: bounded(entry?.name, 160),
        description: bounded(entry?.description, 2000),
        confidence: confidence(entry?.confidence),
      })),
      modelProvenance: value.inference.modelProvenance ? structuredClone(value.inference.modelProvenance) : null,
      inferredAt: Number(value.inference.inferredAt) || null,
    } : null,
    userEditedSections: [...new Set((value.userEditedSections || options.userEditedSections || [])
      .filter((section) => SECTION_SET.has(section)))],
  };
  model.fingerprint = perceptualModelFingerprint(model);
  return model;
}

export function perceptualModelFingerprint(value) {
  const model = value?.sections ? value : normalizePerceptualModel(value);
  return contentFingerprint({
    version: LENS_PERCEPTUAL_MODEL_VERSION,
    profile: model.profile,
    sections: Object.fromEntries(LENS_PERCEPTUAL_SECTIONS.map((section) => [
      section,
      (model.sections[section] || []).map(({ id: _id, confidence: _confidence, origin: _origin, ...facet }) => facet),
    ])),
  });
}

export function applyPerceptualInference(currentValue, inferredValue) {
  const current = normalizePerceptualModel(currentValue);
  const inferred = normalizePerceptualModel(inferredValue);
  const protectedSections = new Set(current.userEditedSections);
  const sections = {};
  const changes = [];
  for (const section of LENS_PERCEPTUAL_SECTIONS) {
    if (protectedSections.has(section)) {
      sections[section] = current.sections[section];
      if (perceptualModelFingerprint({ sections: { [section]: inferred.sections[section] } })
        !== perceptualModelFingerprint({ sections: { [section]: current.sections[section] } })) {
        changes.push({ section, action: "preserved-user-edit", proposed: inferred.sections[section] });
      }
    } else {
      sections[section] = inferred.sections[section];
      changes.push({ section, action: "replace", before: current.sections[section], after: inferred.sections[section] });
    }
  }
  const next = normalizePerceptualModel({
    ...inferred,
    sections,
    userEditedSections: [...protectedSections],
  });
  return { current, proposed: next, changes };
}

export function mergePerceptualModels(values = [], options = {}) {
  const models = values.map((value) => normalizePerceptualModel(value));
  const conflicts = [];
  const sections = {};
  for (const section of LENS_PERCEPTUAL_SECTIONS) {
    const seen = new Map();
    sections[section] = [];
    models.forEach((model, modelIndex) => {
      for (const facet of model.sections[section]) {
        const key = `${facet.text}\n${facet.definition || ""}`.toLocaleLowerCase();
        const opposite = facet.text.replace(/\b(?:not|avoid|exclude)\b/gi, "").trim().toLocaleLowerCase();
        const existingOpposite = sections[section].find((entry) =>
          entry.text.replace(/\b(?:not|avoid|exclude)\b/gi, "").trim().toLocaleLowerCase() === opposite
          && /\b(?:not|avoid|exclude)\b/i.test(entry.text) !== /\b(?:not|avoid|exclude)\b/i.test(facet.text));
        if (existingOpposite) conflicts.push({ section, left: existingOpposite.id, right: facet.id, type: "possible-opposition" });
        if (seen.has(key)) {
          const existing = seen.get(key);
          existing.evidenceRefs = [...existing.evidenceRefs, ...facet.evidenceRefs]
            .filter((ref, index, all) => all.findIndex((entry) => JSON.stringify(entry) === JSON.stringify(ref)) === index)
            .slice(0, MAX_REFS);
          existing.priority = Math.min(existing.priority, modelIndex * 1000 + facet.priority);
          continue;
        }
        const merged = { ...structuredClone(facet), priority: modelIndex * 1000 + facet.priority };
        seen.set(key, merged);
        sections[section].push(merged);
      }
    });
  }
  return {
    model: normalizePerceptualModel({ sections, userEditedSections: options.userEditedSections || [] }),
    conflicts,
  };
}

export function perceptualSummary(value, limit = 4) {
  const model = normalizePerceptualModel(value);
  return model.sections.notice.filter((facet) => facet.enabled && facet.reviewStatus !== "rejected")
    .sort((a, b) => a.priority - b.priority).slice(0, limit).map((facet) => facet.text);
}

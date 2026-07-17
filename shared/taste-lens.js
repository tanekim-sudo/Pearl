import { contentFingerprint } from "./lens-grammar.js";
import {
  LENS_PERCEPTUAL_SECTIONS,
  mergePerceptualModels,
  normalizePerceptualModel,
} from "./lens-perceptual-model.js";

export const TASTE_LENS_DIFF_VERSION = 1;
const PRIVATE_EXAMPLE_SECTIONS = new Set(["positiveExamples", "negativeExamples", "pairedExamples", "critiques", "candidatePreferences"]);
const FACET_SECTIONS = new Set(LENS_PERCEPTUAL_SECTIONS);
const clean = (value, max = 4_000) => String(value || "").trim().slice(0, max);

function sourceRef(source = {}) {
  return {
    sourceId: clean(source.sourceId || source.id, 256),
    sourceType: clean(source.sourceType || source.type || "instruction", 100),
    scope: clean(source.scope || "workspace", 100),
    capturedAt: source.capturedAt || new Date().toISOString(),
    private: source.private !== false,
    fingerprint: source.fingerprint || contentFingerprint(source.snapshot || source.text || source),
  };
}

function facet(section, text, options = {}) {
  return {
    id: options.id || `${section}-${contentFingerprint([section, text, options.source]).slice(0, 16)}`,
    text: clean(text),
    definition: clean(options.definition),
    enabled: options.enabled !== false,
    priority: Number.isFinite(options.priority) ? options.priority : 0,
    weight: Number.isFinite(options.weight) ? options.weight : 1,
    strength: options.strength ?? null,
    confidence: options.confidence ?? (options.origin === "user" ? 1 : 0.6),
    reviewStatus: options.reviewStatus || (options.origin === "user" ? "confirmed" : "unreviewed"),
    userConfirmed: options.origin === "user",
    origin: options.origin || "inference",
    scope: options.scope || null,
    conditions: options.conditions || [],
    source: sourceRef(options.source),
    evidenceRefs: options.source?.sourceId || options.source?.id ? [{ sourceId: options.source.sourceId || options.source.id }] : [],
    expiresAt: options.expiresAt || null,
  };
}

export function createTasteLensModel(options = {}) {
  const current = normalizePerceptualModel(options.current || {});
  return normalizePerceptualModel({
    ...current,
    profile: {
      ...current.profile,
      purposes: [...new Set([...current.profile.purposes, "taste/judgment"])],
      domains: [...new Set([...current.profile.domains, ...(options.domains || [])])],
      scopes: options.scopes || current.profile.scopes,
      privacy: { rawExamples: "private", exportDerivedOnly: true, ...current.profile.privacy, ...options.privacy },
      priority: options.priority ?? current.profile.priority,
      lastRefinedAt: options.lastRefinedAt || current.profile.lastRefinedAt,
    },
  });
}

export function interpretTasteTeaching(input, context = {}) {
  const text = clean(input);
  const normalized = text.toLocaleLowerCase();
  const source = { ...context.source, text, sourceType: context.source?.sourceType || "instruction" };
  if (/\b(?:hate|avoid|don'?t like|never use)\b.*\bfiller words?\b/i.test(text)) {
    return {
      persistentIntent: /\b(?:save|remember|from now on)\b/i.test(text) || context.explicitSave === true,
      operations: [facet("antiPatterns", "Avoid filler words that add no meaning", {
        definition: "Flag removable fillers while preserving quoted speech, characterization, and intentional rhythm.",
        weight: -2,
        origin: "user",
        conditions: ["Do not alter quoted speech", "Allow intentional rhythm"],
        source,
      })],
      caveats: [],
    };
  }
  if (/\b(?:ai generated|ai-generated|written by ai)\b/i.test(text)) {
    const patterns = [
      "generic transitions without semantic work",
      "inflated abstraction without concrete evidence",
      "repeated sentence cadence",
      "excessive hedging",
      "canned framing",
      "empty summary conclusions",
    ];
    return {
      persistentIntent: /\b(?:save|remember|from now on)\b/i.test(text) || context.explicitSave === true,
      operations: patterns.map((pattern, index) => facet("antiPatterns", `Review for ${pattern}`, {
        definition: "Observable review heuristic only; not an AI-authorship detector.",
        weight: -1,
        priority: index,
        origin: "inference",
        reviewStatus: "unreviewed",
        source,
      })),
      caveats: ["No reliable perfect AI-text detector is claimed; review these editable observable patterns instead."],
    };
  }
  const preserve = text.match(/\b(?:keep|preserve|do not flatten|don't flatten)\s+(.+)$/i);
  if (preserve) {
    return {
      persistentIntent: context.explicitSave === true,
      operations: [facet("preserve", preserve[1], { origin: "user", source, weight: 2 })],
      caveats: context.explicitSave ? [] : ["Run-specific preserve constraint; the saved Lens remains unchanged."],
    };
  }
  return {
    persistentIntent: /\b(?:save|remember|from now on)\b/i.test(text) || context.explicitSave === true,
    operations: [facet(context.negative || /\b(?:avoid|hate|reject|never)\b/i.test(text) ? "antiPatterns" : "preferences", text, {
      origin: context.inferred ? "inference" : "user",
      reviewStatus: context.inferred ? "unreviewed" : "confirmed",
      source,
    })],
    caveats: [],
  };
}

export function proposeTasteLensDiff(currentValue, teaching, options = {}) {
  const current = createTasteLensModel({ current: currentValue, domains: options.domains || [] });
  const interpretation = typeof teaching === "string" ? interpretTasteTeaching(teaching, options) : teaching;
  const operations = (interpretation.operations || []).map((entry) => {
    const section = entry.section || (entry.id ? entry.id.split("-")[0] : null) || options.section || "preferences";
    if (!FACET_SECTIONS.has(section)) throw new Error(`unknown Taste Lens section "${section}"`);
    return {
      id: `taste-diff-${contentFingerprint([section, entry.id, entry.text]).slice(0, 16)}`,
      op: "add",
      section,
      facet: entry,
      status: "proposed",
    };
  });
  return {
    version: TASTE_LENS_DIFF_VERSION,
    id: options.id || `taste-diff-${contentFingerprint([current.fingerprint, operations]).slice(0, 16)}`,
    baseFingerprint: current.fingerprint,
    persistentIntent: interpretation.persistentIntent === true,
    operations,
    caveats: interpretation.caveats || [],
    source: sourceRef(options.source),
    createdAt: options.createdAt || new Date().toISOString(),
  };
}

export function attachTasteBeforeAfter(currentValue, pair, options = {}) {
  if (!pair?.before || !pair?.after) throw new Error("Taste Lens before/after requires both artifacts");
  const source = sourceRef({ ...options.source, sourceType: "before-after", snapshot: pair });
  const proposed = facet("pairedExamples", clean(options.summary || "Preferred transformation example"), {
    definition: clean(options.inferredPrinciple || "Infer what changed, what was preserved, and context-specific exceptions."),
    origin: "inference",
    reviewStatus: "unreviewed",
    source,
  });
  proposed.pair = {
    beforeRef: { id: pair.before.id, modality: pair.before.modality || "text", private: pair.before.private !== false },
    afterRef: { id: pair.after.id, modality: pair.after.modality || "text", private: pair.after.private !== false },
    preserved: (pair.preserved || []).slice(0, 20),
    contradictions: (pair.contradictions || []).slice(0, 20),
  };
  return proposeTasteLensDiff(currentValue, {
    persistentIntent: options.explicitSave === true,
    operations: [{ ...proposed, section: "pairedExamples" }],
    caveats: ["Inferred principles remain suggestions until accepted; confirmed facets are preserved."],
  }, { ...options, source });
}

export function applyTasteLensDiff(currentValue, diff, options = {}) {
  const current = createTasteLensModel({ current: currentValue });
  if (diff.baseFingerprint !== current.fingerprint) throw new Error("Taste Lens changed; refresh the proposed diff");
  if (!diff.persistentIntent && options.allowSessionOnly !== true) throw new Error("Persistent Taste Lens changes require explicit save or remember intent");
  const accepted = new Set(options.acceptedOperationIds || diff.operations.filter((operation) => operation.status !== "rejected").map((operation) => operation.id));
  const sections = structuredClone(current.sections);
  const applied = [];
  for (const operation of diff.operations) {
    if (!accepted.has(operation.id)) continue;
    const section = operation.section;
    if (!FACET_SECTIONS.has(section)) continue;
    if (operation.op === "add") sections[section] = [...sections[section], operation.facet];
    else if (operation.op === "remove") sections[section] = sections[section].filter((entry) => entry.id !== operation.facet.id);
    else if (operation.op === "replace") sections[section] = sections[section].map((entry) => entry.id === operation.facet.id ? operation.facet : entry);
    applied.push(operation.id);
  }
  const model = normalizePerceptualModel({
    ...current,
    sections,
    profile: { ...current.profile, lastRefinedAt: options.appliedAt || new Date().toISOString() },
    userEditedSections: [...new Set([...current.userEditedSections, ...diff.operations.filter((operation) => accepted.has(operation.id)).map((operation) => operation.section)])],
  });
  return {
    model,
    receipt: {
      type: "taste-lens-diff-receipt",
      diffId: diff.id,
      beforeFingerprint: current.fingerprint,
      afterFingerprint: model.fingerprint,
      appliedOperationIds: applied,
      undo: { restoreFingerprint: current.fingerprint, model: current },
    },
  };
}

export function compileTasteJudgmentEnvelope(lens, options = {}) {
  const model = createTasteLensModel({ current: lens.perceptualModel || lens });
  const overrides = (options.preserve || []).map((text, index) => facet("preserve", text, {
    id: `run-preserve-${index + 1}`,
    origin: "user",
    reviewStatus: "confirmed",
    source: { sourceType: "run-override", scope: "session", private: true },
  }));
  const sections = {};
  const evidence = [];
  for (const section of ["dimensions", "preferences", "antiPatterns", "preserve", "exceptions", "positiveExamples", "negativeExamples", "pairedExamples", "vocabularyPatterns"]) {
    const list = [...model.sections[section], ...(section === "preserve" ? overrides : [])]
      .filter((entry) => entry.enabled && entry.reviewStatus !== "rejected")
      .sort((a, b) => a.priority - b.priority);
    sections[section] = list.map((entry) => ({
      id: entry.id,
      text: entry.text,
      definition: entry.definition,
      weight: entry.weight,
      confidence: entry.confidence,
      conditions: entry.conditions,
      confirmed: entry.userConfirmed || entry.reviewStatus === "confirmed",
    }));
    for (const entry of list) evidence.push(...entry.evidenceRefs.map((ref) => ({ facetId: entry.id, ...ref })));
  }
  const budget = Math.min(options.budget || model.profile.contextBudget, model.profile.contextBudget);
  const envelope = {
    kind: "taste-judgment-envelope",
    version: 1,
    lens: { id: lens.id || options.lensId, version: lens.version || 1, fingerprint: model.fingerprint },
    domains: model.profile.domains,
    sections,
    runOverrides: overrides.map((entry) => entry.id),
    sourcePolicy: { rawExamples: "private", includePrivateBodies: options.includePrivate === true },
    evidence,
    budget,
  };
  envelope.fingerprint = contentFingerprint(envelope);
  return envelope;
}

export function evaluateThroughTasteLens(material, envelope) {
  const text = clean(material?.text || material?.content || material, 20_000);
  const findings = [];
  for (const facet of envelope.sections.antiPatterns || []) {
    const terms = facet.text.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
    const matched = terms.filter((term) => term.length > 4 && text.toLocaleLowerCase().includes(term));
    findings.push({
      facetId: facet.id,
      dimension: facet.text,
      status: matched.length ? "possible-violation" : "not-observed",
      evidence: matched.map((term) => ({ kind: "term-match", term })),
      uncertainty: matched.length ? "Term match requires human review in context." : "Absence of a term is not proof of fit.",
    });
  }
  return {
    kind: "taste-lens-evaluation",
    lens: envelope.lens,
    strengths: [],
    violations: findings.filter((entry) => entry.status === "possible-violation"),
    dimensions: findings,
    uncertainty: "Structured rubric evidence, not an objective scalar taste score.",
    suggestedAction: { kind: "function", name: "Revise to fit Lens", preserveOriginal: true },
  };
}

export function mergeTasteLenses(lenses, options = {}) {
  const merged = mergePerceptualModels(lenses.map((lens) => lens.perceptualModel || lens), options);
  return {
    ...merged,
    model: createTasteLensModel({
      current: merged.model,
      domains: [...new Set(lenses.flatMap((lens) => normalizePerceptualModel(lens.perceptualModel || lens).profile.domains))],
    }),
  };
}

export function exportTasteLensModel(value, options = {}) {
  const model = createTasteLensModel({ current: value });
  const sections = Object.fromEntries(Object.entries(model.sections).map(([section, facets]) => [
    section,
    PRIVATE_EXAMPLE_SECTIONS.has(section) && options.includePrivateExamples !== true
      ? []
      : facets.map((entry) => ({ ...entry, source: entry.source?.private ? { ...entry.source, snapshot: undefined } : entry.source })),
  ]));
  return normalizePerceptualModel({ ...model, sections });
}

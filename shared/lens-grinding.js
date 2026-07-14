/** Few-shot lens craftsmanship: serializable drafts, bounded compilation and tests. */

export const GRIND_SCHEMA_VERSION = 1;
export const GRIND_MIN_EXAMPLES = 2;
export const GRIND_DEFAULT_TOKEN_BUDGET = 6000;

const clean = (value, max = 4000) =>
  String(value || "")
    .replace(/\b(?:sk-[a-z0-9_-]{12,}|bearer\s+[a-z0-9._-]{12,})\b/gi, "[redacted]")
    .replace(/\0/g, "")
    .slice(0, max)
    .trim();

export function createGrindDraft(partial = {}, idFactory = () => globalThis.crypto?.randomUUID?.() || `grind-${Date.now()}`) {
  const now = Date.now();
  return {
    id: partial.id || idFactory(),
    schemaVersion: GRIND_SCHEMA_VERSION,
    status: partial.status || "collecting",
    name: partial.name || "",
    description: partial.description || "",
    rules: Array.isArray(partial.rules) ? partial.rules : [],
    constraints: Array.isArray(partial.constraints) ? partial.constraints : [],
    failureModes: Array.isArray(partial.failureModes) ? partial.failureModes : [],
    testCases: Array.isArray(partial.testCases) ? partial.testCases : [],
    examples: Array.isArray(partial.examples) ? partial.examples.map(normalizeGrindExample).filter(Boolean) : [],
    versions: Array.isArray(partial.versions) ? partial.versions : [],
    createdAt: partial.createdAt || now,
    updatedAt: now,
  };
}

export function normalizeGrindExample(example, index = 0) {
  if (!example || !clean(example.input) || !clean(example.output)) return null;
  return {
    id: example.id || `example-${Date.now()}-${index}`,
    polarity: example.polarity === "negative" ? "negative" : "positive",
    input: clean(example.input),
    output: clean(example.output),
    note: clean(example.note, 800),
    domain: clean(example.domain, 120) || "general",
    source: {
      lensId: example.source?.lensId || example.sourceLensId || null,
      lensVersion: Number(example.source?.lensVersion || example.sourceLensVersion) || null,
      historyId: example.source?.historyId || example.historyId || null,
      itemId: example.source?.itemId || example.itemId || null,
      nodeId: example.source?.nodeId || example.nodeId || null,
    },
    provenance: {
      capturedAt: example.provenance?.capturedAt || new Date().toISOString(),
      sourceKind: example.provenance?.sourceKind || example.sourceKind || "manual",
    },
  };
}

export function addGrindExample(draft, example) {
  const normalized = normalizeGrindExample(example, draft.examples?.length || 0);
  if (!normalized) throw new Error("example needs both input and output");
  if (draft.examples?.some((entry) => entry.id === normalized.id)) return draft;
  return { ...draft, examples: [...(draft.examples || []), normalized], updatedAt: Date.now() };
}

export function removeGrindExample(draft, exampleId) {
  return { ...draft, examples: (draft.examples || []).filter((entry) => entry.id !== exampleId), updatedAt: Date.now() };
}

export function reorderGrindExample(draft, exampleId, toIndex) {
  const examples = [...(draft.examples || [])];
  const from = examples.findIndex((entry) => entry.id === exampleId);
  if (from < 0) return draft;
  const [entry] = examples.splice(from, 1);
  examples.splice(Math.max(0, Math.min(examples.length, Number(toIndex) || 0)), 0, entry);
  return { ...draft, examples, updatedAt: Date.now() };
}

function approximateTokens(text) {
  return Math.ceil(String(text || "").length / 4);
}

export function buildGrindCompilationPrompt(draft, options = {}) {
  const budget = Math.max(800, options.tokenBudget || GRIND_DEFAULT_TOKEN_BUDGET);
  if ((draft.examples || []).length < GRIND_MIN_EXAMPLES) throw new Error("at least two examples are required");
  const header = [
    "Compile an editable transformation lens from these demonstrations.",
    "Generalize the transformation behavior across domains; do not memorize topics, names, or incidental wording.",
    "Positive examples show desired behavior. Negative examples show behavior to avoid.",
    "Return JSON with name, description, generalizedPrompt, rules, constraints, failureModes, and testCases.",
  ].join("\n");
  const selected = [];
  let body = header;
  for (const example of draft.examples) {
    const block = [
      `\nEXAMPLE ${selected.length + 1} [${example.polarity}; domain=${clean(example.domain, 80)}]`,
      `INPUT:\n${clean(example.input, options.maxExampleChars || 3000)}`,
      `OUTPUT:\n${clean(example.output, options.maxExampleChars || 3000)}`,
      example.note ? `WHY USER KEPT IT:\n${clean(example.note, 600)}` : "",
    ].filter(Boolean).join("\n");
    if (approximateTokens(`${body}${block}`) > budget) break;
    body += block;
    selected.push(example.id);
  }
  if (selected.length < GRIND_MIN_EXAMPLES) throw new Error("examples exceed token budget; shorten them before forging");
  return { prompt: body, includedExampleIds: selected, omittedExampleIds: draft.examples.map((e) => e.id).filter((id) => !selected.includes(id)), approximateTokens: approximateTokens(body), tokenBudget: budget };
}

export function manualForgedSkeleton(draft) {
  const positives = (draft.examples || []).filter((entry) => entry.polarity !== "negative");
  const notes = positives.map((entry) => entry.note).filter(Boolean);
  return {
    name: draft.name || "Forged lens draft",
    description: draft.description || "Manually shape the repeated transformation shown by the kept examples.",
    generalizedPrompt: [
      "Transform the input using the behavior demonstrated by the examples.",
      notes.length ? `Preserve these user-valued qualities: ${notes.join("; ")}.` : "",
      "Generalize across domains. Return only the transformed result.",
    ].filter(Boolean).join("\n"),
    rules: notes.length ? notes : ["Identify the repeated change from input to output", "Apply that change without copying incidental subject matter"],
    constraints: ["Preserve claims not intentionally transformed", "Do not invent unsupported facts"],
    failureModes: ["Overfitting to example vocabulary", "Returning commentary instead of the transformed result"],
    testCases: positives.slice(0, 5).map((entry) => ({ input: entry.input, expected: entry.output, exampleId: entry.id })),
    manualFallback: true,
  };
}

export function applyCompiledGrind(draft, compiled, options = {}) {
  if (!compiled || typeof compiled !== "object") throw new Error("compiler returned no proposal");
  const proposal = {
    name: clean(compiled.name, 100) || draft.name || "Forged lens",
    description: clean(compiled.description, 600),
    generalizedPrompt: clean(compiled.generalizedPrompt || compiled.prompt, 12000),
    rules: (compiled.rules || []).map((rule) => clean(typeof rule === "string" ? rule : rule.text, 800)).filter(Boolean),
    constraints: (compiled.constraints || []).map((rule) => clean(rule, 800)).filter(Boolean),
    failureModes: (compiled.failureModes || []).map((rule) => clean(rule, 800)).filter(Boolean),
    testCases: Array.isArray(compiled.testCases) ? compiled.testCases.slice(0, 20) : [],
    ruleExampleMap: compiled.ruleExampleMap || {},
  };
  if (!proposal.generalizedPrompt) throw new Error("proposal is missing a generalized prompt");
  const snapshot = { at: Date.now(), reason: options.reason || "compile", proposal: draft.proposal || null };
  return { ...draft, ...proposal, proposal, status: "shaping", versions: [...(draft.versions || []), snapshot], updatedAt: Date.now() };
}

function words(text) {
  return new Set(clean(text).toLowerCase().match(/[a-z0-9]{3,}/g) || []);
}

export function deterministicFidelity(actual, expected) {
  const a = clean(actual);
  const e = clean(expected);
  if (a === e) return { exact: true, overlap: 1, label: "exact deterministic match" };
  const aw = words(a);
  const ew = words(e);
  const intersection = [...aw].filter((word) => ew.has(word)).length;
  const union = new Set([...aw, ...ew]).size || 1;
  const overlap = intersection / union;
  return { exact: false, overlap, label: `${Math.round(overlap * 100)}% token-set overlap (deterministic, not quality)` };
}

export async function testForgedDraft(draft, run, options = {}) {
  const holdoutId = options.holdoutId || draft.examples?.[draft.examples.length - 1]?.id;
  const selected = options.all ? draft.examples || [] : (draft.examples || []).filter((entry) => entry.id === holdoutId);
  if (!selected.length) throw new Error("no test example selected");
  const results = [];
  for (const example of selected) {
    if (options.signal?.aborted) throw new DOMException("cancelled", "AbortError");
    const actual = await run(example.input, draft.proposal || draft);
    results.push({ exampleId: example.id, actual: clean(actual), expected: example.output, deterministic: deterministicFidelity(actual, example.output), rubric: null });
  }
  return results;
}

export function forgedOperatorFromDraft(draft, idFactory = () => globalThis.crypto?.randomUUID?.() || `forged-${Date.now()}`) {
  const proposal = draft.proposal || draft;
  if (!proposal.generalizedPrompt) throw new Error("shape the forged prompt before saving");
  const id = idFactory();
  return {
    id,
    kind: "prompt",
    top: true,
    lensKind: "forged",
    schemaVersion: 2,
    version: 1,
    name: proposal.name || "Forged lens",
    description: proposal.description || "",
    prompt: proposal.generalizedPrompt,
    constraints: proposal.constraints || [],
    failureModes: proposal.failureModes || [],
    forgedFrom: {
      grindDraftId: draft.id,
      exampleIds: (draft.examples || []).map((entry) => entry.id),
      positiveCount: (draft.examples || []).filter((entry) => entry.polarity !== "negative").length,
      negativeCount: (draft.examples || []).filter((entry) => entry.polarity === "negative").length,
    },
    tests: proposal.testCases || [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

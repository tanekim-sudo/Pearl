import { contentFingerprint } from "./lens-grammar.js";
import { addCognitiveCandidates, createCognitivePullRequest } from "./cognitive-pull-request.js";

export const CREATIVE_GOAL_VERSION = 1;
export const CREATIVE_GROUNDING_LEVELS = Object.freeze(["sourced", "evidence-inspired", "speculative"]);
export const CREATIVE_ARTIFACT_KINDS = Object.freeze(["move", "function", "lens"]);

export const MACHINE_CREATIVITY_TOOLS = Object.freeze([
  ["diverge", "Generate candidates across declared diversity dimensions"],
  ["analogical-transfer", "Map source roles across distant domains without erasing provenance"],
  ["conceptual-blend", "Blend concepts while retaining each source role"],
  ["invert-counterfactual", "Invert assumptions and generate bounded counterfactuals"],
  ["transform-constraints", "Add, remove, or substitute explicit constraints"],
  ["abstraction-ladder", "Move between examples, patterns, principles, and applications"],
  ["decompose-process", "Separate observable process operations from protected expression"],
  ["recombine-artifacts", "Recombine or mutate canonical Moves, Functions, and Lenses"],
  ["evaluate-creative-fit", "Review novelty, usefulness, coherence, and evidence coverage"],
  ["preserve-tension", "Retain minority and contradictory hypotheses"],
  ["detect-banality", "Identify unsurprising or redundant candidates"],
  ["adversarial-originality", "Challenge originality and attribution claims"],
  ["taste-evolution", "Evolve candidates through explicit yes, no, and more-like-this feedback"],
].map(([id, purpose]) => Object.freeze({
  id: `creativity.${id}`,
  version: 1,
  kind: "thinking-tool",
  purpose,
  readOnly: true,
  inspectable: true,
  packageable: true,
  inputSchema: { type: "object", additionalProperties: false },
  outputSchema: { type: "creative-analysis" },
})));

const bounded = (value, min, max, fallback) => Math.min(max, Math.max(min, Number(value) || fallback));
const clean = (value, max = 4_000) => String(value || "").trim().slice(0, max);

function inferRequestedCount(text, fallback = 5) {
  const digit = text.match(/\b([1-9]|1[0-2])\b/)?.[1];
  if (digit) return Number(digit);
  const names = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  const match = Object.entries(names).find(([name]) => new RegExp(`\\b${name}\\b`, "i").test(text));
  return match?.[1] || fallback;
}

export function normalizeCreativeGoal(raw, options = {}) {
  const wording = clean(raw);
  if (!wording) throw new Error("CreativeGoal requires a stated outcome");
  const exactFrequencyRequested = /\b(?:most common|top|frequen(?:t|cy)|usually|typical)\b/i.test(wording);
  const historicalAttribution = wording.match(/\b(?:from|of|how|like|inspired by|make)\s+([A-Z][\p{L}'’-]+(?:\s+[A-Z][\p{L}'’-]+){0,3})/u)?.[1] || null;
  const speculative = /\b(?:invent|speculative|no one has named|imagine)\b/i.test(wording);
  return Object.freeze({
    version: CREATIVE_GOAL_VERSION,
    id: options.id || globalThis.crypto?.randomUUID?.() || `creative-goal-${Date.now()}`,
    rawWording: wording,
    desiredArtifactKinds: [...new Set(options.desiredArtifactKinds || (/\blens\b/i.test(wording) ? ["lens"] : /\bmoves?\b/i.test(wording) ? ["move"] : ["function"]))].filter((kind) => CREATIVE_ARTIFACT_KINDS.includes(kind)),
    count: bounded(options.count ?? inferRequestedCount(wording), 1, 12, 5),
    groundingLevel: options.groundingLevel || (speculative ? "speculative" : "evidence-inspired"),
    noveltyTarget: bounded(options.noveltyTarget, 0, 1, speculative ? 0.85 : 0.65),
    diversityDimensions: [...new Set(options.diversityDimensions || ["structure", "mechanism", "input-output", "failure-mode"])].slice(0, 12),
    constraints: (options.constraints || []).map((entry) => clean(entry, 1_000)).filter(Boolean),
    prohibitedImitation: options.prohibitedImitation || ["deceptive endorsement", "verbatim protected expression", "fabricated quotation"],
    audience: clean(options.audience || "artifact user", 500),
    useContext: clean(options.useContext || "reusable canonical creative work", 1_000),
    modelPolicy: options.modelPolicy || { strategy: "bounded-ensemble", discloseModels: true },
    budget: {
      maxSources: bounded(options.budget?.maxSources, 2, 10, 6),
      maxModelCalls: bounded(options.budget?.maxModelCalls, 1, 30, 12),
      maxUsd: bounded(options.budget?.maxUsd, 0, 100, 5),
      maxLatencyMs: bounded(options.budget?.maxLatencyMs, 1_000, 600_000, 180_000),
    },
    rubric: options.rubric || ["source-grounding", "distinctness", "usefulness", "coherence", "attribution-calibration"],
    attribution: { subject: historicalAttribution, exactFrequencyRequested, endorsementAllowed: false },
    sourcePolicy: options.sourcePolicy || { primaryPreferred: true, independentPerspectives: 2, datesRequiredWhenAvailable: true },
  });
}

export function buildCreativeResearchPlan(goalValue) {
  const goal = typeof goalValue === "string" ? normalizeCreativeGoal(goalValue) : goalValue;
  if (goal.groundingLevel === "speculative") {
    return {
      version: 1,
      mode: "plan",
      title: "Explicitly speculative creative synthesis",
      factualAttributionAllowed: false,
      questions: [],
      sourceRequirements: null,
      stoppingCriteria: ["requested candidate count reached", "distinctness threshold met", "budget reached"],
    };
  }
  const subject = goal.attribution.subject || "the stated people, tradition, domain, and materials";
  return {
    version: 1,
    mode: "research",
    title: `Research recurring processes associated with ${subject}`,
    factualAttributionAllowed: true,
    questions: [
      `What working methods or techniques are documented for ${subject}?`,
      "Which operations recur across independent primary or credible secondary sources?",
      "Which interpretations conflict, and where is attribution uncertain?",
      "What process-level abstractions generalize without copying protected expression?",
    ],
    sourceRequirements: {
      maxSources: goal.budget.maxSources,
      primaryPreferred: true,
      minimumIndependentPerspectives: goal.sourcePolicy.independentPerspectives,
      requireTitleUrlPublisher: true,
      requireDatesWhenAvailable: true,
      contradictionCheck: true,
    },
    stoppingCriteria: ["source diversity reached", "claims have source refs", "contradictions recorded", "budget reached"],
  };
}

export function normalizeCreativeSource(source, options = {}) {
  if (!source?.title || !source?.url || !source?.publisher || !source?.snippet) {
    throw new Error("Creative research source requires title, URL, publisher, and snippet");
  }
  const url = new URL(source.url);
  if (url.protocol !== "https:") throw new Error("Creative research sources must use HTTPS");
  return {
    id: source.id || `source-${contentFingerprint([source.title, url.href, source.snippet])}`,
    title: clean(source.title, 1_000),
    url: url.href,
    publisher: clean(source.publisher, 500),
    author: clean(source.author, 500) || null,
    publishedAt: source.publishedAt || source.date || null,
    retrievedAt: source.retrievedAt || options.retrievedAt || new Date().toISOString(),
    snippet: clean(source.snippet, 4_000),
    claimRefs: (source.claimRefs || []).slice(0, 100),
    contentHash: source.contentHash || contentFingerprint(source.snippet),
    provider: clean(source.provider || options.provider || "configured-provider", 200),
    trust: source.trust || "unreviewed",
    untrustedContent: true,
  };
}

export function buildCreativeEvidenceMap(goalValue, rawSources, options = {}) {
  const goal = typeof goalValue === "string" ? normalizeCreativeGoal(goalValue) : goalValue;
  const sources = (rawSources || []).slice(0, goal.budget.maxSources).map((source) => normalizeCreativeSource(source, options));
  if (goal.groundingLevel !== "speculative" && !sources.length) {
    const error = new Error("Verified research is unavailable; factual attribution is blocked. Choose an explicitly speculative exercise to continue without citations.");
    error.code = "CREATIVE_RESEARCH_REQUIRED";
    throw error;
  }
  return {
    version: 1,
    goalId: goal.id,
    sources,
    claims: (options.claims || []).map((claim) => ({
      id: claim.id || `claim-${contentFingerprint(claim)}`,
      text: clean(claim.text, 2_000),
      label: "sourced",
      sourceIds: [...new Set(claim.sourceIds || [])].filter((id) => sources.some((source) => source.id === id)),
      contradictionIds: [...new Set(claim.contradictionIds || [])],
      uncertainty: clean(claim.uncertainty, 1_000) || null,
    })),
    contradictions: (options.contradictions || []).slice(0, 100),
    sourceScope: "bounded-citable-metadata-and-snippets",
    privateMaterialIncluded: false,
    fingerprint: contentFingerprint(sources.map((source) => [source.id, source.contentHash])),
  };
}

function qualification(goal) {
  return goal.attribution.exactFrequencyRequested
    ? "This is an inferred recurring process, not a statistically exact frequency ranking or an official artifact authored by the subject."
    : "This is a derived interpretation of recurring process evidence, not an official artifact authored or endorsed by the subject.";
}

export function createCreativeCandidate(goal, raw, evidenceMap) {
  const sourceIds = [...new Set(raw.sourceIds || [])].filter((id) => evidenceMap.sources.some((source) => source.id === id));
  const sourced = sourceIds.length > 0;
  if (goal.groundingLevel !== "speculative" && !sourced) throw new Error("Evidence-inspired candidates require at least one verified source reference");
  const steps = (raw.steps || []).map((step, index) => ({
    id: step.id || `move-${index + 1}`,
    name: clean(step.name || `Move ${index + 1}`, 200),
    instruction: clean(step.instruction, 2_000),
    outputSpec: step.outputSpec || { machineKind: "text", cardinality: { min: 1, max: 1 } },
  }));
  if (raw.kind === "function" && steps.length < 2) throw new Error("Creative Functions require at least two distinct Moves");
  return {
    id: raw.id,
    kind: raw.kind || goal.desiredArtifactKinds[0],
    title: clean(raw.title, 200),
    blurb: clean(raw.blurb, 80),
    definition: clean(raw.definition || steps.map((step) => step.instruction).join(" → "), 8_000),
    purpose: clean(raw.purpose, 1_000),
    steps,
    branches: (raw.branches || []).slice(0, 12),
    inputSpec: raw.inputSpec || { semanticType: "material", arity: 1 },
    outputSpec: raw.outputSpec || { semanticType: "creative result", machineKind: "text", cardinality: { min: 1, max: 1 } },
    examples: (raw.examples || []).slice(0, 8),
    evidence: sourceIds.map((sourceId) => ({ sourceId, label: "sourced-support" })),
    sourceIds,
    confidence: bounded(raw.confidence, 0, 1, sourced ? 0.6 : 0.25),
    ambiguity: clean(raw.ambiguity, 1_000) || null,
    alternatives: (raw.alternatives || []).slice(0, 8),
    modelRecommendations: (raw.modelRecommendations || ["auto"]).slice(0, 8),
    holdouts: (raw.holdouts || []).slice(0, 10),
    labels: {
      facts: "sourced",
      operation: sourced ? "companion-inference" : "speculative-synthesis",
      artifact: "user-editable-canonical-candidate",
    },
    attribution: {
      subject: goal.attribution.subject,
      derivedInterpretation: true,
      official: false,
      endorsementClaimed: false,
      frequencyExact: false,
      qualification: qualification(goal),
      correctionStatus: "open-to-review",
    },
    category: raw.category || "creative-process",
    dependencies: raw.dependencies || [],
  };
}

export function createGroundedCreativePullRequest({ goal: goalValue, sources, patterns, provider, retrievedAt }) {
  const goal = typeof goalValue === "string" ? normalizeCreativeGoal(goalValue) : goalValue;
  const evidenceMap = buildCreativeEvidenceMap(goal, sources, { provider, retrievedAt });
  const candidates = (patterns || []).slice(0, goal.count).map((pattern) => createCreativeCandidate(goal, pattern, evidenceMap));
  const distinctCategories = new Set(candidates.map((candidate) => candidate.category));
  if (candidates.length > 1 && distinctCategories.size !== candidates.length) {
    throw new Error("Creative candidates must use distinct process categories rather than paraphrased duplicates");
  }
  const source = {
    id: `creative-evidence-${goal.id}`,
    fingerprint: evidenceMap.fingerprint,
    snapshot: { goal, evidenceMap },
  };
  let request = createCognitivePullRequest({
    source,
    kinds: goal.desiredArtifactKinds,
    strategy: "research-grounded-divergent-synthesis",
    budget: goal.count,
    privacy: "private",
  });
  request = addCognitiveCandidates(request, candidates);
  return {
    ...request,
    creativeGoal: goal,
    evidenceMap,
    attributionReview: {
      passed: request.candidates.every((candidate) => candidate.attribution?.derivedInterpretation && !candidate.attribution?.official),
      disputes: [],
      correctionMechanism: "edit candidate attribution or reject before merge",
    },
    metrics: {
      requested: goal.count,
      produced: request.candidates.length,
      distinctCategories: distinctCategories.size,
      sourceCount: evidenceMap.sources.length,
      sourceGrounding: request.candidates.length ? request.candidates.filter((candidate) => candidate.evidence.length).length / request.candidates.length : 0,
    },
  };
}

export function creativeResearchBlocker(goalValue, configuration = {}) {
  const goal = typeof goalValue === "string" ? normalizeCreativeGoal(goalValue) : goalValue;
  if (goal.groundingLevel === "speculative") return null;
  if (configuration.configured) return null;
  return {
    code: "CREATIVE_RESEARCH_REQUIRED",
    message: "Verified research is unavailable, so factual attribution and derived historical artifacts are blocked.",
    zeroMutation: true,
    alternatives: ["Configure a verified research provider", "Explicitly switch to a speculative exercise with no factual attribution"],
  };
}

export const AUTOMATION_RESEARCH_VERSION = 1;
export const AUTOMATION_RESEARCH_LIMITS = Object.freeze({ sources: 10, questions: 8, iterations: 3, budgetMs: 60_000 });

const clone = (value) => value == null ? value : structuredClone(value);
const bounded = (value, limit = 4_000) => String(value ?? "").slice(0, limit);
const id = (prefix) => `${prefix}:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

export function createAutomationResearchPlan(input = {}) {
  const publicQuestions = (input.publicQuestions || input.questions || []).slice(0, AUTOMATION_RESEARCH_LIMITS.questions)
    .map((entry) => bounded(entry, 1_000).trim()).filter(Boolean);
  if (!publicQuestions.length) throw new Error("research plan requires a bounded public question");
  const privateContext = clone(input.privateContext || null);
  if (privateContext && input.privateDisclosureApproved !== true) {
    throw new Error("private Lens context requires explicit bounded disclosure approval");
  }
  return {
    version: AUTOMATION_RESEARCH_VERSION,
    id: input.id || id("research-plan"),
    pearlId: bounded(input.pearlId, 220),
    publicQuestions,
    privateContext: privateContext && input.privateDisclosureApproved ? privateContext : null,
    privateDisclosureReceiptId: privateContext ? bounded(input.privateDisclosureReceiptId, 220) : null,
    maxSources: Math.min(AUTOMATION_RESEARCH_LIMITS.sources, Math.max(1, Number(input.maxSources) || 5)),
    maxIterations: Math.min(AUTOMATION_RESEARCH_LIMITS.iterations, Math.max(1, Number(input.maxIterations) || 1)),
    budgetMs: Math.min(AUTOMATION_RESEARCH_LIMITS.budgetMs, Math.max(1_000, Number(input.budgetMs) || 20_000)),
    recency: clone(input.recency || null),
    status: "planned",
    checkpoint: clone(input.checkpoint || null),
    createdAt: Date.now(),
  };
}

export function normalizeVerifiedResearchResult(value = {}, plan) {
  if (!value.provider || !Array.isArray(value.sources) || !value.sources.length) throw new Error("verified browsing evidence is unavailable");
  const sources = value.sources.slice(0, plan.maxSources).map((source) => {
    const url = new URL(source.url);
    if (url.protocol !== "https:") throw new Error("research source must use HTTPS");
    if (!source.title || !source.snippet || !source.retrievedAt) throw new Error("research source lacks citable evidence");
    return {
      id: bounded(source.id || id("source"), 220),
      title: bounded(source.title, 1_000),
      url: url.href,
      publisher: bounded(source.publisher || url.hostname, 500),
      publishedAt: source.publishedAt || null,
      retrievedAt: source.retrievedAt,
      snippet: bounded(source.snippet, 4_000),
      citation: bounded(source.citation || `${source.title} (${url.hostname})`, 1_000),
      claimRefs: clone(source.claimRefs || []),
      stale: source.stale === true,
    };
  });
  if (sources.some((source) => source.stale) && plan.recency?.required) throw new Error("verified browsing sources do not satisfy the freshness requirement");
  return {
    version: AUTOMATION_RESEARCH_VERSION,
    planId: plan.id,
    provider: bounded(value.provider, 200),
    model: bounded(value.model || "provider-resolved", 200),
    sources,
    completedAt: Date.now(),
    readOnly: true,
  };
}

export function proposeAutomationContextPatch(pearl, research, claims = []) {
  if (research.readOnly !== true || !research.sources?.length) throw new Error("context patches require verified read-only research evidence");
  const existing = pearl.lenses?.[0]?.claims || [];
  const sourceIds = new Set(research.sources.map((source) => source.id));
  const additions = claims.slice(0, 100).map((claim) => {
    const refs = (claim.sourceRefs || []).filter((entry) => sourceIds.has(entry));
    if (!refs.length) throw new Error("every proposed context claim requires verified source evidence");
    const conflict = existing.find((entry) => entry.key === claim.key && entry.value !== claim.value);
    return {
      id: bounded(claim.id || id("claim"), 220),
      key: bounded(claim.key, 220),
      value: bounded(claim.value, 4_000),
      confidence: Math.max(0, Math.min(1, Number(claim.confidence) || 0)),
      sourceRefs: refs,
      observedAt: claim.observedAt || research.completedAt,
      expiresAt: claim.expiresAt || null,
      conflictsWith: conflict?.id || null,
    };
  });
  return {
    version: AUTOMATION_RESEARCH_VERSION,
    id: id("context-patch"),
    pearlId: pearl.id,
    baseVersion: pearl.version,
    status: "review",
    additions,
    removals: clone([]),
    conflicts: additions.filter((entry) => entry.conflictsWith).map((entry) => ({ claimId: entry.id, existingClaimId: entry.conflictsWith })),
    evidence: clone(research),
    exactDiff: additions.map((entry) => ({ operation: "add", path: `lenses[0].claims.${entry.key}`, value: entry.value, sourceRefs: entry.sourceRefs })),
    createdAt: Date.now(),
  };
}

export function approveAutomationContextPatch(pearl, patch, options = {}) {
  if (options.approved !== true) throw new Error("explicit context patch approval is required");
  if (patch.status !== "review" || patch.pearlId !== pearl.id) throw new Error("context patch is not reviewable");
  if (patch.baseVersion !== pearl.version) throw new Error("Pearl context changed; regenerate the exact diff before approval");
  const lens = pearl.lenses?.[0];
  if (!lens) throw new Error("automation Pearl has no bounded context Lens");
  return {
    pearl: {
      ...clone(pearl),
      version: pearl.version + 1,
      lenses: [{ ...lens, claims: [...(lens.claims || []), ...clone(patch.additions)], sourcePatches: [...(lens.sourcePatches || []), patch.id] }, ...(pearl.lenses || []).slice(1)],
      checkpoints: [...(pearl.checkpoints || []), { id: id("checkpoint"), type: "context-patch", patchId: patch.id, previousClaims: clone(lens.claims || []), at: Date.now() }].slice(-50),
    },
    patch: { ...patch, status: "applied", approvedAt: Date.now() },
  };
}

export function undoAutomationContextPatch(pearl, patchId) {
  const checkpoint = [...(pearl.checkpoints || [])].reverse().find((entry) => entry.type === "context-patch" && entry.patchId === patchId);
  if (!checkpoint) throw new Error("context patch checkpoint is unavailable");
  return {
    ...clone(pearl),
    version: pearl.version + 1,
    lenses: [{ ...pearl.lenses[0], claims: clone(checkpoint.previousClaims), sourcePatches: (pearl.lenses[0].sourcePatches || []).filter((entry) => entry !== patchId) }, ...pearl.lenses.slice(1)],
    checkpoints: [...pearl.checkpoints, { id: id("checkpoint"), type: "context-patch-undo", patchId, at: Date.now() }].slice(-50),
  };
}

export function createAutomationRefreshPolicy(input = {}) {
  if (input.enabled !== true) return { enabled: false, consentedAt: null };
  if (input.consent === true && Number(input.intervalDays) >= 1) {
    return {
      enabled: true,
      intervalDays: Math.min(365, Number(input.intervalDays)),
      maxRuns: Math.min(52, Math.max(1, Number(input.maxRuns) || 12)),
      maxSourcesPerRun: Math.min(AUTOMATION_RESEARCH_LIMITS.sources, Math.max(1, Number(input.maxSourcesPerRun) || 5)),
      consentedAt: Date.now(),
      nextRunAt: Date.now() + Number(input.intervalDays) * 86_400_000,
      cancellable: true,
    };
  }
  throw new Error("recurring research requires explicit consent and a finite interval");
}

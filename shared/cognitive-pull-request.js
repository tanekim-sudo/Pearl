export const COGNITIVE_PULL_REQUEST_VERSION = 1;
const KINDS = ["move", "function", "lens"];

function words(value) {
  return String(value || "").toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
}

function similarity(left, right) {
  const a = new Set(words(left));
  const b = new Set(words(right));
  if (!a.size && !b.size) return 1;
  const intersection = [...a].filter((word) => b.has(word)).length;
  return intersection / Math.max(1, new Set([...a, ...b]).size);
}

export function createCognitivePullRequest({ source, kinds = KINDS, strategy = "bounded-diverse", budget = 30, privacy = "private", target = "library" }) {
  if (!source?.id || !source.fingerprint || !source.snapshot) throw new Error("Cognitive Pull Request requires a preserved Material source snapshot");
  const requestedKinds = [...new Set(kinds)].filter((kind) => KINDS.includes(kind));
  if (!requestedKinds.length) throw new Error("Cognitive Pull Request requires at least one extraction kind");
  return {
    schemaVersion: COGNITIVE_PULL_REQUEST_VERSION,
    id: globalThis.crypto?.randomUUID?.() || `cpr-${Date.now()}`,
    source: structuredClone(source),
    kinds: requestedKinds,
    strategy,
    budget: Math.min(100, Math.max(1, Number(budget) || 30)),
    privacy,
    target,
    status: "draft",
    candidates: [],
    comments: [],
    tests: [],
    saturation: { samples: 0, roundsWithoutNovelCategory: 0, reached: false },
    createdAt: new Date().toISOString(),
  };
}

export function addCognitiveCandidates(request, candidates, { library = [], round = 1 } = {}) {
  if (!["draft", "generating", "ready", "changes_requested"].includes(request.status)) throw new Error("Cognitive Pull Request is not open for candidates");
  const accepted = [];
  for (const raw of candidates.slice(0, request.budget - request.candidates.length)) {
    if (!request.kinds.includes(raw.kind) || !raw.evidence?.length || !raw.title || !raw.definition) continue;
    const duplicate = [...request.candidates, ...accepted].find((entry) => entry.kind === raw.kind && similarity(entry.definition, raw.definition) >= 0.82);
    const libraryMatch = library.find((entry) => entry.kind === raw.kind && similarity(entry.definition || entry.promptTemplate || entry.title, raw.definition) >= 0.82);
    accepted.push({
      id: raw.id || globalThis.crypto?.randomUUID?.() || `candidate-${Date.now()}-${accepted.length}`,
      kind: raw.kind,
      title: raw.title,
      definition: raw.definition,
      evidence: structuredClone(raw.evidence),
      confidence: Math.min(1, Math.max(0, Number(raw.confidence) || 0)),
      ambiguity: raw.ambiguity || null,
      duplicateOf: duplicate?.id || null,
      libraryMatch: libraryMatch?.id || null,
      novel: !duplicate && !libraryMatch,
      category: raw.category || raw.kind,
      dependencies: structuredClone(raw.dependencies || []),
      status: "proposed",
      review: [],
    });
  }
  const categoriesBefore = new Set(request.candidates.filter((entry) => entry.novel).map((entry) => entry.category));
  const newCategories = accepted.filter((entry) => entry.novel && !categoriesBefore.has(entry.category)).length;
  const roundsWithoutNovelCategory = newCategories ? 0 : request.saturation.roundsWithoutNovelCategory + 1;
  return {
    ...request,
    status: "ready",
    candidates: [...request.candidates, ...accepted],
    saturation: {
      samples: request.saturation.samples + accepted.length,
      roundsWithoutNovelCategory,
      reached: roundsWithoutNovelCategory >= 3 || request.candidates.length + accepted.length >= request.budget,
      round,
    },
  };
}

export function reviewCognitiveCandidate(request, candidateId, decision, { comment = "", edits = null } = {}) {
  if (!["accept", "reject", "changes_requested"].includes(decision)) throw new Error("Candidate review decision is invalid");
  return {
    ...request,
    candidates: request.candidates.map((candidate) => candidate.id === candidateId
      ? {
          ...candidate,
          status: decision === "accept" ? "accepted" : decision,
          definition: edits?.definition ?? candidate.definition,
          title: edits?.title ?? candidate.title,
          review: [...candidate.review, { decision, comment, at: new Date().toISOString() }],
        }
      : candidate),
  };
}

export async function testCognitiveCandidates(request, evaluator) {
  const tests = [];
  for (const candidate of request.candidates.filter((entry) => entry.status !== "rejected").slice(0, 10)) {
    const result = await evaluator(structuredClone(candidate), structuredClone(request.source));
    tests.push({ candidateId: candidate.id, passed: Boolean(result?.passed), evidence: result?.evidence || null });
  }
  return { ...request, tests: [...request.tests, ...tests] };
}

export function mergeCognitivePullRequest(request, { selectedCandidateIds, existingArtifacts = [] }) {
  const selected = new Set(selectedCandidateIds);
  const candidates = request.candidates.filter((entry) => selected.has(entry.id) && entry.status === "accepted");
  if (!candidates.length) throw new Error("No reviewed, accepted candidates were selected for merge");
  const artifacts = candidates.map((candidate) => ({
    id: globalThis.crypto?.randomUUID?.() || `artifact-${Date.now()}-${candidate.id}`,
    version: 1,
    kind: candidate.kind,
    title: candidate.title,
    definition: candidate.definition,
    evidence: candidate.evidence,
    provenance: { pullRequestId: request.id, sourceId: request.source.id, candidateId: candidate.id },
  }));
  return {
    request: { ...request, status: candidates.length === request.candidates.length ? "merged" : "partially_accepted", mergedCandidateIds: candidates.map((entry) => entry.id) },
    artifacts: [...existingArtifacts, ...artifacts],
    receipt: { type: "cognitive-pr-merge-receipt", requestId: request.id, artifactIds: artifacts.map((entry) => entry.id), undo: { removeArtifactIds: artifacts.map((entry) => entry.id) } },
  };
}

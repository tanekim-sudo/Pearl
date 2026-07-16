import { normalizeUtterance } from "./utterance-normalizer.js";

export const CRITIQUE_SESSION_VERSION = 1;
const MAX_CLAUSES = 200;

function classifyClause(text) {
  const value = String(text || "").trim();
  if (/\b(?:keep|preserve|don't change|do not change|leave)\b/i.test(value)) return "preserve";
  if (/\b(?:don't|do not|avoid|reject|not that|instead of)\b/i.test(value)) return "rejected-alternative";
  if (/\b(?:i like|i prefer|my preference|remember)\b/i.test(value)) return "preference";
  if (/\b(?:move|function|lens)\b/i.test(value) && /\b(?:save|create|make|turn)\b/i.test(value)) return "artifact-idea";
  if (/\b(?:move|place|beside|above|below|group|organize|align)\b/i.test(value)) return "organization";
  if (/\b(?:make|change|turn|rewrite|delete|insert|replace|rename|apply|use)\b/i.test(value)) return "requested-edit";
  return "observation";
}

export function createCritiqueSession({
  id = globalThis.crypto?.randomUUID?.() || `critique-${Date.now()}`,
  targets = [],
  now = () => Date.now(),
  rememberPreferences = false,
  snapshot = null,
} = {}) {
  const startedAt = snapshot?.startedAt || now();
  const clauses = structuredClone(snapshot?.clauses || []);
  const dispatchKeys = new Set(snapshot?.dispatchedClauseIds || []);
  let status = snapshot?.status === "paused" ? "paused" : "active";
  let checkpoint = null;

  return {
    id,
    version: CRITIQUE_SESSION_VERSION,
    start(snapshot) {
      checkpoint = structuredClone(snapshot);
      return { id, status, startedAt, targets: structuredClone(targets), checkpointCreated: true };
    },
    ingest(rawText, envelope = {}) {
      if (status !== "active") throw new Error("critique session is not active");
      const normalized = normalizeUtterance(rawText, { source: envelope.source || "voice" });
      const additions = normalized.semanticClauses.slice(0, MAX_CLAUSES - clauses.length).map((clause) => ({
        ...clause,
        id: `${id}:${clauses.length + 1}`,
        kind: classifyClause(clause.text),
        rawText: normalized.rawText,
        targetSnapshot: envelope.targetSnapshot || null,
        receivedAt: now(),
        private: true,
        stable: envelope.stable !== false,
      }));
      clauses.push(...additions);
      return {
        normalized,
        clauses: additions,
        executable: additions.filter((clause) => clause.stable && ["requested-edit", "organization", "artifact-idea"].includes(clause.kind)),
        annotations: additions.map((clause) => ({
          kind: "critique",
          private: true,
          sessionId: id,
          targetIds: targets.map((target) => target.id || target),
          clauseId: clause.id,
          category: clause.kind,
          text: clause.text,
        })),
        preferences: rememberPreferences ? additions.filter((clause) => clause.kind === "preference") : [],
      };
    },
    markDispatched(clauseId) {
      if (dispatchKeys.has(clauseId)) return false;
      dispatchKeys.add(clauseId);
      return true;
    },
    pause() { status = "paused"; },
    resume() { if (status === "paused") status = "active"; },
    stop() { status = "stopped"; },
    cancel() { status = "cancelled"; },
    rollback() {
      status = "rolled-back";
      return structuredClone(checkpoint);
    },
    snapshot() {
      return {
        version: CRITIQUE_SESSION_VERSION,
        id,
        status,
        startedAt,
        targets: structuredClone(targets),
        clauses: structuredClone(clauses),
        dispatchedClauseIds: [...dispatchKeys],
        rememberPreferences,
        audioPersisted: false,
      };
    },
  };
}

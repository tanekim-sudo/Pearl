import { contentFingerprint } from "../../shared/lens-grammar.js";

export const COMPANION_HARNESS_VERSION = 1;
export const COMPANION_MODES = Object.freeze(["ask", "plan", "agent", "debug"]);
export const RUN_LEDGER_KEY = "lens.companion.run-ledger.v1";
export const CONTEXT_SUMMARY_VERSION = 1;
const MUTATING_KINDS = new Set(["action", "artifact", "external-write", "publish", "checkpoint-restore"]);
const WORKER_KINDS = new Set(["explore", "research", "evaluator", "visual-auditor", "migration-analyst", "privacy-reviewer"]);

const clone = (value) => value == null ? value : structuredClone(value);
const nowIso = (now = Date.now()) => new Date(now).toISOString();
const id = (prefix) => `${prefix}-${globalThis.crypto?.randomUUID?.() || Date.now()}`;
const text = (value, max = 120_000) => String(value ?? "").slice(0, max);

export function normalizeGoal(raw, options = {}) {
  const wording = text(raw).trim();
  const sentences = wording.split(/(?<=[.!?])\s+|\n+/).filter(Boolean);
  const prohibited = sentences.filter((entry) => /\b(?:do not|don't|never|without|keep|preserve)\b/i.test(entry));
  const acceptance = sentences.filter((entry) => /\b(?:must|verify|pass|ensure|only when|acceptance)\b/i.test(entry));
  const references = [...wording.matchAll(/\b(?:Move|Function|Lens|page|node|branch)\s+["“]?([^",.;”]+)["”]?/gi)]
    .map((match) => match[0].trim()).slice(0, 100);
  return Object.freeze({
    version: 1,
    id: options.id || id("goal"),
    rawWording: wording,
    outcomes: clone(options.outcomes || sentences.filter((entry) => !prohibited.includes(entry)).slice(0, 50)),
    constraints: clone(options.constraints || prohibited),
    references: clone(options.references || references),
    unknowns: clone(options.unknowns || []),
    acceptanceCriteria: clone(options.acceptanceCriteria || acceptance),
    preservation: clone(options.preservation || prohibited.filter((entry) => /\b(?:keep|preserve|don't touch|do not touch)\b/i.test(entry))),
    prohibitedEffects: clone(options.prohibitedEffects || prohibited),
    budget: clone(options.budget || { risk: "low", cost: 0, maxSteps: 40, maxRetries: 3 }),
    communication: clone(options.communication || { routine: "terse", blockers: "precise", evidence: "expandable" }),
    createdAt: options.createdAt || nowIso(options.now),
  });
}

export function recommendCompanionMode(goalValue, context = {}) {
  const goal = typeof goalValue === "string" ? normalizeGoal(goalValue) : goalValue;
  const wording = goal.rawWording.toLowerCase();
  if (/\b(?:bug|broken|fails?|wrong|debug|why did|reproduce|root cause)\b/.test(wording)) {
    return { mode: "debug", reasons: ["unexplained failure requires hypotheses and runtime evidence"] };
  }
  if (
    /\b(?:migrate|publish|deploy|research|account-wide|delete all|external|privacy|costly)\b/.test(wording) ||
    goal.budget?.risk === "high" ||
    goal.unknowns?.length
  ) {
    return { mode: "plan", reasons: ["consequential scope, cost, or uncertainty requires review"] };
  }
  if (/^(?:what|why|how|explain|inspect|show|compare)\b/.test(wording) && !/\b(?:create|change|apply|save|run)\b/.test(wording)) {
    return { mode: "ask", reasons: ["read-only explanation goal"] };
  }
  return { mode: context.autonomy === "always-preview" ? "plan" : "agent", reasons: ["low-risk reversible local work"] };
}

export function modePermission(mode, operation = {}) {
  if (!COMPANION_MODES.includes(mode)) return { allowed: false, reason: "unknown companion mode" };
  const mutating = operation.mutating ?? MUTATING_KINDS.has(operation.kind);
  if (mode === "ask" && mutating) return { allowed: false, reason: "Ask mode is read-only" };
  if (mode === "plan" && mutating && operation.approved !== true) {
    return { allowed: false, reason: "Plan mode requires accepted preview", approvalRequired: true };
  }
  if (
    operation.externalWrite ||
    operation.publish ||
    operation.destructive ||
    operation.secretBearing
  ) {
    if (operation.approved !== true) {
      return { allowed: false, reason: "explicit scoped approval required", approvalRequired: true };
    }
  }
  return { allowed: true, reason: "within enforced mode permissions" };
}

function recordText(record) {
  return text(
    record.text ?? record.summary ?? record.name ?? record.title ?? record.prompt ??
    record.expandedText ?? record.preview ?? record.content ?? ""
  );
}

export function buildLiveContextIndex(snapshot = {}) {
  const records = [
    ...(snapshot.items || []).map((entry) => ({ ...entry, domain: "paper" })),
    ...(snapshot.nodes || []).map((entry) => ({ ...entry, domain: "ai" })),
    ...(snapshot.objects || []).map((entry) => ({ ...entry, domain: entry.domain || "paper" })),
    ...(snapshot.lenses || []).map((entry) => ({ ...entry, domain: entry.libraryKind || "library" })),
    ...(snapshot.generators || []).map((entry) => ({ ...entry, domain: "lens" })),
    ...(snapshot.history || []).map((entry) => ({ ...entry, domain: "history" })),
  ].map((entry, index) => {
    const stableId = String(entry.stableId || entry.id || `${entry.domain}-${index + 1}`);
    const version = Number(entry.version) || 1;
    const body = recordText(entry);
    return {
      stableId,
      version,
      domain: entry.domain,
      name: text(entry.name || entry.title || entry.label || "", 500),
      tags: (entry.tags || []).map(String),
      body,
      refs: clone(entry.refs || entry.dependencies || entry.sourceIds || []),
      spatial: clone(entry.spatial || (Number.isFinite(entry.x) ? { x: entry.x, y: entry.y } : null)),
      at: entry.updatedAt || entry.createdAt || entry.savedAt || null,
      private: entry.private === true || entry.provenance?.private === true,
      fingerprint: contentFingerprint({ stableId, version, body, refs: entry.refs || entry.dependencies || [] }),
      raw: clone(entry),
    };
  });
  const exact = new Map();
  const references = new Map();
  for (const record of records) {
    for (const token of [record.stableId, record.name, ...record.tags].filter(Boolean)) {
      const key = token.toLocaleLowerCase();
      exact.set(key, [...(exact.get(key) || []), record.stableId]);
    }
    references.set(record.stableId, record.refs.map((entry) => typeof entry === "string" ? entry : entry.id).filter(Boolean));
  }
  return Object.freeze({
    version: 1,
    revision: snapshot.revision || contentFingerprint(records.map((record) => [record.stableId, record.version, record.fingerprint])),
    records,
    exact,
    references,
  });
}

export function queryLiveContext(index, query = {}) {
  const allowedDomains = new Set(query.domains || index.records.map((entry) => entry.domain));
  const phrase = text(query.text).toLocaleLowerCase();
  const ids = new Set(query.ids || []);
  const exactIds = phrase ? new Set(index.exact.get(phrase) || []) : null;
  return index.records
    .filter((record) => allowedDomains.has(record.domain))
    .filter((record) => query.includePrivate === true || !record.private)
    .filter((record) => !ids.size || ids.has(record.stableId))
    .filter((record) => !phrase || exactIds?.has(record.stableId) ||
      `${record.name}\n${record.tags.join(" ")}\n${record.body}`.toLocaleLowerCase().includes(phrase))
    .filter((record) => !query.viewport || !record.spatial ||
      record.spatial.x >= query.viewport.left && record.spatial.x <= query.viewport.right &&
      record.spatial.y >= query.viewport.top && record.spatial.y <= query.viewport.bottom)
    .slice(0, Math.max(1, Math.min(Number(query.limit) || 100, 500)))
    .map((record) => ({
      ...clone(record.raw),
      citation: {
        stableId: record.stableId,
        version: record.version,
        domain: record.domain,
        fingerprint: record.fingerprint,
      },
    }));
}

export function staleReferences(index, citations = []) {
  return citations.flatMap((citation) => {
    const current = index.records.find((entry) => entry.stableId === citation.stableId);
    if (!current) return [{ ...citation, status: "deleted" }];
    if (current.version !== citation.version || current.fingerprint !== citation.fingerprint) {
      return [{ ...citation, status: "stale", currentVersion: current.version, currentFingerprint: current.fingerprint }];
    }
    return [];
  });
}

export function immutableWorkspaceSnapshot(workspace, options = {}) {
  const state = clone(workspace || {});
  const snapshot = {
    version: 1,
    id: options.id || id("checkpoint"),
    parentId: options.parentId || null,
    createdAt: nowIso(options.now),
    revision: state.revision || contentFingerprint(state),
    state,
  };
  snapshot.fingerprint = contentFingerprint({
    version: snapshot.version,
    parentId: snapshot.parentId,
    revision: snapshot.revision,
    state,
  });
  return Object.freeze(snapshot);
}

function byStableId(list = []) {
  return new Map(list.map((entry) => [String(entry.stableId || entry.id), entry]));
}

export function semanticWorkspaceDiff(beforeValue, afterValue) {
  const before = beforeValue?.state || beforeValue || {};
  const after = afterValue?.state || afterValue || {};
  const domains = {
    content: ["items", "nodes", "selection"],
    graph: ["edges", "operators"],
    outputAndModels: ["generationPlans", "outputSpecs"],
    lensContext: ["lenses", "generators"],
    referencesAndMigrations: ["dependencies", "migrations"],
    spatial: ["layout", "camera", "aiCamera"],
    provenanceAndPrivacy: ["provenance", "privacy"],
  };
  const sections = {};
  for (const [section, keys] of Object.entries(domains)) {
    const changes = [];
    for (const key of keys) {
      const left = Array.isArray(before[key]) ? byStableId(before[key]) : null;
      const right = Array.isArray(after[key]) ? byStableId(after[key]) : null;
      if (left && right) {
        for (const stableId of new Set([...left.keys(), ...right.keys()])) {
          const a = left.get(stableId);
          const b = right.get(stableId);
          if (!a) changes.push({ key, stableId, type: "added", after: clone(b) });
          else if (!b) changes.push({ key, stableId, type: "removed", before: clone(a) });
          else if (contentFingerprint(a) !== contentFingerprint(b)) {
            changes.push({ key, stableId, type: "changed", before: clone(a), after: clone(b) });
          }
        }
      } else if (contentFingerprint(before[key] ?? null) !== contentFingerprint(after[key] ?? null)) {
        changes.push({ key, type: "changed", before: clone(before[key]), after: clone(after[key]) });
      }
    }
    sections[section] = changes;
  }
  const all = Object.values(sections).flat();
  return {
    version: 1,
    sections,
    changedStableIds: [...new Set(all.map((entry) => entry.stableId).filter(Boolean))],
    count: all.length,
    fingerprint: contentFingerprint(all),
  };
}

export function verifyObservedEffects({ before, after, expected = [], prohibited = [] }) {
  const diff = semanticWorkspaceDiff(before, after);
  const changed = new Set(diff.changedStableIds);
  const checks = expected.map((effect) => {
    if (typeof effect === "function") return { label: effect.name || "postcondition", ok: Boolean(effect(after, before, diff)) };
    if (effect.type === "stable-id-changed") return { label: effect.label || effect.stableId, ok: changed.has(effect.stableId) };
    if (effect.type === "exists") {
      const index = buildLiveContextIndex(after?.state || after);
      return { label: effect.label || effect.stableId, ok: index.records.some((entry) => entry.stableId === effect.stableId) };
    }
    return { label: effect.label || effect.type || "effect", ok: false };
  });
  const unintended = prohibited.flatMap((rule) => {
    if (rule.type === "stable-id-removed") {
      const removed = Object.values(diff.sections).flat().filter((entry) => entry.type === "removed" && (!rule.stableId || entry.stableId === rule.stableId));
      return removed.map((entry) => ({ rule, change: entry }));
    }
    return [];
  });
  const passed = checks.filter((entry) => entry.ok).length;
  return {
    status: unintended.length || (checks.length && passed === 0)
      ? "failed"
      : passed === checks.length
        ? "verified"
        : "partially_verified",
    checks,
    unintended,
    diff,
  };
}

export function createRunLedger(goal, plan, options = {}) {
  const run = {
    version: 1,
    runId: options.runId || id("run"),
    goal: clone(goal),
    mode: options.mode || "agent",
    plan: clone(plan),
    planRevision: 1,
    status: "planned",
    steps: {},
    values: {},
    approvals: [],
    errors: [],
    checkpoints: [],
    workers: [],
    events: [],
    createdAt: nowIso(options.now),
    updatedAt: nowIso(options.now),
  };
  return clone(run);
}

export function transitionRun(runValue, transition, options = {}) {
  const run = clone(runValue);
  const event = { id: id("event"), at: nowIso(options.now), ...clone(transition) };
  run.events.push(event);
  run.updatedAt = event.at;
  if (transition.status) run.status = transition.status;
  if (transition.stepId) {
    run.steps[transition.stepId] = {
      ...(run.steps[transition.stepId] || { attempts: 0, dependencies: [], evidence: [] }),
      ...clone(transition.patch || {}),
      status: transition.stepStatus || transition.status || run.steps[transition.stepId]?.status,
    };
    if (transition.attempt) run.steps[transition.stepId].attempts = transition.attempt;
  }
  if (transition.checkpoint) run.checkpoints.push(clone(transition.checkpoint));
  if (transition.approval) run.approvals.push(clone(transition.approval));
  if (transition.error) run.errors.push(clone(transition.error));
  return run;
}

export function persistRunLedger(run, storage = globalThis.localStorage) {
  if (!storage?.setItem) return run;
  const current = JSON.parse(storage.getItem(RUN_LEDGER_KEY) || '{"runs":[]}');
  const runs = (current.runs || []).filter((entry) => entry.runId !== run.runId);
  runs.push(clone(run));
  storage.setItem(RUN_LEDGER_KEY, JSON.stringify({ version: 1, runs: runs.slice(-50), activeRunId: run.status === "completed" ? null : run.runId }));
  return run;
}

export function restoreRunLedger(storage = globalThis.localStorage) {
  if (!storage?.getItem) return { version: 1, runs: [], activeRunId: null };
  try {
    const value = JSON.parse(storage.getItem(RUN_LEDGER_KEY) || "{}");
    return { version: 1, runs: Array.isArray(value.runs) ? value.runs : [], activeRunId: value.activeRunId || null };
  } catch {
    return { version: 1, runs: [], activeRunId: null };
  }
}

export function invalidatePlanDescendants(plan, editedStepIds = []) {
  const edited = new Set(editedStepIds);
  const invalid = new Set(editedStepIds);
  const dependencies = new Map();
  const visit = (step) => {
    if (step?.id) dependencies.set(step.id, new Set(step.dependsOn || []));
    for (const child of step?.steps || []) visit(child);
    if (step?.step) visit(step.step);
    if (step?.then) visit(step.then);
    if (step?.else) visit(step.else);
  };
  visit(plan.root);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [stepId, deps] of dependencies) {
      if (!invalid.has(stepId) && [...deps].some((dep) => invalid.has(dep))) {
        invalid.add(stepId);
        changed = true;
      }
    }
  }
  return { edited: [...edited], invalidated: [...invalid] };
}

export function resolvePolicies(policies = []) {
  const rank = { user: 1, workspace: 2, team: 3, security: 4 };
  return [...policies].sort((a, b) => (rank[b.scope] || 0) - (rank[a.scope] || 0) || (Number(b.priority) || 0) - (Number(a.priority) || 0));
}

export async function runHarnessHooks(hooks = [], event, context = {}) {
  const annotations = [];
  for (const hook of hooks.filter((entry) => entry.event === event)) {
    const result = await hook.run(clone(context));
    if (result?.annotation) annotations.push(result.annotation);
    if (result?.decision === "deny") return { decision: "deny", reason: result.reason, annotations };
    if (result?.decision === "require-approval") return { decision: "require-approval", reason: result.reason, annotations };
  }
  return { decision: "allow", annotations };
}

export async function runBoundedWorkers(requests = [], runner, options = {}) {
  const maxWorkers = Math.max(1, Math.min(Number(options.maxWorkers) || 4, 8));
  if (requests.some((entry) => !WORKER_KINDS.has(entry.kind))) throw new Error("unknown specialist worker kind");
  const mutating = requests.filter((entry) => entry.mutating);
  const objectIds = new Set();
  for (const request of mutating) {
    for (const stableId of request.stableIds || []) {
      if (objectIds.has(stableId)) throw new Error(`concurrent mutation conflict for ${stableId}`);
      objectIds.add(stableId);
    }
    if (!request.candidateSnapshotId) throw new Error("mutating workers require an isolated candidate snapshot");
  }
  const queue = requests.map((request) => ({ ...clone(request), id: request.id || id("worker") }));
  const results = [];
  let cursor = 0;
  const consume = async () => {
    while (cursor < queue.length) {
      const request = queue[cursor++];
      try {
        const artifact = await runner(request, { signal: options.signal, budget: request.budget || options.budget });
        results.push({ id: request.id, kind: request.kind, status: "completed", artifact, durationMs: artifact?.durationMs || null });
      } catch (error) {
        results.push({ id: request.id, kind: request.kind, status: error?.name === "AbortError" ? "cancelled" : "blocked", blocker: error.message });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(maxWorkers, queue.length) }, consume));
  return results;
}

export function compactHarnessContext(run, options = {}) {
  const events = run.events || [];
  return {
    version: CONTEXT_SUMMARY_VERSION,
    runId: run.runId,
    goal: clone(run.goal),
    mode: run.mode,
    status: run.status,
    planRevision: run.planRevision,
    completedStepIds: Object.entries(run.steps || {}).filter(([, step]) => step.status === "completed").map(([stepId]) => stepId),
    unresolvedStepIds: Object.entries(run.steps || {}).filter(([, step]) => !["completed", "compensated"].includes(step.status)).map(([stepId]) => stepId),
    decisions: clone(run.approvals || []),
    errors: clone(run.errors || []),
    checkpoints: clone(run.checkpoints || []),
    externalReceipts: clone(run.externalReceipts || []),
    prohibitedEffects: clone(run.goal?.prohibitedEffects || []),
    recentEvidence: events.filter((entry) => entry.evidence).slice(-(Number(options.evidenceLimit) || 30)),
    fingerprint: contentFingerprint({ runId: run.runId, status: run.status, steps: run.steps, approvals: run.approvals, errors: run.errors }),
  };
}

export function createVerifiedResearchTool(provider, policy = {}) {
  return async function research(request = {}) {
    if (!provider?.search) throw new Error("verified browsing provider is not configured");
    if (request.write === true) throw new Error("research tool is read-only; external writes require a separate approved connector");
    const result = await provider.search({
      query: text(request.question, 4_000),
      maxSources: Math.min(10, Math.max(1, Number(request.maxSources) || 5)),
      signal: request.signal,
    });
    const allowed = policy.allowedOrigins || [];
    const sources = (result?.sources || []).map((source) => {
      const url = new URL(source.url);
      if (allowed.length && !allowed.some((origin) =>
        url.origin === origin || url.hostname === origin || url.hostname.endsWith(`.${origin}`)
      )) {
        throw new Error(`research source origin is not approved: ${url.origin}`);
      }
      if (!source.title || !source.url || !source.snippet) throw new Error("research provider returned an unverifiable source");
      return {
        id: source.id || contentFingerprint({ title: source.title, url: source.url, snippet: source.snippet }).slice(0, 24),
        title: text(source.title, 1_000),
        url: source.url,
        publisher: text(source.publisher || url.hostname, 500),
        publishedAt: source.publishedAt || null,
        retrievedAt: source.retrievedAt || nowIso(),
        snippet: text(source.snippet, 4_000),
        claimRefs: clone(source.claimRefs || []),
      };
    });
    if (!sources.length) throw new Error("verified browsing returned no citable sources");
    return { version: 1, question: request.question, sources, provider: provider.name || "configured-provider" };
  };
}

/** Human chat-status labels — never leave the user staring at a silent void. */
const PHASE_STATUS_LABELS = Object.freeze({
  understanding: "Working…",
  planning: "Planning…",
  researching: "Researching…",
  hypothesizing: "Working…",
  instrumenting: "Working…",
  reviewing: "Waiting for your choice…",
  fixing: "Working…",
  migrating: "Working…",
  evaluating: "Working…",
  executing: "Working…",
  interpreting: "Interpreting…",
  proposing: "Proposed change…",
  demonstrating: "Demonstrating…",
  blocked: "Blocked",
  idle: "Done",
  done: "Done",
});

const DIRECTOR_ACTION_LABELS = Object.freeze({
  createSemanticOrb: "Creating pearl…",
  createExternalSemanticOrb: "Creating pearl…",
  renameSemanticOrb: "Renaming pearl…",
  getPearlSystemPrompt: "Reading system prompt…",
  setPearlSystemPrompt: "Updating system prompt…",
  editPearlSystemPrompt: "Editing system prompt…",
  interpretPearlPrompt: "Interpreting prompt…",
  addSemanticOrbContext: "Updating pearl…",
  mergeSemanticOrbs: "Merging pearls…",
  composeSemanticOrbs: "Composing pearls…",
  synthesizeSemanticOrbs: "Synthesizing pearls…",
  organizePearl: "Organizing pearl…",
  createCounterPearl: "Breeding experiment pearl…",
  editPearlOutput: "Editing pearl…",
  nestSemanticOrb: "Nesting pearls…",
  splitSemanticOrb: "Splitting pearl…",
  activateSemanticOrb: "Opening pearl…",
  moveSemanticOrb: "Moving pearl…",
  wearPearl: "Wearing pearl…",
  openScene: "Opening scene…",
  openLibrary: "Opening library…",
  openPearlStudio: "Opening Studio…",
  spawnText: "Adding text…",
  createMove: "Creating move…",
  createFunction: "Creating function…",
  createLens: "Creating lens…",
  applyMove: "Applying move…",
  applyFunction: "Applying function…",
  highlight: "Highlighting…",
  clearHighlight: "Clearing highlight…",
  switchTool: "Switching tool…",
  fitPaper: "Fitting view…",
  zoomPaper: "Zooming…",
  panPaper: "Panning…",
  caption: "Explaining…",
  pause: "Pausing…",
  clearWorkspaceDomains: "Clearing workspace…",
});

export function formatCompanionStatusLabel(phase, options = {}) {
  if (options.listening) return "Listening…";
  if (options.playing || phase === "demonstrating") {
    const title = text(options.scriptTitle || "", 80);
    return title ? `Demonstrating — ${title}…` : "Demonstrating…";
  }
  const key = String(phase || "understanding").toLowerCase().trim();
  if (PHASE_STATUS_LABELS[key]) return PHASE_STATUS_LABELS[key];
  if (/^blocked/.test(key)) return "Blocked";
  if (/^done|complete|idle/.test(key)) return "Done";
  // Freeform phases from App ("discovering operation", "fixing", …)
  const cleaned = key.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return "Working…";
  return `${cleaned.charAt(0).toUpperCase()}${cleaned.slice(1)}…`;
}

export function formatDirectorActionTrail(event = {}) {
  const type = String(event.type || "");
  const capability = String(event.capability || "").trim();
  if (type === "run-start") {
    return event.stepCount > 0 ? "Starting demonstration…" : null;
  }
  if (type === "cursor-move" || type === "cursor-move-start") return "Moving cursor…";
  if (type === "gesture-press") return "Clicking…";
  if (type === "gesture-release") return null;
  if (type === "caption" && event.text) {
    return text(event.text, 160);
  }
  if (type === "step-start" && capability) {
    if (DIRECTOR_ACTION_LABELS[capability]) return DIRECTOR_ACTION_LABELS[capability];
    const readable = capability
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .replace(/\bOrbs?\b/g, "pearl")
      .replace(/\borbs?\b/g, "pearl")
      .toLowerCase();
    return `${readable.charAt(0).toUpperCase()}${readable.slice(1)}…`;
  }
  if (type === "step-complete" && capability) {
    if (/createSemanticOrb|createExternalSemanticOrb/.test(capability)) {
      const name = text(event.result?.name || event.args?.name || "", 60);
      return name ? `Created “${name}”.` : "Created pearl.";
    }
    if (capability === "wearPearl") return "Pearl worn.";
    if (capability === "openScene") return "Scene opened.";
    return null;
  }
  if (type === "step-failed" && event.error) {
    return `Step skipped — ${text(event.error, 120)}`;
  }
  return null;
}

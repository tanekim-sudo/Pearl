import test from "node:test";
import assert from "node:assert/strict";

import {
  buildLiveContextIndex,
  compactHarnessContext,
  createRunLedger,
  createVerifiedResearchTool,
  formatCompanionStatusLabel,
  formatDirectorActionTrail,
  immutableWorkspaceSnapshot,
  invalidatePlanDescendants,
  modePermission,
  normalizeGoal,
  persistRunLedger,
  queryLiveContext,
  recommendCompanionMode,
  restoreRunLedger,
  runBoundedWorkers,
  semanticWorkspaceDiff,
  staleReferences,
  transitionRun,
  verifyObservedEffects,
} from "./companion-harness.js";

test("status labels stay human and never blank for live phases", () => {
  assert.equal(formatCompanionStatusLabel("understanding"), "Working…");
  assert.equal(formatCompanionStatusLabel("planning"), "Planning…");
  assert.equal(formatCompanionStatusLabel("demonstrating", { playing: true, scriptTitle: "Create pearl" }), "Demonstrating — Create pearl…");
  assert.equal(formatCompanionStatusLabel("", { listening: true }), "Listening…");
  assert.match(formatCompanionStatusLabel("discovering operation"), /Discovering operation/);
});

test("director action trail maps steps to compact chat lines", () => {
  assert.equal(formatDirectorActionTrail({ type: "step-start", capability: "createSemanticOrb" }), "Creating pearl…");
  assert.equal(formatDirectorActionTrail({ type: "cursor-move-start" }), "Moving cursor…");
  assert.equal(
    formatDirectorActionTrail({ type: "step-complete", capability: "createSemanticOrb", args: { name: "Notes" } }),
    "Created “Notes”.",
  );
  assert.equal(formatDirectorActionTrail({ type: "gesture-release" }), null);
  assert.equal(formatDirectorActionTrail({ type: "step-start", capability: "mergeSemanticOrbs" }), "Merging pearls…");
  assert.doesNotMatch(
    formatDirectorActionTrail({ type: "step-start", capability: "synthesizeSemanticOrbs" }) || "",
    /\borb/i,
  );
});

test("Ask and Plan enforce zero mutation until accepted", () => {
  assert.equal(modePermission("ask", { kind: "action", mutating: true }).allowed, false);
  assert.equal(modePermission("plan", { kind: "action", mutating: true }).allowed, false);
  assert.equal(modePermission("plan", { kind: "action", mutating: true, approved: true }).allowed, true);
  assert.equal(modePermission("agent", { kind: "query" }).allowed, true);
  assert.equal(modePermission("debug", { kind: "action", mutating: true }).allowed, true);
  assert.equal(modePermission("agent", { kind: "publish", publish: true }).approvalRequired, true);
});

test("goals are immutable and mode recommendation is evidence-based", () => {
  const goal = normalizeGoal("Migrate every Function. Keep failed versions unchanged. Verify compatibility tests.");
  assert.ok(Object.isFrozen(goal));
  assert.match(goal.prohibitedEffects.join(" "), /Keep failed versions unchanged/);
  assert.equal(recommendCompanionMode(goal).mode, "plan");
  assert.equal(recommendCompanionMode("This workflow feels wrong—figure out why and fix it.").mode, "debug");
  assert.equal(recommendCompanionMode("Explain why this branch exists.").mode, "ask");
});

test("live context index retrieves exact, content, graph, spatial, and stable citations", () => {
  const index = buildLiveContextIndex({
    revision: "r1",
    items: [
      { id: "paper-a", version: 2, text: "Founder incentives", tags: ["diligence"], x: 20, y: 30 },
      { id: "paper-private", text: "secret", private: true, x: 200, y: 300 },
    ],
    nodes: [{ id: "node-a", preview: "Risk evidence", sourceIds: ["paper-a"], x: 50, y: 50 }],
    lenses: [{ id: "move-a", libraryKind: "move", name: "Challenge", prompt: "Find counterevidence." }],
  });
  const exact = queryLiveContext(index, { text: "Challenge" });
  assert.equal(exact[0].citation.stableId, "move-a");
  assert.equal(queryLiveContext(index, { text: "incentives", viewport: { left: 0, top: 0, right: 100, bottom: 100 } })[0].id, "paper-a");
  assert.equal(queryLiveContext(index, { text: "secret" }).length, 0);
  const citation = queryLiveContext(index, { ids: ["paper-a"] })[0].citation;
  const changed = buildLiveContextIndex({ items: [{ id: "paper-a", version: 3, text: "Changed" }] });
  assert.equal(staleReferences(changed, [citation])[0].status, "stale");
});

test("snapshots, semantic diff, and independent verification catch false success and deletion", () => {
  const before = immutableWorkspaceSnapshot({
    items: [{ id: "a", stableId: "a", version: 1, text: "Keep" }],
    operators: [],
  }, { id: "before", now: 1 });
  const unchanged = immutableWorkspaceSnapshot(before.state, { id: "unchanged", now: 2 });
  assert.equal(verifyObservedEffects({
    before,
    after: unchanged,
    expected: [{ type: "stable-id-changed", stableId: "a" }],
  }).status, "failed");

  const after = immutableWorkspaceSnapshot({
    items: [],
    operators: [{ id: "move-a", stableId: "move-a", version: 1, prompt: "Exact" }],
  }, { id: "after", parentId: before.id, now: 3 });
  const verification = verifyObservedEffects({
    before,
    after,
    expected: [{ type: "exists", stableId: "move-a" }],
    prohibited: [{ type: "stable-id-removed", stableId: "a" }],
  });
  assert.equal(verification.status, "failed");
  assert.equal(verification.unintended.length, 1);
  const diff = semanticWorkspaceDiff(before, after);
  assert.deepEqual(new Set(diff.changedStableIds), new Set(["a", "move-a"]));
});

test("run ledger persists transitions and resumes without replay metadata loss", () => {
  const storage = new Map();
  const adapter = {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value),
  };
  const goal = normalizeGoal("Create a Move and test it.");
  let run = createRunLedger(goal, { root: { kind: "action", id: "create" } }, { runId: "run-a", mode: "plan", now: 1 });
  run = transitionRun(run, {
    status: "running",
    stepId: "create",
    stepStatus: "completed",
    attempt: 1,
    patch: { value: { id: "move-a" }, evidence: [{ type: "observed" }] },
    checkpoint: { id: "checkpoint-a", fingerprint: "fp" },
    approval: { scope: "phase-1", decision: "accepted" },
  }, { now: 2 });
  persistRunLedger(run, adapter);
  const restored = restoreRunLedger(adapter);
  assert.equal(restored.activeRunId, "run-a");
  assert.equal(restored.runs[0].steps.create.status, "completed");
  assert.equal(restored.runs[0].steps.create.attempts, 1);
  assert.equal(compactHarnessContext(restored.runs[0]).completedStepIds[0], "create");
});

test("plan edits invalidate dependent descendants only", () => {
  const plan = {
    root: {
      kind: "sequence",
      steps: [
        { kind: "action", id: "a" },
        { kind: "action", id: "b", dependsOn: ["a"] },
        { kind: "action", id: "c", dependsOn: ["b"] },
        { kind: "query", id: "independent" },
      ],
    },
  };
  assert.deepEqual(new Set(invalidatePlanDescendants(plan, ["b"]).invalidated), new Set(["b", "c"]));
});

test("mutating workers require isolated non-overlapping snapshots", async () => {
  await assert.rejects(
    () => runBoundedWorkers([
      { kind: "migration-analyst", mutating: true, stableIds: ["move-a"] },
    ], async () => ({})),
    /isolated candidate snapshot/
  );
  await assert.rejects(
    () => runBoundedWorkers([
      { kind: "migration-analyst", mutating: true, stableIds: ["move-a"], candidateSnapshotId: "c1" },
      { kind: "privacy-reviewer", mutating: true, stableIds: ["move-a"], candidateSnapshotId: "c2" },
    ], async () => ({})),
    /concurrent mutation conflict/
  );
  const results = await runBoundedWorkers([
    { kind: "explore" },
    { kind: "evaluator" },
  ], async (request) => ({ kind: request.kind }));
  assert.equal(results.filter((entry) => entry.status === "completed").length, 2);
});

test("research is provider-neutral, citable, read-only, and origin-scoped", async () => {
  const research = createVerifiedResearchTool({
    name: "fixture-browser",
    search: async () => ({
      sources: [{
        title: "Company filing",
        url: "https://filings.example/report",
        publisher: "Example regulator",
        publishedAt: "2026-01-01",
        snippet: "Revenue increased.",
        claimRefs: ["revenue"],
      }],
    }),
  }, { allowedOrigins: ["filings.example"] });
  const result = await research({ question: "What changed?" });
  assert.equal(result.sources[0].publisher, "Example regulator");
  assert.ok(result.sources[0].retrievedAt);
  await assert.rejects(() => research({ question: "Publish this", write: true }), /read-only/);
  await assert.rejects(
    () => createVerifiedResearchTool(null)({ question: "Research" }),
    /not configured/
  );
});

import assert from "node:assert/strict";
import test from "node:test";
import { compileAutomationPearl } from "./automation-pearl.js";
import {
  approveAutomationContextPatch,
  createAutomationRefreshPolicy,
  createAutomationResearchPlan,
  normalizeVerifiedResearchResult,
  proposeAutomationContextPatch,
  undoAutomationContextPatch,
} from "./automation-research.js";

test("research separates public questions from private Lens disclosure", () => {
  assert.throws(() => createAutomationResearchPlan({
    pearlId: "p1",
    publicQuestions: ["current market"],
    privateContext: { thesis: "private" },
  }), /explicit bounded disclosure/);
  const plan = createAutomationResearchPlan({
    pearlId: "p1",
    publicQuestions: ["current market"],
    privateContext: { thesis: "private" },
    privateDisclosureApproved: true,
    privateDisclosureReceiptId: "receipt:1",
  });
  assert.equal(plan.publicQuestions[0], "current market");
  assert.equal(plan.privateDisclosureReceiptId, "receipt:1");
  assert.ok(plan.maxSources <= 10);
});

test("verified sources require URL, title, snippet, date and preserve provider provenance", () => {
  const plan = createAutomationResearchPlan({ pearlId: "p1", questions: ["latest company facts"], maxSources: 2 });
  assert.throws(() => normalizeVerifiedResearchResult({ provider: "fixture", sources: [] }, plan), /unavailable/);
  assert.throws(() => normalizeVerifiedResearchResult({ provider: "fixture", sources: [{ title: "Bad", url: "http://bad.example", snippet: "x", retrievedAt: "2026-07-20" }] }, plan), /HTTPS/);
  const result = normalizeVerifiedResearchResult({
    provider: "fixture-provider",
    model: "claude-fixture",
    sources: [{ id: "s1", title: "Company update", url: "https://example.com/update", snippet: "Verified update", retrievedAt: "2026-07-20T00:00:00Z" }],
  }, plan);
  assert.equal(result.sources[0].title, "Company update");
  assert.equal(result.provider, "fixture-provider");
  assert.equal(result.model, "claude-fixture");
  assert.equal(result.readOnly, true);
});

test("durable research becomes context only after exact-diff approval and can be undone", () => {
  const pearl = compileAutomationPearl("Write a current research memo for a company.", null, { id: "p1" });
  const plan = createAutomationResearchPlan({ pearlId: "p1", questions: ["latest company facts"] });
  const research = normalizeVerifiedResearchResult({
    provider: "fixture",
    sources: [{ id: "s1", title: "Update", url: "https://example.com/update", snippet: "Revenue grew.", retrievedAt: "2026-07-20T00:00:00Z" }],
  }, plan);
  const patch = proposeAutomationContextPatch(pearl, research, [{ key: "revenueTrend", value: "grew", confidence: .8, sourceRefs: ["s1"], expiresAt: "2026-10-20" }]);
  assert.equal(pearl.lenses[0].claims.length, 0);
  assert.equal(patch.status, "review");
  assert.equal(patch.exactDiff[0].operation, "add");
  assert.throws(() => approveAutomationContextPatch(pearl, patch), /explicit/);
  const applied = approveAutomationContextPatch(pearl, patch, { approved: true });
  assert.equal(applied.pearl.lenses[0].claims[0].value, "grew");
  const undone = undoAutomationContextPatch(applied.pearl, patch.id);
  assert.equal(undone.lenses[0].claims.length, 0);
});

test("recurring refresh requires consent and finite budgets", () => {
  assert.deepEqual(createAutomationRefreshPolicy({ enabled: false }), { enabled: false, consentedAt: null });
  assert.throws(() => createAutomationRefreshPolicy({ enabled: true, intervalDays: 7 }), /explicit consent/);
  const policy = createAutomationRefreshPolicy({ enabled: true, consent: true, intervalDays: 7, maxRuns: 999, maxSourcesPerRun: 999 });
  assert.equal(policy.maxRuns, 52);
  assert.equal(policy.maxSourcesPerRun, 10);
  assert.equal(policy.cancellable, true);
});

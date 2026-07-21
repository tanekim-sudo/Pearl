import assert from "node:assert/strict";
import test from "node:test";
import {
  applyPearlPrivacyPatch,
  createPearlPrivacyPolicy,
  createPrivacyAuditReceipt,
  effectivePearlPrivacyPolicy,
  guardPearlPrivacyAction,
  inheritPrivacyForDerivedPearl,
  mergePearlPrivacyPolicies,
  pearlPrivacyObservation,
  proposePearlPrivacyPatch,
  verifyPrivacyAuditChain,
} from "./pearl-privacy-policy.js";
import { executeDomainCommand } from "./domain-commands.js";

test("every default Pearl is local-only, device-only, approval-gated for models", () => {
  const policy = createPearlPrivacyPolicy({ pearlId: "p1" });
  assert.equal(policy.audience, "local-only");
  assert.equal(policy.storage.mode, "device-only");
  assert.equal(policy.disclosure.model.allowed, true);
  assert.equal(policy.disclosure.model.requiresApproval, true);
  assert.equal(policy.disclosure.export.allowed, true);
  assert.equal(policy.disclosure.export.requiresApproval, true);
  assert.equal(policy.disclosure.research.allowed, false);
  assert.equal(policy.disclosure.recipient.allowed, false);
});

test("effective inheritance keeps the most restrictive audience, sensitivity, disclosure and retention", () => {
  const source = createPearlPrivacyPolicy({
    pearlId: "source",
    audience: "selected-people",
    sensitivity: "restricted",
    storage: { mode: "encrypted-account-sync", allowedStores: ["indexeddb", "account-vault"] },
    disclosure: { research: { allowed: true, providers: ["verified-a"], fields: ["public-query"] } },
    retention: { expiresAt: "2026-08-01T00:00:00Z", serverDays: 30 },
  });
  const lens = createPearlPrivacyPolicy({
    pearlId: "lens",
    audience: "private-account",
    sensitivity: "firm-internal",
    storage: { mode: "encrypted-account-sync", allowedStores: ["indexeddb"] },
    disclosure: { research: { allowed: false } },
    retention: { expiresAt: "2026-07-25T00:00:00Z", serverDays: 7 },
  });
  const effective = effectivePearlPrivacyPolicy([source, lens], { pearlId: "derived" });
  assert.equal(effective.audience, "private-account");
  assert.equal(effective.sensitivity, "restricted");
  assert.equal(effective.disclosure.research.allowed, false);
  assert.deepEqual(effective.storage.allowedStores, ["indexeddb"]);
  assert.equal(effective.retention.expiresAt, "2026-07-25T00:00:00.000Z");
  assert.equal(effective.retention.serverDays, 7);
  const derived = inheritPrivacyForDerivedPearl({ id: "result:1", text: "private derived output" }, [source, lens]);
  assert.equal(derived.privacyPolicy.audience, "private-account");
  assert.equal(derived.privacyPolicy.sensitivity, "restricted");
});

test("policy guard blocks denied model, research, share, provider and unauthorized actor", () => {
  const policy = createPearlPrivacyPolicy({
    pearlId: "p1",
    acl: {
      ownerId: "owner",
      grants: [{ subjectType: "user", subjectId: "runner", role: "runner", rights: ["run"] }],
    },
    disclosure: {
      model: { allowed: false },
      research: { allowed: true, providers: ["verified-provider"], requiresApproval: true },
    },
  });
  assert.equal(guardPearlPrivacyAction(policy, "model-call").code, "DISCLOSURE_DENIED");
  assert.equal(guardPearlPrivacyAction(policy, "share").code, "LOCAL_ONLY");
  assert.equal(guardPearlPrivacyAction(policy, "research", { actorId: "runner", provider: "verified-provider" }).code, "PRIVACY_PERMISSION_DENIED");
  assert.equal(guardPearlPrivacyAction(policy, "research", { actorId: "owner", provider: "unapproved" }).code, "PROVIDER_DENIED");
  const approvedProvider = guardPearlPrivacyAction(policy, "research", { actorId: "owner", provider: "verified-provider" });
  assert.equal(approvedProvider.allowed, true);
  assert.equal(approvedProvider.approvalRequired, true);
});

test("organization sharing fails closed without verified membership and current envelope", () => {
  const base = {
    pearlId: "p1",
    audience: "organization",
    storage: { mode: "encrypted-organization-sync" },
    acl: { ownerId: "owner", organizationId: "org-a" },
    disclosure: { recipient: { allowed: true, requiresApproval: true } },
  };
  const missingEnvelope = createPearlPrivacyPolicy(base);
  assert.equal(guardPearlPrivacyAction(missingEnvelope, "organization-share", { organizationId: "org-a", verifiedMembership: true }).code, "ORGANIZATION_KEY_UNAVAILABLE");
  const ready = createPearlPrivacyPolicy({
    ...base,
    encryption: { organizationEnvelopeId: "envelope:1", organizationKeyVersion: 2, rotationState: "current" },
  });
  assert.equal(guardPearlPrivacyAction(ready, "organization-share", { organizationId: "forged-org", verifiedMembership: true }).code, "ORGANIZATION_UNVERIFIED");
  assert.equal(guardPearlPrivacyAction(ready, "organization-share", { organizationId: "org-a", verifiedMembership: false }).code, "ORGANIZATION_UNVERIFIED");
  assert.equal(guardPearlPrivacyAction(ready, "organization-share", { organizationId: "org-a", verifiedMembership: true }).allowed, true);
});

test("privacy relaxations require exact confirmed diff and organization admin", () => {
  const policy = createPearlPrivacyPolicy({
    pearlId: "p1",
    audience: "organization",
    storage: { mode: "encrypted-organization-sync" },
    acl: { ownerId: "owner", organizationId: "org-a" },
    disclosure: { research: { allowed: false } },
  });
  const proposal = proposePearlPrivacyPatch(policy, { disclosure: { research: { allowed: true, requiresApproval: true } } }, { expectedVersion: 1 });
  assert.equal(proposal.relaxation, true);
  assert.equal(proposal.requiresAdmin, true);
  assert.throws(() => applyPearlPrivacyPatch(policy, proposal, { confirmed: true }), /admin/);
  const applied = applyPearlPrivacyPatch(policy, proposal, { confirmed: true, adminVerified: true });
  assert.equal(applied.policy.version, 2);
  assert.equal(applied.policy.disclosure.research.allowed, true);
  assert.equal(applied.checkpoint.previousPolicy.version, 1);
});

test("concurrent policy edits merge restrictively and block until review", () => {
  const base = createPearlPrivacyPolicy({ id: "policy:1", pearlId: "p1", version: 2, audience: "private-account" });
  const local = createPearlPrivacyPolicy({ ...base, version: 3, sensitivity: "restricted" });
  const remote = createPearlPrivacyPolicy({ ...base, version: 3, audience: "public", sensitivity: "public" });
  const merged = mergePearlPrivacyPolicies(local, remote);
  assert.equal(merged.policy.audience, "private-account");
  assert.equal(merged.policy.sensitivity, "restricted");
  assert.equal(merged.conflict.restrictivePolicyApplied, true);
  assert.equal(guardPearlPrivacyAction(merged.policy, "model-call").code, "PRIVACY_CONFLICT");
});

test("companion observation exposes effective policy but not unauthorized organization identity", () => {
  const policy = createPearlPrivacyPolicy({
    pearlId: "p1",
    audience: "organization",
    storage: { mode: "encrypted-organization-sync" },
    acl: { ownerId: "owner", organizationId: "org-a", grants: [{ subjectType: "user", subjectId: "runner", role: "runner", rights: ["run"] }] },
  });
  const outsider = pearlPrivacyObservation(policy, { actorId: "outsider", organizationId: "org-b" });
  assert.equal(outsider.organizationId, null);
  assert.deepEqual(outsider.rights, []);
  const runner = pearlPrivacyObservation(policy, { actorId: "runner", organizationId: "org-a" });
  assert.equal(runner.organizationId, "org-a");
  assert.deepEqual(runner.rights, ["run"]);
});

test("local audit receipts are metadata-only, chained and tamper evident", async () => {
  const first = await createPrivacyAuditReceipt({
    pearlId: "p1",
    policyId: "policy:1",
    policyVersion: 1,
    action: "model-call",
    fieldNames: ["selectedText"],
    byteCount: 42,
  });
  const second = await createPrivacyAuditReceipt({
    pearlId: "p1",
    policyId: "policy:1",
    policyVersion: 1,
    action: "share",
    destinationRef: "opaque:recipient",
    previousHash: first.hash,
  });
  assert.equal(JSON.stringify([first, second]).includes("private content"), false);
  assert.equal((await verifyPrivacyAuditChain([first, second])).valid, true);
  assert.equal((await verifyPrivacyAuditChain([first, { ...second, byteCount: 99 }])).valid, false);
});

test("policy metadata cannot unlock or mutate a cryptographically locked Pearl", async () => {
  const unlocked = createPearlPrivacyPolicy({ pearlId: "locked-pearl" });
  const locked = createPearlPrivacyPolicy({ ...unlocked, version: 2, encryption: { ...unlocked.encryption, status: "locked" } });
  const state = { pearlPrivacyPolicies: { "locked-pearl": locked } };
  await assert.rejects(
    executeDomainCommand("proposePearlPrivacyPatch", state, {
      pearlId: "locked-pearl",
      patch: { audience: "public" },
      expectedVersion: 2,
    }),
    /unlock the encrypted profile/,
  );
  await assert.rejects(
    executeDomainCommand("lockPearlPrivacy", state, { pearlId: "locked-pearl", locked: false }),
    /verified vault unlock/,
  );
  const verified = await executeDomainCommand(
    "lockPearlPrivacy",
    state,
    { pearlId: "locked-pearl", locked: false },
    { vaultUnlockVerified: true },
  );
  assert.equal(verified.result.object.encryption.status, "unlocked");
  await assert.rejects(
    executeDomainCommand("proposePearlPrivacyPatch", { pearlPrivacyPolicies: { "locked-pearl": unlocked } }, {
      pearlId: "locked-pearl",
      patch: { encryption: { status: "locked" } },
      expectedVersion: unlocked.version,
    }),
    /verified vault boundary/,
  );
});

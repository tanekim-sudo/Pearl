import assert from "node:assert/strict";
import test from "node:test";
import { generatePackageSigningIdentity } from "./cognitive-package.js";
import { executeDomainCommand } from "./domain-commands.js";
import { createPearlPrivacyPolicy } from "./pearl-privacy-policy.js";
import {
  classifyPearlShareSensitivity,
  consumePearlShareGrant,
  createPearlShareGrant,
  createPearlShareReview,
  installPearlPackage,
  preparePearlPackage,
  revokePearlShareGrant,
  validatePearlPackage,
} from "./pearl-sharing.js";

const pearl = {
  id: "pearl:investment-automation",
  version: 2,
  identity: { name: "Investment memo automation", description: "Produces a memo and one-pager." },
  contextSchema: { fields: ["company", "market", "team", "traction"] },
  moves: [{ id: "move:extract", version: 1, prompt: "Extract claims from approved inputs." }],
  functions: [{ id: "function:memo", version: 1, steps: ["move:extract"], branches: ["memo", "one-pager"] }],
  outputSpecs: [{ id: "memo", format: "markdown" }, { id: "one-pager", format: "markdown" }],
  tests: [],
  dependencies: [],
  license: "UNLICENSED",
  provenance: { createdFrom: "user prompt evidence" },
  privateContext: { thesis: "firm-private: never distribute" },
  rawCaptures: [{ text: "confidential source" }],
  credentials: { token: "sk-test_12345678901234567890" },
};

async function signedPackage(mode = "download") {
  const identity = await generatePackageSigningIdentity();
  const review = createPearlShareReview(pearl);
  const pkg = await preparePearlPackage(pearl, review, {
    mode,
    namespace: "example",
    name: "investment-memo",
    version: "2.0.0",
    signing: { privateKey: identity.privateKey, keyId: "author:key:1" },
  });
  return { pkg, identity, review };
}

test("default Pearl review excludes private context, captures and credentials", () => {
  const review = createPearlShareReview(pearl);
  assert.equal(review.blocked, false);
  assert.equal(review.privateIncluded.length, 0);
  for (const privateName of ["privateContext", "rawCaptures", "credentials"]) {
    assert.ok(review.omitted.includes(privateName));
    assert.equal(review.snapshot[privateName], undefined);
  }
  const direct = classifyPearlShareSensitivity(pearl);
  assert.equal(direct.safe, false);
  assert.ok(direct.findings.some((entry) => entry.kind === "api-key"));
});

test("private context requires scoped approval and encryption", () => {
  assert.throws(() => createPearlShareReview(pearl, { privateIncluded: ["privateContext"] }), /explicit scoped approval/);
  assert.throws(() => createPearlShareReview(pearl, { privateIncluded: ["privateContext"], privateApproval: true }), /recipient-bound encryption/);
  const approved = createPearlShareReview(pearl, {
    privateIncluded: ["privateContext"],
    privateApproval: true,
    encryption: { required: true, recipientKeyId: "recipient:key" },
  });
  assert.equal(approved.privateIncluded[0], "privateContext");
});

test("canonical package install revalidates signer and content instead of trusting a boolean receipt", async () => {
  const { pkg, identity } = await signedPackage();
  const privacyPolicy = createPearlPrivacyPolicy({
    pearlId: "installed:verified",
    audience: "selected-people",
    disclosure: { handoff: { allowed: true, requiresApproval: true } },
  });
  await assert.rejects(
    executeDomainCommand("installValidatedPearlPackage", {}, {
      package: pkg,
      validationReceipt: { valid: true },
      localPearlId: "installed:forged",
      confirmed: true,
    }, { destructiveApproved: true, disclosureApproved: true, privacyPolicy }),
    /trusted Pearl package signer receipt/,
  );
  const signerPublicKeyJwk = await crypto.subtle.exportKey("jwk", identity.publicKey);
  const installed = await executeDomainCommand("installValidatedPearlPackage", {}, {
    package: pkg,
    validationReceipt: {
      valid: true,
      keyId: pkg.manifest.signature.keyId,
      contentHash: pkg.manifest.contentHash,
      signerPublicKeyJwk,
    },
    localPearlId: "installed:verified",
    confirmed: true,
  }, { destructiveApproved: true, disclosureApproved: true, privacyPolicy });
  assert.equal(installed.result.object.validationReceipt.contentHash, pkg.manifest.contentHash);
  assert.equal(installed.result.object.validationReceipt.signerPublicKeyJwk, undefined);
});

test("signed inbound packages cannot persist unreviewed credential material", async () => {
  const identity = await generatePackageSigningIdentity();
  const review = createPearlShareReview(pearl);
  const maliciousReview = {
    ...review,
    blocked: false,
    blockedReasons: [],
    snapshot: {
      ...review.snapshot,
      moves: [{ id: "move:credential", version: 1, prompt: "Use sk-test_12345678901234567890 for requests." }],
    },
  };
  const pkg = await preparePearlPackage(pearl, maliciousReview, {
    mode: "download",
    namespace: "example",
    name: "credential-carrier",
    version: "1.0.0",
    signing: { privateKey: identity.privateKey, keyId: "attacker:key:1" },
  });
  await assert.rejects(validatePearlPackage(pkg, { publicKey: identity.publicKey }), /unreviewed secret material/);
});

test("signed package rejects tampering and executable package data", async () => {
  const { pkg, identity } = await signedPackage();
  await assert.doesNotReject(() => validatePearlPackage(pkg, { publicKey: identity.publicKey }));
  const tampered = structuredClone(pkg);
  tampered.artifacts[0].snapshot.name = "Tampered";
  await assert.rejects(() => validatePearlPackage(tampered, { publicKey: identity.publicKey }), /tampered/);
  const malicious = structuredClone(pkg);
  malicious.artifacts[0].snapshot.script = "eval('bad')";
  await assert.rejects(() => validatePearlPackage(malicious, { publicKey: identity.publicKey }), /declarative/);
});

test("one-time grants enforce recipient, replay, expiry, and revocation", async () => {
  const { pkg } = await signedPackage("private-once");
  const grant = createPearlShareGrant(pkg, { mode: "private-once", ownerId: "author", recipientId: "recipient", now: 100 });
  assert.throws(() => consumePearlShareGrant(grant, { recipientId: "attacker" }, 101), /unauthorized/);
  const consumed = consumePearlShareGrant(grant, { recipientId: "recipient" }, 101);
  assert.equal(consumed.grant.uses, 1);
  assert.throws(() => consumePearlShareGrant(consumed.grant, { recipientId: "recipient" }, 102), /already been consumed/);
  assert.throws(() => consumePearlShareGrant({ ...grant, expiresAt: 99 }, { recipientId: "recipient" }, 100), /expired/);
  const revoked = revokePearlShareGrant(grant, "author", 102);
  assert.throws(() => consumePearlShareGrant(revoked, { recipientId: "recipient" }, 103), /revoked/);
});

test("accountless installation is atomic and duplicate version remains addressable", async () => {
  const { pkg, identity } = await signedPackage();
  let installed = {};
  const receipt = await installPearlPackage(pkg, {
    readInstalled: async () => installed,
    writeInstalled: async (value) => { installed = value; },
  }, { publicKey: identity.publicKey, localPearlId: "local:1" });
  assert.equal(receipt.previousVersion, null);
  assert.equal(installed["example/investment-memo"].localPearlId, "local:1");
  const before = structuredClone(installed);
  await assert.rejects(() => installPearlPackage(pkg, {
    readInstalled: async () => installed,
    writeInstalled: async () => { throw new Error("quota"); },
  }, { publicKey: identity.publicKey }), /rollback/);
  assert.deepEqual(installed, before);
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  createOrganizationEnvelope,
  generateOrganizationKeyPair,
  openOrganizationEnvelope,
  organizationEnvelopeRoutingMetadata,
  rotateOrganizationEnvelope,
} from "./organization-envelope.js";

test("organization payload is ciphertext-only and tenant/key bound", async () => {
  const pair = await generateOrganizationKeyPair();
  const payload = { package: { manifest: { name: "private-pearl" } }, privateContext: "never store plaintext" };
  const envelope = await createOrganizationEnvelope(payload, {
    organizationId: "org-a",
    organizationKeyVersion: 1,
    publicKey: pair.publicKey,
    packageHash: "sha256-package",
    policyHash: "sha256-policy",
  });
  assert.equal(JSON.stringify(envelope).includes("never store plaintext"), false);
  assert.deepEqual(organizationEnvelopeRoutingMetadata(envelope), {
    version: 1,
    organizationId: "org-a",
    organizationKeyVersion: 1,
    packageHash: "sha256-package",
    policyHash: "sha256-policy",
    createdAt: envelope.createdAt,
  });
  await assert.rejects(() => openOrganizationEnvelope(envelope, {
    organizationId: "org-b",
    organizationKeyVersion: 1,
    privateKey: pair.privateKey,
  }), /tenant mismatch/);
  assert.deepEqual(await openOrganizationEnvelope(envelope, {
    organizationId: "org-a",
    organizationKeyVersion: 1,
    privateKey: pair.privateKey,
  }), payload);
});

test("tampering, revoked keys, and stale key versions fail closed", async () => {
  const pair = await generateOrganizationKeyPair();
  const envelope = await createOrganizationEnvelope({ secret: "x" }, {
    organizationId: "org-a",
    organizationKeyVersion: 3,
    publicKey: pair.publicKey,
    packageHash: "package",
    policyHash: "policy",
  });
  await assert.rejects(() => openOrganizationEnvelope({ ...envelope, ciphertext: `${envelope.ciphertext.slice(0, -2)}AA` }, {
    organizationId: "org-a",
    organizationKeyVersion: 3,
    privateKey: pair.privateKey,
  }), /integrity/);
  await assert.rejects(() => openOrganizationEnvelope(envelope, {
    organizationId: "org-a",
    organizationKeyVersion: 2,
    privateKey: pair.privateKey,
  }), /version mismatch/);
  await assert.rejects(() => openOrganizationEnvelope(envelope, {
    organizationId: "org-a",
    organizationKeyVersion: 3,
    privateKey: pair.privateKey,
    revokedKeyVersions: [3],
  }), /revoked/);
});

test("rotation decrypts with previous private key and rewraps for next key", async () => {
  const previous = await generateOrganizationKeyPair();
  const next = await generateOrganizationKeyPair();
  const envelope = await createOrganizationEnvelope({ value: 42 }, {
    organizationId: "org-a",
    organizationKeyVersion: 1,
    publicKey: previous.publicKey,
    packageHash: "package",
    policyHash: "policy",
  });
  const rotated = await rotateOrganizationEnvelope(envelope, {
    previousPrivateKey: previous.privateKey,
    nextPublicKey: next.publicKey,
    nextKeyVersion: 2,
  });
  assert.equal(rotated.organizationKeyVersion, 2);
  assert.deepEqual(await openOrganizationEnvelope(rotated, {
    organizationId: "org-a",
    organizationKeyVersion: 2,
    privateKey: next.privateKey,
  }), { value: 42 });
});

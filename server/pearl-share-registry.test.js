import assert from "node:assert/strict";
import test from "node:test";
import { generatePackageSigningIdentity } from "../shared/cognitive-package.js";
import { createPearlShareReview, preparePearlPackage } from "../shared/pearl-sharing.js";
import { createPearlShareRegistry } from "./pearl-share-registry.js";

async function fixturePackage(mode = "private-once") {
  const identity = await generatePackageSigningIdentity();
  const pearl = {
    id: "pearl:share-test",
    version: 1,
    identity: { name: "Share test" },
    moves: [{ id: "m1", version: 1, prompt: "Summarize input" }],
    tests: [],
  };
  return preparePearlPackage(pearl, createPearlShareReview(pearl), {
    namespace: "tests",
    name: "share-test",
    version: "1.0.0",
    mode,
    author: { id: "author", publicKey: identity.publicJwk },
    signing: { privateKey: identity.privateKey, keyId: "author:key" },
  });
}

test("hosted Pearl links are opaque and one-time consumption is atomic", async () => {
  const pkg = await fixturePackage();
  let now = 100;
  const registry = createPearlShareRegistry({ now: () => now });
  const created = await registry.create(pkg, {
    ownerId: "author",
    recipientId: "recipient",
    approved: true,
    idempotencyKey: "create:1",
    mode: "private-once",
    expiresAt: 1_000,
  });
  assert.match(created.id, /^[a-zA-Z0-9_-]{32}$/);
  assert.equal(created.id.includes(pkg.manifest.name), false);
  await assert.rejects(() => registry.inspect(created.id, { userId: "attacker" }), /unauthorized/);
  const [first, second] = await Promise.allSettled([
    registry.consume(created.id, { userId: "recipient" }),
    registry.consume(created.id, { userId: "recipient" }),
  ]);
  assert.deepEqual([first.status, second.status].sort(), ["fulfilled", "rejected"]);
  assert.equal(first.status === "fulfilled" ? first.value.package.manifest.contentHash : second.value.package.manifest.contentHash, pkg.manifest.contentHash);
});

test("revocation and expiry fail closed without exposing package content", async () => {
  const pkg = await fixturePackage("unlisted");
  let now = 100;
  const registry = createPearlShareRegistry({ now: () => now });
  const created = await registry.create(pkg, {
    ownerId: "author",
    approved: true,
    idempotencyKey: "create:2",
    mode: "unlisted",
    expiresAt: 200,
  });
  await registry.revoke(created.id, "author");
  await assert.rejects(() => registry.inspect(created.id), /revoked/);
  const second = await registry.create(pkg, {
    ownerId: "author",
    approved: true,
    idempotencyKey: "create:3",
    mode: "unlisted",
    expiresAt: 200,
  });
  now = 201;
  await assert.rejects(() => registry.consume(second.id), /expired/);
});

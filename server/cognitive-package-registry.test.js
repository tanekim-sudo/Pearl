import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  createCognitivePackageManifest,
  generatePackageSigningIdentity,
  signCognitivePackage,
} from "../shared/cognitive-package.js";
import { createCognitivePackageRegistry } from "./cognitive-package-registry.js";

async function signedPackage(overrides = {}) {
  const identity = await generatePackageSigningIdentity();
  const manifest = await createCognitivePackageManifest({
    namespace: "team.alpha",
    name: "review",
    version: "1.0.0",
    visibility: "private",
    artifacts: [{ id: "move-review", version: 1, kind: "move", snapshot: { prompt: "Review." } }],
    tests: [{ id: "fixture", status: "passed", evidenceHash: "sha256-fixture" }],
    author: { id: "user-a", publicKey: identity.publicJwk },
    ...overrides,
  });
  return signCognitivePackage(manifest, { privateKey: identity.privateKey, keyId: "key-a" });
}

test("publish requires identity, approval, signature, and idempotency", async () => {
  const registry = createCognitivePackageRegistry();
  const manifest = await signedPackage();
  await assert.rejects(() => registry.publish(manifest, { approved: true, idempotencyKey: "one" }), /Sign in/);
  await assert.rejects(() => registry.publish(manifest, { userId: "user-a", idempotencyKey: "one" }), /approval/);
  const receipt = await registry.publish(manifest, { userId: "user-a", approved: true, idempotencyKey: "one" });
  assert.equal(receipt.type, "package-publish-receipt");
  assert.deepEqual(
    await registry.publish(manifest, { userId: "user-a", approved: true, idempotencyKey: "repeat" }),
    receipt
  );
});

test("private isolation, immutable versions, pagination, and owner deprecation are enforced", async () => {
  const registry = createCognitivePackageRegistry();
  const manifest = await signedPackage();
  await registry.publish(manifest, { userId: "user-a", approved: true, idempotencyKey: "publish" });
  assert.equal((await registry.list({ userId: "other" })).packages.length, 0);
  assert.equal((await registry.list({ userId: "user-a", limit: 1 })).packages[0].trust.signature, "verified");
  await assert.rejects(
    () => registry.publish({ ...manifest, contentHash: "sha256-tampered" }, { userId: "user-a", approved: true, idempotencyKey: "tamper" }),
    /content hash mismatch/
  );
  await assert.rejects(
    () => registry.deprecate({ namespace: "team.alpha", name: "review", version: "1.0.0" }, { userId: "other", approved: true, idempotencyKey: "no" }),
    /owner/
  );
  const receipt = await registry.deprecate(
    { namespace: "team.alpha", name: "review", version: "1.0.0", replacement: "1.1.0" },
    { userId: "user-a", approved: true, idempotencyKey: "deprecate" }
  );
  assert.equal(receipt.replacement, "1.1.0");
});

test("unconfigured registry fallback is bounded instead of growing without limit", async () => {
  const registry = createCognitivePackageRegistry({ maxLocalPackages: 1 });
  const first = await signedPackage({ name: "first" });
  const second = await signedPackage({ name: "second" });
  await registry.publish(first, { userId: "user-a", approved: true, idempotencyKey: "first" });
  await registry.publish(second, { userId: "user-a", approved: true, idempotencyKey: "second" });
  const listed = await registry.list({ userId: "user-a" });
  assert.equal(listed.packages.length, 1);
  assert.equal(listed.packages[0].name, "second");
});

test("durable registry migration declares immutable account and team scoped RLS storage", () => {
  const migration = fs.readFileSync(new URL("../supabase/migrations/20260716213000_cognitive_packages.sql", import.meta.url), "utf8");
  assert.match(migration, /create table if not exists public\.cognitive_packages/);
  assert.match(migration, /unique \(namespace, name, version\)/);
  assert.match(migration, /alter table public\.cognitive_packages enable row level security/);
  assert.match(migration, /visibility in \('public', 'unlisted'\)/);
  assert.match(migration, /cognitive_package_team_members/);
  assert.match(migration, /auth\.uid\(\) = owner_id/);
});

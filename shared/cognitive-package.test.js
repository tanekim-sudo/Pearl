import test from "node:test";
import assert from "node:assert/strict";
import {
  canonicalPackageJson,
  createCognitivePackageManifest,
  generatePackageSigningIdentity,
  installCognitivePackageAtomic,
  resolvePackageDependencies,
  signCognitivePackage,
  validateCognitivePackageManifest,
  verifyCognitivePackage,
} from "./cognitive-package.js";

const evidenceHash = "sha256-evidence";

async function draft(overrides = {}) {
  return createCognitivePackageManifest({
    namespace: "lens.team",
    name: "diligence",
    version: "1.0.0",
    visibility: "private",
    artifacts: [{
      id: "move-a",
      version: 1,
      kind: "move",
      snapshot: { prompt: "Challenge assumptions." },
    }],
    tests: [{ id: "fixture-a", status: "passed", evidenceHash }],
    ...overrides,
  });
}

test("canonical manifests hash and verify with non-extractable Ed25519 keys", async () => {
  const manifest = await draft();
  const identity = await generatePackageSigningIdentity();
  assert.equal(identity.privateKey.extractable, false);
  const signed = await signCognitivePackage(manifest, {
    privateKey: identity.privateKey,
    keyId: "team-key-1",
  });
  assert.equal((await verifyCognitivePackage(signed, { publicKey: identity.publicKey })).valid, true);
  assert.equal(canonicalPackageJson({ b: 2, a: 1 }), '{"a":1,"b":2}');
});

test("tampering, revocation, executable data, and false test claims fail safely", async () => {
  const manifest = await draft();
  const identity = await generatePackageSigningIdentity();
  const signed = await signCognitivePackage(manifest, { privateKey: identity.privateKey, keyId: "revocable" });
  await assert.rejects(
    () => verifyCognitivePackage({ ...signed, name: "tampered" }, { publicKey: identity.publicKey }),
    /content hash mismatch/
  );
  await assert.rejects(
    () => verifyCognitivePackage(signed, { publicKey: identity.publicKey, revokedKeyIds: ["revocable"] }),
    /revoked/
  );
  assert.throws(
    () => validateCognitivePackageManifest({ ...manifest, artifacts: [{ ...manifest.artifacts[0], script: "eval('x')" }] }),
    /not declarative/
  );
  assert.throws(
    () => validateCognitivePackageManifest({ ...manifest, tests: [{ status: "passed" }] }),
    /evidence hashes/
  );
});

test("dependency closure is deterministic and detects cycles and confusion", async () => {
  const dependency = await draft({ namespace: "lens.team", name: "base", version: "1.0.0", dependencies: [] });
  const root = await draft({
    dependencies: [{ namespace: "lens.team", name: "base", version: "1.0.0" }],
  });
  assert.deepEqual(resolvePackageDependencies(root, [root, dependency]).map((entry) => entry.name), ["base", "diligence"]);
  assert.throws(
    () => resolvePackageDependencies(root, [root, { ...dependency, dependencies: [{ namespace: "lens.team", name: "diligence", version: "1.0.0" }] }]),
    /cycle/
  );
  assert.throws(
    () => resolvePackageDependencies(root, [root, { ...dependency, namespace: "attacker" }]),
    /unavailable/
  );
});

test("atomic install is idempotent and restores storage failure", async () => {
  const pkg = await draft();
  let installed = {};
  const receipt = await installCognitivePackageAtomic(pkg, {
    verify: async () => true,
    readInstalled: async () => installed,
    writeInstalled: async (value) => { installed = value; },
  });
  assert.equal(receipt.type, "package-install-receipt");
  const repeated = await installCognitivePackageAtomic(pkg, {
    verify: async () => true,
    readInstalled: async () => installed,
    writeInstalled: async (value) => { installed = value; },
  });
  assert.equal(repeated.previousVersion, "1.0.0");

  let writes = 0;
  const before = installed;
  const upgraded = await draft({ version: "1.1.0" });
  await assert.rejects(() => installCognitivePackageAtomic(upgraded, {
    verify: async () => true,
    readInstalled: async () => installed,
    writeInstalled: async (value) => {
      writes += 1;
      if (writes === 1) throw new Error("quota");
      installed = value;
    },
  }), /rolled back/);
  assert.deepEqual(installed, before);
});

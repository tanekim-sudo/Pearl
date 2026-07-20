import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import {
  createDisclosureReceipt,
  createLocalPrivacyVault,
  openLocalPrivacyEnvelope,
  privacyProfileHash,
  redactPrivacyDiagnostic,
} from "./local-privacy-vault.js";

function stores() {
  const keys = new Map();
  const envelopes = new Map();
  return {
    keys,
    envelopes,
    keyStore: {
      get: async (id) => keys.get(id),
      set: async (id, value) => keys.set(id, value),
      remove: async (id) => keys.delete(id),
    },
    envelopeStore: {
      get: async (id) => envelopes.get(id),
      set: async (id, value) => envelopes.set(id, structuredClone(value)),
      remove: async (id) => envelopes.delete(id),
    },
  };
}

test("anonymous and authenticated profiles are encrypted and strictly isolated", async () => {
  const backing = stores();
  const anonymous = createLocalPrivacyVault({ profileId: "anonymous", ...backing, crypto: webcrypto });
  const accountA = createLocalPrivacyVault({ profileId: "user-a", ...backing, crypto: webcrypto });
  const accountB = createLocalPrivacyVault({ profileId: "user-b", ...backing, crypto: webcrypto });
  await anonymous.write({ pearls: [{ id: "anon", name: "private anonymous" }] });
  await accountA.write({ pearls: [{ id: "a", name: "private a" }] });
  await accountB.write({ pearls: [{ id: "b", name: "private b" }] });
  assert.equal((await anonymous.read()).pearls[0].id, "anon");
  assert.equal((await accountA.read()).pearls[0].id, "a");
  assert.equal((await accountB.read()).pearls[0].id, "b");
  const serialized = JSON.stringify([...backing.envelopes.values()]);
  assert.doesNotMatch(serialized, /private anonymous|private a|private b/);
});

test("concurrent vault initialization creates exactly one non-extractable profile key", async () => {
  const backing = stores();
  let keyWrites = 0;
  const vault = createLocalPrivacyVault({
    profileId: "concurrent-profile",
    ...backing,
    keyStore: {
      get: async (id) => {
        await new Promise((resolve) => setTimeout(resolve, 2));
        return backing.keys.get(id);
      },
      set: async (id, value) => {
        keyWrites += 1;
        backing.keys.set(id, value);
      },
    },
    crypto: webcrypto,
  });
  const initialized = await Promise.all([vault.ready(), vault.ready(), vault.ready()]);
  assert.equal(keyWrites, 1);
  assert.equal(initialized[0].key, initialized[1].key);
  assert.equal(initialized[0].key.extractable, false);
});

test("wrong keys, cross-profile envelopes, and corruption fail closed", async () => {
  const left = stores();
  const right = stores();
  const vault = createLocalPrivacyVault({ profileId: "user-a", ...left, crypto: webcrypto });
  const envelope = await vault.write({ context: "secret" });
  const profileHash = await privacyProfileHash("user-a", webcrypto);
  await assert.rejects(
    openLocalPrivacyEnvelope(envelope, {
      profileHash,
      key: await (createLocalPrivacyVault({ profileId: "user-a", ...right, crypto: webcrypto })).ready().then((v) => v.key),
      crypto: webcrypto,
    }),
    /locked or corrupted/,
  );
  await assert.rejects(
    openLocalPrivacyEnvelope({ ...envelope, profileHash: await privacyProfileHash("user-b", webcrypto) }, {
      profileHash,
      key: (await vault.ready()).key,
      crypto: webcrypto,
    }),
    /mismatch/,
  );
  const corrupt = { ...envelope, ciphertext: envelope.ciphertext.slice(0, -4) + "AAAA" };
  await assert.rejects(
    openLocalPrivacyEnvelope(corrupt, { profileHash, key: (await vault.ready()).key, crypto: webcrypto }),
    /locked or corrupted/,
  );
});

test("passphrase wrapping survives restart, rejects wrong secrets, locks, and deletes key plus envelope", async () => {
  const backing = stores();
  const secret = "correct horse battery staple";
  const vault = createLocalPrivacyVault({ profileId: "protected-user", ...backing, crypto: webcrypto });
  await vault.write({ result: "private" });
  const protectedState = await vault.protect(secret);
  assert.equal(protectedState.protected, true);
  vault.lock();
  await assert.rejects(vault.read(), /locked/);
  await assert.rejects(vault.unlock("definitely wrong secret"), /incorrect/);
  await vault.unlock(secret);
  assert.equal((await vault.read()).result, "private");

  const restarted = createLocalPrivacyVault({ profileId: "protected-user", ...backing, crypto: webcrypto });
  await assert.rejects(restarted.read(), /locked/);
  await restarted.unlock(secret);
  assert.equal((await restarted.read()).result, "private");
  const receipt = await restarted.clear();
  assert.equal(receipt.deleted, true);
  assert.equal(backing.keys.size, 0);
  assert.equal(backing.envelopes.size, 0);
});

test("corrupt wrapped keys and interrupted wrapping migration fail closed without deleting recovery material", async () => {
  const backing = stores();
  const vault = createLocalPrivacyVault({ profileId: "migration-user", ...backing, crypto: webcrypto });
  await vault.write({ canvas: "preserve" });
  await vault.protect("migration passphrase");
  const profileHash = await privacyProfileHash("migration-user", webcrypto);
  const wrapped = backing.keys.get(profileHash);
  backing.keys.set(profileHash, { ...wrapped, wrappedKey: `${wrapped.wrappedKey.slice(0, -4)}AAAA` });
  const restarted = createLocalPrivacyVault({ profileId: "migration-user", ...backing, crypto: webcrypto });
  await assert.rejects(restarted.unlock("migration passphrase"), /incorrect/);
  assert.ok(backing.envelopes.has(profileHash));
});

test("interrupted wrapping restores the verified legacy envelope instead of destroying data", async () => {
  const backing = stores();
  const profileId = "interrupted-wrap";
  const vault = createLocalPrivacyVault({ profileId, ...backing, crypto: webcrypto });
  await vault.write({ result: "must survive" });
  let failNextEnvelope = true;
  const interrupted = createLocalPrivacyVault({
    profileId,
    keyStore: backing.keyStore,
    envelopeStore: {
      ...backing.envelopeStore,
      set: async (id, value) => {
        if (failNextEnvelope) {
          failNextEnvelope = false;
          throw new Error("simulated interruption");
        }
        backing.envelopes.set(id, structuredClone(value));
      },
    },
    crypto: webcrypto,
  });
  await assert.rejects(interrupted.protect("recovery passphrase"), /interruption/);
  const restarted = createLocalPrivacyVault({ profileId, ...backing, crypto: webcrypto });
  const unlocked = await restarted.unlock("recovery passphrase");
  assert.equal(unlocked.migrationRecovered, true);
  assert.equal((await restarted.read()).result, "must survive");
});

test("plaintext migration verifies before removal and remains retry-safe", async () => {
  const backing = stores();
  const vault = createLocalPrivacyVault({ profileId: "anonymous", ...backing, crypto: webcrypto });
  const removed = [];
  const first = await vault.migrate({ oldPearls: "[private]" }, async (keys) => removed.push(...keys));
  assert.equal(first.migrated, 1);
  assert.deepEqual(removed, ["oldPearls"]);
  const second = await vault.migrate({ oldPearls: "[private]" }, async () => {});
  assert.equal(second.migrated, 1);
  assert.equal((await vault.read()).oldPearls, "[private]");

  const failing = createLocalPrivacyVault({
    profileId: "user-fail",
    keyStore: backing.keyStore,
    envelopeStore: { ...backing.envelopeStore, set: async () => { throw new Error("interrupted"); } },
    crypto: webcrypto,
  });
  let plaintextRemoved = false;
  await assert.rejects(failing.migrate({ pearl: "keep me" }, async () => { plaintextRemoved = true; }), /interrupted/);
  assert.equal(plaintextRemoved, false);
});

test("disclosure receipts and diagnostics contain no captured text, tokens, or URLs", async () => {
  const receipt = await createDisclosureReceipt({
    fragmentIds: ["fragment-private-a"],
    action: "generate",
    disclosedCharacters: 42,
    destination: "configured-model",
    at: "2026-07-20T00:00:00.000Z",
  }, webcrypto);
  assert.equal(receipt.fragmentCount, 1);
  assert.equal(receipt.disclosedCharacters, 42);
  assert.doesNotMatch(JSON.stringify(receipt), /fragment-private-a|captured text/i);
  const diagnostic = redactPrivacyDiagnostic(new Error(
    "access_token=secret Bearer abc.def prompt:'private context' https://example.test/?token=secret",
  ));
  assert.doesNotMatch(JSON.stringify(diagnostic), /secret|abc\.def|private context|example\.test/);
});

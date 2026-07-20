import test from "node:test";
import assert from "node:assert/strict";
import { consumeSecureHandoff, createSecureHandoff, pruneSecureHandoffs } from "./secure-handoff.js";

const nonce = "0123456789abcdef0123456789abcdef";
const claims = {
  profileHash: "profile-a",
  tabId: 42,
  origin: "https://representation-eta.vercel.app",
  scope: "workspace-web",
};

test("approved handoffs are bounded, profile/tab/origin scoped, and consumed exactly once", () => {
  const record = createSecureHandoff({ nonce, ...claims, payload: { session: { fragments: [{ id: "a" }] } } }, 100);
  const first = consumeSecureHandoff({ [nonce]: record }, nonce, claims, 101);
  assert.equal(first.payload.session.fragments[0].id, "a");
  assert.deepEqual(first.records, {});
  assert.throws(() => consumeSecureHandoff(first.records, nonce, claims, 102), /unavailable/);
});

test("spoof, profile mismatch, tab mismatch, scope mismatch, and expiry fail closed", () => {
  const record = createSecureHandoff({ nonce, ...claims, payload: { approved: true }, ttlMs: 1_000 }, 100);
  for (const mismatch of [
    { profileHash: "profile-b" },
    { tabId: 99 },
    { origin: "https://attacker.example" },
    { scope: "result-web" },
  ]) {
    assert.throws(() => consumeSecureHandoff({ [nonce]: record }, nonce, { ...claims, ...mismatch }, 101), /mismatch/);
  }
  assert.throws(() => consumeSecureHandoff({ [nonce]: record }, nonce, claims, 1_101), /expired/);
  assert.deepEqual(pruneSecureHandoffs({ [nonce]: record }, 1_101), {});
});

test("handoff payload limit rejects oversized local disclosure atomically", () => {
  assert.throws(() => createSecureHandoff({
    nonce,
    ...claims,
    payload: { text: "x".repeat(600_000) },
  }), /disclosure limit/);
});

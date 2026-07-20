import test from "node:test";
import assert from "node:assert/strict";
import { validateExternalAction, validateExternalHandoff } from "./external-handoff.js";

const sender = { url: "https://representation-eta.vercel.app/?handoff=result-pearl" };
const nonce = "0123456789abcdef0123456789abcdef";

test("trusted result handoff accepts only a nonce store reference", () => {
  const action = validateExternalAction({ type: "pearl-result-handoff", version: 1, nonce }, sender);
  assert.equal(action.type, "pearl-result-handoff");
  assert.equal(action.nonce, nonce);
  assert.throws(() => validateExternalAction({
    type: "pearl-result-handoff",
    version: 1,
    nonce,
    result: { text: "must not cross the URL boundary" },
  }, sender), /invalid external message/);
});

test("untrusted origins and malformed or replay-shaped payloads fail closed", () => {
  assert.throws(() => validateExternalAction(
    { type: "pearl-result-handoff", version: 1, nonce },
    { url: "https://attacker.example/" },
  ), /untrusted/);
  assert.throws(() => validateExternalAction(
    { type: "pearl-result-handoff", version: 1, nonce: "short" },
    sender,
  ), /invalid external schema/);
  assert.throws(() => validateExternalHandoff(
    { type: "lens-library-handoff", version: 1, nonce, bundle: {}, authToken: "forbidden" },
    sender,
  ), /invalid handoff message/);
});

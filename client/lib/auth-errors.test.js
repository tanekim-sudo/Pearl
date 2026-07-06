import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  describeAuthError,
  resendCooldownRemaining,
  RESEND_COOLDOWN_MS,
  AUTH_MIN_PASSWORD_LENGTH,
} from "./auth-errors.js";

describe("describeAuthError", () => {
  it("offers a resend action for email_not_confirmed", () => {
    const d = describeAuthError("email_not_confirmed");
    assert.equal(d.action, "resend");
    assert.match(d.message, /confirm/i);
  });

  it("explains the wait for over_email_send_rate_limit", () => {
    const d = describeAuthError("over_email_send_rate_limit");
    assert.equal(d.action, null);
    assert.match(d.message, /wait/i);
  });

  it("routes expired recovery links back to a new reset request", () => {
    const d = describeAuthError("otp_expired", "recovery");
    assert.equal(d.action, "reset-request");
    assert.match(d.message, /expired/i);
  });

  it("offers resend plus sign-in for expired signup links", () => {
    const d = describeAuthError("otp_expired", "signup");
    assert.equal(d.action, "resend");
    assert.equal(d.secondaryAction, "sign-in");
  });

  it("names the minimum length for weak_password", () => {
    const d = describeAuthError("weak_password");
    assert.match(d.message, new RegExp(String(AUTH_MIN_PASSWORD_LENGTH)));
  });

  it("gives specific copy for same_password on update", () => {
    const d = describeAuthError("same_password");
    assert.match(d.message, /different/i);
  });

  it("falls back to one generic message for unknown codes", () => {
    const unknown = describeAuthError("totally_new_code");
    const missing = describeAuthError(undefined);
    assert.equal(unknown.message, missing.message);
    assert.equal(unknown.action, null);
  });
});

describe("resendCooldownRemaining", () => {
  const now = 1_750_000_000_000;

  it("returns the full cooldown right after sending", () => {
    assert.equal(resendCooldownRemaining(now, now), RESEND_COOLDOWN_MS);
  });

  it("returns the remainder mid-window", () => {
    assert.equal(resendCooldownRemaining(now - 25_000, now), RESEND_COOLDOWN_MS - 25_000);
  });

  it("returns zero once the cooldown has elapsed", () => {
    assert.equal(resendCooldownRemaining(now - RESEND_COOLDOWN_MS, now), 0);
    assert.equal(resendCooldownRemaining(now - RESEND_COOLDOWN_MS - 1, now), 0);
  });

  it("returns zero when no timestamp is stored", () => {
    assert.equal(resendCooldownRemaining(null, now), 0);
    assert.equal(resendCooldownRemaining(undefined, now), 0);
    assert.equal(resendCooldownRemaining("", now), 0);
    assert.equal(resendCooldownRemaining("not-a-number", now), 0);
  });

  it("treats a future timestamp (clock skew) as a fresh cooldown", () => {
    assert.equal(resendCooldownRemaining(now + 5_000, now), RESEND_COOLDOWN_MS);
  });
});

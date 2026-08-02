import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CLIENT_SUPABASE_ENV,
  SERVER_SUPABASE_ENV,
  describeAccountsUnavailable,
  describeAuthFailure,
  describeAccountPanel,
} from "./account-setup.js";

describe("describeAccountsUnavailable", () => {
  it("names exact client and server env vars with next steps", () => {
    const blocker = describeAccountsUnavailable();
    assert.equal(blocker.code, "needs-credentials");
    assert.match(blocker.title, /aren.t set up|not set up/i);
    assert.match(blocker.message, /locally/i);
    assert.ok(blocker.nextSteps.length >= 2);
    for (const key of CLIENT_SUPABASE_ENV) {
      assert.ok(blocker.nextSteps.some((step) => step.includes(key)), `missing ${key}`);
    }
    for (const key of SERVER_SUPABASE_ENV) {
      assert.ok(blocker.nextSteps.some((step) => step.includes(key)), `missing ${key}`);
    }
    assert.doesNotMatch(blocker.message, /state of the art|production-ready|unknown error/i);
  });
});

describe("describeAuthFailure", () => {
  it("returns the accounts blocker when not configured", () => {
    const d = describeAuthFailure(new Error("boom"), { configured: false });
    assert.equal(d.code, "needs-credentials");
    assert.ok(d.blocker);
    assert.match(d.message, /locally/i);
  });

  it("maps network failures to a reachable next step", () => {
    const d = describeAuthFailure(new TypeError("Failed to fetch"), { configured: true });
    assert.equal(d.code, "service_unreachable");
    assert.match(d.message, /VITE_SUPABASE_URL/);
  });

  it("returns null for ordinary credential failures so callers use describeAuthError", () => {
    assert.equal(
      describeAuthFailure({ code: "invalid_credentials", message: "Invalid login credentials" }, { configured: true }),
      null
    );
  });
});

describe("describeAccountPanel", () => {
  it("shows an honest unavailable mode without a Sign in affordance", () => {
    const panel = describeAccountPanel({ accountsConfigured: false, email: null, syncEnabled: false });
    assert.equal(panel.mode, "unavailable");
    assert.equal(panel.canSignIn, false);
    assert.equal(panel.canToggleSync, false);
    assert.ok(panel.nextSteps.length >= 2);
    assert.match(panel.status, /locally|Supabase/i);
  });

  it("requires sign-in before sync when configured but anonymous", () => {
    const panel = describeAccountPanel({
      accountsConfigured: true,
      email: null,
      syncEnabled: false,
      sessionResolved: true,
    });
    assert.equal(panel.mode, "local");
    assert.equal(panel.canSignIn, true);
    assert.equal(panel.canToggleSync, false);
    assert.match(panel.syncHint, /Sign in first/i);
  });

  it("allows sync toggle only when signed in", () => {
    const panel = describeAccountPanel({
      accountsConfigured: true,
      email: "user@example.com",
      syncEnabled: false,
      sessionResolved: true,
    });
    assert.equal(panel.mode, "signed-in");
    assert.equal(panel.canSignOut, true);
    assert.equal(panel.canToggleSync, true);
    assert.match(panel.status, /user@example.com/);
  });

  it("waits while the session is unresolved", () => {
    const panel = describeAccountPanel({
      accountsConfigured: true,
      email: null,
      sessionResolved: false,
    });
    assert.equal(panel.mode, "resolving");
    assert.equal(panel.canSignIn, false);
  });
});

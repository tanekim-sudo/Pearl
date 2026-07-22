import test from "node:test";
import assert from "node:assert/strict";
import { configuredOrigins, corsOptions, idempotencyKey, resetHttpSecurityForTests } from "./http-security.js";
import { requireExtensionUser } from "./extension-api.js";

test("production CORS is allowlist-only and supports configured extension ids", () => {
  const env = { NODE_ENV: "production", CORS_ALLOWED_ORIGINS: "https://lens.example", EXTENSION_IDS: "abc" };
  const origins = configuredOrigins(env);
  assert.equal(origins.has("http://localhost:5173"), false);
  assert.equal(origins.has("https://lens.example"), true);
  assert.equal(origins.has("chrome-extension://abc"), true);
  corsOptions(env).origin("https://evil.example", (error, allow) => {
    assert.equal(error, null);
    assert.equal(allow, false);
  });
});

test("local CORS allows both localhost and 127.0.0.1 for Vite and API ports", () => {
  const env = { NODE_ENV: "development", PORT: "8787" };
  const origins = configuredOrigins(env);
  assert.equal(origins.has("http://localhost:5173"), true);
  assert.equal(origins.has("http://127.0.0.1:5173"), true);
  assert.equal(origins.has("http://localhost:8787"), true);
  assert.equal(origins.has("http://127.0.0.1:8787"), true);
  corsOptions(env).origin("http://127.0.0.1:8787", (error, allow) => {
    assert.equal(error, null);
    assert.equal(allow, true);
  });
  corsOptions(env).origin("https://evil.example", (error, allow) => {
    assert.equal(error, null);
    assert.equal(allow, false);
  });
});

test("idempotency keys are scoped to the authenticated user", () => {
  resetHttpSecurityForTests();
  const req = { headers: { "idempotency-key": "request-123" }, lensUser: { user: { id: "user-1" } } };
  assert.equal(idempotencyKey(req), "user-1:request-123");
  assert.equal(idempotencyKey({ headers: { "idempotency-key": "bad" } }), "");
});

test("extension auth remains available for unconfigured local development", async () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "test";
  const response = { status() { return this; }, json() { throw new Error("should not reject"); } };
  const identity = await requireExtensionUser({ headers: {} }, response);
  assert.equal(identity.user.id, "local-development");
  process.env.NODE_ENV = previous;
});

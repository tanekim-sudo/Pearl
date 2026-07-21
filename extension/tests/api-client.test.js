import test from "node:test";
import assert from "node:assert/strict";

import { apiRequest } from "../src/background/api-client.js";

function installBrowser({ token = "", status = 200, payload = { output: "ok" } } = {}) {
  const areas = {
    local: { apiOrigin: "https://lens.example" },
    session: token ? { accessToken: token, unrelated: "keep-private" } : {},
  };
  const removed = [];
  globalThis.chrome = {
    runtime: { lastError: null },
    storage: Object.fromEntries(Object.entries(areas).map(([name, values]) => [name, {
      get(keys, done) {
        if (keys == null) return done({ ...values });
        const requested = Array.isArray(keys) ? keys : [keys];
        done(Object.fromEntries(requested.filter((key) => key in values).map((key) => [key, values[key]])));
      },
      set(input, done) { Object.assign(values, input); done(); },
      remove(keys, done) {
        for (const key of Array.isArray(keys) ? keys : [keys]) delete values[key];
        removed.push({ area: name, keys });
        done();
      },
    }])),
  };
  let request;
  globalThis.fetch = async (url, init) => {
    request = { url: String(url), init };
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => payload,
    };
  };
  return { areas, removed, request: () => request };
}

test("authenticated extension API requests attach the session token only as a Bearer header", async () => {
  const harness = installBrowser({ token: "session-secret" });
  await apiRequest("/api/run", { method: "POST", body: { prompt: "plan" } });
  const request = harness.request();
  assert.equal(request.init.headers.authorization, "Bearer session-secret");
  assert.equal(request.init.credentials, "omit");
  assert.doesNotMatch(request.init.body, /session-secret|authorization|accessToken/);
});

test("expired extension sessions are cleared and reported without token leakage", async () => {
  const harness = installBrowser({
    token: "expired-secret",
    status: 401,
    payload: { error: "Sign in required to use AI features." },
  });
  await assert.rejects(
    () => apiRequest("/api/run", { method: "POST", body: { prompt: "plan" } }),
    (error) => {
      assert.equal(error.code, "AUTH_EXPIRED");
      assert.match(error.message, /session expired/i);
      assert.doesNotMatch(error.message, /expired-secret/);
      return true;
    },
  );
  assert.equal(harness.areas.session.accessToken, undefined);
  assert.ok(harness.removed.some((entry) => entry.area === "session" && entry.keys.includes("accessToken")));
});

test("signed-out extension requests fail before network access", async () => {
  const harness = installBrowser();
  await assert.rejects(
    () => apiRequest("/api/run", { method: "POST", body: { prompt: "plan" } }),
    (error) => error.code === "AUTH_REQUIRED" && /sign in required/i.test(error.message),
  );
  assert.equal(harness.request(), undefined);
});

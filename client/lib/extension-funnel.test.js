import test from "node:test";
import assert from "node:assert/strict";
import { configuredExtensionId, detectExtensionBrowser, requestTrustedExtensionHandoff, validChromeStoreUrl } from "./extension-funnel.js";

test("Chrome store URL must be an official secure listing", () => {
  assert.match(validChromeStoreUrl("https://chromewebstore.google.com/detail/lens/abc"), /^https:/);
  assert.equal(validChromeStoreUrl("https://example.com/fake-store"), "");
  assert.equal(validChromeStoreUrl("javascript:alert(1)"), "");
});

test("extension browser messaging distinguishes supported desktop browsers", () => {
  assert.deepEqual(detectExtensionBrowser("Chrome/126.0 Safari/537.36"), { name: "Chrome", supported: true });
  assert.deepEqual(detectExtensionBrowser("Chrome/126.0 Edg/126.0"), { name: "Edge", supported: true });
  assert.deepEqual(detectExtensionBrowser("Firefox/128.0"), { name: "Firefox", supported: false });
  assert.deepEqual(detectExtensionBrowser("Version/17.0 Safari/605.1.15"), { name: "Safari", supported: false });
});

test("workspace handoff degrades safely without a trusted extension", async () => {
  assert.deepEqual(await requestTrustedExtensionHandoff(""), { connected: false, handoff: null, reason: "invalid-token" });
  assert.equal(configuredExtensionId(""), "");
  assert.equal(
    await requestTrustedExtensionHandoff("0123456789abcdef0123456789abcdef", "").then((entry) => entry.reason),
    "missing-extension-id",
  );
});

test("workspace handoff requires the extension-issued nonce and never requests general private state", async () => {
  const sent = [];
  globalThis.chrome = {
    runtime: {
      lastError: null,
      sendMessage(extensionId, message, done) {
        sent.push({ extensionId, message });
        done({ ok: true, value: { type: "pearl-workspace-handoff", session: { fragments: [] } } });
      },
    },
  };
  const token = "0123456789abcdef0123456789abcdef";
  const value = await requestTrustedExtensionHandoff(token, "trusted-extension");
  assert.equal(value.connected, true);
  assert.equal(value.reason, "ok");
  assert.deepEqual(sent[0].message, { type: "pearl-workspace-handoff", version: 1, nonce: token });
  assert.equal(await requestTrustedExtensionHandoff("spoof", "trusted-extension").then((entry) => entry.connected), false);
  delete globalThis.chrome;
});

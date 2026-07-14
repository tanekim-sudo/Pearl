import test from "node:test";
import assert from "node:assert/strict";
import { detectExtensionBrowser, validChromeStoreUrl } from "./extension-funnel.js";

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

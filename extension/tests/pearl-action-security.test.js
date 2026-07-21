import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import {
  assertPrivilegedExtensionSurface,
  assertServerVerifiedPearlCommand,
} from "../src/core/security.js";

test("content-script origins cannot invoke privileged Pearl actions", () => {
  const extensionId = "abcdefghijklmnop";
  assert.throws(
    () => assertPrivilegedExtensionSurface({ id: extensionId, url: "https://hostile.example/article", tab: { id: 7 } }, extensionId),
    /content scripts cannot execute privileged Pearl actions/,
  );
  assert.equal(
    assertPrivilegedExtensionSurface({ id: extensionId, url: `chrome-extension://${extensionId}/sidepanel.html` }, extensionId),
    true,
  );
  assert.throws(
    () => assertPrivilegedExtensionSurface({ id: extensionId, url: "chrome-extension://other/result.html" }, extensionId),
    /origin mismatch/,
  );
});

test("organization-admin truth never comes from Pearl action arguments", () => {
  assert.throws(
    () => assertServerVerifiedPearlCommand("rotatePearlOrganizationKey", {}),
    /authenticated server boundary/,
  );
  assert.throws(
    () => assertServerVerifiedPearlCommand("applyPearlPrivacyPatch", { adminVerified: true }),
    /authenticated server boundary/,
  );
  assert.equal(assertServerVerifiedPearlCommand("inspectPearlPrivacy", {}), true);
});

test("page-derived routing summaries are escaped before result Pearl HTML", () => {
  const source = fs.readFileSync(path.resolve(import.meta.dirname, "../src/content/result-pearls.js"), "utf8");
  assert.match(source, /escapeHtml\(routing\.plan\?\.summary/);
  assert.match(source, /escapeHtml\(routing\?\.clarification/);
  assert.doesNotMatch(source, /\$\{routing\.plan\?\.summary \|\| "Confirm this placement\?"\}/);
});

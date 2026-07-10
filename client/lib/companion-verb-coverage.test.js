import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  COMPANION_CAPABILITIES,
  validateCapabilityManifest,
} from "./companion-capabilities.js";

test("companion whitelist covers every registered director verb", () => {
  const source = fs.readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  const start = source.indexOf("registerDirectorVerbs({");
  const end = source.indexOf("\n  async function handleCompanionCommand", start);
  assert.ok(start >= 0 && end > start, "director registry is present");

  const registry = source.slice(start, end);
  const registered = [...registry.matchAll(/^\s{4}([A-Za-z]\w*):\s*async\b/gm)].map((match) => match[1]);
  const drift = validateCapabilityManifest(registered);

  assert.deepEqual(drift, {
    undocumented: [],
    unregistered: [],
    missingExamples: [],
    missingAnimation: [],
    missingArgumentSchema: [],
    missingRisk: [],
    missingObservation: [],
    missingTestCase: [],
  });
});

test("capability audit rejects missing intent and animation metadata", () => {
  const broken = COMPANION_CAPABILITIES.map((entry, index) =>
    index === 0 ? { ...entry, examples: [], animation: null } : entry
  );
  const registered = COMPANION_CAPABILITIES.map((entry) => entry.name);
  const audit = validateCapabilityManifest(registered, broken);
  assert.deepEqual(audit.missingExamples, [broken[0].name]);
  assert.deepEqual(audit.missingAnimation, [broken[0].name]);
});

test("capability audit requires schemas, risk, observations, and test IDs", () => {
  const broken = COMPANION_CAPABILITIES.map((entry, index) =>
    index === 0
      ? { ...entry, args: null, risk: null, observation: null, testCaseId: null }
      : entry
  );
  const audit = validateCapabilityManifest(
    COMPANION_CAPABILITIES.map((entry) => entry.name),
    broken
  );
  assert.deepEqual(audit.missingArgumentSchema, [broken[0].name]);
  assert.deepEqual(audit.missingRisk, [broken[0].name]);
  assert.deepEqual(audit.missingObservation, [broken[0].name]);
  assert.deepEqual(audit.missingTestCase, [broken[0].name]);
});

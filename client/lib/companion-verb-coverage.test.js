import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  COMPANION_CAPABILITIES,
  validateCapabilityManifest,
} from "./companion-capabilities.js";
import { validateCapabilityArgs } from "./companion-plan.js";

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
    missingConfirmation: [],
    missingObservation: [],
    missingTestCase: [],
  });
});

function fixtureFor(rawType) {
  const type = rawType.replace(/\?$/, "").split("|")[0];
  if (type === "string") return "fixture";
  if (type === "number") return 1;
  if (type === "boolean") return true;
  if (type === "array") return ["fixture"];
  if (type === "object") return { fixture: true };
  if (type === "{x,y}") return { x: 1, y: 2 };
  return type;
}

test("every canonical capability schema accepts a minimal fixture and rejects drift", () => {
  for (const capability of COMPANION_CAPABILITIES) {
    const args = Object.fromEntries(
      Object.entries(capability.args)
        .filter(([, type]) => !type.endsWith("?"))
        .map(([name, type]) => [name, fixtureFor(type)])
    );
    assert.doesNotThrow(
      () => validateCapabilityArgs(capability, args),
      `${capability.name} accepts its canonical minimal fixture`
    );
    assert.throws(
      () => validateCapabilityArgs(capability, { ...args, __unknown: true }),
      /is not accepted/,
      `${capability.name} rejects unknown arguments`
    );
  }
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
      ? { ...entry, args: null, risk: null, confirmation: null, observation: null, testCaseId: null }
      : entry
  );
  const audit = validateCapabilityManifest(
    COMPANION_CAPABILITIES.map((entry) => entry.name),
    broken
  );
  assert.deepEqual(audit.missingArgumentSchema, [broken[0].name]);
  assert.deepEqual(audit.missingRisk, [broken[0].name]);
  assert.deepEqual(audit.missingConfirmation, [broken[0].name]);
  assert.deepEqual(audit.missingObservation, [broken[0].name]);
  assert.deepEqual(audit.missingTestCase, [broken[0].name]);
});

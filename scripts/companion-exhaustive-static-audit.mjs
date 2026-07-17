import fs from "node:fs";
import path from "node:path";

import {
  COMPANION_CAPABILITIES,
  capabilityPrompt,
} from "../client/lib/companion-capabilities.js";
import {
  parseCompanionPlan,
  validateCapabilityArgs,
} from "../client/lib/companion-plan.js";
import { normalizeCompanionRequest } from "../client/lib/companion-submit.js";
import { parseExtensionIntent } from "../extension/src/sidepanel/companion.js";

const OUT = path.resolve(process.env.AUDIT_OUT || "audit-shots/companion-exhaustive-2026-07");
const FUZZ_CASES = Number(process.env.AUDIT_FUZZ_CASES || 12_000);
const SEED = Number(process.env.AUDIT_SEED || 0x5eeda11);
fs.mkdirSync(OUT, { recursive: true });

let randomState = SEED >>> 0;
function random() {
  randomState = (Math.imul(1664525, randomState) + 1013904223) >>> 0;
  return randomState / 0x1_0000_0000;
}
const pick = (values) => values[Math.floor(random() * values.length)];

const strings = [
  "Alpha",
  "résumé evidence",
  "研究メモ",
  "مذكرة استثمار",
  "עברית RTL",
  "emoji 🧭 evidence",
  "line one\nline two",
  "O'Brien’s second-order effect",
];
const ids = ["claim", "evidence", "node-root", "op-a", "generator-a", "stale-target"];

function enumOptions(type) {
  const raw = type.replace(/\?$/, "");
  const parts = raw.split("|");
  return parts.every((part) => !["string", "number", "boolean", "array", "object", "{x,y}"].includes(part))
    ? parts
    : null;
}

function valueFor(type, key, fuzz = false) {
  const raw = type.replace(/\?$/, "");
  const options = enumOptions(type);
  if (options) return fuzz ? pick(options) : options[0];
  if (raw.includes("|")) return valueFor(raw.split("|")[0], key, fuzz);
  if (raw === "string") {
    if (/target|from|to|move|function|op|lens|artifact|result|action|primitive|step|branch/i.test(key)) {
      return fuzz ? pick(ids) : "claim";
    }
    return fuzz ? pick(strings) : "fixture";
  }
  if (raw === "number") return fuzz ? Math.floor(random() * 201) - 50 : 1;
  if (raw === "boolean") return fuzz ? random() >= 0.5 : true;
  if (raw === "array") {
    if (key === "branchSpecs") {
      return [{
        id: `branch-${Math.floor(random() * 10_000)}`,
        name: pick(strings),
        instruction: pick(strings),
        requestedModel: pick(["auto", "claude", "gemini"]),
      }];
    }
    return fuzz ? Array.from({ length: 1 + Math.floor(random() * 8) }, () => pick(ids)) : ["claim"];
  }
  if (raw === "object") return { columns: 1 + Math.floor(random() * 10), gap: Math.floor(random() * 100) };
  if (raw === "{x,y}") return {
    x: Math.round((random() * 20_000 - 10_000) * 100) / 100,
    y: Math.round((random() * 20_000 - 10_000) * 100) / 100,
  };
  return "fixture";
}

function argsFor(capability, fuzz = false) {
  return Object.fromEntries(
    Object.entries(capability.args)
      .filter(([, type]) => !type.endsWith("?") || (fuzz && random() > 0.2))
      .map(([key, type]) => [key, valueFor(type, key, fuzz)])
  );
}

function canonicalPlan(capability, args) {
  return {
    version: 1,
    title: capability.examples[0],
    root: {
      kind: "action",
      id: `fuzz-${capability.name}`,
      capability: capability.name,
      args,
      ...(capability.confirmation === "framework" ? { confirmed: true } : {}),
    },
  };
}

function utteranceVariants(capability) {
  const canonical = capability.examples[0];
  const speech = canonical
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
  return {
    canonical,
    paraphrase: `Please ${canonical.replace(/^(?:please\s+)/i, "")}`,
    speech,
    contextual: `Do that again for ${pick(["this", "the second one", "all of these"])}`,
    chained: `${canonical}; then show the resulting object`,
    invalid: `${capability.name} with an unavailable target and contradictory arguments`,
  };
}

const promptByPlatform = {
  app: capabilityPrompt("app"),
  extension: capabilityPrompt("extension"),
};
const rows = [];
for (const capability of COMPANION_CAPABILITIES) {
  const args = argsFor(capability);
  let schema = true;
  let plan = true;
  let rejectsDrift = true;
  try {
    validateCapabilityArgs(capability, args);
  } catch {
    schema = false;
  }
  try {
    parseCompanionPlan(JSON.stringify(canonicalPlan(capability, args)));
  } catch {
    plan = false;
  }
  try {
    validateCapabilityArgs(capability, { ...args, __unknown: true });
    rejectsDrift = false;
  } catch {}
  let deterministicRoute = false;
  if (capability.platform === "extension") {
    try {
      deterministicRoute = parseExtensionIntent(capability.examples[0]).name === capability.name;
    } catch {}
  }
  rows.push({
    capability: capability.name,
    platform: capability.platform,
    domains: capability.domains,
    risk: capability.risk,
    confirmation: capability.confirmation,
    resultType: capability.resultType,
    observation: capability.observation,
    utterances: utteranceVariants(capability),
    normalizedCanonical: normalizeCompanionRequest(capability.examples[0]),
    promptDefinition: promptByPlatform[capability.platform].includes(`- ${capability.name}(`),
    schema,
    plan,
    rejectsDrift,
    deterministicRoute,
  });
}

const fuzzFailures = [];
const fuzzByCapability = Object.fromEntries(
  COMPANION_CAPABILITIES.map((capability) => [capability.name, { generated: 0, valid: 0, rejected: 0 }])
);
for (let index = 0; index < FUZZ_CASES; index += 1) {
  const capability = COMPANION_CAPABILITIES[index % COMPANION_CAPABILITIES.length];
  const stats = fuzzByCapability[capability.name];
  stats.generated += 1;
  const args = argsFor(capability, true);
  try {
    validateCapabilityArgs(capability, args);
    parseCompanionPlan(JSON.stringify(canonicalPlan(capability, args)));
    stats.valid += 1;
  } catch (error) {
    stats.rejected += 1;
    fuzzFailures.push({
      seed: SEED,
      case: index,
      capability: capability.name,
      args,
      error: error.message,
    });
  }
}

const states = [
  "empty-workspace",
  "seeded-normal-workspace",
  "dense-100-object-workspace",
  "onboarding-active",
  "companion-minimized",
  "function-editor-open",
  "reading-focus-open",
  "anonymous",
  "signed-in-mocked",
  "offline",
  "gateway-timeout",
  "stale-or-deleted-targets",
  "narrow-viewport",
  "extension-side-panel",
  "refresh-reopen",
];

const results = {
  generatedAt: new Date().toISOString(),
  seed: SEED,
  counts: {
    capabilities: rows.length,
    app: rows.filter((row) => row.platform === "app").length,
    extension: rows.filter((row) => row.platform === "extension").length,
    utteranceVariants: rows.length * 6,
    fuzzCases: FUZZ_CASES,
    fuzzValid: Object.values(fuzzByCapability).reduce((sum, value) => sum + value.valid, 0),
    fuzzRejected: fuzzFailures.length,
    stateContracts: states.length,
  },
  states,
  rows,
  fuzzByCapability,
  failingSeeds: fuzzFailures,
};

fs.writeFileSync(path.join(OUT, "utterance-state-coverage.json"), `${JSON.stringify(results, null, 2)}\n`);
fs.writeFileSync(path.join(OUT, "failing-seeds.json"), `${JSON.stringify({
  seed: SEED,
  failures: fuzzFailures,
}, null, 2)}\n`);
fs.writeFileSync(path.join(OUT, "capability-utterance-state-coverage.md"), `# Companion capability / utterance / state coverage

- Registry: ${results.counts.capabilities} capabilities (${results.counts.app} app, ${results.counts.extension} extension)
- Generated utterance forms: ${results.counts.utteranceVariants} (six structural forms per capability)
- Deterministic schema/plan fuzz: ${results.counts.fuzzCases} cases, seed \`${SEED}\`
- Valid generated plans: ${results.counts.fuzzValid}
- Rejected generated plans: ${results.counts.fuzzRejected}
- State contracts enumerated: ${results.counts.stateContracts}

This matrix proves registry, prompt-definition, schema, plan-validation, and drift-rejection coverage. It does not claim that every generated natural-language form was semantically understood by a live model; browser/runtime evidence is indexed separately.

${rows.map((row) => `- ${row.schema && row.plan && row.rejectsDrift && row.promptDefinition ? "PASS" : "FAIL"} — \`${row.capability}\` (${row.platform}); confirmation=${row.confirmation}; result=${row.resultType}; extension deterministic route=${row.deterministicRoute}`).join("\n")}
`);

console.log(JSON.stringify(results.counts));
if (rows.some((row) => !row.schema || !row.plan || !row.rejectsDrift || !row.promptDefinition) || fuzzFailures.length) {
  process.exitCode = 1;
}

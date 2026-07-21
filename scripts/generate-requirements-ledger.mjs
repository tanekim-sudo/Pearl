import fs from "node:fs";
import path from "node:path";
import { COMPANION_CAPABILITIES } from "../client/lib/companion-capabilities.js";
import { DOMAIN_COMMANDS } from "../shared/domain-commands.js";
import { FEATURE_CONTRACTS } from "../shared/feature-contracts.js";
import { generateRequirementsLedger, validateRequirementsLedger } from "../shared/requirements-ledger.js";

const root = path.resolve(import.meta.dirname, "..");
const output = path.join(root, "docs/requirements-ledger.json");
const reachabilityOutput = path.join(root, "audit-shots/unified-pearl-e2e/reachability.json");
const capabilities = new Set(COMPANION_CAPABILITIES.map((entry) => entry.name));
const extensionCapabilities = new Set(COMPANION_CAPABILITIES.filter((entry) => entry.platform === "extension").map((entry) => entry.name));
const exists = (reference) => fs.existsSync(path.join(root, String(reference).split(":")[0]));
const missing = [];

for (const feature of FEATURE_CONTRACTS) {
  for (const command of feature.commands || []) if (command !== "executeDomainCommand" && !DOMAIN_COMMANDS[command]) missing.push(`${feature.id}:command:${command}`);
  for (const capability of feature.companion || []) if (!capabilities.has(capability)) missing.push(`${feature.id}:companion:${capability}`);
  for (const capability of feature.extension || []) if (!extensionCapabilities.has(capability) && !exists(capability)) missing.push(`${feature.id}:extension:${capability}`);
  for (const reference of [...(feature.ui || []), ...(feature.tests || []), feature.owner].filter(Boolean)) if (!exists(reference)) missing.push(`${feature.id}:file:${reference}`);
}

const ledger = generateRequirementsLedger();
const validation = validateRequirementsLedger(ledger);
missing.push(...validation.missing);
const reachability = {
  version: 1,
  generatedAt: new Date().toISOString(),
  counts: {
    ...ledger.counts,
    featureContracts: FEATURE_CONTRACTS.length,
    registeredDomainCommands: Object.keys(DOMAIN_COMMANDS).length,
    registeredCompanionCapabilities: capabilities.size,
    registeredExtensionCapabilities: extensionCapabilities.size,
  },
  stableFeatureIds: FEATURE_CONTRACTS.map((entry) => entry.id),
  missing: [...new Set(missing)].sort(),
  zeroMissing: missing.length === 0,
};

if (process.argv.includes("--check")) {
  const committed = JSON.parse(fs.readFileSync(output, "utf8"));
  const committedReachability = JSON.parse(fs.readFileSync(reachabilityOutput, "utf8"));
  const comparable = (value) => JSON.stringify({ ...value, generatedAt: undefined }, null, 2);
  if (comparable(committed) !== comparable({ ...ledger, generatedAt: committed.generatedAt })) throw new Error("requirements ledger is stale; run npm run requirements:generate");
  if (comparable(committedReachability) !== comparable({ ...reachability, generatedAt: committedReachability.generatedAt })) throw new Error("reachability matrix is stale; run npm run requirements:generate");
  if (missing.length) throw new Error(`reachability has ${missing.length} missing entries:\n${missing.join("\n")}`);
  console.log(`Requirements ledger verified: ${ledger.counts.requirements} requirements, zero missing.`);
} else {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.mkdirSync(path.dirname(reachabilityOutput), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify({ ...ledger, generatedAt: new Date().toISOString() }, null, 2)}\n`);
  fs.writeFileSync(reachabilityOutput, `${JSON.stringify(reachability, null, 2)}\n`);
  console.log(`Generated requirements ledger with ${missing.length} missing entries.`);
  if (missing.length) console.log(missing.join("\n"));
}

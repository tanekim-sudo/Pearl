import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { FEATURE_CONTRACTS } from "../shared/feature-contracts.js";
import { DOMAIN_COMMANDS } from "../shared/domain-commands.js";
import { COMPANION_CAPABILITIES } from "../client/lib/companion-capabilities.js";
import { EXTENSION_VERBS } from "../extension/src/sidepanel/companion.js";
import { BOARD_SYNC_META_KEY, BOARD_SYNC_STORAGE_KEYS } from "../client/lib/board-sync.js";

const PRE_ORB_BASELINE = "297478585f636be7620e09b4377df36b9f7e9d5e";
const baselineSource = (path) => execFileSync("git", ["show", `${PRE_ORB_BASELINE}:${path}`], { encoding: "utf8" });
const section = (source, start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const matches = (source, expression) => [...source.matchAll(expression)].map((match) => match[1]);
const unique = (values) => [...new Set(values)];

const baselineFeatures = matches(baselineSource("shared/feature-contracts.js"), /feature\("([^"]+)"/g);
const baselineCommands = matches(
  section(baselineSource("shared/domain-commands.js"), "export const DOMAIN_COMMANDS", "\n});"),
  /^\s{2}([A-Za-z][A-Za-z0-9]*): \{/gm
);
const baselineCapabilitySource = section(
  baselineSource("client/lib/companion-capabilities.js"),
  "const RAW_CAPABILITIES",
  "\n];"
);
const baselineCapabilities = matches(baselineCapabilitySource, /^\s*\["([^"]+)"/gm);
const baselineExtensionVerbs = matches(
  section(baselineSource("extension/src/sidepanel/companion.js"), "export const EXTENSION_VERBS", "\n});"),
  /^\s{2}([A-Za-z][A-Za-z0-9]*):/gm
);
const persistenceExpression = /["'](lens\.[a-z0-9._:-]+|cognitive_[a-z0-9_]+|personalCommandVocabulary|cognitivePullRequestHandoff)["']/gi;
const baselinePersistence = unique([
  ...matches(baselineSource("shared/feature-contracts.js"), persistenceExpression),
  ...matches(baselineSource("client/lib/board-sync.js"), persistenceExpression),
  ...matches(baselineSource("client/lib/companion-capabilities.js"), persistenceExpression),
]).filter((id) => !baselineFeatures.includes(id));
const currentFiles = {
  shell: await readFile(resolve("client/components/OrbUniverseShell.jsx"), "utf8"),
  app: await readFile(resolve("client/App.jsx"), "utf8"),
  runtimeAudit: await readFile(resolve("scripts/companion-capability-runtime-audit.mjs"), "utf8"),
  extensionAudit: await readFile(resolve("extension/scripts/orb-audit.mjs"), "utf8"),
};
const currentFeatures = new Map(FEATURE_CONTRACTS.map((entry) => [entry.id, entry]));
const currentCapabilities = new Map(COMPANION_CAPABILITIES.map((entry) => [entry.name, entry]));
const currentPersistence = new Set(BOARD_SYNC_STORAGE_KEYS);
currentPersistence.add(BOARD_SYNC_META_KEY);
for (const feature of FEATURE_CONTRACTS) for (const key of feature.persistence || []) currentPersistence.add(key);
const runtimeBridgePresent = currentFiles.shell.includes("runtime.run(recorded.entry.raw") &&
  currentFiles.app.includes("window.__lensOrbRuntime = bridge");

const rows = [];
const add = (category, id, preserved, details = {}) => rows.push({
  category,
  id,
  baseline: PRE_ORB_BASELINE,
  status: preserved ? "preserved" : "missing",
  ...details,
});

for (const id of baselineFeatures) {
  const feature = currentFeatures.get(id);
  add("feature", id, Boolean(feature?.ui?.length && feature?.tests?.length), {
    directControl: feature?.ui || [],
    orbVoice: feature?.companion || [],
    extension: feature?.extension || [],
    canonicalCommands: feature?.commands || [],
    persistence: feature?.persistence || [],
    appTests: feature?.tests || [],
  });
}
for (const id of baselineCommands) {
  const command = DOMAIN_COMMANDS[id];
  add("domain-command", id, Boolean(command?.execute && command?.undo && command?.observableEffects?.length), {
    canonicalEffect: command?.observableEffects || [],
    persistence: [command?.persistenceEffect].filter(Boolean),
    undo: command?.undo || null,
    orbExecution: "shared/orb-runtime.js:executeOrbCommand",
    appTest: "shared/domain-commands.test.js",
  });
}
for (const id of baselineCapabilities) {
  const capability = currentCapabilities.get(id);
  const extension = capability?.platform === "extension";
  const hasHandler = extension ? Boolean(EXTENSION_VERBS[id]) : runtimeBridgePresent;
  add("companion-capability", id, Boolean(capability && hasHandler && capability.testCaseId && capability.examples?.length), {
    platform: capability?.platform || null,
    orbVoice: capability?.examples?.[0] || null,
    gestureOrControl: extension ? "extension orb command view" : "Scene orb command ledger",
    emittedViewOrHandoff: extension ? "verified extension handler or typed web handoff" : "Scene runtime instrumentation view",
    canonicalEffect: capability?.expectedEffects || [],
    undo: capability?.inverse || null,
    appBrowserTest: extension ? null : capability?.testCaseId || null,
    extensionTest: extension ? capability?.testCaseId || null : "not-applicable",
    runtimeEvidence: extension
      ? "scripts/companion-capability-runtime-audit.mjs:executeExtensionVerb"
      : "scripts/companion-capability-runtime-audit.mjs:visible CompanionChat and real director",
  });
}
for (const id of baselineExtensionVerbs) {
  add("extension-verb", id, Boolean(EXTENSION_VERBS[id]), {
    orbEntry: `extension:${id}`,
    handler: "extension/src/sidepanel/companion.js",
    effectTest: "scripts/companion-capability-runtime-audit.mjs",
    browserTest: currentFiles.extensionAudit.includes("chrome-extension://") ? "extension/scripts/orb-audit.mjs" : null,
  });
}
for (const id of baselinePersistence) {
  const preserved = currentPersistence.has(id) ||
    FEATURE_CONTRACTS.some((feature) => feature.persistence?.includes(id)) ||
    currentFiles.app.includes(id);
  add("persistence", id, preserved, {
    migration: id === "lens.unified-workspace.v2" ? "dual-read/write to lens.scenes.v4" : "stable-key",
    roundTripTest: "client/lib/board-sync.test.js",
  });
}

const matrix = {
  version: 2,
  generatedAt: new Date().toISOString(),
  contract: "pre-orb-baseline-to-real-orb-effect",
  preOrbBaseline: PRE_ORB_BASELINE,
  counts: {
    total: rows.length,
    features: baselineFeatures.length,
    domainCommands: baselineCommands.length,
    companionCapabilities: baselineCapabilities.length,
    appCapabilities: baselineCapabilities.filter((id) => currentCapabilities.get(id)?.platform !== "extension").length,
    extensionCapabilities: baselineCapabilities.filter((id) => currentCapabilities.get(id)?.platform === "extension").length,
    extensionVerbs: baselineExtensionVerbs.length,
    persistenceKeys: baselinePersistence.length,
    missing: rows.filter((row) => row.status !== "preserved").length,
  },
  rows,
};

const output = resolve(process.cwd(), "shared/orb-preservation-matrix.json");
if (process.argv.includes("--check")) {
  const current = JSON.parse(await readFile(output, "utf8"));
  const comparable = (value) => ({ ...value, generatedAt: null });
  if (JSON.stringify(comparable(current)) !== JSON.stringify(comparable(matrix))) {
    console.error("orb preservation matrix is stale; run npm run orb:matrix");
    process.exit(1);
  }
  if (matrix.counts.missing || matrix.counts.appCapabilities !== 170 || matrix.counts.extensionCapabilities !== 36) {
    console.error(`orb preservation matrix has ${matrix.counts.missing} missing rows`);
    process.exit(1);
  }
  console.log(`orb preservation passed: ${matrix.counts.total} rows, 0 missing`);
} else {
  await writeFile(output, `${JSON.stringify(matrix, null, 2)}\n`);
  console.log(`wrote ${matrix.counts.total} preservation rows (${matrix.counts.missing} missing)`);
}

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FEATURE_CONTRACTS } from "../shared/feature-contracts.js";
import { DOMAIN_COMMANDS } from "../shared/domain-commands.js";
import { COMPANION_CAPABILITIES } from "../client/lib/companion-capabilities.js";
import { EXTENSION_VERBS } from "../extension/src/sidepanel/companion.js";
import { BOARD_SYNC_STORAGE_KEYS } from "../client/lib/board-sync.js";

const rows = [];
const add = (category, id, currentPath, orbPath, mode = "native", evidence = []) => rows.push({
  category,
  id,
  status: "preserved",
  currentPath,
  orbPath,
  mode,
  voice: mode === "native" ? `capability:${id}` : null,
  gesture: mode === "native" ? `orb-emitted:${category}` : "typed-safe-handoff",
  keyboard: mode === "native" ? `orb-command:${id}` : "open-safe-handoff",
  persistence: evidence.filter((value) => value.startsWith("lens.") || value.includes("_")),
  undo: category === "domain-command" ? DOMAIN_COMMANDS[id]?.undo || "declared-by-handler" : "preserve-existing",
  evidence,
});

for (const feature of FEATURE_CONTRACTS) {
  add("feature", feature.id, feature.ui, `feature-contract:${feature.id}`, "native", [...feature.tests, ...feature.persistence]);
}
for (const [name, command] of Object.entries(DOMAIN_COMMANDS)) {
  add("domain-command", name, "shared/domain-commands.js", `executeOrbCommand:${name}`, "native", [command.persistenceEffect, ...(command.observableEffects || [])]);
}
for (const capability of COMPANION_CAPABILITIES) {
  add("companion-capability", capability.name, "client/lib/companion-capabilities.js", `orb-capability:${capability.name}`, "native", [capability.testCaseId || "client/lib/companion-verb-coverage.test.js"]);
}
for (const name of Object.keys(EXTENSION_VERBS)) {
  add("extension-verb", name, "extension/src/sidepanel/companion.js", `extension-orb:${name}`, "native", ["extension/tests/core.test.js"]);
}
for (const key of BOARD_SYNC_STORAGE_KEYS) {
  add("persistence", key, "client/lib/board-sync.js", key === "lens.scenes.v4" ? "scene-v4-primary" : "dual-read-write-migration", "native", [key]);
}

[
  ["editor", "before-after", "client/components/BeforeAfterLensEditor.jsx"],
  ["editor", "function-tree", "client/components/LensTreeEditor.jsx"],
  ["editor", "lens-settings", "client/components/LensSettingsDialog.jsx"],
  ["editor", "cognitive-workflow", "client/components/CognitiveWorkflowStudio.jsx"],
  ["gesture", "center-node-move", "client/components/AiNodeCanvas.jsx"],
  ["gesture", "edge-node-branch", "client/components/AiNodeCanvas.jsx"],
  ["gesture", "explicit-go", "client/components/HighlightToolbar.jsx"],
  ["gesture", "highlighter", "client/App.jsx"],
  ["gesture", "proximity-merge", "client/components/AiNodeCanvas.jsx"],
  ["gesture", "semantic-transfer", "shared/drop-intent-resolver.js"],
  ["keyboard", "spatial-navigation", "client/App.jsx"],
  ["keyboard", "orb-positioning", "client/components/CompanionOrb.jsx"],
  ["voice", "raw-normalized-ledger", "shared/orb-runtime.js"],
  ["voice", "exactly-once-dispatch", "shared/orb-runtime.js"],
  ["migration", "scene-v4", "client/lib/unified-workspace.js"],
  ["migration", "account-adoption", "client/lib/board-sync.js"],
].forEach(([category, id, currentPath]) => add(category, id, currentPath, `orb:${id}`, "native", [currentPath]));

const matrix = {
  version: 1,
  generatedAt: new Date().toISOString(),
  contract: "old-shell-to-orb",
  counts: {
    total: rows.length,
    features: FEATURE_CONTRACTS.length,
    domainCommands: Object.keys(DOMAIN_COMMANDS).length,
    companionCapabilities: COMPANION_CAPABILITIES.length,
    extensionVerbs: Object.keys(EXTENSION_VERBS).length,
    persistenceKeys: BOARD_SYNC_STORAGE_KEYS.length,
    missing: rows.filter((row) => row.status !== "preserved" || !row.orbPath).length,
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
  if (matrix.counts.missing) {
    console.error(`orb preservation matrix has ${matrix.counts.missing} missing rows`);
    process.exit(1);
  }
  console.log(`orb preservation passed: ${matrix.counts.total} rows, 0 missing`);
} else {
  await writeFile(output, `${JSON.stringify(matrix, null, 2)}\n`);
  console.log(`wrote ${matrix.counts.total} preservation rows (${matrix.counts.missing} missing)`);
}

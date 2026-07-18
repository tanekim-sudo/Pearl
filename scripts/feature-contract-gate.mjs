import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FEATURE_BASELINE, FEATURE_CONTRACTS } from "../shared/feature-contracts.js";
import { COMPANION_CAPABILITIES } from "../client/lib/companion-capabilities.js";
import { DOMAIN_COMMANDS } from "../shared/domain-commands.js";
import { EXTENSION_VERBS } from "../extension/src/sidepanel/companion.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));
const appSource = read("client/App.jsx");
const appRegistry = appSource.slice(appSource.indexOf("registerDirectorVerbs({"), appSource.indexOf("\n  async function handleCompanionCommand"));
const directorHandlers = [...appRegistry.matchAll(/^\s{4}([A-Za-z]\w*):\s*async\b/gm)].map((match) => match[1]);
const mutation = process.env.LENS_GATE_MUTATION?.match(/^remove:(.+)$/)?.[1];
if (mutation && directorHandlers.includes(mutation)) directorHandlers.splice(directorHandlers.indexOf(mutation), 1);
const duplicateHandlers = directorHandlers.filter((name, index) => directorHandlers.indexOf(name) !== index);
const companion = new Map(COMPANION_CAPABILITIES.map((entry) => [entry.name, entry]));
const errors = [];

if (duplicateHandlers.length) errors.push(`duplicate director handlers: ${[...new Set(duplicateHandlers)].join(", ")}`);
if (COMPANION_CAPABILITIES.length < FEATURE_BASELINE.minimumCompanionCapabilities) errors.push(`capability count regressed: ${COMPANION_CAPABILITIES.length} < ${FEATURE_BASELINE.minimumCompanionCapabilities}`);
if (Object.keys(EXTENSION_VERBS).length < FEATURE_BASELINE.minimumExtensionCapabilities) errors.push(`extension capability count regressed`);
if (FEATURE_CONTRACTS.length !== FEATURE_BASELINE.features) errors.push(`feature baseline changed without reviewed update`);
if (!exists("shared/fixtures/library-history-v1.json")) errors.push("historical migration fixture is missing");
for (const entry of FEATURE_BASELINE.requiredExports) {
  const [file, name] = entry.split(":");
  if (!exists(file) || !new RegExp(`export\\s+(?:async\\s+)?(?:const|function|class)\\s+${name}\\b`).test(read(file))) errors.push(`lost exported API ${entry}`);
}

for (const contract of FEATURE_CONTRACTS) {
  for (const command of contract.commands) if (!DOMAIN_COMMANDS[command]) errors.push(`${contract.id}: missing command ${command}`);
  for (const name of contract.companion) {
    if (!companion.has(name)) errors.push(`${contract.id}: missing companion capability ${name}`);
    if (!directorHandlers.includes(name)) errors.push(`${contract.id}: missing director handler ${name}`);
  }
  for (const name of contract.extension) {
    if (!companion.has(name)) errors.push(`${contract.id}: missing extension capability ${name}`);
    if (!EXTENSION_VERBS[name]) errors.push(`${contract.id}: missing extension handler ${name}`);
  }
  for (const entry of contract.ui) {
    const [file, marker] = entry.split(":");
    if (!exists(file)) errors.push(`${contract.id}: missing UI file ${file}`);
    else if (marker && !read(file).includes(marker)) errors.push(`${contract.id}: missing UI marker ${entry}`);
  }
  for (const testFile of contract.tests) if (!exists(testFile)) errors.push(`${contract.id}: missing test ${testFile}`);
  if (!exists(contract.owner)) errors.push(`${contract.id}: missing owner ${contract.owner}`);
}

const sourceFiles = [];
for (const dir of ["client", "shared", "server", "extension/src"]) {
  const walk = (absolute) => {
    for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
      if (entry.name === "dist" || entry.name === "node_modules") continue;
      const target = path.join(absolute, entry.name);
      if (entry.isDirectory()) walk(target);
      else if (/\.(?:js|jsx|mjs)$/.test(entry.name)) sourceFiles.push(path.relative(root, target));
    }
  };
  walk(path.join(root, dir));
}
const allSource = sourceFiles.map((file) => read(file)).join("\n");
for (const contract of FEATURE_CONTRACTS) {
  for (const key of contract.persistence) if (!allSource.includes(key)) errors.push(`${contract.id}: missing persistence key ${key}`);
}

const exposedSources = sourceFiles.filter((file) =>
  !/\.test\.[cm]?[jt]sx?$/.test(file) &&
  (file.startsWith("client/") || file.startsWith("extension/src/") || file === "server/extension-api.js")
);
const stale = exposedSources.flatMap((file) => {
  const source = read(file);
  return [
    ...source.matchAll(/\bGenerator(?:s)?\b/g),
    ...source.matchAll(/\b(?:forkLens|mergeLenses|stackLenses|saveCompoundLens|captureThread(?!AsFunction))\b/g),
  ].map((match) => `${file}:${match[0]}`);
});
if (stale.length) errors.push(`stale public taxonomy: ${stale.slice(0, 20).join(", ")}`);

const canonicalSchemaDefinitions = sourceFiles.filter((file) => /\bLIBRARY_OBJECT_VERSION\s*=/.test(read(file)));
if (canonicalSchemaDefinitions.length !== 1 || canonicalSchemaDefinitions[0] !== "shared/library-objects.js") {
  errors.push(`duplicate canonical schema definitions: ${canonicalSchemaDefinitions.join(", ")}`);
}
const importGraph = new Map(sourceFiles.map((file) => {
  const imports = [...read(file).matchAll(/from\s+["'](\.[^"']+)["']/g)].map((match) => {
    const base = path.normalize(path.join(path.dirname(file), match[1]));
    return sourceFiles.find((candidate) => candidate === base || candidate === `${base}.js` || candidate === `${base}.jsx`) || null;
  }).filter(Boolean);
  return [file, imports];
}));
const visited = new Set();
const active = new Set();
const cycles = [];
function visit(file, trail = []) {
  if (active.has(file)) { cycles.push([...trail.slice(trail.indexOf(file)), file]); return; }
  if (visited.has(file)) return;
  visited.add(file); active.add(file);
  for (const imported of importGraph.get(file) || []) visit(imported, [...trail, file]);
  active.delete(file);
}
for (const file of sourceFiles) visit(file);
if (cycles.length) errors.push(`circular imports: ${cycles.slice(0, 5).map((cycle) => cycle.join(" -> ")).join("; ")}`);

for (const file of sourceFiles.filter((name) => /\.test\.(?:js|jsx)$/.test(name))) {
  if (/\b(?:test|it|describe)\.(?:only|skip)\s*\(/.test(read(file))) errors.push(`${file}: committed .only/.skip`);
}

const matrix = {
  version: 1,
  generatedAt: new Date().toISOString(),
  counts: { features: FEATURE_CONTRACTS.length, companion: COMPANION_CAPABILITIES.length, extension: Object.keys(EXTENSION_VERBS).length, commands: Object.keys(DOMAIN_COMMANDS).length },
  features: FEATURE_CONTRACTS.map((entry) => ({ id: entry.id, commands: entry.commands, companion: entry.companion, extension: entry.extension, tests: entry.tests })),
  checks: { duplicateHandlers, stale, errors },
};
const output = path.join(root, "audit-shots/orb-universe-2026-07/feature-matrix.json");
if (process.argv.includes("--update")) fs.writeFileSync(output, `${JSON.stringify(matrix, null, 2)}\n`);
else if (!exists(path.relative(root, output))) errors.push("generated feature matrix is missing; run with --update after reviewed registry changes");
else {
  const previous = JSON.parse(fs.readFileSync(output, "utf8"));
  if (JSON.stringify(previous.features) !== JSON.stringify(matrix.features) || JSON.stringify(previous.counts) !== JSON.stringify(matrix.counts)) errors.push("generated feature matrix is stale");
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}
console.log(`feature contracts passed: ${matrix.counts.features} features, ${matrix.counts.commands} commands, ${matrix.counts.companion} companion capabilities`);

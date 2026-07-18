import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CompanionCapabilityGraph,
  validateCompanionCapabilityGraph,
} from "../client/lib/companion-capability-graph.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "audit-shots/orb-universe-2026-07/capability-graph.json");
const validation = validateCompanionCapabilityGraph();

if (!validation.ok) {
  console.error(validation.errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

const artifact = {
  version: CompanionCapabilityGraph.version,
  generatedFrom: CompanionCapabilityGraph.generatedFrom,
  architecture: CompanionCapabilityGraph.architecture,
  fingerprint: CompanionCapabilityGraph.fingerprint,
  counts: validation.counts,
  nodes: CompanionCapabilityGraph.nodes,
  edges: CompanionCapabilityGraph.edges,
};
const serialized = `${JSON.stringify(artifact, null, 2)}\n`;

if (process.argv.includes("--update")) {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, serialized);
} else if (!fs.existsSync(output)) {
  console.error("generated capability graph is missing; run npm run graph:generate");
  process.exit(1);
} else {
  const current = JSON.parse(fs.readFileSync(output, "utf8"));
  if (current.fingerprint !== artifact.fingerprint || JSON.stringify(current.counts) !== JSON.stringify(artifact.counts)) {
    console.error("generated capability graph is stale; run npm run graph:generate after a reviewed registry change");
    process.exit(1);
  }
}

console.log(`capability graph passed: ${validation.counts.nodes} nodes, ${validation.counts.edges} edges, ${artifact.fingerprint}`);

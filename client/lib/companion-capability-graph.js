import { contentFingerprint } from "../../shared/lens-grammar.js";
import { DOMAIN_COMMANDS } from "../../shared/domain-commands.js";
import { FEATURE_CONTRACTS } from "../../shared/feature-contracts.js";
import { COMPANION_CAPABILITIES } from "./companion-capabilities.js";

export const COMPANION_CAPABILITY_GRAPH_VERSION = 1;

const clone = (value) => value == null ? value : structuredClone(value);
const words = (value) => String(value || "")
  .normalize("NFKC")
  .toLocaleLowerCase()
  .split(/[^\p{L}\p{N}]+/u)
  .filter((token) => token.length > 2);

const featureByCapability = new Map();
for (const contract of FEATURE_CONTRACTS) {
  for (const name of [...contract.companion, ...contract.extension]) {
    featureByCapability.set(name, [...(featureByCapability.get(name) || []), contract.id]);
  }
}

function commandMetadata(name) {
  const linked = FEATURE_CONTRACTS
    .filter((contract) => contract.companion.includes(name) || contract.extension.includes(name))
    .flatMap((contract) => contract.commands)
    .map((command) => DOMAIN_COMMANDS[command])
    .filter(Boolean);
  return {
    preconditions: [...new Set(linked.flatMap((entry) => entry.preconditions || []))],
    persistence: [...new Set(linked.map((entry) => entry.persistenceEffect).filter(Boolean))],
    observableEffects: [...new Set(linked.flatMap((entry) => entry.observableEffects || []))],
    undo: [...new Set(linked.map((entry) => entry.undo).filter(Boolean))],
    canonicalCommands: [...new Set(
      FEATURE_CONTRACTS
        .filter((contract) => contract.companion.includes(name) || contract.extension.includes(name))
        .flatMap((contract) => contract.commands)
    )],
  };
}

function nodeFor(capability) {
  const command = commandMetadata(capability.name);
  const surface = capability.platform === "extension" ? "extension" : "web";
  const network = capability.cost?.class === "model" || /research|publish|package/i.test(capability.name);
  return Object.freeze({
    id: `companion.capability.${capability.platform}.${capability.name}`,
    version: COMPANION_CAPABILITY_GRAPH_VERSION,
    kind: "capability",
    name: capability.name,
    purpose: capability.purpose,
    examples: clone(capability.examples),
    inputSchema: clone(capability.schema),
    outputSchema: clone(capability.result),
    resultType: capability.resultType,
    refArgs: clone(capability.refArgs),
    preconditions: [...new Set([...(capability.preconditions || []), ...command.preconditions])],
    requiredObservations: clone(capability.observation),
    observerQuery: clone(capability.observerQuery),
    risk: capability.risk,
    approval: clone(capability.approval),
    autonomy: capability.approval?.required ? "explicit-approval" : capability.risk === "medium" ? "policy-bounded" : "reversible-default",
    costs: clone(capability.cost),
    timeoutMs: capability.timeoutMs,
    modalities: /voice/i.test(capability.name) ? ["text", "voice"] : ["text"],
    network: { required: network, boundary: network ? "configured-provider-or-app-gateway" : "none" },
    sideEffects: clone(capability.expectedEffects),
    persistence: command.persistence,
    undo: command.undo.length ? command.undo : [capability.inverse].filter(Boolean),
    compensation: capability.compensation,
    animation: capability.animation,
    surfaces: [...new Set([surface, "companion", ...(capability.platform === "extension" ? [] : ["direct-ui"])])],
    expectedEffects: [...new Set([...(capability.expectedEffects || []), ...command.observableEffects])],
    tests: [`capability-${capability.name}`, ...(featureByCapability.get(capability.name) || []).map((id) => `feature:${id}`)],
    featureIds: clone(featureByCapability.get(capability.name) || []),
    canonicalCommands: command.canonicalCommands,
    destructive: capability.destructive,
    confirmation: capability.confirmation,
    idempotency: capability.idempotency,
    domains: clone(capability.domains),
    platform: capability.platform,
  });
}

function compatibleResult(resultType, inputType) {
  if (!resultType || !inputType) return false;
  if (resultType === inputType) return true;
  if (inputType === "library-object") return ["move", "function", "lens"].includes(resultType);
  if (inputType === "paper-item") return ["paper-item", "ai-node"].includes(resultType);
  return false;
}

function graphEdges(nodes) {
  const edges = [];
  for (const from of nodes) {
    for (const to of nodes) {
      if (from.id === to.id) continue;
      for (const [arg, inputType] of Object.entries(to.refArgs || {})) {
        if (!compatibleResult(from.resultType, inputType)) continue;
        edges.push(Object.freeze({
          id: `${from.id}->${to.id}:${arg}`,
          version: COMPANION_CAPABILITY_GRAPH_VERSION,
          kind: "dataflow",
          from: from.id,
          to: to.id,
          outputType: from.resultType,
          input: arg,
          inputType,
          bridge: null,
          conflicts: from.destructive || to.destructive ? ["same-workspace-write"] : [],
          parallelSafe: from.risk === "low" && to.risk === "low" && !from.sideEffects.length && !to.sideEffects.length,
        }));
      }
    }
  }
  return edges;
}

const nodes = Object.freeze(COMPANION_CAPABILITIES.map(nodeFor));
const edges = Object.freeze(graphEdges(nodes));

export const CompanionCapabilityGraph = Object.freeze({
  version: COMPANION_CAPABILITY_GRAPH_VERSION,
  generatedFrom: Object.freeze({
    companionManifest: "client/lib/companion-capabilities.js",
    domainCommands: "shared/domain-commands.js",
    featureContracts: "shared/feature-contracts.js",
  }),
  architecture: Object.freeze(["Move", "Function", "Lens"]),
  nodes,
  edges,
  fingerprint: contentFingerprint({
    version: COMPANION_CAPABILITY_GRAPH_VERSION,
    nodes: nodes.map((node) => [node.id, node.inputSchema, node.outputSchema, node.expectedEffects]),
    edges: edges.map((edge) => [edge.from, edge.to, edge.input]),
  }),
});

const nodeById = new Map(nodes.map((node) => [node.id, node]));
const nodeByName = new Map(nodes.map((node) => [node.name, node]));
const tokenIndex = new Map();
for (const node of nodes) {
  const tokens = new Set(words([
    node.name,
    node.purpose,
    node.examples.join(" "),
    node.domains.join(" "),
    node.featureIds.join(" "),
  ].join(" ")));
  for (const token of tokens) tokenIndex.set(token, [...(tokenIndex.get(token) || []), node.id]);
}

export function validateCompanionCapabilityGraph(graph = CompanionCapabilityGraph) {
  const errors = [];
  const ids = new Set();
  for (const node of graph.nodes || []) {
    if (!node.id || ids.has(node.id)) errors.push(`duplicate or missing node id: ${node.id || "<missing>"}`);
    ids.add(node.id);
    for (const field of [
      "name", "purpose", "inputSchema", "outputSchema", "preconditions", "requiredObservations",
      "risk", "approval", "costs", "network", "sideEffects", "persistence", "undo", "animation",
      "surfaces", "expectedEffects", "tests",
    ]) if (node[field] == null) errors.push(`${node.id}: missing ${field}`);
  }
  for (const edge of graph.edges || []) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) errors.push(`${edge.id}: dangling endpoint`);
    if (!edge.input || !edge.inputType || !edge.outputType) errors.push(`${edge.id}: incomplete dataflow declaration`);
  }
  return { ok: errors.length === 0, errors, counts: { nodes: graph.nodes?.length || 0, edges: graph.edges?.length || 0 } };
}

export function searchCompanionCapabilities(query, options = {}) {
  const platform = options.platform || null;
  const limit = Math.max(1, Math.min(Number(options.limit) || 24, 50));
  const queryWords = [...new Set(words(query))];
  if (!queryWords.length) {
    return nodes.filter((node) => !platform || node.platform === platform).slice(0, limit);
  }
  const scores = new Map();
  for (const token of queryWords) {
    for (const id of tokenIndex.get(token) || []) scores.set(id, (scores.get(id) || 0) + 4);
    for (const [indexed, ids] of tokenIndex) {
      if (
        indexed === token ||
        Math.min(indexed.length, token.length) < 5 ||
        (!indexed.startsWith(token) && !token.startsWith(indexed))
      ) continue;
      for (const id of ids) scores.set(id, (scores.get(id) || 0) + 1);
    }
  }
  return [...scores.entries()]
    .map(([id, score]) => ({ node: nodeById.get(id), score }))
    .filter(({ node }) => node && (!platform || node.platform === platform))
    .sort((a, b) => b.score - a.score || a.node.name.localeCompare(b.node.name))
    .slice(0, limit)
    .map(({ node }) => node);
}

export function inspectCompanionCapability(idOrName) {
  const node = nodeById.get(idOrName) || nodeByName.get(idOrName);
  return node ? clone(node) : null;
}

export function listCompanionCapabilities(options = {}) {
  return nodes
    .filter((node) => !options.platform || node.platform === options.platform)
    .filter((node) => !options.domain || node.domains.includes(options.domain))
    .map((node) => ({ id: node.id, name: node.name, purpose: node.purpose, risk: node.risk, surfaces: node.surfaces }));
}

export function recommendCompanionWorkflow(goal, options = {}) {
  const selected = searchCompanionCapabilities(goal, { ...options, limit: options.limit || 8 });
  return {
    version: COMPANION_CAPABILITY_GRAPH_VERSION,
    goal: String(goal || "").slice(0, 4_000),
    capabilities: selected.map((node) => node.id),
    edges: edges.filter((edge) => selected.some((node) => node.id === edge.from) && selected.some((node) => node.id === edge.to)),
    limitations: selected.length ? [] : ["No matching canonical capability was found; propose a reviewable Move, Function, Lens, package, or connector specification."],
    graphFingerprint: CompanionCapabilityGraph.fingerprint,
  };
}

export function capabilityContextPrompt(goal, options = {}) {
  const selected = searchCompanionCapabilities(goal, { platform: options.platform || "app", limit: options.limit || 24 });
  return selected.map((node) =>
    `- ${node.name}(${Object.entries(node.inputSchema.properties || {}).map(([key, type]) => `${key}: ${type}`).join(", ")}) -> ${node.resultType} — ${node.purpose}; risk=${node.risk}; approval=${node.approval.required ? node.approval.scope : "none"}; e.g. “${node.examples[0]}”`
  ).join("\n");
}

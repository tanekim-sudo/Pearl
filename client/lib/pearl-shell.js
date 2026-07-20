import { FEATURE_CONTRACTS } from "../../shared/feature-contracts.js";
import { DOMAIN_COMMANDS } from "../../shared/domain-commands.js";
import { COMPANION_CAPABILITIES } from "./companion-capabilities.js";

export const PEARL_SHELL_VERSION = 1;

const CATEGORY_ORDER = ["make", "use", "shape", "generate", "learn", "navigate", "manage", "recover"];

function categoryFor(capability) {
  const name = capability.name.toLowerCase();
  if (/create|save|capture|spawn|make|compose|merge|wrap|encode/.test(name)) return "make";
  if (/generation|candidate|taste|branch|go|apply|transform|interpret|research/.test(name)) return "generate";
  if (/learn|beforeafter|transcript|teach|critique|grind|infer/.test(name)) return "learn";
  if (/open|show|focus|fit|zoom|pan|walk|step|tour|select/.test(name)) return "navigate";
  if (/clear|delete|remove|cancel|stop|retry|undo|redo|restore|rollback/.test(name)) return "recover";
  if (/setting|theme|export|share|package|install|publish|archive|pin|reorder|role/.test(name)) return "manage";
  if (/edit|rename|move|arrange|group|link|set|update|fork|split|nest/.test(name)) return "shape";
  return "use";
}

function labelFor(name) {
  return name
    .replace(/External/g, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (value) => value.toUpperCase());
}

export const PEARL_ACTIONS = Object.freeze(COMPANION_CAPABILITIES.map((capability) => Object.freeze({
  id: `pearl:${capability.name}`,
  capability: capability.name,
  label: labelFor(capability.name),
  category: categoryFor(capability),
  purpose: capability.purpose,
  example: capability.examples[0],
  platform: capability.platform,
  destructive: capability.destructive,
  confirmation: capability.confirmation,
  domains: capability.domains,
  direct: capability.platform === "extension" ? ["command", "keyboard", "voice"] : ["command", "keyboard", "voice", "drop"],
  execution: capability.platform === "extension" ? "extension-verb" : "director",
})));

export const PEARL_ACTION_CATEGORIES = Object.freeze(CATEGORY_ORDER.map((id) => Object.freeze({
  id,
  label: id[0].toUpperCase() + id.slice(1),
})));

export function searchPearlActions(query = "", options = {}) {
  const normalized = String(query).trim().toLowerCase();
  const platform = options.platform || "all";
  const category = options.category || null;
  return PEARL_ACTIONS.filter((action) => {
    if (platform !== "all" && platform !== action.platform && !(platform === "extension" && action.platform === "app")) return false;
    if (category && action.category !== category) return false;
    if (!normalized) return true;
    return [action.label, action.capability, action.purpose, action.example, ...action.domains]
      .join(" ")
      .toLowerCase()
      .includes(normalized);
  });
}

export const PEARL_REACHABILITY = Object.freeze(FEATURE_CONTRACTS.map((feature) => Object.freeze({
  featureId: feature.id,
  version: feature.migrationVersion,
  routes: Object.freeze([
    ...feature.commands.map((name) => Object.freeze({
      id: `domain:${name}`,
      kind: "domain-command",
      name,
      surfaces: DOMAIN_COMMANDS[name]?.surfaces || [],
    })),
    ...feature.companion.map((name) => Object.freeze({
      id: `pearl:${name}`,
      kind: "pearl-action",
      name,
      surfaces: ["web", "companion"],
    })),
    ...feature.extension.map((name) => Object.freeze({
      id: `pearl:${name}`,
      kind: "pearl-action",
      name,
      surfaces: ["extension"],
    })),
    ...feature.ui.map((name) => Object.freeze({
      id: `surface:${name}`,
      kind: "contextual-surface",
      name,
      surfaces: name.startsWith("extension/") ? ["extension"] : ["web"],
    })),
  ]),
  persistence: feature.persistence,
  tests: feature.tests,
})));

export function pearlReachabilityFor(featureId) {
  return PEARL_REACHABILITY.find((entry) => entry.featureId === featureId) || null;
}

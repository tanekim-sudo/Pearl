export const PERSONAL_COMMAND_VERSION = 1;
export const RESERVED_COMMANDS = new Set(["yes", "no", "cancel", "stop", "confirm"]);
const SCOPES = ["session", "workspace", "account", "team"];

function normalize(value) {
  return String(value || "").normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

function quotedLiteral(utterance, trigger) {
  const escaped = trigger.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:write|say|quote|literal(?:ly)?)\\s+(?:the\\s+words?\\s+)?[“"'‘]?${escaped}[”"'’]?`, "i").test(utterance);
}

function compileTrigger(trigger) {
  const slots = [];
  const value = normalize(trigger);
  let cursor = 0;
  let pattern = "";
  for (const match of value.matchAll(/\[([a-z][a-z0-9_-]*)\]/gi)) {
    pattern += value.slice(cursor, match.index).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    slots.push(match[1]);
    pattern += `(?<${match[1]}>.+?)`;
    cursor = match.index + match[0].length;
  }
  pattern += value.slice(cursor).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return { slots, regex: new RegExp(`^${pattern}$`, "i") };
}

export function createPersonalCommandDefinition(input, existing = []) {
  const trigger = normalize(input.trigger);
  if (!trigger || RESERVED_COMMANDS.has(trigger)) throw new Error("Personal command trigger is empty or reserved");
  if (!SCOPES.includes(input.scope || "session")) throw new Error("Personal command scope is invalid");
  if (!input.target?.command && !input.target?.plan) throw new Error("Personal command requires a canonical command or plan target");
  if (existing.some((entry) => entry.active !== false && normalize(entry.trigger) === trigger && entry.id !== input.id)) throw new Error("Personal command trigger collides with an active definition");
  const expansionText = JSON.stringify(input.target);
  if (existing.some((entry) => expansionText.includes(`alias:${entry.id}`) && JSON.stringify(entry.target).includes(`alias:${input.id}`))) throw new Error("Personal command recursion cycle detected");
  const compiled = compileTrigger(trigger);
  return {
    schemaVersion: PERSONAL_COMMAND_VERSION,
    id: input.id || globalThis.crypto?.randomUUID?.() || `vocab-${Date.now()}`,
    version: input.version || 1,
    trigger,
    variants: [...new Set((input.variants || []).map(normalize).filter(Boolean))],
    match: input.match || "exact",
    parameters: compiled.slots,
    target: structuredClone(input.target),
    scope: input.scope || "session",
    priority: Number(input.priority || 0),
    risk: input.risk || "inherit",
    active: input.active !== false,
    expiresAt: input.expiresAt || null,
    provenance: { utterance: input.provenance?.utterance || input.teachingUtterance || "", author: input.provenance?.author || "local", createdAt: input.provenance?.createdAt || new Date().toISOString() },
    tests: structuredClone(input.tests || []),
    lastUsedAt: input.lastUsedAt || null,
  };
}

export function resolvePersonalCommand(utterance, definitions, { scopes = SCOPES, now = Date.now(), semanticThreshold = 0.82 } = {}) {
  const text = normalize(utterance);
  const scopeRank = new Map(SCOPES.map((scope, index) => [scope, index]));
  const eligible = definitions
    .filter((entry) => entry.active !== false && scopes.includes(entry.scope) && (!entry.expiresAt || Date.parse(entry.expiresAt) > now))
    .sort((a, b) => (scopeRank.get(b.scope) - scopeRank.get(a.scope)) || (b.priority - a.priority) || (b.version - a.version));
  for (const entry of eligible.filter((value) => value.match === "exact")) {
    if (quotedLiteral(utterance, entry.trigger)) return { matched: false, literal: true, definitionId: entry.id };
    for (const trigger of [entry.trigger, ...(entry.variants || [])]) {
      const compiled = compileTrigger(trigger);
      const match = text.match(compiled.regex);
      if (match) return { matched: true, definition: entry, parameters: match.groups || {}, originalUtterance: utterance, expanded: structuredClone(entry.target), requiresConfirmation: entry.scope !== "session" || entry.risk !== "low" };
    }
  }
  for (const entry of eligible.filter((value) => value.match === "semantic")) {
    const triggerTokens = new Set(entry.trigger.split(" "));
    const tokens = new Set(text.split(" "));
    const intersection = [...triggerTokens].filter((token) => tokens.has(token)).length;
    const confidence = intersection / Math.max(triggerTokens.size, tokens.size);
    if (confidence >= semanticThreshold) return { matched: true, definition: entry, confidence, parameters: {}, originalUtterance: utterance, expanded: structuredClone(entry.target), requiresConfirmation: true };
  }
  return { matched: false };
}

export function mergePersonalVocabulary(local, remote) {
  const merged = new Map();
  for (const entry of [...local, ...remote]) {
    const current = merged.get(entry.id);
    if (!current || entry.version > current.version || (entry.version === current.version && String(entry.provenance?.createdAt) > String(current.provenance?.createdAt))) merged.set(entry.id, entry);
  }
  return [...merged.values()];
}

export function updatePersonalCommand(definition, patch) {
  return createPersonalCommandDefinition({ ...definition, ...patch, id: definition.id, version: definition.version + 1, provenance: { ...definition.provenance, createdAt: new Date().toISOString() } }, []);
}

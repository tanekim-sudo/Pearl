/**
 * Weights — evaluative middle layer of a Pearl.
 * Captures preferences, judgements, valued factors, and tradeoffs.
 * Distinct from Moves (how work is done) and Lenses (perspectives for seeing).
 */

export const PEARL_WEIGHTS_VERSION = 1;
export const PEARL_WEIGHT_MAX = 80;
export const PEARL_WEIGHT_PRIORITY_MIN = 0;
export const PEARL_WEIGHT_PRIORITY_MAX = 1;

const bounded = (value, limit = 280) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, limit);
const softId = (prefix, index) => `${prefix}:${index + 1}`;

/**
 * @typedef {{ id: string, name: string, priority: number, note: string, kind: "weight" }} PearlWeight
 */

/** Normalize one weight factor. */
export function normalizePearlWeight(entry = {}, index = 0) {
  const name = bounded(entry.name || entry.label || entry.factor || `Weight ${index + 1}`, 80);
  let priority = Number(entry.priority ?? entry.value ?? entry.strength);
  if (!Number.isFinite(priority)) priority = 0.7;
  priority = Math.min(PEARL_WEIGHT_PRIORITY_MAX, Math.max(PEARL_WEIGHT_PRIORITY_MIN, priority));
  return {
    id: bounded(entry.id || softId("weight", index), 120),
    name,
    priority,
    note: bounded(entry.note || entry.description || entry.rationale || "", 1_200),
    kind: "weight",
  };
}

/** Normalize a weights list (dedupe by name, cap length). */
export function normalizePearlWeights(list = []) {
  const seen = new Set();
  const out = [];
  for (const entry of Array.isArray(list) ? list : []) {
    const weight = normalizePearlWeight(entry, out.length);
    const key = weight.name.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(weight);
    if (out.length >= PEARL_WEIGHT_MAX) break;
  }
  return out;
}

/** Read weights from pearl / organization / legacy taste notes. */
export function readPearlWeights(pearl = {}) {
  if (Array.isArray(pearl.weights) && pearl.weights.length) {
    return normalizePearlWeights(pearl.weights);
  }
  if (Array.isArray(pearl.organization?.weights) && pearl.organization.weights.length) {
    return normalizePearlWeights(pearl.organization.weights);
  }
  return [];
}

/**
 * Edit weights: replace | set | append | update | remove | clear.
 */
export function editPearlWeights(current, options = {}) {
  const prior = normalizePearlWeights(current);
  const mode = String(options.mode || "replace").toLowerCase();
  if (mode === "clear") {
    return { ok: true, mode: "clear", weights: [], prior };
  }
  if (mode === "remove") {
    const needle = bounded(options.name || options.id || "", 120).toLowerCase();
    if (!needle) return { ok: false, reason: "Name the weight to remove.", weights: prior, prior };
    const weights = prior.filter((entry) => (
      entry.id.toLowerCase() !== needle && entry.name.toLowerCase() !== needle
    ));
    return { ok: true, mode: "remove", weights, prior };
  }
  if (mode === "update") {
    const needle = bounded(options.name || options.id || "", 120).toLowerCase();
    if (!needle) return { ok: false, reason: "Name the weight to update.", weights: prior, prior };
    let found = false;
    const weights = prior.map((entry) => {
      if (entry.id.toLowerCase() !== needle && entry.name.toLowerCase() !== needle) return entry;
      found = true;
      return normalizePearlWeight({
        ...entry,
        ...(options.weight || {}),
        name: options.nextName || options.weight?.name || entry.name,
        priority: options.priority ?? options.value ?? options.weight?.priority ?? entry.priority,
        note: options.note ?? options.weight?.note ?? entry.note,
      }, 0);
    });
    if (!found) return { ok: false, reason: "That weight was not found.", weights: prior, prior };
    return { ok: true, mode: "update", weights: normalizePearlWeights(weights), prior };
  }
  const incoming = normalizePearlWeights(
    Array.isArray(options.weights)
      ? options.weights
      : options.weight
        ? [options.weight]
        : options.name
          ? [{
            name: options.name,
            priority: options.priority ?? options.value,
            note: options.note || options.text || "",
          }]
          : options.text
            ? seedWeightsFromIntent(options.text)
            : [],
  );
  if (!incoming.length && mode !== "replace") {
    return { ok: false, reason: "Tell me which factors to weigh.", weights: prior, prior };
  }
  if (mode === "append" || mode === "add") {
    return { ok: true, mode: "append", weights: normalizePearlWeights([...prior, ...incoming]), prior };
  }
  // replace | set
  return { ok: true, mode: mode === "set" ? "set" : "replace", weights: incoming, prior };
}

/**
 * Best-effort offline seed of valued factors from natural language.
 */
export function seedWeightsFromIntent(utterance = "", options = {}) {
  const text = bounded(utterance || options.intent || "", 4_000);
  if (!text) return [];
  const found = [];
  const push = (name, priority, note) => {
    const clean = bounded(name, 80);
    if (!clean) return;
    if (found.some((entry) => entry.name.toLowerCase() === clean.toLowerCase())) return;
    found.push(normalizePearlWeight({ name: clean, priority, note }, found.length));
  };

  const careMore = text.match(
    /\b(?:care|value|prefer|weight|prioriti[sz]e)\s+(?:more\s+)?(?:about\s+)?(.+?)\s+(?:than|over)\s+(.+?)(?:[.!?]|$)/i,
  );
  if (careMore) {
    push(careMore[1], 0.85, `Valued over ${bounded(careMore[2], 80)}`);
    push(careMore[2], 0.45, `Lower priority than ${bounded(careMore[1], 80)}`);
  }

  const weightOver = text.match(
    /\bweight\s+(.+?)\s+over\s+(.+?)(?:[.!?]|$)/i,
  );
  if (weightOver) {
    push(weightOver[1], 0.85, `Weighted over ${bounded(weightOver[2], 80)}`);
    push(weightOver[2], 0.4, `Secondary to ${bounded(weightOver[1], 80)}`);
  }

  const always = [...text.matchAll(/\balways\s+(?:want|include|prefer|keep)\s+(.+?)(?:[.!?;,]|$)/gi)];
  for (const match of always) push(match[1], 0.8, "Always");

  const never = [...text.matchAll(/\bnever\s+(?:want|include|use|accept)\s+(.+?)(?:[.!?;,]|$)/gi)];
  for (const match of never) push(`Avoid: ${match[1]}`, 0.75, "Never");

  // Style / taste / investing cues become soft evaluative weights when nothing explicit matched.
  if (!found.length) {
    const style = text.match(
      /\b(?:like|in the style of|inspired by|as if(?:\s+by)?)\s+(.+?)(?:\n|$)/i,
    )?.[1]
      || text.match(/\breflects?\s+(.+?)(?:['’]s)?\s+(?:style|taste|voice)\b/i)?.[1];
    if (/\bbuffett\b|\bmargin of safety\b|\bcircle of competence\b|\bvalue invest/i.test(text)) {
      push("Moat durability", 0.92, "Prefer widening economic moats");
      push("Management integrity", 0.9, "Capital allocation honesty");
      push("Margin of safety", 0.88, "Price versus conservative value");
      push("Owner mindset", 0.85, "Business owner, not trader");
      push("Long time horizon", 0.84, "Years over quarters");
    } else if (style) {
      push(`Voice fidelity · ${bounded(style, 60)}`, 0.8, "Honor the referenced thought process");
      push("Concrete imagery over polish", 0.7, "Prefer lived specificity");
      push("Emotional honesty", 0.75, "Judgement: honesty over neatness");
    } else if (/\b(?:poetry|poem|haiku|verse)\b/i.test(text)) {
      push("Concrete imagery", 0.75, "Prefer images over abstraction");
      push("Compression", 0.65, "Fewer words, sharper edge");
    } else if (/\b(?:investor|investing|memo|diligence|startup|tam)\b/i.test(text)) {
      push("Evidence over narrative", 0.85, "Skeptical underwriting");
      push("Risk clarity", 0.8, "Surface downside early");
      push("Traction specificity", 0.7, "Numbers over adjectives");
    }
  }

  return normalizePearlWeights(found.slice(0, options.limit || 12));
}

/** Human-readable summary for systemPrompt projection (no ids). */
export function summarizeWeightsForPrompt(weights = []) {
  const list = normalizePearlWeights(weights);
  if (!list.length) return "";
  const ranked = [...list].sort((a, b) => b.priority - a.priority);
  return ranked
    .map((entry) => {
      const pct = Math.round(entry.priority * 100);
      return entry.note
        ? `- ${entry.name} (${pct}%): ${entry.note}`
        : `- ${entry.name} (${pct}%)`;
    })
    .join("\n");
}

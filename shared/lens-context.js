import { contentFingerprint } from "./lens-grammar.js";
import { validateLibraryObject } from "./library-objects.js";

export const LENS_CONTEXT_VERSION = 1;
export const DEFAULT_CONTEXT_BUDGET = 24_000;
const SENSITIVE = /\b(?:api[_ -]?key|access[_ -]?token|refresh[_ -]?token|password|authorization|cookie)\b/i;

function materialText(item) {
  return String(item?.content ?? item?.text ?? item?.quote ?? "");
}

export function compileLensContext(lenses = [], options = {}) {
  const ordered = [...lenses].sort((a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0));
  ordered.forEach((lens) => validateLibraryObject(lens));
  const empty = ordered.find((lens) => lens.contextPolicy === "empty");
  if (empty) {
    return {
      kind: "lens-context-envelope",
      version: LENS_CONTEXT_VERSION,
      mode: "isolated",
      text: "",
      sources: [],
      conflicts: ordered.length > 1 ? [{ type: "empty-overrides", lensId: empty.id, ignoredLensIds: ordered.filter((lens) => lens.id !== empty.id).map((lens) => lens.id) }] : [],
      excluded: [],
      provenance: {
        lenses: [{ id: empty.id, version: empty.version }],
        fingerprint: contentFingerprint({ lenses: [{ id: empty.id, version: empty.version }], mode: "isolated" }),
      },
    };
  }
  const requestedBudget = Math.max(0, Math.min(
    Number(options.budget) || DEFAULT_CONTEXT_BUDGET,
    ...ordered.map((lens) => Number(lens.contextBudget) || DEFAULT_CONTEXT_BUDGET)
  ));
  const included = [];
  const excluded = [];
  const sources = [];
  let used = 0;
  for (const lens of ordered) {
    const material = [...lens.contextGraph.material].sort((a, b) => (Number(a.priority) || 0) - (Number(b.priority) || 0));
    for (const item of material) {
      const value = materialText(item);
      if (!value) continue;
      if (lens.inclusionPolicy?.excludeSensitive !== false && SENSITIVE.test(value)) {
        excluded.push({ lensId: lens.id, itemId: item.id, reason: "sensitive" });
        continue;
      }
      if (item.private === true && options.includePrivate !== true) {
        excluded.push({ lensId: lens.id, itemId: item.id, reason: "private" });
        continue;
      }
      const remaining = requestedBudget - used;
      if (remaining <= 0) {
        excluded.push({ lensId: lens.id, itemId: item.id, reason: "budget" });
        continue;
      }
      const clipped = value.slice(0, remaining);
      included.push(`[Lens: ${lens.name || "Emerging lens"} · ${item.id || "material"}]\n${clipped}`);
      used += clipped.length;
      if (item.provenance && lens.inclusionPolicy?.includeSources !== false) {
        sources.push({ lensId: lens.id, itemId: item.id, ...item.provenance });
      }
      if (clipped.length < value.length) excluded.push({ lensId: lens.id, itemId: item.id, reason: "budget-truncated" });
    }
  }
  const lensRefs = ordered.map((lens) => ({ id: lens.id, version: lens.version, priority: lens.priority }));
  const conflicts = [];
  const seenNames = new Map();
  ordered.forEach((lens) => {
    for (const item of lens.contextGraph.material) {
      const key = String(item.key || "").trim().toLowerCase();
      if (!key) continue;
      if (seenNames.has(key) && materialText(seenNames.get(key).item) !== materialText(item)) {
        conflicts.push({ type: "context-value", key, higherPriorityLensId: seenNames.get(key).lens.id, lowerPriorityLensId: lens.id });
      } else if (!seenNames.has(key)) seenNames.set(key, { lens, item });
    }
  });
  return {
    kind: "lens-context-envelope",
    version: LENS_CONTEXT_VERSION,
    mode: "bounded",
    text: included.join("\n\n"),
    characters: used,
    budget: requestedBudget,
    sources,
    conflicts,
    excluded,
    provenance: {
      lenses: lensRefs,
      fingerprint: contentFingerprint({ lenses: lensRefs, included, sources, conflicts }),
    },
  };
}

export function composeLenses(lenses = [], options = {}) {
  const envelope = compileLensContext(lenses, options);
  return {
    order: envelope.provenance.lenses,
    conflicts: envelope.conflicts,
    envelope,
  };
}

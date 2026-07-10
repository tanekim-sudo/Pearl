/**
 * Duplicate-lens detection shared by every "save as lens" path.
 *
 * A duplicate is an existing top-level lens with the same trimmed
 * case-insensitive name, or with identical content (same prompt for a leaf,
 * same ordered step content for a pipeline).
 */

function normName(name) {
  return String(name || "").trim().toLowerCase();
}

/** Content signature of an operator tree — name-independent, order-sensitive. */
export function lensContentSignature(op, opMap = {}, seen = new Set()) {
  if (!op || seen.has(op.id)) return "";
  if (op.id) seen.add(op.id);
  if (op.kind === "pipeline") {
    const steps = (op.steps || [])
      .map((sid) => lensContentSignature(opMap[sid], opMap, seen))
      .filter(Boolean);
    return steps.length ? `p(${steps.join("|")})` : "";
  }
  const prompt = String(op.prompt || "").trim().toLowerCase();
  return prompt ? `l(${prompt})` : `n(${normName(op.name)})`;
}

/**
 * Find an existing top-level lens that duplicates `root`.
 * @param {object[]} existing all current operators
 * @param {object} root the root op about to be saved
 * @param {object} draftMap id → op map for the draft tree (for pipeline steps)
 * @param {{ excludeId?: string|null }} [opts] root id being replaced (edits)
 * @returns {object|null} the duplicated lens, or null
 */
export function findDuplicateLens(existing, root, draftMap = {}, { excludeId = null } = {}) {
  if (!root?.name?.trim() || !Array.isArray(existing)) return null;
  const name = normName(root.name);
  const existingMap = Object.fromEntries(existing.map((o) => [o.id, o]));
  const sig = lensContentSignature(root, draftMap);
  for (const o of existing) {
    if (!o?.top || o.id === excludeId || o.id === root.id) continue;
    if (normName(o.name) === name) return o;
    if (sig && lensContentSignature(o, existingMap) === sig) return o;
  }
  return null;
}

/**
 * Two object types in Lens:
 * - **lens** — a reusable way of seeing (pattern, glyph, material template)
 * - **transformation** — an executable operator pipeline (with optional versioning)
 */

/** Pattern lenses (formerly structures / symbols). */
export const PATTERN_LENSES_KEY = "lens.lenses.v2";
export const LEGACY_STRUCTURES_KEY = "lens.structures.v1";

/** Versioned transformation repos (formerly cognition-git "lenses"). */
export const TRANSFORMATION_REPOS_KEY = "lens.transformation-repos.v1";
export const LEGACY_GIT_LENSES_KEY = "lens.lenses.v1";

export const ACTIVE_TRANSFORMATION_KEY = "lens.activeTransformation.v1";
export const LEGACY_ACTIVE_LENS_KEY = "lens.activeLens.v1";

/** Left-rail drop targets. */
export const RAIL_TRANSFORMATIONS = "transformations";
export const RAIL_LENSES = "lenses";

export const OBJECT_TYPE_LABELS = {
  lens: "lens",
  lenses: "lenses",
  transformation: "transformation",
  transformations: "transformations",
};

export function loadPatternLenses(loadFn, migrateLegacy) {
  const v2 = loadFn(PATTERN_LENSES_KEY, null);
  if (Array.isArray(v2)) return v2;
  const legacy = loadFn(LEGACY_STRUCTURES_KEY, null);
  if (Array.isArray(legacy) && legacy.length) return legacy;
  const migrated = migrateLegacy?.();
  return Array.isArray(migrated) ? migrated : [];
}

export function loadTransformationRepos(loadArrayFn) {
  const next = loadArrayFn(TRANSFORMATION_REPOS_KEY, null);
  if (Array.isArray(next) && next.length) return next;
  return loadArrayFn(LEGACY_GIT_LENSES_KEY, []);
}

export function loadActiveTransformationId(loadFn) {
  return loadFn(ACTIVE_TRANSFORMATION_KEY, null) || loadFn(LEGACY_ACTIVE_LENS_KEY, null);
}

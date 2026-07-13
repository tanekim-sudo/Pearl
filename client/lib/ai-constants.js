/** Shared AI constellation layout constants (no imports — safe for all modules). */

export const AI_NODE_RADIUS = {
  source: 18,
  expanded: 16,
  move: 14,
  lens: 16,
  session: 18,
};

/** Minimum center-to-center distance from parent when spawning children. */
export const AI_SPAWN_MIN_DIST = 112;

/** Minimum gap between node edges during overlap resolution. */
export const AI_NODE_MIN_GAP = 18;

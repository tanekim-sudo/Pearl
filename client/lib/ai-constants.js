/** Shared AI constellation layout constants (no imports — safe for all modules). */

export const AI_NODE_RADIUS = {
  source: 34,
  expanded: 30,
  move: 26,
  lens: 30,
  session: 34,
};

/** Minimum center-to-center distance from parent when spawning children. */
export const AI_SPAWN_MIN_DIST = 480;

/** Minimum gap between node edges during overlap resolution. */
export const AI_NODE_MIN_GAP = 240;

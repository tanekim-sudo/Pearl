/**
 * Reef — shelf/library of context pearls you can equip into the Companion gauntlet.
 * Not a second control center. Routing lands here for `/`, `/library`, and `/toolbox`.
 */

export const REEF_HOME_PATHS = Object.freeze(["/", "/library", "/toolbox"]);

export function isReefHomePath(path = "/") {
  const normalized = String(path || "/").replace(/\/+$/, "") || "/";
  return REEF_HOME_PATHS.includes(normalized);
}

/** Collect every non-archived context pearl across scenes for the Reef shelf. */
export function collectReefPearls(scenes = []) {
  const pearls = [];
  for (const scene of scenes) {
    for (const orb of scene.semanticOrbs || []) {
      if (orb?.archived) continue;
      pearls.push({
        id: orb.id,
        name: orb.name || orb.identity?.name || "Pearl",
        sceneId: scene.id,
        sceneName: scene.name || "Scene",
        kind: orb.kind || "semantic",
        aesthetic: orb.aesthetic || null,
        orb,
        scene,
      });
    }
  }
  return pearls;
}

/** Resolve a named/id context pearl anywhere in the workspace (Reef or Scene). */
export function findWorkspacePearl(scenes = [], needle = "") {
  const query = String(needle || "").trim().toLowerCase();
  const pearls = collectReefPearls(scenes);
  if (!pearls.length) return null;
  if (!query) return pearls[0];
  return pearls.find((entry) => String(entry.name || "").toLowerCase() === query)
    || pearls.find((entry) => String(entry.name || "").toLowerCase().includes(query))
    || pearls.find((entry) => entry.id === needle)
    || null;
}

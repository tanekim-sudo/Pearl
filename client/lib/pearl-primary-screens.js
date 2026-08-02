/**
 * Primary Pearl shell screens that a clueless user must reach from the default
 * OrbUniverse chrome (visible nav) and/or Companion Talk→GO.
 *
 * Anti-orphan inventory — keep in sync with OrbUniverseShell mounts + stress gates.
 */

export const PRIMARY_SHELL_SCREENS = Object.freeze([
  Object.freeze({
    id: "reef",
    label: "Reef",
    path: "/",
    testId: "shell-nav-reef",
    companionPhrases: Object.freeze(["go home", "open the reef", "show the reef"]),
    worldVisible: /Reef|Your pearls|Talk to Companion/i,
  }),
  Object.freeze({
    id: "library",
    label: "Library",
    path: "/library",
    testId: "shell-nav-library",
    companionPhrases: Object.freeze(["open the library", "show the library"]),
    worldVisible: /Reef|Library|saved tools/i,
    aliasOf: "reef",
  }),
  Object.freeze({
    id: "toolbox",
    label: "Toolbox",
    path: "/toolbox",
    testId: "shell-nav-toolbox",
    companionPhrases: Object.freeze(["open the toolbox", "show the toolbox"]),
    worldVisible: /Reef|Toolbox|saved tools/i,
    aliasOf: "reef",
  }),
  Object.freeze({
    id: "install",
    label: "Install",
    path: "/install",
    testId: "shell-nav-install",
    companionPhrases: Object.freeze(["install the extension", "get the extension", "add pearl to chrome"]),
    worldVisible: /Install Pearl|Add Pearl to Chrome|Download for Chrome|browser extension/i,
    downloadTestId: "extension-download-cta",
  }),
  Object.freeze({
    id: "settings",
    label: "Settings",
    path: "/settings",
    testId: "shell-nav-settings",
    emit: "settings",
    companionPhrases: Object.freeze(["open settings", "open account and privacy"]),
    worldVisible: /Account & privacy|Working locally|Accounts aren.t set up|Sign in|account sync|Lock local/i,
  }),
  Object.freeze({
    id: "encode",
    label: "Encode",
    path: null,
    testId: "shell-nav-encode",
    emit: "encode",
    companionPhrases: Object.freeze(["encode anything", "open encode"]),
    worldVisible: /Encode anything|prompt|PDF|Drive|Automation Pearl/i,
  }),
  Object.freeze({
    id: "packages",
    label: "Packages",
    path: "/packages",
    testId: "shell-nav-packages",
    emit: "packages",
    companionPhrases: Object.freeze(["open packages", "show shared tools"]),
    worldVisible: /Shared tools|Cognitive Package|package|Install package/i,
  }),
  Object.freeze({
    id: "scene",
    label: "Scene",
    path: null,
    testId: "shell-nav-scene",
    companionPhrases: Object.freeze([
      "open a new scene",
      "open scene",
      "open the scene",
      "show me the scene controls",
      "open output frame",
    ]),
    worldVisible: /Scene|Playing with pearls|Output Frame|Talk to Companion|New pearl/i,
  }),
  Object.freeze({
    id: "studio",
    label: "Studio",
    path: null,
    testId: null,
    companionPhrases: Object.freeze(["open studio", "organize this pearl", "open pearl studio"]),
    worldVisible: /Studio|Function|Moves|Back to Reef|Inspect structure/i,
    via: "pearl-click-or-companion",
  }),
]);

/** Screens that must appear as hit-testable controls in default Reef chrome. */
export const VISIBLE_SHELL_NAV_IDS = Object.freeze([
  "reef",
  "scene",
  "install",
  "settings",
  "encode",
  "packages",
]);

export function visibleShellNavScreens() {
  // Preserve VISIBLE_SHELL_NAV_IDS order (Reef → Scene → …) for chrome hit-targets.
  return VISIBLE_SHELL_NAV_IDS
    .map((id) => PRIMARY_SHELL_SCREENS.find((screen) => screen.id === id))
    .filter(Boolean);
}

export function primaryScreenById(id) {
  return PRIMARY_SHELL_SCREENS.find((screen) => screen.id === id) || null;
}

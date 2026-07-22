/**
 * Pearl-centered navigation: durable escape hatches without classic chrome.
 * Escape order: approval cancel → collapse companion → close emission → exit cursor → close guide → leave install/studio.
 */

import { REEF_HOME_PATHS } from "./reef-home.js";

export const SHELL_ACTION_EVENT = "lens:shell-action";

export function dispatchShellAction(action, detail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SHELL_ACTION_EVENT, { detail: { action, ...detail } }));
}

/** Navigate to a Reef home path (`/`, `/library`, `/toolbox`). Unknown paths fall back to `/`. */
export function navigateToReefPath(path = "/") {
  const normalized = String(path || "/").replace(/\/+$/, "") || "/";
  const target = REEF_HOME_PATHS.includes(normalized) ? normalized : "/";
  if (typeof history === "undefined") return { path: target };
  history.pushState({ pearlNav: true }, "", target);
  window.dispatchEvent(new PopStateEvent("popstate"));
  return { path: target };
}

export function navigateHome() {
  return navigateToReefPath("/");
}

/** Deterministic companion phrases that must work without planner/credentials. */
export function matchShellNavigationIntent(text = "") {
  const normalized = String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
  if (/^(?:go home(?: to the reef)?|open home|open(?: the)? reef|show(?: the)? reef|back to (?:pearl|home|reef))$/i.test(normalized)) {
    return "navigateHome";
  }
  if (/^(?:go back|navigate back)$/i.test(normalized)) {
    return "navigateBack";
  }
  if (/^(?:open(?: the)? library|show(?: the)? library|go to(?: the)? library)$/i.test(normalized)) {
    return "openLibrary";
  }
  if (/^(?:open(?: the)? toolbox|show(?: the)? toolbox|go to(?: the)? toolbox)$/i.test(normalized)) {
    return "openToolbox";
  }
  return null;
}

/**
 * Stay on-origin. Only rewind history when this session pushed a Pearl route;
 * otherwise return to `/` via pushState so companion audits and embeds never
 * escape to about:blank or a foreign document.
 */
export function navigateBackOrHome() {
  if (typeof history === "undefined" || typeof location === "undefined") {
    return { path: "/", via: "home" };
  }
  const path = String(location.pathname || "/").replace(/\/+$/, "") || "/";
  if (history.state?.pearlNav && path !== "/") {
    history.back();
    return { path: "back", via: "history" };
  }
  if (path !== "/") {
    return { ...navigateHome(), via: "home" };
  }
  return { path: "/", via: "home" };
}

/**
 * Resolve the next Escape step given current surface flags.
 * Returns the action name to perform, or null when nothing is open.
 */
export function nextEscapeAction({
  approvalPending = false,
  companionExpanded = false,
  emittedView = null,
  outputFrameOpen = false,
  cursorMode = false,
  guideOpen = false,
  welcomeOpen = false,
  installRoute = false,
  studioOpen = false,
  sceneRoute = false,
} = {}) {
  if (approvalPending) return "cancelApproval";
  if (companionExpanded) return "collapseCompanion";
  if (emittedView) return "closeEmission";
  if (outputFrameOpen) return "closeOutputFrame";
  if (cursorMode) return "exitCursor";
  if (guideOpen) return "closeGuide";
  if (welcomeOpen) return "dismissWelcome";
  if (studioOpen) return "leaveStudio";
  if (installRoute) return "leaveInstall";
  if (sceneRoute) return "leaveScene";
  return null;
}

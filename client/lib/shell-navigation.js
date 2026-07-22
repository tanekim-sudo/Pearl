/**
 * Pearl-centered navigation: durable escape hatches without classic chrome.
 * Escape order: approval cancel → collapse companion → close emission → exit cursor → close guide → leave install/studio.
 */

export const SHELL_ACTION_EVENT = "lens:shell-action";

export function dispatchShellAction(action, detail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SHELL_ACTION_EVENT, { detail: { action, ...detail } }));
}

export function navigateHome() {
  if (typeof history === "undefined") return { path: "/" };
  history.pushState({ pearlNav: true }, "", "/");
  window.dispatchEvent(new PopStateEvent("popstate"));
  return { path: "/" };
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
  cursorMode = false,
  guideOpen = false,
  welcomeOpen = false,
  installRoute = false,
  studioOpen = false,
} = {}) {
  if (approvalPending) return "cancelApproval";
  if (companionExpanded) return "collapseCompanion";
  if (emittedView) return "closeEmission";
  if (cursorMode) return "exitCursor";
  if (guideOpen) return "closeGuide";
  if (welcomeOpen) return "dismissWelcome";
  if (studioOpen) return "leaveStudio";
  if (installRoute) return "leaveInstall";
  return null;
}

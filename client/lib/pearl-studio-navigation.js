/**
 * Pearl Studio opens in a new tab when popups are allowed. When they are blocked,
 * same-document hash changes do not remount main.jsx — force a full reload so the
 * Studio boot path runs.
 */

export function buildPearlStudioHref(ref, locationRef = globalThis.location) {
  const path = locationRef?.pathname || "/";
  const search = locationRef?.search || "";
  return `${path}${search}#pearl-studio=${encodeURIComponent(ref)}`;
}

/**
 * @param {string} ref opaque studio reference from createWebPearlStudioReference
 * @param {object} [deps] injectable browser seams for tests
 * @returns {{ mode: "popup"|"reload", href: string }}
 */
export function openPearlStudioDocument(ref, deps = {}) {
  const {
    open = (...args) => globalThis.open?.(...args),
    reload = () => globalThis.location?.reload?.(),
    replaceState = (...args) => globalThis.history?.replaceState?.(...args),
    session = globalThis.sessionStorage,
    locationRef = globalThis.location,
  } = deps;
  const href = buildPearlStudioHref(ref, locationRef);
  let opened = null;
  try {
    opened = open?.(href, "_blank", "noopener") || null;
  } catch {
    opened = null;
  }
  if (opened && typeof opened === "object" && opened.closed !== true) {
    return { mode: "popup", href };
  }
  try {
    session?.setItem?.("pearlStudioActiveRef", ref);
  } catch {
    /* private mode */
  }
  // Hash-only assign never remounts Studio; rewrite then reload the document.
  replaceState?.(null, "", href);
  reload?.();
  return { mode: "reload", href };
}

/**
 * Pearl Studio opens in a new tab when popups are allowed. When they are blocked,
 * same-document hash changes do not remount main.jsx — force a full reload so the
 * Studio boot path runs.
 *
 * Always flush encrypted local vault before navigate/popup so Studio can read the
 * pearl entity + opaque ref after remount (otherwise: "reference is unavailable").
 */

export function buildPearlStudioHref(ref, locationRef = globalThis.location) {
  const path = locationRef?.pathname || "/";
  const search = locationRef?.search || "";
  return `${path}${search}#pearl-studio=${encodeURIComponent(ref)}`;
}

/**
 * Persist in-memory secure-local-storage values to IndexedDB before a navigation
 * that remounts the app (Studio reload / popup boot).
 */
export async function flushPearlPrivacyBeforeStudio(deps = {}) {
  const privacy = deps.privacy ?? globalThis.window?.__pearlPrivacy;
  if (privacy?.flush) {
    try {
      await privacy.flush();
    } catch {
      /* unlocked / unavailable — best effort */
    }
  }
}

/**
 * @param {string} ref opaque studio reference from createWebPearlStudioReference
 * @param {object} [deps] injectable browser seams for tests
 * @returns {Promise<{ mode: "popup"|"reload", href: string }>}
 */
export async function openPearlStudioDocument(ref, deps = {}) {
  const {
    open = (...args) => globalThis.open?.(...args),
    reload = () => globalThis.location?.reload?.(),
    replaceState = (...args) => globalThis.history?.replaceState?.(...args),
    session = globalThis.sessionStorage,
    locationRef = globalThis.location,
    pearlId = null,
    // Same-window is the clueless default — popups feel like a lost tab.
    preferSameWindow = true,
  } = deps;
  await flushPearlPrivacyBeforeStudio(deps);
  const href = buildPearlStudioHref(ref, locationRef);
  try {
    session?.setItem?.("pearlStudioActiveRef", ref);
    if (pearlId) session?.setItem?.("pearlStudioActivePearlId", String(pearlId));
  } catch {
    /* private mode */
  }
  if (!preferSameWindow) {
    let opened = null;
    try {
      opened = open?.(href, "_blank", "noopener") || null;
    } catch {
      opened = null;
    }
    if (opened && typeof opened === "object" && opened.closed !== true) {
      return { mode: "popup", href };
    }
  }
  // Hash-only assign never remounts Studio; rewrite then reload the document.
  replaceState?.(null, "", href);
  reload?.();
  return { mode: "reload", href };
}

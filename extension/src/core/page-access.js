/** Origins requested so the in-page Companion (Mother Pearl) can mount on the open web. */
export const PAGE_HOST_ORIGINS = Object.freeze(["http://*/*", "https://*/*"]);

export function pageAccessPermission() {
  return { origins: [...PAGE_HOST_ORIGINS] };
}

/** True when optional wildcards or any concrete http(s) host permission is present. */
export function originsGrantPageAccess(origins = []) {
  return (origins || []).some((origin) => (
    origin === "<all_urls>"
    || origin === "http://*/*"
    || origin === "https://*/*"
    || origin === "*://*/*"
    || /^https?:\/\//.test(String(origin || ""))
  ));
}

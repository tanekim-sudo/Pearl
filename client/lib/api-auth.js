let accessTokenGetter = () => null;

/** @param {() => string | null | undefined} getter */
export function setApiAccessTokenGetter(getter) {
  accessTokenGetter = getter;
}

/** True when a bearer token is available for AI routes that require sign-in. */
export function hasApiAccessToken() {
  return Boolean(String(accessTokenGetter() || "").trim());
}

/**
 * @param {Record<string, string>} [extra]
 * @returns {Record<string, string>}
 */
export function apiAuthHeaders(extra = {}) {
  const headers = { ...extra };
  const token = accessTokenGetter();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

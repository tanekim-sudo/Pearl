let accessTokenGetter = () => null;

/** @param {() => string | null | undefined} getter */
export function setApiAccessTokenGetter(getter) {
  accessTokenGetter = getter;
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

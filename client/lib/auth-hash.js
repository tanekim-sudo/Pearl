// Parses the URL hash Supabase auth redirects land on. Only error hashes are
// ours to handle: success-token hashes (#access_token=...) belong to
// supabase-js (detectSessionInUrl), and #share= belongs to the share flow.

/** @returns {{ errorCode: string, type: string | null } | null} */
export function parseAuthHashError(hash) {
  if (typeof hash !== "string") return null;
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return null;
  let params;
  try {
    params = new URLSearchParams(raw);
  } catch {
    return null;
  }
  if (params.has("access_token")) return null;
  const errorCode = params.get("error_code") || params.get("error");
  if (!errorCode) return null;
  return { errorCode, type: params.get("type") || null };
}

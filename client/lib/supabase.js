// Vite inlines import.meta.env at build time; under `node --test` it is
// undefined, so all reads go through this guard.
const VITE_ENV = (typeof import.meta !== "undefined" && import.meta.env) || {};

let createClientFn = null;
let sdkLoadError = null;

const sdkReady = import("@supabase/supabase-js")
  .then((mod) => {
    createClientFn = mod.createClient;
  })
  .catch((err) => {
    sdkLoadError = err;
    console.warn("[lens] @supabase/supabase-js unavailable — accounts disabled.", err);
  });

export function readSupabaseConfig(env) {
  const url =
    typeof env?.VITE_SUPABASE_URL === "string" ? env.VITE_SUPABASE_URL.trim() : "";
  const key =
    typeof env?.VITE_SUPABASE_PUBLISHABLE_KEY === "string"
      ? env.VITE_SUPABASE_PUBLISHABLE_KEY.trim()
      : "";
  if (!url || !key) return null;
  return { url, key };
}

const CONFIG = readSupabaseConfig(VITE_ENV);

let client = null;
let warned = false;

export function isSupabaseConfigured() {
  return CONFIG !== null && !sdkLoadError;
}

export function whenSupabaseReady() {
  return sdkReady;
}

// The client is constructed lazily, never at module scope: the boot-time auth
// error-hash parse must run before Supabase starts consuming the URL hash, and
// construction order (not module evaluation order) is what guarantees that.
export function getSupabase() {
  if (!CONFIG) {
    if (!warned) {
      warned = true;
      console.warn(
        "[lens] Supabase not configured — set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to enable accounts."
      );
    }
    return null;
  }
  if (!createClientFn) return null;
  if (!client) {
    try {
      client = createClientFn(CONFIG.url, CONFIG.key);
    } catch (err) {
      console.warn("[lens] Supabase client init failed:", err);
      return null;
    }
  }
  return client;
}

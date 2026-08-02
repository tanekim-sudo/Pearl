import { createClient } from "@supabase/supabase-js";

let adminClient = null;

function readServerSupabaseConfig() {
  const url = typeof process.env.SUPABASE_URL === "string" ? process.env.SUPABASE_URL.trim() : "";
  const secret =
    typeof process.env.SUPABASE_SECRET_KEY === "string"
      ? process.env.SUPABASE_SECRET_KEY.trim()
      : "";
  if (!url || !secret) return null;
  return { url, secret };
}

export function isServerSupabaseConfigured() {
  return readServerSupabaseConfig() !== null;
}

export function getAdminClient() {
  const config = readServerSupabaseConfig();
  if (!config) return null;
  if (!adminClient) {
    adminClient = createClient(config.url, config.secret, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

/**
 * Verify a Bearer JWT from the Authorization header.
 * Returns { user, plan } or null when unauthenticated / unconfigured.
 *
 * @param {import('express').Request} req
 */
export async function verifyRequestUser(req) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  if (!token) return null;

  const client = getAdminClient();
  if (!client) return null;

  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return null;

  let plan = { kind: "free" };
  let organizations = [];
  try {
    const { data: subs } = await client
      .from("subscriptions")
      .select("plan_id, status, created_at")
      .eq("user_id", data.user.id);
    const active = (subs || []).filter((s) => s.status === "active" || s.status === "trialing");
    if (active.length) {
      const latest = active.reduce((a, b) =>
        String(b.created_at || "") > String(a.created_at || "") ? b : a
      );
      plan = { kind: "paid", planId: latest.plan_id };
    }
  } catch {
    /* plan lookup is best-effort */
  }

  try {
    const { data: memberships, error } = await client
      .from("cognitive_package_team_members")
      .select("team_id, role")
      .eq("user_id", data.user.id);
    if (!error) organizations = (memberships || []).map((entry) => ({ id: String(entry.team_id), role: String(entry.role) }));
  } catch {
    organizations = [];
  }

  return { user: data.user, plan, organizations, teamIds: organizations.map((entry) => entry.id) };
}

/**
 * Optional auth middleware: attaches req.lensUser when a valid JWT is present.
 * Does not reject anonymous requests — AI endpoints stay usable without accounts
 * until SUPABASE_SECRET_KEY is set and enforcement is enabled.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function attachLensUser(req, _res, next) {
  try {
    const verified = await verifyRequestUser(req);
    if (verified) req.lensUser = verified;
  } catch {
    /* ignore */
  }
  next();
}

/**
 * When server Supabase is configured, require a valid JWT for AI routes.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function requireLensUser(req, res, next) {
  if (!isServerSupabaseConfigured()) return next();
  if (!req.lensUser?.user) {
    res.status(401).json({
      error: "Sign in required to use AI features.",
      code: "needs-credentials",
    });
    return;
  }
  next();
}

export async function exchangeExtensionAuthorizationCode({ code, verifier, redirectUri }) {
  const config = readServerSupabaseConfig();
  if (!config) {
    throw Object.assign(
      new Error("Accounts aren’t set up for this build. Set SUPABASE_URL and SUPABASE_SECRET_KEY on the server, then retry — or keep working locally."),
      { status: 503, code: "needs-credentials" },
    );
  }
  if (!/^[A-Za-z0-9_-]{20,512}$/.test(String(code || ""))) throw Object.assign(new Error("invalid authorization code"), { status: 400 });
  if (!/^[a-f0-9]{64}$/i.test(String(verifier || ""))) throw Object.assign(new Error("invalid authorization verifier"), { status: 400 });
  const redirect = new URL(String(redirectUri || ""));
  if (redirect.protocol !== "https:" || !/\.chromiumapp\.org$/i.test(redirect.hostname) || redirect.pathname !== "/auth") {
    throw Object.assign(new Error("invalid extension redirect"), { status: 400 });
  }
  const response = await fetch(`${config.url}/auth/v1/token?grant_type=pkce`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: config.secret },
    body: JSON.stringify({ auth_code: code, code_verifier: verifier }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) throw Object.assign(new Error("authorization code exchange failed"), { status: 401 });
  return { accessToken: body.access_token, expiresIn: body.expires_in || null };
}

export function extensionAuthorizationUrl({ redirectUri, state, codeChallenge }) {
  const config = readServerSupabaseConfig();
  if (!config) {
    throw Object.assign(
      new Error("Accounts aren’t set up for this build. Set SUPABASE_URL and SUPABASE_SECRET_KEY on the server, then retry — or keep working locally."),
      { status: 503, code: "needs-credentials" },
    );
  }
  const redirect = new URL(String(redirectUri || ""));
  if (redirect.protocol !== "https:" || !/\.chromiumapp\.org$/i.test(redirect.hostname) || redirect.pathname !== "/auth") {
    throw Object.assign(new Error("invalid extension redirect"), { status: 400 });
  }
  if (!/^[a-f0-9-]{36}$/i.test(String(state || "")) || !/^[A-Za-z0-9_-]{43,128}$/.test(String(codeChallenge || ""))) {
    throw Object.assign(new Error("invalid authorization request"), { status: 400 });
  }
  const url = new URL("/auth/v1/authorize", config.url);
  url.searchParams.set("provider", process.env.SUPABASE_EXTENSION_PROVIDER || "google");
  url.searchParams.set("redirect_to", redirect.href);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "s256");
  return url.href;
}

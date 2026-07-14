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

  return { user: data.user, plan };
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
    res.status(401).json({ error: "Sign in required to use AI features." });
    return;
  }
  next();
}

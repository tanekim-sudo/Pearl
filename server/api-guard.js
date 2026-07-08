import { verifyRequestUser, isServerSupabaseConfigured } from "./supabase-auth.js";

/**
 * Optional gate for AI API routes. When SUPABASE_REQUIRE_AUTH=true and the
 * server secret is configured, rejects unauthenticated requests.
 *
 * @param {import('express').Request | import('http').IncomingMessage} req
 * @param {import('express').Response | import('http').ServerResponse} res
 * @returns {Promise<boolean>} true when the handler should continue
 */
export async function guardAiRequest(req, res) {
  if (!isServerSupabaseConfigured() || process.env.SUPABASE_REQUIRE_AUTH !== "true") {
    return true;
  }
  const verified = await verifyRequestUser(req);
  if (!verified) {
    res.status(401).json({ error: "Sign in required to use AI features." });
    return false;
  }
  req.lensUser = verified;
  return true;
}

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
  const production = process.env.NODE_ENV === "production" || !!process.env.VERCEL;
  const mustAuthenticate = production || process.env.SUPABASE_REQUIRE_AUTH === "true";
  if (!mustAuthenticate) {
    return true;
  }
  if (!isServerSupabaseConfigured()) {
    res.status(503).json({
      error: "Accounts aren’t set up for this build. Set SUPABASE_URL and SUPABASE_SECRET_KEY on the server — or keep working locally.",
      code: "needs-credentials",
    });
    return false;
  }
  const verified = await verifyRequestUser(req);
  if (!verified) {
    res.status(401).json({
      error: "Sign in required to use AI features.",
      code: "needs-credentials",
    });
    return false;
  }
  req.lensUser = verified;
  return true;
}

import { configuredOrigins } from "./http-security.js";

export function serverlessExtension(handler, { methods = ["GET"], maxBytes = 512_000 } = {}) {
  return async (req, res) => {
    const origin = String(req.headers?.origin || "").replace(/\/$/, "");
    const allowed = configuredOrigins();
    if (origin && !allowed.has(origin)) return res.status(403).json({ error: "origin not allowed" });
    if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Headers", "authorization, content-type, idempotency-key, x-lens-client");
    res.setHeader("Access-Control-Allow-Methods", [...methods, "OPTIONS"].join(", "));
    res.setHeader("Vary", "Origin");
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (req.method === "OPTIONS") return res.status(204).end();
    if (!methods.includes(req.method)) return res.status(405).json({ error: "Method not allowed" });
    const size = Number(req.headers?.["content-length"] || 0);
    if (size > maxBytes) return res.status(413).json({ error: "request too large" });
    try {
      if (typeof req.body === "string") req.body = JSON.parse(req.body || "{}");
      await handler(req, res);
    } catch (error) {
      res.status(error?.status || 500).json({ error: error?.message || "Extension request failed." });
    }
  };
}

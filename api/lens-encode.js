import { guardAiRequest } from "../server/api-guard.js";
import { encodeLens } from "../server/lens-encoder.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await guardAiRequest(req, res))) return;
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const result = await encodeLens(body);
    res.status(200).json(result);
  } catch (error) {
    res.status(error?.status || 500).json({ error: error?.message || "Lens encoding failed", code: error?.code || "LENS_ENCODING_FAILED" });
  }
}

import { guardAiRequest } from "../server/api-guard.js";
import { inferBeforeAfterTransformation } from "../server/before-after-inference.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  if (!(await guardAiRequest(req, res))) return;
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const result = await inferBeforeAfterTransformation(body);
    res.status(200).json(result);
  } catch (error) {
    console.error("[lens] /api/infer-transformation failed:", error?.message || error);
    res.status(error?.status || 500).json({
      error: error?.message || "Could not infer the transformation. Your examples are preserved; retry.",
    });
  }
}

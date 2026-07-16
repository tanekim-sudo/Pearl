import { runExecutionPlan } from "../server/executor.js";
import { guardAiRequest } from "../server/api-guard.js";

/** One server round-trip for full resolve → research → synthesize plans. */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  if (!(await guardAiRequest(req, res))) return;
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const { op, opMap, operators, material, image, modelPreference } = body;
    if (!op) {
      res.status(400).json({ error: "op is required" });
      return;
    }
    const data = await runExecutionPlan({
      op,
      opMap: opMap || {},
      operators: operators || [],
      material: material || "",
      image: image || null,
      modelPreference,
    });
    res.status(200).json(data);
  } catch (err) {
    console.error("[lens] /api/execute failed:", err?.message || err);
    res.status(err?.status || 500).json({ error: err?.message || "Execution failed." });
  }
}

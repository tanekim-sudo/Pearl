import { guardAiRequest } from "../server/api-guard.js";
import { inferBeforeAfterTransformation } from "../server/before-after-inference.js";
import { inferAutomationPearl } from "../server/automation-inference.js";
import { inferTranscriptArtifacts } from "../server/transcript-inference.js";

/** Shared inference entrypoint — Vercel Hobby limits deployments to 12 functions. */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  if (!(await guardAiRequest(req, res))) return;
  const route = String(req.query?.route || "transformation");
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    if (route === "automation") {
      return res.status(200).json(await inferAutomationPearl(body));
    }
    if (route === "transcript-artifacts") {
      return res.status(200).json(await inferTranscriptArtifacts(body));
    }
    const result = await inferBeforeAfterTransformation(body);
    res.status(200).json(result);
  } catch (error) {
    const label =
      route === "automation"
        ? "/api/infer-automation"
        : route === "transcript-artifacts"
          ? "/api/infer-transcript-artifacts"
          : "/api/infer-transformation";
    console.error(`[lens] ${label} failed:`, error?.message || error);
    const fallback =
      route === "automation"
        ? "Could not compile the Automation Pearl. Your evidence is preserved; retry."
        : route === "transcript-artifacts"
          ? "Could not learn from this chat. Your private draft is preserved; retry."
          : "Could not infer the transformation. Your examples are preserved; retry.";
    res.status(error?.status || 500).json({
      error: error?.message || fallback,
    });
  }
}

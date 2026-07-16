import { runPrompt } from "../server/llm.js";
import { guardAiRequest } from "../server/api-guard.js";
import { getModelCatalog } from "../server/model-catalog.js";
import { encodeLens } from "../server/lens-encoder.js";
import { startGenerationBatch } from "../server/generation-runner.js";

export default async function handler(req, res) {
  const route = String(req.query?.route || "");
  if (route === "models") {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    const catalog = await getModelCatalog();
    res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=3600");
    return res.status(200).json(catalog);
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  if (!(await guardAiRequest(req, res))) return;

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    if (route === "lens-encode") {
      return res.status(200).json(await encodeLens(body));
    }
    if (route === "generate-batch") {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("X-Accel-Buffering", "no");
      const send = (event) => res.write(`${JSON.stringify(event)}\n`);
      const handle = startGenerationBatch(body, {
        onCandidate: async (event, batch) => send({ ...event, batchId: batch.id }),
      });
      req.on?.("close", () => handle.cancelRemaining());
      send({ type: "batch-created", batch: handle.batch });
      send({ type: "batch-completed", batch: await handle.done });
      return res.end();
    }
    const { prompt, text, count, image, system, maxTokens, research, timeoutMs, compact, profile, modelPreference } = body;
    const data = await runPrompt({
      prompt,
      text,
      count,
      image,
      system,
      maxTokens,
      research,
      timeoutMs,
      compact,
      profile,
      model: modelPreference,
    });
    res.status(200).json(data);
  } catch (err) {
    console.error("[lens] /api/run failed:", err?.message || err);
    if (res.headersSent) {
      res.write(`${JSON.stringify({ type: "request-failed", error: { code: err?.code || "REQUEST_FAILED", message: err?.message || "Request failed" } })}\n`);
      return res.end();
    }
    res.status(err?.status || 500).json({
      error: err?.error?.error?.message || err?.message || "Something went wrong calling the model.",
    });
  }
}

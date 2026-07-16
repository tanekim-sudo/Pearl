import { guardAiRequest } from "../server/api-guard.js";
import { startGenerationBatch } from "../server/generation-runner.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await guardAiRequest(req, res))) return;
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no");
  const send = (event) => res.write(`${JSON.stringify(event)}\n`);
  try {
    const handle = startGenerationBatch(body, {
      onCandidate: async (event, batch) => send({ ...event, batchId: batch.id }),
    });
    req.on?.("close", () => handle.cancelRemaining());
    send({ type: "batch-created", batch: handle.batch });
    const batch = await handle.done;
    send({ type: "batch-completed", batch });
  } catch (error) {
    send({ type: "batch-failed", error: { code: error?.code || "BATCH_FAILED", message: error?.message || "Generation batch failed" } });
  } finally {
    res.end();
  }
}

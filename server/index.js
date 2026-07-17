import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { runPrompt, hasKey, MODEL, VISION_MODEL } from "./llm.js";
import { runPipeline } from "./pipeline.js";
import { compileExecutionPlan } from "./plan.js";
import { runPhase, runExecutionPlan } from "./executor.js";
import {
  encodeShareBundle,
  decodeShareToken,
  validateShareBundle,
  buildShareUrl,
  SHARE_BUNDLE_VERSION,
} from "../shared/share-bundle.js";
import { attachLensUser } from "./supabase-auth.js";
import { guardAiRequest } from "./api-guard.js";
import { corsOptions, rateLimit, securityHeaders } from "./http-security.js";
import {
  extensionArtifact,
  extensionExecute,
  extensionGenerator,
  extensionLibrary,
} from "./extension-api.js";
import { inferBeforeAfterTransformation } from "./before-after-inference.js";
import { inferTranscriptArtifacts } from "./transcript-inference.js";
import { getModelCatalog } from "./model-catalog.js";
import { modelGateway } from "./model-gateway.js";
import { encodeLens } from "./lens-encoder.js";
import { startGenerationBatch } from "./generation-runner.js";
import { researchConfiguration, verifiedResearch } from "./research-provider.js";
import { cognitivePackageRegistry } from "./cognitive-package-registry.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8787;

if (!hasKey()) {
  console.warn(
    "\n[lens] WARNING: AI Gateway is not configured. Set AI_GATEWAY_API_KEY locally or deploy with Vercel OIDC.\n"
  );
}

const app = express();
app.use(cors(corsOptions()));
app.use(securityHeaders);
app.use(express.json({ limit: "7mb" }));
app.use(attachLensUser);

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    hasKey: hasKey(),
    model: MODEL,
    visionModel: VISION_MODEL,
    modelGateway: modelGateway.configuration(),
    research: researchConfiguration(),
  });
});
app.get("/api/models", async (_req, res) => {
  const catalog = await getModelCatalog();
  res.json(catalog);
});
app.post("/api/research", rateLimit({ windowMs: 60_000, limit: 12 }), async (req, res) => {
  if (!(await guardAiRequest(req, res))) return;
  try {
    res.json(await verifiedResearch(req.body || {}));
  } catch (err) {
    console.error("[lens] /api/research failed:", err?.message || err);
    res.status(err?.status || 500).json({
      error: err?.message || "Verified research failed.",
      code: err?.code || "RESEARCH_FAILED",
    });
  }
});

const packageLimiter = rateLimit({ windowMs: 60_000, limit: 30 });
app.get("/api/cognitive-packages", packageLimiter, async (req, res) => {
  try {
    res.json(await cognitivePackageRegistry.list({
      userId: req.lensUser?.user?.id || null,
      teamId: req.query.teamId || null,
      query: req.query.query || "",
      cursor: req.query.cursor || 0,
      limit: req.query.limit || 20,
    }));
  } catch (err) {
    res.status(err?.status || 500).json({ error: err?.message || "Package registry lookup failed.", code: err?.code || "PACKAGE_LIST_FAILED" });
  }
});
app.post("/api/cognitive-packages/publish", packageLimiter, async (req, res) => {
  try {
    const receipt = await cognitivePackageRegistry.publish(req.body?.manifest, {
      userId: req.lensUser?.user?.id || null,
      teamId: req.body?.teamId || null,
      approved: req.body?.approved === true,
      idempotencyKey: req.body?.idempotencyKey,
    });
    res.status(201).json(receipt);
  } catch (err) {
    res.status(err?.status || 500).json({ error: err?.message || "Package publication failed.", code: err?.code || "PACKAGE_PUBLISH_FAILED" });
  }
});
app.post("/api/cognitive-packages/deprecate", packageLimiter, async (req, res) => {
  try {
    res.json(await cognitivePackageRegistry.deprecate(req.body || {}, {
      userId: req.lensUser?.user?.id || null,
      approved: req.body?.approved === true,
      idempotencyKey: req.body?.idempotencyKey,
    }));
  } catch (err) {
    res.status(err?.status || 500).json({ error: err?.message || "Package deprecation failed.", code: err?.code || "PACKAGE_DEPRECATE_FAILED" });
  }
});

const extensionLimiter = rateLimit({ windowMs: 60_000, limit: 24 });
const extensionHandler = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (err) {
    console.error(`[lens] ${req.path} failed:`, err?.message || err);
    res.status(err?.status || 500).json({ error: err?.message || "Extension request failed." });
  }
};
app.get("/api/extension/library", extensionLimiter, extensionHandler(extensionLibrary));
app.post("/api/extension/execute", extensionLimiter, express.json({ limit: "512kb" }), extensionHandler(extensionExecute));
app.post("/api/extension/artifacts", extensionLimiter, express.json({ limit: "512kb" }), extensionHandler(extensionArtifact));
app.delete("/api/extension/artifacts/:id", extensionLimiter, extensionHandler(extensionArtifact));
app.post("/api/extension/generators", extensionLimiter, express.json({ limit: "256kb" }), extensionHandler(extensionGenerator));

app.post("/api/run", async (req, res) => {
  if (!(await guardAiRequest(req, res))) return;
  try {
    const { prompt, text, count, image, system, maxTokens, research, timeoutMs, compact, profile, modelPreference } =
      req.body ?? {};
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
    res.json(data);
  } catch (err) {
    console.error("[lens] /api/run failed:", err?.message || err);
    res.status(err?.status || 500).json({
      error: err?.error?.error?.message || err?.message || "Something went wrong calling the model.",
    });
  }
});

app.post("/api/lens-encode", express.json({ limit: "7mb" }), async (req, res) => {
  if (!(await guardAiRequest(req, res))) return;
  try {
    res.json(await encodeLens(req.body || {}));
  } catch (err) {
    console.error("[lens] /api/lens-encode failed:", err?.message || err);
    res.status(err?.status || 500).json({ error: err?.message || "Lens encoding failed.", code: err?.code || "LENS_ENCODING_FAILED" });
  }
});

app.post("/api/generate-batch", async (req, res) => {
  if (!(await guardAiRequest(req, res))) return;
  res.status(200);
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.flushHeaders?.();
  const send = (event) => res.write(`${JSON.stringify(event)}\n`);
  try {
    const handle = startGenerationBatch(req.body || {}, {
      onCandidate: async (event, batch) => send({ ...event, batchId: batch.id }),
    });
    req.on("close", () => handle.cancelRemaining());
    send({ type: "batch-created", batch: handle.batch });
    send({ type: "batch-completed", batch: await handle.done });
  } catch (err) {
    send({ type: "batch-failed", error: { code: err?.code || "BATCH_FAILED", message: err?.message || "Generation batch failed" } });
  } finally {
    res.end();
  }
});

app.post("/api/infer-transformation", express.json({ limit: "7mb" }), async (req, res) => {
  if (!(await guardAiRequest(req, res))) return;
  try {
    res.json(await inferBeforeAfterTransformation(req.body || {}));
  } catch (err) {
    console.error("[lens] /api/infer-transformation failed:", err?.message || err);
    res.status(err?.status || 500).json({
      error: err?.message || "Could not infer the transformation. Your examples are preserved; retry.",
    });
  }
});

app.post("/api/infer-transcript-artifacts", express.json({ limit: "8mb" }), async (req, res) => {
  if (!(await guardAiRequest(req, res))) return;
  try {
    res.json(await inferTranscriptArtifacts(req.body || {}));
  } catch (err) {
    console.error("[lens] /api/infer-transcript-artifacts failed:", err?.message || err);
    res.status(err?.status || 500).json({
      error: err?.message || "Could not learn from this chat. Your private draft is preserved; retry.",
    });
  }
});

app.post("/api/plan", async (req, res) => {
  try {
    const { op, opMap, material } = req.body ?? {};
    if (!op) return res.status(400).json({ error: "op is required" });
    res.json({ plan: compileExecutionPlan(op, opMap || {}, material || "") });
  } catch (err) {
    console.error("[lens] /api/plan failed:", err?.message || err);
    res.status(500).json({ error: err?.message || "Failed to compile plan." });
  }
});

app.post("/api/phase", async (req, res) => {
  if (!(await guardAiRequest(req, res))) return;
  try {
    const { phaseId, plan, op, opMap, operators, context, image, modelPreference } = req.body ?? {};
    if (!phaseId) return res.status(400).json({ error: "phaseId is required" });
    const executionPlan = plan || compileExecutionPlan(op, opMap || {}, context?.material || "");
    const result = await runPhase(phaseId, executionPlan, context || {}, { operators, op, image, modelPreference });
    res.json({ phaseId, ...result });
  } catch (err) {
    console.error("[lens] /api/phase failed:", err?.message || err);
    res.status(err?.status || 500).json({ error: err?.message || "Phase failed." });
  }
});

app.post("/api/execute", async (req, res) => {
  if (!(await guardAiRequest(req, res))) return;
  try {
    const { op, opMap, operators, material, image, modelPreference } = req.body ?? {};
    if (!op) return res.status(400).json({ error: "op is required" });
    const data = await runExecutionPlan({
      op,
      opMap: opMap || {},
      operators: operators || [],
      material: material || "",
      image: image || null,
      modelPreference,
    });
    res.json(data);
  } catch (err) {
    console.error("[lens] /api/execute failed:", err?.message || err);
    res.status(err?.status || 500).json({ error: err?.message || "Execution failed." });
  }
});

app.post("/api/pipeline", async (req, res) => {
  if (!(await guardAiRequest(req, res))) return;
  try {
    const { op, opMap, operators, material, image, modelPreference } = req.body ?? {};
    const steps = [];
    const data = await runPipeline({
      op,
      opMap: opMap || {},
      operators: operators || [],
      material: material || "",
      image: image || null,
      modelPreference,
      onStep: (name, i, total) => steps.push({ name, index: i, total }),
    });
    res.json({ ...data, steps });
  } catch (err) {
    console.error("[lens] /api/pipeline failed:", err?.message || err);
    res.status(err?.status || 500).json({
      error: err?.error?.error?.message || err?.message || "Pipeline failed.",
    });
  }
});

app.post("/api/share", (req, res) => {
  try {
    const body = req.body ?? {};
    let bundle = body.bundle;
    if (!bundle && body.kind) bundle = body;
    const validated = validateShareBundle(bundle);
    if (!validated.ok) return res.status(400).json({ error: validated.error });
    const token = encodeShareBundle(validated.bundle);
    const origin = `${req.protocol}://${req.get("host")}`;
    const { url, placement } = buildShareUrl(validated.bundle, origin, "/");
    res.json({ id: token, token, url, placement, v: SHARE_BUNDLE_VERSION });
  } catch (err) {
    console.error("[lens] /api/share POST failed:", err?.message || err);
    res.status(500).json({ error: err?.message || "Failed to create share link." });
  }
});

app.get("/api/share/:id", (req, res) => {
  const decoded = decodeShareToken(String(req.params.id || ""));
  if (!decoded.ok) return res.status(404).json({ error: decoded.error });
  res.json({ bundle: decoded.bundle });
});

// Serve the built client in production, if it exists.
const distDir = path.join(__dirname, "..", "dist");
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distDir, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`\n[lens] server running on http://localhost:${PORT}`);
  console.log(`[lens] model: ${MODEL}`);
  if (VISION_MODEL !== MODEL) console.log(`[lens] vision model: ${VISION_MODEL}`);
  if (!fs.existsSync(distDir)) {
    console.log(`[lens] dev: open the Vite client at http://localhost:5173\n`);
  }
});

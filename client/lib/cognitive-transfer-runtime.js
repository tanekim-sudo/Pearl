/**
 * Runtime helpers — LLM enrichment and instantiation for cognitive transfer.
 * Used by client App.jsx; calls /api/run.
 */

import {
  buildAbstractionRequest,
  buildInstantiationRequest,
  mergeTransferEnrichment,
  normalizeTransfer,
} from "../../shared/cognitive-transfer.js";

function parseJsonFromModel(raw) {
  const text = (raw || "").trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() || text;
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(candidate.slice(start, end + 1));
    throw new Error("model did not return valid JSON");
  }
}

/**
 * Enrich structural transfer with LLM abstraction layer.
 * @param {object} structural - from abstractOperatorToTransfer / abstractSymbolToTransfer
 * @param {Function} runClaude - (prompt, text, opts) => Promise<string>
 * @param {object} [opts]
 */
export async function enrichTransferWithLLM(structural, runClaude, opts = {}) {
  const req = buildAbstractionRequest(structural, opts);
  try {
    const out = await runClaude(req.user, "", {
      system: req.system,
      maxTokens: opts.maxTokens || 4096,
    });
    const json = parseJsonFromModel(out);
    return mergeTransferEnrichment(structural, json);
  } catch (err) {
    if (opts.fallbackStructural !== false) return structural;
    throw err;
  }
}

/**
 * Instantiate transfer for target domain (fidelity or cross-domain).
 * Returns pipeline JSON tree suitable for treeToOperators.
 */
export async function instantiateTransfer(transfer, runClaude, ctx = {}) {
  const normalized = normalizeTransfer(transfer);
  const req = buildInstantiationRequest(normalized, ctx);

  if (ctx.structuralOnly) return req.structuralFallback;

  try {
    const out = await runClaude(req.user, ctx.targetMaterial || "", {
      system: req.system,
      maxTokens: ctx.maxTokens || 8192,
    });
    const json = parseJsonFromModel(out);
    if (json.pipeline) return json.pipeline;
    if (json.instantiatedPhases?.length) {
      const steps = json.instantiatedPhases.map((p) => ({
        name: p.name || p.phase,
        prompt: p.prompt,
        description: p.phase,
      }));
      if (steps.length === 1) return { name: normalized.name, ...steps[0] };
      return { name: normalized.name, description: normalized.narrative, steps };
    }
    return req.structuralFallback;
  } catch {
    return req.structuralFallback;
  }
}

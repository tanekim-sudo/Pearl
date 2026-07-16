import { createGenerationBatch, updateCandidate } from "../shared/generation-plan.js";
import { typedExecutionOutputs } from "../shared/output-specifications.js";
import { modelGateway } from "./model-gateway.js";

export function startGenerationBatch(input = {}, options = {}) {
  let batch = createGenerationBatch(input, options);
  const controllers = new Map();
  const emit = async (event) => {
    await options.onCandidate?.(event, batch);
  };
  const done = Promise.all(batch.candidates.map(async (candidate) => {
    const controller = new AbortController();
    controllers.set(candidate.id, controller);
    batch = updateCandidate(batch, candidate.id, { status: "running" });
    await emit({ type: "candidate-started", candidateId: candidate.id, requestedModel: candidate.requestedModel });
    try {
      const response = options.executeCandidate
        ? await options.executeCandidate({ candidate, batch, signal: controller.signal })
        : await modelGateway.generate({
            profile: input.profile || (input.artifactRef?.kind === "function" ? "function_execution" : "move_execution"),
            model: candidate.requestedModel,
            messages: input.messages,
            maxTokens: input.maxTokens,
            temperature: batch.generationPlan.temperature,
            signal: controller.signal,
            requiredCapabilities: input.requiredCapabilities || [],
            stream: true,
            onDelta: async (delta) => {
              batch = updateCandidate(batch, candidate.id, {
                status: "streaming",
                streamedText: delta.accumulatedText,
              });
              await emit({ ...delta, candidateId: candidate.id, type: `candidate-${delta.type}` });
            },
          });
      const rawOutputs = response.outputs || [response.output ?? response.text ?? response];
      const typedResult = typedExecutionOutputs(rawOutputs, batch.structuralOutputSpec, {}, {
        runId: candidate.id,
      });
      batch = updateCandidate(batch, candidate.id, {
        status: "completed",
        typedResult,
        resolvedModel: response.provenance?.resolvedModel || response.model || candidate.requestedModel,
        providerRoute: response.provenance?.providerRoute || null,
        fallback: !!response.provenance?.fallback,
        provenance: {
          requestedModel: candidate.requestedModel,
          resolvedModel: response.provenance?.resolvedModel || response.model || null,
          providerRoute: response.provenance?.providerRoute || null,
          fallback: !!response.provenance?.fallback,
          latencyMs: response.provenance?.latencyMs || null,
          usage: response.usage || null,
          generationId: response.provenance?.generationId || null,
        },
      });
      await emit({ type: "candidate-completed", candidateId: candidate.id, typedResult, provenance: batch.candidates.find((entry) => entry.id === candidate.id).provenance });
    } catch (error) {
      const cancelled = controller.signal.aborted || error?.code === "MODEL_CANCELLED";
      batch = updateCandidate(batch, candidate.id, {
        status: cancelled ? "cancelled" : "failed",
        error: { code: error?.code || "CANDIDATE_FAILED", message: error?.message || "Candidate failed", retryable: !!error?.retryable },
      });
      await emit({ type: cancelled ? "candidate-cancelled" : "candidate-failed", candidateId: candidate.id, error: batch.candidates.find((entry) => entry.id === candidate.id).error });
    } finally {
      controllers.delete(candidate.id);
    }
  })).then(() => batch);
  return {
    get batch() { return batch; },
    done,
    cancelCandidate(candidateId) { controllers.get(candidateId)?.abort("cancelled"); },
    cancelRemaining() { controllers.forEach((controller) => controller.abort("batch-cancelled")); },
  };
}

export async function runGenerationBatch(input = {}, options = {}) {
  const handle = startGenerationBatch(input, options);
  await handle.done;
  return { batch: handle.batch };
}

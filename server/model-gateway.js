import crypto from "node:crypto";
import { getModelCatalog, compatibleWithProfile } from "./model-catalog.js";
import { getModelProfile } from "./model-profiles.js";
import { runPrompt as runHuggingFacePrompt } from "./huggingface.js";

const GATEWAY_URL = "https://ai-gateway.vercel.sh/v1/chat/completions";
const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);

export class ModelGatewayError extends Error {
  constructor(message, { code = "MODEL_GATEWAY_ERROR", status = 502, retryable = false, cause, details } = {}) {
    super(message, { cause });
    this.name = "ModelGatewayError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.details = details || null;
  }
}

export function gatewayAuth(env = process.env) {
  const apiKey = String(env.AI_GATEWAY_API_KEY || "").trim();
  const oidc = String(env.VERCEL_OIDC_TOKEN || "").trim();
  if (apiKey) return { configured: true, kind: "api-key", token: apiKey };
  if (oidc) return { configured: true, kind: "vercel-oidc", token: oidc };
  return { configured: false, kind: "none", token: "" };
}

const contentText = (content) => typeof content === "string"
  ? content
  : Array.isArray(content) ? content.map((part) => part?.text || "").join("\n") : "";

function normalizeUsage(usage = {}) {
  return {
    inputTokens: Number(usage.prompt_tokens ?? usage.input_tokens) || 0,
    outputTokens: Number(usage.completion_tokens ?? usage.output_tokens) || 0,
    totalTokens: Number(usage.total_tokens) || 0,
    costUsd: Number(usage.cost ?? usage.total_cost) || null,
  };
}

function normalizeRequestMessages(messages = []) {
  return messages.slice(0, 100).map((message) => ({
    role: ["system", "user", "assistant", "tool"].includes(message?.role) ? message.role : "user",
    ...(message?.name ? { name: String(message.name).slice(0, 100) } : {}),
    content: Array.isArray(message?.content)
      ? message.content.slice(0, 16).map((part) => {
          if (part?.type === "image_url" && /^data:image\/[a-z0-9.+-]+;base64,/i.test(part?.image_url?.url || "")) {
            return { type: "image_url", image_url: { url: part.image_url.url } };
          }
          return { type: "text", text: String(part?.text || "").slice(0, 500_000) };
        })
      : String(message?.content || "").slice(0, 500_000),
  }));
}

function estimatedCost(model, inputCharacters, outputTokens) {
  if (!model?.pricing) return null;
  return (Math.ceil(inputCharacters / 4) * (model.pricing.input || 0)) + (outputTokens * (model.pricing.output || 0));
}

async function readGatewayStream(response, onDelta) {
  if (!response.body?.getReader) throw new ModelGatewayError("Gateway streaming response had no readable body.", { code: "MODEL_STREAM_UNAVAILABLE" });
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let model = "";
  let id = "";
  let usage = {};
  const toolCalls = new Map();
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      let payload;
      try { payload = JSON.parse(data); } catch { continue; }
      model = payload.model || model;
      id = payload.id || id;
      usage = payload.usage || usage;
      const choice = payload.choices?.[0];
      const delta = choice?.delta || {};
      const piece = contentText(delta.content);
      if (piece) {
        text += piece;
        await onDelta?.({ type: "text-delta", text: piece, accumulatedText: text, model, generationId: id });
      }
      for (const call of delta.tool_calls || []) {
        const index = Number(call.index) || 0;
        const current = toolCalls.get(index) || { id: call.id || null, type: call.type || "function", function: { name: "", arguments: "" } };
        if (call.id) current.id = call.id;
        if (call.function?.name) current.function.name += call.function.name;
        if (call.function?.arguments) current.function.arguments += call.function.arguments;
        toolCalls.set(index, current);
        await onDelta?.({ type: "tool-call-delta", index, toolCall: structuredClone(current) });
      }
    }
    if (done) break;
  }
  return { text: text.trim(), model, id, usage, toolCalls: [...toolCalls.values()] };
}

export class ModelGateway {
  constructor({ fetchImpl = fetch, env = process.env, catalog = getModelCatalog } = {}) {
    this.fetchImpl = fetchImpl;
    this.env = env;
    this.catalog = catalog;
  }

  configuration() {
    const auth = gatewayAuth(this.env);
    return {
      provider: "vercel-ai-gateway",
      configured: auth.configured,
      authentication: auth.kind,
      directFallbackConfigured: this.env.MODEL_GATEWAY_ALLOW_DIRECT_FALLBACK === "true"
        && Boolean(this.env.HF_TOKEN || this.env.HUGGINGFACE_API_KEY),
      catalog: true,
      streaming: true,
      cancellation: true,
      structuredOutput: true,
      tools: true,
    };
  }

  async resolveModel(profileId, requestedModel, requiredCapabilities = []) {
    const baseProfile = getModelProfile(profileId, this.env);
    const profile = {
      ...baseProfile,
      capabilities: [...new Set([...(baseProfile.capabilities || []), ...requiredCapabilities])],
    };
    const catalog = await this.catalog({ fetchImpl: this.fetchImpl, env: this.env });
    const byId = new Map(catalog.models.map((model) => [model.id, model]));
    if (requestedModel && requestedModel !== "auto") {
      const requested = byId.get(requestedModel);
      if (!requested) throw new ModelGatewayError("Requested model is unavailable in the current gateway catalog.", { code: "MODEL_UNAVAILABLE", status: 400 });
      if (!compatibleWithProfile(requested, profile)) {
        throw new ModelGatewayError("Requested model is incompatible with this task.", { code: "MODEL_INCOMPATIBLE", status: 400 });
      }
      return { requestedModel, model: requested, profile, catalog };
    }
    const preferred = profile.preferredModels.map((id) => byId.get(id)).find((model) => compatibleWithProfile(model, profile));
    const model = preferred || catalog.models
      .filter((candidate) => compatibleWithProfile(candidate, profile))
      .sort((a, b) => {
        const tier = profile.tier?.cost === "low";
        if (tier) return (a.pricing?.input ?? Infinity) - (b.pricing?.input ?? Infinity);
        return (b.releasedAt || 0) - (a.releasedAt || 0);
      })[0];
    if (!model) throw new ModelGatewayError("No compatible model is available for this task. Configure a profile model or retry the catalog.", {
      code: "NO_COMPATIBLE_MODEL", status: 503, retryable: true,
    });
    return { requestedModel: requestedModel || "auto", model, profile, catalog };
  }

  async generate(request = {}) {
    const started = Date.now();
    const auth = gatewayAuth(this.env);
    const resolved = await this.resolveModel(
      request.profile || "move_execution",
      request.model || "auto",
      request.requiredCapabilities || [],
    );
    const inputCharacters = JSON.stringify(request.messages || []).length;
    if (inputCharacters > resolved.profile.maxBudget.inputCharacters) {
      throw new ModelGatewayError("Task context exceeds its configured budget.", { code: "CONTEXT_BUDGET_EXCEEDED", status: 413 });
    }
    const maxTokens = Math.min(
      Number(request.maxTokens) || 4096,
      resolved.profile.maxBudget.outputTokens,
      resolved.model.maxOutputTokens || Infinity,
    );
    const estimate = estimatedCost(resolved.model, inputCharacters, maxTokens);
    if (estimate != null && estimate > resolved.profile.maxBudget.usd) {
      throw new ModelGatewayError("Estimated model cost exceeds this task profile budget.", { code: "COST_BUDGET_EXCEEDED", status: 402 });
    }
    if (!auth.configured) return this.directFallback(request, resolved, started, "gateway-unconfigured");

    const body = {
      model: resolved.model.id,
      messages: normalizeRequestMessages(request.messages),
      max_tokens: maxTokens,
      ...(request.temperature != null ? { temperature: request.temperature } : {}),
      ...(request.tools?.length ? { tools: request.tools, tool_choice: request.toolChoice || "auto" } : {}),
      ...(request.jsonSchema ? {
        response_format: {
          type: "json_schema",
          json_schema: { name: request.jsonSchema.name || "result", strict: true, schema: request.jsonSchema.schema },
        },
      } : {}),
      ...(request.reasoningEffort ? { reasoning_effort: request.reasoningEffort } : {}),
      stream: request.stream === true || typeof request.onDelta === "function",
    };
    const attempts = Math.max(1, Math.min(Number(request.retries) || 2, 3));
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort("timeout"), Math.min(Number(request.timeoutMs) || 60_000, 300_000));
      const abort = () => controller.abort(request.signal?.reason || "cancelled");
      request.signal?.addEventListener?.("abort", abort, { once: true });
      try {
        const response = await this.fetchImpl(GATEWAY_URL, {
          method: "POST",
          headers: {
            authorization: `Bearer ${auth.token}`,
            "content-type": "application/json",
            "x-lens-request-id": request.requestId || crypto.randomUUID(),
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new ModelGatewayError(payload?.error?.message || `Gateway request failed (${response.status}).`, {
            code: response.status === 429 ? "MODEL_QUOTA_EXCEEDED" : "MODEL_PROVIDER_ERROR",
            status: response.status,
            retryable: RETRYABLE.has(response.status),
          });
        }
        if (body.stream) {
          const streamed = await readGatewayStream(response, request.onDelta);
          if (!streamed.text && !streamed.toolCalls.length) throw new ModelGatewayError("Model returned no streamed output.", { code: "EMPTY_MODEL_OUTPUT" });
          return {
            text: streamed.text,
            output: streamed.text,
            toolCalls: streamed.toolCalls,
            model: streamed.model || resolved.model.id,
            usage: normalizeUsage(streamed.usage),
            provenance: {
              profile: resolved.profile.id,
              profileVersion: resolved.profile.version,
              requestedModel: resolved.requestedModel,
              resolvedModel: streamed.model || resolved.model.id,
              gateway: "vercel-ai-gateway",
              providerRoute: response.headers?.get?.("x-vercel-ai-gateway-provider") || null,
              fallback: false,
              streamed: true,
              latencyMs: Date.now() - started,
              generationId: streamed.id || null,
            },
          };
        }
        const payload = await response.json().catch(() => ({}));
        const choice = payload.choices?.[0];
        const text = contentText(choice?.message?.content).trim();
        if (!text && !choice?.message?.tool_calls?.length) throw new ModelGatewayError("Model returned no output.", { code: "EMPTY_MODEL_OUTPUT" });
        return {
          text,
          output: text,
          toolCalls: choice?.message?.tool_calls || [],
          model: payload.model || resolved.model.id,
          usage: normalizeUsage(payload.usage),
          provenance: {
            profile: resolved.profile.id,
            profileVersion: resolved.profile.version,
            requestedModel: resolved.requestedModel,
            resolvedModel: payload.model || resolved.model.id,
            gateway: "vercel-ai-gateway",
            providerRoute: response.headers?.get?.("x-vercel-ai-gateway-provider") || null,
            fallback: false,
            latencyMs: Date.now() - started,
            generationId: payload.id || null,
          },
        };
      } catch (error) {
        const aborted = controller.signal.aborted;
        lastError = aborted
          ? new ModelGatewayError(request.signal?.aborted ? "Model request cancelled." : "Model request timed out.", {
              code: request.signal?.aborted ? "MODEL_CANCELLED" : "MODEL_TIMEOUT",
              status: request.signal?.aborted ? 499 : 504,
              retryable: !request.signal?.aborted,
              cause: error,
            })
          : error instanceof ModelGatewayError ? error : new ModelGatewayError("Gateway request failed.", { cause: error, retryable: true });
        if (!lastError.retryable || attempt === attempts) break;
        await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
      } finally {
        clearTimeout(timeout);
        request.signal?.removeEventListener?.("abort", abort);
      }
    }
    return this.directFallback(request, resolved, started, lastError?.code || "gateway-failed", lastError);
  }

  async directFallback(request, resolved, started, reason, originalError) {
    const allowed = this.env.MODEL_GATEWAY_ALLOW_DIRECT_FALLBACK === "true";
    if (!allowed || !resolved.profile.allowFallback || !(this.env.HF_TOKEN || this.env.HUGGINGFACE_API_KEY)) {
      if (originalError) throw originalError;
      throw new ModelGatewayError("Vercel AI Gateway is not configured. Set AI_GATEWAY_API_KEY locally or enable Vercel OIDC for the deployment.", {
        code: "MODEL_GATEWAY_UNCONFIGURED", status: 503,
      });
    }
    const system = request.messages?.find((message) => message.role === "system")?.content || "";
    const user = request.messages?.filter((message) => message.role !== "system").map((message) => contentText(message.content)).join("\n\n");
    const response = await runHuggingFacePrompt({
      prompt: user || "Complete the requested task.",
      text: "",
      system: contentText(system),
      maxTokens: request.maxTokens,
      timeoutMs: request.timeoutMs,
      temperature: request.temperature,
      signal: request.signal,
    });
    const text = response.outputs[0] || "";
    return {
      text,
      output: text,
      model: response.model,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: null },
      provenance: {
        profile: resolved.profile.id,
        profileVersion: resolved.profile.version,
        requestedModel: resolved.requestedModel,
        resolvedModel: response.model,
        gateway: "direct-huggingface-adapter",
        providerRoute: this.env.HF_PROVIDER || null,
        fallback: true,
        fallbackReason: reason,
        latencyMs: Date.now() - started,
      },
    };
  }
}

export const modelGateway = new ModelGateway();

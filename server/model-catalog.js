const CATALOG_URL = "https://ai-gateway.vercel.sh/v1/models";
const CACHE_TTL_MS = 15 * 60_000;
let cache = null;
let pending = null;

const tagSet = (value) => new Set(Array.isArray(value) ? value.map((tag) => String(tag).toLowerCase()) : []);
const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null;

export function normalizeGatewayModel(raw = {}) {
  const id = String(raw.id || "").trim();
  if (!/^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._:/-]*$/i.test(id)) return null;
  const tags = tagSet(raw.tags);
  const type = String(raw.type || "language").toLowerCase();
  const provider = String(raw.owned_by || id.split("/")[0] || "unknown");
  const vision = tags.has("vision") || tags.has("image-input") || ["vision", "multimodal"].includes(type);
  const audio = tags.has("audio") || tags.has("audio-input") || type === "audio";
  const image = tags.has("image-generation") || type === "image";
  const tools = tags.has("tool-use") || tags.has("tools") || tags.has("function-calling");
  const structured = tags.has("structured-output") || tags.has("json-mode") || tools;
  return {
    id,
    provider,
    displayName: String(raw.name || id),
    description: String(raw.description || "").slice(0, 1000),
    modalities: {
      input: ["text", ...(vision ? ["image"] : []), ...(audio ? ["audio"] : [])],
      output: [image ? "image" : "text", ...(audio && type !== "language" ? ["audio"] : [])],
    },
    contextWindow: finite(raw.context_window),
    maxOutputTokens: finite(raw.max_tokens),
    capabilities: {
      text: type === "language" || vision || tags.has("chat"),
      vision,
      audio,
      image,
      tools,
      structured,
      reasoning: tags.has("reasoning"),
    },
    pricing: raw.pricing && typeof raw.pricing === "object" ? {
      input: finite(raw.pricing.input),
      output: finite(raw.pricing.output),
      unit: "usd_per_token",
    } : null,
    availability: raw.deprecated ? "deprecated" : "available",
    deprecated: !!raw.deprecated,
    releasedAt: finite(raw.released),
  };
}

export function compatibleWithProfile(model, profile) {
  if (!model || model.availability !== "available") return false;
  return (profile.capabilities || []).every((capability) => {
    if (capability === "structured") return model.capabilities.structured;
    return model.capabilities[capability] === true;
  });
}

function configuredFallback(env = process.env) {
  const ids = [
    env.AI_GATEWAY_MODEL,
    env.AI_GATEWAY_MODEL_COMPANION,
    env.AI_GATEWAY_MODEL_MOVE,
    env.AI_GATEWAY_MODEL_FUNCTION,
    env.AI_GATEWAY_MODEL_LENS,
    env.AI_GATEWAY_MODEL_LENS_ENCODING,
    env.AI_GATEWAY_MODEL_WORKSPACE_VISION,
    env.AI_GATEWAY_MODEL_VISION,
    env.AI_GATEWAY_MODEL_TRANSCRIPT,
    env.AI_GATEWAY_MODEL_LIGHTWEIGHT,
  ].flatMap((value) => String(value || "").split(",")).map((value) => value.trim()).filter(Boolean);
  return [...new Set(ids)].map((id) => normalizeGatewayModel({
    id,
    name: id,
    owned_by: id.split("/")[0],
    type: "language",
    tags: ["tool-use", "structured-output", ...(id === env.AI_GATEWAY_MODEL_VISION ? ["vision"] : [])],
  })).filter(Boolean);
}

export async function getModelCatalog({ fetchImpl = fetch, force = false, now = Date.now(), env = process.env } = {}) {
  if (!force && cache && now - cache.fetchedAt < CACHE_TTL_MS) return cache;
  if (!force && pending) return pending;
  pending = (async () => {
    try {
      const response = await fetchImpl(CATALOG_URL, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8_000) });
      if (!response.ok) throw new Error(`catalog returned ${response.status}`);
      const payload = await response.json();
      const models = (Array.isArray(payload?.data) ? payload.data : []).map(normalizeGatewayModel).filter(Boolean);
      if (!models.length) throw new Error("catalog returned no usable models");
      cache = { version: 1, source: "vercel-live", stale: false, fetchedAt: now, models };
    } catch (error) {
      if (cache?.models?.length) cache = { ...cache, stale: true, error: "Live catalog unavailable; using last known catalog." };
      else cache = {
        version: 1,
        source: "configured-minimal",
        stale: true,
        fetchedAt: now,
        models: configuredFallback(env),
        error: "Live catalog unavailable; only explicitly configured models are shown.",
      };
    } finally {
      pending = null;
    }
    return cache;
  })();
  return pending;
}

export function resetModelCatalogForTests() {
  cache = null;
  pending = null;
}

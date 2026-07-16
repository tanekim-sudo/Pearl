export const MODEL_PROFILE_VERSION = 1;

const profile = (id, value) => Object.freeze({
  id,
  version: MODEL_PROFILE_VERSION,
  structuredOutput: null,
  context: "bounded",
  preferredModels: [],
  fallbacks: [],
  allowFallback: true,
  ...value,
});

export const MODEL_PROFILES = Object.freeze({
  companion_planning: profile("companion_planning", {
    capabilities: ["text", "structured", "tools"],
    tier: { latency: "fast", cost: "balanced" },
    context: "workspace-snapshot",
    maxBudget: { inputCharacters: 120_000, outputTokens: 4096, usd: 0.25 },
  }),
  voice_semantic_repair: profile("voice_semantic_repair", {
    capabilities: ["text", "structured"],
    tier: { latency: "fast", cost: "low" },
    context: "single-private-utterance",
    maxBudget: { inputCharacters: 16_000, outputTokens: 1200, usd: 0.05 },
  }),
  critique_extraction: profile("critique_extraction", {
    capabilities: ["text", "structured", "tools"],
    tier: { latency: "fast", cost: "balanced" },
    context: "bounded-selection-and-session-clauses",
    maxBudget: { inputCharacters: 80_000, outputTokens: 4096, usd: 0.25 },
  }),
  move_execution: profile("move_execution", {
    capabilities: ["text"],
    tier: { latency: "balanced", cost: "balanced" },
    maxBudget: { inputCharacters: 120_000, outputTokens: 8192, usd: 0.5 },
  }),
  function_execution: profile("function_execution", {
    capabilities: ["text"],
    tier: { latency: "balanced", cost: "balanced" },
    context: "function-step",
    maxBudget: { inputCharacters: 120_000, outputTokens: 8192, usd: 0.75 },
  }),
  lens_interpretation: profile("lens_interpretation", {
    capabilities: ["text"],
    tier: { latency: "balanced", cost: "balanced" },
    context: "isolated-lens-envelope",
    maxBudget: { inputCharacters: 120_000, outputTokens: 8192, usd: 0.5 },
  }),
  lens_encoding: profile("lens_encoding", {
    capabilities: ["text", "structured"],
    tier: { latency: "balanced", cost: "quality" },
    context: "private-untrusted-lens-evidence",
    maxBudget: { inputCharacters: 500_000, images: 16, outputTokens: 8192, usd: 1.5 },
  }),
  workspace_visual_interpretation: profile("workspace_visual_interpretation", {
    capabilities: ["text", "vision", "structured"],
    tier: { latency: "balanced", cost: "quality" },
    context: "bounded-grounded-workspace-observation",
    maxBudget: { inputCharacters: 500_000, images: 4, outputTokens: 8192, usd: 1.5 },
  }),
  before_after_inference: profile("before_after_inference", {
    capabilities: ["text", "vision", "structured"],
    tier: { latency: "balanced", cost: "quality" },
    context: "private-examples",
    maxBudget: { inputCharacters: 120_000, images: 8, outputTokens: 4096, usd: 1 },
  }),
  transcript_extraction: profile("transcript_extraction", {
    capabilities: ["text", "structured"],
    tier: { latency: "quality", cost: "balanced" },
    context: "private-transcript",
    maxBudget: { inputCharacters: 500_000, outputTokens: 4000, usd: 1.5 },
  }),
  lightweight_naming: profile("lightweight_naming", {
    capabilities: ["text"],
    tier: { latency: "fast", cost: "low" },
    maxBudget: { inputCharacters: 20_000, outputTokens: 512, usd: 0.05 },
  }),
});

const ENV_BY_PROFILE = Object.freeze({
  companion_planning: "AI_GATEWAY_MODEL_COMPANION",
  voice_semantic_repair: "AI_GATEWAY_MODEL_VOICE_REPAIR",
  critique_extraction: "AI_GATEWAY_MODEL_CRITIQUE",
  move_execution: "AI_GATEWAY_MODEL_MOVE",
  function_execution: "AI_GATEWAY_MODEL_FUNCTION",
  lens_interpretation: "AI_GATEWAY_MODEL_LENS",
  lens_encoding: "AI_GATEWAY_MODEL_LENS_ENCODING",
  workspace_visual_interpretation: "AI_GATEWAY_MODEL_WORKSPACE_VISION",
  before_after_inference: "AI_GATEWAY_MODEL_VISION",
  transcript_extraction: "AI_GATEWAY_MODEL_TRANSCRIPT",
  lightweight_naming: "AI_GATEWAY_MODEL_LIGHTWEIGHT",
});

export function getModelProfile(id = "move_execution", env = process.env) {
  const base = MODEL_PROFILES[id];
  if (!base) throw Object.assign(new Error(`Unknown model task profile "${id}".`), { status: 400, code: "UNKNOWN_MODEL_PROFILE" });
  const configured = String(env[ENV_BY_PROFILE[id]] || env.AI_GATEWAY_MODEL || "")
    .split(",").map((value) => value.trim()).filter(Boolean);
  return {
    ...base,
    preferredModels: configured.slice(0, 8),
    fallbacks: configured.slice(1, 8),
  };
}

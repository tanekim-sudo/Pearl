import { modelGateway, gatewayAuth } from "./model-gateway.js";
import { getModelProfile } from "./model-profiles.js";
import { MAX_RESPONSES } from "./huggingface.js";

export { MAX_RESPONSES };
export const MODEL = "auto";
export const VISION_MODEL = "auto";

export function hasKey() {
  const gateway = gatewayAuth();
  return gateway.configured || (
    process.env.MODEL_GATEWAY_ALLOW_DIRECT_FALLBACK === "true"
    && Boolean(process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY)
  );
}

function buildUserText({ prompt, text, compact }) {
  const body = String(text || "").trim();
  if (compact && body) return body;
  return body ? `${prompt}\n\n---\n${body}` : prompt;
}

function imagePart(value) {
  const image = typeof value === "string" ? value : value?.dataUrl;
  return /^data:image\/[a-z0-9.+-]+;base64,/i.test(image || "")
    ? { type: "image_url", image_url: { url: image } }
    : null;
}

export async function runPrompt({
  prompt,
  text,
  count = 1,
  image = null,
  images = [],
  system = null,
  maxTokens = null,
  research = false,
  timeoutMs,
  temperature = null,
  compact = false,
  signal = null,
  profile = "move_execution",
  model = "auto",
  jsonSchema = null,
  tools = null,
  toolChoice = null,
  reasoningEffort = null,
  requiredCapabilities = [],
}) {
  if (!prompt || typeof prompt !== "string") throw Object.assign(new Error("A 'prompt' string is required."), { status: 400 });
  getModelProfile(profile);
  const n = Math.min(Math.max(Number.parseInt(count, 10) || 1, 1), MAX_RESPONSES);
  const userText = buildUserText({ prompt, text, compact });
  const visuals = [imagePart(image), ...images.slice(0, 8).map(imagePart)].filter(Boolean);
  let systemText = typeof system === "string" ? system : "Return only the requested output.";
  if (compact && prompt) systemText += `\n\nMove: ${prompt}`;
  if (research) systemText += "\n\nResearch mode: use available knowledge, state limits, and do not claim live browsing.";
  const content = visuals.length ? [...visuals, { type: "text", text: userText }] : userText;
  const settled = await Promise.allSettled(Array.from({ length: n }, () => modelGateway.generate({
    profile,
    model,
    messages: [{ role: "system", content: systemText }, { role: "user", content }],
    maxTokens,
    timeoutMs,
    temperature: temperature ?? (research ? 0.25 : compact ? 0.2 : 0.5),
    signal,
    jsonSchema,
    tools,
    toolChoice,
    reasoningEffort,
    requiredCapabilities,
  })));
  const values = settled.filter((entry) => entry.status === "fulfilled").map((entry) => entry.value);
  if (!values.length) throw settled.find((entry) => entry.status === "rejected")?.reason || new Error("Model returned no output.");
  return {
    outputs: values.map((value) => value.text),
    output: values[0].text,
    text: values[0].text,
    model: values[0].model,
    usage: values[0].usage,
    provenance: values[0].provenance,
    responses: values,
    research: !!research,
  };
}

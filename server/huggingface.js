import { InferenceClient } from "@huggingface/inference";
import { PHASE_TIMEOUT } from "../shared/phase-timeouts.js";

export const MODEL =
  process.env.HF_MODEL || "Qwen/Qwen2.5-72B-Instruct:fastest";

export const VISION_MODEL =
  process.env.HF_VISION_MODEL || "Qwen/Qwen2.5-VL-7B-Instruct:fastest";

export const MAX_RESPONSES = 6;

let client = null;

function getToken() {
  return process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY || "";
}

function getClient() {
  const token = getToken();
  if (!token) return null;
  if (!client) client = new InferenceClient(token);
  return client;
}

export function hasKey() {
  return Boolean(getToken());
}

function buildUserText({ prompt, text, compact }) {
  const body = (text || "").trim();
  if (compact && body) return body;
  return body ? `${prompt}\n\n---\n${body}` : prompt;
}

function buildSystem({ prompt, system, compact, research }) {
  let sys =
    compact && prompt
      ? `${system || "Return only the requested output."}\n\nMove: ${prompt}`
      : system && typeof system === "string"
        ? system
        : "Return only the requested output.";
  if (research) {
    sys +=
      "\n\nResearch mode: reason thoroughly from your knowledge. Be specific and cite well-known public facts where relevant. If live web data is unavailable, state reasonable limits briefly and still produce the best deliverable you can.";
  }
  return sys;
}

function imageContent(image) {
  if (!image || typeof image !== "string") return null;
  if (!/^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(image)) return null;
  return { type: "image_url", image_url: { url: image } };
}

function extractMessageText(message) {
  const content = message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : part?.text || ""))
      .join("\n")
      .trim();
  }
  return "";
}

async function chatCompletion({ model, messages, max_tokens, temperature, timeoutMs, signal }) {
  const hf = getClient();
  if (!hf) {
    const err = new Error("Server is missing HF_TOKEN.");
    err.status = 500;
    throw err;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const abort = () => controller.abort();
  signal?.addEventListener?.("abort", abort, { once: true });

  try {
    const params = {
      model,
      messages,
      max_tokens,
      temperature,
    };
    const provider = process.env.HF_PROVIDER;
    if (provider) params.provider = provider;

    const result = await hf.chatCompletion(params, { signal: controller.signal });
    const text = extractMessageText(result?.choices?.[0]?.message);
    if (!text) {
      const err = new Error("Model returned no output.");
      err.status = 500;
      throw err;
    }
    return text;
  } catch (err) {
    if (err?.name === "AbortError") {
      const timeout = Object.assign(new Error("Request timed out."), { status: 504 });
      throw timeout;
    }
    throw err;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener?.("abort", abort);
  }
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
  timeoutMs = PHASE_TIMEOUT.synthesizeComposite,
  temperature = null,
  compact = false,
  signal = null,
}) {
  if (!prompt || typeof prompt !== "string") {
    const err = new Error("A 'prompt' string is required.");
    err.status = 400;
    throw err;
  }

  const n = Math.min(Math.max(parseInt(count, 10) || 1, 1), MAX_RESPONSES);
  const max_tokens = Math.min(Math.max(parseInt(maxTokens, 10) || 4096, 256), 8192);
  const sys = buildSystem({ prompt, system, compact, research });
  const userText = buildUserText({ prompt, text, compact });
  const temp = temperature ?? (research ? 0.25 : compact ? 0.2 : 0.5);
  const imageParts = [
    imageContent(image),
    ...(Array.isArray(images) ? images.slice(0, 8).map((entry) => imageContent(entry?.dataUrl || entry)) : []),
  ].filter(Boolean);
  const model = imageParts.length ? VISION_MODEL : MODEL;

  const makeOne = async () => {
    const userContent = [];
    userContent.push(...imageParts);
    userContent.push({ type: "text", text: userText });

    const messages = [{ role: "system", content: sys }];
    messages.push({
      role: "user",
      content: imageParts.length ? userContent : userText,
    });

    return chatCompletion({
      model,
      messages,
      max_tokens,
      temperature: temp,
      timeoutMs,
      signal,
    });
  };

  const settled = await Promise.allSettled(Array.from({ length: n }, makeOne));
  const outputs = settled.filter((s) => s.status === "fulfilled" && s.value).map((s) => s.value);

  if (outputs.length === 0) {
    const reason = settled.find((s) => s.status === "rejected")?.reason;
    const err = new Error(reason?.message || "Model returned no output.");
    err.status = reason?.status || 500;
    throw err;
  }

  return { outputs, model: imageParts.length ? VISION_MODEL : MODEL, research: !!research };
}

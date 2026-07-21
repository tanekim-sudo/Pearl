import { runPrompt } from "./llm.js";

const MAX_SCHEMA_BYTES = 64_000;
const MAX_TOOLS_BYTES = 128_000;
const MAX_TOOLS = 32;
const CAPABILITIES = new Set(["text", "vision", "structured", "tools", "streaming"]);
const FIELDS = new Set([
  "prompt", "text", "count", "image", "system", "maxTokens", "research",
  "timeoutMs", "compact", "profile", "modelPreference", "jsonSchema", "tools",
  "toolChoice", "requiredCapabilities", "purpose",
]);

function bad(message) {
  throw Object.assign(new Error(message), { status: 400, code: "INVALID_RUN_REQUEST" });
}

function plainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function jsonBytes(value) {
  try {
    return Buffer.byteLength(JSON.stringify(value), "utf8");
  } catch {
    bad("run request fields must be JSON serializable");
  }
}

function boundedString(value, name, max, { required = false } = {}) {
  if (value == null && !required) return undefined;
  if (typeof value !== "string") bad(`${name} must be a string`);
  if (required && !value.trim()) bad(`${name} is required`);
  if (value.length > max) bad(`${name} is too large`);
  return value;
}

function validateJsonSchema(value) {
  if (value == null) return null;
  if (!plainObject(value)) bad("jsonSchema must be an object");
  const name = boundedString(value.name || "result", "jsonSchema.name", 64, { required: true });
  if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(name)) bad("jsonSchema.name is invalid");
  if (!plainObject(value.schema)) bad("jsonSchema.schema must be an object");
  const normalized = { name, schema: value.schema };
  if (jsonBytes(normalized) > MAX_SCHEMA_BYTES) bad("jsonSchema is too large");
  return normalized;
}

function validateTools(value) {
  if (value == null) return null;
  if (!Array.isArray(value)) bad("tools must be an array");
  if (value.length > MAX_TOOLS) bad(`at most ${MAX_TOOLS} tools are allowed`);
  for (const tool of value) {
    if (!plainObject(tool) || tool.type !== "function" || !plainObject(tool.function)) bad("each tool must be a function declaration");
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(String(tool.function.name || ""))) bad("tool name is invalid");
    if (!plainObject(tool.function.parameters)) bad("tool parameters must be a JSON schema object");
  }
  if (jsonBytes(value) > MAX_TOOLS_BYTES) bad("tools are too large");
  return value;
}

function validateToolChoice(value) {
  if (value == null) return null;
  if (typeof value === "string" && ["auto", "none", "required"].includes(value)) return value;
  if (plainObject(value) && jsonBytes(value) <= 4_000) return value;
  bad("toolChoice is invalid");
}

function validateCapabilities(value) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 16) bad("requiredCapabilities must be a bounded array");
  const capabilities = [...new Set(value)];
  if (capabilities.some((entry) => typeof entry !== "string" || !CAPABILITIES.has(entry))) bad("required capability is invalid");
  return capabilities;
}

export function shapeRunRequest(body = {}) {
  if (!plainObject(body)) bad("run request body must be an object");
  const unexpected = Object.keys(body).find((key) => !FIELDS.has(key));
  if (unexpected) bad(`unexpected run request field: ${unexpected}`);
  const profile = body.profile == null || body.profile === ""
    ? undefined
    : boundedString(body.profile, "profile", 80, { required: true });
  const model = body.modelPreference == null
    ? undefined
    : boundedString(body.modelPreference, "modelPreference", 200, { required: true });
  return {
    prompt: boundedString(body.prompt, "prompt", 100_000, { required: true }),
    text: boundedString(body.text, "text", 500_000),
    count: body.count,
    image: body.image ?? null,
    system: boundedString(body.system, "system", 500_000),
    maxTokens: body.maxTokens,
    research: body.research === true,
    timeoutMs: body.timeoutMs,
    compact: body.compact === true,
    profile,
    model,
    jsonSchema: validateJsonSchema(body.jsonSchema),
    tools: validateTools(body.tools),
    toolChoice: validateToolChoice(body.toolChoice),
    requiredCapabilities: validateCapabilities(body.requiredCapabilities),
  };
}

export async function executeRunRequest(body, runner = runPrompt) {
  return runner(shapeRunRequest(body));
}

import { COMPANION_CAPABILITIES } from "./companion-capabilities.js";

export const COMPANION_PLAN_VERSION = 1;
export const DEFAULT_PLAN_BUDGET = Object.freeze({
  maxSteps: 40,
  maxDepth: 8,
  maxIterations: 100,
  maxResearchCalls: 3,
  maxRetries: 3,
});

const STEP_KINDS = new Set([
  "sequence",
  "parallel",
  "foreach",
  "conditional",
  "retry",
  "action",
  "query",
  "evaluate",
  "research",
  "checkpoint",
  "artifact",
]);

function fail(path, message) {
  throw new Error(`${path}: ${message}`);
}

function parseType(spec) {
  const optional = spec.endsWith("?");
  return { type: optional ? spec.slice(0, -1) : spec, optional };
}

function validValue(value, type) {
  if (type.includes("|")) return type.split("|").includes(String(value));
  if (type === "string") return typeof value === "string";
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  if (type === "boolean") return typeof value === "boolean";
  if (type === "array") return Array.isArray(value);
  if (type === "object") return !!value && typeof value === "object" && !Array.isArray(value);
  if (type === "{x,y}") {
    return (
      !!value &&
      typeof value === "object" &&
      Number.isFinite(value.x) &&
      Number.isFinite(value.y)
    );
  }
  return false;
}

export function validateCapabilityArgs(capability, args, path = "action.args") {
  if (!args || typeof args !== "object" || Array.isArray(args)) fail(path, "must be an object");
  const schema = capability.args || {};
  for (const key of Object.keys(args)) {
    if (!(key in schema)) fail(`${path}.${key}`, `is not accepted by ${capability.name}`);
  }
  for (const [key, rawType] of Object.entries(schema)) {
    const { type, optional } = parseType(rawType);
    if (args[key] == null) {
      if (!optional) fail(`${path}.${key}`, "is required");
      continue;
    }
    if (!validValue(args[key], type)) fail(`${path}.${key}`, `must be ${type}`);
  }
  return true;
}

function validateQuery(step, path) {
  const allowed = new Set([
    "objects",
    "selection",
    "graph",
    "clusters",
    "history",
    "library",
    "viewport",
  ]);
  if (!allowed.has(step.query)) fail(`${path}.query`, "is not a supported workspace query");
  if (step.filter != null && (typeof step.filter !== "object" || Array.isArray(step.filter))) {
    fail(`${path}.filter`, "must be an object");
  }
}

function walk(step, state, path, depth) {
  if (!step || typeof step !== "object" || Array.isArray(step)) fail(path, "must be an object");
  if (!STEP_KINDS.has(step.kind)) fail(`${path}.kind`, `unsupported step kind "${step.kind}"`);
  if (depth > state.budget.maxDepth) fail(path, "exceeds maximum nesting depth");
  state.steps += 1;
  if (state.steps > state.budget.maxSteps) fail(path, "exceeds step budget");

  if (step.kind === "sequence" || step.kind === "parallel") {
    if (!Array.isArray(step.steps) || !step.steps.length) fail(`${path}.steps`, "must be non-empty");
    step.steps.forEach((child, index) => walk(child, state, `${path}.steps[${index}]`, depth + 1));
    return;
  }
  if (step.kind === "foreach") {
    if (typeof step.in !== "string" || !step.in) fail(`${path}.in`, "must reference a query result");
    const limit = step.limit ?? state.budget.maxIterations;
    if (!Number.isInteger(limit) || limit < 1 || limit > state.budget.maxIterations) {
      fail(`${path}.limit`, `must be 1..${state.budget.maxIterations}`);
    }
    walk(step.step, state, `${path}.step`, depth + 1);
    return;
  }
  if (step.kind === "conditional") {
    if (!step.if || typeof step.if !== "object") fail(`${path}.if`, "must be a condition object");
    walk(step.then, state, `${path}.then`, depth + 1);
    if (step.else) walk(step.else, state, `${path}.else`, depth + 1);
    return;
  }
  if (step.kind === "retry") {
    if (!Number.isInteger(step.limit) || step.limit < 1 || step.limit > state.budget.maxRetries) {
      fail(`${path}.limit`, `must be 1..${state.budget.maxRetries}`);
    }
    walk(step.step, state, `${path}.step`, depth + 1);
    return;
  }
  if (step.kind === "action") {
    const capability = state.capabilities.get(step.capability);
    if (!capability) fail(`${path}.capability`, `unknown capability "${step.capability}"`);
    validateCapabilityArgs(capability, step.args || {}, `${path}.args`);
    if (capability.destructive && step.confirmed !== true) {
      fail(path, `${step.capability} requires explicit confirmation`);
    }
    return;
  }
  if (step.kind === "query") {
    validateQuery(step, path);
    if (typeof step.saveAs !== "string" || !step.saveAs) fail(`${path}.saveAs`, "is required");
    return;
  }
  if (step.kind === "research") {
    state.research += 1;
    if (state.research > state.budget.maxResearchCalls) fail(path, "exceeds research-call budget");
    if (typeof step.question !== "string" || !step.question.trim()) {
      fail(`${path}.question`, "is required");
    }
    if (typeof step.saveAs !== "string" || !step.saveAs) fail(`${path}.saveAs`, "is required");
    return;
  }
  if (step.kind === "evaluate") {
    if (typeof step.target !== "string" || !step.target) fail(`${path}.target`, "is required");
    if (!Array.isArray(step.criteria) || !step.criteria.length) {
      fail(`${path}.criteria`, "must contain at least one criterion");
    }
    if (typeof step.saveAs !== "string" || !step.saveAs) fail(`${path}.saveAs`, "is required");
    return;
  }
  if (step.kind === "checkpoint") {
    if (!["save", "confirm"].includes(step.mode)) fail(`${path}.mode`, "must be save or confirm");
    return;
  }
  if (step.kind === "artifact") {
    if (typeof step.from !== "string" || !step.from) fail(`${path}.from`, "is required");
    if (!["paper", "ai", "generator", "beside-target"].includes(step.placement)) {
      fail(`${path}.placement`, "is unsupported");
    }
  }
}

export function validateCompanionPlan(
  plan,
  { capabilities = COMPANION_CAPABILITIES, budget = {} } = {}
) {
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) fail("plan", "must be an object");
  if (plan.version !== COMPANION_PLAN_VERSION) {
    fail("plan.version", `must equal ${COMPANION_PLAN_VERSION}`);
  }
  const limits = { ...DEFAULT_PLAN_BUDGET, ...budget };
  const state = {
    steps: 0,
    research: 0,
    budget: limits,
    capabilities: new Map(capabilities.map((capability) => [capability.name, capability])),
  };
  walk(plan.root, state, "plan.root", 1);
  return { plan, stats: { steps: state.steps, researchCalls: state.research }, budget: limits };
}

function extractJson(raw) {
  let text = String(raw || "").trim().replace(/^\uFEFF/, "");
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1];
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("planner returned no JSON object");
  return text.slice(start, end + 1).replace(/,\s*([}\]])/g, "$1");
}

export function parseCompanionPlan(raw, options) {
  let parsed;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch (error) {
    throw new Error(`invalid companion plan JSON: ${error.message}`);
  }
  return validateCompanionPlan(parsed, options).plan;
}

export function planNeedsPreview(plan, autonomy = "preview-complex") {
  if (autonomy === "always-preview") return true;
  if (autonomy === "act-immediately") return false;
  const { stats } = validateCompanionPlan(plan);
  let impactful = false;
  const inspect = (step) => {
    if (["research", "parallel", "foreach", "retry"].includes(step.kind)) impactful = true;
    if (step.kind === "action") {
      const cap = COMPANION_CAPABILITIES.find((entry) => entry.name === step.capability);
      if (cap?.destructive || cap?.risk === "high") impactful = true;
    }
    for (const child of step.steps || []) inspect(child);
    if (step.step) inspect(step.step);
    if (step.then) inspect(step.then);
    if (step.else) inspect(step.else);
  };
  inspect(plan.root);
  return impactful || stats.steps > 7;
}

export function summarizePlan(plan, limit = 6) {
  const labels = [];
  const visit = (step) => {
    if (labels.length >= limit) return;
    if (step.kind === "action") labels.push(step.capability);
    else if (["query", "evaluate", "research", "checkpoint", "artifact"].includes(step.kind)) {
      labels.push(step.kind);
    }
    for (const child of step.steps || []) visit(child);
    if (step.step) visit(step.step);
    if (step.then) visit(step.then);
  };
  visit(plan.root);
  return labels;
}

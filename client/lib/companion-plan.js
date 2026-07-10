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

export function isPlanRef(value) {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof value.$ref === "string" &&
    value.$ref.trim().length > 0 &&
    Object.keys(value).every((key) => key === "$ref" || key === "path")
  );
}

function visitRefs(value, visit, path) {
  if (isPlanRef(value)) {
    visit(value, path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => visitRefs(entry, visit, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, entry]) => visitRefs(entry, visit, `${path}.${key}`));
  }
}

export function validateCapabilityArgs(capability, args, path = "action.args", bindings = null) {
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
    if (isPlanRef(args[key])) {
      if (bindings) {
        const binding = bindings.get(args[key].$ref);
        if (!binding) fail(`${path}.${key}`, `references unknown or future result "${args[key].$ref}"`);
        const expected = capability.refArgs?.[key];
        if (expected && binding.type !== expected) {
          fail(
            `${path}.${key}`,
            `expects ${expected} but "${args[key].$ref}" produces ${binding.type}`
          );
        }
      }
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
  if (step.id != null) {
    if (typeof step.id !== "string" || !step.id.trim()) fail(`${path}.id`, "must be a non-empty string");
    if (state.ids.has(step.id)) fail(`${path}.id`, `duplicate step id "${step.id}"`);
    state.ids.add(step.id);
  }

  if (step.kind === "sequence" || step.kind === "parallel") {
    if (!Array.isArray(step.steps) || !step.steps.length) fail(`${path}.steps`, "must be non-empty");
    if (step.kind === "parallel" && step.steps.some((child) => child.kind === "action" || child.kind === "checkpoint")) {
      fail(path, "parallel branches may only contain read/evaluate/research work");
    }
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
    visitRefs(
      step.args || {},
      (ref, refPath) => {
        if (!state.bindings.has(ref.$ref)) {
          fail(refPath, `references unknown or future result "${ref.$ref}"`);
        }
      },
      `${path}.args`
    );
    validateCapabilityArgs(capability, step.args || {}, `${path}.args`, state.bindings);
    if (capability.destructive && step.confirmed !== true) {
      fail(path, `${step.capability} requires explicit confirmation`);
    }
    if (step.saveAs != null) {
      if (typeof step.saveAs !== "string" || !step.saveAs.trim()) fail(`${path}.saveAs`, "must be non-empty");
      if (state.bindings.has(step.saveAs)) fail(`${path}.saveAs`, `duplicate binding "${step.saveAs}"`);
      state.bindings.set(step.saveAs, { type: capability.resultType || "action-result", path });
    }
    return;
  }
  if (step.kind === "query") {
    validateQuery(step, path);
    if (typeof step.saveAs !== "string" || !step.saveAs) fail(`${path}.saveAs`, "is required");
    if (state.bindings.has(step.saveAs)) fail(`${path}.saveAs`, `duplicate binding "${step.saveAs}"`);
    state.bindings.set(step.saveAs, { type: "query-result", path });
    return;
  }
  if (step.kind === "research") {
    state.research += 1;
    if (state.research > state.budget.maxResearchCalls) fail(path, "exceeds research-call budget");
    if (typeof step.question !== "string" || !step.question.trim()) {
      fail(`${path}.question`, "is required");
    }
    if (typeof step.saveAs !== "string" || !step.saveAs) fail(`${path}.saveAs`, "is required");
    if (state.bindings.has(step.saveAs)) fail(`${path}.saveAs`, `duplicate binding "${step.saveAs}"`);
    state.bindings.set(step.saveAs, { type: "research-result", path });
    return;
  }
  if (step.kind === "evaluate") {
    if (typeof step.target !== "string" || !step.target) fail(`${path}.target`, "is required");
    if (!Array.isArray(step.criteria) || !step.criteria.length) {
      fail(`${path}.criteria`, "must contain at least one criterion");
    }
    if (typeof step.saveAs !== "string" || !step.saveAs) fail(`${path}.saveAs`, "is required");
    if (state.bindings.has(step.saveAs)) fail(`${path}.saveAs`, `duplicate binding "${step.saveAs}"`);
    state.bindings.set(step.saveAs, { type: "evaluation-result", path });
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
    ids: new Set(),
    bindings: new Map(),
    budget: limits,
    capabilities: new Map(capabilities.map((capability) => [capability.name, capability])),
  };
  walk(plan.root, state, "plan.root", 1);
  return { plan, stats: { steps: state.steps, researchCalls: state.research }, budget: limits };
}

function normalizedName(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "")
    .toLowerCase();
}

function repairPlanDataflow(plan, capabilities = COMPANION_CAPABILITIES) {
  const copy = structuredClone(plan);
  const capabilityMap = new Map(capabilities.map((entry) => [entry.name, entry]));
  const resources = [];
  let index = 0;
  const visit = (step) => {
    if (!step || typeof step !== "object") return;
    if (!step.id && !["sequence", "parallel"].includes(step.kind)) {
      step.id = `step-${++index}`;
    }
    if (step.kind === "action") {
      const capability = capabilityMap.get(step.capability);
      if (!step.saveAs && typeof step.args?.saveAs === "string" && step.args.saveAs.trim()) {
        step.saveAs = step.args.saveAs.trim();
      }
      const repairValue = (value, key) => {
        if (typeof value === "string" && capability?.refArgs?.[key]) {
          const needle = normalizedName(value);
          const matches = resources.filter(
            (resource) =>
              resource.type === capability.refArgs[key] &&
              (normalizedName(resource.binding) === needle || normalizedName(resource.name) === needle)
          );
          if (matches.length === 1) return { $ref: matches[0].binding };
        }
        if (Array.isArray(value)) return value.map((entry) => repairValue(entry, key));
        if (value && typeof value === "object" && !isPlanRef(value)) {
          return Object.fromEntries(
            Object.entries(value).map(([nestedKey, entry]) => [nestedKey, repairValue(entry, nestedKey)])
          );
        }
        return value;
      };
      step.args = Object.fromEntries(
        Object.entries(step.args || {}).map(([key, value]) => [key, repairValue(value, key)])
      );
      if (step.saveAs) {
        resources.push({
          binding: step.saveAs,
          name: step.args?.name || step.args?.saveAs || "",
          type: capability?.resultType || "action-result",
        });
      }
    }
    for (const child of step.steps || []) visit(child);
    if (step.step) visit(step.step);
    if (step.then) visit(step.then);
    if (step.else) visit(step.else);
  };
  visit(copy.root);
  return copy;
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
  const repaired = repairPlanDataflow(parsed, options?.capabilities);
  return validateCompanionPlan(repaired, options).plan;
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

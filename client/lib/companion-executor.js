import { DEFAULT_PLAN_BUDGET, validateCompanionPlan } from "./companion-plan.js";

function abortError() {
  return new DOMException("Companion plan cancelled", "AbortError");
}

function assertActive(signal) {
  if (signal?.aborted) throw abortError();
}

function resolveRef(value, scope) {
  if (typeof value !== "string") return value;
  if (value === "$item") return scope.item;
  if (value.startsWith("$")) {
    const [name, ...path] = value.slice(1).split(".");
    let current = name === "item" ? scope.item : scope.values[name];
    for (const segment of path) current = current?.[segment];
    return current;
  }
  return value;
}

function resolveArgs(args, scope) {
  return Object.fromEntries(
    Object.entries(args || {}).map(([key, value]) => {
      if (Array.isArray(value)) return [key, value.map((entry) => resolveRef(entry, scope))];
      if (value && typeof value === "object") return [key, resolveArgs(value, scope)];
      return [key, resolveRef(value, scope)];
    })
  );
}

function conditionMatches(condition, scope) {
  const actual = resolveRef(condition.ref, scope);
  if ("equals" in condition) return actual === condition.equals;
  if ("exists" in condition) return condition.exists ? actual != null : actual == null;
  if ("minCount" in condition) return Array.isArray(actual) && actual.length >= condition.minCount;
  if ("empty" in condition) return condition.empty ? !actual?.length : !!actual?.length;
  return false;
}

export async function executeCompanionPlan(
  plan,
  tools,
  { signal, onProgress, budget = {}, initialValues = {} } = {}
) {
  const validated = validateCompanionPlan(plan, { budget });
  const limits = { ...DEFAULT_PLAN_BUDGET, ...validated.budget };
  const scope = { values: { ...initialValues }, item: null };
  const journal = [];
  let iterations = 0;
  let researchCalls = 0;
  let actionCount = 0;

  const record = (entry) => {
    journal.push({ at: new Date().toISOString(), ...entry });
    onProgress?.({ ...entry, completed: journal.length, total: validated.stats.steps });
  };

  const run = async (step, localScope = scope) => {
    assertActive(signal);
    if (step.kind === "sequence") {
      for (const child of step.steps) await run(child, localScope);
      return;
    }
    if (step.kind === "parallel") {
      const unsafe = step.steps.some((child) => child.kind === "action" || child.kind === "checkpoint");
      if (unsafe) throw new Error("parallel branches may only contain read/evaluate/research work");
      await Promise.all(step.steps.map((child) => run(child, localScope)));
      return;
    }
    if (step.kind === "foreach") {
      const values = localScope.values[step.in];
      if (!Array.isArray(values)) throw new Error(`foreach source "${step.in}" is not an array`);
      for (const item of values.slice(0, step.limit || limits.maxIterations)) {
        iterations += 1;
        if (iterations > limits.maxIterations) throw new Error("plan iteration budget exceeded");
        await run(step.step, { ...localScope, item });
      }
      return;
    }
    if (step.kind === "conditional") {
      await run(conditionMatches(step.if, localScope) ? step.then : step.else || { kind: "sequence", steps: [] }, localScope);
      return;
    }
    if (step.kind === "retry") {
      let lastError;
      for (let attempt = 1; attempt <= step.limit; attempt += 1) {
        try {
          await run(step.step, localScope);
          return;
        } catch (error) {
          if (error?.name === "AbortError") throw error;
          lastError = error;
          record({ kind: "retry", status: "retrying", attempt, error: error.message });
        }
      }
      throw lastError;
    }
    if (step.kind === "query") {
      const result = await tools.query(step.query, resolveArgs(step.filter || {}, localScope), { signal });
      localScope.values[step.saveAs] = result;
      record({ kind: "query", status: "completed", id: step.id, count: Array.isArray(result) ? result.length : 1 });
      return;
    }
    if (step.kind === "evaluate") {
      const result = await tools.evaluate(
        resolveRef(step.target, localScope),
        step.criteria,
        { rubric: step.rubric, signal, context: localScope.values }
      );
      localScope.values[step.saveAs] = result;
      record({ kind: "evaluate", status: "completed", id: step.id });
      return;
    }
    if (step.kind === "research") {
      researchCalls += 1;
      if (researchCalls > limits.maxResearchCalls) throw new Error("research-call budget exceeded");
      const result = await tools.research({
        question: step.question,
        scope: step.scope || "web",
        recency: step.recency || null,
        maxSources: Math.min(10, Math.max(1, step.maxSources || 5)),
        signal,
      });
      if (!result?.sources?.length) throw new Error("research returned no verifiable sources");
      localScope.values[step.saveAs] = result;
      record({ kind: "research", status: "completed", id: step.id, count: result.sources.length });
      return;
    }
    if (step.kind === "checkpoint") {
      const result = await tools.checkpoint?.(step, { signal, journal, values: localScope.values });
      if (step.mode === "confirm" && result !== true) throw new Error("checkpoint confirmation declined");
      record({ kind: "checkpoint", status: "completed", id: step.id });
      return;
    }
    if (step.kind === "artifact") {
      const value = localScope.values[step.from];
      if (value == null) throw new Error(`artifact source "${step.from}" is missing`);
      await tools.artifact(value, step, { signal, values: localScope.values });
      record({ kind: "artifact", status: "completed", id: step.id });
      return;
    }
    if (step.kind === "action") {
      actionCount += 1;
      const result = await tools.action(step.capability, resolveArgs(step.args || {}, localScope), {
        signal,
        idempotencyKey: step.id || `${step.capability}:${actionCount}`,
      });
      if (step.saveAs) localScope.values[step.saveAs] = result;
      record({ kind: "action", capability: step.capability, status: "completed", id: step.id });
    }
  };

  try {
    await run(plan.root);
    return { completed: true, values: scope.values, journal, checkpoint: journal.length };
  } catch (error) {
    const failure = {
      kind: "failure",
      status: error?.name === "AbortError" ? "cancelled" : "failed",
      error: error.message,
      checkpoint: journal.length,
    };
    record(failure);
    return {
      completed: false,
      cancelled: error?.name === "AbortError",
      error: error.message,
      values: scope.values,
      journal,
      checkpoint: journal.length,
      canRetry: error?.name !== "AbortError",
      canUndo: journal.some((entry) => entry.kind === "action"),
    };
  }
}

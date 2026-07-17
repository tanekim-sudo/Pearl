import { DEFAULT_PLAN_BUDGET, validateCompanionPlan } from "./companion-plan.js";
import { COMPANION_CAPABILITIES } from "./companion-capabilities.js";
import { modePermission } from "./companion-harness.js";

function abortError() {
  return new DOMException("Companion plan cancelled", "AbortError");
}

function assertActive(signal) {
  if (signal?.aborted) throw abortError();
}

function resolveRef(value, scope) {
  if (value && typeof value === "object" && !Array.isArray(value) && typeof value.$ref === "string") {
    let current = scope.values[value.$ref];
    if (value.path) {
      for (const segment of String(value.path).split(".")) current = current?.[segment];
      return current;
    }
    // Resource arguments are stable identifiers at the director boundary.
    return (
      current?.lensId ??
      current?.generatorId ??
      current?.itemId ??
      current?.nodeId ??
      current?.id ??
      current
    );
  }
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
      if (value && typeof value === "object" && typeof value.$ref === "string") {
        return [key, resolveRef(value, scope)];
      }
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
  {
    signal,
    onProgress,
    budget = {},
    initialValues = {},
    resume = null,
    runId = resume?.runId || globalThis.crypto?.randomUUID?.() || `plan-${Date.now()}`,
    mode = "agent",
    approved = false,
    onPersist,
  } = {}
) {
  const validated = validateCompanionPlan(plan, { budget });
  const limits = { ...DEFAULT_PLAN_BUDGET, ...validated.budget };
  const scope = { values: { ...initialValues, ...(resume?.values || {}) }, item: null };
  const journal = [...(resume?.journal || [])];
  const completedStepIds = new Set(resume?.completedStepIds || []);
  const capabilityMap = new Map(COMPANION_CAPABILITIES.map((entry) => [entry.name, entry]));
  let iterations = 0;
  let researchCalls = 0;
  let actionCount = 0;

  const record = (entry) => {
    journal.push({ at: new Date().toISOString(), ...entry });
    onProgress?.({ ...entry, completed: journal.length, total: validated.stats.steps });
    onPersist?.({
      runId,
      values: cloneSerializable(scope.values),
      journal: cloneSerializable(journal),
      completedStepIds: [...completedStepIds],
      current: entry,
    });
  };

  const run = async (step, localScope = scope) => {
    assertActive(signal);
    if (["sequence", "phase", "todo", "migration"].includes(step.kind)) {
      for (const child of step.steps) await run(child, localScope);
      return;
    }
    if (step.kind === "transaction") {
      const checkpoint = await tools.checkpoint?.(
        { id: step.id, mode: "save", scope: step.scope || "workspace" },
        { signal, journal, values: localScope.values }
      );
      record({ kind: "transaction", status: "started", id: step.id, checkpointId: checkpoint?.id || checkpoint || null });
      try {
        for (const child of step.steps) await run(child, localScope);
        const verification = await tools.verify?.(step.postconditions || [], {
          signal,
          checkpoint,
          values: localScope.values,
        });
        if (verification && verification.status !== "verified") throw new Error(`transaction effect verification ${verification.status}`);
        record({ kind: "transaction", status: "verified", id: step.id, verification: verification || null });
      } catch (error) {
        await tools.compensate?.(step.compensation, { signal, checkpoint, error, values: localScope.values });
        record({ kind: "transaction", status: "compensated", id: step.id, error: error.message });
        throw error;
      }
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
    if (step.kind === "approval") {
      if (step.id && completedStepIds.has(step.id)) return;
      const result = await tools.approve?.(step, { signal, values: localScope.values });
      if (result?.decision !== "accept" && result !== true) throw new Error("scoped approval declined");
      if (step.id) completedStepIds.add(step.id);
      record({ kind: "approval", status: "accepted", id: step.id, scope: step.scope, affectedIds: step.affectedIds });
      return;
    }
    if (step.kind === "assert") {
      if (step.id && completedStepIds.has(step.id)) return;
      const result = tools.assert
        ? await tools.assert(step.condition, { signal, values: localScope.values })
        : conditionMatches(step.condition, localScope);
      if (!result || result.ok === false) throw new Error(step.message || "plan assertion failed");
      if (step.id) completedStepIds.add(step.id);
      record({ kind: "assert", status: "verified", id: step.id, evidence: result?.evidence || null });
      return;
    }
    if (step.kind === "worker") {
      if (step.id && completedStepIds.has(step.id)) return;
      const result = await tools.worker(step, { signal, values: localScope.values });
      if (step.saveAs) localScope.values[step.saveAs] = result;
      if (step.id) completedStepIds.add(step.id);
      record({ kind: "worker", status: "completed", id: step.id, worker: step.worker, artifact: result?.id || null });
      return;
    }
    if (step.kind === "query") {
      if (step.id && completedStepIds.has(step.id)) return;
      const result = await tools.query(step.query, resolveArgs(step.filter || {}, localScope), { signal });
      localScope.values[step.saveAs] = result;
      if (step.id) completedStepIds.add(step.id);
      record({ kind: "query", status: "completed", id: step.id, count: Array.isArray(result) ? result.length : 1 });
      return;
    }
    if (step.kind === "evaluate") {
      if (step.id && completedStepIds.has(step.id)) return;
      const result = await tools.evaluate(
        resolveRef(step.target, localScope),
        step.criteria,
        { rubric: step.rubric, signal, context: localScope.values }
      );
      localScope.values[step.saveAs] = result;
      if (step.id) completedStepIds.add(step.id);
      record({ kind: "evaluate", status: "completed", id: step.id });
      return;
    }
    if (step.kind === "research") {
      if (step.id && completedStepIds.has(step.id)) return;
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
      if (step.id) completedStepIds.add(step.id);
      record({ kind: "research", status: "completed", id: step.id, count: result.sources.length });
      return;
    }
    if (step.kind === "checkpoint") {
      if (step.id && completedStepIds.has(step.id)) return;
      const result = await tools.checkpoint?.(step, { signal, journal, values: localScope.values });
      if (step.mode === "confirm" && result !== true) throw new Error("checkpoint confirmation declined");
      if (step.id) completedStepIds.add(step.id);
      record({ kind: "checkpoint", status: "completed", id: step.id });
      return;
    }
    if (step.kind === "artifact") {
      if (step.id && completedStepIds.has(step.id)) return;
      const value = localScope.values[step.from];
      if (value == null) throw new Error(`artifact source "${step.from}" is missing`);
      await tools.artifact(value, step, { signal, values: localScope.values });
      if (step.id) completedStepIds.add(step.id);
      record({ kind: "artifact", status: "completed", id: step.id });
      return;
    }
    if (step.kind === "action") {
      if (step.id && completedStepIds.has(step.id)) return;
      const contract = capabilityMap.get(step.capability);
      const permission = modePermission(mode, {
        kind: "action",
        mutating: true,
        destructive: contract?.destructive,
        externalWrite: contract?.approval?.scope === "external-write",
        publish: contract?.approval?.scope === "publish",
        approved: approved || step.confirmed === true || contract?.confirmation === "handler",
      });
      if (!permission.allowed) throw new Error(permission.reason);
      actionCount += 1;
      const result = await tools.action(step.capability, resolveArgs(step.args || {}, localScope), {
        signal,
        idempotencyKey: `${runId}:${step.id || `${step.capability}:${actionCount}`}`,
      });
      if (step.saveAs) localScope.values[step.saveAs] = result;
      if (step.id) completedStepIds.add(step.id);
      record({ kind: "action", capability: step.capability, status: "completed", id: step.id });
    }
  };

  try {
    await run(plan.root);
    return {
      completed: true,
      values: scope.values,
      journal,
      checkpoint: journal.length,
      runId,
      completedStepIds: [...completedStepIds],
    };
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
      runId,
      completedStepIds: [...completedStepIds],
      resume: {
        runId,
        values: scope.values,
        journal,
        completedStepIds: [...completedStepIds],
      },
    };
  }
}

function cloneSerializable(value) {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

export const FUNCTION_TEST_BENCH_VERSION = 1;

function collectDependencyClosure(root, operators) {
  const map = operators instanceof Map ? operators : new Map((operators || []).map((entry) => [entry.id, entry]));
  const seen = new Set();
  const missing = new Set();
  const visit = (entry) => {
    if (!entry?.id || seen.has(entry.id)) return;
    seen.add(entry.id);
    for (const dependency of [...(entry.steps || []), ...(entry.dependencies || [])]) {
      const id = typeof dependency === "string" ? dependency : dependency.id;
      const child = map.get(id);
      if (!child) missing.add(id);
      else visit(child);
    }
  };
  visit(root);
  return { ids: [...seen], missing: [...missing] };
}

export function validateFunctionStructure(root, operators = []) {
  const closure = collectDependencyClosure(root, operators);
  const errors = [];
  if (!root?.id) errors.push("Function has no stable ID.");
  if (!root?.name?.trim()) errors.push("Function has no name.");
  if (root?.kind !== "pipeline" && !Array.isArray(root?.steps)) errors.push("Function is not a pipeline or step graph.");
  if (!root?.steps?.length) errors.push("Function has no executable steps.");
  if (closure.missing.length) errors.push(`Missing dependencies: ${closure.missing.join(", ")}`);
  return { valid: errors.length === 0, errors, closure };
}

function normalizedCases(fixtures, holdouts) {
  return [
    ...(fixtures || []).map((entry, index) => ({ ...entry, id: entry.id || `fixture-${index + 1}`, split: "fixture" })),
    ...(holdouts || []).map((entry, index) => ({ ...entry, id: entry.id || `holdout-${index + 1}`, split: "holdout" })),
  ];
}

export async function runFunctionTestBench({
  function: root,
  operators = [],
  fixtures = [],
  holdouts = [],
  models = ["auto"],
  rubric = [],
  runner,
  evaluator,
  compatibility,
  browserFlows = [],
  extensionFlows = [],
  signal,
  maxRuns = 50,
} = {}) {
  const structural = validateFunctionStructure(root, operators);
  if (!structural.valid) {
    return {
      version: FUNCTION_TEST_BENCH_VERSION,
      status: "failed",
      structural,
      runs: [],
      compatibility: [],
      flows: [],
      summary: { passed: 0, failed: structural.errors.length },
    };
  }
  if (typeof runner !== "function") throw new Error("Function test bench requires an execution runner.");
  const cases = normalizedCases(fixtures, holdouts);
  const matrix = cases.flatMap((testCase) => models.map((model) => ({ testCase, model }))).slice(0, maxRuns);
  const runs = [];
  for (const entry of matrix) {
    if (signal?.aborted) throw new DOMException("Function test bench cancelled", "AbortError");
    try {
      const output = await runner(root, entry.testCase.input, {
        model: entry.model,
        fixtureId: entry.testCase.id,
        split: entry.testCase.split,
        signal,
      });
      const evaluation = evaluator
        ? await evaluator({
            input: entry.testCase.input,
            expected: entry.testCase.expected,
            output,
            rubric,
            model: entry.model,
            split: entry.testCase.split,
            signal,
          })
        : {
            passed: entry.testCase.expected == null || String(output).includes(String(entry.testCase.expected)),
            evidence: entry.testCase.expected == null ? ["execution completed"] : ["expected output comparison"],
          };
      runs.push({
        fixtureId: entry.testCase.id,
        split: entry.testCase.split,
        model: entry.model,
        status: evaluation.passed ? "passed" : "failed",
        output,
        evaluation,
      });
    } catch (error) {
      runs.push({
        fixtureId: entry.testCase.id,
        split: entry.testCase.split,
        model: entry.model,
        status: "failed",
        error: error.message,
      });
    }
  }
  const compatibilityResults = compatibility
    ? await compatibility({ root, operators, closure: structural.closure, signal })
    : structural.closure.ids.map((stableId) => ({ stableId, status: "compatible" }));
  const flows = [];
  for (const flow of [...browserFlows, ...extensionFlows]) {
    try {
      const result = await flow.run({ root, signal });
      flows.push({ id: flow.id, surface: flow.surface, status: result?.passed === false ? "failed" : "passed", evidence: result?.evidence || [] });
    } catch (error) {
      flows.push({ id: flow.id, surface: flow.surface, status: "failed", error: error.message });
    }
  }
  const passed = runs.filter((entry) => entry.status === "passed").length + flows.filter((entry) => entry.status === "passed").length;
  const failed = runs.filter((entry) => entry.status === "failed").length + flows.filter((entry) => entry.status === "failed").length;
  return {
    version: FUNCTION_TEST_BENCH_VERSION,
    status: failed ? passed ? "partially_verified" : "failed" : "verified",
    structural,
    runs,
    compatibility: compatibilityResults,
    flows,
    summary: { passed, failed, fixtures: fixtures.length, holdouts: holdouts.length, models: models.length },
  };
}

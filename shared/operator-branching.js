/**
 * Branched operators — a pipeline step may be a FORK (kind: "pipeline",
 * fork: true) whose children are sibling BRANCHES. Execution runs the shared
 * prefix once, then each branch continues from the fork's intermediate
 * result; every leaf branch produces its own output. Linear operators
 * (no fork anywhere) are completely unaffected.
 */

/** True if this op is a fork point (branches live in .steps). */
export function isForkStep(op) {
  return !!op && op.kind === "pipeline" && !!op.fork && (op.steps?.length || 0) > 0;
}

/** True if the subtree rooted at op contains any fork point. */
export function operatorHasFork(op, opMap) {
  const seen = new Set();
  function walk(o) {
    if (!o || seen.has(o.id)) return false;
    seen.add(o.id);
    if (isForkStep(o)) return true;
    if (o.kind === "pipeline" && o.steps?.length) {
      return o.steps.some((sid) => walk(opMap[sid]));
    }
    return false;
  }
  return walk(op);
}

/**
 * Compile a (possibly forked) operator into a run plan:
 *   { segments: [opId...], branches: [plan...] | null }
 * Segments run sequentially, each as one unit; when branches exist, each
 * branch plan continues from the last segment's output. Steps that follow a
 * fork in the same parent continue every branch. Pipelines that contain a
 * fork deeper down are inlined so the split is visible to the runner.
 */
export function buildBranchPlan(op, opMap) {
  if (!op) return { segments: [], branches: null };
  if (op.kind !== "pipeline") return { segments: [op.id], branches: null };
  return planFromSteps(op.steps || [], opMap);
}

function planFromSteps(stepIds, opMap) {
  const segments = [];
  for (let i = 0; i < stepIds.length; i++) {
    const step = opMap[stepIds[i]];
    if (!step) continue;
    if (isForkStep(step)) {
      const rest = stepIds.slice(i + 1);
      return {
        segments,
        branches: step.steps.map((bid) => planFromSteps([bid, ...rest], opMap)),
      };
    }
    if (step.kind === "pipeline" && operatorHasFork(step, opMap)) {
      const inner = planFromSteps([...(step.steps || []), ...stepIds.slice(i + 1)], opMap);
      return { segments: [...segments, ...inner.segments], branches: inner.branches };
    }
    segments.push(step.id);
  }
  return { segments, branches: null };
}

/** How many distinct outputs a run of this operator produces. */
export function branchOutputCount(op, opMap) {
  function count(plan) {
    if (!plan.branches) return 1;
    return plan.branches.reduce((n, b) => n + count(b), 0);
  }
  return count(buildBranchPlan(op, opMap));
}

/** Human name for each leaf output, in run order (last step of each branch). */
export function branchOutputNames(op, opMap) {
  const names = [];
  function walk(plan, fallback) {
    const lastId = plan.segments[plan.segments.length - 1];
    const lastName = (lastId && opMap[lastId]?.name) || fallback;
    if (!plan.branches) {
      names.push(lastName || "output");
      return;
    }
    plan.branches.forEach((b) => walk(b, lastName));
  }
  walk(buildBranchPlan(op, opMap), op?.name);
  return names;
}

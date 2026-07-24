export const ORB_INSTANCE_VERSION = 1;
export const MAX_ORB_WORKERS = 8;

const clone = (value) => structuredClone(value);

export function createOrbInstance(value = {}) {
  if (!value.id) throw new Error("OrbInstance id is required");
  return {
    version: ORB_INSTANCE_VERSION,
    id: String(value.id),
    lifespan: "run",
    role: value.role || "specialist",
    parentId: value.parentId || null,
    goal: value.goal || "",
    context: clone(value.context || []),
    model: value.model || "auto",
    tools: [...new Set(value.tools || [])],
    budget: {
      iterations: Math.max(1, Math.min(20, Number(value.budget?.iterations) || 4)),
      tokens: Math.max(0, Number(value.budget?.tokens) || 0),
      milliseconds: Math.max(1000, Number(value.budget?.milliseconds) || 120000),
    },
    status: value.status || "queued",
    checkpoint: clone(value.checkpoint || null),
    expectedResult: clone(value.expectedResult || null),
    effects: clone(value.effects || []),
    proposal: clone(value.proposal || null),
    error: value.error || null,
  };
}

export function splitOrbWorkers(parent, specs = [], options = {}) {
  const limit = Math.max(1, Math.min(MAX_ORB_WORKERS, Number(options.limit) || MAX_ORB_WORKERS));
  if (specs.length > limit) throw new Error(`worker limit exceeded (${limit})`);
  const mutatingScopes = new Set();
  return specs.map((spec, index) => {
    const mutationScope = spec.mutationScope || null;
    if (mutationScope && mutatingScopes.has(mutationScope)) {
      throw new Error(`concurrent mutation scope "${mutationScope}" is not allowed`);
    }
    if (mutationScope) mutatingScopes.add(mutationScope);
    return createOrbInstance({
      ...spec,
      id: spec.id || `${parent.id}:worker:${index + 1}`,
      parentId: parent.id,
      checkpoint: spec.checkpoint || parent.checkpoint || null,
      context: spec.context || parent.context || [],
      status: "queued",
    });
  });
}

export function workerProposal(worker, proposal) {
  if (!["running", "queued", "paused", "recovery"].includes(worker.status)) {
    throw new Error("worker cannot propose from its current status");
  }
  if (!proposal?.type || !["observation", "evaluation", "semantic-patch", "artifact"].includes(proposal.type)) {
    throw new Error("worker proposal type is invalid");
  }
  return {
    ...worker,
    status: "completed",
    proposal: {
      ...clone(proposal),
      workerId: worker.id,
      checkpoint: clone(worker.checkpoint),
      verified: false,
    },
  };
}

export function fuseWorkerProposals(workers = [], verify = () => true) {
  const proposals = workers.map((worker) => worker.proposal).filter(Boolean);
  const conflicts = [];
  const accepted = [];
  const writeTargets = new Map();
  for (const proposal of proposals) {
    const targets = proposal.type === "semantic-patch" ? proposal.targets || [] : [];
    const collision = targets.find((target) => writeTargets.has(target));
    if (collision) {
      conflicts.push({ target: collision, workers: [writeTargets.get(collision), proposal.workerId], proposals: [proposal] });
      continue;
    }
    if (!verify(proposal)) {
      conflicts.push({ target: null, workers: [proposal.workerId], reason: "parent-verification-failed", proposals: [proposal] });
      continue;
    }
    targets.forEach((target) => writeTargets.set(target, proposal.workerId));
    accepted.push({ ...proposal, verified: true });
  }
  return {
    version: ORB_INSTANCE_VERSION,
    accepted,
    conflicts,
    provenance: proposals.map((proposal) => ({ workerId: proposal.workerId, checkpoint: proposal.checkpoint, type: proposal.type })),
    applicable: conflicts.length === 0,
  };
}

export function swarmSummary(workers = [], zoom = 1) {
  const counts = workers.reduce((result, worker) => {
    result[worker.status] = (result[worker.status] || 0) + 1;
    return result;
  }, {});
  return {
    collapsed: zoom < 0.55 || workers.length > 4,
    total: workers.length,
    counts,
    accessibleLabel: `${workers.length} worker pearls: ${Object.entries(counts).map(([status, count]) => `${count} ${status}`).join(", ")}`,
  };
}

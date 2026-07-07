/** Git-for-cognition utilities — lenses as repos, steps as code, evolves as commits. */

/** @param {object} lens */
export function gitRefKind(lens) {
  if (lens?.mergedFrom?.length === 2) return "merge";
  if (lens?.parentId) return "branch";
  if (lens?.forkedFrom) return "fork";
  if (lens?.defaultBranch) return "main";
  return "lens";
}

/** @param {object} lens */
export function gitRefLabel(lens) {
  const k = gitRefKind(lens);
  if (k === "main") return "main";
  if (k === "branch") return "branch";
  if (k === "fork") return "fork";
  if (k === "merge") return "merge";
  return "lens";
}

/** @param {object} lens @param {Record<string, object>} lensesById */
export function lineageBreadcrumb(lens, lensesById) {
  if (!lens) return [];
  const crumbs = [];
  for (const id of lens.lineage || []) {
    crumbs.push(lensesById[id]?.name || "…");
  }
  if (lens.parentId && !lens.lineage?.includes(lens.parentId)) {
    crumbs.push(lensesById[lens.parentId]?.name || lens.parentName || "…");
  }
  if (lens.forkedFrom && !crumbs.length) {
    crumbs.push(lensesById[lens.forkedFrom]?.name || lens.forkedFromName || "…");
  }
  crumbs.push(lens.name || "unnamed");
  return crumbs;
}

/** @param {string} rootId @param {Record<string, object>} opMap */
export function collectPipelineStepNames(rootId, opMap) {
  const names = [];
  function walk(id) {
    const op = opMap[id];
    if (!op) return;
    if (op.kind === "pipeline" && op.steps?.length) {
      for (const sid of op.steps) walk(sid);
    } else {
      names.push((op.name || "step").trim());
    }
  }
  if (rootId) walk(rootId);
  return names;
}

/** LCS alignment for step-name sequences. */
export function diffStepSequences(aNames, bNames) {
  const a = aNames || [];
  const b = bNames || [];
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const shared = [];
  const onlyA = [];
  const onlyB = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      shared.unshift({ name: a[i - 1], aIdx: i - 1, bIdx: j - 1 });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      onlyB.unshift({ name: b[j - 1], bIdx: j - 1 });
      j--;
    } else {
      onlyA.unshift({ name: a[i - 1], aIdx: i - 1 });
      i--;
    }
  }
  return { shared, onlyA, onlyB };
}

/**
 * @param {object} opts
 * @param {string} opts.message
 * @param {string[]} opts.stepNames
 * @param {string} [opts.parentId]
 * @param {'commit'|'branch'|'fork'|'merge'|'init'} [opts.kind]
 * @param {() => string} newId
 */
export function makeCommit({ message, stepNames, parentId, kind = "commit" }, newId) {
  return {
    id: newId(),
    message: (message || "").trim() || defaultCommitMessage(kind, stepNames),
    stepNames: [...(stepNames || [])],
    parentId: parentId || null,
    kind,
    at: Date.now(),
  };
}

function defaultCommitMessage(kind, stepNames) {
  const n = stepNames?.length || 0;
  if (kind === "init") return `initial commit · ${n} step${n === 1 ? "" : "s"}`;
  if (kind === "branch") return `branch · ${n} step${n === 1 ? "" : "s"}`;
  if (kind === "fork") return `fork · ${n} step${n === 1 ? "" : "s"}`;
  if (kind === "merge") return `merge · ${n} step${n === 1 ? "" : "s"}`;
  return `evolve · ${n} step${n === 1 ? "" : "s"}`;
}

/** @param {object} lens @param {object} commit */
export function appendCommit(lens, commit) {
  const commits = [...(lens.commits || []), commit];
  return {
    ...lens,
    commits,
    headCommitId: commit.id,
    version: commits.length,
    updatedAt: commit.at,
  };
}

/** Group lenses into repo trees for the rail. */
export function groupLensesByRepo(lenses) {
  const byId = Object.fromEntries(lenses.map((l) => [l.id, l]));
  const childrenOf = new Map();
  for (const lens of lenses) {
    const parent =
      lens.parentId ||
      (lens.lineage?.length ? lens.lineage[lens.lineage.length - 1] : null) ||
      null;
    if (parent && byId[parent] && parent !== lens.id) {
      if (!childrenOf.has(parent)) childrenOf.set(parent, []);
      childrenOf.get(parent).push(lens);
    }
  }
  const isChild = new Set();
  for (const kids of childrenOf.values()) {
    for (const k of kids) isChild.add(k.id);
  }
  const forksOf = new Map();
  for (const lens of lenses) {
    if (lens.forkedFrom && byId[lens.forkedFrom]) {
      if (!forksOf.has(lens.forkedFrom)) forksOf.set(lens.forkedFrom, []);
      forksOf.get(lens.forkedFrom).push(lens);
      isChild.add(lens.id);
    }
  }

  const repos = [];
  for (const lens of lenses) {
    if (isChild.has(lens.id)) continue;
    repos.push({
      root: lens,
      branches: childrenOf.get(lens.id) || [],
      forks: forksOf.get(lens.id) || [],
    });
  }
  for (const lens of lenses) {
    if (!isChild.has(lens.id) && !repos.some((r) => r.root.id === lens.id)) {
      repos.push({ root: lens, branches: [], forks: [] });
    }
  }
  return repos.sort((a, b) => (b.root.updatedAt || 0) - (a.root.updatedAt || 0));
}

/** @param {object} lens */
export function commitCount(lens) {
  return lens?.commits?.length || lens?.version || 0;
}

/** Format relative time for commit list. */
export function formatGitTime(ts) {
  if (!ts) return "";
  const d = Date.now() - ts;
  if (d < 60_000) return "just now";
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

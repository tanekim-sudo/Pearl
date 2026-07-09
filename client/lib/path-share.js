/**
 * Sending paths — serialize the generative path behind an AI node
 * (source material → operations → intermediate nodes → arrival) into a
 * self-contained artifact another person can walk, annotate, fork, and
 * finally materialize into their own AI space as real nodes.
 */

import { collectAiEdges } from "./ai-nodes.js";

export const PATH_WALKS_KEY = "lens.path.walks.v1";

function rid() {
  return Math.random().toString(36).slice(2, 10);
}

/** Portable projection of an AI node — content + geometry, no live references. */
function portableNode(node, included) {
  const out = {
    id: node.id,
    nodeKind: node.nodeKind || "source",
    label: node.label || "",
    x: node.x || 0,
    y: node.y || 0,
    radius: node.radius || 20,
    createdAt: node.createdAt || 0,
    parentId: included.has(node.parentId) ? node.parentId : null,
    sourceNodeIds: (node.sourceNodeIds || []).filter((id) => included.has(id)),
  };
  for (const field of ["expandedText", "preview", "goldenFragment", "opLabel", "opName", "functionName", "methodName", "method"]) {
    if (node[field]) out[field] = node[field];
  }
  if (node.via?.name) out.via = { name: node.via.name };
  return out;
}

/** The perceptual instruction a step carries — what to do, not what was concluded. */
export function pathStepCaption(node, index) {
  const op = node.via?.name || node.opLabel || node.opName || node.functionName;
  if (op) return `through “${op}”`;
  if (index === 0) return "where it began";
  if (node.nodeKind === "source") return "raw material, brought in";
  if ((node.sourceNodeIds || []).length > 1) return `drawn together from ${node.sourceNodeIds.length} nodes`;
  return "grew out of the previous node";
}

function ancestorSet(targetId, byId) {
  const seen = new Set();
  const queue = [targetId];
  while (queue.length) {
    const id = queue.shift();
    if (!id || seen.has(id)) continue;
    const node = byId.get(id);
    if (!node) continue;
    seen.add(id);
    if (node.parentId) queue.push(node.parentId);
    for (const sid of node.sourceNodeIds || []) queue.push(sid);
  }
  return seen;
}

/**
 * Build the generative path artifact for one AI node: its full ancestor
 * lineage in birth order, the arrows between them, and per-step captions.
 */
export function buildAiPath(targetId, aiNodes, opts = {}) {
  const byId = new Map((aiNodes || []).map((n) => [n.id, n]));
  const target = byId.get(targetId);
  if (!target) return null;
  const included = ancestorSet(targetId, byId);
  const ordered = (aiNodes || [])
    .filter((n) => included.has(n.id))
    .sort(
      (a, b) =>
        (a.createdAt || 0) - (b.createdAt || 0) ||
        (a.id === targetId ? 1 : b.id === targetId ? -1 : 0)
    );
  if (!ordered.length) return null;
  const nodes = ordered.map((n) => portableNode(n, included));
  const steps = nodes.map((n, i) => ({
    nodeId: n.id,
    caption: pathStepCaption(n, i),
    arrived: n.id === targetId,
  }));
  const title =
    opts.title ||
    (target.expandedText || target.preview || target.label || "")
      .trim()
      .split("\n")[0]
      .slice(0, 48) ||
    "a path";
  return {
    v: 1,
    id: opts.id || rid(),
    title,
    createdAt: Date.now(),
    targetId,
    nodes,
    edges: collectAiEdges(nodes),
    steps,
  };
}

function pathBBox(nodes) {
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (const n of nodes) {
    const r = n.radius || 20;
    minx = Math.min(minx, n.x - r);
    miny = Math.min(miny, n.y - r);
    maxx = Math.max(maxx, n.x + r);
    maxy = Math.max(maxy, n.y + r);
  }
  if (minx === Infinity) return { minx: 0, miny: 0, maxx: 0, maxy: 0 };
  return { minx, miny, maxx, maxy };
}

/**
 * Materialize (a prefix of) a shared path into someone's own AI space as
 * real ai-nodes: fresh ids, lineage rewired, layout preserved but offset
 * clear of their existing constellation. Notes travel on the nodes.
 *
 * @param {object} path        the shared path artifact
 * @param {object[]} existing  the receiver's current aiNodes
 * @param {object} opts        { uptoStep, notes, claimedIdMap }
 * @returns {{ nodes: object[], idMap: Record<string,string> }}
 */
export function materializeAiPath(path, existing = [], opts = {}) {
  const uptoStep = opts.uptoStep ?? path.steps.length - 1;
  const claimed = opts.claimedIdMap || {};
  const notes = opts.notes || {};
  const wantedIds = new Set(path.steps.slice(0, uptoStep + 1).map((s) => s.nodeId));
  // pull in any ancestors of wanted nodes that fell outside the prefix
  const byId = new Map(path.nodes.map((n) => [n.id, n]));
  for (const id of [...wantedIds]) {
    for (const aid of ancestorSet(id, byId)) wantedIds.add(aid);
  }

  const toCreate = path.nodes.filter((n) => wantedIds.has(n.id) && !claimed[n.id]);
  const idMap = { ...claimed };
  for (const n of toCreate) idMap[n.id] = rid();

  let dx = 0, dy = 0;
  if (existing.length && !Object.keys(claimed).length) {
    const eb = pathBBox(existing);
    const pb = pathBBox(path.nodes);
    dx = eb.maxx + 320 - pb.minx;
    dy = (eb.miny + eb.maxy) / 2 - (pb.miny + pb.maxy) / 2;
  }
  // keep forked continuation aligned with the already-claimed prefix
  if (Object.keys(claimed).length) {
    const anchor = path.nodes.find((n) => claimed[n.id] && existing.some((e) => e.id === claimed[n.id]));
    if (anchor) {
      const real = existing.find((e) => e.id === claimed[anchor.id]);
      dx = real.x - anchor.x;
      dy = real.y - anchor.y;
    }
  }

  const now = Date.now();
  const nodes = toCreate.map((n, i) => {
    const out = {
      ...n,
      id: idMap[n.id],
      type: "ai-node",
      parentId: n.parentId ? idMap[n.parentId] || null : null,
      sourceNodeIds: (n.sourceNodeIds || []).map((sid) => idMap[sid]).filter(Boolean),
      sourceIds: [],
      opId: null,
      loading: false,
      error: null,
      x: n.x + dx,
      y: n.y + dy,
      createdAt: now + i,
      sharedFrom: { pathId: path.id, title: path.title },
    };
    if (notes[n.id]?.trim()) out.pathNote = notes[n.id].trim();
    return out;
  });
  return { nodes, idMap };
}

// ---- receiver's copy of the walk (notes, position) persists locally ----

export function loadPathWalkState(pathId, storage) {
  const store = storage || (typeof localStorage !== "undefined" ? localStorage : null);
  if (!store || !pathId) return null;
  try {
    const all = JSON.parse(store.getItem(PATH_WALKS_KEY) || "{}");
    return all[pathId] || null;
  } catch {
    return null;
  }
}

export function savePathWalkState(pathId, state, storage) {
  const store = storage || (typeof localStorage !== "undefined" ? localStorage : null);
  if (!store || !pathId) return;
  try {
    const all = JSON.parse(store.getItem(PATH_WALKS_KEY) || "{}");
    all[pathId] = { ...state, updatedAt: Date.now() };
    store.setItem(PATH_WALKS_KEY, JSON.stringify(all));
  } catch {
    /* storage full or blocked — walk still works in memory */
  }
}

/**
 * Spatial reasoning for the AI node constellation — placement, relaxation, and
 * graph-aware positioning so threads read as one connected neural body.
 */

import { AI_NODE_MIN_GAP, AI_NODE_RADIUS, AI_SPAWN_MIN_DIST } from "./ai-constants.js";

const GOLDEN_ANGLE = 2.399963229728653;
const DEFAULT_ITERATIONS = 96;
const ORIGIN = { x: 480, y: 360 };

/** Roots on a golden spiral — each source/session gets its own territory. */
export function goldenSpiralPosition(index, origin = ORIGIN) {
  const angle = index * GOLDEN_ANGLE;
  const radius = 160 + Math.sqrt(index + 1) * 220;
  return {
    x: origin.x + Math.cos(angle) * radius,
    y: origin.y + Math.sin(angle) * radius,
  };
}

export function nodeDepth(nodes, nodeId) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  let depth = 0;
  let cur = byId.get(nodeId);
  while (cur?.parentId) {
    depth += 1;
    cur = byId.get(cur.parentId);
  }
  return depth;
}

function graphCentroid(nodes, excludeId = null) {
  const pool = nodes.filter((n) => n.id !== excludeId);
  if (!pool.length) return { ...ORIGIN };
  let sx = 0;
  let sy = 0;
  for (const n of pool) {
    sx += n.x;
    sy += n.y;
  }
  return { x: sx / pool.length, y: sy / pool.length };
}

/** Outward growth direction: continue the lineage ray, else push away from mass. */
export function outwardAngle(parent, nodes, hintAngle = null) {
  if (hintAngle != null && Number.isFinite(hintAngle)) return hintAngle;
  if (parent.parentId) {
    const gp = nodes.find((n) => n.id === parent.parentId);
    if (gp) return Math.atan2(parent.y - gp.y, parent.x - gp.x);
  }
  const c = graphCentroid(nodes, parent.id);
  const a = Math.atan2(parent.y - c.y, parent.x - c.x);
  return Number.isFinite(a) ? a : -Math.PI / 2;
}

function nudgeFromCollisions(x, y, radius, nodes, skipIds = new Set()) {
  let nx = x;
  let ny = y;
  for (let pass = 0; pass < 20; pass++) {
    let moved = false;
    for (const n of nodes) {
      if (skipIds.has(n.id)) continue;
      const nr = n.radius || AI_NODE_RADIUS.source;
      const dx = nx - n.x;
      const dy = ny - n.y;
      const d = Math.hypot(dx, dy) || 0.001;
      const minD = radius + nr + AI_NODE_MIN_GAP;
      if (d < minD) {
        const push = (minD - d) / d;
        nx += dx * push;
        ny += dy * push;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return { x: nx, y: ny };
}

/**
 * Place a child in the open sector that continues the thread outward from its parent.
 */
export function suggestChildPosition(parent, nodes, kind = "expanded", opts = {}) {
  const radius = AI_NODE_RADIUS[kind] || AI_NODE_RADIUS.expanded;
  const siblings = nodes.filter((n) => n.parentId === parent.id);
  const slot = opts.slotIndex ?? siblings.length;
  const total = opts.totalSlots ?? siblings.length + 1;
  const outward = outwardAngle(parent, nodes, opts.hintAngle);
  const depth = nodeDepth(nodes, parent.id);
  const dist = AI_SPAWN_MIN_DIST + depth * 72;

  const spread =
    total <= 1
      ? Math.PI * 0.55
      : Math.min(Math.PI * 1.15, Math.PI * 0.32 + total * 0.22);
  const start = outward - spread / 2;
  const angle =
    total <= 1 ? outward : start + (spread * slot) / Math.max(total - 1, 1);

  let x = parent.x + Math.cos(angle) * dist;
  let y = parent.y + Math.sin(angle) * dist;

  if (opts.preferWorld && opts.preferWorld.x != null && opts.preferWorld.y != null) {
    const pw = opts.preferWorld;
    if (opts.exactWorld) {
      x = pw.x;
      y = pw.y;
    } else {
      const pd = Math.hypot(pw.x - parent.x, pw.y - parent.y);
      if (pd > AI_SPAWN_MIN_DIST * 0.55 && pd < AI_SPAWN_MIN_DIST * 2.4) {
        const blend = 0.72;
        x = pw.x * blend + x * (1 - blend);
        y = pw.y * blend + y * (1 - blend);
      }
    }
  }

  const nudged = nudgeFromCollisions(x, y, radius, nodes, new Set([parent.id]));
  return { x: nudged.x, y: nudged.y, radius };
}

/** Springs for force layout — parent/child are stiff, cross-links are soft. */
export function layoutSprings(nodes) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const springs = [];
  const seen = new Set();

  function add(fromId, toId, strong) {
    const key = `${fromId}->${toId}`;
    if (seen.has(key) || !byId.has(fromId) || !byId.has(toId)) return;
    seen.add(key);
    springs.push({ fromId, toId, strong });
  }

  for (const n of nodes) {
    if (n.parentId) add(n.parentId, n.id, true);
    for (const sid of n.sourceNodeIds || []) {
      if (sid !== n.parentId) add(sid, n.id, false);
    }
  }
  return springs;
}

function idealLinkLength(strong, depth) {
  return (strong ? AI_SPAWN_MIN_DIST : AI_SPAWN_MIN_DIST * 1.15) + depth * 36;
}

/**
 * Force-directed relaxation — edges pull, nodes repel, collisions resolve.
 * Starts from current positions so the graph morphs instead of jumping.
 */
export function layoutAiGraph(nodes, opts = {}) {
  if (!nodes.length) return [];

  const iterations = opts.iterations ?? DEFAULT_ITERATIONS;
  const pinned = new Set(opts.pinnedIds || []);
  const relaxOnly = opts.relaxIds ? new Set(opts.relaxIds) : null;

  const sim = nodes.map((n) => ({
    id: n.id,
    x: n.x,
    y: n.y,
    radius: n.radius || AI_NODE_RADIUS.source,
    depth: nodeDepth(nodes, n.id),
    pin: pinned.has(n.id),
  }));
  const byId = new Map(sim.map((s) => [s.id, s]));
  const springs = layoutSprings(nodes);

  const canMove = (s) => {
    if (s.pin) return false;
    if (relaxOnly && !relaxOnly.has(s.id)) return false;
    return true;
  };

  for (let iter = 0; iter < iterations; iter++) {
    const t = 1 - iter / iterations;
    const alpha = t * t;

    for (let i = 0; i < sim.length; i++) {
      for (let j = i + 1; j < sim.length; j++) {
        const a = sim[i];
        const b = sim[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const d2 = dx * dx + dy * dy || 1;
        const d = Math.sqrt(d2);
        const minD = a.radius + b.radius + AI_NODE_MIN_GAP;
        const repulse = ((minD * minD) / d2) * 1.35 * alpha;
        const fx = (dx / d) * repulse;
        const fy = (dy / d) * repulse;
        if (canMove(a)) {
          a.x -= fx;
          a.y -= fy;
        }
        if (canMove(b)) {
          b.x += fx;
          b.y += fy;
        }
      }
    }

    for (const sp of springs) {
      const a = byId.get(sp.fromId);
      const b = byId.get(sp.toId);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 0.001;
      const target = idealLinkLength(sp.strong, Math.max(a.depth, b.depth));
      const k = sp.strong ? 0.052 : 0.028;
      const force = (d - target) * k * alpha;
      const fx = (dx / d) * force;
      const fy = (dy / d) * force;
      if (canMove(a)) {
        a.x += fx;
        a.y += fy;
      }
      if (canMove(b)) {
        b.x -= fx;
        b.y -= fy;
      }
    }

    const cx = sim.reduce((s, n) => s + n.x, 0) / sim.length;
    const cy = sim.reduce((s, n) => s + n.y, 0) / sim.length;
    for (const s of sim) {
      if (!canMove(s)) continue;
      s.x += (cx - s.x) * 0.002 * alpha;
      s.y += (cy - s.y) * 0.002 * alpha;
    }
  }

  return nodes.map((n) => {
    const s = byId.get(n.id);
    const x = Number.isFinite(s.x) ? s.x : n.x || 0;
    const y = Number.isFinite(s.y) ? s.y : n.y || 0;
    return { ...n, x, y };
  });
}

/** Initial position for a new root (source / session / orphan). */
export function suggestRootPosition(nodes, kind = "source") {
  const roots = nodes.filter((n) => !n.parentId);
  const spiral = goldenSpiralPosition(roots.length);
  const radius = AI_NODE_RADIUS[kind] || AI_NODE_RADIUS.source;
  const nudged = nudgeFromCollisions(spiral.x, spiral.y, radius, nodes);
  return { x: nudged.x, y: nudged.y, radius };
}

/**
 * After adding nodes: semantic placement + global relaxation so threads stay one body.
 */
export function layoutAfterAppend(nodes, newNodes) {
  if (!newNodes?.length) return nodes;

  try {
    return layoutAfterAppendInner(nodes, newNodes);
  } catch (err) {
    console.error("[ai-layout] layoutAfterAppend failed, using fallback positions", err);
    return [...nodes, ...newNodes.map((n) => ({ ...n }))];
  }
}

function layoutAfterAppendInner(nodes, newNodes) {
  if (!newNodes.length) return nodes;

  let combined = [...nodes.map((n) => ({ ...n })), ...newNodes.map((n) => ({ ...n }))];
  const byId = new Map(combined.map((n) => [n.id, n]));
  const newIds = new Set(newNodes.map((n) => n.id));

  for (const raw of newNodes) {
    const n = byId.get(raw.id);
    if (!n) continue;
    const pool = combined.filter((x) => x.id !== n.id);

    if (raw._dropPinned && raw.x != null && raw.y != null) {
      const radius = n.radius || AI_NODE_RADIUS[n.nodeKind] || AI_NODE_RADIUS.source;
      n.x = raw.x;
      n.y = raw.y;
      n.radius = radius;
      continue;
    }

    if (n.parentId && byId.has(n.parentId)) {
      const parent = byId.get(n.parentId);
      const siblings = pool.filter((x) => x.parentId === parent.id);
      const hintAngle =
        raw._hintAngle ??
        (raw.x != null && raw.y != null
          ? Math.atan2(raw.y - parent.y, raw.x - parent.x)
          : null);
      const pos = suggestChildPosition(parent, pool, n.nodeKind || "expanded", {
        slotIndex: siblings.length,
        totalSlots: siblings.length + 1,
        hintAngle,
        preferWorld: raw.x != null ? { x: raw.x, y: raw.y } : null,
      });
      n.x = pos.x;
      n.y = pos.y;
      n.radius = n.radius || pos.radius;
    } else if (!n.parentId && (n.x == null || (n.x === 0 && n.y === 0))) {
      const pos = suggestRootPosition(pool, n.nodeKind || "source");
      n.x = pos.x;
      n.y = pos.y;
      n.radius = n.radius || pos.radius;
    } else if (!n.parentId) {
      const pos = suggestRootPosition(pool, n.nodeKind || "source");
      const nudged = nudgeFromCollisions(n.x, n.y, n.radius || pos.radius, pool);
      n.x = nudged.x;
      n.y = nudged.y;
    }
  }

  const relaxIds = new Set(newIds);
  for (const id of newIds) {
    const n = byId.get(id);
    if (!n) continue;
    if (n.parentId) relaxIds.add(n.parentId);
    for (const sid of n.sourceNodeIds || []) relaxIds.add(sid);
    for (const child of combined) {
      if (child.parentId === id) relaxIds.add(child.id);
    }
  }

  const pinnedIds = newNodes.filter((n) => n._dropPinned).map((n) => n.id);
  for (const n of newNodes) {
    if (n._dropPinned && n.parentId) pinnedIds.push(n.parentId);
  }
  combined = layoutAiGraph(combined, { relaxIds: [...relaxIds], iterations: 110, pinnedIds });

  return combined.map((n) => {
    const { _hintAngle, _dropPinned, ...clean } = n;
    return clean;
  });
}

/** Re-organize the entire constellation (e.g. after many overlapping nodes). */
export function relayoutAiConstellation(nodes) {
  if (nodes.length <= 1) return nodes;
  return layoutAiGraph(nodes, { iterations: 140 });
}

/** Paper-side highlight selection: brush hits, loops, and disconnected fragments. */

import { sampleStrokePoints } from "./highlight-text.js";

export const HIGHLIGHT_INK = "#E8B923";
export const HIGHLIGHT_W = 12;

export function highlightWorldWidth(scale) {
  return HIGHLIGHT_W / Math.max(scale, 0.12);
}

function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-6) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function clientBoundsForItem(it, worldToClient, blockWidth, itemHeight) {
  if (it.type === "stroke") {
    if (!it.points?.length) return null;
    const xs = it.points.map((p) => worldToClient(p.x, p.y).x);
    const ys = it.points.map((p) => worldToClient(p.x, p.y).y);
    return {
      left: Math.min(...xs),
      top: Math.min(...ys),
      right: Math.max(...xs),
      bottom: Math.max(...ys),
    };
  }
  const scale = it.scale ?? 1;
  const tl = worldToClient(it.x, it.y);
  if (it.type === "image") {
    const w = (it.w || 200) * scale;
    const h = (it.h || Math.round((it.w || 200) * 0.75)) * scale;
    return { left: tl.x, top: tl.y, right: tl.x + w, bottom: tl.y + h };
  }
  if (
    it.type === "text" ||
    it.type === "sticky" ||
    it.type === "callout" ||
    it.type === "code" ||
    it.type === "math" ||
    it.type === "table" ||
    it.type === "diagram" ||
    it.type === "voice" ||
    it.type === "video"
  ) {
    const w = (blockWidth?.(it) || it.w || 360) * scale;
    const h = (itemHeight?.(it) || 40) * scale;
    return { left: tl.x, top: tl.y, right: tl.x + w, bottom: tl.y + h };
  }
  return null;
}

export function brushHitsItem(it, cx, cy, lastCx, lastCy, brush, worldToClient, blockWidth, itemHeight) {
  if (it.type === "stroke") {
    for (let k = 1; k < it.points.length; k++) {
      const a = worldToClient(it.points[k - 1].x, it.points[k - 1].y);
      const b = worldToClient(it.points[k].x, it.points[k].y);
      if (Math.hypot(cx - a.x, cy - a.y) <= brush || Math.hypot(cx - b.x, cy - b.y) <= brush) return true;
      if (distToSeg(cx, cy, a.x, a.y, b.x, b.y) <= brush) return true;
      if (lastCx != null && distToSeg(lastCx, lastCy, a.x, a.y, b.x, b.y) <= brush) return true;
    }
    return false;
  }
  const bb = clientBoundsForItem(it, worldToClient, blockWidth, itemHeight);
  if (!bb) return false;
  const pad = brush;
  const inRect = (x, y) =>
    x >= bb.left - pad && x <= bb.right + pad && y >= bb.top - pad && y <= bb.bottom + pad;
  if (inRect(cx, cy)) return true;
  if (lastCx != null) {
    for (let t = 0; t <= 1; t += 0.25) {
      const x = lastCx + (cx - lastCx) * t;
      const y = lastCy + (cy - lastCy) * t;
      if (inRect(x, y)) return true;
    }
  }
  return false;
}

export function highlightBrushHits(
  items,
  cx,
  cy,
  lastCx,
  lastCy,
  scale,
  worldToClient,
  skipIds,
  blockWidth,
  itemHeight
) {
  const brush = Math.max(14, HIGHLIGHT_W * scale * 0.52);
  const hits = [];
  for (const it of items) {
    if (skipIds?.has(it.id)) continue;
    if (it.type === "link" || it.highlight) continue;
    if (brushHitsItem(it, cx, cy, lastCx, lastCy, brush, worldToClient, blockWidth, itemHeight)) {
      hits.push(it.id);
    }
  }
  return hits;
}

function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const denom = yj - yi || 1e-9;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / denom + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function strokeWorldBBox(points, pad = 0) {
  if (!points?.length) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return {
    minx: Math.min(...xs) - pad,
    miny: Math.min(...ys) - pad,
    maxx: Math.max(...xs) + pad,
    maxy: Math.max(...ys) + pad,
  };
}

function itemWorldBBox(it) {
  if (it.type === "stroke") {
    if (!it.points?.length) return null;
    const xs = it.points.map((p) => p.x);
    const ys = it.points.map((p) => p.y);
    return { minx: Math.min(...xs), miny: Math.min(...ys), maxx: Math.max(...xs), maxy: Math.max(...ys) };
  }
  if (it.type === "image") {
    const w = it.w || 200;
    const h = it.h || Math.round(w * 0.75);
    return { minx: it.x, miny: it.y, maxx: it.x + w, maxy: it.y + h };
  }
  if (it.x != null && it.y != null) {
    const w = it.w || 360;
    const h = it.h || 80;
    return { minx: it.x, miny: it.y, maxx: it.x + w, maxy: it.y + h };
  }
  return null;
}

function bboxesOverlap(a, b) {
  if (!a || !b) return false;
  return a.minx <= b.maxx && a.maxx >= b.minx && a.miny <= b.maxy && a.maxy >= b.miny;
}

function isClosedHighlightLoop(points, scale) {
  if (points.length < 8) return false;
  const a = points[0];
  const b = points[points.length - 1];
  const closeDist = Math.max(24, highlightWorldWidth(scale) * 1.8);
  return Math.hypot(b.x - a.x, b.y - a.y) <= closeDist;
}

function itemsInsideHighlightLoop(points, itemList) {
  if (points.length < 3) return [];
  const ids = [];
  for (const it of itemList) {
    const bb = itemWorldBBox(it);
    if (!bb) continue;
    const cx = (bb.minx + bb.maxx) / 2;
    const cy = (bb.miny + bb.maxy) / 2;
    const corners = [
      { x: bb.minx, y: bb.miny },
      { x: bb.maxx, y: bb.miny },
      { x: bb.maxx, y: bb.maxy },
      { x: bb.minx, y: bb.maxy },
    ];
    if (pointInPolygon(cx, cy, points) || corners.some((c) => pointInPolygon(c.x, c.y, points))) {
      ids.push(it.id);
    }
  }
  return [...new Set(ids)];
}

/** Items touched along a highlight stroke path (disconnected fragments). */
export function itemsTouchedByHighlightPath(points, scale, itemList, worldToClient, blockWidth, itemHeight) {
  if (!points?.length) return [];
  const samples = sampleStrokePoints(points);
  const ids = new Set();
  let prevClient = null;
  for (const s of samples) {
    const client = worldToClient(s.x, s.y);
    const hits = highlightBrushHits(
      itemList,
      client.x,
      client.y,
      prevClient?.x ?? null,
      prevClient?.y ?? null,
      scale,
      worldToClient,
      null,
      blockWidth,
      itemHeight
    );
    hits.forEach((id) => ids.add(id));
    prevClient = client;
  }
  return [...ids];
}

/**
 * Collect selectable item ids from a highlight gesture (loop, path touch, or tap bbox).
 * @param {object} opts - { isTransformableBlock, tapItemId? }
 */
export function itemsFromHighlightGesture(points, scale, itemList, worldToClient, blockWidth, itemHeight, opts = {}) {
  if (!points?.length) return [];
  const keep = (it) =>
    it &&
    it.type !== "link" &&
    !it.highlight &&
    (opts.isTransformableBlock?.(it) || it.type === "stroke" || it.type === "image");

  const loop = points.length > 8 && isClosedHighlightLoop(points, scale);
  if (loop) {
    return itemsInsideHighlightLoop(points, itemList).filter((id) => keep(itemList.find((i) => i.id === id)));
  }

  const pathHits = itemsTouchedByHighlightPath(points, scale, itemList, worldToClient, blockWidth, itemHeight).filter(
    (id) => keep(itemList.find((i) => i.id === id))
  );
  if (pathHits.length) return pathHits;

  if (opts.tapItemId && keep(itemList.find((i) => i.id === opts.tapItemId))) {
    return [opts.tapItemId];
  }

  const hlW = highlightWorldWidth(scale);
  const bb = strokeWorldBBox(points, hlW * 0.65);
  if (!bb) return [];
  const ids = [];
  for (const it of itemList) {
    if (!keep(it)) continue;
    const ibb = itemWorldBBox(it);
    if (ibb && bboxesOverlap(ibb, bb)) ids.push(it.id);
  }
  return [...new Set(ids)];
}

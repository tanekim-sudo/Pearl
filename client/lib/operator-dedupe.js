/**
 * Exact-duplicate cleanup for operators (functions/lenses) and generators.
 *
 * Earlier account-merge bugs re-imported the same functions under fresh ids
 * on every "bring this work into my account". A duplicate here is strict:
 * same trimmed case-insensitive name AND same content (prompt for leaves,
 * ordered step content for pipelines) — the oldest copy wins.
 */

import { lensContentSignature } from "./lens-dedupe.js";

function normName(name) {
  return String(name || "").trim().toLowerCase();
}

/** name+content key for a top-level operator; null when it has no content. */
export function operatorDupeKey(op, opMap) {
  if (!op?.id) return null;
  const sig = lensContentSignature(op, opMap);
  if (!sig) return null;
  return `${normName(op.name)}::${sig}`;
}

/**
 * Collapse exact-duplicate top-level operators, keeping the first (oldest —
 * operators are appended over time). Dropped duplicates' pipeline subtrees go
 * too unless still referenced by a surviving operator.
 * @returns {{ ops: object[], idMap: Record<string, string> }} idMap maps each
 * dropped root id to the kept twin, so callers can remap references.
 */
export function dedupeOperators(ops) {
  if (!Array.isArray(ops)) return { ops, idMap: {} };
  const map = Object.fromEntries(ops.filter((o) => o?.id).map((o) => [o.id, o]));
  const seenTop = new Map();
  const idMap = {};
  const dropRoots = [];
  for (const op of ops) {
    if (!op?.id || !op.top) continue;
    const key = operatorDupeKey(op, map);
    if (!key) continue;
    const kept = seenTop.get(key);
    if (kept) {
      idMap[op.id] = kept.id;
      dropRoots.push(op.id);
    } else {
      seenTop.set(key, op);
    }
  }
  if (!dropRoots.length) return { ops, idMap };

  const collect = (id, acc) => {
    const o = map[id];
    if (!o || acc.has(id)) return;
    acc.add(id);
    if (o.kind === "pipeline") (o.steps || []).forEach((sid) => collect(sid, acc));
  };
  const dropped = new Set();
  for (const rootId of dropRoots) collect(rootId, dropped);
  const stillNeeded = new Set();
  for (const op of ops) {
    if (!op?.id || dropped.has(op.id)) continue;
    collect(op.id, stillNeeded);
  }
  const next = ops.filter((o) => !o?.id || !dropped.has(o.id) || stillNeeded.has(o.id));
  return { ops: next, idMap };
}

/** Remap operator references on lens/repo records after a dedupe. */
export function remapOperatorRefs(records, idMap) {
  if (!Array.isArray(records) || !idMap || !Object.keys(idMap).length) return records;
  return records.map((rec) => {
    if (!rec || typeof rec !== "object") return rec;
    let changed = false;
    const next = { ...rec };
    if (idMap[next.opId]) {
      next.opId = idMap[next.opId];
      changed = true;
    }
    if (Array.isArray(next.moveIds) && next.moveIds.some((id) => idMap[id])) {
      next.moveIds = next.moveIds.map((id) => idMap[id] || id);
      changed = true;
    }
    if (idMap[next.viewLensOpId]) {
      next.viewLensOpId = idMap[next.viewLensOpId];
      changed = true;
    }
    return changed ? next : rec;
  });
}

/** name+content key for a generator / pattern-lens record. */
export function generatorDupeKey(rec) {
  const items = Array.isArray(rec?.items) ? rec.items : [];
  const content = items
    .map((it) =>
      it?.type === "stroke"
        ? `s${(it.points || []).length}`
        : `${it?.type || "?"}:${String(it?.text || "").trim().toLowerCase()}`
    )
    .join("|");
  return `${normName(rec?.title || rec?.name)}::${content}`;
}

/** Drop exact-duplicate generators (same title AND same items), keeping the oldest. */
export function dedupeGenerators(list) {
  if (!Array.isArray(list)) return list;
  const byKey = new Map();
  for (const rec of list) {
    if (!rec?.id) continue;
    const key = generatorDupeKey(rec);
    const cur = byKey.get(key);
    if (!cur || (rec.savedAt || rec.createdAt || 0) < (cur.savedAt || cur.createdAt || 0)) {
      byKey.set(key, rec);
    }
  }
  return list.filter((rec) => !rec?.id || byKey.get(generatorDupeKey(rec)) === rec);
}

/** Drop duplicate transformation repos (same name AND same root op), keeping the oldest. */
export function dedupeTransformationRepos(list) {
  if (!Array.isArray(list)) return list;
  const keyOf = (rec) => `${normName(rec?.name || rec?.title)}::${rec?.opId || rec?.moveIds?.[0] || ""}`;
  const byKey = new Map();
  for (const rec of list) {
    if (!rec?.id) continue;
    const key = keyOf(rec);
    const cur = byKey.get(key);
    if (!cur || (rec.createdAt || rec.savedAt || 0) < (cur.createdAt || cur.savedAt || 0)) {
      byKey.set(key, rec);
    }
  }
  return list.filter((rec) => !rec?.id || byKey.get(keyOf(rec)) === rec);
}

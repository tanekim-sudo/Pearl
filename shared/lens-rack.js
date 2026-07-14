import { contentFingerprint, stableOperatorContent } from "./lens-grammar.js";
import { normalizeOutputSpec, outputContractLabel, suggestedOutputSpec } from "./output-specifications.js";

export const LENS_PACK_VERSION = 1;
export const RACK_RENDER_LIMIT = 120;

export function lensRackRecord(op, meta = {}) {
  const outputSpec = op.outputSpec ? normalizeOutputSpec(op.outputSpec, op) : suggestedOutputSpec(op);
  return {
    id: op.id,
    opId: op.id,
    stableId: meta.stableId || op.stableId || op.id,
    name: op.name || "unnamed lens",
    description: op.description || "",
    type: op.lensKind || (op.composition ? "compound" : op.forgedFrom ? "forged" : op.primitive ? "primitive" : "custom"),
    version: Number(op.version) || 1,
    tags: [...new Set([...(op.tags || []), ...(meta.tags || [])])],
    domains: [...new Set([...(op.domains || []), ...(meta.domains || [])])],
    componentNames: (op.composition?.components || []).map((entry) => entry.name).filter(Boolean),
    outputCount: Number(op.outputCount) || 1,
    outputSpec,
    outputContract: outputContractLabel(outputSpec),
    stepCount: op.kind === "pipeline" ? op.steps?.length || 0 : 1,
    pinned: !!meta.pinned,
    archivedAt: meta.archivedAt || null,
    collectionIds: meta.collectionIds || [],
    usageCount: Number(meta.usageCount) || 0,
    lastUsedAt: Number(meta.lastUsedAt) || 0,
    updatedAt: Number(meta.updatedAt || op.updatedAt || op.createdAt) || 0,
    shared: !!meta.shared,
    forked: !!(meta.forked || op.forkedFrom),
    hash: meta.hash || null,
  };
}

export function selectRack(records, query = {}) {
  const needle = String(query.search || "").trim().toLowerCase();
  const types = new Set(Array.isArray(query.types) ? query.types : query.type ? [query.type] : []);
  const collectionId = query.collectionId || null;
  let selected = (records || []).filter((record) => {
    if (!record) return false;
    if (query.archived ? !record.archivedAt : record.archivedAt) return false;
    if (query.pinned && !record.pinned) return false;
    if (types.size && !types.has(record.type) && !(types.has("shared") && record.shared) && !(types.has("forked") && record.forked)) return false;
    if (collectionId && !record.collectionIds?.includes(collectionId)) return false;
    if (!needle) return true;
    return [record.name, record.description, ...(record.tags || []), ...(record.domains || []), ...(record.componentNames || [])]
      .join(" ")
      .toLowerCase()
      .includes(needle);
  });
  const sort = query.sort || "recent";
  selected.sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    if (sort === "name") return a.name.localeCompare(b.name);
    if (sort === "frequent") return b.usageCount - a.usageCount || b.lastUsedAt - a.lastUsedAt;
    if (sort === "version") return b.version - a.version || a.name.localeCompare(b.name);
    return b.lastUsedAt - a.lastUsedAt || b.updatedAt - a.updatedAt || a.name.localeCompare(b.name);
  });
  const total = selected.length;
  const limit = Math.max(1, Math.min(Number(query.limit) || RACK_RENDER_LIMIT, RACK_RENDER_LIMIT));
  selected = selected.slice(Number(query.offset) || 0, (Number(query.offset) || 0) + limit);
  return { records: selected, total, bounded: total > selected.length };
}

export function dependenciesFor(rootId, opMap) {
  const ids = new Set();
  function walk(id) {
    if (!id || ids.has(id)) return;
    ids.add(id);
    const op = opMap[id];
    if (!op) return;
    for (const stepId of op.steps || []) walk(stepId);
    for (const component of op.composition?.components || []) walk(component.opId);
  }
  walk(rootId);
  return [...ids];
}

export function dependentsFor(targetId, operators) {
  const map = Object.fromEntries((operators || []).map((op) => [op.id, op]));
  return (operators || []).filter((op) => op.id !== targetId && dependenciesFor(op.id, map).includes(targetId));
}

export function createLensPack(rootIds, operators, options = {}) {
  const map = Object.fromEntries((operators || []).map((op) => [op.id, op]));
  const closure = new Set();
  for (const id of rootIds || []) dependenciesFor(id, map).forEach((dep) => closure.add(dep));
  const packed = [...closure].map((id) => {
    const op = map[id];
    if (!op) throw new Error(`missing dependency ${id}`);
    const portable = { ...op };
    if (!options.includePrivateExamples && portable.forgedFrom) {
      portable.forgedFrom = { ...portable.forgedFrom, exampleIds: [], examplesPrivate: true };
      delete portable.grindExamples;
    }
    return portable;
  });
  return {
    kind: "lens-pack",
    version: LENS_PACK_VERSION,
    name: options.name || "Lens pack",
    roots: [...new Set(rootIds || [])],
    operators: packed,
    collections: options.collections || [],
    createdAt: Date.now(),
    privacy: { examplesIncluded: !!options.includePrivateExamples },
  };
}

export function previewLensPackImport(pack, existingOperators) {
  if (!pack || pack.kind !== "lens-pack" || pack.version !== LENS_PACK_VERSION) throw new Error("unsupported lens pack");
  const existingMap = Object.fromEntries((existingOperators || []).map((op) => [op.id, op]));
  const incomingMap = Object.fromEntries((pack.operators || []).map((op) => [op.id, op]));
  const existingHashes = new Map(
    (existingOperators || []).map((op) => [contentFingerprint(stableOperatorContent(op, existingMap)), op])
  );
  const entries = (pack.operators || []).map((op) => {
    const hash = contentFingerprint(stableOperatorContent(op, incomingMap));
    const sameId = existingMap[op.id];
    const sameContent = existingHashes.get(hash);
    return {
      id: op.id,
      name: op.name,
      status: sameId ? (contentFingerprint(stableOperatorContent(sameId, existingMap)) === hash ? "duplicate" : "conflict") : sameContent ? "duplicate-content" : "new",
      existingId: sameId?.id || sameContent?.id || null,
      hash,
    };
  });
  return { entries, newCount: entries.filter((entry) => entry.status === "new").length, conflicts: entries.filter((entry) => entry.status === "conflict") };
}

export function importLensPack(pack, existingOperators, choices = {}, idFactory = () => globalThis.crypto?.randomUUID?.() || `import-${Date.now()}`) {
  const preview = previewLensPackImport(pack, existingOperators);
  const next = [...(existingOperators || [])];
  const ids = new Set(next.map((op) => op.id));
  const remap = {};
  for (const entry of preview.entries) {
    const choice = choices[entry.id] || (entry.status === "new" ? "add" : "skip");
    if (choice === "keep-both") remap[entry.id] = idFactory();
    else if (entry.status.startsWith("duplicate") && entry.existingId) remap[entry.id] = entry.existingId;
    else remap[entry.id] = entry.id;
  }
  for (const op of pack.operators || []) {
    const entry = preview.entries.find((item) => item.id === op.id);
    const choice = choices[op.id] || (entry.status === "new" ? "add" : "skip");
    if (choice === "skip") continue;
    const imported = {
      ...op,
      id: remap[op.id],
      steps: op.steps?.map((id) => remap[id] || id),
      composition: op.composition
        ? { ...op.composition, components: op.composition.components.map((component) => ({ ...component, opId: remap[component.opId] || component.opId })) }
        : undefined,
      importedAt: Date.now(),
    };
    if (choice === "replace" && ids.has(imported.id)) {
      const index = next.findIndex((entryOp) => entryOp.id === imported.id);
      next[index] = imported;
    } else if (!ids.has(imported.id)) {
      next.push(imported);
      ids.add(imported.id);
    }
  }
  return { operators: next, remap, preview };
}

export function mergeRackMetadata(local = [], remote = []) {
  const byKey = new Map();
  for (const record of [...remote, ...local]) {
    if (!record?.stableId && !record?.id) continue;
    const key = `${record.stableId || record.id}@${Number(record.version) || 1}:${record.hash || ""}`;
    const previous = byKey.get(key);
    byKey.set(key, previous ? {
      ...previous,
      ...record,
      usageCount: Math.max(previous.usageCount || 0, record.usageCount || 0),
      lastUsedAt: Math.max(previous.lastUsedAt || 0, record.lastUsedAt || 0),
      collectionIds: [...new Set([...(previous.collectionIds || []), ...(record.collectionIds || [])])],
    } : record);
  }
  return [...byKey.values()];
}

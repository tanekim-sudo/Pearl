const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function textOf(value) {
  return String(value?.text || value?.expandedText || value?.preview || value?.label || value?.name || "");
}

function summary(value, max = 180) {
  return textOf(value).replace(/\s+/g, " ").trim().slice(0, max);
}

function itemBox(item) {
  const width = Number(item.w || item.width || (item.type === "text" ? 220 : 80));
  const height = Number(item.h || item.height || (item.type === "text" ? 80 : 80));
  return { minx: item.x || 0, miny: item.y || 0, maxx: (item.x || 0) + width, maxy: (item.y || 0) + height };
}

function conciseObject(value, domain) {
  const box =
    domain === "ai"
      ? {
          minx: (value.x || 0) - (value.radius || 20),
          miny: (value.y || 0) - (value.radius || 20),
          maxx: (value.x || 0) + (value.radius || 20),
          maxy: (value.y || 0) + (value.radius || 20),
        }
      : itemBox(value);
  return {
    id: value.id,
    domain,
    type: value.type || value.nodeKind || "object",
    summary: summary(value),
    box,
    parentId: value.parentId || null,
    sourceIds: [...(value.sourceIds || []), ...(value.sourceNodeIds || [])].slice(0, 12),
    createdAt: value.createdAt || value.updatedAt || null,
    historyCount: Array.isArray(value.history) ? value.history.length : 0,
  };
}

export function buildWorkspaceSnapshot({
  items = [],
  nodes = [],
  selectedItemIds = [],
  selectedNodeIds = [],
  highlightedIds = [],
  lenses = [],
  generators = [],
  camera = null,
  viewport = null,
  tool = null,
  page = null,
  recentHistory = [],
  user = null,
} = {}) {
  const selected = new Set([...selectedItemIds, ...selectedNodeIds]);
  const highlighted = new Set(highlightedIds);
  const objects = [
    ...items.map((value) => conciseObject(value, "paper")),
    ...nodes.map((value) => conciseObject(value, "ai")),
  ];
  return {
    version: 1,
    observedAt: new Date().toISOString(),
    objects: objects.slice(0, 500),
    selection: objects.filter((object) => selected.has(object.id)).slice(0, MAX_LIMIT),
    highlighted: objects.filter((object) => highlighted.has(object.id)).slice(0, MAX_LIMIT),
    graph: nodes.slice(0, 250).map((node) => ({
      id: node.id,
      parentId: node.parentId || null,
      sourceNodeIds: (node.sourceNodeIds || []).slice(0, 12),
    })),
    lenses: lenses.slice(0, 60).map((lens) => ({
      id: lens.id,
      name: lens.name || lens.title || "Untitled lens",
      description: summary(lens),
      kind: lens.kind || "lens",
    })),
    generators: generators.slice(0, 40).map((generator) => ({
      id: generator.id,
      name: generator.title || generator.name || "Untitled generator",
      observationCount: (generator.itemIds || generator.items || []).length,
    })),
    context: {
      camera: camera
        ? { x: Number(camera.x) || 0, y: Number(camera.y) || 0, scale: Number(camera.scale) || 1 }
        : null,
      viewport: viewport
        ? { width: Number(viewport.width) || 0, height: Number(viewport.height) || 0 }
        : null,
      tool,
      page: page ? { id: page.id, name: page.name || page.title || "" } : null,
    },
    recentHistory: recentHistory.slice(-20).map((entry) => ({
      id: entry.id || null,
      kind: entry.kind || entry.type || "change",
      targetId: entry.targetId || entry.itemId || null,
      summary: summary(entry),
      at: entry.at || entry.createdAt || null,
    })),
    user: user
      ? {
          role: String(user.role || "").slice(0, 120),
          goals: (user.goals || []).slice(-5).map((goal) => String(goal).slice(0, 160)),
          preferences: user.preferences || {},
        }
      : null,
  };
}

function intersects(a, b) {
  return a.minx <= b.maxx && a.maxx >= b.minx && a.miny <= b.maxy && a.maxy >= b.miny;
}

function graphWalk(snapshot, seeds, direction, limit) {
  const links = snapshot.graph || [];
  const seen = new Set(seeds);
  const queue = [...seeds];
  while (queue.length && seen.size < limit) {
    const current = queue.shift();
    for (const node of links) {
      const parents = [node.parentId, ...(node.sourceNodeIds || [])].filter(Boolean);
      const matches = direction === "ancestors" ? node.id === current : parents.includes(current);
      const next = direction === "ancestors" ? parents : [node.id];
      if (!matches) continue;
      for (const id of next) {
        if (!seen.has(id)) {
          seen.add(id);
          queue.push(id);
        }
      }
    }
  }
  return snapshot.objects.filter((object) => seen.has(object.id));
}

export function queryWorkspace(snapshot, query, filter = {}) {
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(filter.limit) || DEFAULT_LIMIT));
  if (query === "selection") {
    const source = filter.highlighted ? snapshot.highlighted : snapshot.selection;
    return source.slice(0, limit);
  }
  if (query === "viewport") return snapshot.context;
  if (query === "library") {
    return {
      lenses: snapshot.lenses.slice(0, limit),
      generators: snapshot.generators.slice(0, limit),
    };
  }
  if (query === "history") {
    return snapshot.recentHistory
      .filter((entry) => !filter.targetId || entry.targetId === filter.targetId)
      .slice(-limit);
  }
  if (query === "graph") {
    const seeds = Array.isArray(filter.ids) ? filter.ids : [filter.id].filter(Boolean);
    return graphWalk(snapshot, seeds, filter.direction || "descendants", limit).slice(0, limit);
  }
  let result = snapshot.objects;
  if (filter.domain) result = result.filter((object) => object.domain === filter.domain);
  if (filter.type) result = result.filter((object) => object.type === filter.type);
  if (filter.text) {
    const needle = String(filter.text).toLowerCase();
    result = result.filter((object) => object.summary.toLowerCase().includes(needle));
  }
  if (filter.ids) {
    const ids = new Set(filter.ids);
    result = result.filter((object) => ids.has(object.id));
  }
  if (filter.region) result = result.filter((object) => intersects(object.box, filter.region));
  if (filter.lineageId) {
    const lineage = new Set(graphWalk(snapshot, [filter.lineageId], "descendants", MAX_LIMIT).map((o) => o.id));
    result = result.filter((object) => lineage.has(object.id));
  }
  if (filter.recent) {
    result = [...result].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  }
  if (query === "clusters") {
    const distance = Math.max(20, Number(filter.distance) || 220);
    const clusters = [];
    for (const object of result) {
      const cx = (object.box.minx + object.box.maxx) / 2;
      const cy = (object.box.miny + object.box.maxy) / 2;
      let cluster = clusters.find((candidate) => Math.hypot(candidate.cx - cx, candidate.cy - cy) <= distance);
      if (!cluster) {
        cluster = { cx, cy, objects: [] };
        clusters.push(cluster);
      }
      cluster.objects.push(object);
      cluster.cx = cluster.objects.reduce((sum, entry) => sum + (entry.box.minx + entry.box.maxx) / 2, 0) / cluster.objects.length;
      cluster.cy = cluster.objects.reduce((sum, entry) => sum + (entry.box.miny + entry.box.maxy) / 2, 0) / cluster.objects.length;
    }
    return clusters.slice(0, limit).map(({ objects }) => objects);
  }
  return result.slice(0, limit);
}

export function workspacePromptContext(snapshot, maxObjects = 30) {
  return JSON.stringify({
    selection: snapshot.selection,
    highlighted: snapshot.highlighted,
    visibleObjects: snapshot.objects.slice(0, maxObjects),
    graph: snapshot.graph.slice(0, 80),
    lenses: snapshot.lenses,
    generators: snapshot.generators,
    context: snapshot.context,
    recentHistory: snapshot.recentHistory,
    user: snapshot.user,
  });
}

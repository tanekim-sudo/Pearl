import { createWorkspaceObservation, sceneRelationships } from "../../shared/workspace-observation.js";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

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
    stableId: value.stableId || value.id,
    version: Number(value.version) || 1,
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
  semanticOrbs = [],
  activeSemanticOrbId = null,
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
  scope = "paper",
  stateRevision = null,
  focused = null,
  openEditor = null,
} = {}) {
  const selected = new Set([...selectedItemIds, ...selectedNodeIds]);
  const highlighted = new Set(highlightedIds);
  const objects = [
    ...items.map((value) => conciseObject(value, "paper")),
    ...nodes.map((value) => conciseObject(value, "ai")),
    ...semanticOrbs.map((value) => conciseObject({
      ...value,
      x: value.placement?.x,
      y: value.placement?.y,
      w: (value.placement?.radius || 24) * 2,
      h: (value.placement?.radius || 24) * 2,
      parentId: value.parentOrbId,
      sourceIds: value.representation?.refs || [],
      type: "semantic-orb",
      summary: `${value.name || "Untitled orb"} · ${value.representation?.kind || "empty"}`,
    }, "semantic-orb")),
  ];
  const edges = nodes.slice(0, MAX_LIMIT).flatMap((node) => [
    ...(node.parentId ? [{ id: `${node.parentId}->${node.id}`, fromId: node.parentId, toId: node.id, kind: "parent" }] : []),
    ...(node.sourceNodeIds || []).map((sourceId) => ({ id: `${sourceId}->${node.id}`, fromId: sourceId, toId: node.id, kind: "source" })),
  ]);
  const observationInput = {
    scope,
    stateRevision,
    objects,
    edges,
    selectedIds: [...selected],
    highlightedIds: [...highlighted],
    camera,
    viewport,
    pageRef: page ? { id: page.id, version: page.version || 1 } : null,
    focus: focused,
    openEditor,
    semanticOrbId: activeSemanticOrbId,
    source: { surface: "web", authorizedScope: scope },
  };
  const observation = createWorkspaceObservation(observationInput);
  const viewportObservation = createWorkspaceObservation({ ...observationInput, scope: "viewport" });
  const paperObservation = createWorkspaceObservation({ ...observationInput, scope: "paper" });
  const selectionObservation = createWorkspaceObservation({ ...observationInput, scope: "selection" });
  const semanticOrbObservation = createWorkspaceObservation({ ...observationInput, scope: "semantic-orb", semanticOrbId: activeSemanticOrbId });
  return {
    version: 1,
    observedAt: new Date().toISOString(),
    observation,
    observations: {
      selection: selectionObservation,
      viewport: viewportObservation,
      paper: paperObservation,
      "semantic-orb": semanticOrbObservation,
    },
    scene: {
      viewport: sceneRelationships(viewportObservation),
      paper: sceneRelationships(paperObservation),
    },
    objects: objects.slice(0, 500),
    selection: objects.filter((object) => selected.has(object.id)).slice(0, MAX_LIMIT),
    highlighted: objects.filter((object) => highlighted.has(object.id)).slice(0, MAX_LIMIT),
    graph: nodes.slice(0, MAX_LIMIT).map((node) => ({
      id: node.id,
      parentId: node.parentId || null,
      sourceNodeIds: (node.sourceNodeIds || []).slice(0, 12),
    })),
    lenses: lenses.slice(0, MAX_LIMIT).map((lens) => ({
      id: lens.id,
      stableId: lens.stableId || lens.id,
      version: Number(lens.version) || 1,
      name: lens.name || lens.title || "Untitled lens",
      description: summary(lens),
      kind: lens.kind || "lens",
      tags: (lens.tags || []).slice(0, 20),
      dependencies: [...(lens.steps || []), ...(lens.dependencies || [])].slice(0, 50),
    })),
    generators: generators.slice(0, MAX_LIMIT).map((generator) => ({
      id: generator.id,
      stableId: generator.stableId || generator.id,
      version: Number(generator.version) || 1,
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
          identity: String(user.identity || "").slice(0, 120),
          role: String(user.role || "").slice(0, 120),
          goals: (user.goals || []).slice(-5).map((goal) => String(goal).slice(0, 160)),
          preferences: user.preferences || {},
          references: Object.fromEntries(Object.entries(user.references || {}).map(([kind, entries]) => [
            kind,
            (entries || []).slice(-12).map((entry) => ({
              id: entry.id || null,
              name: String(entry.name || "").slice(0, 120),
              scope: entry.scope || null,
              confidence: Number(entry.confidence) || 0,
            })),
          ])),
          actions: (user.actions || []).slice(-10).map((entry) => ({
            summary: String(entry.summary || "").slice(0, 240),
            at: entry.at || null,
          })),
          memories: (user.memories || [])
            .filter((entry) => ["workspace", "account", "anonymous"].includes(entry.scope))
            .slice(-20)
            .map((entry) => ({
              id: entry.id,
              value: String(entry.value || "").slice(0, 500),
              scope: entry.scope,
              provenance: entry.provenance,
              confidence: entry.confidence,
              expiresAt: entry.expiresAt || null,
            })),
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
  if (query === "viewport") return snapshot.observations?.viewport || snapshot.context;
  if (query === "paper") return snapshot.observations?.paper || snapshot.objects;
  if (query === "observation") return snapshot.observations?.[filter.scope || "viewport"] || snapshot.observation;
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
  if (query === "material") {
    const needle = String(filter.text || "").toLowerCase();
    return snapshot.objects
      .filter((object) => !needle || object.summary.toLowerCase().includes(needle))
      .slice(0, limit);
  }
  if (query === "dependencies") {
    const targetIds = new Set(filter.ids || [filter.id].filter(Boolean));
    return snapshot.lenses
      .filter((entry) => !targetIds.size || targetIds.has(entry.id) ||
        entry.dependencies.some((dependency) => targetIds.has(typeof dependency === "string" ? dependency : dependency.id)))
      .slice(0, limit);
  }
  if (query === "versions") {
    const targetIds = new Set(filter.ids || [filter.id].filter(Boolean));
    return [...snapshot.lenses, ...snapshot.generators]
      .filter((entry) => !targetIds.size || targetIds.has(entry.id))
      .map((entry) => ({ id: entry.id, stableId: entry.stableId || entry.id, version: entry.version || 1, name: entry.name }))
      .slice(0, limit);
  }
  if (query === "spatial") {
    let objects = snapshot.objects;
    if (filter.region) objects = objects.filter((object) => intersects(object.box, filter.region));
    return [...objects].sort((a, b) => a.box.miny - b.box.miny || a.box.minx - b.box.minx).slice(0, limit);
  }
  if (query === "temporal") {
    return [
      ...snapshot.objects.map((entry) => ({ ...entry, at: entry.createdAt })),
      ...snapshot.recentHistory.map((entry) => ({ ...entry, domain: "history", at: entry.at })),
    ].sort((a, b) => String(b.at || "").localeCompare(String(a.at || ""))).slice(0, limit);
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
    observations: {
      selection: snapshot.observations?.selection,
      viewport: snapshot.observations?.viewport,
      paper: snapshot.observations?.paper
        ? { ...snapshot.observations.paper, objects: snapshot.observations.paper.objects.slice(0, maxObjects) }
        : null,
    },
    recentHistory: snapshot.recentHistory,
    user: snapshot.user,
  });
}

import { AI_NODE_RADIUS } from "./ai-constants.js";
import { PAPER_HEIGHT, PAPER_MARGIN, PAPER_WIDTH, bboxClampOffset } from "./paper.js";

export const UNIFIED_WORKSPACE_VERSION = 4;
export const UNIFIED_WORKSPACE_KEY = "lens.scenes.v4";
export const LEGACY_UNIFIED_WORKSPACE_KEYS = Object.freeze(["lens.unified-workspace.v2"]);
export const LEGACY_AI_OFFSET = Object.freeze({ x: 820, y: 180 });
export const PAGE_CONTENT_MARGIN = PAPER_MARGIN;
export const DEFAULT_SCENE_ID = "scene-legacy";
export const DEFAULT_OUTPUT_FRAME_ID = "frame-legacy-paper";

export function defaultAiNodeRadius(node = {}) {
  return AI_NODE_RADIUS[node.nodeKind] || AI_NODE_RADIUS.source;
}

/**
 * Persistent node coordinates are always page coordinates. `customRadius`
 * is the explicit opt-out used by future resize UI; old layout radii were
 * defaults, not user sizing, so they migrate to the compact scale.
 */
export function clampAiNodeToPage(node, margin = PAGE_CONTENT_MARGIN) {
  if (!node) return node;
  const radius = node.customRadius
    ? Math.max(8, Math.min(Number(node.radius) || defaultAiNodeRadius(node), Math.min(PAPER_WIDTH, PAPER_HEIGHT) / 2 - margin))
    : defaultAiNodeRadius(node);
  const x = Math.max(margin + radius, Math.min(PAPER_WIDTH - margin - radius, Number(node.x) || 0));
  const y = Math.max(margin + radius, Math.min(PAPER_HEIGHT - margin - radius, Number(node.y) || 0));
  if (node.x === x && node.y === y && node.radius === radius) return node;
  return { ...node, x, y, radius, pageBounded: true };
}

export function clampAiNodesToPage(nodes = [], margin = PAGE_CONTENT_MARGIN) {
  return (Array.isArray(nodes) ? nodes : []).map((node) => clampAiNodeToPage(node, margin));
}

export function clampAiNodeToOutputFrame(node, frame, margin = PAGE_CONTENT_MARGIN) {
  if (!node?.frameId) return node;
  const normalizedFrame = createOutputFrame(frame);
  const radius = node.customRadius
    ? Math.max(8, Math.min(Number(node.radius) || defaultAiNodeRadius(node), Math.min(normalizedFrame.width, normalizedFrame.height) / 2 - margin))
    : defaultAiNodeRadius(node);
  const x = Math.max(
    normalizedFrame.x + margin + radius,
    Math.min(normalizedFrame.x + normalizedFrame.width - margin - radius, Number(node.x) || 0)
  );
  const y = Math.max(
    normalizedFrame.y + margin + radius,
    Math.min(normalizedFrame.y + normalizedFrame.height - margin - radius, Number(node.y) || 0)
  );
  if (node.x === x && node.y === y && node.radius === radius) return node;
  return { ...node, x, y, radius, frameBounded: true };
}

/** Conservative fallback bbox for migration before rendered measurements exist. */
export function workspaceItemBBox(item) {
  if (!item || item.type === "link") return null;
  if (item.type === "stroke") {
    if (!item.points?.length) return null;
    const half = Math.max(1, Number(item.width) || 2.4) / 2;
    const xs = item.points.map((point) => Number(point.x) || 0);
    const ys = item.points.map((point) => Number(point.y) || 0);
    return {
      minx: Math.min(...xs) - half,
      miny: Math.min(...ys) - half,
      maxx: Math.max(...xs) + half,
      maxy: Math.max(...ys) + half,
    };
  }
  const scale = Math.max(0.05, Number(item.scale) || 1);
  const w = Math.max(1, Number(item.w) || (item.type === "image" ? 200 : 320)) * scale;
  const fallbackHeight =
    item.type === "image" ? Math.round((Number(item.w) || 200) * 0.75) :
      item.type === "voice" ? 56 :
        item.type === "video" ? 158 :
          item.type === "diagram" ? 160 :
            72;
  const h = Math.max(1, Number(item.h) || fallbackHeight) * scale;
  const angle = ((Number(item.rotation) || 0) * Math.PI) / 180;
  const rw = Math.abs(Math.cos(angle)) * w + Math.abs(Math.sin(angle)) * h;
  const rh = Math.abs(Math.sin(angle)) * w + Math.abs(Math.cos(angle)) * h;
  const cx = (Number(item.x) || 0) + (Math.max(1, Number(item.w) || (item.type === "image" ? 200 : 320))) / 2;
  const cy = (Number(item.y) || 0) + (Math.max(1, Number(item.h) || fallbackHeight)) / 2;
  return { minx: cx - rw / 2, miny: cy - rh / 2, maxx: cx + rw / 2, maxy: cy + rh / 2 };
}

export function clampWorkspaceItem(item, getBBox = workspaceItemBBox, margin = PAGE_CONTENT_MARGIN) {
  if (!item || item.type === "link") return item;
  let next = item;
  let bb = getBBox(next);
  if (!bb) return next;
  const maxW = PAPER_WIDTH - margin * 2;
  const maxH = PAPER_HEIGHT - margin * 2;
  const width = bb.maxx - bb.minx;
  const height = bb.maxy - bb.miny;
  if (width > maxW || height > maxH) {
    if (next.type === "stroke" && next.points?.length) {
      const clearance = Math.max(1, Number(next.width) || 2.4);
      const pointW = Math.max(1, width - clearance);
      const pointH = Math.max(1, height - clearance);
      const fit = Math.min(
        (maxW - clearance) / pointW,
        (maxH - clearance) / pointH,
        1
      );
      const cx = (bb.minx + bb.maxx) / 2;
      const cy = (bb.miny + bb.maxy) / 2;
      next = {
        ...next,
        points: next.points.map((point) => ({
          ...point,
          x: cx + (point.x - cx) * fit,
          y: cy + (point.y - cy) * fit,
        })),
      };
    } else {
      const fit = Math.min(maxW / Math.max(width, 1), maxH / Math.max(height, 1));
      next = { ...next, scale: Math.max(0.05, (Number(next.scale) || 1) * fit) };
    }
    bb = getBBox(next) || workspaceItemBBox(next);
  }
  const { dx, dy } = bboxClampOffset(bb, margin, { forceBounds: true });
  if (!dx && !dy) return next;
  if (next.type === "stroke" && next.points?.length) {
    return { ...next, points: next.points.map((point) => ({ ...point, x: point.x + dx, y: point.y + dy })) };
  }
  return { ...next, x: (Number(next.x) || 0) + dx, y: (Number(next.y) || 0) + dy };
}

export function clampWorkspaceItems(items = [], getBBox = workspaceItemBBox, margin = PAGE_CONTENT_MARGIN) {
  return (Array.isArray(items) ? items : []).map((item) => clampWorkspaceItem(item, getBBox, margin));
}

function finiteCamera(camera) {
  if (!camera || !Number.isFinite(camera.x) || !Number.isFinite(camera.y) || !Number.isFinite(camera.scale)) {
    return { x: 80, y: 56, scale: 0.72 };
  }
  return { x: camera.x, y: camera.y, scale: camera.scale };
}

export function createOutputFrame(value = {}) {
  return {
    id: value.id || DEFAULT_OUTPUT_FRAME_ID,
    kind: "output-frame",
    format: value.format || "paper",
    name: value.name || "Legacy Paper",
    x: Number.isFinite(value.x) ? value.x : 0,
    y: Number.isFinite(value.y) ? value.y : 0,
    width: Math.max(120, Number(value.width) || PAPER_WIDTH),
    height: Math.max(120, Number(value.height) || PAPER_HEIGHT),
    hidden: Boolean(value.hidden),
    legacyCompatible: value.legacyCompatible !== false,
    ...value,
  };
}

export function createScene(value = {}) {
  const frames = Array.isArray(value.frames) ? value.frames.map(createOutputFrame) : [];
  return {
    ...value,
    version: UNIFIED_WORKSPACE_VERSION,
    id: value.id || DEFAULT_SCENE_ID,
    kind: "scene",
    name: value.name || "Untitled Scene",
    world: { background: "black", unbounded: true, ...(value.world || {}) },
    frames,
    items: Array.isArray(value.items) ? value.items : [],
    nodes: Array.isArray(value.nodes) ? value.nodes : [],
    orbInstances: Array.isArray(value.orbInstances) ? value.orbInstances : [],
    camera: finiteCamera(value.camera),
    workingSet: {
      context: [],
      lenses: [],
      selections: [],
      branches: [],
      checkpoints: [],
      ...(value.workingSet || {}),
    },
    metadata: { createdFrom: "explicit", ...(value.metadata || {}) },
    frames,
  };
}

export function selectSceneWorkspace(workspace, sceneId, { createIfMissing = false } = {}) {
  const source = migrateUnifiedWorkspace({ unified: workspace });
  const requestedId = sceneId || source.activeSceneId;
  let scenes = source.scenes || [];
  let scene = scenes.find((entry) => entry.id === requestedId);
  if (!scene && createIfMissing && requestedId) {
    scene = createScene({
      id: requestedId,
      name: requestedId === DEFAULT_SCENE_ID ? "Migrated Scene" : "Untitled Scene",
      metadata: { createdFrom: "explicit-scene-route" },
    });
    scenes = [...scenes, scene];
  }
  scene ||= scenes.find((entry) => entry.id === source.activeSceneId) || scenes[0] || null;
  if (!scene) return source;
  return {
    ...source,
    scenes,
    activeSceneId: scene.id,
    items: scene.items || [],
    nodes: scene.nodes || [],
    frames: scene.frames || [],
    orbInstances: scene.orbInstances || [],
    workingSet: scene.workingSet || {},
    camera: finiteCamera(scene.camera),
  };
}

export function clampItemToOutputFrame(item, frame, getBBox = workspaceItemBBox, margin = PAGE_CONTENT_MARGIN) {
  if (!item?.frameId) return item;
  const normalizedFrame = createOutputFrame(frame);
  const local = {
    ...item,
    x: (Number(item.x) || 0) - normalizedFrame.x,
    y: (Number(item.y) || 0) - normalizedFrame.y,
  };
  const clamped = clampWorkspaceItem(local, getBBox, margin);
  return {
    ...clamped,
    x: (Number(clamped.x) || 0) + normalizedFrame.x,
    y: (Number(clamped.y) || 0) + normalizedFrame.y,
    frameId: normalizedFrame.id,
  };
}

function legacyFrameItems(items, frame, sceneId = DEFAULT_SCENE_ID) {
  return clampWorkspaceItems(items).map((item) => ({ ...item, frameId: frame.id, sceneId }));
}

function legacyFrameNodes(nodes, alreadyUnified, frameId = DEFAULT_OUTPUT_FRAME_ID, sceneId = DEFAULT_SCENE_ID) {
  return nodes.map((node) =>
    clampAiNodeToPage({
      ...node,
      x: (Number.isFinite(node.x) ? node.x : 0) + (alreadyUnified ? 0 : LEGACY_AI_OFFSET.x),
      y: (Number.isFinite(node.y) ? node.y : 0) + (alreadyUnified ? 0 : LEGACY_AI_OFFSET.y),
      unifiedWorldVersion: UNIFIED_WORKSPACE_VERSION,
      frameId,
      sceneId,
    })
  );
}

/**
 * Copies the two legacy stores into one coordinate system. Legacy values are
 * inputs only: callers keep those keys intact as recovery sources.
 */
export function migrateUnifiedWorkspace({ items = [], nodes = [], pages = [], activePageId = null, camera = null, unified = null } = {}) {
  if (unified?.version === UNIFIED_WORKSPACE_VERSION) {
    const scenes = Array.isArray(unified.scenes)
      ? unified.scenes.map((scene) => createScene(scene))
      : [createScene({ ...unified, id: unified.activeSceneId || DEFAULT_SCENE_ID })];
    const activeSceneId = unified.activeSceneId || scenes[0]?.id || null;
    const activeScene = scenes.find((scene) => scene.id === activeSceneId) || scenes[0] || null;
    return {
      ...unified,
      scenes,
      activeSceneId,
      items: Array.isArray(activeScene?.items) ? activeScene.items : (Array.isArray(unified.items) ? unified.items : items),
      nodes: Array.isArray(activeScene?.nodes) ? activeScene.nodes : (Array.isArray(unified.nodes) ? unified.nodes : nodes),
      frames: activeScene?.frames || unified.frames || [],
      orbInstances: activeScene?.orbInstances || unified.orbInstances || [],
      workingSet: activeScene?.workingSet || unified.workingSet || {},
      camera: finiteCamera(activeScene?.camera || unified.camera || camera),
    };
  }

  const sourceItems = Array.isArray(unified?.items) ? unified.items : items;
  const sourceNodes = Array.isArray(unified?.nodes) ? unified.nodes : nodes;
  const alreadyUnified = Number(unified?.version) >= 2;
  const pageIds = [...new Set([
    ...(Array.isArray(pages) ? pages.map((page) => page?.id) : []),
    ...sourceItems.map((item) => item?.pageId),
    ...sourceNodes.map((node) => node?.pageId),
  ].filter(Boolean))];
  const pageRecords = pageIds.length
    ? pageIds.map((id, index) => {
        const page = pages.find((entry) => entry?.id === id);
        return { id, name: page?.name || `World ${index + 1}`, camera: page?.camera || null };
      })
    : [{ id: "page-1", name: unified?.name || "Migrated Scene", camera: null }];
  const scenes = pageRecords.map((page, index) => {
    const sceneId = index === 0 ? (unified?.activeSceneId || DEFAULT_SCENE_ID) : `scene-legacy:${page.id}`;
    const frameId = index === 0 ? (unified?.frames?.[0]?.id || DEFAULT_OUTPUT_FRAME_ID) : `frame-legacy-paper:${page.id}`;
    const frame = createOutputFrame({
      id: frameId,
      name: page.name || `Legacy Paper ${index + 1}`,
      metadata: { migrationSourceVersion: Number(unified?.version) || 1, legacyPageId: page.id },
    });
    const pageItems = sourceItems.filter((item) => (item.pageId || pageRecords[0].id) === page.id);
    const pageNodes = sourceNodes.filter((node) => (node.pageId || pageRecords[0].id) === page.id);
    return createScene({
      ...(index === 0 ? (unified || {}) : {}),
      id: sceneId,
      name: page.name || `Migrated Scene ${index + 1}`,
      frames: [frame],
      items: legacyFrameItems(pageItems, frame, sceneId),
      nodes: legacyFrameNodes(pageNodes, alreadyUnified, frame.id, sceneId),
      camera: finiteCamera(page.camera || (index === 0 ? unified?.camera || camera : null)),
      orbInstances: index === 0 ? unified?.orbInstances || [] : [],
      workingSet: {
        context: [],
        lenses: [],
        selections: index === 0 ? unified?.selection || [] : [],
        branches: [],
        checkpoints: index === 0 ? unified?.history || [] : [],
        ...(index === 0 ? unified?.workingSet || {} : {}),
      },
      metadata: {
        ...(index === 0 ? unified?.metadata || {} : {}),
        createdFrom: "legacy-page-migration",
        legacyPageId: page.id,
        migrationSourceVersion: Number(unified?.version) || 1,
      },
    });
  });
  const requestedIndex = Math.max(0, pageRecords.findIndex((page) => page.id === activePageId));
  const scene = scenes[requestedIndex] || scenes[0];
  const migratedItems = scene.items;
  const migratedNodes = scene.nodes;
  return {
    ...(unified || {}),
    version: UNIFIED_WORKSPACE_VERSION,
    migratedAt: new Date().toISOString(),
    activeSceneId: scene.id,
    scenes,
    frames: scene.frames,
    camera: scene.camera,
    items: migratedItems,
    nodes: migratedNodes,
    orbInstances: scene.orbInstances,
    workingSet: scene.workingSet,
  };
}

export function serializeUnifiedWorkspace({ items, nodes, camera, scenes, activeSceneId, frames, orbInstances, workingSet, ...safeFields }) {
  const sceneId = activeSceneId || scenes?.[0]?.id || DEFAULT_SCENE_ID;
  const sceneList = Array.isArray(scenes) && scenes.length
    ? scenes.map((scene) => scene.id === sceneId ? createScene({ ...scene, items, nodes, camera, frames: frames || scene.frames, orbInstances: orbInstances || scene.orbInstances, workingSet: workingSet || scene.workingSet }) : createScene(scene))
    : [createScene({ id: sceneId, items, nodes, camera, frames: frames || [], orbInstances, workingSet })];
  return JSON.stringify({
    ...safeFields,
    version: UNIFIED_WORKSPACE_VERSION,
    savedAt: new Date().toISOString(),
    activeSceneId: sceneId,
    scenes: sceneList,
    camera: finiteCamera(camera),
    items: Array.isArray(items) ? items : [],
    nodes: Array.isArray(nodes) ? nodes : [],
    frames: sceneList.find((scene) => scene.id === sceneId)?.frames || [],
    orbInstances: Array.isArray(orbInstances) ? orbInstances : [],
    workingSet: workingSet || {},
  });
}

export function worldPoint(camera, screenX, screenY) {
  return {
    x: (screenX - camera.x) / camera.scale,
    y: (screenY - camera.y) / camera.scale,
  };
}

export function hitUnifiedMaterial({ point, items = [], nodes = [], itemBBox, nodePad = 0 }) {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i];
    const radius = (node.radius || 20) + nodePad;
    if (Math.hypot(point.x - node.x, point.y - node.y) <= radius) {
      return { domain: "node", id: node.id, value: node };
    }
  }
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    const box = itemBBox?.(item);
    if (
      box &&
      point.x >= box.minx &&
      point.x <= box.maxx &&
      point.y >= box.miny &&
      point.y <= box.maxy
    ) {
      return { domain: "paper", id: item.id, value: item };
    }
  }
  return null;
}

/** Explicit precedence shared by UI tests and the input adapters. */
export function routeUnifiedGesture({ tool, hit, zone = "core", shiftKey = false, altKey = false, dragged = false }) {
  if (tool === "pen" || tool === "marker") return "draw";
  if (tool === "eraser") return "erase";
  if (tool === "highlight") return hit ? `highlight-${hit.domain}` : "highlight-stroke";
  if (altKey || (!hit && dragged)) return "pan";
  if (shiftKey && !hit) return "lasso";
  if (hit?.domain === "node") return zone === "edge" ? "node-operation-chooser" : "move-node";
  if (hit?.domain === "paper") return "move-paper";
  return dragged ? "lasso" : "create-text";
}

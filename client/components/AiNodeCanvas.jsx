import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  attachPointOnNode,
  collectAiEdges,
  edgeBundleOffsets,
  edgeGeometry,
  fanStrandAngles,
  pickStrandIndex,
  truncateLabel,
} from "../lib/ai-nodes.js";
import {
  AI_DOT_ONLY_THRESHOLD,
  AI_BLEND_ZOOM_START,
  nodeTextLayoutAtBlend,
  screenToWorld,
  viewportCenterWorld,
  worldToScreen,
  zoomContentBlend,
} from "../lib/ai-space.js";
import { attachCanvasWheel } from "../lib/canvas-navigation.js";
import {
  aiNodeHighlightDraggable,
  aiNodeHighlightMarkable,
  HIGHLIGHT_DRAG_THRESHOLD,
} from "../lib/highlight-tool.js";
import FragmentHighlightLayer from "./FragmentHighlightLayer.jsx";

const AI_OUTPUT_MIME = "application/lens-ai-output";
const NODE_DRAG_THRESHOLD = 8;
const STRAND_DRAG_THRESHOLD = 4;
const STRAND_MIN_LENGTH = 52;
const STRAND_MAX_LENGTH = 148;
const STRAND_TIP_HIT = 36;
const NODE_EDGE_BAND_PX = 10;
const NODE_EDGE_BAND_RATIO = 0.24;

function pointerHitZone(clientX, clientY, node, camera, viewportRect) {
  if (!viewportRect) return { onEdge: false, inNode: true };
  const screen = worldToScreen(camera, node.x, node.y);
  const screenX = screen.x + viewportRect.left;
  const screenY = screen.y + viewportRect.top;
  const screenR = (node.radius || 20) * camera.scale;
  const dist = Math.hypot(clientX - screenX, clientY - screenY);
  const edgePx = Math.max(NODE_EDGE_BAND_PX, screenR * NODE_EDGE_BAND_RATIO);
  return {
    onEdge: dist >= screenR - edgePx,
    inNode: dist < screenR - edgePx,
  };
}

export default function AiNodeCanvas({
  nodes,
  camera,
  onCameraChange,
  selectedIds = [],
  onSelect,
  onMove,
  onExpandNode,
  onExploreNode,
  onReturnToConstellation,
  onFocusFromZoom,
  focusedNodeId,
  getStrandChoices,
  onStrandSelect,
  onCanvasDrop,
  onCanvasDragOver,
  onCanvasDragLeave,
  canvasDropOver,
  tool = "select",
  onSpaceTransferStart,
  onHighlightTransferStart,
  onFragmentReplace,
  onFragmentToPaper,
  isPaperDestination,
  shouldHandoffNodeDrag,
  viewportRef: externalViewportRef,
  onTourEvent,
  landingNodeIds,
  onPointerTrack,
}) {
  const localViewportRef = useRef(null);
  const viewportRef = externalViewportRef || localViewportRef;
  const dragRef = useRef(null);
  const panRef = useRef(null);
  const lassoRef = useRef(null);
  const cameraRef = useRef(camera);
  cameraRef.current = camera;
  const [panning, setPanning] = useState(false);
  const [shiftHeld, setShiftHeld] = useState(false);
  const [vpSize, setVpSize] = useState({ w: 320, h: 240 });
  const [lasso, setLasso] = useState(null);
  const [strandTip, setStrandTip] = useState(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState(null);
  const [strandDrag, setStrandDrag] = useState(null);
  const strandDragRef = useRef(null);
  strandDragRef.current = strandDrag;
  const knownNodeIdsRef = useRef(null);
  const [bornIds, setBornIds] = useState(() => new Set());
  const [wheelZooming, setWheelZooming] = useState(false);
  const [hoverPreview, setHoverPreview] = useState(null);

  // New nodes glow gold, then fade to stardust white over ~5s.
  useEffect(() => {
    if (!knownNodeIdsRef.current) {
      knownNodeIdsRef.current = new Set(nodes.map((n) => n.id));
      return;
    }
    const fresh = nodes.filter((n) => !knownNodeIdsRef.current.has(n.id)).map((n) => n.id);
    if (!fresh.length) return;
    fresh.forEach((id) => knownNodeIdsRef.current.add(id));
    setBornIds((prev) => new Set([...prev, ...fresh]));
    window.setTimeout(() => {
      setBornIds((prev) => {
        const next = new Set(prev);
        fresh.forEach((id) => next.delete(id));
        return next;
      });
    }, 5200);
  }, [nodes]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Shift") setShiftHeld(true);
    };
    const onKeyUp = (e) => {
      if (e.key === "Shift") setShiftHeld(false);
    };
    const onBlur = () => setShiftHeld(false);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setVpSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setVpSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [viewportRef]);

  const getDropWorld = useCallback(
    (clientX, clientY) => {
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return viewportCenterWorld(camera, vpSize.w, vpSize.h);
      return screenToWorld(camera, clientX - rect.left, clientY - rect.top);
    },
    [camera, vpSize.w, vpSize.h, viewportRef]
  );

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    return attachCanvasWheel(
      el,
      () => cameraRef.current,
      (next) => onCameraChange?.(next),
      (e) => {
        const rect = el.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
      },
      undefined,
      {
        onWheelActive: () => setWheelZooming(true),
        onWheelIdle: () => setWheelZooming(false),
      }
    );
  }, [onCameraChange, viewportRef]);

  function startPan(e) {
    if (e.button !== 0 && e.button !== 1) return;
    if (dragRef.current || lassoRef.current) return;
    e.preventDefault();
    setPanning(true);
    try {
      viewportRef.current?.setPointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
    panRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      cam: { ...cameraRef.current },
      tourEmitted: false,
    };

    function handlePanMove(ev) {
      if (!panRef.current) return;
      if (!panRef.current.tourEmitted) {
        panRef.current.tourEmitted = true;
        onTourEvent?.("ai-pan");
      }
      const dx = ev.clientX - panRef.current.startX;
      const dy = ev.clientY - panRef.current.startY;
      onCameraChange?.({
        ...panRef.current.cam,
        x: panRef.current.cam.x + dx,
        y: panRef.current.cam.y + dy,
      });
    }

    function handlePanEnd(ev) {
      panRef.current = null;
      setPanning(false);
      try {
        viewportRef.current?.releasePointerCapture?.(ev.pointerId);
      } catch {
        /* ignore */
      }
      window.removeEventListener("pointermove", handlePanMove);
      window.removeEventListener("pointerup", handlePanEnd);
      window.removeEventListener("pointercancel", handlePanEnd);
    }

    window.addEventListener("pointermove", handlePanMove);
    window.addEventListener("pointerup", handlePanEnd);
    window.addEventListener("pointercancel", handlePanEnd);
  }

  function finishLasso(x0, y0, x1, y1) {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    const L = Math.min(x0, x1);
    const R = Math.max(x0, x1);
    const T = Math.min(y0, y1);
    const B = Math.max(y0, y1);
    if (Math.abs(R - L) < 4 && Math.abs(B - T) < 4) return;
    const picked = nodes.filter((node) => {
      const r = node.radius || 40;
      const sx = rect.left + camera.x + node.x * camera.scale;
      const sy = rect.top + camera.y + node.y * camera.scale;
      const sr = r * camera.scale;
      return sx + sr > L && sx - sr < R && sy + sr > T && sy - sr < B;
    });
    if (picked.length) {
      onSelect?.(picked.map((n) => n.id), { replace: true });
    }
  }

  function startLasso(e) {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    const lx = e.clientX - rect.left;
    const ly = e.clientY - rect.top;
    lassoRef.current = { x0: lx, y0: ly, x1: lx, y1: ly, rectLeft: rect.left, rectTop: rect.top };
    setLasso({ x0: lx, y0: ly, x1: lx, y1: ly });

    function handleLassoMove(ev) {
      if (!lassoRef.current) return;
      lassoRef.current.x1 = ev.clientX - lassoRef.current.rectLeft;
      lassoRef.current.y1 = ev.clientY - lassoRef.current.rectTop;
      setLasso({ x0: lassoRef.current.x0, y0: lassoRef.current.y0, x1: lassoRef.current.x1, y1: lassoRef.current.y1 });
    }

    function handleLassoEnd() {
      if (lassoRef.current) {
        const r = lassoRef.current;
        finishLasso(
          r.rectLeft + Math.min(r.x0, r.x1),
          r.rectTop + Math.min(r.y0, r.y1),
          r.rectLeft + Math.max(r.x0, r.x1),
          r.rectTop + Math.max(r.y0, r.y1)
        );
      }
      lassoRef.current = null;
      setLasso(null);
      window.removeEventListener("pointermove", handleLassoMove);
      window.removeEventListener("pointerup", handleLassoEnd);
      window.removeEventListener("pointercancel", handleLassoEnd);
    }

    window.addEventListener("pointermove", handleLassoMove);
    window.addEventListener("pointerup", handleLassoEnd);
    window.addEventListener("pointercancel", handleLassoEnd);
  }

  function startStrandDrag(e, node, seedX = e.clientX, seedY = e.clientY) {
    if (e.button !== 0) return;
    if (e.shiftKey && tool === "select" && selectedIds.length) {
      e.preventDefault();
      e.stopPropagation();
      onSpaceTransferStart?.(e);
      return;
    }
    e.stopPropagation();

    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;

    const pool = getStrandChoices?.(node) || [];
    const choices = pool;
    if (!choices.length) return;

    const startX = seedX;
    const startY = seedY;

    const towardWorld = screenToWorld(cameraRef.current, startX - rect.left, startY - rect.top);
    const attach = attachPointOnNode(node, towardWorld.x, towardWorld.y, {
      invScale,
      cellWeight: 1 + Math.min(nodes.filter((n) => n.parentId === node.id).length, 3) * 0.14,
    });
    const attachScreen = worldToScreen(cameraRef.current, attach.x, attach.y);
    const originX = attachScreen.x;
    const originY = attachScreen.y;

    const dragState = {
      nodeId: node.id,
      originX,
      originY,
      rectLeft: rect.left,
      rectTop: rect.top,
      choices,
      length: 0,
      baseAngle: 0,
      hoverIdx: -1,
      active: false,
      startedAt: performance.now(),
    };
    strandDragRef.current = dragState;
    setStrandDrag({ ...dragState });
    document.body.classList.add("ai-strand-dragging");

    const captureTarget = e.currentTarget;
    let captured = false;

    function ensureCapture(ev) {
      if (captured || !captureTarget) return;
      captured = true;
      try {
        captureTarget.setPointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }
    }

    function updateFromPointer(clientX, clientY, moveEv) {
      const state = strandDragRef.current;
      if (!state) return;
      const px = clientX - state.rectLeft;
      const py = clientY - state.rectTop;
      const dx = px - state.originX;
      const dy = py - state.originY;
      const dist = Math.hypot(dx, dy);
      if (!state.active && dist <= STRAND_DRAG_THRESHOLD) return;
      if (moveEv) ensureCapture(moveEv);

      const length = Math.min(STRAND_MAX_LENGTH, Math.max(STRAND_MIN_LENGTH, dist));
      const baseAngle = Math.atan2(dy, dx);
      const angles = fanStrandAngles(state.choices.length, baseAngle);
      const pointerAngle = baseAngle;
      const hoverIdx = pickStrandIndex(pointerAngle, angles);

      const next = {
        ...state,
        active: true,
        length,
        baseAngle,
        angles,
        hoverIdx,
        pointerX: clientX,
        pointerY: clientY,
      };
      if (!state.active) onTourEvent?.("strand-drag");
      strandDragRef.current = next;
      setStrandDrag(next);
    }

    function finishStrandDrag(ev) {
      const state = strandDragRef.current;
      strandDragRef.current = null;
      setStrandDrag(null);
      document.body.classList.remove("ai-strand-dragging");

      try {
        if (captured) captureTarget.releasePointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }
      window.removeEventListener("pointermove", handleStrandMove);
      window.removeEventListener("pointerup", handleStrandEnd);
      window.removeEventListener("pointercancel", handleStrandEnd);

      if (!state?.active) return;

      const rectNow = viewportRef.current?.getBoundingClientRect();
      if (!rectNow) return;

      let pickIdx = state.hoverIdx;
      if (pickIdx < 0 && state.angles?.length) {
        pickIdx = pickStrandIndex(state.baseAngle, state.angles);
      }

      if (state.angles?.length) {
        let bestIdx = -1;
        let bestD = STRAND_TIP_HIT;
        const px = ev.clientX - rectNow.left;
        const py = ev.clientY - rectNow.top;
        for (let i = 0; i < state.angles.length; i++) {
          const tipX = state.originX + Math.cos(state.angles[i]) * state.length;
          const tipY = state.originY + Math.sin(state.angles[i]) * state.length;
          const d = Math.hypot(px - tipX, py - tipY);
          if (d < bestD) {
            bestD = d;
            bestIdx = i;
          }
        }
        if (bestIdx >= 0) pickIdx = bestIdx;
      }

      const choice = state.choices[pickIdx];
      if (choice) {
        const cam = cameraRef.current;
        const tipIdx = pickIdx >= 0 ? pickIdx : 0;
        const angle = state.angles?.[tipIdx] ?? state.baseAngle ?? 0;
        const tipScreenX = state.originX + Math.cos(angle) * state.length;
        const tipScreenY = state.originY + Math.sin(angle) * state.length;
        const worldPos = screenToWorld(cam, tipScreenX, tipScreenY);
        onStrandSelect?.(state.nodeId, choice, { worldPos });
      }
    }

    function handleStrandMove(ev) {
      updateFromPointer(ev.clientX, ev.clientY, ev);
    }

    function handleStrandEnd(ev) {
      finishStrandDrag(ev);
    }

    window.addEventListener("pointermove", handleStrandMove);
    window.addEventListener("pointerup", handleStrandEnd);
    window.addEventListener("pointercancel", handleStrandEnd);
  }

  function startEdgeStrandGesture(e, node) {
    if (e.button !== 0) return;
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    let activated = false;

    function onMove(ev) {
      if (activated) return;
      const dist = Math.hypot(ev.clientX - startX, ev.clientY - startY);
      if (dist <= STRAND_DRAG_THRESHOLD) return;
      activated = true;
      cleanup();
      startStrandDrag(e, node, startX, startY);
      const state = strandDragRef.current;
      if (state) {
        const px = ev.clientX - state.rectLeft;
        const py = ev.clientY - state.rectTop;
        const dx = px - state.originX;
        const dy = py - state.originY;
        const distNow = Math.hypot(dx, dy);
        const length = Math.min(STRAND_MAX_LENGTH, Math.max(STRAND_MIN_LENGTH, distNow));
        const baseAngle = Math.atan2(dy, dx);
        const angles = fanStrandAngles(state.choices.length, baseAngle);
        const hoverIdx = pickStrandIndex(baseAngle, angles);
        const next = {
          ...state,
          active: true,
          length,
          baseAngle,
          angles,
          hoverIdx,
          pointerX: ev.clientX,
          pointerY: ev.clientY,
        };
        onTourEvent?.("strand-drag");
        strandDragRef.current = next;
        setStrandDrag(next);
      }
    }

    function onUp() {
      cleanup();
      if (!activated) {
        onSelect?.(node.id, { replace: true });
        // Click opens the node like a chat message: zoom to its content card.
        onExploreNode?.(node.id);
      }
    }

    function cleanup() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  function startHighlightTransfer(e, node, opts = {}) {
    const fragment = opts.fragment || node.goldenFragment?.trim() || null;
    onHighlightTransferStart?.(e, [node.id], { immediate: true, fragment });
  }

  function startFragmentGrab(e, node) {
    e.preventDefault();
    e.stopPropagation();
    onSelect?.(node.id, { replace: true });
    startHighlightTransfer(e, node);
  }

  function startNodePositionDrag(e, node) {
    if (e.shiftKey && tool === "select" && selectedIds.length) {
      e.preventDefault();
      e.stopPropagation();
      onSpaceTransferStart?.(e);
      return;
    }
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const pending = { nodeId: node.id, startX, startY, scale: camera.scale };
    let dragging = false;
    let handoff = false;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }

    function cleanupDragListeners() {
      window.removeEventListener("pointermove", handleDragMove);
      window.removeEventListener("pointerup", handleDragEnd);
      window.removeEventListener("pointercancel", handleDragEnd);
    }

    function handleDragMove(ev) {
      if (handoff) return;
      if (!dragging) {
        const dist = Math.hypot(ev.clientX - startX, ev.clientY - startY);
        if (dist <= NODE_DRAG_THRESHOLD) return;
        dragging = true;
        dragRef.current = pending;
        document.body.classList.add("ai-node-dragging");
        ev.preventDefault();
      }
      if (!dragRef.current) return;

      if (shouldHandoffNodeDrag?.(ev.clientX, ev.clientY)) {
        handoff = true;
        dragRef.current = null;
        document.body.classList.remove("ai-node-dragging");
        cleanupDragListeners();
        try {
          e.currentTarget.releasePointerCapture(ev.pointerId);
        } catch {
          /* ignore */
        }
        onSpaceTransferStart?.(ev, [node.id], { immediate: true });
        return;
      }

      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;
      const world = screenToWorld(cameraRef.current, ev.clientX - rect.left, ev.clientY - rect.top);
      onMove?.(dragRef.current.nodeId, world.x, world.y);
    }

    function handleDragEnd(ev) {
      if (handoff) return;
      if (!dragging) {
        const dist = Math.hypot(ev.clientX - startX, ev.clientY - startY);
        if (dist <= NODE_DRAG_THRESHOLD) {
          onSelect?.(node.id, { replace: true });
          if (tool !== "highlight") {
            onExploreNode?.(node.id);
          }
        }
      }
      dragRef.current = null;
      document.body.classList.remove("ai-node-dragging");
      try {
        e.currentTarget.releasePointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }
      cleanupDragListeners();
    }

    window.addEventListener("pointermove", handleDragMove);
    window.addEventListener("pointerup", handleDragEnd);
    window.addEventListener("pointercancel", handleDragEnd);
  }

  function startHighlightNodeDrag(e, node) {
    if (e.target.closest(".fragment-highlight-layer")) return;

    onSelect?.(node.id, { replace: true });

    if (!aiNodeHighlightDraggable(node)) {
      e.preventDefault();
      e.stopPropagation();
      const canExpand =
        (node.nodeKind === "source" || node.nodeKind === "session") &&
        node.sourceIds?.length &&
        !node.loading;
      if (canExpand && !node.expandedText) onExpandNode?.(node.id);
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    const golden = node.goldenFragment?.trim() || null;
    const startX = e.clientX;
    const startY = e.clientY;
    let armed = false;

    function onMove(ev) {
      if (armed) return;
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) <= HIGHLIGHT_DRAG_THRESHOLD) return;
      armed = true;
      cleanup();
      startHighlightTransfer(ev, node, { fragment: golden });
    }

    function onUp() {
      cleanup();
    }

    function cleanup() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  function startNodeDrag(e, node) {
    if (e.button !== 0) return;

    if (tool === "highlight") {
      startHighlightNodeDrag(e, node);
      return;
    }

    const rect = viewportRef.current?.getBoundingClientRect();
    const hit = pointerHitZone(e.clientX, e.clientY, node, cameraRef.current, rect);
    const strandChoices = getStrandChoices?.(node) || [];
    if (tool === "select" && hit.onEdge && strandChoices.length) {
      startEdgeStrandGesture(e, node);
      return;
    }

    startNodePositionDrag(e, node);
  }

  function handleViewportPointerDown(e) {
    if (e.target.closest?.(".ai-node")) return;
    if (e.target.closest?.(".ai-explore-overlay-inner")) return;
    if (e.target.closest?.(".ai-strand-setting")) return;
    if (e.target.closest?.(".ai-node-fragment-panel")) return;

    if (e.shiftKey && tool === "select" && selectedIds.length) {
      onSpaceTransferStart?.(e);
      return;
    }

    if (e.button === 1 || e.altKey) {
      startPan(e);
      return;
    }

    if (e.button !== 0) return;

    if (tool === "highlight" && selectedIds.length) {
      onHighlightTransferStart?.(e, selectedIds, { immediate: false });
      return;
    }

    if (tool === "select" && e.shiftKey) {
      startLasso(e);
      return;
    }

    startPan(e);
  }

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const edges = collectAiEdges(nodes)
    .map((edge) => ({
      ...edge,
      from: nodeById.get(edge.fromId),
      to: nodeById.get(edge.toId),
    }))
    .filter((e) => e.from && e.to);
  const bundleOffsets = edgeBundleOffsets(edges);

  const contentBlend = zoomContentBlend(camera.scale);
  const invScale = 1 / Math.max(0.08, camera.scale);
  const edgeStroke = 2.6 * invScale;
  const markerSize = Math.min(14 * invScale, Math.max(7 * invScale, 5 * invScale));
  const zoomTier =
    camera.scale < AI_DOT_ONLY_THRESHOLD
      ? "dot"
      : camera.scale < AI_BLEND_ZOOM_START
        ? "short"
        : "full";

  function updateNodeCursor(e, node) {
    const rect = viewportRef.current?.getBoundingClientRect();
    const hit = pointerHitZone(e.clientX, e.clientY, node, cameraRef.current, rect);
    const strandChoices = getStrandChoices?.(node) || [];
    e.currentTarget.style.cursor =
      tool === "highlight"
        ? "grab"
        : tool === "select" && hit.onEdge && strandChoices.length
          ? "crosshair"
          : "grab";
  }

  function nodeDetailText(node) {
    return (
      node?.expandedText?.trim() ||
      node?.preview?.trim() ||
      node?.label?.trim() ||
      null
    );
  }

  function nodePreviewSnippet(node, maxLen = 140) {
    const raw = nodeDetailText(node);
    if (!raw) return "";
    const flat = raw.replace(/^#+\s*/gm, "").replace(/\s+/g, " ").trim();
    const sentences = flat.match(/[^.!?]+[.!?]+/g) || [flat];
    const couple = sentences.slice(0, 2).join(" ").trim();
    const text = couple || flat;
    return text.length > maxLen ? `${text.slice(0, maxLen - 1)}…` : text;
  }

  function showNodeHoverPreview(node, clientX, clientY) {
    if (contentBlend > 0.15) {
      setHoverPreview(null);
      return;
    }
    const text = nodePreviewSnippet(node);
    if (!text) return;
    setHoverPreview({ id: node.id, text, x: clientX, y: clientY });
  }

  function nodeEdgeView(node) {
    const r = node.radius || 20;
    const childCount = nodes.filter((n) => n.parentId === node.id).length;
    const detail = nodeDetailText(node);
    const blend = detail ? contentBlend : 0;
    return {
      invScale,
      cellWeight: 1 + Math.min(childCount * 0.14, 0.5),
      contentBlend: blend,
      textLayout: detail ? nodeTextLayoutAtBlend(r, detail.length, blend, detail) : null,
    };
  }

  function renderNodeText(node, text) {
    const golden = node?.goldenFragment;
    if (!golden || !text.includes("⟦") || !text.includes("⟧")) {
      return text;
    }
    const parts = text.split(/(⟦[^⟧]+⟧)/g);
    return parts.map((part, i) => {
      if (part.startsWith("⟦") && part.endsWith("⟧")) {
        return (
          <mark
            key={i}
            className="ai-golden-fragment"
            onPointerDown={(ev) => {
              if (tool === "highlight" || tool === "select") startFragmentGrab(ev, node);
            }}
          >
            {part.slice(1, -1)}
          </mark>
        );
      }
      return part;
    });
  }

  return (
    <div
      ref={viewportRef}
      className={
        "ai-node-viewport" +
        (canvasDropOver ? " drop-over" : "") +
        (shiftHeld && tool === "select" && selectedIds.length ? " shift-transfer-ready" : "") +
        (tool === "highlight" ? " highlight-transfer-ready" : "") +
        (panning ? " ai-panning" : "") +
        (wheelZooming ? " ai-wheel-zooming" : "") +
        (tool === "highlight" ? " ai-highlight-mode" : "") +
        (zoomTier === "dot" ? " ai-zoom-dot" : zoomTier === "short" ? " ai-zoom-short" : " ai-zoom-full")
      }
      style={{ "--ai-content-blend": contentBlend, "--ai-inv-scale": invScale }}
      onPointerDown={handleViewportPointerDown}
      onPointerMove={(e) => onPointerTrack?.(e.clientX, e.clientY)}
      onPointerEnter={(e) => onPointerTrack?.(e.clientX, e.clientY)}
      onDragOver={(e) => {
        onCanvasDragOver?.(e);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) onCanvasDragLeave?.(e);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const world = getDropWorld(e.clientX, e.clientY);
        onCanvasDrop?.(e, world);
      }}
    >
      <div className="ai-void-bg" aria-hidden="true" />

      <div
        className="ai-world-layer"
        style={{
          transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`,
        }}
      >
        <svg className="ai-node-lines" aria-hidden={!strandTip}>
          <defs>
            <marker
              id="ai-edge-arrow-expand"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerUnits="userSpaceOnUse"
              markerWidth={markerSize}
              markerHeight={markerSize}
              orient="auto"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(255, 255, 255, 0.92)" />
            </marker>
            <marker
              id="ai-edge-arrow-interpret"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerUnits="userSpaceOnUse"
              markerWidth={markerSize}
              markerHeight={markerSize}
              orient="auto"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(255, 255, 255, 0.88)" />
            </marker>
            <marker
              id="ai-edge-arrow-move"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerUnits="userSpaceOnUse"
              markerWidth={markerSize}
              markerHeight={markerSize}
              orient="auto"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(255, 255, 255, 0.85)" />
            </marker>
            <marker
              id="ai-edge-arrow-default"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerUnits="userSpaceOnUse"
              markerWidth={markerSize}
              markerHeight={markerSize}
              orient="auto"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(255, 255, 255, 0.9)" />
            </marker>
            <filter id="ai-edge-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="ai-strand-glow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {edges.map(({ id, from, to, kind, label }, edgeIdx) => {
            if (!from || !to) return null;
            const fromView = nodeEdgeView(from);
            const toView = nodeEdgeView(to);
            const geom = edgeGeometry(from, to, {
              bundleOffset: bundleOffsets.get(id) || 0,
              curveSign: edgeIdx % 2 === 0 ? 1 : -1,
              invScale,
              fromCellWeight: fromView.cellWeight,
              toCellWeight: toView.cellWeight,
              fromBlend: fromView.contentBlend,
              toBlend: toView.contentBlend,
              fromTextLayout: fromView.textLayout,
              toTextLayout: toView.textLayout,
            });
            if (!geom?.path || geom.tooShort) return null;
            const pathD = geom.path;
            const marker =
              kind === "expand"
                ? "url(#ai-edge-arrow-expand)"
                : kind === "interpret"
                  ? "url(#ai-edge-arrow-interpret)"
                  : kind === "move"
                    ? "url(#ai-edge-arrow-move)"
                    : "url(#ai-edge-arrow-default)";
            const isHovered = hoveredEdgeId === id;
            return (
              <g
                key={id}
                className={`ai-edge ai-edge-${kind}${isHovered ? " hovered" : ""}`}
                onPointerEnter={(e) => {
                  setHoveredEdgeId(id);
                  setStrandTip({ label, x: e.clientX, y: e.clientY });
                  onTourEvent?.("edge-hover");
                }}
                onPointerMove={(e) => {
                  setStrandTip({ label, x: e.clientX, y: e.clientY });
                }}
                onPointerLeave={() => {
                  setHoveredEdgeId(null);
                  setStrandTip(null);
                }}
              >
                <path
                  d={pathD}
                  className="ai-edge-hit"
                  fill="none"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d={pathD}
                  className={`ai-node-line ai-node-line-${kind}`}
                  fill="none"
                  strokeWidth={edgeStroke}
                  vectorEffect="non-scaling-stroke"
                  markerEnd={marker}
                />
              </g>
            );
          })}
        </svg>

        {nodes.map((node) => {
          const r = node.radius || 20;
          const isSelected = selectedIds.includes(node.id);
          const isFocused = focusedNodeId === node.id;
          const childCount = nodes.filter((n) => n.parentId === node.id).length;
          const cellWeight = 1 + Math.min(childCount * 0.14, 0.5);
          const isLanding = landingNodeIds?.has?.(node.id);
          const detail = nodeDetailText(node);
          const nodeBlend = detail ? contentBlend : 0;
          const textLayout = detail ? nodeTextLayoutAtBlend(r, detail.length, nodeBlend, detail) : null;
          const markable = aiNodeHighlightMarkable(node, contentBlend);
          const golden = node.goldenFragment?.trim();
          return (
            <div
              key={node.id}
              className={
                "ai-node" +
                ` ai-node-${node.nodeKind}` +
                (isSelected ? " selected" : "") +
                (isFocused ? " focused" : "") +
                (golden ? " hl-marked" : "") +
                (detail ? " morphing" : "") +
                (isSelected && selectedIds.length > 1 ? " multi-selected" : "") +
                (node.loading ? " loading" : "") +
                (node.error ? " error" : "") +
                (isLanding ? " landing" : "") +
                (bornIds.has(node.id) ? " born-gold" : "") +
                (hoverPreview?.id === node.id ? " hover-preview" : "")
              }
              style={{
                left: node.x - r,
                top: node.y - r,
                width: r * 2,
                height: r * 2,
                "--ai-cell-weight": cellWeight,
                "--ai-node-blend": nodeBlend,
                "--ai-ring-stroke": `${Math.max(2, 2.8 * invScale)}px`,
              }}
              onPointerEnter={(e) => {
                updateNodeCursor(e, node);
                showNodeHoverPreview(node, e.clientX, e.clientY);
              }}
              onPointerMove={(e) => {
                updateNodeCursor(e, node);
                if (hoverPreview?.id === node.id) {
                  setHoverPreview((prev) =>
                    prev?.id === node.id ? { ...prev, x: e.clientX, y: e.clientY } : prev
                  );
                }
              }}
              onPointerLeave={(e) => {
                e.currentTarget.style.cursor = "";
                setHoverPreview((prev) => (prev?.id === node.id ? null : prev));
              }}
              onPointerDown={(e) => startNodeDrag(e, node)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                onExploreNode?.(node.id);
              }}
            >
              <span className="ai-node-ring" aria-hidden="true" />
              {node.loading && <span className="ai-node-loading-core" aria-hidden="true" />}
              {node.error && <span className="ai-node-error-dot" title={node.error} />}
              {detail && textLayout && (
                <div
                  className="ai-node-content-text"
                  style={{
                    opacity: nodeBlend,
                    width: r * 2,
                    height: r * 2,
                    fontSize: textLayout.fontSize,
                    lineHeight: textLayout.lineHeight,
                    padding: textLayout.pad,
                  }}
                >
                  <div className="ai-node-content-text-body" aria-label={node.label}>
                    {renderNodeText(node, detail)}
                  </div>
                  {tool === "highlight" &&
                    node.expandedText?.trim() &&
                    markable &&
                    (isSelected || isFocused) && (
                      <div
                        className="ai-node-text-highlight"
                        onPointerDown={(ev) => ev.stopPropagation()}
                        onClick={(ev) => ev.stopPropagation()}
                      >
                        <FragmentHighlightLayer
                          active
                          text={node.expandedText}
                          lockedQuote={golden || null}
                          fontSize={textLayout.fontSize}
                          lineHeight={textLayout.lineHeight}
                          width={textLayout.w}
                          fontFamily="inherit"
                          onFragmentReplace={onFragmentReplace}
                          onFragmentToPaper={onFragmentToPaper}
                          onTransferStart={(ev, quote) =>
                            onHighlightTransferStart?.(ev, [node.id], {
                              immediate: true,
                              fragment: quote,
                            })
                          }
                          isPaperDestination={isPaperDestination}
                          className="ai-node-text-fragment"
                        />
                      </div>
                    )}
                </div>
              )}
            </div>
          );
        })}

      </div>

      {lasso && (
        <div
          className="ai-lasso"
          style={{
            left: Math.min(lasso.x0, lasso.x1),
            top: Math.min(lasso.y0, lasso.y1),
            width: Math.abs(lasso.x1 - lasso.x0),
            height: Math.abs(lasso.y1 - lasso.y0),
          }}
        />
      )}


      {strandTip && (
        <div
          className="ai-strand-tooltip"
          style={{ left: strandTip.x, top: strandTip.y }}
          role="tooltip"
        >
          {strandTip.label}
        </div>
      )}

      {hoverPreview && (
        <div
          className="ai-node-hover-preview"
          style={{ left: hoverPreview.x, top: hoverPreview.y }}
          role="tooltip"
        >
          {hoverPreview.text}
        </div>
      )}

      {strandDrag?.active && (
        <svg className="ai-strand-drag-layer" aria-hidden="true">
          <defs>
            <filter id="ai-drag-strand-glow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <circle
            className="ai-strand-drag-origin"
            cx={strandDrag.originX}
            cy={strandDrag.originY}
            r={6}
          />
          {strandDrag.choices.map((choice, i) => {
            const angle = strandDrag.angles?.[i] ?? 0;
            const len = strandDrag.length;
            const x2 = strandDrag.originX + Math.cos(angle) * len;
            const y2 = strandDrag.originY + Math.sin(angle) * len;
            const midX = strandDrag.originX + Math.cos(angle) * len * 0.55 + Math.sin(angle) * 8;
            const midY = strandDrag.originY + Math.sin(angle) * len * 0.55 - Math.cos(angle) * 8;
            const pathD = `M ${strandDrag.originX} ${strandDrag.originY} Q ${midX} ${midY} ${x2} ${y2}`;
            const hovered = strandDrag.hoverIdx === i;
            return (
              <g
                key={choice.id}
                className={
                  "ai-strand-drag-strand" +
                  (hovered ? " hovered" : "") +
                  ` ai-strand-drag-kind-${choice.kind}`
                }
                style={{ "--strand-i": i }}
              >
                <path d={pathD} className="ai-strand-drag-path" filter="url(#ai-drag-strand-glow)" />
                <circle cx={x2} cy={y2} r={hovered ? 10 : 7} className="ai-strand-drag-tip" />
                <text x={x2} y={y2 - 14} className="ai-strand-drag-label">
                  {truncateLabel(choice.label, 14)}
                </text>
              </g>
            );
          })}
        </svg>
      )}

    </div>
  );
}

export { AI_OUTPUT_MIME };

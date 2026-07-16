import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  aiNodeEdgeHandlesInteractive,
  attachPointOnNode,
  collectAiEdges,
  edgeBundleOffsets,
  edgeGeometry,
  fanStrandAngles,
  pickStrandIndex,
  resolveIntentChildPosition,
  truncateLabel,
} from "../lib/ai-nodes.js";
import {
  AI_DOT_ONLY_THRESHOLD,
  AI_BLEND_ZOOM_START,
  clampAiCamera,
  clampAiScale,
  clientToWorld,
  nodeTextLayoutAtBlend,
  screenToWorld,
  viewportCenterWorld,
  worldToScreen,
  zoomContentBlend,
} from "../lib/ai-space.js";
import { attachCanvasWheel } from "../lib/canvas-navigation.js";
import { nearestMergeTarget, updateMergeProximity } from "../lib/merge-proximity.js";
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
  const edgeRatio = camera.scale > 1.05 ? 0.4 : NODE_EDGE_BAND_RATIO;
  const edgePx = Math.max(NODE_EDGE_BAND_PX, screenR * edgeRatio);
  // The middle of a node is ALWAYS grabbable for moving it — even when the
  // node renders tiny at constellation zoom, keep a core of at least 62% of
  // the radius so the edge band can never swallow the whole node.
  const innerR = Math.max(screenR - edgePx, screenR * 0.62);
  return {
    onEdge: dist >= innerR,
    inNode: dist < innerR,
  };
}

export default function AiNodeCanvas({
  nodes,
  camera,
  onCameraChange,
  selectedIds = [],
  onSelect,
  onMove,
  onMergeDrop,
  onExpandNode,
  onExploreNode,
  onKeepExample,
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
  onHighlightMark,
  highlightMarkedIds,
  highlightStrokes = [],
  onHighlightStrokeComplete,
  onFragmentReplace,
  onFragmentToPaper,
  isPaperDestination,
  shouldHandoffNodeDrag,
  viewportRef: externalViewportRef,
  onTourEvent,
  landingNodeIds,
  growingEdgeIds,
  operatorDropTargetId,
  onPointerTrack,
  embedded = false,
}) {
  const localViewportRef = useRef(null);
  const viewportRef = externalViewportRef || localViewportRef;
  const dragRef = useRef(null);
  const mergeRef = useRef({ candidateId: null, enteredAt: null, armed: false });
  const panRef = useRef(null);
  const lassoRef = useRef(null);
  const cameraRef = useRef(camera);
  cameraRef.current = camera;
  const [panning, setPanning] = useState(false);
  const [shiftHeld, setShiftHeld] = useState(false);
  const [vpSize, setVpSize] = useState({ w: 320, h: 240 });
  const [lasso, setLasso] = useState(null);
  const [strandTip, setStrandTip] = useState(null);
  const [mergePreview, setMergePreview] = useState(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState(null);
  const [strandDrag, setStrandDrag] = useState(null);
  const strandDragRef = useRef(null);
  strandDragRef.current = strandDrag;
  const knownNodeIdsRef = useRef(null);
  const [bornIds, setBornIds] = useState(() => new Set());
  const [wheelZooming, setWheelZooming] = useState(false);
  const [hoverPreview, setHoverPreview] = useState(null);
  const [hlDraft, setHlDraft] = useState(null); // live highlight stroke (world points)
  const readPanelRef = useRef(null);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const onStrandSelectRef = useRef(onStrandSelect);
  onStrandSelectRef.current = onStrandSelect;

  useEffect(() => {
    if (!focusedNodeId) return;
    const frame = requestAnimationFrame(() => {
      const panel = readPanelRef.current;
      if (!panel) return;
      panel.scrollTop = 0;
      panel.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [focusedNodeId]);

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

  // While dragging an AI “strand”, let arrow keys cycle the chosen operation.
  // This makes branching choices keyboard-friendly (release to commit).
  useEffect(() => {
    function cycleStrandHover(sd, nextIdx) {
      const clamped = Math.max(0, Math.min(sd.choices.length - 1, nextIdx));
      const nextState = {
        ...sd,
        hoverIdx: clamped,
        // Remember where the pointer was so small jitters don't undo the pick.
        keyLockAt: { x: sd.pointerX ?? 0, y: sd.pointerY ?? 0 },
      };
      strandDragRef.current = nextState;
      setStrandDrag(nextState);
    }

    function switchStrandLevel(sd, delta) {
      const levels = sd.levels || [];
      if (!levels.length) return;
      const levelIndex = Math.max(0, Math.min(levels.length - 1, (sd.levelIndex || 0) + delta));
      if (levelIndex === sd.levelIndex) return;
      const level = levels[levelIndex];
      const nextState = {
        ...sd,
        levelIndex,
        levelLabel: level.label,
        choices: level.choices,
        hoverIdx: 0,
        angles: null,
        keyLockAt: { x: sd.pointerX ?? 0, y: sd.pointerY ?? 0 },
      };
      strandDragRef.current = nextState;
      setStrandDrag(nextState);
    }

    function onKeyDown(e) {
      const typing = e.target?.isContentEditable || /^(INPUT|TEXTAREA)$/.test(e.target?.tagName || "");
      if (typing) return;

      const sd = strandDragRef.current;
      if (!sd?.active) return;
      if (!sd.choices?.length) return;

      if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        switchStrandLevel(sd, -1);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        switchStrandLevel(sd, 1);
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        e.stopPropagation();
        const cur = typeof sd.hoverIdx === "number" && sd.hoverIdx >= 0 ? sd.hoverIdx : 0;
        cycleStrandHover(sd, cur - 1);
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        e.stopPropagation();
        const cur = typeof sd.hoverIdx === "number" && sd.hoverIdx >= 0 ? sd.hoverIdx : 0;
        cycleStrandHover(sd, cur + 1);
        return;
      }
      if (e.key >= "1" && e.key <= "9") {
        const idx = Number(e.key) - 1;
        if (idx < sd.choices.length) {
          e.preventDefault();
          e.stopPropagation();
          cycleStrandHover(sd, idx);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        strandDragRef.current = null;
        setStrandDrag(null);
        document.body.classList.remove("ai-strand-dragging");
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        const idx = typeof sd.hoverIdx === "number" && sd.hoverIdx >= 0 ? sd.hoverIdx : 0;
        const choice = sd.choices[idx];
        if (!choice) return;
        e.preventDefault();
        e.stopPropagation();
        const worldPos = sd.previewWorld;
        if (!worldPos) return;
        strandDragRef.current = null;
        setStrandDrag(null);
        document.body.classList.remove("ai-strand-dragging");
        onStrandSelectRef.current?.(sd.nodeId, choice, {
          worldPos,
          placementResolved: true,
          intentAngle: sd.intentAngle,
          angleError: sd.angleError || 0,
        });
      }
    }

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
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
      (next) => onCameraChange?.(clampAiCamera(next)),
      (e) => {
        const rect = el.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
      },
      undefined,
      {
        onWheelActive: () => setWheelZooming(true),
        onWheelIdle: () => setWheelZooming(false),
        clampScale: clampAiScale,
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

  function startStrandDrag(
    e,
    node,
    seedX = e.clientX,
    seedY = e.clientY,
    initialPointer = null
  ) {
    if (e.button !== 0) return;
    if (e.shiftKey && tool === "select" && selectedIds.length) {
      e.preventDefault();
      e.stopPropagation();
      onSpaceTransferStart?.(e, [node.id], { fromNode: true });
      return;
    }
    e.stopPropagation();

    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;

    const pool = getStrandChoices?.(node) || [];
    const levelDefs = [
      { key: "primitive-moves", label: "Primitive Moves" },
      { key: "moves", label: "Moves" },
      { key: "functions", label: "Functions" },
    ];
    const levels = levelDefs
      .map((level) => ({ ...level, choices: pool.filter((choice) => choice.level === level.key) }))
      .filter((level) => level.choices.length);
    const choices = levels[0]?.choices || [];
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
      levels,
      levelIndex: 0,
      levelLabel: levels[0]?.label || "Primitive Moves",
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

    function abortStrandDrag(ev) {
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
      window.removeEventListener("pointercancel", handleStrandCancel);
    }

    function updateFromPointer(clientX, clientY, moveEv) {
      const state = strandDragRef.current;
      if (!state) return;

      // Dragging across a column boundary means "move this through layers",
      // not "branch": hand off to the space-transfer flow.
      if (moveEv && shouldHandoffNodeDrag?.(clientX, clientY)) {
        abortStrandDrag(moveEv);
        onSpaceTransferStart?.(moveEv, [state.nodeId], { immediate: true, fromNode: true });
        return;
      }

      const rectNow = viewportRef.current?.getBoundingClientRect();
      const sourceNode = nodesRef.current.find((candidate) => candidate.id === state.nodeId);
      if (!rectNow || !sourceNode) return;
      const cam = cameraRef.current;
      const pointerWorld = clientToWorld(cam, rectNow, clientX, clientY);
      const previewWorld = resolveIntentChildPosition(
        sourceNode,
        pointerWorld,
        nodesRef.current,
        "expanded"
      );
      const attach = attachPointOnNode(sourceNode, previewWorld.x, previewWorld.y, {
        invScale: 1 / cam.scale,
        cellWeight:
          1 +
          Math.min(nodesRef.current.filter((candidate) => candidate.parentId === sourceNode.id).length, 3) *
            0.14,
      });
      const attachScreen = worldToScreen(cam, attach.x, attach.y);
      const px = clientX - rectNow.left;
      const py = clientY - rectNow.top;
      const dx = px - attachScreen.x;
      const dy = py - attachScreen.y;
      const dist = Math.hypot(dx, dy);
      if (!state.active && dist <= STRAND_DRAG_THRESHOLD) return;
      if (moveEv) ensureCapture(moveEv);

      const length = Math.min(STRAND_MAX_LENGTH, Math.max(STRAND_MIN_LENGTH, dist));
      const pointerAngle = Math.atan2(dy, dx);
      // Freeze the fan at first activation so the tips stay put and the
      // pointer can actually aim at one of them.
      const baseAngle = state.active ? state.baseAngle : pointerAngle;
      const angles =
        state.active && state.angles?.length
          ? state.angles
          : fanStrandAngles(state.choices.length, baseAngle);

      let hoverIdx;
      let keyLockAt = state.keyLockAt;
      if (keyLockAt && Math.hypot(clientX - keyLockAt.x, clientY - keyLockAt.y) <= 14) {
        // A keyboard pick stays sticky until the pointer clearly moves again.
        hoverIdx = state.hoverIdx;
      } else {
        keyLockAt = null;
        hoverIdx = pickStrandIndex(pointerAngle, angles);
      }

      const next = {
        ...state,
        active: true,
        originX: attachScreen.x,
        originY: attachScreen.y,
        rectLeft: rectNow.left,
        rectTop: rectNow.top,
        length,
        baseAngle,
        angles,
        hoverIdx,
        keyLockAt,
        pointerX: clientX,
        pointerY: clientY,
        previewWorld,
        previewScreen: worldToScreen(cam, previewWorld.x, previewWorld.y),
        intentAngle: previewWorld.intentAngle,
        placementAngle: previewWorld.angle,
        angleError: previewWorld.angleError,
        collisionAdjusted: previewWorld.adjusted,
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
      window.removeEventListener("pointercancel", handleStrandCancel);

      if (!state?.active) return;

      let pickIdx =
        typeof state.hoverIdx === "number" && state.hoverIdx >= 0
          ? state.hoverIdx
          : -1;
      if (pickIdx < 0 && state.angles?.length) {
        pickIdx = pickStrandIndex(state.baseAngle, state.angles);
      }

      if (pickIdx < 0 && state.angles?.length) {
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
      if (choice && state.previewWorld) {
        onStrandSelect?.(state.nodeId, choice, {
          worldPos: state.previewWorld,
          placementResolved: true,
          intentAngle: state.intentAngle,
          angleError: state.angleError || 0,
        });
      }
    }

    function handleStrandMove(ev) {
      updateFromPointer(ev.clientX, ev.clientY, ev);
    }

    function handleStrandEnd(ev) {
      finishStrandDrag(ev);
    }

    function handleStrandCancel(ev) {
      abortStrandDrag(ev);
    }

    window.addEventListener("pointermove", handleStrandMove);
    window.addEventListener("pointerup", handleStrandEnd);
    window.addEventListener("pointercancel", handleStrandCancel);
    if (initialPointer) {
      updateFromPointer(initialPointer.x, initialPointer.y, initialPointer.event || null);
    }
  }

  function startBranchStrandGesture(e, node) {
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
      startStrandDrag(e, node, startX, startY, {
        x: ev.clientX,
        y: ev.clientY,
        event: ev,
      });
    }

    function onUp() {
      cleanup();
      if (!activated) {
        onSelect?.(node.id, { replace: true });
        // Click opens the node like a chat message: zoom to its content card.
        onExploreNode?.(node.id);
      }
    }

    function onCancel() {
      cleanup();
    }

    function cleanup() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
  }

  function startHighlightTransfer(e, node, opts = {}) {
    const fragment = opts.fragment || node.goldenFragment?.trim() || null;
    onHighlightTransferStart?.(e, [node.id], { immediate: true, fragment, fromNode: true });
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
      onSpaceTransferStart?.(e, [node.id], { fromNode: true });
      return;
    }
    e.stopPropagation();
    const captureEl = e.currentTarget;
    const startX = e.clientX;
    const startY = e.clientY;
    const pending = { nodeId: node.id, startX, startY, scale: camera.scale };
    let dragging = false;
    let handoff = false;
    let finished = false;

    try {
      captureEl.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }

    function cleanupDragListeners() {
      window.removeEventListener("pointermove", handleDragMove);
      window.removeEventListener("pointerup", handleDragEnd);
      window.removeEventListener("pointercancel", handleDragEnd);
    }

    function finishDrag(ev) {
      if (finished) return;
      finished = true;
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
      const merge = mergeRef.current;
      if (dragging && merge.armed && merge.candidateId) {
        onMove?.(node.id, node.x, node.y);
        onMergeDrop?.(node.id, merge.candidateId);
      }
      mergeRef.current = { candidateId: null, enteredAt: null, armed: false };
      setMergePreview(null);
      dragRef.current = null;
      document.body.classList.remove("ai-node-dragging");
      try {
        captureEl.releasePointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }
      cleanupDragListeners();
    }

    function handleDragMove(ev) {
      if (handoff || finished) return;
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
        finished = true;
        cleanupDragListeners();
        try {
          captureEl.releasePointerCapture(ev.pointerId);
        } catch {
          /* ignore */
        }
        onSpaceTransferStart?.(ev, [node.id], { immediate: true, fromNode: true });
        return;
      }

      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;
      const world = screenToWorld(cameraRef.current, ev.clientX - rect.left, ev.clientY - rect.top);
      onMove?.(dragRef.current.nodeId, world.x, world.y);
      const nearest = nearestMergeTarget(
        dragRef.current.nodeId,
        { x: ev.clientX, y: ev.clientY },
        nodes,
        cameraRef.current,
        rect
      );
      mergeRef.current = updateMergeProximity(
        mergeRef.current,
        nearest ? { candidateId: nearest.id, distancePx: nearest.distancePx } : null
      );
      setMergePreview(mergeRef.current.candidateId
        ? { sourceId: dragRef.current.nodeId, targetId: mergeRef.current.candidateId, armed: mergeRef.current.armed }
        : null);
    }

    function handleDragEnd(ev) {
      finishDrag(ev);
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
      // Tap (no drag) with the highlighter: toggle this node in the living
      // cross-layer highlight selection.
      if (!armed) onHighlightMark?.(node.id);
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

    // Two zones, like grabbing a cell vs pulling its membrane:
    //  - grab the MIDDLE to move the node (or click to open it)
    //  - drag from the EDGE to pull out the strand fan of operations
    // Alt/Option+drag always repositions, from anywhere.
    const rect = viewportRef.current?.getBoundingClientRect();
    const hit = pointerHitZone(e.clientX, e.clientY, node, cameraRef.current, rect);
    const strandChoices = getStrandChoices?.(node) || [];
    if (tool === "select" && strandChoices.length && !e.altKey && hit.onEdge) {
      startBranchStrandGesture(e, node);
      return;
    }

    startNodePositionDrag(e, node);
  }

  /**
   * Highlight tool on empty space: draw a golden stroke that marks every
   * node it touches. The ink stays visible (session mark) — it never
   * transfers or expands anything by itself.
   */
  function startHighlightStroke(e) {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    e.preventDefault();
    const toWorld = (ev) => screenToWorld(cameraRef.current, ev.clientX - rect.left, ev.clientY - rect.top);
    const points = [toWorld(e)];
    const touched = new Set();
    const commitKey = `ai-brush-${Date.now()}-${e.pointerId}`;
    const startX = e.clientX;
    const startY = e.clientY;

    function hitNodes(w) {
      const pad = 10 / Math.max(cameraRef.current.scale, 0.08);
      for (const n of nodesRef.current) {
        const r = (n.radius || 20) + pad;
        if (Math.hypot(w.x - n.x, w.y - n.y) <= r) touched.add(n.id);
      }
    }
    hitNodes(points[0]);

    function onMovePt(ev) {
      const w = toWorld(ev);
      points.push(w);
      hitNodes(w);
      setHlDraft({ points: points.slice() });
    }

    function onUpPt(ev) {
      window.removeEventListener("pointermove", onMovePt);
      window.removeEventListener("pointerup", onUpPt);
      window.removeEventListener("pointercancel", onUpPt);
      setHlDraft(null);
      const moved = Math.hypot(ev.clientX - startX, ev.clientY - startY);
      if (moved <= 6) {
        // Tap on empty space with the highlighter: nothing to mark.
        const single = [...touched];
        if (single.length === 1) onHighlightMark?.(single[0]);
        return;
      }
      onHighlightStrokeComplete?.(points, [...touched], commitKey);
    }

    window.addEventListener("pointermove", onMovePt);
    window.addEventListener("pointerup", onUpPt);
    window.addEventListener("pointercancel", onUpPt);
  }

  function handleViewportPointerDown(e) {
    if (e.target.closest?.(".ai-node")) return;
    if (e.target.closest?.(".ai-explore-overlay-inner")) return;
    if (e.target.closest?.(".ai-strand-setting")) return;
    if (e.target.closest?.(".ai-node-fragment-panel")) return;

    if (e.shiftKey && tool === "select" && selectedIds.length) {
      onSpaceTransferStart?.(e, selectedIds);
      return;
    }

    if (e.button === 1 || e.altKey) {
      startPan(e);
      return;
    }

    if (e.button !== 0) return;

    // Background drags never transfer or spawn nodes: the highlighter
    // strokes/marks, everything else pans. Transfers must start from a node.
    if (tool === "highlight") {
      startHighlightStroke(e);
      return;
    }

    if (tool === "select" && e.shiftKey) {
      startLasso(e);
      return;
    }

    startPan(e);
  }

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const focusedNode = focusedNodeId ? nodeById.get(focusedNodeId) : null;
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
  const zoomTier =
    camera.scale < AI_DOT_ONLY_THRESHOLD
      ? "dot"
      : camera.scale < AI_BLEND_ZOOM_START
        ? "short"
        : "full";
  // Arrowheads hold a constant on-screen size: ~13px normally, smaller when
  // nodes shrink to dots so heads never dwarf them.
  const markerScreenPx = zoomTier === "dot" ? 9 : 13;
  const markerSize = markerScreenPx * invScale;

  function updateNodeCursor(e, node) {
    const rect = viewportRef.current?.getBoundingClientRect();
    const hit = pointerHitZone(e.clientX, e.clientY, node, cameraRef.current, rect);
    const strandChoices = getStrandChoices?.(node) || [];
    // Edge = pull a strand (crosshair); middle = move/open (grab).
    e.currentTarget.style.cursor =
      tool === "highlight"
        ? "grab"
        : tool === "select" && strandChoices.length && hit.onEdge
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
        (embedded ? " ai-node-viewport-embedded" : "") +
        (canvasDropOver ? " drop-over" : "") +
        (shiftHeld && tool === "select" && selectedIds.length ? " shift-transfer-ready" : "") +
        (tool === "highlight" ? " highlight-transfer-ready" : "") +
        (panning ? " ai-panning" : "") +
        (wheelZooming ? " ai-wheel-zooming" : "") +
        (tool === "highlight" ? " ai-highlight-mode" : "") +
        (zoomTier === "dot" ? " ai-zoom-dot" : zoomTier === "short" ? " ai-zoom-short" : " ai-zoom-full")
      }
      style={{ "--ai-content-blend": contentBlend, "--ai-inv-scale": invScale }}
      onPointerDown={embedded ? undefined : handleViewportPointerDown}
      onPointerMove={(e) => onPointerTrack?.(e.clientX, e.clientY)}
      onPointerEnter={(e) => onPointerTrack?.(e.clientX, e.clientY)}
      onDragOver={(e) => {
        if (embedded) return;
        onCanvasDragOver?.(e);
      }}
      onDragLeave={(e) => {
        if (embedded) return;
        if (!e.currentTarget.contains(e.relatedTarget)) onCanvasDragLeave?.(e);
      }}
      onDrop={(e) => {
        if (embedded) return;
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
              <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(20, 20, 20, 0.88)" />
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
              <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(20, 20, 20, 0.84)" />
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
              <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(20, 20, 20, 0.8)" />
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
              <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(20, 20, 20, 0.86)" />
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
            <clipPath id="ai-page-content-clip">
              <rect x="24" y="24" width="720" height="1056" />
            </clipPath>
          </defs>
          <g clipPath="url(#ai-page-content-clip)">
          {edges.map(({ id, from, to, kind, label }) => {
            if (!from || !to) return null;
            const fromView = nodeEdgeView(from);
            const toView = nodeEdgeView(to);
            const geom = edgeGeometry(from, to, {
              bundleOffset: bundleOffsets.get(id) || 0,
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
            const isGrowing = growingEdgeIds?.has?.(id);
            return (
              <g
                key={id}
                className={
                  `ai-edge ai-edge-${kind}` +
                  (isHovered ? " hovered" : "") +
                  (isGrowing ? " growing" : "")
                }
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
          {highlightStrokes.map((hs) => (
            <polyline
              key={hs.id}
              className="ai-hl-session-stroke"
              points={hs.points.map((p) => `${p.x},${p.y}`).join(" ")}
              strokeWidth={5 * invScale}
            />
          ))}
          {hlDraft && hlDraft.points.length > 1 && (
            <polyline
              className="ai-hl-draft-stroke"
              points={hlDraft.points.map((p) => `${p.x},${p.y}`).join(" ")}
              strokeWidth={5 * invScale}
            />
          )}
          </g>
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
              data-node-id={node.id}
              data-world-x={node.x}
              data-world-y={node.y}
              className={
                "ai-node" +
                ` ai-node-${node.nodeKind}` +
                (isSelected ? " selected" : "") +
                (isFocused ? " focused" : "") +
                (golden ? " hl-marked" : "") +
                (highlightMarkedIds?.has?.(node.id) ? " omni-marked" : "") +
                (detail ? " morphing" : "") +
                (nodeBlend > 0.6 ? " text-dominant" : "") +
                (isSelected && selectedIds.length > 1 ? " multi-selected" : "") +
                (node.loading ? " loading" : "") +
                (node.error ? " error" : "") +
                (isLanding ? " landing" : "") +
                (operatorDropTargetId === node.id ? " operator-drop-target" : "") +
                (mergePreview?.targetId === node.id ? ` merge-proximity${mergePreview.armed ? " armed" : ""}` : "") +
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
              <span
                className="ai-node-screen-hit-target"
                aria-hidden="true"
                style={{
                  position: "absolute",
                  inset: -Math.max(0, 12 / Math.max(0.01, camera.scale) - r),
                  borderRadius: "50%",
                  pointerEvents: nodeBlend > 0.6 ? "none" : "auto",
                  zIndex: 5,
                }}
              />
              {tool === "select" &&
                aiNodeEdgeHandlesInteractive(r, camera.scale) &&
                ["n", "e", "s", "w"].map((side) => (
                  <span
                    key={side}
                    className={`ai-node-edge-handle ai-node-edge-handle-${side}`}
                    aria-hidden="true"
                    onPointerDown={(event) => startBranchStrandGesture(event, node)}
                  />
                ))}
              {/* Ring shares the text card's exact geometry: one silhouette that
                  morphs circle→card and fades as text blooms, so text can never
                  spill outside a visible circle. */}
              <span
                className="ai-node-ring"
                aria-hidden="true"
                style={
                  textLayout && nodeBlend > 0.001
                    ? {
                        inset: "auto",
                        left: "50%",
                        top: "50%",
                        transform: "translate(-50%, -50%)",
                        width: textLayout.boxW,
                        height: textLayout.boxH,
                        borderRadius: textLayout.cornerRadius,
                      }
                    : undefined
                }
              />
              {node.loading && <span className="ai-node-loading-core" aria-hidden="true" />}
              {mergePreview?.targetId === node.id && <span className="ai-node-merge-label">Merge</span>}
              {node.error && <span className="ai-node-error-dot" title={node.error} />}
              {detail && textLayout && (
                <div
                  className="ai-node-content-text"
                  style={{
                    opacity: nodeBlend,
                    width: textLayout.boxW ?? r * 2,
                    height: textLayout.boxH ?? r * 2,
                    borderRadius: textLayout.cornerRadius ?? r,
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
                          onFragmentReplace={(fragment, opts) =>
                            onFragmentReplace?.(fragment, opts, node.id)
                          }
                          onFragmentToPaper={onFragmentToPaper}
                          onTransferStart={(ev, quote) =>
                            onHighlightTransferStart?.(ev, [node.id], {
                              immediate: true,
                              fragment: quote,
                              fromNode: true,
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

      {focusedNode && nodeDetailText(focusedNode) && (
        <div className="ai-explore-overlay" role="presentation">
          <div
            ref={readPanelRef}
            className="ai-explore-overlay-inner"
            tabIndex={-1}
            role="region"
            aria-label={`Full output: ${focusedNode.label || "AI result"}`}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="ai-explore-overlay-head">
              <div className="ai-explore-overlay-label">{focusedNode.label || "AI output"}</div>
              {focusedNode.expandedText?.trim() && (
                <button
                  type="button"
                  className="ai-explore-keep-example"
                  onClick={() => onKeepExample?.(focusedNode.id)}
                  title="Explicitly keep this input → output transformation in the grinding tray"
                >
                  ◇ keep as example
                </button>
              )}
              <button
                type="button"
                className="ai-explore-overlay-close"
                onClick={() => onReturnToConstellation?.()}
                aria-label="Close full output"
              >
                ×
              </button>
            </div>
            {(focusedNode.modelProvenance || focusedNode.resolvedModel) && (
              <div className="ai-model-provenance" data-model-provenance>
                <span>{focusedNode.modelProvenance?.requestedModel || "auto"} → {focusedNode.modelProvenance?.resolvedModel || focusedNode.resolvedModel}</span>
                {focusedNode.modelProvenance?.providerRoute && <span> via {focusedNode.modelProvenance.providerRoute}</span>}
                {focusedNode.modelProvenance?.fallback && <span> · fallback</span>}
                {focusedNode.modelProvenance?.latencyMs != null && <span> · {focusedNode.modelProvenance.latencyMs} ms</span>}
              </div>
            )}
            <div className="ai-explore-overlay-text-wrap">
              <div className="ai-explore-overlay-text" data-testid="ai-full-output">
                {renderNodeText(focusedNode, nodeDetailText(focusedNode))}
              </div>
              {tool === "highlight" && focusedNode.expandedText?.trim() && (
                <FragmentHighlightLayer
                  active
                  text={focusedNode.expandedText}
                  lockedQuote={focusedNode.goldenFragment?.trim() || null}
                  onFragmentReplace={(fragment, opts) =>
                    onFragmentReplace?.(fragment, opts, focusedNode.id)
                  }
                  onTransferStart={(ev, quote) =>
                    onHighlightTransferStart?.(ev, [focusedNode.id], {
                      immediate: true,
                      fragment: quote,
                      fromNode: true,
                    })
                  }
                  className="ai-explore-fragment-highlight"
                />
              )}
            </div>
          </div>
        </div>
      )}

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
        <div className="ai-strand-choice-hud" role="listbox" aria-label="Branch operation">
          <span className="ai-strand-choice-hud-title">{strandDrag.levelLabel || "Primitive Moves"} · {(strandDrag.hoverIdx || 0) + 1}/{strandDrag.choices.length}</span>
          {strandDrag.choices.map((choice, i) => (
            <div
              key={choice.id}
              className={"ai-strand-choice-hud-item" + (strandDrag.hoverIdx === i ? " active" : "")}
              role="option"
              aria-selected={strandDrag.hoverIdx === i}
            >
              <span className="ai-strand-choice-hud-key">{i < 9 ? i + 1 : "·"}</span>
              <span className="ai-strand-choice-hud-label">{choice.label}</span>
            </div>
          ))}
          <span className="ai-strand-choice-hud-hint">← → choose · ↑ ↓ level · Enter/Space apply · Esc cancel</span>
          {(strandDrag.levelIndex || 0) < (strandDrag.levels?.length || 0) - 1 && <button
            type="button"
            className="ai-strand-more"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => {
              const levelIndex = (strandDrag.levelIndex || 0) + 1;
              const level = strandDrag.levels[levelIndex];
              const next = { ...strandDrag, levelIndex, levelLabel: level.label, choices: level.choices, hoverIdx: 0, angles: null, keyLockAt: { x: strandDrag.pointerX || 0, y: strandDrag.pointerY || 0 } };
              strandDragRef.current = next;
              setStrandDrag(next);
            }}
          >More ↓</button>}
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
          {strandDrag.previewScreen && (
            <g
              className={
                "ai-strand-placement-preview" +
                (strandDrag.collisionAdjusted ? " collision-adjusted" : "")
              }
              data-world-x={strandDrag.previewWorld?.x}
              data-world-y={strandDrag.previewWorld?.y}
              data-intent-angle={strandDrag.intentAngle}
              data-placement-angle={strandDrag.placementAngle}
              data-angle-error={strandDrag.angleError || 0}
            >
              <path
                className="ai-strand-placement-path"
                d={`M ${strandDrag.originX} ${strandDrag.originY} L ${strandDrag.previewScreen.x} ${strandDrag.previewScreen.y}`}
              />
              <circle
                className="ai-strand-placement-node"
                cx={strandDrag.previewScreen.x}
                cy={strandDrag.previewScreen.y}
                r={Math.max(9, 24 * camera.scale)}
              />
            </g>
          )}
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
                <path
                  className="ai-strand-drag-tip"
                  d={hovered ? "M -16 -10 L 7 0 L -16 10 L -10 0 Z" : "M -12 -7.5 L 5 0 L -12 7.5 L -7.5 0 Z"}
                  transform={`translate(${x2} ${y2}) rotate(${(angle * 180) / Math.PI})`}
                />
                <text x={x2} y={y2 - 16} className="ai-strand-drag-label">
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

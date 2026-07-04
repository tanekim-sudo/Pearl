import React, { useCallback, useEffect, useRef, useState } from "react";
import { collectAiEdges, edgeGeometry, truncateLabel } from "../lib/ai-nodes.js";
import { screenToWorld, viewportCenterWorld, zoomAtPoint } from "../lib/ai-space.js";

const AI_OUTPUT_MIME = "application/lens-ai-output";

const STAR_COUNT = 120;

function makeStars(seed = 1) {
  const stars = [];
  let s = seed;
  for (let i = 0; i < STAR_COUNT; i++) {
    s = (s * 16807 + 0) % 2147483647;
    stars.push({
      x: (s % 10000) / 10000,
      y: ((s * 7) % 10000) / 10000,
      r: 0.4 + ((s * 3) % 100) / 100,
      a: 0.15 + ((s * 11) % 100) / 200,
    });
  }
  return stars;
}

const STARS = makeStars(42);

export default function AiNodeCanvas({
  nodes,
  camera,
  onCameraChange,
  selectedIds = [],
  onSelect,
  onMove,
  onExpandNode,
  onCanvasDrop,
  onCanvasDragOver,
  onCanvasDragLeave,
  canvasDropOver,
  spaceHeld,
  tool = "select",
  onSpaceTransferStart,
  viewportRef: externalViewportRef,
}) {
  const localViewportRef = useRef(null);
  const viewportRef = externalViewportRef || localViewportRef;
  const dragRef = useRef(null);
  const panRef = useRef(null);
  const lassoRef = useRef(null);
  const [vpSize, setVpSize] = useState({ w: 320, h: 240 });
  const [lasso, setLasso] = useState(null);

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

    function onWheel(e) {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const localX = e.clientX - rect.left;
      const localY = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      onCameraChange?.(zoomAtPoint(camera, localX, localY, factor));
    }

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [camera, onCameraChange, viewportRef]);

  function startPan(e) {
    if (e.button !== 0 && e.button !== 1) return;
    if (dragRef.current || lassoRef.current) return;
    e.preventDefault();
    panRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      cam: { ...camera },
    };

    function handlePanMove(ev) {
      if (!panRef.current) return;
      const dx = ev.clientX - panRef.current.startX;
      const dy = ev.clientY - panRef.current.startY;
      onCameraChange?.({
        ...panRef.current.cam,
        x: panRef.current.cam.x + dx,
        y: panRef.current.cam.y + dy,
      });
    }

    function handlePanEnd() {
      panRef.current = null;
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

  function startNodeDrag(e, node) {
    if (e.button !== 0) return;
    if (spaceHeld && selectedIds.length) {
      e.preventDefault();
      e.stopPropagation();
      onSpaceTransferStart?.(e);
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (e.shiftKey) {
      onSelect?.(node.id, { toggle: true });
    } else if (!selectedIds.includes(node.id)) {
      onSelect?.(node.id, { replace: true });
    }
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = node.x;
    const origY = node.y;
    dragRef.current = { nodeId: node.id, startX, startY, origX, origY, scale: camera.scale };
    document.body.classList.add("ai-node-dragging");

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }

    function handleDragMove(ev) {
      if (!dragRef.current) return;
      const dx = (ev.clientX - dragRef.current.startX) / dragRef.current.scale;
      const dy = (ev.clientY - dragRef.current.startY) / dragRef.current.scale;
      onMove?.(dragRef.current.nodeId, dragRef.current.origX + dx, dragRef.current.origY + dy);
    }

    function handleDragEnd(ev) {
      dragRef.current = null;
      document.body.classList.remove("ai-node-dragging");
      try {
        e.currentTarget.releasePointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }
      window.removeEventListener("pointermove", handleDragMove);
      window.removeEventListener("pointerup", handleDragEnd);
      window.removeEventListener("pointercancel", handleDragEnd);
    }

    window.addEventListener("pointermove", handleDragMove);
    window.addEventListener("pointerup", handleDragEnd);
    window.addEventListener("pointercancel", handleDragEnd);
  }

  function handleViewportPointerDown(e) {
    if (e.target.closest?.(".ai-node")) return;
    const onVoid =
      e.target === e.currentTarget ||
      e.target.classList.contains("ai-void-bg") ||
      e.target.classList.contains("ai-starfield") ||
      e.target.classList.contains("ai-world-layer") ||
      e.target.classList.contains("ai-node-lines");

    if (spaceHeld && selectedIds.length) {
      onSpaceTransferStart?.(e);
      return;
    }

    if (e.button === 1) {
      startPan(e);
      return;
    }

    if ((tool === "select" || tool === "highlight") && e.button === 0 && onVoid) {
      startLasso(e);
      return;
    }

    if (e.button === 0 && onVoid && !selectedIds.length) {
      startPan(e);
    }
  }

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const edges = collectAiEdges(nodes)
    .map((edge) => ({
      ...edge,
      from: nodeById.get(edge.fromId),
      to: nodeById.get(edge.toId),
    }))
    .filter((e) => e.from && e.to);

  const starOffsetX = ((camera.x * 0.02) % 1) * 100;
  const starOffsetY = ((camera.y * 0.02) % 1) * 100;

  return (
    <div
      ref={viewportRef}
      className={
        "ai-node-viewport" +
        (canvasDropOver ? " drop-over" : "") +
        (spaceHeld && selectedIds.length ? " space-transfer-ready" : "") +
        (spaceHeld ? " pan-ready" : "")
      }
      onPointerDown={handleViewportPointerDown}
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
      <div
        className="ai-void-bg"
        aria-hidden="true"
        style={{
          transform: `translate(${-starOffsetX}px, ${-starOffsetY}px)`,
        }}
      >
        <svg className="ai-starfield" viewBox="0 0 100 100" preserveAspectRatio="none">
          {STARS.map((star, i) => (
            <circle
              key={i}
              cx={star.x * 100}
              cy={star.y * 100}
              r={star.r * 0.15}
              fill={`rgba(200,210,255,${star.a})`}
            />
          ))}
        </svg>
      </div>

      <div
        className="ai-world-layer"
        style={{
          transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`,
        }}
      >
        <svg className="ai-node-lines" aria-hidden="true">
          <defs>
            <marker
              id="ai-edge-arrow-expand"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(255, 210, 100, 0.55)" />
            </marker>
            <marker
              id="ai-edge-arrow-interpret"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(200, 180, 255, 0.6)" />
            </marker>
            <marker
              id="ai-edge-arrow-move"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(80, 220, 255, 0.55)" />
            </marker>
            <marker
              id="ai-edge-arrow-default"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(220, 230, 255, 0.45)" />
            </marker>
            <filter id="ai-edge-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {edges.map(({ id, from, to, kind }) => {
            const geom = edgeGeometry(from, to, kind === "move" ? 0.04 : 0.07);
            const marker =
              kind === "expand"
                ? "url(#ai-edge-arrow-expand)"
                : kind === "interpret"
                  ? "url(#ai-edge-arrow-interpret)"
                  : kind === "move"
                    ? "url(#ai-edge-arrow-move)"
                    : "url(#ai-edge-arrow-default)";
            return (
              <g key={id} className={`ai-edge ai-edge-${kind}`}>
                <path
                  d={`M ${geom.x1} ${geom.y1} Q ${geom.cx} ${geom.cy} ${geom.x2} ${geom.y2}`}
                  className="ai-node-line ai-node-line-glow"
                  fill="none"
                  filter="url(#ai-edge-glow)"
                />
                <path
                  d={`M ${geom.x1} ${geom.y1} Q ${geom.cx} ${geom.cy} ${geom.x2} ${geom.y2}`}
                  className={`ai-node-line ai-node-line-${kind}`}
                  fill="none"
                  markerEnd={marker}
                />
              </g>
            );
          })}
        </svg>

        {nodes.map((node) => {
          const r = node.radius || 20;
          const isSelected = selectedIds.includes(node.id);
          const canExpand =
            (node.nodeKind === "source" || node.nodeKind === "session") &&
            node.sourceIds?.length &&
            !node.loading;
          const canTransfer = node.nodeKind === "expanded" && node.expandedText && !node.loading;
          return (
            <div
              key={node.id}
              className={
                "ai-node" +
                ` ai-node-${node.nodeKind}` +
                (isSelected ? " selected" : "") +
                (isSelected && selectedIds.length > 1 ? " multi-selected" : "") +
                (node.loading ? " loading" : "") +
                (node.error ? " error" : "")
              }
              style={{
                left: node.x - r,
                top: node.y - r,
                width: r * 2,
                height: r * 2,
              }}
              title={node.preview || node.expandedText || node.label}
              draggable={canTransfer && !spaceHeld}
              onDragStart={(e) => {
                if (!canTransfer || spaceHeld) return;
                e.stopPropagation();
                e.dataTransfer.setData(AI_OUTPUT_MIME, node.expandedText);
                e.dataTransfer.effectAllowed = "copy";
              }}
              onPointerDown={(e) => startNodeDrag(e, node)}
              onClick={(e) => {
                e.stopPropagation();
                if (e.shiftKey) {
                  onSelect?.(node.id, { toggle: true });
                } else {
                  onSelect?.(node.id, { replace: true });
                }
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (canExpand) onExpandNode?.(node.id);
              }}
            >
              <span className="ai-node-starburst" aria-hidden="true" />
              <span className="ai-node-label">{truncateLabel(node.label, 12)}</span>
              {node.loading && <span className="ai-node-spinner" aria-hidden="true" />}
              {node.error && <span className="ai-node-error-dot" title={node.error} />}
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

      {nodes.length === 0 && <div className="ai-node-empty" aria-hidden="true" />}

      <div className="ai-zoom-hint" aria-hidden="true">
        {Math.round(camera.scale * 100)}%
      </div>
    </div>
  );
}

export { AI_OUTPUT_MIME };

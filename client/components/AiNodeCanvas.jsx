import React, { useCallback, useEffect, useRef, useState } from "react";
import { truncateLabel } from "../lib/ai-nodes.js";
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
  selectedId,
  onSelect,
  onMove,
  onExpandNode,
  onCanvasDrop,
  onCanvasDragOver,
  onCanvasDragLeave,
  canvasDropOver,
  spaceHeld,
  viewportRef: externalViewportRef,
}) {
  const localViewportRef = useRef(null);
  const viewportRef = externalViewportRef || localViewportRef;
  const dragRef = useRef(null);
  const panRef = useRef(null);
  const [vpSize, setVpSize] = useState({ w: 320, h: 240 });

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
    if (dragRef.current) return;
    e.preventDefault();
    panRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      cam: { ...camera },
    };

    function onMove(ev) {
      if (!panRef.current) return;
      const dx = ev.clientX - panRef.current.startX;
      const dy = ev.clientY - panRef.current.startY;
      onCameraChange?.({
        ...panRef.current.cam,
        x: panRef.current.cam.x + dx,
        y: panRef.current.cam.y + dy,
      });
    }

    function onUp() {
      panRef.current = null;
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
    e.stopPropagation();
    onSelect?.(node.id);
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = node.x;
    const origY = node.y;
    dragRef.current = { nodeId: node.id, startX, startY, origX, origY, scale: camera.scale };

    function onMove(ev) {
      if (!dragRef.current) return;
      const dx = (ev.clientX - dragRef.current.startX) / dragRef.current.scale;
      const dy = (ev.clientY - dragRef.current.startY) / dragRef.current.scale;
      onMove?.(dragRef.current.nodeId, dragRef.current.origX + dx, dragRef.current.origY + dy);
    }

    function onUp() {
      dragRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  function handleViewportPointerDown(e) {
    const onVoid =
      e.target === e.currentTarget ||
      e.target.classList.contains("ai-void-bg") ||
      e.target.classList.contains("ai-starfield");
    if (spaceHeld || e.button === 1 || (e.button === 0 && onVoid)) {
      startPan(e);
      return;
    }
  }

  const connections = [];
  for (const node of nodes) {
    for (const sid of node.sourceNodeIds || []) {
      const src = nodes.find((n) => n.id === sid);
      if (src) connections.push({ from: src, to: node });
    }
  }

  const starOffsetX = ((camera.x * 0.02) % 1) * 100;
  const starOffsetY = ((camera.y * 0.02) % 1) * 100;

  return (
    <div
      ref={viewportRef}
      className={
        "ai-node-viewport" +
        (canvasDropOver ? " drop-over" : "") +
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
          {connections.map(({ from, to }) => (
            <line
              key={`${from.id}-${to.id}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              className="ai-node-line"
            />
          ))}
        </svg>

        {nodes.map((node) => {
          const r = node.radius || 40;
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
                (selectedId === node.id ? " selected" : "") +
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
              draggable={canTransfer}
              onDragStart={(e) => {
                if (!canTransfer) return;
                e.stopPropagation();
                e.dataTransfer.setData(AI_OUTPUT_MIME, node.expandedText);
                e.dataTransfer.effectAllowed = "copy";
              }}
              onPointerDown={(e) => startNodeDrag(e, node)}
              onClick={(e) => {
                e.stopPropagation();
                onSelect?.(node.id);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (canExpand) onExpandNode?.(node.id);
              }}
            >
              <span className="ai-node-starburst" aria-hidden="true" />
              <span className="ai-node-label">{truncateLabel(node.label, 16)}</span>
              {node.loading && <span className="ai-node-spinner" aria-hidden="true" />}
              {node.error && <span className="ai-node-error-dot" title={node.error} />}
            </div>
          );
        })}
      </div>

      {nodes.length === 0 && (
        <div className="ai-node-empty">
          <p>Drop anything here — instant node.</p>
          <p className="ai-empty-hint">Pan empty space · scroll to zoom · space+drag to pan</p>
        </div>
      )}

      <div className="ai-zoom-hint" aria-hidden="true">
        {Math.round(camera.scale * 100)}%
      </div>
    </div>
  );
}

export { AI_OUTPUT_MIME };

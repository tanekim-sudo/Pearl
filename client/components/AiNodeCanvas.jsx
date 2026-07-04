import React, { useRef } from "react";
import { truncateLabel } from "../lib/ai-nodes.js";

const AI_OUTPUT_MIME = "application/lens-ai-output";

export default function AiNodeCanvas({
  nodes,
  selectedId,
  onSelect,
  onMove,
  onExpandNode,
}) {
  const dragRef = useRef(null);

  const connections = [];
  for (const node of nodes) {
    for (const sid of node.sourceNodeIds || []) {
      const src = nodes.find((n) => n.id === sid);
      if (src) connections.push({ from: src, to: node });
    }
  }

  function startNodeDrag(e, node) {
    if (e.button !== 0) return;
    e.stopPropagation();
    onSelect?.(node.id);
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = node.x;
    const origY = node.y;
    dragRef.current = { nodeId: node.id, startX, startY, origX, origY };

    function onMove(ev) {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
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

  return (
    <div
      className={"ai-node-canvas" + (nodes.length ? "" : " empty")}
      onClick={() => onSelect?.(null)}
    >
      {nodes.length === 0 ? (
        <div className="ai-node-empty">
          <p>Drop thoughts, moves, or sessions here.</p>
          <p className="ai-empty-hint">Expanded results appear as connected circles.</p>
        </div>
      ) : (
        <>
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
                <span className="ai-node-label">{truncateLabel(node.label, 16)}</span>
                {node.loading && <span className="ai-node-spinner" aria-hidden="true" />}
                {node.error && <span className="ai-node-error-dot" title={node.error} />}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

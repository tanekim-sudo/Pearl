import React, { useEffect, useMemo, useState } from "react";
import { edgeGeometry } from "../lib/ai-nodes.js";

/**
 * Walking a shared path — the receiver is taken inside the nodes and arrows:
 * the camera moves along the constellation step by step, each stop showing
 * the operation that produced the node and the node's content. They can leave
 * a note on any step, branch off to work from a node, return to the original
 * flow, or materialize the whole path into their own AI space.
 */
export default function PathWalkOverlay({
  path,
  stepIndex,
  notes,
  onStepChange,
  onNoteChange,
  onBranch,
  onMakeMine,
  onLeave,
}) {
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const byId = useMemo(() => new Map(path.nodes.map((n) => [n.id, n])), [path]);
  const step = path.steps[stepIndex];
  const node = byId.get(step?.nodeId);
  const last = stepIndex >= path.steps.length - 1;
  const walkedIds = useMemo(
    () => new Set(path.steps.slice(0, stepIndex + 1).map((s) => s.nodeId)),
    [path, stepIndex]
  );

  // camera: current node centered, constellation breathing around it
  const scale = 1.35;
  const camX = vp.w / 2 - (node?.x || 0) * scale;
  const camY = vp.h * 0.42 - (node?.y || 0) * scale;

  useEffect(() => {
    function onKey(e) {
      const typing = e.target.isContentEditable || /^(INPUT|TEXTAREA)$/.test(e.target.tagName || "");
      if (typing && e.key !== "Escape") return;
      if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        onStepChange(stepIndex + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        onStepChange(stepIndex - 1);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onLeave();
      } else if (e.key.toLowerCase() === "b") {
        e.preventDefault();
        onBranch();
      }
    }
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [stepIndex, onStepChange, onLeave, onBranch]);

  if (!step || !node) return null;
  const content = (node.expandedText || node.preview || node.goldenFragment || node.label || "").trim();
  const note = notes[node.id] || "";

  return (
    <div className="path-walk" data-pw-step={stepIndex}>
      <svg className="path-walk-space" width="100%" height="100%">
        <g
          className="path-walk-camera"
          style={{ transform: `translate(${camX}px, ${camY}px) scale(${scale})` }}
        >
          {path.edges.map((e) => {
            const from = byId.get(e.fromId);
            const to = byId.get(e.toId);
            if (!from || !to) return null;
            const geo = edgeGeometry(from, to, { invScale: 1 / scale });
            const lit = walkedIds.has(e.fromId) && walkedIds.has(e.toId);
            return (
              <g key={e.id} className={"pw-edge" + (lit ? " lit" : "")}>
                <path d={geo.path} fill="none" />
                {geo.cx != null && (
                  <text x={geo.cx} y={geo.cy - 7} className="pw-edge-label" textAnchor="middle">
                    {e.label}
                  </text>
                )}
              </g>
            );
          })}
          {path.nodes.map((n) => {
            const isCurrent = n.id === node.id;
            const visited = walkedIds.has(n.id);
            return (
              <g
                key={n.id}
                className={
                  "pw-node" + (isCurrent ? " current" : "") + (visited ? " visited" : "")
                }
                onClick={() => {
                  const i = path.steps.findIndex((s) => s.nodeId === n.id);
                  if (i >= 0) onStepChange(i);
                }}
              >
                <circle cx={n.x} cy={n.y} r={n.radius || 20} />
                {isCurrent && (
                  <circle className="pw-node-halo" cx={n.x} cy={n.y} r={(n.radius || 20) + 9} />
                )}
                {notes[n.id]?.trim() && (
                  <circle
                    className="pw-note-dot"
                    cx={n.x + (n.radius || 20) * 0.85}
                    cy={n.y - (n.radius || 20) * 0.85}
                    r="4"
                  />
                )}
                <text x={n.x} y={n.y + (n.radius || 20) + 16} textAnchor="middle" className="pw-node-label">
                  {(n.label || "").slice(0, 26)}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      <div className="walk-footer path-walk-footer" onPointerDown={(e) => e.stopPropagation()}>
        <div className="walk-verb">
          <span className="walk-glyph">{step.arrived ? "◉" : "✦"}</span>
          <span className="walk-verb-name">{step.arrived ? "arrival" : `step ${stepIndex + 1}`}</span>
          <span className="pw-caption">{step.arrived ? "where the path arrives" : step.caption}</span>
        </div>
        {content && <div className="pw-content">{content}</div>}
        <textarea
          className="pw-note"
          placeholder="leave a note on this step…"
          value={note}
          rows={1}
          onChange={(e) => onNoteChange(node.id, e.target.value)}
        />
        <div className="walk-progress">
          {path.steps.map((s, i) => (
            <span
              key={s.nodeId}
              className={"walk-dot" + (i === stepIndex ? " on" : i < stepIndex ? " past" : "")}
            />
          ))}
        </div>
        <div className="walk-controls">
          <button className="walk-btn" disabled={stepIndex === 0} onClick={() => onStepChange(stepIndex - 1)}>
            ←
          </button>
          <span className="walk-count">
            {stepIndex + 1} / {path.steps.length}
          </span>
          <button
            className="walk-btn primary"
            onClick={() => (last ? onMakeMine() : onStepChange(stepIndex + 1))}
          >
            {last ? "make it mine" : "→"}
          </button>
          <span className="walk-sep" />
          <button className="walk-btn branch" onClick={onBranch} title="stop here and work from this node — the path waits for you (b)">
            ⑂ branch here
          </button>
          {!last && (
            <button className="walk-btn branch" onClick={onMakeMine} title="materialize the whole path into your own space">
              ✦ make it mine
            </button>
          )}
          <button className="walk-btn" onClick={onLeave} title="leave the walk (esc)">
            leave
          </button>
        </div>
        <div className="walk-title">a path, sent to you · {path.title}</div>
      </div>
    </div>
  );
}

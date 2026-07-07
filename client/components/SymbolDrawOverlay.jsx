import React, { useEffect, useRef, useState } from "react";

const VIEW = 120;
const INK = "#101216";

/** Normalize canvas points to 0–1 for portable symbol storage. */
function normalizePoints(points, w, h) {
  return points.map((p) => ({ x: p.x / w, y: p.y / h }));
}

function drawStroke(ctx, points, color, width) {
  if (points.length < 2) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();
}

export default function SymbolDrawOverlay({ title, onComplete, onCancel }) {
  const canvasRef = useRef(null);
  const pointsRef = useRef([]);
  const [hasStroke, setHasStroke] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, VIEW, VIEW);
    ctx.fillStyle = "#faf8f2";
    ctx.fillRect(0, 0, VIEW, VIEW);
  }, []);

  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, VIEW, VIEW);
    ctx.fillStyle = "#faf8f2";
    ctx.fillRect(0, 0, VIEW, VIEW);
    drawStroke(ctx, pointsRef.current, INK, 2.8);
  };

  const localFromEvent = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = VIEW / rect.width;
    const scaleY = VIEW / rect.height;
    return {
      x: Math.max(0, Math.min(VIEW, (e.clientX - rect.left) * scaleX)),
      y: Math.max(0, Math.min(VIEW, (e.clientY - rect.top) * scaleY)),
    };
  };

  const finish = () => {
    const pts = pointsRef.current;
    if (pts.length < 2) return;
    onComplete?.({
      viewSize: VIEW,
      points: normalizePoints(pts, VIEW, VIEW),
      color: INK,
      width: 2.8,
    });
  };

  return (
    <div className="symbol-draw-scrim" onPointerDown={(e) => e.stopPropagation()}>
      <div className="symbol-draw-panel">
        <div className="symbol-draw-head">
          <span className="symbol-draw-label">draw a symbol</span>
          <h3 className="symbol-draw-title">{title || "this idea"}</h3>
          <p className="symbol-draw-hint">A mark that stands for the concept — not the steps.</p>
        </div>
        <canvas
          ref={canvasRef}
          className="symbol-draw-canvas"
          width={VIEW}
          height={VIEW}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            pointsRef.current = [localFromEvent(e)];
            setHasStroke(true);
            redraw();
          }}
          onPointerMove={(e) => {
            if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
            pointsRef.current.push(localFromEvent(e));
            redraw();
          }}
          onPointerUp={(e) => {
            try {
              e.currentTarget.releasePointerCapture(e.pointerId);
            } catch {
              /* ignore */
            }
            if (pointsRef.current.length >= 2) finish();
          }}
        />
        <div className="symbol-draw-actions">
          <button type="button" className="symbol-draw-skip" onClick={() => onCancel?.()}>
            skip
          </button>
          <button
            type="button"
            className="symbol-draw-save"
            disabled={!hasStroke || pointsRef.current.length < 2}
            onClick={finish}
          >
            save symbol
          </button>
        </div>
      </div>
    </div>
  );
}

/** Inline glyph preview for structure cards. */
export function SymbolGlyph({ symbolStroke, className = "" }) {
  if (!symbolStroke?.points?.length || symbolStroke.points.length < 2) return null;
  return (
    <svg
      className={"symbol-glyph" + (className ? ` ${className}` : "")}
      viewBox="0 0 1 1"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      <polyline
        points={symbolStroke.points.map((p) => `${p.x},${p.y}`).join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth={0.07}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

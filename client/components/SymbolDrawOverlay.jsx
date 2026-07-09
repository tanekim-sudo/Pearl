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

/**
 * Symbol drawing overlay. Supports multi-stroke glyphs — lifting the pen ends
 * a stroke, it does NOT finish the symbol. After saving, the overlay stays to
 * show the AI reading the symbol, then reveals the meaning it found.
 */
export default function SymbolDrawOverlay({ title, meaning, interpreting, onComplete, onCancel, onDone }) {
  const canvasRef = useRef(null);
  const strokesRef = useRef([]);
  const currentRef = useRef(null);
  const [strokeCount, setStrokeCount] = useState(0);
  const [saved, setSaved] = useState(false);

  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, VIEW, VIEW);
    ctx.fillStyle = "#faf8f2";
    ctx.fillRect(0, 0, VIEW, VIEW);
    for (const s of strokesRef.current) drawStroke(ctx, s, INK, 2.8);
    if (currentRef.current) drawStroke(ctx, currentRef.current, INK, 2.8);
  };

  useEffect(() => {
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const localFromEvent = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = VIEW / rect.width;
    const scaleY = VIEW / rect.height;
    return {
      x: Math.max(0, Math.min(VIEW, (e.clientX - rect.left) * scaleX)),
      y: Math.max(0, Math.min(VIEW, (e.clientY - rect.top) * scaleY)),
    };
  };

  const hasDrawing = () => strokesRef.current.some((s) => s.length >= 2);

  const finish = () => {
    if (!hasDrawing() || saved) return;
    const strokes = strokesRef.current.filter((s) => s.length >= 2);
    onComplete?.({
      viewSize: VIEW,
      // flattened points kept for backward compatibility with single-stroke glyphs
      points: normalizePoints(strokes.flat(), VIEW, VIEW),
      strokes: strokes.map((s) => normalizePoints(s, VIEW, VIEW)),
      color: INK,
      width: 2.8,
    });
    setSaved(true);
  };

  const clearDrawing = () => {
    strokesRef.current = [];
    currentRef.current = null;
    setStrokeCount(0);
    redraw();
  };

  return (
    <div className="symbol-draw-scrim" onPointerDown={(e) => e.stopPropagation()}>
      <div className="symbol-draw-panel">
        <div className="symbol-draw-head">
          <span className="symbol-draw-label">generator</span>
          <h3 className="symbol-draw-title">{title || "this idea"}</h3>
          {saved && interpreting ? (
            <p className="symbol-draw-reading">reading your symbol…</p>
          ) : saved && meaning ? (
            <p className="symbol-draw-meaning">{meaning}</p>
          ) : !saved ? (
            <p className="symbol-draw-hint">draw a mark for it — several strokes are fine</p>
          ) : null}
        </div>
        <canvas
          ref={canvasRef}
          className={"symbol-draw-canvas" + (saved ? " locked" : "")}
          width={VIEW}
          height={VIEW}
          onPointerDown={(e) => {
            if (saved) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            currentRef.current = [localFromEvent(e)];
            redraw();
          }}
          onPointerMove={(e) => {
            if (saved || !currentRef.current) return;
            if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
            currentRef.current.push(localFromEvent(e));
            redraw();
          }}
          onPointerUp={(e) => {
            if (saved) return;
            try {
              e.currentTarget.releasePointerCapture(e.pointerId);
            } catch {
              /* ignore */
            }
            if (currentRef.current?.length >= 2) {
              strokesRef.current.push(currentRef.current);
              setStrokeCount(strokesRef.current.length);
            }
            currentRef.current = null;
            redraw();
          }}
        />
        <div className="symbol-draw-actions">
          {!saved ? (
            <>
              <button type="button" className="symbol-draw-skip" onClick={() => onCancel?.()}>
                skip
              </button>
              {strokeCount > 0 && (
                <button type="button" className="symbol-draw-skip" onClick={clearDrawing}>
                  clear
                </button>
              )}
              <button
                type="button"
                className="symbol-draw-save"
                disabled={strokeCount === 0}
                onClick={finish}
              >
                save generator
              </button>
            </>
          ) : (
            <button
              type="button"
              className="symbol-draw-save"
              disabled={interpreting}
              onClick={() => onDone?.()}
            >
              {interpreting ? "reading…" : "done"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Inline glyph preview for structure cards. Supports multi-stroke glyphs. */
export function SymbolGlyph({ symbolStroke, className = "" }) {
  const strokes = symbolStroke?.strokes?.length
    ? symbolStroke.strokes.filter((s) => s?.length >= 2)
    : symbolStroke?.points?.length >= 2
      ? [symbolStroke.points]
      : [];
  if (!strokes.length) return null;
  return (
    <svg
      className={"symbol-glyph" + (className ? ` ${className}` : "")}
      viewBox="0 0 1 1"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      {strokes.map((s, i) => (
        <polyline
          key={i}
          points={s.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke="currentColor"
          strokeWidth={0.07}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

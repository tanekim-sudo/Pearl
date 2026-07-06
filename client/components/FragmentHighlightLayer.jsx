import React, { useRef, useState } from "react";
import { extractTextRangeFromHighlightStroke } from "../lib/highlight-text.js";

const HIGHLIGHT_INK = "#E8B923";
const HIGHLIGHT_W = 18;
const MIN_STROKE_PX = 4;

/**
 * Transparent overlay for word/fragment highlight gestures on AI-side text.
 * Default release → replace/highlight in node; Shift+release or drop on paper → spawn on paper.
 */
export default function FragmentHighlightLayer({
  active,
  text,
  fontSize,
  onFragmentReplace,
  onFragmentToPaper,
  isPaperDestination,
  className = "",
}) {
  const surfaceRef = useRef(null);
  const gestureRef = useRef(null);
  const [draft, setDraft] = useState(null);

  if (!active || !text?.trim()) {
    return null;
  }

  function toLocal(clientX, clientY) {
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect) return { x: clientX, y: clientY };
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function finishStroke(clientPoints, clientX, clientY, toPaper) {
    const el = surfaceRef.current?.querySelector(".fragment-highlight-text");
    if (!el || clientPoints.length < 2) return;
    const extracted = extractTextRangeFromHighlightStroke(el, clientPoints, HIGHLIGHT_W);
    if (!extracted?.quote) return;
    const opts = { clientX, clientY };
    if (toPaper) onFragmentToPaper?.(extracted.quote, opts);
    else onFragmentReplace?.(extracted.quote, opts);
  }

  function onPointerDown(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const pts = [{ x: e.clientX, y: e.clientY }];
    gestureRef.current = { points: pts };
    setDraft({ points: pts.map((p) => toLocal(p.x, p.y)) });
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }

    function onMove(ev) {
      if (!gestureRef.current) return;
      gestureRef.current.points.push({ x: ev.clientX, y: ev.clientY });
      setDraft({ points: gestureRef.current.points.map((p) => toLocal(p.x, p.y)) });
    }

    function onUp(ev) {
      const g = gestureRef.current;
      gestureRef.current = null;
      setDraft(null);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      if (!g?.points?.length) return;
      const len = g.points.reduce((acc, p, i, arr) => {
        if (i === 0) return 0;
        return acc + Math.hypot(p.x - arr[i - 1].x, p.y - arr[i - 1].y);
      }, 0);
      if (len >= MIN_STROKE_PX) {
        const toPaper = isPaperDestination?.(ev.clientX, ev.clientY);
        finishStroke(g.points, ev.clientX, ev.clientY, toPaper);
      }
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  const draftPath =
    draft?.points?.length > 1
      ? draft.points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")
      : null;

  return (
    <div
      ref={surfaceRef}
      className={"fragment-highlight-layer" + (className ? ` ${className}` : "")}
      onPointerDown={onPointerDown}
    >
      <div
        className="fragment-highlight-text"
        style={fontSize ? { fontSize: `${fontSize}px`, lineHeight: 1.5 } : undefined}
        aria-hidden="true"
      >
        {text}
      </div>
      {draftPath && (
        <svg className="fragment-highlight-draft" aria-hidden="true">
          <path
            d={draftPath}
            fill="none"
            stroke={HIGHLIGHT_INK}
            strokeWidth={HIGHLIGHT_W}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.92}
          />
        </svg>
      )}
    </div>
  );
}

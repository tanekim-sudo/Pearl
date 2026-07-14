import React, { useRef, useState } from "react";
import { extractFragmentRangeFromStroke } from "../lib/highlight-text.js";
import { HIGHLIGHT_INK, HIGHLIGHT_W } from "../lib/highlight-ink.js";
import { HIGHLIGHT_DRAG_THRESHOLD, HIGHLIGHT_MARK_MIN_PX } from "../lib/highlight-tool.js";

/**
 * Transparent overlay for word/fragment highlight gestures on AI-side text.
 * Stroke → mark golden fragment in node; drag marked text → cross-column transfer.
 */
export default function FragmentHighlightLayer({
  active,
  text,
  fontSize,
  lineHeight,
  width,
  fontFamily,
  lockedQuote,
  onFragmentReplace,
  onTransferStart,
  className = "",
}) {
  const surfaceRef = useRef(null);
  const gestureRef = useRef(null);
  const [draft, setDraft] = useState(null);
  const [previewQuote, setPreviewQuote] = useState(null);

  if (!active || !text?.trim()) {
    return null;
  }

  const markedQuote = lockedQuote?.trim() || previewQuote?.trim() || "";

  const textStyle = {
    ...(fontSize ? { fontSize: `${fontSize}px` } : {}),
    ...(lineHeight ? { lineHeight } : {}),
    ...(width ? { width: typeof width === "number" ? `${width}px` : width } : {}),
    ...(fontFamily ? { fontFamily } : {}),
  };

  function toLocal(clientX, clientY) {
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect) return { x: clientX, y: clientY };
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function finishStroke(clientPoints, clientX, clientY) {
    const el = surfaceRef.current?.querySelector(".fragment-highlight-text");
    if (!el || clientPoints.length < 2) return;
    const extracted = extractFragmentRangeFromStroke(el, clientPoints, HIGHLIGHT_W);
    if (!extracted?.quote) return;
    const opts = { clientX, clientY };
    onFragmentReplace?.(extracted.quote, opts);
  }

  function updatePreview(clientPoints) {
    const el = surfaceRef.current?.querySelector(".fragment-highlight-text");
    if (!el || clientPoints.length < 2) {
      setPreviewQuote(null);
      return;
    }
    const extracted = extractFragmentRangeFromStroke(el, clientPoints, HIGHLIGHT_W);
    setPreviewQuote(extracted?.quote || null);
  }

  function renderMirrorText() {
    const quote = markedQuote;
    if (!quote || !text.includes(quote)) {
      return text;
    }
    const idx = text.indexOf(quote);
    const before = text.slice(0, idx);
    const after = text.slice(idx + quote.length);
    return (
      <>
        {before}
        <mark className="fragment-highlight-preview">{quote}</mark>
        {after}
      </>
    );
  }

  function startTransferDrag(e, quote) {
    if (!quote?.trim() || !onTransferStart) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    let armed = false;

    function onMove(ev) {
      if (armed) return;
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) <= HIGHLIGHT_DRAG_THRESHOLD) return;
      armed = true;
      cleanup();
      onTransferStart(ev, quote);
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

  function onPointerDown(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    if (lockedQuote?.trim() && !e.shiftKey) {
      startTransferDrag(e, lockedQuote);
      return;
    }

    const pts = [{ x: e.clientX, y: e.clientY }];
    gestureRef.current = { points: pts };
    setDraft({ points: pts.map((p) => toLocal(p.x, p.y)) });
    setPreviewQuote(null);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }

    function onMove(ev) {
      if (!gestureRef.current) return;
      gestureRef.current.points.push({ x: ev.clientX, y: ev.clientY });
      setDraft({ points: gestureRef.current.points.map((p) => toLocal(p.x, p.y)) });
      updatePreview(gestureRef.current.points);
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
      if (len < HIGHLIGHT_MARK_MIN_PX) return;

      const el = surfaceRef.current?.querySelector(".fragment-highlight-text");
      const extracted = el
        ? extractFragmentRangeFromStroke(el, g.points, HIGHLIGHT_W)
        : null;
      const quote = extracted?.quote?.trim();
      if (!quote) return;

      if (ev.shiftKey) {
        finishStroke(g.points, ev.clientX, ev.clientY);
        return;
      }

      // The first stroke only creates the persistent word mark. Transfer is a
      // separate, intentional gesture that starts from the locked mark on the
      // next pointer-down; conflating the two made ordinary highlighting fire
      // a cross-domain drag on pointer-up.
      finishStroke(g.points, ev.clientX, ev.clientY);
      setPreviewQuote(null);
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
      className={
        "fragment-highlight-layer" +
        (lockedQuote?.trim() ? " fragment-highlight-locked" : "") +
        (className ? ` ${className}` : "")
      }
      onPointerDown={onPointerDown}
    >
      <div className="fragment-highlight-text" style={textStyle} aria-hidden="true">
        {renderMirrorText()}
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

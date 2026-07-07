import React from "react";

export const PAPER_SESSION_MIME = "application/lens-paper-session";
export { SKETCH_BUNDLE_MIME } from "../../shared/sketch-bundle.js";

export default function InterpretBoundary({
  dropOver,
  magnetActive,
  loading,
  variant = "paper-ai",
  onDragOver,
  onDragLeave,
  onDrop,
  resizeEdge,
  onResizeStart,
  resizing,
}) {
  const isToolsSeam = variant === "tools-paper";
  const resizable = Boolean(resizeEdge && onResizeStart);

  function handleResizePointerDown(e) {
    if (!resizable || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    onResizeStart(e, resizeEdge);
  }

  return (
    <div
      className={
        "interpret-boundary-hit" +
        (isToolsSeam ? " tools-seam-hit" : "") +
        (resizable ? " resizable" : "") +
        (resizing ? " resizing" : "") +
        (dropOver ? " drop-over" : "") +
        (magnetActive ? " magnet" : "") +
        (loading ? " processing" : "")
      }
      data-tour={isToolsSeam ? "tools-boundary" : "interpret-boundary"}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onPointerDown={resizable ? handleResizePointerDown : undefined}
      role={resizable ? "separator" : undefined}
      aria-orientation={resizable ? "vertical" : undefined}
      aria-label={resizable ? "Resize column" : undefined}
    >
      <div
        className={
          "interpret-boundary" +
          (isToolsSeam ? " tools-paper" : "") +
          (dropOver ? " drop-over" : "") +
          (magnetActive ? " magnet" : "") +
          (loading ? " processing" : "")
        }
        aria-hidden="true"
      />
      {resizable && <div className="interpret-boundary-grip" aria-hidden="true" />}
    </div>
  );
}

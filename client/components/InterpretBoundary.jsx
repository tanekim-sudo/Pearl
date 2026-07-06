import React from "react";

export const PAPER_SESSION_MIME = "application/lens-paper-session";
export { SKETCH_BUNDLE_MIME } from "../../shared/sketch-bundle.js";

export default function InterpretBoundary({
  dropOver,
  magnetActive,
  loading,
  onDragOver,
  onDragLeave,
  onDrop,
}) {
  return (
    <div
      className={
        "interpret-boundary-hit" +
        (dropOver ? " drop-over" : "") +
        (magnetActive ? " magnet" : "") +
        (loading ? " processing" : "")
      }
      data-tour="interpret-boundary"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div
        className={
          "interpret-boundary" +
          (dropOver ? " drop-over" : "") +
          (magnetActive ? " magnet" : "") +
          (loading ? " processing" : "")
        }
        aria-hidden="true"
      />
    </div>
  );
}

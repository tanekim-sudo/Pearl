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
}) {
  const isToolsSeam = variant === "tools-paper";
  return (
    <div
      className={
        "interpret-boundary-hit" +
        (isToolsSeam ? " tools-seam-hit" : "") +
        (dropOver ? " drop-over" : "") +
        (magnetActive ? " magnet" : "") +
        (loading ? " processing" : "")
      }
      data-tour={isToolsSeam ? "tools-boundary" : "interpret-boundary"}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
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
    </div>
  );
}

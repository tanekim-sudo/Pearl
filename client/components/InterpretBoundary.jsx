import React from "react";

export const PAPER_SESSION_MIME = "application/lens-paper-session";
export { SKETCH_BUNDLE_MIME } from "../../shared/sketch-bundle.js";

const STATUS_LABEL = {
  idle: "",
  ready: "",
  interpreting: "…",
  synced: "✓",
};

export default function InterpretBoundary({
  status = "idle",
  dropOver,
  magnetActive,
  hasPaperSession,
  loading,
  onInterpret,
  onDragOver,
  onDragLeave,
  onDrop,
}) {
  const canInterpret = hasPaperSession && !loading;
  const statusLabel = STATUS_LABEL[status] || "";

  return (
    <div
      className={
        "interpret-boundary-hit" +
        (dropOver ? " drop-over" : "") +
        (magnetActive ? " magnet" : "")
      }
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      title="Interpret"
    >
      <div
        className={
          "interpret-boundary" +
          (dropOver ? " drop-over" : "") +
          (status === "interpreting" ? " interpreting" : "") +
          (status === "synced" ? " synced" : "") +
          (status === "ready" ? " ready" : "") +
          (magnetActive ? " magnet" : "")
        }
      >
        <div className="interpret-boundary-track">
          <span className={"interpret-boundary-dot" + (loading ? " pulse" : "")} />
        </div>
        <button
          type="button"
          className="interpret-boundary-btn"
          disabled={!canInterpret}
          onClick={onInterpret}
          title="Interpret"
        >
          <span className="interpret-boundary-arrow">→</span>
          <span className="interpret-boundary-label">
            {loading ? "…" : "Interpret"}
          </span>
        </button>
        {statusLabel && (
          <span className="interpret-boundary-status">{statusLabel}</span>
        )}
      </div>
    </div>
  );
}

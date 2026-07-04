import React from "react";

export const PAPER_SESSION_MIME = "application/lens-paper-session";

const STATUS_LABEL = {
  idle: "Drop to transfer",
  ready: "Ready to interpret",
  interpreting: "Interpreting…",
  synced: "Synced",
};

export default function InterpretBoundary({
  status = "idle",
  dropOver,
  hasPaperSession,
  loading,
  onInterpret,
  onDragOver,
  onDragLeave,
  onDrop,
}) {
  const canInterpret = hasPaperSession && !loading;

  return (
    <div
      className={
        "interpret-boundary" +
        (dropOver ? " drop-over" : "") +
        (status === "interpreting" ? " interpreting" : "") +
        (status === "synced" ? " synced" : "") +
        (status === "ready" ? " ready" : "")
      }
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      title="Interpretation boundary — drag items here to send to AI"
    >
      <div className="interpret-boundary-track">
        <span className={"interpret-boundary-dot" + (loading ? " pulse" : "")} />
      </div>
      <button
        type="button"
        className="interpret-boundary-btn"
        disabled={!canInterpret}
        onClick={onInterpret}
        title={
          hasPaperSession
            ? "Send voice + drawings across boundary for AI interpretation"
            : "Record a voice + draw session first"
        }
      >
        <span className="interpret-boundary-arrow">→</span>
        <span className="interpret-boundary-label">
          {loading ? "…" : "Interpret"}
        </span>
      </button>
      <span className="interpret-boundary-status">{STATUS_LABEL[status] || STATUS_LABEL.idle}</span>
    </div>
  );
}

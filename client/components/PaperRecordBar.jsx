import React from "react";

export default function PaperRecordBar({ recording, level, durationMs, onToggle }) {
  const secs = Math.floor((durationMs || 0) / 1000);
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");

  return (
    <div className={"paper-record-micro" + (recording ? " active" : "")}>
      <button
        type="button"
        className={"paper-record-dot-btn" + (recording ? " recording" : "")}
        title={recording ? `Stop (${mm}:${ss})` : "Record voice + drawing"}
        aria-label={recording ? "Stop recording" : "Record voice + drawing"}
        onClick={onToggle}
      >
        <span
          className="paper-record-dot"
          style={
            recording
              ? { transform: `scale(${0.85 + (level || 0) * 0.35})` }
              : undefined
          }
        />
      </button>
      {recording && (
        <span className="paper-record-micro-time" aria-live="polite">
          {mm}:{ss}
        </span>
      )}
    </div>
  );
}

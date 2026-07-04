import React from "react";

export default function PaperRecordBar({ recording, level, durationMs, onToggle }) {
  const secs = Math.floor((durationMs || 0) / 1000);
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");

  return (
    <div className={"paper-record-bar" + (recording ? " active" : "")}>
      <button
        type="button"
        className={"paper-record-btn" + (recording ? " recording" : "")}
        title={recording ? "Stop recording" : "Record voice + drawing"}
        onClick={onToggle}
      >
        <span className="paper-record-dot" />
        {recording ? "Stop" : "Record"}
      </button>
      {recording && (
        <>
          <span className="paper-record-time">{mm}:{ss}</span>
          <div className="paper-record-wave" aria-hidden>
            {Array.from({ length: 12 }).map((_, i) => (
              <span
                key={i}
                className="paper-record-bar-seg"
                style={{ transform: `scaleY(${0.25 + (level || 0) * (0.5 + (i % 3) * 0.15)})` }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

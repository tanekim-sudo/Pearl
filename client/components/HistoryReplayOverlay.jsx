import React, { useCallback, useRef } from "react";

export default function HistoryReplayOverlay({
  replay,
  stepIndex,
  step,
  rects,
  playing,
  onScrub,
  onPlayPause,
  onExit,
  onBackdropClick,
}) {
  const pad = 14;
  const scrubbing = useRef(false);
  const last = stepIndex >= replay.steps.length - 1;
  const isTransfer =
    step?.kind === "transfer-to-ai" ||
    step?.kind === "transfer-to-paper" ||
    step?.kind === "highlight-transfer";

  const handleScrub = useCallback(
    (e) => {
      const idx = Number(e.target.value);
      if (!Number.isNaN(idx)) onScrub(idx);
    },
    [onScrub]
  );

  return (
    <>
      <div className="history-replay-backdrop" onPointerDown={onBackdropClick} aria-hidden />
      <svg className="history-replay-dim" width="100%" height="100%">
        <defs>
          <mask id="history-replay-holes">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {rects.map((r, i) => (
              <rect
                key={i}
                x={r.left - pad}
                y={r.top - pad}
                width={r.right - r.left + pad * 2}
                height={r.bottom - r.top + pad * 2}
                rx="10"
                fill="black"
              />
            ))}
          </mask>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.68)" mask="url(#history-replay-holes)" />
        {rects.map((r, i) => (
          <rect
            key={"ring-" + i}
            x={r.left - pad}
            y={r.top - pad}
            width={r.right - r.left + pad * 2}
            height={r.bottom - r.top + pad * 2}
            rx="10"
            fill="none"
            stroke="rgba(245, 230, 163, 0.9)"
            strokeWidth="2"
            className="history-replay-ring"
          />
        ))}
        {isTransfer &&
          rects[0] &&
          (() => {
            const r = rects[0];
            const cx = (r.left + r.right) / 2;
            const cy = (r.top + r.bottom) / 2;
            const toX = step.kind === "transfer-to-paper" ? cx - 80 : cx + 80;
            return (
              <g className={"history-replay-strand" + (step.kind === "transfer-to-paper" ? " from-ai" : " to-ai")}>
                <line x1={cx} y1={cy} x2={toX} y2={cy} stroke="rgba(120,180,255,0.55)" strokeWidth="2" />
                <circle cx={toX} cy={cy} r="5" fill="rgba(120,180,255,0.35)" className="history-replay-ghost-node" />
              </g>
            );
          })()}
      </svg>

      <div className="history-replay-bar" onPointerDown={(e) => e.stopPropagation()}>
        <button type="button" className="history-replay-btn" onClick={onPlayPause} aria-label={playing ? "Pause" : "Play"}>
          {playing ? "❚❚" : "▶"}
        </button>
        <div className="history-replay-caption" title={step?.caption}>
          {step?.caption || "…"}
        </div>
        <input
          type="range"
          className="history-replay-scrub"
          min={0}
          max={Math.max(0, replay.steps.length - 1)}
          step={1}
          value={stepIndex}
          onChange={handleScrub}
          onPointerDown={() => {
            scrubbing.current = true;
          }}
          onPointerUp={() => {
            scrubbing.current = false;
          }}
        />
        <div className="history-replay-dots">
          {replay.steps.map((s, i) => (
            <span
              key={s.id}
              className={
                "history-replay-dot" +
                (i === stepIndex ? " on" : "") +
                (i < stepIndex ? " past" : "") +
                (s.kind === "transfer-to-ai" || s.kind === "transfer-to-paper" ? " transfer" : "")
              }
            />
          ))}
        </div>
        <button type="button" className="history-replay-btn ghost" onClick={onExit} aria-label="Exit replay">
          ✕
        </button>
      </div>
    </>
  );
}

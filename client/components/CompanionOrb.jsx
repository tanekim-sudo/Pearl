import React, { useEffect, useId, useRef, useState } from "react";
import { createOrbState, setOrbPlacement } from "../../shared/orb-runtime.js";

export const ORB_PLACEMENT_KEY = "lens.orb.placement.v1";
const RAYS = Object.freeze([
  { angle: 4, start: 13, end: 35, bend: 2.1 },
  { angle: 39, start: 17, end: 36, bend: -1.4 },
  { angle: 76, start: 11, end: 34, bend: .7 },
  { angle: 121, start: 18, end: 36, bend: 1.8 },
  { angle: 164, start: 14, end: 35, bend: -1.2 },
  { angle: 207, start: 19, end: 36, bend: .9 },
  { angle: 251, start: 12, end: 34, bend: -1.8 },
  { angle: 299, start: 17, end: 36, bend: 1.1 },
  { angle: 337, start: 15, end: 35, bend: -.6 },
]);

function rayPath({ start, end, bend }) {
  return `M50 ${start} C${50 + bend} ${start + 7} ${50 - bend} ${end - 5} 50 ${end}`;
}

function readPlacement(storageKey) {
  try {
    return JSON.parse(localStorage.getItem(storageKey) || "null");
  } catch {
    return null;
  }
}

export default function CompanionOrb({
  state = createOrbState(),
  onStateChange,
  onCommand,
  onVoiceStart,
  onVoiceEnd,
  onStop,
  onUndo,
  storageKey = ORB_PLACEMENT_KEY,
  label = "Lens orb",
  compact = false,
}) {
  const titleId = useId();
  const rootRef = useRef(null);
  const dragRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState("");
  const [placement, setPlacement] = useState(() => ({ ...state.placement, ...readPlacement(storageKey) }));

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(placement));
    } catch {
      /* placement persistence is best effort */
    }
  }, [placement, storageKey]);

  function updatePlacement(next) {
    const bounded = {
      ...placement,
      ...next,
      x: Math.max(8, Math.min(window.innerWidth - 80, Number(next.x ?? placement.x))),
      y: Math.max(8, Math.min(window.innerHeight - 80, Number(next.y ?? placement.y))),
      manual: true,
    };
    setPlacement(bounded);
    onStateChange?.(setOrbPlacement(state, bounded));
  }

  function pointerDown(event) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, start: placement, moved: false };
  }

  function pointerMove(event) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.hypot(dx, dy) > 3) drag.moved = true;
    updatePlacement({ x: drag.start.x + dx, y: drag.start.y + dy, dock: "free" });
  }

  function pointerUp(event) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag?.moved) setExpanded((value) => !value);
    onVoiceEnd?.();
  }

  function keyDown(event) {
    const delta = event.shiftKey ? 32 : 8;
    if (event.key === "ArrowLeft") updatePlacement({ x: placement.x - delta });
    else if (event.key === "ArrowRight") updatePlacement({ x: placement.x + delta });
    else if (event.key === "ArrowUp") updatePlacement({ y: placement.y - delta });
    else if (event.key === "ArrowDown") updatePlacement({ y: placement.y + delta });
    else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setExpanded((value) => !value);
    } else return;
    event.preventDefault();
  }

  function submit(event) {
    event.preventDefault();
    const value = draft.trim();
    if (!value) return;
    onCommand?.(value);
    setDraft("");
  }

  const phase = state.phase || "idle";
  return (
    <aside
      ref={rootRef}
      className={`companion-orb-shell ${compact ? "compact" : ""} ${expanded ? "expanded" : ""}`}
      style={{ "--orb-x": `${placement.x}px`, "--orb-y": `${placement.y}px` }}
      data-orb-state={phase}
      data-semantic-anchor="primary-orb"
      aria-label={`${label}, ${phase}`}
    >
      <button
        type="button"
        className="companion-orb"
        aria-labelledby={titleId}
        aria-expanded={expanded}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={() => { dragRef.current = null; onVoiceEnd?.(); }}
        onKeyDown={keyDown}
        onContextMenu={(event) => event.preventDefault()}
        onMouseDown={() => onVoiceStart?.()}
        title="Hold to speak · click to expand · drag to move"
      >
        <span id={titleId} className="sr-only">{label}. Hold to speak, click to expand, or use arrow keys to move.</span>
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            <radialGradient id={`orb-core-${titleId}`} cx="42%" cy="38%">
              <stop offset="0" stopColor="#fffef4" />
              <stop offset=".48" stopColor="#f8f6ee" />
              <stop offset=".78" stopColor="#d8c89f" />
              <stop offset="1" stopColor="#9a865a" stopOpacity=".12" />
            </radialGradient>
            <radialGradient id={`orb-aura-${titleId}`}>
              <stop offset="0" stopColor="#f3e8c8" stopOpacity=".2" />
              <stop offset=".6" stopColor="#d8c28d" stopOpacity=".05" />
              <stop offset="1" stopColor="#d8c28d" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle className="orb-aura" cx="50" cy="50" r="45" fill={`url(#orb-aura-${titleId})`} />
          <g className="orb-rays">
            {RAYS.map((ray) => (
              <path key={ray.angle} d={rayPath(ray)} transform={`rotate(${ray.angle} 50 50)`} />
            ))}
          </g>
          <path className="orb-causal-trace" d="M50 14 C66 20 76 34 78 50" />
          <g className="orb-satellites">
            <circle cx="50" cy="12" r="1.5" />
            <circle cx="82" cy="56" r="1.2" />
            <circle cx="25" cy="72" r="1" />
          </g>
          <circle className="orb-halo" cx="50" cy="50" r="31" />
          <circle className="orb-approval-ring" cx="50" cy="50" r="37" />
          <circle className="orb-core" cx="50" cy="50" r="20" fill={`url(#orb-core-${titleId})`} />
          <circle className="orb-glint" cx="43" cy="42" r="5" />
        </svg>
        <span className="orb-phase" aria-hidden="true">{phase === "listening" ? "Listening" : phase === "executing" ? "Working" : ""}</span>
      </button>
      {expanded && (
        <div className="orb-ledger" role="region" aria-label="Orb command and task ledger">
          <div className="orb-ledger-head">
            <span>{state.activeIntent?.normalized || state.activeIntent?.raw || phase}</span>
            <button type="button" aria-label="Minimize orb" onClick={() => setExpanded(false)}>−</button>
          </div>
          <form onSubmit={submit}>
            <input value={draft} onChange={(event) => setDraft(event.target.value)} aria-label="Tell the orb your goal" placeholder="Tell the orb your goal…" />
            <button type="submit">Run</button>
          </form>
          <div className="orb-controls">
            <button type="button" onPointerDown={onVoiceStart} onPointerUp={onVoiceEnd}>Hold to speak</button>
            <button type="button" onClick={onStop} disabled={!onStop}>Stop</button>
            <button type="button" onClick={onUndo} disabled={!onUndo}>Undo</button>
          </div>
          {(state.trace || []).length > 0 && (
            <ol className="orb-trace" aria-label="Recent task evidence">
              {state.trace.slice(-3).reverse().map((entry) => (
                <li key={entry.id}>
                  <b>{entry.to}</b>
                  <span>{entry.evidence?.boundary || entry.evidence?.error || entry.commandId || entry.taskId || "orb task"}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </aside>
  );
}

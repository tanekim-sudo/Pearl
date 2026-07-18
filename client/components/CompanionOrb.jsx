import React, { useEffect, useId, useRef, useState } from "react";
import { createOrbState, setOrbPlacement } from "../../shared/orb-runtime.js";

export const ORB_PLACEMENT_KEY = "lens.orb.placement.v1";

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
              <stop offset=".44" stopColor="#fff" />
              <stop offset=".7" stopColor="#f0c96b" />
              <stop offset="1" stopColor="#8f641f" stopOpacity=".2" />
            </radialGradient>
          </defs>
          <g className="orb-rays">
            {Array.from({ length: 12 }, (_, index) => (
              <path key={index} d="M50 7 C48 22 52 27 50 37" transform={`rotate(${index * 30} 50 50)`} />
            ))}
          </g>
          <circle className="orb-halo" cx="50" cy="50" r="31" />
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
            <button type="button" onClick={onStop}>Stop</button>
            <button type="button" onClick={onUndo}>Undo</button>
          </div>
          {(state.trace || []).length > 0 && (
            <ol className="orb-trace" aria-label="Recent task evidence">
              {state.trace.slice(-3).reverse().map((entry) => (
                <li key={entry.id}><b>{entry.to}</b><span>{entry.commandId || entry.taskId || "orb task"}</span></li>
              ))}
            </ol>
          )}
        </div>
      )}
    </aside>
  );
}

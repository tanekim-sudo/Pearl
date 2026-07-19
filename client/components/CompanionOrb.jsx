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
  onRedo,
  storageKey = ORB_PLACEMENT_KEY,
  label = "Pearl",
  compact = false,
  featured = false,
  onContextAdd,
  onLensAdd,
  onEmitView,
  cursorMode = false,
  onCursorToggle,
  approval = null,
  onApproval,
  onWorkerCancel,
  onOrbCreate,
}) {
  const titleId = useId();
  const rootRef = useRef(null);
  const dragRef = useRef(null);
  const holdRef = useRef(null);
  const voiceStartedRef = useRef(false);
  const lightRef = useRef({ x: 0, y: 0, at: 0 });
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

  useEffect(() => {
    if (placement.manual || state.placement?.manual) return;
    if (placement.x === state.placement?.x && placement.y === state.placement?.y) return;
    setPlacement((value) => ({ ...value, ...state.placement }));
  }, [placement.manual, placement.x, placement.y, state.placement?.manual, state.placement?.x, state.placement?.y]);

  useEffect(() => {
    function keepVisible() {
      const width = rootRef.current?.offsetWidth || (featured ? 176 : 72);
      const height = rootRef.current?.offsetHeight || width;
      setPlacement((current) => {
        const x = Math.max(8, Math.min(window.innerWidth - width - 8, Number(current.x) || 8));
        const y = Math.max(8, Math.min(window.innerHeight - height - 8, Number(current.y) || 8));
        return x === current.x && y === current.y ? current : { ...current, x, y };
      });
    }
    keepVisible();
    window.addEventListener("resize", keepVisible);
    return () => window.removeEventListener("resize", keepVisible);
  }, [featured]);

  function updatePlacement(next) {
    const width = rootRef.current?.offsetWidth || (featured ? 176 : 72);
    const height = rootRef.current?.offsetHeight || width;
    const bounded = {
      ...placement,
      ...next,
      x: Math.max(8, Math.min(window.innerWidth - width - 8, Number(next.x ?? placement.x))),
      y: Math.max(8, Math.min(window.innerHeight - height - 8, Number(next.y ?? placement.y))),
      manual: true,
    };
    setPlacement(bounded);
    onStateChange?.(setOrbPlacement(state, bounded));
  }

  function pointerDown(event) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, start: placement, moved: false };
    voiceStartedRef.current = false;
    window.clearTimeout(holdRef.current);
    holdRef.current = window.setTimeout(() => {
      if (dragRef.current?.moved) return;
      voiceStartedRef.current = true;
      onVoiceStart?.();
    }, 420);
  }

  function pointerMove(event) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, ((event.clientX - bounds.left) / bounds.width - .5) * 2));
    const y = Math.max(-1, Math.min(1, ((event.clientY - bounds.top) / bounds.height - .5) * 2));
    const now = event.timeStamp || performance.now();
    const elapsed = Math.max(16, now - lightRef.current.at);
    const speed = Math.min(1, Math.hypot(x - lightRef.current.x, y - lightRef.current.y) * 120 / elapsed);
    event.currentTarget.style.setProperty("--pearl-light-x", x.toFixed(3));
    event.currentTarget.style.setProperty("--pearl-light-y", y.toFixed(3));
    event.currentTarget.style.setProperty("--pearl-motion", speed.toFixed(3));
    window.clearTimeout(lightRef.current.timer);
    const target = event.currentTarget;
    lightRef.current = {
      x,
      y,
      at: now,
      timer: window.setTimeout(() => target.style.setProperty("--pearl-motion", "0"), 140),
    };
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
    window.clearTimeout(holdRef.current);
    if (voiceStartedRef.current) onVoiceEnd?.();
    else if (!drag?.moved) setExpanded((value) => !value);
    voiceStartedRef.current = false;
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

  function drop(event) {
    event.preventDefault();
    const text = event.dataTransfer?.getData("text/plain")?.trim();
    const portable = event.dataTransfer?.getData("application/x-lens-object");
    if (!text && !portable) return;
    let object = null;
    try { object = portable ? JSON.parse(portable) : null; } catch { /* preserve malformed payload as text context */ }
    if (object && ["lens", "generator"].includes(object.kind || object.type)) {
      onLensAdd?.(object);
      return;
    }
    onContextAdd?.({
      ...(object || {}),
      id: object?.id || `orb-context:${Date.now()}`,
      kind: object?.kind || object?.type || (portable ? "object" : "text"),
      label: object?.label || object?.name || (text ? text.slice(0, 42) : "Lens material"),
      text: object?.text || text,
      portable: portable || undefined,
      priority: 1,
      pinned: false,
    });
  }

  const phase = state.phase || "idle";
  return (
    <aside
      ref={rootRef}
      className={`companion-orb-shell ${compact ? "compact" : ""} ${featured ? "featured" : ""} ${expanded ? "expanded" : ""} ${placement.minimized ? "minimized" : ""}`}
      style={{ "--orb-x": `${placement.x}px`, "--orb-y": `${placement.y}px` }}
      data-orb-state={phase}
      data-semantic-anchor="primary-orb"
      aria-label={`${label}, ${phase}`}
      onDragOver={(event) => event.preventDefault()}
      onDrop={drop}
    >
      <div className="orb-emissions" aria-live="polite">
        {(state.lenses || []).map((lens, index) => (
          <button
            type="button"
            className="orb-lens-atmosphere"
            key={lens.id || lens.name}
            style={{ "--lens-index": index, "--lens-strength": lens.strength ?? .7 }}
            aria-label={`${lens.name || "Lens"} atmosphere, strength ${Math.round((lens.strength ?? .7) * 100)} percent`}
            onClick={() => onEmitView?.("lenses")}
            draggable="true"
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "copyMove";
              event.dataTransfer.setData("text/plain", lens.name || "Lens");
              event.dataTransfer.setData("application/x-lens-object", JSON.stringify(lens));
            }}
          />
        ))}
        {(state.context || []).slice(0, 7).map((item, index) => (
          <button
            type="button"
            className="orb-context-object"
            key={item.id}
            style={{ "--context-index": index, "--context-count": Math.min(7, state.context.length) }}
            title={item.label || item.text || "Context material"}
            aria-label={`${item.label || "Context material"}, priority ${item.priority ?? 1}`}
            onClick={() => onEmitView?.("context")}
            draggable="true"
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "copyMove";
              event.dataTransfer.setData("text/plain", item.text || item.label || "Context material");
              event.dataTransfer.setData("application/x-lens-object", JSON.stringify(item));
            }}
          ><span>{item.kind === "image" ? "image" : item.kind === "scene" ? "scene" : "context"}</span></button>
        ))}
        {(state.workers || []).slice(0, 4).map((worker, index) => (
          <button type="button" className="orb-worker" key={worker.id} style={{ "--worker-index": index }} aria-label={`${worker.role || "worker"}, ${worker.status || "working"}${worker.status === "working" ? ", cancel worker" : ""}`} onClick={() => worker.status === "working" && onWorkerCancel?.(worker.id)}>
            <i />{worker.role || "worker"}
          </button>
        ))}
        {(state.candidates || []).slice(0, 6).map((candidate, index) => (
          <button type="button" className="orb-candidate" key={candidate.id} style={{ "--candidate-index": index }} onClick={() => onEmitView?.("taste")}>
            <i />{candidate.distinction || candidate.title || "Candidate"}
          </button>
        ))}
      </div>
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
        title="Hold to speak · click to expand · drag to move"
      >
        <span id={titleId} className="sr-only">{label}. Hold to speak, click to expand, or use arrow keys to move.</span>
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            <radialGradient id={`orb-core-${titleId}`} cx="39%" cy="58%" r="72%">
              <stop offset="0" stopColor="#fff7e8" />
              <stop offset=".24" stopColor="#f8f1e5" />
              <stop offset=".62" stopColor="#ebe9df" />
              <stop offset=".86" stopColor="#d8d8ce" />
              <stop offset="1" stopColor="#b9bbb3" />
            </radialGradient>
            <linearGradient id={`orb-nacre-${titleId}`} x1="8%" y1="16%" x2="92%" y2="82%">
              <stop offset="0" stopColor="#edcfc8" stopOpacity=".18" />
              <stop offset=".34" stopColor="#c9ddd4" stopOpacity=".3" />
              <stop offset=".57" stopColor="#f0dfba" stopOpacity=".22" />
              <stop offset=".76" stopColor="#e7c9c4" stopOpacity=".2" />
              <stop offset="1" stopColor="#c4d9d1" stopOpacity=".14" />
            </linearGradient>
            <linearGradient id={`orb-reflection-${titleId}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ffffff" stopOpacity=".32" />
              <stop offset=".42" stopColor="#77807f" stopOpacity=".08" />
              <stop offset=".72" stopColor="#ffffff" stopOpacity=".13" />
              <stop offset="1" stopColor="#383d3e" stopOpacity=".06" />
            </linearGradient>
            <filter id={`orb-soft-${titleId}`} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3" />
            </filter>
          </defs>
          <path className="orb-causal-trace" d="M50 14 C66 20 76 34 78 50" />
          <g className="orb-satellites">
            <circle cx="50" cy="12" r="1.5" />
            <circle cx="82" cy="56" r="1.2" />
            <circle cx="25" cy="72" r="1" />
          </g>
          <ellipse className="orb-shadow" cx="51" cy="94" rx="27" ry="2.2" />
          <circle className="orb-approval-ring" cx="50" cy="50" r="37" />
          <g className="orb-pearl">
            <circle className="orb-core" cx="50" cy="50" r="43" fill={`url(#orb-core-${titleId})`} />
            <circle className="orb-nacre" cx="50" cy="50" r="41.6" fill={`url(#orb-nacre-${titleId})`} />
            <path className="orb-nacre-fold" d="M12 55 C23 24 58 13 84 35 C65 31 48 39 40 54 C31 69 20 70 12 55Z" fill={`url(#orb-nacre-${titleId})`} filter={`url(#orb-soft-${titleId})`} />
            <circle className="orb-reflection" cx="50" cy="50" r="40.5" fill={`url(#orb-reflection-${titleId})`} />
            <ellipse className="orb-glint" cx="33" cy="28" rx="9" ry="5" transform="rotate(-38 33 28)" />
            <circle className="orb-pinlight" cx="27.5" cy="22.5" r="2.1" />
          </g>
        </svg>
        <span className="orb-phase" aria-hidden="true">{phase === "listening" ? "Listening" : phase === "executing" ? "Working" : ""}</span>
      </button>
      {expanded && (
        <div className="orb-ledger" role="region" aria-label="Orb command and task ledger">
          <div className="orb-ledger-head">
            <span>{state.activeSemanticOrbId ? `Active orb · ${state.activeSemanticOrbId}` : state.activeIntent?.normalized || state.activeIntent?.raw || phase}</span>
            <button type="button" aria-label="Minimize orb" onClick={() => {
              setExpanded(false);
              updatePlacement({ minimized: !placement.minimized });
            }}>−</button>
          </div>
          <form onSubmit={submit}>
            <input value={draft} onChange={(event) => setDraft(event.target.value)} aria-label="Tell Pearl your goal" placeholder="Tell Pearl your goal…" />
            <button type="submit">Run</button>
          </form>
          {approval && <section className="orb-approval" aria-label="Plan approval required">
            <b>{approval.title || "Review plan"}</b>
            <ol>{(approval.steps || []).slice(0, 8).map((step, index) => <li key={`${index}:${step}`}>{step}</li>)}</ol>
            <div>
              <button type="button" onClick={() => onApproval?.("accept")}>Run plan</button>
              <button type="button" onClick={() => onApproval?.("reject")}>Reject</button>
            </div>
          </section>}
          {(state.checkpoints || []).length > 0 && <details className="orb-checkpoints">
            <summary>{state.checkpoints.length} checkpoint{state.checkpoints.length === 1 ? "" : "s"}</summary>
            <ol>{state.checkpoints.slice(-8).map((checkpoint, index) => <li key={checkpoint.id || checkpoint.at || index}>
              {checkpoint.label || checkpoint.id || checkpoint.status || `Checkpoint ${index + 1}`}
            </li>)}</ol>
          </details>}
          {state.fusion?.provenance?.length > 0 && <details className="orb-checkpoints orb-fusion">
            <summary>{state.fusion.applicable ? "Verified worker fusion" : "Worker fusion needs review"}</summary>
            <ol>{state.fusion.provenance.map((entry) => <li key={`${entry.workerId}:${entry.type}`}>{entry.workerId} · {entry.type}</li>)}</ol>
          </details>}
          <div className="orb-controls">
            <button type="button" onPointerDown={onVoiceStart} onPointerUp={onVoiceEnd}>Hold to speak</button>
            <button type="button" onClick={() => onEmitView?.("context")}>Context</button>
            <button type="button" onClick={() => onEmitView?.("library")}>Library</button>
            <button type="button" onClick={() => onEmitView?.("actions")}>Actions</button>
            <button type="button" onClick={() => onOrbCreate?.()}>New orb</button>
            <button type="button" aria-pressed={cursorMode} onClick={() => onCursorToggle?.(!cursorMode)}>
              {cursorMode ? "Native cursor" : "Become cursor"}
            </button>
            <button type="button" onClick={() => updatePlacement({ dock: "left", x: 12 })}>Dock left</button>
            <button type="button" onClick={() => updatePlacement({ dock: "right", x: window.innerWidth - 84 })}>Dock right</button>
            <button type="button" onClick={onStop} disabled={!onStop}>Stop</button>
            <button type="button" onClick={onUndo} disabled={!onUndo}>Undo</button>
            <button type="button" onClick={onRedo} disabled={!onRedo}>Redo</button>
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

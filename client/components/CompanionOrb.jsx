import React, { useEffect, useId, useRef, useState } from "react";
import { createOrbState, setOrbPlacement } from "../../shared/orb-runtime.js";
import { pearlActionPrompt, searchPearlActions } from "../lib/pearl-shell.js";

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
  const actionSearchRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [powerSearch, setPowerSearch] = useState(false);
  const [draft, setDraft] = useState("");
  const [actionQuery, setActionQuery] = useState("");
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

  useEffect(() => {
    function openActionSearch(event) {
      const typing = event.target?.closest?.("input,textarea,select,[contenteditable='true']");
      if (typing || !((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k")) return;
      event.preventDefault();
      setExpanded(true);
      setPowerSearch(true);
      requestAnimationFrame(() => actionSearchRef.current?.focus());
    }
    window.addEventListener("keydown", openActionSearch);
    return () => window.removeEventListener("keydown", openActionSearch);
  }, []);

  useEffect(() => {
    if (!expanded) return;
    function collapse(event) {
      if (event.type === "keydown" && event.key !== "Escape") return;
      if (event.type === "pointerdown" && rootRef.current?.contains(event.target)) return;
      setExpanded(false);
      setPowerSearch(false);
      setActionQuery("");
    }
    document.addEventListener("pointerdown", collapse, true);
    window.addEventListener("keydown", collapse, true);
    return () => {
      document.removeEventListener("pointerdown", collapse, true);
      window.removeEventListener("keydown", collapse, true);
    };
  }, [expanded]);

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
    else if (!drag?.moved) {
      setPowerSearch(false);
      setExpanded((value) => !value);
    }
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
      setPowerSearch(false);
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
  const visibleActions = powerSearch && actionQuery.trim()
    ? searchPearlActions(actionQuery).slice(0, 8)
    : [];
  const nextAction = (state.candidates || []).length
    ? { label: "Choose a result", run: () => onEmitView?.("taste") }
    : phase === "executing"
      ? { label: "Stop", run: onStop }
      : phase === "blocked" && onUndo
        ? { label: "Undo", run: onUndo }
        : (state.context || []).length && onOrbCreate
          ? { label: "Keep this", run: onOrbCreate }
          : null;
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
        title="Pearl · hold to speak"
      >
        <span id={titleId} className="sr-only">{label}. Hold to speak, click for a command, drop material, or use arrow keys to move.</span>
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            <radialGradient id={`orb-core-${titleId}`} cx="39%" cy="58%" r="72%">
              <stop offset="0" stopColor="#fffaf0" />
              <stop offset=".3" stopColor="#f5f0e7" />
              <stop offset=".68" stopColor="#e7e6de" />
              <stop offset=".88" stopColor="#d1d4ce" />
              <stop offset="1" stopColor="#aeb3af" />
            </radialGradient>
            <radialGradient id={`orb-nucleus-${titleId}`} cx="38%" cy="62%" r="58%">
              <stop offset="0" stopColor="#f2d9ce" stopOpacity=".52" />
              <stop offset=".34" stopColor="#d2e2da" stopOpacity=".34" />
              <stop offset=".7" stopColor="#eadcb9" stopOpacity=".16" />
              <stop offset="1" stopColor="#c6ced0" stopOpacity="0" />
            </radialGradient>
            <linearGradient id={`orb-nacre-${titleId}`} x1="8%" y1="16%" x2="92%" y2="82%">
              <stop offset="0" stopColor="#dfbfb9" stopOpacity=".12" />
              <stop offset=".31" stopColor="#bfd8ce" stopOpacity=".28" />
              <stop offset=".5" stopColor="#f2e4c2" stopOpacity=".18" />
              <stop offset=".69" stopColor="#d9bdba" stopOpacity=".22" />
              <stop offset="1" stopColor="#bdd3cc" stopOpacity=".1" />
            </linearGradient>
            <linearGradient id={`orb-reflection-${titleId}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ffffff" stopOpacity=".34" />
              <stop offset=".38" stopColor="#7d8987" stopOpacity=".06" />
              <stop offset=".66" stopColor="#f7f2e8" stopOpacity=".16" />
              <stop offset="1" stopColor="#303638" stopOpacity=".12" />
            </linearGradient>
            <linearGradient id={`orb-rim-${titleId}`} x1="18%" y1="8%" x2="82%" y2="92%">
              <stop offset="0" stopColor="#ffffff" stopOpacity=".78" />
              <stop offset=".48" stopColor="#eef3ef" stopOpacity=".2" />
              <stop offset=".8" stopColor="#7d8582" stopOpacity=".34" />
              <stop offset="1" stopColor="#f5eee1" stopOpacity=".5" />
            </linearGradient>
            <filter id={`orb-soft-${titleId}`} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="2.2" />
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
            <ellipse className="orb-nucleus" cx="43" cy="57" rx="25" ry="29" fill={`url(#orb-nucleus-${titleId})`} />
            <circle className="orb-nacre" cx="50" cy="50" r="41.6" fill={`url(#orb-nacre-${titleId})`} />
            <path className="orb-nacre-fold" d="M12 55 C23 24 58 13 84 35 C65 31 48 39 40 54 C31 69 20 70 12 55Z" fill={`url(#orb-nacre-${titleId})`} filter={`url(#orb-soft-${titleId})`} />
            <circle className="orb-reflection" cx="50" cy="50" r="40.5" fill={`url(#orb-reflection-${titleId})`} />
            <circle className="orb-rim" cx="50" cy="50" r="42.2" fill="none" stroke={`url(#orb-rim-${titleId})`} />
            <ellipse className="orb-glint" cx="33" cy="28" rx="9" ry="5" transform="rotate(-38 33 28)" />
            <circle className="orb-pinlight" cx="27.5" cy="22.5" r="2.1" />
          </g>
        </svg>
        <span className="orb-phase" aria-hidden="true">{phase === "listening" ? "Listening" : phase === "executing" ? "Working" : ""}</span>
      </button>
      {expanded && (
        <div className="orb-ledger" role="region" aria-label={powerSearch ? "Universal Pearl command search" : "Pearl command"}>
          <form onSubmit={submit}>
            <input
              autoFocus={!powerSearch}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              aria-label="Tell Pearl your goal"
              placeholder="What do you want?"
            />
            <button type="submit" aria-label="Send command">→</button>
          </form>
          {approval && <section className="orb-approval" aria-label="Plan approval required">
            <b>{approval.title || "Review plan"}</b>
            <ol>{(approval.steps || []).slice(0, 8).map((step, index) => <li key={`${index}:${step}`}>{step}</li>)}</ol>
            <div>
              <button type="button" onClick={() => onApproval?.("accept")}>Run plan</button>
              <button type="button" onClick={() => onApproval?.("reject")}>Reject</button>
            </div>
          </section>}
          {powerSearch && <section className="pearl-action-search" aria-label="Universal Pearl command search">
            <label>
              <span className="sr-only">Search every Pearl action by intent</span>
              <input
                ref={actionSearchRef}
                type="search"
                value={actionQuery}
                onChange={(event) => setActionQuery(event.target.value)}
                placeholder="Search by intent…"
                aria-keyshortcuts="Meta+K Control+K"
              />
            </label>
            <div className="pearl-action-results" role="list">
              {visibleActions.map((action) => <button
                type="button"
                role="listitem"
                key={action.id}
                onClick={() => {
                  onCommand?.(action.example);
                  if (!action.destructive) setExpanded(false);
                }}
              >
                <span><b>{pearlActionPrompt(action)}</b></span>
                <i>{action.destructive ? "Confirm" : "Run"}</i>
              </button>)}
              {actionQuery.trim() && !visibleActions.length && <span role="status">No match. Describe the outcome instead.</span>}
            </div>
          </section>}
          {!powerSearch && !approval && nextAction && <button
            type="button"
            className="pearl-next-action"
            onClick={() => {
              nextAction.run?.();
              setExpanded(false);
            }}
          >{nextAction.label}</button>}
        </div>
      )}
    </aside>
  );
}

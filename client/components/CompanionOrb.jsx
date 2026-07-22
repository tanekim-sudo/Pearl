import React, { useEffect, useId, useRef, useState } from "react";
import { createOrbState, setOrbPlacement } from "../../shared/orb-runtime.js";
import { pearlActionPrompt, searchPearlActions } from "../lib/pearl-shell.js";
import PhysicalPearl from "./PhysicalPearl.jsx";
import { createPearlGestureArbiter } from "../../shared/pearl-gesture-arbiter.js";
import { clampCompanionPlacement } from "../lib/companion-safety.js";

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
  onOpenStudio,
  hint = null,
  quickActions = null,
  onExpandedChange,
}) {
  const titleId = useId();
  const rootRef = useRef(null);
  const dragRef = useRef(null);
  const holdRef = useRef(null);
  const voiceStartedRef = useRef(false);
  const lightRef = useRef({ x: 0, y: 0, at: 0 });
  const actionSearchRef = useRef(null);
  const commandInputRef = useRef(null);
  const triggerRef = useRef(null);
  const actionRef = useRef({});
  actionRef.current = { onOpenStudio };
  const gestureRef = useRef(null);
  if (!gestureRef.current) {
    gestureRef.current = createPearlGestureArbiter({
      onSingle: () => {
        setPowerSearch(false);
        setExpanded((value) => !value);
      },
      onTriple: () => {
        setExpanded(false);
        actionRef.current.onOpenStudio?.();
      },
      onHold: () => onVoiceStart?.(),
    });
  }
  const [expanded, setExpanded] = useState(false);
  const [powerSearch, setPowerSearch] = useState(false);
  const [draft, setDraft] = useState("");
  const [actionQuery, setActionQuery] = useState("");
  const [placement, setPlacement] = useState(() => clampCompanionPlacement(
    { ...state.placement, ...readPlacement(storageKey) },
    { width: globalThis.innerWidth, height: globalThis.innerHeight },
    { width: featured ? 36 : 34, height: featured ? 36 : 34 },
  ));

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
      setPlacement((current) => clampCompanionPlacement(
        current,
        { width: window.innerWidth, height: window.innerHeight },
        { width, height },
      ));
    }
    keepVisible();
    window.addEventListener("resize", keepVisible);
    return () => window.removeEventListener("resize", keepVisible);
  }, [featured]);

  useEffect(() => {
    onExpandedChange?.(expanded);
  }, [expanded, onExpandedChange]);

  useEffect(() => {
    function expandFromOutside() {
      setPowerSearch(false);
      setExpanded(true);
      requestAnimationFrame(() => commandInputRef.current?.focus());
    }
    window.addEventListener("lens:companion-expand", expandFromOutside);
    return () => window.removeEventListener("lens:companion-expand", expandFromOutside);
  }, []);

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
    requestAnimationFrame(() => (powerSearch ? actionSearchRef.current : commandInputRef.current)?.focus());
    function collapse(event) {
      if (event.type === "keydown" && event.key !== "Escape") return;
      if (event.type === "pointerdown" && rootRef.current?.contains(event.target)) return;
      setExpanded(false);
      setPowerSearch(false);
      setActionQuery("");
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
    document.addEventListener("pointerdown", collapse, true);
    window.addEventListener("keydown", collapse, true);
    return () => {
      document.removeEventListener("pointerdown", collapse, true);
      window.removeEventListener("keydown", collapse, true);
    };
  }, [expanded, powerSearch]);

  function updatePlacement(next) {
    const width = rootRef.current?.offsetWidth || (featured ? 176 : 72);
    const height = rootRef.current?.offsetHeight || width;
    const bounded = clampCompanionPlacement(
      { ...placement, ...next, manual: true },
      { width: window.innerWidth, height: window.innerHeight },
      { width, height },
    );
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
      gestureRef.current.hold({ pointerId: event.pointerId });
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
    if (voiceStartedRef.current) {
      gestureRef.current.reset();
      onVoiceEnd?.();
    } else gestureRef.current.release({ at: event.timeStamp, x: event.clientX, y: event.clientY, dragged: drag?.moved, pointerType: event.pointerType });
    voiceStartedRef.current = false;
  }

  function keyDown(event) {
    if (event.key === "Enter" && event.shiftKey) {
      event.preventDefault();
      gestureRef.current.keyboard(event);
      return;
    }
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
  if (cursorMode) return null;
  return (
    <aside
      ref={rootRef}
      className={`companion-orb-shell ${compact ? "compact" : ""} ${featured ? "featured" : ""} ${expanded ? "expanded" : ""} ${placement.minimized ? "minimized" : ""} ${typeof innerWidth !== "undefined" && placement.x > innerWidth - 370 ? "opens-left" : "opens-right"} ${typeof innerHeight !== "undefined" && placement.y > innerHeight / 2 ? "opens-up" : "opens-down"}`}
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
            <PhysicalPearl variant="worker" state={worker.status === "blocked" ? "blocked" : "executing"} size={18} decorative />{worker.role || "worker"}
          </button>
        ))}
        {(state.candidates || []).slice(0, 6).map((candidate, index) => (
          <button type="button" className="orb-candidate" key={candidate.id} style={{ "--candidate-index": index }} onClick={() => onEmitView?.("taste")}>
            <PhysicalPearl variant="candidate" state="new" size={18} decorative />{candidate.distinction || candidate.title || "Candidate"}
          </button>
        ))}
      </div>
      <button
        ref={triggerRef}
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
        title="Pearl · click to ask · hold to speak · Shift+Enter for Studio"
      >
        <span id={titleId} className="sr-only">{label}. Click to ask, hold to speak, triple-click or press Shift+Enter for Studio, drop material for context, or use arrow keys to move.</span>
        <PhysicalPearl variant="primary" state={phase} size={compact ? 30 : 34} decorative />
        <span className="orb-phase" aria-hidden="true">{phase === "listening" ? "Listening" : phase === "executing" ? "Working" : ""}</span>
      </button>
      {!expanded && hint && <span className="pearl-start-hint">{hint}</span>}
      {expanded && (
        <div className="orb-ledger" role="region" aria-label={powerSearch ? "Universal Pearl command search" : "Pearl command"}>
          {!approval && <form onSubmit={submit}>
            <input
              ref={commandInputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              aria-label="Tell Pearl your goal"
              placeholder="What do you want?"
            />
            <button type="submit" aria-label="Send command">Send</button>
          </form>}
          {approval && <section className="orb-approval" aria-label="Plan approval required">
            <b>{approval.title || "Review plan"}</b>
            <span className="sr-only">{(approval.steps || []).join(". ")}</span>
            <div>
              <button type="button" onClick={() => onApproval?.("accept")}>Confirm</button>
              <button type="button" onClick={() => onApproval?.("reject")}>Cancel</button>
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
          {!powerSearch && !approval && !nextAction && onOpenStudio && <button type="button" className="pearl-next-action" onClick={onOpenStudio}>Open Studio</button>}
          {!powerSearch && !approval && quickActions?.length > 0 && <div className="pearl-quick-actions" role="group" aria-label="Pearl quick actions">
            {quickActions.map((quick) => <button
              type="button"
              key={quick.label}
              style={{ "--quick-index": quickActions.indexOf(quick) }}
              onClick={() => {
                setExpanded(false);
                quick.run?.();
              }}
            >{quick.label}</button>)}
          </div>}
        </div>
      )}
    </aside>
  );
}

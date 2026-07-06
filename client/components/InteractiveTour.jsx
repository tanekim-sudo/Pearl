import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  TOUR_PHASES,
  TOUR_STEPS,
  getPhaseIndex,
  isStepComplete,
  snapshotTourBaseline,
} from "../lib/onboarding-steps.js";

function parseInstruction(text) {
  return (text || "").split(/\*\*(.+?)\*\*/g).map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="tour-strong">
        {part}
      </strong>
    ) : (
      part
    )
  );
}

function DemoAnimation({ kind }) {
  if (!kind) return null;
  return (
    <div className={"tour-demo tour-demo-" + kind} aria-hidden="true">
      {kind === "split-pulse" && (
        <>
          <span className="tour-demo-paper" />
          <span className="tour-demo-boundary" />
          <span className="tour-demo-ai" />
        </>
      )}
      {kind === "draw-hint" && <svg viewBox="0 0 120 40" className="tour-demo-draw"><path d="M8 28 Q40 4 72 20 T112 12" /></svg>}
      {kind === "loop-hint" && <svg viewBox="0 0 80 60" className="tour-demo-loop"><ellipse cx="40" cy="30" rx="28" ry="20" /></svg>}
      {kind === "pan-zoom-hint" && (
        <>
          <span className="tour-demo-hand" />
          <span className="tour-demo-zoom-ring" />
        </>
      )}
      {kind === "clone-hint" && (
        <>
          <span className="tour-demo-box" />
          <span className="tour-demo-ghost" />
        </>
      )}
      {kind === "transfer-hint" && <span className="tour-demo-streak" />}
      {kind === "constellation-glow" && (
        <>
          <span className="tour-demo-cell" />
          <span className="tour-demo-cell delay" />
          <span className="tour-demo-cell delay2" />
        </>
      )}
      {kind === "strand-fan" && (
        <svg viewBox="0 0 100 80" className="tour-demo-strands">
          <circle cx="50" cy="60" r="8" className="tour-strand-node" />
          <line x1="50" y1="52" x2="20" y2="10" className="tour-strand-line" />
          <line x1="50" y1="52" x2="50" y2="8" className="tour-strand-line delay" />
          <line x1="50" y1="52" x2="80" y2="10" className="tour-strand-line delay2" />
        </svg>
      )}
      {kind === "complete-glow" && <span className="tour-demo-complete-ring" />}
      {kind === "pulse" && <span className="tour-demo-pulse-ring" />}
    </div>
  );
}

function Spotlight({ rects }) {
  const pad = 14;
  if (!rects.length) {
    return (
      <svg className="tour-dim" width="100%" height="100%">
        <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.62)" />
      </svg>
    );
  }
  return (
    <svg className="tour-dim" width="100%" height="100%">
      <defs>
        <mask id="tour-holes">
          <rect x="0" y="0" width="100%" height="100%" fill="white" />
          {rects.map((r, i) => (
            <rect
              key={i}
              x={r.left - pad}
              y={r.top - pad}
              width={r.right - r.left + pad * 2}
              height={r.bottom - r.top + pad * 2}
              rx="14"
              fill="black"
            />
          ))}
        </mask>
      </defs>
      <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.68)" mask="url(#tour-holes)" />
      {rects.map((r, i) => (
        <rect
          key={"ring-" + i}
          x={r.left - pad}
          y={r.top - pad}
          width={r.right - r.left + pad * 2}
          height={r.bottom - r.top + pad * 2}
          rx="14"
          fill="none"
          stroke="rgba(245, 196, 90, 0.92)"
          strokeWidth="2"
          className="tour-hole-ring"
        />
      ))}
    </svg>
  );
}

export default function InteractiveTour({
  stepIndex,
  tourContext,
  tourState,
  onStepChange,
  onComplete,
  onSkipAll,
}) {
  const step = TOUR_STEPS[stepIndex];
  const [rects, setRects] = useState(/** @type {DOMRect[]} */ ([]));
  const [verified, setVerified] = useState(false);
  const [entered, setEntered] = useState(false);
  const [typedLen, setTypedLen] = useState(0);

  const phaseIdx = useMemo(() => getPhaseIndex(step?.phase ?? ""), [step]);
  const instructionText = step?.instruction || "";

  const measureTargets = useCallback(() => {
    if (!step?.target) {
      setRects([]);
      return;
    }
    const nodes = document.querySelectorAll(step.target);
    const next = [];
    nodes.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) next.push(r);
    });
    setRects(next);
  }, [step]);

  useEffect(() => {
    setVerified(false);
    setEntered(false);
    setTypedLen(0);
    snapshotTourBaseline(tourContext, tourState);
    step?.onEnter?.(tourContext, tourState);
    const t = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(t);
  }, [stepIndex, step, tourContext, tourState]);

  useEffect(() => {
    measureTargets();
    const onResize = () => measureTargets();
    window.addEventListener("resize", onResize);
    const id = setInterval(measureTargets, 400);
    return () => {
      window.removeEventListener("resize", onResize);
      clearInterval(id);
    };
  }, [measureTargets]);

  useEffect(() => {
    if (!entered || !instructionText) return;
    setTypedLen(0);
    let i = 0;
    const tick = () => {
      i += 1;
      setTypedLen(i);
      if (i < instructionText.length) timer = window.setTimeout(tick, 12);
    };
    let timer = window.setTimeout(tick, 280);
    return () => clearTimeout(timer);
  }, [stepIndex, instructionText, entered]);

  useEffect(() => {
    if (step?.verifyKind === "manual") {
      setVerified(true);
      return;
    }
    const check = () => {
      if (isStepComplete(step, tourContext, tourState)) setVerified(true);
    };
    check();
    const id = setInterval(check, 350);
    return () => clearInterval(id);
  }, [step, tourContext, tourState, stepIndex]);

  if (!step) return null;

  const last = stepIndex >= TOUR_STEPS.length - 1;
  const showTryHint = step.verifyKind !== "manual" && !verified;

  function goNext() {
    if (last) onComplete();
    else onStepChange(stepIndex + 1);
  }

  function skipStep() {
    if (last) onComplete();
    else onStepChange(stepIndex + 1);
  }

  return (
    <div className="tour-root" onPointerDown={(e) => e.stopPropagation()}>
      <Spotlight rects={rects} />

      <div className={"tour-card" + (entered ? " entered" : "")}>
        <div className="tour-card-head">
          <span className="tour-mark">lens</span>
          <span className="tour-phase">{step.phase}</span>
        </div>

        <DemoAnimation kind={step.demo} />

        <h2 className="tour-title">{step.title}</h2>
        <p className="tour-instruction">
          {parseInstruction(instructionText.slice(0, typedLen))}
          {typedLen < instructionText.length && <span className="tour-cursor" aria-hidden="true" />}
        </p>
        {step.hint && verified && <p className="tour-hint">{step.hint}</p>}

        {showTryHint && (
          <div className="tour-try-banner">
            <span className="tour-try-pulse" aria-hidden="true" />
            {parseInstruction("Try it — the **Next** button unlocks when you do")}
          </div>
        )}
        {verified && step.verifyKind !== "manual" && (
          <div className="tour-done-banner">✓ Nice — you got it</div>
        )}

        <div className="tour-phase-track">
          {TOUR_PHASES.map((p, i) => (
            <span
              key={p}
              className={"tour-phase-dot" + (i === phaseIdx ? " on" : i < phaseIdx ? " past" : "")}
              title={p}
            />
          ))}
        </div>

        <div className="tour-step-dots">
          {TOUR_STEPS.map((s, i) => (
            <span key={s.id} className={"tour-step-dot" + (i === stepIndex ? " on" : i < stepIndex ? " past" : "")} />
          ))}
        </div>

        <div className="tour-controls">
          <button type="button" className="tour-btn" disabled={stepIndex === 0} onClick={() => onStepChange(stepIndex - 1)}>
            ←
          </button>
          <span className="tour-count">
            {stepIndex + 1} / {TOUR_STEPS.length}
          </span>
          {verified || step.allowSkip ? (
            <button type="button" className="tour-btn primary" onClick={goNext}>
              {last ? "Start thinking" : "Next →"}
            </button>
          ) : (
            <button type="button" className="tour-btn primary" disabled>
              Next →
            </button>
          )}
          {!verified && step.allowSkip && (
            <button type="button" className="tour-btn ghost" onClick={skipStep}>
              Skip step
            </button>
          )}
          <button type="button" className="tour-btn ghost" onClick={onSkipAll}>
            Exit tour
          </button>
        </div>
      </div>
    </div>
  );
}

export { TOUR_STEPS };

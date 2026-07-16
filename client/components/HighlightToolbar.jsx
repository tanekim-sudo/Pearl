import React, { useEffect, useRef, useState } from "react";

/**
 * Floating toolbar for the omni-highlighter's living selection.
 * Appears whenever highlighted material exists (paper items, AI nodes, or
 * both) and offers the operations that make highlights a verb, not a color.
 */
export default function HighlightToolbar({
  paperCount = 0,
  aiCount = 0,
  fragmentCount = 0,
  railCount = 0,
  ops = [],
  onOperate,
  onExtend,
  onSameness,
  onSaveLens,
  onMakeNode,
  onSendToAi,
  onClear,
  pendingStack = [],
  stackPreview = null,
  generatorNeedsChoice = false,
  generatorMode = null,
  onGeneratorMode,
  executing = false,
  confirmCount = null,
  onDisarm,
  onApplyArmed,
  onRemovePending,
  onReorderPending,
  onSavePending,
}) {
  const [opsOpen, setOpsOpen] = useState(false);
  const rootRef = useRef(null);
  const total = paperCount + aiCount + fragmentCount + railCount;

  useEffect(() => {
    if (!opsOpen) return undefined;
    const close = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpsOpen(false);
    };
    window.addEventListener("pointerdown", close, true);
    return () => window.removeEventListener("pointerdown", close, true);
  }, [opsOpen]);

  if (!total && !pendingStack.length) return null;

  const parts = [];
  if (paperCount) parts.push(`${paperCount} highlighted`);
  if (fragmentCount) parts.push(`${fragmentCount} phrase${fragmentCount === 1 ? "" : "s"}`);
  if (aiCount) parts.push(`${aiCount} node${aiCount === 1 ? "" : "s"}`);
  if (railCount) parts.push(`${railCount} card${railCount === 1 ? "" : "s"}`);
  const countLabel = parts.join(" · ");

  return (
    <div className="omni-highlight-bar" ref={rootRef} onPointerDown={(e) => e.stopPropagation()}>
      <span className="omni-highlight-count">
        <span className="omni-highlight-dot" />
        {countLabel || "brush material"}
      </span>
      {pendingStack.length > 0 && (
        <span className="omni-highlight-stack">
          {pendingStack.map((entry, index) => (
            <span className="omni-highlight-stack-chip" key={`${entry.kind}:${entry.id}`}>
              <b>{index + 1}</b> {entry.name}
              {entry.kind === "lens" && (
                <>
                  <button type="button" disabled={index === 0} aria-label={`Move ${entry.name} earlier`} onClick={() => onReorderPending?.(index, index - 1)}>←</button>
                  <button type="button" disabled={index >= pendingStack.filter((item) => item.kind === "lens").length - 1} aria-label={`Move ${entry.name} later`} onClick={() => onReorderPending?.(index, index + 1)}>→</button>
                </>
              )}
              <button type="button" onClick={() => onRemovePending?.(index)}>×</button>
            </span>
          ))}
        </span>
      )}
      {pendingStack.length > 1 && (
        <button type="button" className="omni-highlight-btn quiet" onClick={onSavePending}>
          save stack as Function
        </button>
      )}
      {generatorNeedsChoice && (
        <span className="brush-generator-choice" role="group" aria-label="Lens context">
          <button type="button" className={generatorMode === "source" ? "active" : ""} onClick={() => onGeneratorMode?.("source")}>
            collect source, then operate
          </button>
          <button type="button" onClick={() => onGeneratorMode?.("none")}>operate only</button>
        </span>
      )}
      {pendingStack.some((entry) => entry.kind === "lens") && total > 0 && !generatorNeedsChoice && (
        <button
          type="button"
          className="omni-highlight-btn primary brush-go"
          onClick={onApplyArmed}
          disabled={executing || (stackPreview && !stackPreview.ok)}
          aria-label={confirmCount ? `Confirm GO for ${confirmCount} outputs` : "GO — execute pending brush stack"}
          title={stackPreview?.errors?.[0] || `Commit once · ${stackPreview?.count || 1} predicted output(s) · Command/Control+Enter`}
        >
          GO ➜ {stackPreview?.count > 1 ? <small>{stackPreview.count} outputs</small> : null}
        </button>
      )}
      {pendingStack.length > 0 && (
        <button
          type="button"
          className="omni-highlight-btn quiet"
          onClick={onDisarm}
          aria-label="Disarm brush target"
          title="Clear pending stack (Escape)"
        >
          ×
        </button>
      )}
      {total > 0 && (
        <>
      <span className="omni-highlight-sep" />
      <div className="omni-highlight-op-wrap">
        <button type="button" className="omni-highlight-btn" onClick={() => setOpsOpen((o) => !o)}>
          ƒ operate
        </button>
        {opsOpen && (
          <div className="omni-highlight-ops">
            {ops.length ? (
              ops.map((op) => (
                <button
                  key={op.id}
                  type="button"
                  className="omni-highlight-op"
                  onClick={() => {
                    setOpsOpen(false);
                    onOperate?.(op);
                  }}
                >
                  {op.name}
                </button>
              ))
            ) : (
              <span className="omni-highlight-op empty">no lenses yet</span>
            )}
          </div>
        )}
      </div>
      <button type="button" className="omni-highlight-btn" onClick={onExtend} title="Expand the perceptual field of everything highlighted">
        extend
      </button>
      <button
        type="button"
        className="omni-highlight-btn"
        onClick={onSameness}
        disabled={paperCount < 2}
        title={paperCount < 2 ? "Highlight at least two paper items" : "Find the hidden structure they share"}
      >
        find sameness
      </button>
      <button type="button" className="omni-highlight-btn" onClick={onSaveLens} title="Save the whole selection into an emerging Lens workspace">
        save as Lens
      </button>
      <button
        type="button"
        className="omni-highlight-btn primary make-node"
        onClick={onMakeNode}
        title="Combine all highlighted material into one source node"
      >
        make node
      </button>
      <button
        type="button"
        className="omni-highlight-btn"
        onClick={onSendToAi}
        disabled={!paperCount && !fragmentCount}
        title="Send the highlighted paper material into the AI space"
      >
        send to AI
      </button>
      <span className="omni-highlight-sep" />
      <button type="button" className="omni-highlight-btn quiet" onClick={onClear} title="Clear the selection (Esc)">
        ✕
      </button>
        </>
      )}
    </div>
  );
}

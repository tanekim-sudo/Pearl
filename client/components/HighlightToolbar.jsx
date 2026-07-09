import React, { useEffect, useRef, useState } from "react";

/**
 * Floating toolbar for the omni-highlighter's living selection.
 * Appears whenever highlighted material exists (paper items, AI nodes, or
 * both) and offers the operations that make highlights a verb, not a color.
 */
export default function HighlightToolbar({
  paperCount = 0,
  aiCount = 0,
  ops = [],
  onOperate,
  onExtend,
  onSameness,
  onSaveLens,
  onSendToAi,
  onClear,
}) {
  const [opsOpen, setOpsOpen] = useState(false);
  const rootRef = useRef(null);
  const total = paperCount + aiCount;

  useEffect(() => {
    if (!opsOpen) return undefined;
    const close = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpsOpen(false);
    };
    window.addEventListener("pointerdown", close, true);
    return () => window.removeEventListener("pointerdown", close, true);
  }, [opsOpen]);

  if (!total) return null;

  const countLabel =
    paperCount && aiCount
      ? `${paperCount} on paper · ${aiCount} in AI`
      : paperCount
        ? `${paperCount} highlighted`
        : `${aiCount} node${aiCount === 1 ? "" : "s"} marked`;

  return (
    <div className="omni-highlight-bar" ref={rootRef} onPointerDown={(e) => e.stopPropagation()}>
      <span className="omni-highlight-count">
        <span className="omni-highlight-dot" />
        {countLabel}
      </span>
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
              <span className="omni-highlight-op empty">no functions yet</span>
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
      <button type="button" className="omni-highlight-btn" onClick={onSaveLens} title="Save the whole selection as lens material">
        save as lens
      </button>
      <button
        type="button"
        className="omni-highlight-btn"
        onClick={onSendToAi}
        disabled={!paperCount}
        title="Send the highlighted paper material into the AI space"
      >
        send to AI
      </button>
      <span className="omni-highlight-sep" />
      <button type="button" className="omni-highlight-btn quiet" onClick={onClear} title="Clear the selection (Esc)">
        ✕
      </button>
    </div>
  );
}

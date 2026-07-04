import React from "react";

const THOUGHT_MIME = "application/lens-thought";
const SEL_MIME = "application/lens-selection";
const OP_MIME = "application/lens-op";
const AI_OUTPUT_MIME = "application/lens-ai-output";

export { THOUGHT_MIME, SEL_MIME, OP_MIME, AI_OUTPUT_MIME };

export default function AiColumn({
  panel,
  dropOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onExpand,
  onEditExpanded,
  onCopy,
  onClear,
}) {
  const { sourcePreview, sourceText, expandedText, loading, error, opLabel } = panel || {};

  return (
    <aside
      className={"ai-column" + (dropOver ? " column-drop-over" : "")}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <header className="ai-column-head">
        <h2 className="ai-column-title">AI Layer</h2>
        <span className="ai-column-sub">expand on thoughts</span>
      </header>

      <div className="ai-column-body">
        {!panel?.sourceIds?.length && !loading ? (
          <div className="ai-empty">
            <p>Select a canvas item or drag a thought here to expand.</p>
            <p className="ai-empty-hint">Drop functions from the left to preview transforms.</p>
          </div>
        ) : (
          <>
            <section className="ai-source-section">
              <div className="ai-section-label">Source</div>
              <div className="ai-source-box">
                {sourcePreview || sourceText?.slice(0, 400) || "…"}
              </div>
            </section>

            <div className="ai-actions">
              <button
                type="button"
                className="ai-expand-btn"
                disabled={loading || !panel?.sourceIds?.length}
                onClick={onExpand}
              >
                {loading ? "Expanding…" : opLabel ? `Run · ${opLabel}` : "Expand"}
              </button>
              {expandedText && (
                <>
                  <button type="button" className="ai-action-btn" onClick={onCopy} title="Copy">
                    Copy
                  </button>
                  <button type="button" className="ai-action-btn" onClick={onClear} title="Clear">
                    Clear
                  </button>
                </>
              )}
            </div>

            {error && <div className="ai-error">{error}</div>}

            {expandedText && (
              <section className="ai-result-section">
                <div className="ai-section-label">
                  Expanded
                  <span className="ai-drag-hint" draggable onDragStart={(e) => {
                    e.dataTransfer.setData(AI_OUTPUT_MIME, expandedText);
                    e.dataTransfer.effectAllowed = "copy";
                  }}>
                    ⠿ drag to canvas
                  </span>
                </div>
                <textarea
                  className="ai-result-text"
                  value={expandedText}
                  onChange={(e) => onEditExpanded(e.target.value)}
                  rows={12}
                />
              </section>
            )}

            {loading && (
              <div className="ai-loading">
                <span className="ai-loading-dot" />
                <span>Thinking…</span>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

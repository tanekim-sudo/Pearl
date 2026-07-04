import React from "react";

const THOUGHT_MIME = "application/lens-thought";
const SEL_MIME = "application/lens-selection";
const OP_MIME = "application/lens-op";
const AI_OUTPUT_MIME = "application/lens-ai-output";

export { THOUGHT_MIME, SEL_MIME, OP_MIME, AI_OUTPUT_MIME };

export default function AiColumn({
  panel,
  section,
  onSectionChange,
  dropOver,
  libraryDropOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onLibraryDragOver,
  onLibraryDragLeave,
  onLibraryDrop,
  onExpand,
  onEditExpanded,
  onCopy,
  onClear,
  library,
}) {
  const { sourcePreview, sourceText, expandedText, loading, error, opLabel } = panel || {};
  const hasSource = panel?.sourceIds?.length || loading;

  return (
    <aside
      className={"ai-column" + (dropOver ? " column-drop-over" : "")}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <header className="ai-column-head">
        <h2 className="ai-column-title">AI Layer</h2>
        <div className="ai-section-tabs">
          <button
            type="button"
            className={"ai-section-tab" + (section === "expand" ? " on" : "")}
            onClick={() => onSectionChange("expand")}
          >
            Expand
          </button>
          <button
            type="button"
            className={"ai-section-tab" + (section === "library" ? " on" : "")}
            onClick={() => onSectionChange("library")}
          >
            Moves & lenses
          </button>
        </div>
      </header>

      {section === "expand" ? (
        <div className="ai-column-body">
          {!hasSource ? (
            <div className="ai-empty">
              <p>Select something on the paper or drag a move here to expand.</p>
              <p className="ai-empty-hint">Switch to Moves & lenses to browse functions, lenses, and structures.</p>
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
                    <span
                      className="ai-drag-hint"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(AI_OUTPUT_MIME, expandedText);
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                    >
                      ⠿ drag to paper
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
      ) : (
        <div
          className={"ai-library-wrap" + (libraryDropOver ? " drop-over" : "")}
          onDragOver={onLibraryDragOver}
          onDragLeave={onLibraryDragLeave}
          onDrop={onLibraryDrop}
        >
          {library}
        </div>
      )}
    </aside>
  );
}

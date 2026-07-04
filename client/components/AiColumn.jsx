import React from "react";
import AiNodeCanvas from "./AiNodeCanvas.jsx";

const THOUGHT_MIME = "application/lens-thought";
const SEL_MIME = "application/lens-selection";
const OP_MIME = "application/lens-op";
const AI_OUTPUT_MIME = "application/lens-ai-output";

export { THOUGHT_MIME, SEL_MIME, OP_MIME, AI_OUTPUT_MIME };

export default function AiColumn({
  nodes,
  selectedNodeId,
  onSelectNode,
  onMoveNode,
  onExpandNode,
  panel,
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
  const selectedNode = nodes?.find((n) => n.id === selectedNodeId);
  const detailNode =
    selectedNode ||
    (panel?.expandedText || panel?.loading
      ? nodes?.find((n) => n.nodeKind === "expanded" && (n.loading || n.expandedText))
      : nodes?.find((n) => n.nodeKind === "source")) ||
    null;

  const expandedText = detailNode?.expandedText ?? panel?.expandedText;
  const loading = detailNode?.loading ?? panel?.loading;
  const error = detailNode?.error ?? panel?.error;
  const hasDetail = detailNode || panel?.sourceIds?.length || loading;

  return (
    <aside
      className={"ai-column" + (dropOver ? " column-drop-over" : "")}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <header className="ai-column-head">
        <h2 className="ai-column-title">AI Layer</h2>
        <span className="ai-column-sub">nodes · moves · lenses</span>
      </header>

      <div className="ai-column-body unified">
        <section className="ai-nodes-section">
          <div className="ai-section-label">Active nodes</div>
          <AiNodeCanvas
            nodes={nodes || []}
            selectedId={selectedNodeId}
            onSelect={onSelectNode}
            onMove={onMoveNode}
            onExpandNode={onExpandNode}
          />
        </section>

        {hasDetail && (
          <section className="ai-detail-section">
            {detailNode?.preview && detailNode.nodeKind === "source" && (
              <div className="ai-source-box">{detailNode.preview}</div>
            )}
            {!detailNode?.preview && panel?.sourcePreview && (
              <div className="ai-source-box">{panel.sourcePreview}</div>
            )}

            <div className="ai-actions">
              <button
                type="button"
                className="ai-expand-btn"
                disabled={loading || !(detailNode?.sourceIds?.length || panel?.sourceIds?.length)}
                onClick={onExpand}
              >
                {loading ? "Expanding…" : panel?.opLabel ? `Run · ${panel.opLabel}` : "Expand"}
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
                  <button
                    type="button"
                    className="ai-transfer-chip"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(AI_OUTPUT_MIME, expandedText);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    title="Drag onto paper to place as text"
                  >
                    → Paper
                  </button>
                </div>
                <textarea
                  className="ai-result-text"
                  value={expandedText}
                  onChange={(e) => onEditExpanded(e.target.value, detailNode?.id)}
                  rows={8}
                />
              </section>
            )}

            {loading && !expandedText && (
              <div className="ai-loading">
                <span className="ai-loading-dot" />
                <span>Thinking…</span>
              </div>
            )}
          </section>
        )}

        <section
          className={"ai-library-section" + (libraryDropOver ? " drop-over" : "")}
          onDragOver={onLibraryDragOver}
          onDragLeave={onLibraryDragLeave}
          onDrop={onLibraryDrop}
        >
          <div className="ai-section-label">Moves & lenses</div>
          <div className="ai-library-wrap">{library}</div>
        </section>
      </div>
    </aside>
  );
}

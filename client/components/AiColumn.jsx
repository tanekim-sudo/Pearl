import React from "react";
import AiNodeCanvas from "./AiNodeCanvas.jsx";
import AiToolbox from "./AiToolbox.jsx";
import FragmentHighlightLayer from "./FragmentHighlightLayer.jsx";

const THOUGHT_MIME = "application/lens-thought";
const SEL_MIME = "application/lens-selection";
const OP_MIME = "application/lens-op";
const AI_OUTPUT_MIME = "application/lens-ai-output";

export { THOUGHT_MIME, SEL_MIME, OP_MIME, AI_OUTPUT_MIME };

export default function AiColumn({
  nodes,
  camera,
  onCameraChange,
  selectedNodeIds,
  onSelectNode,
  onMoveNode,
  onExpandNode,
  panel,
  dropOver,
  canvasDropOver,
  libraryDropOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onCanvasDrop,
  onCanvasDragOver,
  onCanvasDragLeave,
  onLibraryDragOver,
  onLibraryDragLeave,
  onLibraryDrop,
  onExpand,
  onEditExpanded,
  onCopy,
  onClear,
  toolbox,
  spaceHeld,
  tool,
  onSpaceTransferStart,
  onFragmentTransfer,
  viewportRef,
}) {
  const selectedNode = nodes?.find((n) => selectedNodeIds?.includes(n.id));
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
      <div className="ai-column-body unified">
        <AiToolbox
          dropOver={libraryDropOver}
          onDragOver={onLibraryDragOver}
          onDragLeave={onLibraryDragLeave}
          onDrop={onLibraryDrop}
        >
          {toolbox}
        </AiToolbox>

        <section className="ai-spacetime">
          <AiNodeCanvas
            nodes={nodes || []}
            camera={camera}
            onCameraChange={onCameraChange}
            selectedIds={selectedNodeIds || []}
            onSelect={onSelectNode}
            onMove={onMoveNode}
            onExpandNode={onExpandNode}
            onCanvasDrop={onCanvasDrop}
            onCanvasDragOver={onCanvasDragOver}
            onCanvasDragLeave={onCanvasDragLeave}
            canvasDropOver={canvasDropOver}
            spaceHeld={spaceHeld}
            tool={tool}
            onSpaceTransferStart={onSpaceTransferStart}
            onFragmentTransfer={onFragmentTransfer}
            viewportRef={viewportRef}
          />

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
                  className={"ai-expand-btn" + (loading ? " loading" : "")}
                  disabled={loading || !(detailNode?.sourceIds?.length || panel?.sourceIds?.length)}
                  onClick={onExpand}
                  aria-busy={loading || undefined}
                >
                  {loading ? (
                    <span className="ai-expand-spinner" aria-hidden="true" />
                  ) : (
                    "Expand"
                  )}
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
                <section className={"ai-result-section" + (tool === "highlight" ? " ai-highlight-mode" : "")}>
                  <div className="ai-section-label">
                    Expanded
                    {tool === "highlight" ? (
                      <span className="ai-highlight-hint">highlight words → paper</span>
                    ) : (
                      <button
                        type="button"
                        className="ai-transfer-chip"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData(AI_OUTPUT_MIME, expandedText);
                          e.dataTransfer.effectAllowed = "copy";
                        }}
                        title="Drag to paper"
                      >
                        → Paper
                      </button>
                    )}
                  </div>
                  {tool === "highlight" ? (
                    <div className="ai-result-highlight-wrap">
                      <div className="ai-result-text ai-result-readonly">{expandedText}</div>
                      <FragmentHighlightLayer
                        active
                        text={expandedText}
                        onFragment={onFragmentTransfer}
                        className="ai-result-highlight"
                      />
                    </div>
                  ) : (
                    <textarea
                      className="ai-result-text"
                      value={expandedText}
                      onChange={(e) => onEditExpanded(e.target.value, detailNode?.id)}
                      rows={8}
                    />
                  )}
                </section>
              )}

            </section>
          )}
        </section>
      </div>
    </aside>
  );
}

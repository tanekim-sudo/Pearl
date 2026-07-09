import React from "react";
import AiNodeCanvas from "./AiNodeCanvas.jsx";

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
  onExploreNode,
  onReturnToConstellation,
  onFocusFromZoom,
  focusedNodeId,
  onTourEvent,
  getStrandChoices,
  onStrandSelect,
  dropOver,
  canvasDropOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onCanvasDrop,
  onCanvasDragOver,
  onCanvasDragLeave,
  tool,
  onSpaceTransferStart,
  onHighlightTransferStart,
  onHighlightMark,
  highlightMarkedIds,
  onFragmentReplace,
  onFragmentToPaper,
  isPaperDestination,
  shouldHandoffNodeDrag,
  viewportRef,
  landingNodeIds,
  growingEdgeIds,
  onPointerTrack,
  collapsed,
}) {
  return (
    <aside
      className={"ai-column" + (collapsed ? " col-collapsed" : "") + (dropOver ? " column-drop-over" : "")}
      data-tour="ai-spacetime"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onPointerEnter={(e) => onPointerTrack?.(e.clientX, e.clientY)}
      onPointerMove={(e) => onPointerTrack?.(e.clientX, e.clientY)}
    >
      <div className="ai-column-body unified">
        <section className="ai-spacetime ai-void-only">
          <AiNodeCanvas
            nodes={nodes || []}
            camera={camera}
            onCameraChange={onCameraChange}
            selectedIds={selectedNodeIds || []}
            onSelect={onSelectNode}
            onMove={onMoveNode}
            onExpandNode={onExpandNode}
            onExploreNode={onExploreNode}
            onReturnToConstellation={onReturnToConstellation}
            onFocusFromZoom={onFocusFromZoom}
            focusedNodeId={focusedNodeId}
            getStrandChoices={getStrandChoices}
            onStrandSelect={onStrandSelect}
            onCanvasDrop={onCanvasDrop}
            onCanvasDragOver={onCanvasDragOver}
            onCanvasDragLeave={onCanvasDragLeave}
            canvasDropOver={canvasDropOver}
            tool={tool}
            onSpaceTransferStart={onSpaceTransferStart}
            onHighlightTransferStart={onHighlightTransferStart}
            onHighlightMark={onHighlightMark}
            highlightMarkedIds={highlightMarkedIds}
            onFragmentReplace={onFragmentReplace}
            onFragmentToPaper={onFragmentToPaper}
            isPaperDestination={isPaperDestination}
            shouldHandoffNodeDrag={shouldHandoffNodeDrag}
            viewportRef={viewportRef}
            onTourEvent={onTourEvent}
            landingNodeIds={landingNodeIds}
            growingEdgeIds={growingEdgeIds}
            onPointerTrack={onPointerTrack}
          />
        </section>
      </div>
    </aside>
  );
}

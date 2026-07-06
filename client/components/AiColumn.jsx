import React from "react";
import AiNodeCanvas from "./AiNodeCanvas.jsx";
import AiToolbox from "./AiToolbox.jsx";

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
  focusedNodeId,
  expandToolboxSignal = 0,
  onToolboxExpanded,
  onTourEvent,
  getStrandChoices,
  onStrandSelect,
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
  toolbox,
  tool,
  onSpaceTransferStart,
  onFragmentReplace,
  onFragmentToPaper,
  isPaperDestination,
  viewportRef,
  landingNodeIds,
}) {
  return (
    <aside
      className={"ai-column" + (dropOver ? " column-drop-over" : "")}
      data-tour="ai-spacetime"
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
          expandSignal={expandToolboxSignal}
          onExpandedChange={onToolboxExpanded}
        >
          {toolbox}
        </AiToolbox>

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
            focusedNodeId={focusedNodeId}
            getStrandChoices={getStrandChoices}
            onStrandSelect={onStrandSelect}
            onCanvasDrop={onCanvasDrop}
            onCanvasDragOver={onCanvasDragOver}
            onCanvasDragLeave={onCanvasDragLeave}
            canvasDropOver={canvasDropOver}
            tool={tool}
            onSpaceTransferStart={onSpaceTransferStart}
            onFragmentReplace={onFragmentReplace}
            onFragmentToPaper={onFragmentToPaper}
            isPaperDestination={isPaperDestination}
            viewportRef={viewportRef}
            onTourEvent={onTourEvent}
            landingNodeIds={landingNodeIds}
          />
        </section>
      </div>
    </aside>
  );
}

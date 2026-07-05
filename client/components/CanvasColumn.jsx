import React, { useState } from "react";
import PageTabs from "./PageTabs.jsx";
import PaperRecordBar from "./PaperRecordBar.jsx";

const CANVAS_TOOLS = [
  { id: "select", label: "Select", icon: "↖" },
  { id: "highlight", label: "Highlight", icon: "▬" },
  { id: "pen", label: "Pen", icon: "✎" },
  { id: "marker", label: "Marker", icon: "◯" },
  { id: "eraser", label: "Eraser", icon: "⌫" },
  { id: "text", label: "Text", icon: "T" },
  { id: "sticky", label: "Note", icon: "▢" },
  { id: "image", label: "Image", icon: "🖼" },
];

export default function CanvasColumn({
  tool,
  imageArmed,
  dropOver,
  boundaryMagnet,
  onSelectTool,
  onInsertBlock,
  onPickImage,
  pages,
  activePageId,
  zoomPct,
  paperRecording,
  paperRecordLevel,
  paperRecordMs,
  onTogglePaperRecord,
  onSelectPage,
  onAddPage,
  onRenamePage,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  children,
}) {
  const [toolsOpen, setToolsOpen] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);

  return (
    <div className={"canvas-column" + (dropOver ? " column-drop-over" : "") + (boundaryMagnet ? " boundary-magnet" : "")}>
      <div className="canvas-column-main">{children}</div>

      <div
        className={"canvas-edge-top" + (toolsOpen ? " open" : "")}
        onMouseEnter={() => setToolsOpen(true)}
        onMouseLeave={() => setToolsOpen(false)}
      >
        <PageTabs
          pages={pages}
          activePageId={activePageId}
          onSelectPage={onSelectPage}
          onAddPage={onAddPage}
          onRenamePage={onRenamePage}
        />
        <div className="canvas-tools-strip">
          <button
            type="button"
            className="canvas-tools-grip"
            aria-expanded={toolsOpen}
            aria-label="Drawing tools"
            onClick={() => setToolsOpen((o) => !o)}
          >
            ···
          </button>
          <div className="canvas-column-tools">
            {CANVAS_TOOLS.map((t) => {
              const active =
                (t.id === "image" && imageArmed) ||
                (t.id !== "image" && tool === t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  className={"canvas-tool-btn" + (active ? " active" : "")}
                  title={t.label}
                  onClick={() => {
                    if (t.id === "image") onPickImage();
                    else if (t.id === "sticky" || t.id === "text") onInsertBlock(t.id);
                    else onSelectTool(t.id);
                  }}
                >
                  {t.icon}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <PaperRecordBar
        recording={paperRecording}
        level={paperRecordLevel}
        durationMs={paperRecordMs}
        onToggle={onTogglePaperRecord}
      />

      <div
        className={"canvas-edge-bottom" + (zoomOpen ? " open" : "")}
        onMouseEnter={() => setZoomOpen(true)}
        onMouseLeave={() => setZoomOpen(false)}
      >
        <button
          type="button"
          className="zoom-micro-dot"
          aria-label="Zoom"
          onClick={() => setZoomOpen((o) => !o)}
        />
        <div className="zoom-micro-panel">
          <button type="button" onClick={onZoomOut} aria-label="Zoom out">
            −
          </button>
          <button type="button" className="zoom-label" onClick={onZoomReset}>
            {zoomPct}%
          </button>
          <button type="button" onClick={onZoomIn} aria-label="Zoom in">
            +
          </button>
        </div>
      </div>
    </div>
  );
}

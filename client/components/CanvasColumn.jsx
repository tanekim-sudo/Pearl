import React from "react";
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
  onSelectTool,
  onInsertBlock,
  onPickImage,
  pages,
  activePageId,
  zoomPct,
  editMode,
  paperRecording,
  paperRecordLevel,
  paperRecordMs,
  onTogglePaperRecord,
  hasPaperSession,
  onInterpretPaper,
  onSelectPage,
  onAddPage,
  onRenamePage,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onExport,
  onToggleEdit,
  children,
}) {
  return (
    <div className={"canvas-column" + (dropOver ? " column-drop-over" : "")}>
      <div className="canvas-column-header">
        <PageTabs
          pages={pages}
          activePageId={activePageId}
          onSelectPage={onSelectPage}
          onAddPage={onAddPage}
          onRenamePage={onRenamePage}
        />
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
          {hasPaperSession && (
            <button
              type="button"
              className="canvas-tool-btn paper-interpret-btn"
              title="Interpret paper with Claude (voice + drawings)"
              onClick={onInterpretPaper}
            >
              ✦ AI
            </button>
          )}
        </div>
        <PaperRecordBar
          recording={paperRecording}
          level={paperRecordLevel}
          durationMs={paperRecordMs}
          onToggle={onTogglePaperRecord}
        />
      </div>

      <div className="canvas-column-main">{children}</div>

      <footer className="idea-bottom canvas-bottom">
        <button type="button" className={"edit-fab" + (editMode ? " active" : "")} onClick={onToggleEdit}>
          Edit
        </button>
        <div className="bottom-controls">
          <div className="zoom-controls">
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
          <button type="button" className="export-btn" onClick={onExport} title="Export">
            ↗
          </button>
        </div>
      </footer>
    </div>
  );
}

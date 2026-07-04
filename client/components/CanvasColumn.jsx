import React from "react";
import BottomBar from "./BottomBar.jsx";

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
  onSelectPage,
  onAddPage,
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
        <span className="canvas-column-label">Notebook</span>
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

      <div className="canvas-column-main">{children}</div>

      <BottomBar
        pages={pages}
        activePageId={activePageId}
        zoomPct={zoomPct}
        editMode={editMode}
        onSelectPage={onSelectPage}
        onAddPage={onAddPage}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        onZoomReset={onZoomReset}
        onExport={onExport}
        onToggleEdit={onToggleEdit}
      />
    </div>
  );
}

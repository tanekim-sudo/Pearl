import React, { useEffect, useState } from "react";
import PageTabs from "./PageTabs.jsx";
import PaperRecordBar from "./PaperRecordBar.jsx";

const TOOLS_COLLAPSED_KEY = "lens.canvas-tools.collapsed";

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
  const [toolsOpen, setToolsOpen] = useState(() => {
    try {
      return localStorage.getItem(TOOLS_COLLAPSED_KEY) === "0";
    } catch {
      return false;
    }
  });
  const [zoomOpen, setZoomOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(TOOLS_COLLAPSED_KEY, toolsOpen ? "0" : "1");
    } catch {
      /* ignore */
    }
  }, [toolsOpen]);

  return (
    <div className={"canvas-column" + (dropOver ? " column-drop-over" : "") + (boundaryMagnet ? " boundary-magnet" : "")}>
      <div className="canvas-column-main">{children}</div>

      <div className={"canvas-edge-top" + (toolsOpen ? " open" : "")}>
        <PageTabs
          pages={pages}
          activePageId={activePageId}
          onSelectPage={onSelectPage}
          onAddPage={onAddPage}
          onRenamePage={onRenamePage}
        />
        <div className={"canvas-tools-bar" + (toolsOpen ? " expanded" : " collapsed")}>
          <button
            type="button"
            className="canvas-tools-toggle"
            aria-expanded={toolsOpen}
            aria-label={toolsOpen ? "Collapse drawing tools" : "Expand drawing tools"}
            onClick={() => setToolsOpen((o) => !o)}
          >
            <span className="canvas-tools-label">Tools</span>
            <span className="canvas-tools-chevron" aria-hidden="true">
              {toolsOpen ? "▲" : "▼"}
            </span>
          </button>
          <button
            type="button"
            className={"canvas-tools-record" + (paperRecording ? " recording" : "")}
            title={paperRecording ? `Stop (${mm}:${ss})` : "Record voice + drawing"}
            aria-label={paperRecording ? "Stop recording" : "Record voice + drawing"}
            onClick={onTogglePaperRecord}
          >
            <span
              className="paper-record-dot"
              style={
                paperRecording
                  ? { transform: `scale(${0.85 + (paperRecordLevel || 0) * 0.35})` }
                  : undefined
              }
            />
          </button>
          {toolsOpen && (
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
          )}
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

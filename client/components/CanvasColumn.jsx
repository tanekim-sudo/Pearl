import React, { useEffect, useState } from "react";
import PageTabs from "./PageTabs.jsx";
import PaperRecordBar from "./PaperRecordBar.jsx";
import MicIcon from "./MicIcon.jsx";

const TOOLS_COLLAPSED_KEY = "lens.canvas-tools.collapsed";

const CANVAS_TOOLS = [
  { id: "select", label: "Select", icon: "↖" },
  { id: "highlight", label: "Highlight", icon: "▬" },
  { id: "pen", label: "Pen", icon: "✎" },
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
  expandToolsSignal = 0,
  onToolsOpenChange,
  onTourEvent,
  children,
}) {
  const secs = Math.floor((paperRecordMs || 0) / 1000);
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
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

  useEffect(() => {
    if (expandToolsSignal > 0) setToolsOpen(true);
  }, [expandToolsSignal]);

  useEffect(() => {
    onToolsOpenChange?.(toolsOpen);
    if (toolsOpen) onTourEvent?.("tools-expanded");
  }, [toolsOpen, onToolsOpenChange, onTourEvent]);

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
          dataTour="page-tabs"
        />
        <div
          className={"canvas-tools-bar" + (toolsOpen ? " expanded" : " collapsed")}
          data-tour="canvas-tools"
        >
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
            data-tour="voice-record"
            title={paperRecording ? `Stop (${mm}:${ss})` : "Record voice + drawing"}
            aria-label={paperRecording ? "Stop recording" : "Record voice + drawing"}
            onClick={onTogglePaperRecord}
          >
            <MicIcon className="paper-record-mic" recording={paperRecording} />
          </button>
          {toolsOpen && (
            <div className="canvas-column-tools">
              {CANVAS_TOOLS.map((t) => {
                const active =
                  (t.id === "image" && imageArmed) ||
                  (t.id === "text" && tool === "text") ||
                  (t.id !== "image" && t.id !== "text" && tool === t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={"canvas-tool-btn" + (active ? " active" : "")}
                    title={t.label}
                    data-tour={"tool-" + t.id}
                    onClick={() => {
                      if (t.id === "image") {
                        onTourEvent?.("tool-image");
                        onPickImage();
                      } else if (t.id === "sticky") {
                        onTourEvent?.("insert-sticky");
                        onInsertBlock(t.id);
                      } else if (t.id === "text") {
                        onTourEvent?.("insert-text");
                        onInsertBlock(t.id);
                      } else {
                        onTourEvent?.("tool-" + t.id);
                        onSelectTool(t.id);
                      }
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
        data-tour="paper-zoom"
        onMouseEnter={() => {
          setZoomOpen(true);
          onTourEvent?.("zoom-control");
        }}
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

import React, { useEffect, useState } from "react";
import PageTabs from "./PageTabs.jsx";
import PaperRecordBar from "./PaperRecordBar.jsx";
import MicIcon from "./MicIcon.jsx";

const TOOLS_COLLAPSED_KEY = "lens.canvas-tools.collapsed";

function BrushIcon({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
      <path d="M14.7 3.2 20.8 9.3 10.5 19.6 4.4 13.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="m4.4 13.5-1.2 4.1 3.2 3.2 4.1-1.2M15.8 4.3l3.9 3.9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Three cursors, Google Slides model: select doubles as the text cursor
// (click empty paper to type), pen carries the eraser as a sub-mode.
const CANVAS_TOOLS = [
  { id: "select", label: "Select — click empty paper to type", icon: "↖" },
  { id: "pen", label: "Pen — click again for eraser", icon: "✎" },
  { id: "highlight", label: "Brush / highlight", icon: <BrushIcon /> },
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
  collapsed,
  children,
}) {
  const secs = Math.floor((paperRecordMs || 0) / 1000);
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  const [toolsOpen, setToolsOpen] = useState(() => {
    try {
      const v = localStorage.getItem(TOOLS_COLLAPSED_KEY);
      if (v === null) return true;
      return v === "0";
    } catch {
      return true;
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
    <div
      className={
        "canvas-column" +
        (collapsed ? " col-collapsed" : "") +
        (dropOver ? " column-drop-over" : "") +
        (boundaryMagnet ? " boundary-magnet" : "")
      }
    >
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
            <span className="canvas-tools-label">
              {toolsOpen
                ? "Tools"
                : tool === "eraser"
                  ? "⌫"
                  : CANVAS_TOOLS.find((t) => t.id === tool)?.icon || "↖"}
            </span>
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
                const penMode = tool === "pen" || tool === "marker" || tool === "eraser";
                const active = t.id === "pen" ? penMode : tool === t.id;
                const erasing = t.id === "pen" && tool === "eraser";
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={"canvas-tool-btn" + (active ? " active" : "") + (erasing ? " erasing" : "")}
                    title={erasing ? "Eraser — click again for pen" : t.label}
                    aria-label={erasing ? "Eraser — click again for pen" : t.label}
                    data-tool={t.id}
                    data-tour={"tool-" + t.id}
                    onClick={() => {
                      if (t.id === "pen") {
                        // pen ⇄ eraser sub-mode toggle
                        const next = tool === "pen" ? "eraser" : "pen";
                        onTourEvent?.("tool-" + next);
                        onSelectTool(next);
                      } else {
                        onTourEvent?.("tool-" + t.id);
                        onSelectTool(t.id);
                      }
                    }}
                  >
                    {erasing ? "⌫" : t.icon}
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

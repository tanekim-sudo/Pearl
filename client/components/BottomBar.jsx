import React, { useState } from "react";

/** Legacy bottom bar — gutted to micro zoom dot; kept for compatibility. */
export default function BottomBar({
  pages,
  activePageId,
  zoomPct,
  onSelectPage,
  onAddPage,
  onZoomIn,
  onZoomOut,
  onZoomReset,
}) {
  const [open, setOpen] = useState(false);

  return (
    <footer className="idea-bottom idea-bottom-minimal">
      <div
        className={"canvas-edge-bottom" + (open ? " open" : "")}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <button type="button" className="zoom-micro-dot" aria-label="Zoom" />
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
    </footer>
  );
}

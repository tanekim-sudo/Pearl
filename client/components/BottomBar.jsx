import React from "react";

export default function BottomBar({
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
}) {
  return (
    <footer className="idea-bottom">
      <button type="button" className={"edit-fab" + (editMode ? " active" : "")} onClick={onToggleEdit}>
        Edit
      </button>

      <div className="page-filmstrip">
        {pages.map((page) => (
          <button
            key={page.id}
            type="button"
            className={"page-thumb" + (page.id === activePageId ? " active" : "")}
            onClick={() => onSelectPage(page.id)}
            title={page.name}
          >
            <span className="page-thumb-inner">{page.name?.slice(0, 1) || "P"}</span>
          </button>
        ))}
        <button type="button" className="page-add" onClick={onAddPage} title="Add page">
          +
        </button>
      </div>

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
        <button type="button" className="help-btn" title="Help">
          ?
        </button>
      </div>
    </footer>
  );
}

import React from "react";

export default function FunctionsColumn({
  dropOver,
  captureReplay,
  onDragOver,
  onDragLeave,
  onDrop,
  onPointerTrack,
  columnRef,
  children,
}) {
  return (
    <aside
      ref={columnRef}
      className={
        "functions-column" +
        (dropOver ? " column-drop-over" : "") +
        (captureReplay ? " capture-replay" : "")
      }
      data-tour="functions-column"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onPointerEnter={(e) => onPointerTrack?.(e.clientX, e.clientY)}
      onPointerMove={(e) => onPointerTrack?.(e.clientX, e.clientY)}
    >
      <div className="functions-column-body">{children}</div>
    </aside>
  );
}

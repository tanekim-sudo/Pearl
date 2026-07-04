import React from "react";
import ThoughtsSidebar from "./ThoughtsSidebar.jsx";

export default function FunctionsColumn({
  items,
  activePageId,
  worldFilter,
  onSelectThought,
  onNewThought,
  onSelectWorld,
  onClearWorld,
  dropOver,
  onDragOver,
  onDragLeave,
  onDrop,
  children,
}) {
  return (
    <aside
      className={"functions-column" + (dropOver ? " column-drop-over" : "")}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="functions-column-ideas">
        <ThoughtsSidebar
          items={items}
          activePageId={activePageId}
          worldFilter={worldFilter}
          onSelectThought={onSelectThought}
          onNewThought={onNewThought}
          onSelectWorld={onSelectWorld}
          onClearWorld={onClearWorld}
        />
      </div>
      <div className="functions-column-rail">{children}</div>
    </aside>
  );
}

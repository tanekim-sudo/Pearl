import React, { useState } from "react";

function MenuDropdown({ label, items, onAction }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={"menu-dropdown" + (open ? " open" : "")}>
      <button type="button" className="menu-item" onClick={() => setOpen(!open)}>
        {label}
      </button>
      {open && (
        <>
          <div className="menu-backdrop" onClick={() => setOpen(false)} />
          <div className="menu-panel">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="menu-panel-item"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  onAction(item.id);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function TopToolbar({
  title,
  starred,
  saved,
  canUndo,
  canRedo,
  onTitleChange,
  onToggleStar,
  onMenuAction,
  onUndo,
  onRedo,
  onShare,
}) {
  const menus = [
    {
      id: "file",
      label: "File",
      items: [
        { id: "export-txt", label: "Export as text" },
        { id: "export-md", label: "Export as markdown" },
        { id: "import-path", label: "Import path" },
        { id: "start-fresh", label: "Start fresh…" },
      ],
    },
    {
      id: "edit",
      label: "Edit",
      items: [
        { id: "undo", label: "Undo", disabled: !canUndo },
        { id: "redo", label: "Redo", disabled: !canRedo },
      ],
    },
    {
      id: "view",
      label: "View",
      items: [
        { id: "zoom-in", label: "Zoom in" },
        { id: "zoom-out", label: "Zoom out" },
        { id: "zoom-reset", label: "Reset zoom" },
        { id: "theme-toggle", label: "Toggle theme" },
      ],
    },
    {
      id: "insert",
      label: "Insert",
      items: [
        { id: "insert-sticky", label: "Sticky note" },
        { id: "insert-callout-obs", label: "Observation" },
        { id: "insert-callout-q", label: "Question" },
        { id: "insert-diagram", label: "Diagram" },
      ],
    },
    {
      id: "tools",
      label: "Tools",
      items: [
        { id: "open-functions", label: "Functions tab" },
        { id: "open-structures", label: "Structures tab" },
      ],
    },
    {
      id: "ai",
      label: "AI",
      items: [
        { id: "setup-role", label: "Set up for role" },
        { id: "new-function", label: "Create function" },
      ],
    },
    {
      id: "help",
      label: "Help",
      items: [{ id: "help-tips", label: "Tips & shortcuts" }],
    },
  ];

  return (
    <header className="idea-toolbar idea-toolbar-compact">
      <div className="toolbar-row toolbar-row-compact">
        <div className="toolbar-title-block">
          <input
            className="doc-title-input"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            aria-label="Document title"
          />
          <button
            type="button"
            className={"star-btn" + (starred ? " starred" : "")}
            onClick={onToggleStar}
            title={starred ? "Unstar" : "Star"}
          >
            ★
          </button>
        </div>

        <div className="toolbar-history">
          <button type="button" disabled={!canUndo} onClick={onUndo} title="Undo">
            ↩
          </button>
          <button type="button" disabled={!canRedo} onClick={onRedo} title="Redo">
            ↪
          </button>
        </div>

        <span className={"save-indicator" + (saved ? " saved" : "")}>
          {saved ? "Saved" : "Saving…"}
        </span>

        <nav className="toolbar-menus">
          {menus.map((menu) => (
            <MenuDropdown key={menu.id} label={menu.label} items={menu.items} onAction={onMenuAction} />
          ))}
        </nav>

        <div className="toolbar-spacer" />

        <button type="button" className="share-btn" onClick={onShare}>
          Share
        </button>
      </div>
    </header>
  );
}

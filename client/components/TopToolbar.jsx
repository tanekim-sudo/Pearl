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

export function FunctionsDrawer({ open, onClose, children }) {
  return (
    <>
      {open && <div className="functions-drawer-scrim" onClick={onClose} />}
      <div className={"functions-drawer-wrap" + (open ? " open" : "")}>
        <div className="functions-drawer" onClick={(e) => e.stopPropagation()}>
          {open && (
            <div className="functions-drawer-head">
              <h2>Functions & Lenses</h2>
              <button type="button" className="drawer-close" onClick={onClose} aria-label="Close">
                ×
              </button>
            </div>
          )}
          <div className="functions-drawer-body">{children}</div>
        </div>
      </div>
    </>
  );
}

export default function TopToolbar({
  title,
  starred,
  saved,
  canUndo,
  canRedo,
  tool,
  imageArmed,
  onTitleChange,
  onToggleStar,
  onMenuAction,
  onSelectTool,
  onPickImage,
  onUndo,
  onRedo,
  onShare,
}) {
  const toolbarTools = [
    { id: "select", label: "Select", icon: "↖" },
    { id: "pen", label: "Pen", icon: "✎" },
    { id: "eraser", label: "Eraser", icon: "⌫" },
    { id: "marker", label: "Shapes", icon: "◯" },
    { id: "text", label: "Text", icon: "T" },
    { id: "highlight", label: "Highlighter", icon: "▬" },
    { id: "select", label: "Rectangle", icon: "▭", alias: "rect" },
    { id: "image", label: "Image", icon: "🖼" },
    { id: "select", label: "Add", icon: "+", alias: "add" },
    { id: "select", label: "Pan", icon: "✋", alias: "pan" },
  ];

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
        { id: "open-functions", label: "Functions & lenses" },
        { id: "open-structures", label: "Structures" },
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
    <header className="idea-toolbar">
      <div className="toolbar-row toolbar-row-title">
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
        <span className={"save-indicator" + (saved ? " saved" : "")}>
          {saved ? "All changes saved" : "Saving…"}
        </span>
        <nav className="toolbar-menus">
          {menus.map((menu) => (
            <MenuDropdown key={menu.id} label={menu.label} items={menu.items} onAction={onMenuAction} />
          ))}
        </nav>
        <div className="toolbar-collab">
          <div className="collab-avatars">
            <span className="collab-avatar a1">Y</span>
            <span className="collab-avatar a2">M</span>
            <span className="collab-avatar a3">K</span>
            <span className="collab-more">+3</span>
          </div>
          <button type="button" className="share-btn" onClick={onShare}>
            <span className="share-lock">🔒</span> Share
          </button>
          <button type="button" className="comment-btn" title="Comments">
            💬
          </button>
        </div>
      </div>

      <div className="toolbar-row toolbar-row-tools">
        <div className="toolbar-history">
          <button type="button" disabled={!canUndo} onClick={onUndo} title="Undo">
            ↩
          </button>
          <button type="button" disabled={!canRedo} onClick={onRedo} title="Redo">
            ↪
          </button>
        </div>
        <div className="toolbar-tools">
          {toolbarTools.map((t, i) => {
            const active =
              (t.id === "image" && imageArmed) ||
              (t.id !== "image" && tool === t.id && !t.alias);
            return (
              <button
                key={`${t.id}-${i}`}
                type="button"
                className={"toolbar-tool" + (active ? " active" : "")}
                title={t.label}
                onClick={() => {
                  if (t.id === "image") onPickImage();
                  else if (t.alias === "pan") onMenuAction("pan-mode");
                  else if (t.alias === "add") onMenuAction("insert-sticky");
                  else onSelectTool(t.id);
                }}
              >
                {t.icon}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}

import React, { useState } from "react";

function MenuDropdown({ label, items, onAction, dataTour }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={"menu-dropdown menu-dropdown-minimal" + (open ? " open" : "")} data-tour={dataTour}>
      <button type="button" className="menu-item menu-item-minimal" onClick={() => setOpen(!open)}>
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
                data-action={item.id}
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
  starred,
  saved,
  canUndo,
  canRedo,
  onToggleStar,
  onMenuAction,
  onUndo,
  onRedo,
  onShare,
  account,
  planBadge,
  showPlans,
  onAccountAction,
}) {
  const allItems = [
    { id: "export-txt", label: "Export as text" },
    { id: "export-md", label: "Export as markdown" },
    { id: "import-path", label: "Import path" },
    { id: "start-fresh", label: "Start fresh…" },
    { id: "undo", label: "Undo", disabled: !canUndo },
    { id: "redo", label: "Redo", disabled: !canRedo },
    { id: "zoom-in", label: "Zoom in" },
    { id: "zoom-out", label: "Zoom out" },
    { id: "zoom-reset", label: "Reset zoom" },
    { id: "theme-toggle", label: "Toggle theme" },
    { id: "insert-sticky", label: "Sticky note" },
    { id: "insert-callout-obs", label: "Observation" },
    { id: "insert-callout-q", label: "Question" },
    { id: "insert-diagram", label: "Diagram" },
    { id: "open-transformations", label: "Lenses" },
    { id: "open-lenses", label: "Lenses" },
    { id: "feature-tour", label: "Feature tour" },
    { id: "setup-role", label: "Set up for role" },
    { id: "new-function", label: "Create lens" },
    { id: "get-extension", label: "Get Lens Everywhere" },
  ];
  if (showPlans) allItems.push({ id: "open-plans", label: "Plans" });

  return (
    <header className="idea-toolbar idea-toolbar-minimal">
      <div className="toolbar-row toolbar-row-minimal">
        <span className="toolbar-wordmark">lens</span>

        <div className="toolbar-hover-actions" data-tour="toolbar-actions">
          <button type="button" disabled={!canUndo} onClick={onUndo} title="Undo">
            ↩
          </button>
          <button type="button" disabled={!canRedo} onClick={onRedo} title="Redo">
            ↪
          </button>
          <button
            type="button"
            className={"star-btn star-btn-minimal" + (starred ? " starred" : "")}
            onClick={onToggleStar}
            title={starred ? "Unstar" : "Star"}
          >
            ★
          </button>
          <span className={"save-indicator save-indicator-minimal" + (saved ? " saved" : "")} aria-live="polite">
            {saved ? "" : "·"}
          </span>
        </div>

        <div className="toolbar-spacer" />

        {account &&
          (account.email ? (
            <MenuDropdown
              label={
                <>
                  {account.email}
                  {planBadge ? <span className="plan-badge">{planBadge}</span> : null}
                </>
              }
              items={[
                { id: "plans", label: "Plans" },
                { id: "sign-out", label: "Sign out" },
              ]}
              onAction={onAccountAction}
              dataTour="account-menu"
            />
          ) : (
            <button
              type="button"
              className="menu-item menu-item-minimal auth-signin"
              onClick={() => onAccountAction("sign-in")}
            >
              Sign in
            </button>
          ))}
        <MenuDropdown label="···" items={allItems} onAction={onMenuAction} dataTour="toolbar-menu" />
        <button type="button" className="share-btn share-btn-minimal" onClick={onShare} title="Share">
          ↗
        </button>
      </div>
    </header>
  );
}

import React, { useEffect, useRef, useState } from "react";

export default function PageTabs({ pages, activePageId, onSelectPage, onAddPage, onRenamePage }) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  function startRename(page) {
    if (!onRenamePage) return;
    setEditingId(page.id);
    setDraft(page.name || "Page");
  }

  function commitRename(pageId) {
    const trimmed = draft.trim();
    if (trimmed && onRenamePage) onRenamePage(pageId, trimmed);
    setEditingId(null);
  }

  return (
    <div className="page-tabs" role="tablist" aria-label="Pages">
      {pages.map((page) => (
        <div key={page.id} className={"page-tab-wrap" + (page.id === activePageId ? " active" : "")}>
          {editingId === page.id ? (
            <input
              ref={inputRef}
              className="page-tab-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => commitRename(page.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitRename(page.id);
                } else if (e.key === "Escape") {
                  setEditingId(null);
                }
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <button
              type="button"
              role="tab"
              aria-selected={page.id === activePageId}
              className={"page-tab" + (page.id === activePageId ? " active" : "")}
              onClick={() => onSelectPage(page.id)}
              onDoubleClick={(e) => {
                e.preventDefault();
                startRename(page);
              }}
              title={onRenamePage ? `${page.name} — double-click to rename` : page.name}
            >
              {page.name || "Page"}
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        className="page-tab page-tab-add"
        onClick={onAddPage}
        title="New page"
        aria-label="New page"
      >
        +
      </button>
    </div>
  );
}

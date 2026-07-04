import React from "react";

export default function PageTabs({ pages, activePageId, onSelectPage, onAddPage }) {
  return (
    <div className="page-tabs" role="tablist" aria-label="Pages">
      {pages.map((page) => (
        <button
          key={page.id}
          type="button"
          role="tab"
          aria-selected={page.id === activePageId}
          className={"page-tab" + (page.id === activePageId ? " active" : "")}
          onClick={() => onSelectPage(page.id)}
          title={page.name}
        >
          {page.name || "Page"}
        </button>
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

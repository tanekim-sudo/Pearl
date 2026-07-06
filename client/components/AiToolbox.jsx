import React, { useEffect, useState } from "react";

const COLLAPSED_KEY = "lens.toolbox.collapsed";

export default function AiToolbox({
  dropOver,
  onDragOver,
  onDragLeave,
  onDrop,
  children,
  expandSignal = 0,
  onExpandedChange,
}) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const stored = localStorage.getItem(COLLAPSED_KEY);
      if (stored === "1") return true;
      return false;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  useEffect(() => {
    if (expandSignal > 0) setCollapsed(false);
  }, [expandSignal]);

  useEffect(() => {
    if (!collapsed) onExpandedChange?.(true);
  }, [collapsed, onExpandedChange]);

  return (
    <section
      className={"ai-toolbox" + (collapsed ? " collapsed" : "") + (dropOver ? " drop-over" : "")}
      data-tour="ai-toolbox"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <button
        type="button"
        className="ai-toolbox-toggle"
        onClick={() => setCollapsed((c) => {
          const next = !c;
          if (!next) onExpandedChange?.(true);
          return next;
        })}
        aria-expanded={!collapsed}
        title={collapsed ? "Expand toolbox" : "Collapse toolbox"}
      >
        <span className="ai-toolbox-label">Tools</span>
        <span className="ai-toolbox-chevron" aria-hidden="true">
          {collapsed ? "▼" : "▲"}
        </span>
      </button>
      {!collapsed && <div className="ai-toolbox-body">{children}</div>}
    </section>
  );
}

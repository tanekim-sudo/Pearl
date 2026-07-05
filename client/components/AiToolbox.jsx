import React, { useEffect, useState } from "react";

const COLLAPSED_KEY = "lens.toolbox.collapsed";

export default function AiToolbox({
  dropOver,
  onDragOver,
  onDragLeave,
  onDrop,
  children,
}) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const stored = localStorage.getItem(COLLAPSED_KEY);
      if (stored === "0") return false;
      return true;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  return (
    <section
      className={"ai-toolbox" + (collapsed ? " collapsed" : "") + (dropOver ? " drop-over" : "")}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <button
        type="button"
        className="ai-toolbox-toggle"
        onClick={() => setCollapsed((c) => !c)}
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

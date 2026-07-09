import React from "react";

// No separate Text tool: the select cursor types (click empty paper), like Google Slides.
const PALETTE_TOOLS = [
  { id: "sticky", label: "Note", icon: "▢" },
  { id: "pen", label: "Draw", icon: "✎" },
  { id: "voice", label: "Voice", icon: "🎙" },
  { id: "image", label: "Image", icon: "🖼" },
  { id: "diagram", label: "Diagram", icon: "◎" },
  { id: "math", label: "Math", icon: "∑" },
  { id: "table", label: "Table", icon: "▦" },
  { id: "code", label: "Code", icon: "{ }" },
];

export default function RightPalette({ activeTool, onSelectTool, onInsertBlock }) {
  return (
    <aside className="idea-palette" onPointerDown={(e) => e.stopPropagation()}>
      {PALETTE_TOOLS.map((tool) => {
        const isDraw = tool.id === "pen";
        const isImage = tool.id === "image";
        const active =
          activeTool === tool.id || (isDraw && (activeTool === "pen" || activeTool === "marker"));
        return (
          <button
            key={tool.id}
            type="button"
            className={"palette-btn" + (active ? " active" : "")}
            title={tool.label}
            onClick={() => {
              if (isDraw || isImage) onSelectTool(tool.id);
              else onInsertBlock(tool.id);
            }}
          >
            <span className="palette-icon">{tool.icon}</span>
            <span className="palette-label">{tool.label}</span>
          </button>
        );
      })}
    </aside>
  );
}

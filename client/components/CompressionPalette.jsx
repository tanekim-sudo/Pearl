import React from "react";

const OP_MIME = "application/lens-op";

function CompressionChip({ op }) {
  return (
    <button
      type="button"
      className="compression-chip"
      draggable
      title={`${op.name}${op.description ? ` — ${op.description}` : ""} · drag onto paper`}
      onDragStart={(e) => {
        e.stopPropagation();
        e.dataTransfer.setData(OP_MIME, op.id);
        e.dataTransfer.effectAllowed = "copy";
      }}
    >
      <span className="compression-chip-label">{op.name}</span>
    </button>
  );
}

export default function CompressionPalette({ ops }) {
  if (!ops?.length) return null;
  return (
    <div className="compression-palette">
      <span className="compression-palette-label">Compress</span>
      <div className="compression-palette-chips">
        {ops.map((op) => (
          <CompressionChip key={op.id} op={op} />
        ))}
      </div>
    </div>
  );
}

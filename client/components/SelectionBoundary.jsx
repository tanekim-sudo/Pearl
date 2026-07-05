import React from "react";

const PAD = 10;
const EDGE = 8;

/**
 * Screen-space selection ring: dashed outer = move-original (edge handles),
 * solid inner hint = clone zone (interior drag handled by canvas input layer).
 */
export default function SelectionBoundary({ bbox, onEdgePointerDown }) {
  if (!bbox) return null;

  const w = bbox.right - bbox.left;
  const h = bbox.bottom - bbox.top;
  const left = bbox.left - PAD;
  const top = bbox.top - PAD;
  const outerW = w + PAD * 2;
  const outerH = h + PAD * 2;

  const edges = [
    { id: "n", style: { left, top: top - EDGE, width: outerW, height: EDGE } },
    { id: "s", style: { left, top: top + outerH, width: outerW, height: EDGE } },
    { id: "w", style: { left: left - EDGE, top, width: EDGE, height: outerH } },
    { id: "e", style: { left: left + outerW, top, width: EDGE, height: outerH } },
    { id: "nw", style: { left: left - EDGE, top: top - EDGE, width: EDGE, height: EDGE } },
    { id: "ne", style: { left: left + outerW, top: top - EDGE, width: EDGE, height: EDGE } },
    { id: "sw", style: { left: left - EDGE, top: top + outerH, width: EDGE, height: EDGE } },
    { id: "se", style: { left: left + outerW, top: top + outerH, width: EDGE, height: EDGE } },
  ];

  function handleEdgeDown(e) {
    e.stopPropagation();
    e.preventDefault();
    onEdgePointerDown?.(e);
  }

  return (
    <div className="selection-boundary-layer" aria-hidden="true">
      <div
        className="selection-boundary-outer"
        style={{ left, top, width: outerW, height: outerH }}
      />
      <div
        className="selection-boundary-inner"
        style={{
          left: left + EDGE,
          top: top + EDGE,
          width: outerW - EDGE * 2,
          height: outerH - EDGE * 2,
        }}
      />
      {edges.map(({ id, style }) => (
        <div
          key={id}
          className={"selection-boundary-edge selection-boundary-edge-" + id}
          style={style}
          onPointerDown={handleEdgeDown}
        />
      ))}
    </div>
  );
}

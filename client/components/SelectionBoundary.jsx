import React from "react";

const PAD = 8;
const HANDLE = 7;

/**
 * Screen-space selection handles — Google Slides style (drag anywhere on the shape to move).
 */
export default function SelectionBoundary({ bbox, onFramePointerDown }) {
  if (!bbox) return null;

  const w = bbox.right - bbox.left;
  const h = bbox.bottom - bbox.top;
  const left = bbox.left - PAD;
  const top = bbox.top - PAD;
  const outerW = w + PAD * 2;
  const outerH = h + PAD * 2;

  const handles = [
    { id: "nw", style: { left: left - HANDLE / 2, top: top - HANDLE / 2 } },
    { id: "n", style: { left: left + outerW / 2 - HANDLE / 2, top: top - HANDLE / 2 } },
    { id: "ne", style: { left: left + outerW - HANDLE / 2, top: top - HANDLE / 2 } },
    { id: "e", style: { left: left + outerW - HANDLE / 2, top: top + outerH / 2 - HANDLE / 2 } },
    { id: "se", style: { left: left + outerW - HANDLE / 2, top: top + outerH - HANDLE / 2 } },
    { id: "s", style: { left: left + outerW / 2 - HANDLE / 2, top: top + outerH - HANDLE / 2 } },
    { id: "sw", style: { left: left - HANDLE / 2, top: top + outerH - HANDLE / 2 } },
    { id: "w", style: { left: left - HANDLE / 2, top: top + outerH / 2 - HANDLE / 2 } },
  ];

  function handleFramePointerDown(e) {
    e.stopPropagation();
    e.preventDefault();
    onFramePointerDown?.(e);
  }

  return (
    <div className="selection-boundary-layer" aria-hidden="true">
      <div
        className="selection-boundary-frame"
        style={{ left, top, width: outerW, height: outerH }}
        onPointerDown={handleFramePointerDown}
      />
      {handles.map(({ id, style }) => (
        <div
          key={id}
          className={"selection-boundary-handle selection-boundary-handle-" + id}
          style={{ ...style, width: HANDLE, height: HANDLE }}
          onPointerDown={handleFramePointerDown}
        />
      ))}
    </div>
  );
}

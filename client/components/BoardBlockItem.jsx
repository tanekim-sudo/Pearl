import React, { useEffect, useRef } from "react";
import { stickyBackground } from "../lib/board-item-utils.js";

function EditableBlock({ item, className, editing, editClickRef, onCommit, style, placeholder }) {
  const ref = useRef(null);
  const seeded = useRef(false);

  useEffect(() => {
    if (editing && ref.current) {
      if (!seeded.current) {
        ref.current.innerText = item.text || "";
        seeded.current = true;
      }
      ref.current.focus();
      const pt = editClickRef?.current;
      if (pt) {
        editClickRef.current = null;
        try {
          const range = document.caretRangeFromPoint?.(pt.cx, pt.cy);
          if (range && ref.current.contains(range.startContainer)) {
            const s = window.getSelection();
            s.removeAllRanges();
            s.addRange(range);
            return;
          }
        } catch {
          /* ignore */
        }
      }
    }
    if (!editing) seeded.current = false;
  }, [editing, item.id, editClickRef]);

  if (editing) {
    return (
      <div
        ref={ref}
        className={className + " editing"}
        data-item={item.id}
        contentEditable
        suppressContentEditableWarning
        style={style}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) {
            e.preventDefault();
            onCommit(ref.current?.innerText ?? "");
          }
        }}
      />
    );
  }

  return (
    <div className={className} data-item={item.id} style={style}>
      {item.type === "callout" && (
        <span className={"callout-tag " + (item.variant || "observation")}>
          {item.variant === "question" ? "Question" : "Observation"}
        </span>
      )}
      {item.text || placeholder}
    </div>
  );
}

function VoiceBlock({ item, selected, style }) {
  const bars = item.waveform || [0.3, 0.5, 0.8, 0.4, 0.6, 0.9, 0.5, 0.3, 0.7, 0.4, 0.6, 0.8];
  const dur = item.durationLabel || (item.duration ? `0:${String(item.duration).padStart(2, "0")}` : "0:24");
  return (
    <div className={"board-voice" + (selected ? " sel" : "")} data-item={item.id} style={style}>
      <button type="button" className="voice-play" onPointerDown={(e) => e.stopPropagation()} title="Play (stub)">
        ▶
      </button>
      <div className="voice-wave">
        {bars.map((h, i) => (
          <span key={i} className="voice-bar" style={{ height: `${20 + h * 24}px` }} />
        ))}
      </div>
      <span className="voice-dur">{dur}</span>
    </div>
  );
}

function DiagramBlock({ item, selected, style }) {
  const w = item.w || 320;
  const h = item.h || 160;
  const nodes = item.nodes || [];
  const cx = nodes.find((n) => n.id === "c") || nodes[0];
  return (
    <div className={"board-diagram" + (selected ? " sel" : "")} data-item={item.id} style={style}>
      {item.title && <div className="diagram-title">{item.title}</div>}
      <svg viewBox={`0 0 ${w} ${h}`} className="diagram-svg">
        {nodes
          .filter((n) => n !== cx)
          .map((n) => (
            <line
              key={n.id}
              x1={(cx?.x ?? 0.5) * w}
              y1={(cx?.y ?? 0.2) * h + 12}
              x2={n.x * w}
              y2={n.y * h}
              stroke="currentColor"
              strokeOpacity="0.35"
            />
          ))}
        {nodes.map((n) => (
          <g key={n.id} transform={`translate(${n.x * w}, ${n.y * h})`}>
            <ellipse rx="42" ry="16" fill="var(--card)" stroke="currentColor" strokeOpacity="0.4" />
            <text textAnchor="middle" dy="4" fontSize="11" fill="currentColor">
              {n.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function TableBlock({ item, selected, style }) {
  const rows = item.rows || [
    ["A", "B"],
    ["", ""],
  ];
  return (
    <div className={"board-table" + (selected ? " sel" : "")} data-item={item.id} style={style}>
      <table>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VideoBlock({ item, selected, style }) {
  return (
    <div className={"board-video" + (selected ? " sel" : "")} data-item={item.id} style={style}>
      <div className="video-placeholder">
        <span className="video-play">▶</span>
      </div>
      <span className="video-dur">{item.duration || "1:15"}</span>
    </div>
  );
}

export default function BoardBlockItem({
  item,
  selected,
  dropTarget,
  dropMagnetic,
  editing,
  editClickRef,
  onCommit,
  itemStyle,
}) {
  const style = itemStyle(item);
  const cls =
    (selected ? " sel" : "") + (dropTarget ? " drop-target" : "") + (dropMagnetic ? " drop-magnetic" : "");

  if (item.type === "sticky") {
    return (
      <EditableBlock
        item={item}
        className={"board-sticky" + cls}
        editing={editing}
        editClickRef={editClickRef}
        onCommit={onCommit}
        style={{ ...style, background: stickyBackground(item.color) }}
        placeholder="Note…"
      />
    );
  }

  if (item.type === "callout") {
    return (
      <EditableBlock
        item={item}
        className={"board-callout " + (item.variant || "observation") + cls}
        editing={editing}
        editClickRef={editClickRef}
        onCommit={onCommit}
        style={style}
        placeholder="…"
      />
    );
  }

  if (item.type === "voice") return <VoiceBlock item={item} selected={selected} style={style} />;
  if (item.type === "diagram") return <DiagramBlock item={item} selected={selected} style={style} />;
  if (item.type === "table") return <TableBlock item={item} selected={selected} style={style} />;
  if (item.type === "video") return <VideoBlock item={item} selected={selected} style={style} />;

  if (item.type === "code") {
    return (
      <EditableBlock
        item={item}
        className={"board-code" + cls}
        editing={editing}
        editClickRef={editClickRef}
        onCommit={onCommit}
        style={style}
        placeholder="// code"
      />
    );
  }

  if (item.type === "math") {
    return (
      <EditableBlock
        item={item}
        className={"board-math" + cls}
        editing={editing}
        editClickRef={editClickRef}
        onCommit={onCommit}
        style={style}
        placeholder="E = mc²"
      />
    );
  }

  return null;
}

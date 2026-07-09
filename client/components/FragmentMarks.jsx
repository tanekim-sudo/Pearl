import React from "react";

/**
 * Render a text block with its word-level highlight marks (golden <mark>s).
 * Fragments are { start, end } offsets into the raw text; overlaps are
 * assumed merged by the store.
 */
export function renderTextWithFragmentMarks(text, fragments) {
  const raw = text || "";
  if (!fragments?.length) return raw;
  const sorted = [...fragments]
    .filter((f) => f.end > f.start && f.start < raw.length)
    .sort((a, b) => a.start - b.start);
  if (!sorted.length) return raw;
  const parts = [];
  let cursor = 0;
  for (const f of sorted) {
    const start = Math.max(cursor, f.start);
    const end = Math.min(raw.length, f.end);
    if (end <= start) continue;
    if (start > cursor) parts.push(raw.slice(cursor, start));
    parts.push(
      <mark key={f.id || `${start}-${end}`} className="hl-fragment-mark" data-fragment-item={f.itemId}>
        {raw.slice(start, end)}
      </mark>
    );
    cursor = end;
  }
  if (cursor < raw.length) parts.push(raw.slice(cursor));
  return parts;
}

/** Map a highlight stroke (client coords) to a text substring in a DOM element. */

/** All text nodes under root, in document order (mark wrappers are transparent). */
export function collectTextNodes(root) {
  if (!root) return [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let n;
  while ((n = walker.nextNode())) nodes.push(n);
  return nodes;
}

/** Resolve a global char offset to { node, offset } across root's text nodes. */
function locateOffset(nodes, globalOffset) {
  let acc = 0;
  for (const tn of nodes) {
    const len = tn.length;
    if (globalOffset <= acc + len) return { node: tn, offset: globalOffset - acc };
    acc += len;
  }
  const last = nodes[nodes.length - 1];
  return last ? { node: last, offset: last.length } : null;
}

/** Client rects for a global [start, end) range across root's text nodes. */
export function rangeClientRects(root, start, end) {
  const nodes = collectTextNodes(root);
  if (!nodes.length) return [];
  const a = locateOffset(nodes, start);
  const b = locateOffset(nodes, end);
  if (!a || !b) return [];
  try {
    const range = document.createRange();
    range.setStart(a.node, a.offset);
    range.setEnd(b.node, b.offset);
    return [...range.getClientRects()].filter((r) => r.width || r.height);
  } catch {
    return [];
  }
}

/**
 * Word-snapped fragment range hit by a stroke, across ALL text nodes under
 * root (so it keeps working after parts are wrapped in <mark> elements).
 * Returns { start, end, quote, coverage } or null. Coverage is quote length
 * relative to the full text — callers use it to decide fragment vs whole.
 */
export function extractFragmentRangeFromStroke(root, clientPoints, strokeWidth = 5) {
  if (!root || !clientPoints?.length) return null;
  const nodes = collectTextNodes(root);
  const full = nodes.map((n) => n.nodeValue).join("");
  if (!full.trim()) return null;

  const samples = sampleStrokePoints(clientPoints);
  const pad = Math.max(4, strokeWidth * 0.6);
  let minHit = Infinity;
  let maxHit = -Infinity;
  let offset = 0;
  for (const tn of nodes) {
    const len = tn.length;
    for (let i = 0; i < len; i++) {
      try {
        const range = document.createRange();
        range.setStart(tn, i);
        range.setEnd(tn, i + 1);
        const rects = range.getClientRects();
        for (let r = 0; r < rects.length; r++) {
          const cr = rects[r];
          if (!cr.width && !cr.height) continue;
          if (samples.some((s) => pointNearRect(s.x, s.y, cr, pad))) {
            const g = offset + i;
            if (g < minHit) minHit = g;
            if (g > maxHit) maxHit = g;
            break;
          }
        }
      } catch {
        /* skip bad range */
      }
    }
    offset += len;
  }
  if (!Number.isFinite(minHit)) return null;

  let start = minHit;
  let end = maxHit + 1;
  // snap outward to word boundaries, then trim whitespace edges
  while (start > 0 && /\S/.test(full[start - 1])) start--;
  while (end < full.length && /\S/.test(full[end])) end++;
  while (start < end && /\s/.test(full[start])) start++;
  while (end > start && /\s/.test(full[end - 1])) end--;
  const quote = full.slice(start, end);
  if (!quote.trim()) return null;
  return { start, end, quote, coverage: quote.length / full.length };
}

export function sampleStrokePoints(points) {
  const samples = [];
  for (let i = 0; i < points.length; i++) {
    samples.push(points[i]);
    if (i + 1 < points.length) {
      const a = points[i];
      const b = points[i + 1];
      const steps = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 3));
      for (let s = 1; s < steps; s++) {
        samples.push({
          x: a.x + ((b.x - a.x) * s) / steps,
          y: a.y + ((b.y - a.y) * s) / steps,
        });
      }
    }
  }
  return samples;
}

function pointNearRect(px, py, rect, pad = 6) {
  return (
    px >= rect.left - pad &&
    px <= rect.right + pad &&
    py >= rect.top - pad &&
    py <= rect.bottom + pad
  );
}

/**
 * @param {HTMLElement} el - element containing text (textarea or text div)
 * @param {{x:number,y:number}[]} clientPoints - stroke in client coordinates
 * @param {number} strokeWidth - brush width in px
 */
export function extractTextRangeFromHighlightStroke(el, clientPoints, strokeWidth = 5) {
  if (!el || !clientPoints?.length) return null;
  const full = el.value ?? el.innerText ?? el.textContent ?? "";
  if (!full.trim()) return null;

  const samples = sampleStrokePoints(clientPoints);
  const pad = Math.max(3, strokeWidth * 0.32);
  const charHits = new Set();
  const textNode = el.firstChild?.nodeType === Node.TEXT_NODE ? el.firstChild : null;

  if (textNode) {
    for (let i = 0; i < full.length; i++) {
      try {
        const range = document.createRange();
        range.setStart(textNode, i);
        range.setEnd(textNode, Math.min(i + 1, textNode.length));
        const rects = range.getClientRects();
        for (let r = 0; r < rects.length; r++) {
          const cr = rects[r];
          if (!cr.width && !cr.height) continue;
          if (samples.some((s) => pointNearRect(s.x, s.y, cr, pad))) {
            charHits.add(i);
            break;
          }
        }
      } catch {
        /* skip bad range */
      }
    }
  }

  if (!charHits.size) {
    const er = el.getBoundingClientRect();
    if (!samples.some((s) => pointNearRect(s.x, s.y, er, pad))) return null;
    return { quote: full.trim(), context: full };
  }

  const hitOffsets = [...charHits].sort((a, b) => a - b);
  let start = hitOffsets[0];
  let end = hitOffsets[hitOffsets.length - 1] + 1;
  while (start > 0 && /\S/.test(full[start - 1])) start--;
  while (end < full.length && /\S/.test(full[end])) end++;
  const quote = full.slice(start, end).trim();
  if (quote.length < 1) return null;
  return { quote, context: full };
}

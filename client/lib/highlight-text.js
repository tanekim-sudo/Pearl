/** Map a highlight stroke (client coords) to a text substring in a DOM element. */
export function sampleStrokePoints(points) {
  const samples = [];
  for (let i = 0; i < points.length; i++) {
    samples.push(points[i]);
    if (i + 1 < points.length) {
      const a = points[i];
      const b = points[i + 1];
      const steps = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 6));
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
export function extractTextRangeFromHighlightStroke(el, clientPoints, strokeWidth = 14) {
  if (!el || !clientPoints?.length) return null;
  const full = el.value ?? el.innerText ?? el.textContent ?? "";
  if (!full.trim()) return null;

  const samples = sampleStrokePoints(clientPoints);
  const pad = Math.max(10, strokeWidth * 0.55);
  const charHits = new Set();
  const textNode = el.firstChild?.nodeType === Node.TEXT_NODE ? el.firstChild : null;

  if (textNode) {
    for (let i = 0; i < full.length; i++) {
      try {
        const range = document.createRange();
        range.setStart(textNode, i);
        range.setEnd(textNode, Math.min(i + 1, textNode.length));
        const cr = range.getBoundingClientRect();
        if (!cr.width && !cr.height) continue;
        if (samples.some((s) => pointNearRect(s.x, s.y, cr, pad))) charHits.add(i);
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

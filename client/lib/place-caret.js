/**
 * Focus a contentEditable and place the caret at a screen point (after layout).
 * @param {HTMLElement} el
 * @param {{ current: { cx?: number, cy?: number, selectAll?: boolean } | null } | undefined} editClickRef
 */
export function focusEditableAtPoint(el, editClickRef) {
  if (!el) return;
  const pt = editClickRef?.current;

  const apply = () => {
    el.focus();
    if (pt) {
      editClickRef.current = null;
      if (pt.selectAll) {
        const r = document.createRange();
        r.selectNodeContents(el);
        const s = window.getSelection();
        s?.removeAllRanges();
        s?.addRange(r);
        return;
      }
      try {
        const range = document.caretRangeFromPoint?.(pt.cx, pt.cy);
        if (range && el.contains(range.startContainer)) {
          const s = window.getSelection();
          s?.removeAllRanges();
          s?.addRange(range);
          return;
        }
      } catch {
        /* ignore */
      }
    }
    const r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(true);
    const s = window.getSelection();
    s?.removeAllRanges();
    s?.addRange(r);
  };

  requestAnimationFrame(() => requestAnimationFrame(apply));
}

import { revisionFingerprint } from "../../../../shared/lens-runtime.js";

export function resolveEditable(anchor = {}) {
  const selected = anchor.selector ? document.querySelector(anchor.selector) : null;
  const active = document.activeElement;
  const target = selected || active;
  if (target?.matches?.("input:not([type=password]),textarea")) return { adapter: "field", element: target };
  if (target?.isContentEditable) return { adapter: "contenteditable", element: target };
  return { adapter: "generic", element: target || null };
}

export function snapshotEditable(target) {
  const element = target.element;
  const text = target.adapter === "field" ? element?.value || "" : element?.innerText || "";
  return {
    text,
    html: target.adapter === "contenteditable" ? element.innerHTML : "",
    revision: revisionFingerprint(text),
    selectionStart: element?.selectionStart ?? null,
    selectionEnd: element?.selectionEnd ?? null,
  };
}

function dispatchInput(element, inputType, data) {
  element.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType, data }));
}

export function applyGenericPlan(plan) {
  const target = resolveEditable(plan.anchor);
  if (!target.element) return { ok: false, error: "editable target unavailable" };
  const before = snapshotEditable(target);
  if (plan.revision && before.revision !== plan.revision) return { ok: false, conflict: true, error: "editor changed since preview" };
  if (target.adapter === "field") {
    const start = Number.isInteger(plan.anchor.start) ? plan.anchor.start : target.element.selectionStart;
    const end = plan.operation === "replace" && Number.isInteger(plan.anchor.end) ? plan.anchor.end : start;
    target.element.setRangeText(plan.proposedText, start, end, "end");
    dispatchInput(target.element, plan.operation === "replace" ? "insertReplacementText" : "insertText", plan.proposedText);
  } else if (target.adapter === "contenteditable") {
    target.element.focus();
    const selection = getSelection();
    if (!selection?.rangeCount) return { ok: false, error: "place the caret before inserting" };
    const range = selection.getRangeAt(0);
    if (plan.operation === "replace") range.deleteContents();
    range.insertNode(document.createTextNode(plan.proposedText));
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    dispatchInput(target.element, plan.operation === "replace" ? "insertReplacementText" : "insertText", plan.proposedText);
  } else {
    return { ok: false, error: "page has no supported editable target" };
  }
  const after = snapshotEditable(target);
  if (!after.text.includes(plan.proposedText)) return { ok: false, error: "page rejected the write" };
  return { ok: true, adapter: target.adapter, undo: before };
}

export function undoGeneric(anchor, snapshot) {
  const target = resolveEditable(anchor);
  if (!target.element || !snapshot) return false;
  if (target.adapter === "field") target.element.value = snapshot.text;
  else if (target.adapter === "contenteditable") target.element.innerHTML = snapshot.html;
  dispatchInput(target.element, "historyUndo", null);
  return true;
}

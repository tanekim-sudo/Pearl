import { createMaterialFragment } from "../../../shared/lens-runtime.js";
import { isOriginDenied, isProtectedField } from "../core/security.js";

function nodePath(node) {
  const path = [];
  for (let current = node; current && current !== document; current = current.parentNode || current.host) {
    const parent = current.parentNode;
    path.unshift(parent ? [...parent.childNodes].indexOf(current) : -1);
  }
  return path;
}

function selectorFor(element) {
  if (!element?.closest) return "";
  const target = element.nodeType === Node.ELEMENT_NODE ? element : element.parentElement;
  if (target?.id) return `#${CSS.escape(target.id)}`;
  const name = target?.getAttribute?.("name");
  if (name) return `${target.tagName.toLowerCase()}[name="${CSS.escape(name)}"]`;
  return target?.tagName?.toLowerCase() || "";
}

function captureField(element) {
  if (isProtectedField(element)) throw new Error("protected field cannot be captured");
  const start = element.selectionStart;
  const end = element.selectionEnd;
  if (start == null || end == null || start === end) return null;
  const quote = element.value.slice(start, end);
  return createMaterialFragment({
    quote,
    prefix: element.value.slice(Math.max(0, start - 256), start),
    suffix: element.value.slice(end, end + 256),
    offsets: { start, end },
    url: location.href,
    title: document.title,
    frameUrl: location.href,
    anchor: { selector: selectorFor(element), field: element.tagName.toLowerCase() },
  });
}

export function captureNativeSelection(options = {}) {
  if (isOriginDenied(location.href, options.denylist)) throw new Error("capture disabled on this origin");
  const active = document.activeElement;
  if (active?.matches?.("input,textarea")) {
    const field = captureField(active);
    return field ? [field] : [];
  }
  const selection = globalThis.getSelection?.();
  if (!selection || selection.isCollapsed || !selection.rangeCount) return [];
  const fragments = [];
  for (let index = 0; index < selection.rangeCount; index += 1) {
    const range = selection.getRangeAt(index);
    const quote = range.toString();
    if (!quote.trim()) continue;
    const rootText = range.commonAncestorContainer.textContent || "";
    const localStart = Math.max(0, rootText.indexOf(quote));
    fragments.push(createMaterialFragment({
      quote,
      prefix: rootText.slice(Math.max(0, localStart - 256), localStart),
      suffix: rootText.slice(localStart + quote.length, localStart + quote.length + 256),
      offsets: { start: range.startOffset, end: range.endOffset },
      url: location.href,
      title: document.title,
      frameUrl: location.href,
      formatting: {
        plainText: true,
        blockTag: range.commonAncestorContainer.parentElement?.tagName || "",
        direction: getComputedStyle(range.commonAncestorContainer.parentElement || document.body).direction,
      },
      anchor: {
        selector: selectorFor(range.commonAncestorContainer),
        startPath: nodePath(range.startContainer),
        endPath: nodePath(range.endContainer),
      },
    }));
  }
  return fragments;
}

export function selectionRects() {
  const selection = globalThis.getSelection?.();
  const rects = [];
  if (!selection) return rects;
  for (let index = 0; index < selection.rangeCount; index += 1) {
    rects.push(...selection.getRangeAt(index).getClientRects());
  }
  return rects.map(({ x, y, width, height }) => ({ x, y, width, height }));
}

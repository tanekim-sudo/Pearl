/**
 * Find on-screen text matches for pearl filament / mark targeting.
 * DOM helpers are injectable so Node tests and non-browser surfaces stay pure.
 */

export const PEARL_SCREEN_MATCH_VERSION = 1;
export const MAX_SCREEN_MATCHES = 24;

function bounded(value, limit = 200) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function compileScreenMatchCondition(condition) {
  const raw = bounded(condition, 500);
  if (!raw) return null;
  const regexLiteral = raw.match(/^\/(.+)\/([gimsuy]*)$/);
  if (regexLiteral) {
    try {
      return {
        type: "regex",
        source: raw,
        pattern: new RegExp(regexLiteral[1], regexLiteral[2].includes("g") ? regexLiteral[2] : `${regexLiteral[2]}g`),
      };
    } catch {
      return null;
    }
  }
  if (/\bor\b/i.test(raw) && raw.length < 120) {
    const parts = raw.split(/\bor\b/i).map((part) => part.trim()).filter(Boolean).slice(0, 8);
    if (parts.length > 1) {
      return {
        type: "any",
        source: raw,
        pattern: new RegExp(parts.map(escapeRegExp).join("|"), "gi"),
      };
    }
  }
  return { type: "substring", source: raw, pattern: new RegExp(escapeRegExp(raw), "gi") };
}

function defaultCollectTextNodes(root) {
  if (!root || typeof root.ownerDocument?.createTreeWalker !== "function") return [];
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let node;
  while ((node = walker.nextNode())) nodes.push(node);
  return nodes;
}

function locateOffset(nodes, globalOffset) {
  let acc = 0;
  for (const textNode of nodes) {
    const len = textNode.length || 0;
    if (globalOffset <= acc + len) return { node: textNode, offset: globalOffset - acc };
    acc += len;
  }
  const last = nodes[nodes.length - 1];
  return last ? { node: last, offset: last.length } : null;
}

function defaultRangeClientRects(root, start, end) {
  const nodes = defaultCollectTextNodes(root);
  if (!nodes.length) return [];
  const a = locateOffset(nodes, start);
  const b = locateOffset(nodes, end);
  if (!a || !b) return [];
  try {
    const range = root.ownerDocument.createRange();
    range.setStart(a.node, a.offset);
    range.setEnd(b.node, b.offset);
    return [...range.getClientRects()].filter((rect) => rect.width || rect.height);
  } catch {
    return [];
  }
}

function rectPayload(rect) {
  return {
    x: rect.x ?? rect.left,
    y: rect.y ?? rect.top,
    left: rect.left ?? rect.x,
    top: rect.top ?? rect.y,
    width: rect.width,
    height: rect.height,
  };
}

/**
 * Pure string matcher for tests — returns character ranges without DOM rects.
 */
export function findTextMatches(text, condition, options = {}) {
  const limit = Math.max(1, Math.min(MAX_SCREEN_MATCHES, Number(options.limit) || MAX_SCREEN_MATCHES));
  const compiled = typeof condition === "object" && condition?.pattern
    ? condition
    : compileScreenMatchCondition(condition);
  const full = String(text || "");
  if (!compiled?.pattern || !full) {
    return {
      version: PEARL_SCREEN_MATCH_VERSION,
      matches: [],
      truncated: false,
      condition: compiled?.source || String(condition || ""),
      ready: Boolean(compiled),
      reason: !compiled ? "invalid-condition" : "no-matches",
      matchCount: 0,
    };
  }
  const matches = [];
  const pattern = compiled.pattern;
  pattern.lastIndex = 0;
  let hit;
  while ((hit = pattern.exec(full)) && matches.length < limit) {
    if (!hit[0]) {
      pattern.lastIndex += 1;
      continue;
    }
    matches.push({
      id: `match:${hit.index}:${hit.index + hit[0].length}`,
      quote: bounded(hit[0], 160),
      start: hit.index,
      end: hit.index + hit[0].length,
      rects: [],
    });
    if (pattern.lastIndex === hit.index) pattern.lastIndex += 1;
  }
  return {
    version: PEARL_SCREEN_MATCH_VERSION,
    matches,
    truncated: matches.length >= limit,
    condition: compiled.source,
    matchCount: matches.length,
    ready: true,
    reason: matches.length ? null : "no-matches",
  };
}

export function findOnScreenMatching(root, condition, options = {}) {
  const limit = Math.max(1, Math.min(MAX_SCREEN_MATCHES, Number(options.limit) || MAX_SCREEN_MATCHES));
  const compiled = typeof condition === "object" && condition?.pattern
    ? condition
    : compileScreenMatchCondition(condition);
  if (!root || !compiled?.pattern) {
    return {
      version: PEARL_SCREEN_MATCH_VERSION,
      matches: [],
      truncated: false,
      condition: compiled?.source || String(condition || ""),
      ready: false,
      reason: !root ? "missing-root" : "invalid-condition",
      matchCount: 0,
    };
  }
  const collect = typeof options.collectTextNodes === "function" ? options.collectTextNodes : defaultCollectTextNodes;
  const rectsFn = typeof options.rangeClientRects === "function" ? options.rangeClientRects : defaultRangeClientRects;
  const nodes = collect(root);
  const full = nodes.map((node) => node.nodeValue || "").join("");
  const base = findTextMatches(full, compiled, { limit });
  const matches = base.matches.map((match) => {
    const rects = rectsFn(root, match.start, match.end).map(rectPayload).filter((rect) => rect.width || rect.height);
    return { ...match, rects };
  }).filter((match) => match.rects.length || options.allowEmptyRects === true);
  return {
    ...base,
    matches,
    matchCount: matches.length,
    reason: matches.length ? null : "no-matches",
  };
}

export function matchRectsForPowerFx(result) {
  return (result?.matches || []).flatMap((match) => match.rects || []).slice(0, MAX_SCREEN_MATCHES);
}

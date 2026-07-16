export const UTTERANCE_NORMALIZER_VERSION = 1;

const SAFE_FILLERS = new Set(["um", "uh", "erm", "hmm"]);
const DISCOURSE_FILLERS = new Set(["you know", "i mean"]);
const REPAIR_MARKERS = /\b(?:no|actually|rather|sorry|instead|wait)\b/i;

function protectedSpans(text) {
  const spans = [];
  const pattern = /(["'`])(?:\\.|(?!\1)[\s\S])*\1|```[\s\S]*?```/g;
  let match;
  while ((match = pattern.exec(text))) spans.push({ start: match.index, end: match.index + match[0].length });
  return spans;
}

const inside = (index, spans) => spans.some((span) => index >= span.start && index < span.end);

function tokensWithSpans(text) {
  const tokens = [];
  const pattern = /\S+/g;
  let match;
  while ((match = pattern.exec(text))) {
    tokens.push({ value: match[0], normalized: match[0].toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""), start: match.index, end: match.index + match[0].length });
  }
  return tokens;
}

function removeSafeFillers(raw, protectedRanges) {
  const removed = [];
  const kept = [];
  const tokens = tokensWithSpans(raw);
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (inside(token.start, protectedRanges)) {
      kept.push(token);
      continue;
    }
    const pair = `${token.normalized} ${tokens[index + 1]?.normalized || ""}`.trim();
    if (DISCOURSE_FILLERS.has(pair) && !inside(tokens[index + 1].start, protectedRanges)) {
      removed.push({ kind: "filler", text: raw.slice(token.start, tokens[index + 1].end), start: token.start, end: tokens[index + 1].end, confidence: 0.98 });
      index += 1;
      continue;
    }
    if (SAFE_FILLERS.has(token.normalized)) {
      removed.push({ kind: "filler", text: token.value, start: token.start, end: token.end, confidence: 0.99 });
      continue;
    }
    // Only collapse an immediate repeated start. Repeated meaningful words
    // separated by punctuation remain evidence.
    const next = tokens[index + 1];
    if (next && token.normalized.length > 1 && token.normalized === next.normalized
      && !/[.!?;:]$/.test(token.value) && !inside(next.start, protectedRanges)) {
      removed.push({ kind: "repeated-start", text: token.value, start: token.start, end: token.end, confidence: 0.95 });
      continue;
    }
    kept.push(token);
  }
  return {
    text: kept.map((token) => token.value).join(" ").replace(/\s+([,.;!?])/g, "$1").trim(),
    removed,
  };
}

function correctionRecords(raw, protectedRanges) {
  const corrections = [];
  const marker = new RegExp(REPAIR_MARKERS.source, "gi");
  let match;
  while ((match = marker.exec(raw))) {
    if (inside(match.index, protectedRanges)) continue;
    const prefix = raw.slice(0, match.index).replace(/[—,\s-]+$/g, "");
    const beforeStart = Math.max(
      0,
      prefix.lastIndexOf(".") + 1,
      prefix.lastIndexOf(";") + 1,
      prefix.lastIndexOf("!") + 1,
      prefix.lastIndexOf("?") + 1,
    );
    const suffixStart = marker.lastIndex + (raw.slice(marker.lastIndex).match(/^[—,\s-]*/)?.[0].length || 0);
    const afterEndCandidates = [raw.indexOf(",", suffixStart), raw.indexOf(";", suffixStart), raw.indexOf(".", suffixStart)].filter((value) => value >= 0);
    const afterEnd = afterEndCandidates.length ? Math.min(...afterEndCandidates) : raw.length;
    corrections.push({
      marker: match[0],
      start: match.index,
      end: marker.lastIndex,
      superseded: prefix.slice(beforeStart).trim(),
      replacement: raw.slice(suffixStart, afterEnd).trim(),
      confidence: 0.78,
    });
  }
  return corrections;
}

function semanticClauses(text) {
  const clauses = [];
  const pattern = /[^.;!?]+[.;!?]?/g;
  let match;
  while ((match = pattern.exec(text))) {
    const value = match[0].trim();
    if (!value) continue;
    clauses.push({
      id: `clause-${clauses.length + 1}`,
      text: value.replace(/[.;!?]+$/, "").trim(),
      start: match.index,
      end: match.index + match[0].length,
      stable: true,
    });
  }
  return clauses;
}

function unresolvedReferences(text) {
  const matches = text.match(/\b(?:it|this|that|these|those|the (?:first|second|third|last) one)\b/gi) || [];
  return [...new Set(matches.map((value) => value.toLowerCase()))];
}

export function normalizeUtterance(rawValue, options = {}) {
  const rawText = String(rawValue || "").replace(/\s+/g, " ").trim();
  const ranges = protectedSpans(rawText);
  const local = removeSafeFillers(rawText, ranges);
  const corrections = correctionRecords(rawText, ranges);
  let cleanedText = local.text;
  for (const repair of corrections) {
    if (!repair.superseded || !repair.replacement) continue;
    const escaped = repair.superseded.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    cleanedText = cleanedText.replace(new RegExp(`${escaped}\\s*(?:—|-|,)?\\s*${repair.marker}\\s*(?:—|-|,)?\\s*`, "i"), "");
  }
  const ambiguous = corrections.some((entry) => !entry.superseded || !entry.replacement);
  return {
    version: UTTERANCE_NORMALIZER_VERSION,
    rawText,
    cleanedText: cleanedText.replace(/\s+/g, " ").trim(),
    semanticClauses: semanticClauses(cleanedText),
    corrections,
    removed: local.removed,
    unresolvedReferences: unresolvedReferences(cleanedText),
    confidence: rawText ? (ambiguous ? 0.62 : corrections.length ? 0.82 : 0.98) : 0,
    requiresSemanticRepair: ambiguous || options.forceSemanticRepair === true,
    source: options.source || "voice",
  };
}

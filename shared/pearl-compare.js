/**
 * Compare two pearls' Moves · Weights · Lenses (+ readable systemPrompt projection)
 * and optionally produce a downloadable artifact (md / html / pdf).
 *
 * Companion uses this for "differences between X and Y" + "give me a PDF" —
 * never as a systemPrompt append.
 */

import { buildPearlCompanionContext } from "./pearl-companion-context.js";
import { buildPearlLayerPack } from "./pearl-layer-instructions.js";
import { inferDownloadFormat, formatOutputForDownload } from "./output-routing.js";
import { readPearlSystemPrompt, normalizePearlSystemPrompt } from "./pearl-system-prompt.js";
import { EXECUTION_CODES } from "./execution-result.js";

export const PEARL_COMPARE_VERSION = 1;

const soft = (value, limit = 2_000) => String(value ?? "").trim().slice(0, limit);
const compact = (value) => String(value || "").replace(/\s+/g, " ").trim();
const normName = (value) => compact(value).toLowerCase();

/** True when the utterance is a compare / diff request (not a prompt edit). */
export function looksLikePearlCompareRequest(utterance = "") {
  const text = compact(utterance);
  if (!text) return false;
  if (/\b(?:difference|differences|diff|compare|comparison|contrast|versus|vs\.?)\b/i.test(text)) {
    if (/\bpearl/i.test(text) || /\bbetween\b/i.test(text) || /\band\b.+\b(?:pearl|buffett|investor)\b/i.test(text)) {
      return true;
    }
  }
  if (/\b(?:how\s+(?:do|does|are)\s+.+\s+differ)\b/i.test(text)) return true;
  return false;
}

/** True when the user wants a downloadable / PDF / file output. */
export function looksLikeProduceOutputRequest(utterance = "") {
  const text = compact(utterance);
  if (!text) return false;
  return (
    /\b(?:pdf|download|export|save\s+as|give\s+me\s+a\s+(?:pdf|file|document|markdown|html))\b/i.test(text)
    || /\b(?:output|produce|generate)\b.{0,40}\b(?:pdf|markdown|html|file|document)\b/i.test(text)
    || /\bas\s+a\s+pdf\b/i.test(text)
  );
}

/**
 * Execution-style asks that must never mutate systemPrompt / layers as "refinements".
 * Includes compare, produce_output, and plain explain/ask about differences.
 */
export function looksLikePearlExecutionRequest(utterance = "") {
  const text = compact(utterance);
  if (!text) return false;
  if (looksLikePearlCompareRequest(text)) return true;
  if (looksLikeProduceOutputRequest(text)) return true;
  if (/^(?:explain|what(?:'s| are)|show|tell\s+me)\b/i.test(text)
    && /\b(?:difference|differences|diff|compare|between)\b/i.test(text)) {
    return true;
  }
  return false;
}

/**
 * Parse "differences between A and B" / "compare A vs B" name hints.
 * Returns { left, right } strings (may be empty if unresolved).
 */
export function extractComparePearlHints(utterance = "") {
  const text = compact(utterance);
  if (!text) return { left: "", right: "" };

  const between = text.match(
    /\bbetween\s+(?:my\s+|the\s+|this\s+|that\s+)?(.+?)\s+and\s+(?:the\s+|my\s+|a\s+|an\s+)?(.+?)(?:\s+and\s+then\b|\s+and\s+(?:give|produce|make|export|download)\b|[.!?]|$)/i,
  );
  if (between?.[1] && between?.[2]) {
    return {
      left: cleanPearlHint(between[1]),
      right: cleanPearlHint(between[2]),
    };
  }

  const vs = text.match(
    /\bcompare\s+(?:my\s+|the\s+|this\s+|that\s+)?(.+?)\s+(?:vs\.?|versus|to|with|against)\s+(?:the\s+|my\s+|a\s+|an\s+)?(.+?)(?:\s+and\s+then\b|[.!?]|$)/i,
  );
  if (vs?.[1] && vs?.[2]) {
    return {
      left: cleanPearlHint(vs[1]),
      right: cleanPearlHint(vs[2]),
    };
  }

  // "my investor pearl" + "Warren Buffett" / "Buffett … pearl" as loose fallback
  const mine = text.match(/\bmy\s+((?:[\w.-]+\s+){0,4}pearl)\b/i)?.[1];
  const other = text.match(
    /\b((?:warren\s+)?buffett(?:\s+(?:investor|investing))?(?:\s+pearl)?)\b/i,
  )?.[1]
    || text.match(/\bthe\s+((?:[\w.-]+\s+){0,5}pearl)\b/i)?.[1];
  return {
    left: mine ? cleanPearlHint(mine) : "",
    right: other ? cleanPearlHint(other) : "",
  };
}

function cleanPearlHint(value) {
  let cleaned = soft(value, 120)
    .replace(/^(?:my|the|this|that|a|an)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
  // "Warren Buffett investor pearl" → distinctive "Warren Buffett" (not generic investor)
  const buffett = cleaned.match(/((?:warren\s+)?buffett)/i)?.[1];
  if (buffett) return soft(buffett, 80);
  cleaned = cleaned.replace(/\s+pearl$/i, "").trim();
  return cleaned;
}

const STOP_TOKENS = new Set(["pearl", "the", "and", "my", "a", "an", "this", "that", "investor", "investing"]);

function scorePearlAgainstHint(pearl, hint) {
  const name = normName(pearl?.name || pearl?.identity?.name);
  const needle = normName(hint);
  if (!name || !needle) return 0;
  if (name === needle) return 100;
  if (name.includes(needle) || needle.includes(name)) return 80;
  const tokens = needle.split(/\s+/).filter((t) => t.length > 2 && !STOP_TOKENS.has(t));
  // Keep distinctive tokens even if also in STOP (buffett never stopped)
  const distinctive = needle.split(/\s+/).filter((t) => t.length > 2 && t !== "pearl");
  const preferred = distinctive.filter((t) => !STOP_TOKENS.has(t) || /buffett|warren|plath|oliver|dickinson|woolf/.test(t));
  const use = preferred.length ? preferred : distinctive.filter((t) => t !== "pearl");
  if (!use.length) {
    // Weak generic hint like "investor" — allow soft match but low score
    const softTokens = needle.split(/\s+/).filter((t) => t.length > 2 && t !== "pearl");
    const hits = softTokens.filter((t) => name.includes(t)).length;
    return hits ? 20 + hits * 5 : 0;
  }
  const hits = use.filter((t) => name.includes(t)).length;
  if (!hits) return 0;
  // Require all distinctive tokens when present (buffett must match Buffett pearl)
  if (hits < use.length) return 10 + hits * 10;
  return 60 + hits * 10;
}

/**
 * Resolve two pearls from a list using compare hints + optional active pearl.
 */
export function resolveComparePearls(pearls = [], utterance = "", options = {}) {
  const list = (Array.isArray(pearls) ? pearls : []).filter(Boolean);
  const hints = extractComparePearlHints(utterance);
  const active = options.activePearl || null;

  const find = (hint, excludeId = null) => {
    const needle = normName(hint);
    if (!needle) return null;
    const pool = list.filter((p) => p.id !== excludeId);
    let best = null;
    let bestScore = 0;
    for (const pearl of pool) {
      const score = scorePearlAgainstHint(pearl, hint);
      if (score > bestScore) {
        bestScore = score;
        best = pearl;
      }
    }
    return bestScore >= 20 ? best : null;
  };

  let left = find(hints.left);
  let right = find(hints.right, left?.id || null);
  // Re-resolve left excluding right if they collided
  if (left && right && left.id === right.id) {
    left = find(hints.left, right.id);
  }

  if (!left && active && right && active.id !== right.id) left = active;
  if (!right && active && left && active.id !== left.id) right = active;

  // Fallback: two most recent / first two distinct when hints are weak but compare is clear
  if ((!left || !right || left.id === right.id) && list.length >= 2 && looksLikePearlCompareRequest(utterance)) {
    if (!left) left = active && list.some((p) => p.id === active.id) ? active : list[0];
    if (!right || right.id === left.id) {
      right = list.find((p) => p.id !== left.id) || list[1];
    }
  }

  return {
    left,
    right,
    hints,
    ok: Boolean(left && right && left.id !== right.id),
  };
}

function layerNames(entries, key = "name") {
  return (Array.isArray(entries) ? entries : [])
    .map((entry) => soft(entry?.[key] || entry?.label || "", 80))
    .filter(Boolean);
}

function setDiff(aNames, bNames) {
  const a = new Set(aNames.map(normName));
  const b = new Set(bNames.map(normName));
  const onlyA = aNames.filter((n) => !b.has(normName(n)));
  const onlyB = bNames.filter((n) => !a.has(normName(n)));
  const shared = aNames.filter((n) => b.has(normName(n)));
  return { onlyA, onlyB, shared };
}

/**
 * Structural + prompt-projection comparison using full companion context.
 */
export function comparePearlLayers(pearlA, pearlB, appState = {}) {
  const ctxA = buildPearlCompanionContext(pearlA, appState);
  const ctxB = buildPearlCompanionContext(pearlB, appState);
  const packA = buildPearlLayerPack(pearlA) || {};
  const packB = buildPearlLayerPack(pearlB) || {};

  const movesA = layerNames(packA.moves?.length ? packA.moves : ctxA?.moves);
  const movesB = layerNames(packB.moves?.length ? packB.moves : ctxB?.moves);
  const weightsA = layerNames(packA.weights?.length ? packA.weights : ctxA?.weights);
  const weightsB = layerNames(packB.weights?.length ? packB.weights : ctxB?.weights);
  const lensesA = layerNames(packA.lenses?.length ? packA.lenses : ctxA?.lenses);
  const lensesB = layerNames(packB.lenses?.length ? packB.lenses : ctxB?.lenses);

  const promptA = normalizePearlSystemPrompt(readPearlSystemPrompt(pearlA));
  const promptB = normalizePearlSystemPrompt(readPearlSystemPrompt(pearlB));

  return {
    version: PEARL_COMPARE_VERSION,
    left: {
      id: ctxA?.pearlId || pearlA?.id || null,
      name: ctxA?.name || pearlA?.name || "Pearl A",
      moves: movesA,
      weights: weightsA,
      lenses: lensesA,
      systemPrompt: promptA,
      summary: ctxA?.summary || "",
    },
    right: {
      id: ctxB?.pearlId || pearlB?.id || null,
      name: ctxB?.name || pearlB?.name || "Pearl B",
      moves: movesB,
      weights: weightsB,
      lenses: lensesB,
      systemPrompt: promptB,
      summary: ctxB?.summary || "",
    },
    diffs: {
      moves: setDiff(movesA, movesB),
      weights: setDiff(weightsA, weightsB),
      lenses: setDiff(lensesA, lensesB),
      promptChanged: promptA !== promptB,
    },
  };
}

function sectionDiffLines(label, diff, leftName, rightName) {
  const lines = [`### ${label}`];
  if (diff.shared.length) {
    lines.push(`Shared: ${diff.shared.join(" · ")}`);
  } else {
    lines.push("Shared: (none)");
  }
  if (diff.onlyA.length) {
    lines.push(`Only in “${leftName}”: ${diff.onlyA.join(" · ")}`);
  }
  if (diff.onlyB.length) {
    lines.push(`Only in “${rightName}”: ${diff.onlyB.join(" · ")}`);
  }
  if (!diff.onlyA.length && !diff.onlyB.length) {
    lines.push("No name-level differences.");
  }
  return lines;
}

/** Human-readable markdown comparison (chat + download body). */
export function formatPearlComparisonMarkdown(comparison) {
  if (!comparison?.left || !comparison?.right) {
    return "Could not compare — need two distinct pearls.";
  }
  const { left, right, diffs } = comparison;
  const lines = [
    `# Pearl comparison`,
    ``,
    `**${left.name}** vs **${right.name}**`,
    ``,
    `## Snapshot`,
    `- **${left.name}**: ${left.moves.length} Moves · ${left.weights.length} Weights · ${left.lenses.length} Lenses`,
    `- **${right.name}**: ${right.moves.length} Moves · ${right.weights.length} Weights · ${right.lenses.length} Lenses`,
    ``,
    `## Layer differences`,
    ...sectionDiffLines("Moves", diffs.moves, left.name, right.name),
    ``,
    ...sectionDiffLines("Weights", diffs.weights, left.name, right.name),
    ``,
    ...sectionDiffLines("Lenses", diffs.lenses, left.name, right.name),
    ``,
    `## System prompt projection`,
    diffs.promptChanged
      ? "Readable systemPrompt projections differ (see below)."
      : "Readable systemPrompt projections match.",
    ``,
    `### “${left.name}”`,
    soft(left.systemPrompt || "(empty)", 3_000) || "(empty)",
    ``,
    `### “${right.name}”`,
    soft(right.systemPrompt || "(empty)", 3_000) || "(empty)",
    ``,
    `---`,
    `_Comparison produced by Companion from Moves · Weights · Lenses — not by editing either system prompt._`,
  ];
  return lines.join("\n");
}

/** Short chat-facing summary (no metadata dump). */
export function formatPearlComparisonChatSummary(comparison) {
  if (!comparison?.left || !comparison?.right) {
    return "I need two distinct pearls to compare. Wear or name both, then ask again.";
  }
  const { left, right, diffs } = comparison;
  const bits = [];
  const moveDelta = diffs.moves.onlyA.length + diffs.moves.onlyB.length;
  const weightDelta = diffs.weights.onlyA.length + diffs.weights.onlyB.length;
  const lensDelta = diffs.lenses.onlyA.length + diffs.lenses.onlyB.length;
  bits.push(`Compared “${left.name}” and “${right.name}”.`);
  bits.push(
    moveDelta || weightDelta || lensDelta
      ? `Layer deltas — Moves: ${moveDelta || "aligned"}, Weights: ${weightDelta || "aligned"}, Lenses: ${lensDelta || "aligned"}.`
      : "Moves · Weights · Lenses line up by name; check prompt projections for nuance.",
  );
  if (diffs.moves.onlyA[0] || diffs.moves.onlyB[0]) {
    bits.push(
      `Moves only in “${left.name}”: ${diffs.moves.onlyA.slice(0, 3).join(" · ") || "—"}. `
      + `Only in “${right.name}”: ${diffs.moves.onlyB.slice(0, 3).join(" · ") || "—"}.`,
    );
  }
  if (diffs.promptChanged) {
    bits.push("Their readable systemPrompt projections differ.");
  }
  return bits.join(" ");
}

/**
 * Minimal text PDF (Helvetica) — same approach as extension page-canvas.
 * Honest fallback when a richer PDF lib is absent.
 */
export function pearlTextPdfBytes(text, options = {}) {
  const title = soft(options.title || "Pearl comparison", 80);
  const rawLines = String(text || "").split(/\r?\n/);
  const lines = [
    title,
    "",
    ...rawLines,
  ].flatMap((line) => {
    const s = String(line);
    if (s.length <= 90) return [s];
    const chunks = [];
    for (let i = 0; i < s.length; i += 90) chunks.push(s.slice(i, i + 90));
    return chunks;
  }).slice(0, 480);

  const escapePdfText = (value) => String(value || "")
    .replace(/[^\x20-\x7e]/g, "?")
    .replace(/([\\()])/g, "\\$1");

  const content = lines
    .map((line, index) => `BT /F1 10 Tf 40 ${800 - index * 12} Td (${escapePdfText(line.slice(0, 100))}) Tj ET`)
    .join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

/**
 * Build downloadable artifact for a comparison.
 * PDF uses the built-in text PDF encoder (honest: plain Helvetica layout).
 */
export function buildPearlComparisonArtifact(comparison, utterance = "", options = {}) {
  const markdown = formatPearlComparisonMarkdown(comparison);
  const format = inferDownloadFormat(utterance || options.format || "md", {
    format: options.format,
  });
  if (format.unsupported) {
    return {
      ok: false,
      code: EXECUTION_CODES.VALIDATION_ERROR,
      format,
      markdown,
      message: format.clarification || "That download format is not available.",
    };
  }
  const key = format.key || "md";
  const baseName = soft(
    options.fileName
    || `pearl-compare-${(comparison.left?.name || "a").replace(/\s+/g, "-").slice(0, 24)}-vs-${(comparison.right?.name || "b").replace(/\s+/g, "-").slice(0, 24)}`,
    120,
  ).replace(/[^a-zA-Z0-9._ -]/g, "_");

  if (key === "pdf") {
    const bytes = pearlTextPdfBytes(markdown, {
      title: `Compare: ${comparison.left?.name} vs ${comparison.right?.name}`,
    });
    return {
      ok: true,
      format: { ...format, key: "pdf" },
      markdown,
      mime: "application/pdf",
      ext: "pdf",
      fileName: `${baseName}.pdf`,
      bytes,
      body: null,
      note: "PDF is a plain-text layout (no external PDF library).",
    };
  }

  const body = formatOutputForDownload(markdown, key === "txt" ? "md" : key);
  const ext = key === "txt" ? "md" : (format.ext || key);
  const mime = key === "txt" ? "text/markdown;charset=utf-8" : (format.mime || "text/markdown");
  return {
    ok: true,
    format: { ...format, key: key === "txt" ? "md" : key },
    markdown,
    mime,
    ext,
    fileName: `${baseName}.${ext}`,
    bytes: null,
    body,
    note: null,
  };
}

/**
 * Offline propose for compare (+ optional produce_output).
 */
export function proposePearlCompare(utterance, pearls = [], options = {}) {
  const text = compact(utterance);
  if (!looksLikePearlCompareRequest(text) && !options.forceCompare) {
    return {
      ok: false,
      code: EXECUTION_CODES.UNKNOWN_INTENT,
      summary: "That does not look like a pearl comparison.",
    };
  }
  const resolved = resolveComparePearls(pearls, text, options);
  if (!resolved.ok) {
    return {
      ok: false,
      code: EXECUTION_CODES.MISSING_ARGS,
      summary: "Name or wear two distinct pearls to compare (e.g. your investor pearl and the Buffett pearl).",
      hints: resolved.hints,
      left: resolved.left?.name || null,
      right: resolved.right?.name || null,
    };
  }
  const comparison = comparePearlLayers(resolved.left, resolved.right, options.appState || {});
  const chatSummary = formatPearlComparisonChatSummary(comparison);
  const wantOutput = looksLikeProduceOutputRequest(text) || options.produceOutput === true;
  let artifact = null;
  if (wantOutput) {
    artifact = buildPearlComparisonArtifact(comparison, text, options);
  }
  return {
    ok: true,
    intent: wantOutput ? "compare_pearls+produce_output" : "compare_pearls",
    comparison,
    chatSummary,
    markdown: formatPearlComparisonMarkdown(comparison),
    artifact,
    produceOutput: wantOutput,
    leftId: resolved.left.id,
    rightId: resolved.right.id,
    leftName: resolved.left.name || comparison.left.name,
    rightName: resolved.right.name || comparison.right.name,
    summary: wantOutput
      ? `${chatSummary} Preparing ${artifact?.ext || "file"} download.`
      : chatSummary,
    // Critical: compare never mutates systemPrompt
    mutatesSystemPrompt: false,
  };
}

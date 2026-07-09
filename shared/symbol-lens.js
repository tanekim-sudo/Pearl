/**
 * Symbol viewing lens — portable metadata + consistent re-application.
 */

export const SYMBOL_LENS_VERSION = 1;

const STOP = new Set([
  "that",
  "this",
  "with",
  "from",
  "have",
  "been",
  "were",
  "they",
  "their",
  "there",
  "about",
  "which",
  "would",
  "could",
  "should",
  "into",
  "through",
  "also",
  "than",
  "then",
  "when",
  "what",
  "your",
  "will",
  "just",
  "like",
  "more",
  "some",
  "such",
  "only",
  "other",
  "each",
  "very",
  "much",
]);

function tokenize(text) {
  return (text || "")
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 3 && !STOP.has(w));
}

/** Distinct objects placed on a symbol surface. */
export function extractSymbolObjects(struct) {
  const objects = [];
  const items = Array.isArray(struct?.items) ? struct.items : [];
  for (const it of items) {
    if (it.type === "text" && it.text?.trim()) {
      const body = it.text.trim();
      const label = body.split("\n")[0].slice(0, 100);
      objects.push({ kind: "text", label, body: body.slice(0, 500) });
    } else if (it.type === "sticky" && it.text?.trim()) {
      const body = it.text.trim();
      objects.push({ kind: "sticky", label: body.split("\n")[0].slice(0, 80), body: body.slice(0, 300) });
    } else if (it.type === "image") {
      objects.push({ kind: "image", label: "image", body: "" });
    } else if (it.type === "stroke") {
      objects.push({ kind: "sketch", label: "sketch", body: "" });
    }
  }
  if (struct?.symbolStroke?.points?.length >= 2) {
    objects.push({ kind: "glyph", label: "hand-drawn mark", body: "" });
  }
  return objects;
}

function describeSingleObject(obj, title) {
  if (obj.kind === "text" || obj.kind === "sticky") {
    const line =
      obj.body
        ?.split(/\n+/)
        .map((s) => s.trim())
        .find(Boolean) || obj.label;
    if (line) return line.length > 220 ? `${line.slice(0, 217)}…` : line;
  }
  if (obj.kind === "image") return `An image representing ${title || "this idea"}.`;
  if (obj.kind === "sketch") return `A sketch representing ${title || "this idea"}.`;
  if (obj.kind === "glyph") return `A hand-drawn mark for ${title || "this idea"}.`;
  return obj.label || title || "An idea on the symbol surface.";
}

function describeMultipleObjects(objects, title) {
  const labels = objects.map((o) => o.label).filter(Boolean);
  const tokensByObj = objects.map((o) => tokenize(`${o.label} ${o.body || ""}`));
  const freq = new Map();
  for (const tokens of tokensByObj) {
    for (const t of new Set(tokens)) {
      freq.set(t, (freq.get(t) || 0) + 1);
    }
  }
  const shared = [...freq.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w)
    .slice(0, 6);

  const named = labels.slice(0, 5).join("; ");
  const tail = labels.length > 5 ? "…" : "";
  if (shared.length) {
    return `${objects.length} related objects — ${named}${tail}. Shared themes: ${shared.join(", ")}.`;
  }
  return `${objects.length} related objects — ${named}${tail}. Together they express “${title || "this pattern"}”.`;
}

/** Fast local symbol reading — no network. */
export function interpretSymbolStructural(struct) {
  const objects = extractSymbolObjects(struct);
  const title =
    struct?.title ||
    objects[0]?.label?.split(/\s+/).slice(0, 4).join(" ") ||
    "pattern";

  let meaning;
  if (objects.length === 0) {
    meaning = `A visual pattern: ${title}`;
  } else if (objects.length === 1) {
    meaning = describeSingleObject(objects[0], title);
  } else {
    meaning = describeMultipleObjects(objects, title);
  }

  const sample = objects
    .map((o) => o.body || o.label)
    .join(" ")
    .slice(0, 400);

  return {
    v: SYMBOL_LENS_VERSION,
    meaning,
    pattern: objects.length > 1 ? "multi-object-pattern" : "single-object",
    roles: objects.slice(0, 6).map((o, i) => ({ role: `object-${i + 1}`, exemplar: o.label })),
    viewPrompt:
      objects.length > 1
        ? `Read new material through the shared pattern in “${title}”: ${meaning} Return ONLY the transformed material.`
        : `Read new material as the same kind of thing as: ${meaning} Return ONLY the transformed material.`,
    portableMeta: {
      title,
      objectCount: objects.length,
      itemCount: struct?.items?.length || 0,
      hasGlyph: !!struct?.symbolStroke,
      samplePreview: sample.slice(0, 120),
    },
  };
}

export function applyLocalSymbolEnrichment(struct) {
  const interpretation = interpretSymbolStructural(struct);
  return {
    interpretation,
    viewLens: viewingLensTreeFromSymbol({ ...struct, interpretation }),
  };
}

/** Apply instant local symbol reading to a saved structure record. */
export function stampSymbolStruct(struct) {
  if (!struct || struct.kind !== "symbol") return struct;
  // Never clobber an LLM-produced or user-customized reading with the local
  // heuristic — only fill gaps.
  if (struct.customized || struct.interpretedAt) {
    const viewLens = struct.viewLens || viewingLensTreeFromSymbol(struct);
    return { ...struct, viewLens };
  }
  const { interpretation, viewLens } = applyLocalSymbolEnrichment(struct);
  return { ...struct, interpretation, viewLens };
}

/** Rough shape description of a hand-drawn glyph, so the model can read it. */
export function describeGlyphStroke(symbolStroke) {
  const strokes = symbolStroke?.strokes?.length
    ? symbolStroke.strokes
    : symbolStroke?.points?.length >= 2
      ? [symbolStroke.points]
      : [];
  if (!strokes.length) return null;
  const all = strokes.flat();
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y);
  const w = Math.max(...xs) - Math.min(...xs);
  const h = Math.max(...ys) - Math.min(...ys);
  const first = all[0];
  const last = all[all.length - 1];
  const closed = Math.hypot(first.x - last.x, first.y - last.y) < 0.12;
  const aspect = h > 0 ? w / h : 1;
  const shapeHint =
    strokes.length === 1 && closed
      ? "a closed loop"
      : strokes.length === 1
        ? "a single open stroke"
        : `${strokes.length} separate strokes`;
  const proportions = aspect > 1.6 ? "wide" : aspect < 0.6 ? "tall" : "roughly square";
  return `${shapeHint}, ${proportions}`;
}

export function buildSymbolInterpretPrompt(struct) {
  const objects = extractSymbolObjects(struct);
  const lines =
    objects.length === 0
      ? ["(visual only)"]
      : objects.map((o, i) => `${i + 1}. [${o.kind}] ${o.label}${o.body ? `: ${o.body.slice(0, 200)}` : ""}`);
  const glyph = describeGlyphStroke(struct?.symbolStroke);

  return `You are reading a personal symbol — a compression of recurring structure someone keeps noticing across domains. Interpret it fully and generalizably: what deep structure do the elements share, and how would that way of seeing re-apply anywhere?

Reply with ONLY this JSON:
{"meaning":"one or two sentences naming the underlying structure this symbol compresses","elements":[{"element":"element label","reading":"what this element contributes to the shared structure"}],"pattern":"a short name for the recurring pattern","viewPrompt":"one imperative sentence instructing an AI to read any new material through this structure and return only the transformed material"}

Title: ${struct?.title || "untitled"}
${glyph ? `Hand-drawn glyph: ${glyph}\n` : ""}Elements on the symbol surface:
${lines.join("\n")}`;
}

export function mergeSymbolInterpretation(structural, llmJson) {
  if (!llmJson || typeof llmJson !== "object") return structural;
  return {
    ...structural,
    meaning: llmJson.meaning || structural.meaning,
    pattern: llmJson.pattern || structural.pattern,
    roles: llmJson.roles?.length ? llmJson.roles : structural.roles,
    elements: Array.isArray(llmJson.elements) ? llmJson.elements : structural.elements || [],
    viewPrompt: llmJson.viewPrompt || structural.viewPrompt,
  };
}

/** Default viewing lens tree from interpretation. */
export function viewingLensTreeFromSymbol(struct) {
  const interp = struct?.interpretation || interpretSymbolStructural(struct);
  const name = `see · ${struct?.title || "symbol"}`.slice(0, 48);
  return {
    name,
    description: interp.meaning,
    prompt: interp.viewPrompt,
  };
}

export function normalizeSymbolRecord(struct) {
  if (!struct || typeof struct !== "object") return null;
  try {
    const base = {
      ...struct,
      interpretation: struct.interpretation || null,
      viewLens: struct.viewLens || null,
      cognitiveTransfer: struct.cognitiveTransfer || null,
    };
    if (base.kind === "symbol" && !base.interpretation?.meaning) {
      const { interpretation, viewLens } = applyLocalSymbolEnrichment(base);
      return { ...base, interpretation, viewLens };
    }
    return base;
  } catch {
    return struct;
  }
}

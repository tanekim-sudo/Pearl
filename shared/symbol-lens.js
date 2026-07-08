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
  const { interpretation, viewLens } = applyLocalSymbolEnrichment(struct);
  return { ...struct, interpretation, viewLens };
}

export function buildSymbolInterpretPrompt(struct) {
  const objects = extractSymbolObjects(struct);
  const lines =
    objects.length === 0
      ? ["(visual only)"]
      : objects.length === 1
        ? [`${objects[0].label}${objects[0].body ? `\n${objects[0].body.slice(0, 200)}` : ""}`]
        : objects.map((o, i) => `${i + 1}. ${o.label}${o.body ? `: ${o.body.slice(0, 120)}` : ""}`);

  return `Interpret this symbol. JSON only:
{"meaning":"one clear sentence","viewPrompt":"one sentence to re-apply this way of seeing"}

Title: ${struct?.title || "untitled"}
Surface:
${lines.join("\n")}`;
}

export function mergeSymbolInterpretation(structural, llmJson) {
  if (!llmJson || typeof llmJson !== "object") return structural;
  return {
    ...structural,
    meaning: llmJson.meaning || structural.meaning,
    pattern: llmJson.pattern || structural.pattern,
    roles: llmJson.roles?.length ? llmJson.roles : structural.roles,
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

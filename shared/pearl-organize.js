/**
 * Organize a pearl's multimodal dump into Moves → Functions → Lenses.
 * Organize-only: preserve verbatim evidence, remove redundant structure, do not summarize away richness.
 */

import { PEARL_STUDIO_COGNITIVE_SECTION_ORDER } from "./pearl-studio.js";

export const PEARL_ORGANIZE_VERSION = 1;

const bounded = (value, limit = 280) => String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);

const OP_PATTERNS = Object.freeze([
  { id: "critique", label: "Critique", re: /\b(?:critiqu|review|feedback|evaluat|assess|judge)\w*\b/i },
  { id: "rewrite", label: "Rewrite", re: /\b(?:rewrit|rephras|edit|polish|tighten|revise)\w*\b/i },
  { id: "summarize", label: "Summarize", re: /\b(?:summariz|tldr|digest|condense)\w*\b/i },
  { id: "compare", label: "Compare", re: /\b(?:compar|contrast|versus|vs\.?)\b/i },
  { id: "plan", label: "Plan", re: /\b(?:plan|roadmap|outline|steps?|checklist)\b/i },
  { id: "research", label: "Research", re: /\b(?:research|sources?|cite|evidence|look up)\b/i },
  { id: "brainstorm", label: "Brainstorm", re: /\b(?:brainstorm|ideat|options?|alternatives?)\b/i },
  { id: "explain", label: "Explain", re: /\b(?:explain|teach|eli5|walk me through)\b/i },
  { id: "invest", label: "Underwrite", re: /\b(?:invest|underwrit|startup|deck|traction|moat|tam)\b/i },
  { id: "draw", label: "Interpret drawing", re: /\b(?:draw|sketch|diagram|whiteboard)\w*\b/i },
  { id: "speak", label: "Interpret speech", re: /\b(?:said|spoke|voice|transcript|dictat)\w*\b/i },
]);

const FRAME_PATTERNS = Object.freeze([
  { id: "as-role", re: /\bas (?:a|an|the) ([a-z][a-z0-9 -]{2,40})\b/i },
  { id: "from-angle", re: /\bfrom (?:a |the )?([a-z][a-z0-9 -]{2,40}) (?:perspective|angle|lens|view|taste)\b/i },
  { id: "care-about", re: /\b(?:care(?:s)? about|concerned with|attracted to|worried about)\s+([a-z][a-z0-9 -]{2,60})\b/i },
  { id: "philosophy", re: /\b(?:philosophy|taste|judgment|aesthetic|ethic)s?\s+(?:of|around|about)\s+([a-z][a-z0-9 -]{2,60})\b/i },
]);

function tokenize(value) {
  return bounded(value, 8_000)
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length > 2);
}

function jaccard(a, b) {
  const left = new Set(a);
  const right = new Set(b);
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const token of left) if (right.has(token)) overlap += 1;
  return overlap / (left.size + right.size - overlap);
}

function materialText(entry) {
  if (!entry) return "";
  if (typeof entry === "string") return entry;
  return [
    entry.text,
    entry.verbatim,
    entry.content,
    entry.quote,
    entry.label,
    entry.name,
    entry.description,
    entry.transcript,
    Array.isArray(entry.notes) ? entry.notes.join(" ") : "",
  ].filter(Boolean).join("\n");
}

/** Collect multimodal dump units without dropping any source refs. */
export function collectPearlDump(pearl = {}, options = {}) {
  const extraText = String(options.extraText || "").trim();
  const units = [];
  const push = (entry, fallbackKind = "dump") => {
    const text = materialText(entry);
    if (!text && !entry?.id && !entry?.kind) return;
    units.push({
      id: String(entry?.id || `dump:${units.length + 1}`),
      kind: String(entry?.kind || entry?.type || fallbackKind),
      label: bounded(entry?.label || entry?.name || text.split(/[.?\n]/)[0] || fallbackKind, 120),
      text: bounded(text || entry?.label || entry?.name || "", 4_000),
      mime: entry?.mime || entry?.mimeType || null,
      drawing: entry?.drawing || entry?.strokes || null,
      image: entry?.image || entry?.src || null,
      tokens: tokenize(text || entry?.label || ""),
      source: cloneShallow(entry),
    });
  };

  for (const entry of pearl.workingSet?.context || []) push(entry, "context");
  for (const entry of pearl.material?.evidence || pearl.evidence || []) push(entry, "evidence");
  for (const entry of pearl.results || []) {
    push({
      id: entry.id || `result:${units.length + 1}`,
      kind: "result",
      text: entry.text || entry.html || "",
      label: entry.label || "Pearl content",
    }, "result");
  }
  if (pearl.identity?.description) {
    push({ id: "identity:description", kind: "description", text: pearl.identity.description, label: "Description" }, "description");
  }
  if (pearl.description) {
    push({ id: "pearl:description", kind: "description", text: pearl.description, label: "Description" }, "description");
  }
  if (extraText) {
    push({ id: "organize:extra", kind: "dump", text: extraText, label: "Dump" }, "dump");
  }
  // Keep already-typed layers as evidence of intent — do not discard them.
  for (const move of pearl.moves || []) {
    push({
      id: move.id || `move-src:${units.length + 1}`,
      kind: "move-source",
      name: move.name,
      text: [move.name, move.description, move.transformation, move.prompt].filter(Boolean).join("\n"),
      label: move.name || "Move",
    }, "move-source");
  }
  for (const fn of pearl.functions || []) {
    push({
      id: fn.id || `function-src:${units.length + 1}`,
      kind: "function-source",
      name: fn.name,
      text: [fn.name, fn.description, ...(fn.steps || []).map((step) => step.prompt || step.name || "")].filter(Boolean).join("\n"),
      label: fn.name || "Function",
    }, "function-source");
  }
  for (const lens of pearl.lenses || pearl.workingSet?.lenses || []) {
    push({
      id: lens.id || `lens-src:${units.length + 1}`,
      kind: "lens-source",
      name: lens.name,
      text: [lens.name, lens.description, lens.judgment, JSON.stringify(lens.perceptualSchema || {})].filter(Boolean).join("\n"),
      label: lens.name || "Lens",
    }, "lens-source");
  }
  return units;
}

function cloneShallow(value) {
  if (value == null || typeof value !== "object") return value;
  try { return structuredClone(value); } catch { return { ...value }; }
}

function detectOps(text) {
  return OP_PATTERNS.filter((entry) => entry.re.test(text)).map((entry) => ({
    id: entry.id,
    name: entry.label,
  }));
}

function detectFrames(text) {
  const frames = [];
  for (const pattern of FRAME_PATTERNS) {
    const match = text.match(pattern.re);
    if (match) {
      frames.push({
        id: `${pattern.id}:${bounded(match[1] || pattern.id, 40).toLowerCase().replace(/\s+/g, "-")}`,
        name: bounded(match[1] || pattern.id, 64),
        frame: pattern.id,
      });
    }
  }
  return frames;
}

function dedupeBySimilarity(items, keyFn, threshold = 0.72) {
  const kept = [];
  for (const item of items) {
    const tokens = tokenize(keyFn(item));
    const duplicate = kept.find((existing) => jaccard(tokenize(keyFn(existing)), tokens) >= threshold);
    if (duplicate) {
      duplicate.evidenceRefs = [...new Set([...(duplicate.evidenceRefs || []), ...(item.evidenceRefs || [])])];
      if ((item.description || "").length > (duplicate.description || "").length) {
        duplicate.description = item.description;
      }
      continue;
    }
    kept.push(item);
  }
  return kept;
}

/**
 * Deterministic organize pass. Preserves every dump unit as working-set evidence.
 * Does not call a model — open rewrite remains a credentialed companion path.
 */
export function organizePearlContents(pearl = {}, options = {}) {
  const units = collectPearlDump(pearl, options);
  if (!units.length) {
    return {
      version: PEARL_ORGANIZE_VERSION,
      ok: false,
      reason: "Nothing to organize — dump speech, drawings, notes, or other material into the pearl first.",
      organization: {
        order: [...PEARL_STUDIO_COGNITIVE_SECTION_ORDER],
        moves: [],
        functions: [],
        lenses: [],
      },
      preservedEvidence: [],
      removedRedundantCount: 0,
    };
  }

  const existingMoves = (pearl.moves || []).map((move, index) => ({
    id: move.id || `move:existing:${index + 1}`,
    name: bounded(move.name || "Move", 80),
    description: bounded(move.description || move.transformation || move.prompt || "", 1_200),
    kind: "move",
    evidenceRefs: (move.evidenceRefs || []).map(String),
    authorship: "preserved",
  }));
  const existingFunctions = (pearl.functions || []).map((fn, index) => ({
    id: fn.id || `function:existing:${index + 1}`,
    name: bounded(fn.name || "Function", 80),
    description: bounded(fn.description || "", 1_200),
    kind: "function",
    steps: (fn.steps || []).slice(0, 24).map((step) => cloneShallow(step)),
    evidenceRefs: (fn.evidenceRefs || []).map(String),
    authorship: "preserved",
  }));
  const existingLenses = (pearl.lenses || pearl.workingSet?.lenses || []).map((lens, index) => ({
    id: lens.id || `lens:existing:${index + 1}`,
    name: bounded(lens.name || "Lens", 80),
    description: bounded(lens.description || "", 1_200),
    kind: "lens",
    strength: Number.isFinite(lens.strength) ? lens.strength : 0.7,
    evidenceRefs: (lens.evidenceRefs || []).map(String),
    authorship: "preserved",
  }));

  const inferredMoves = [];
  const inferredLenses = [];
  const dumpUnits = units.filter((unit) => !["move-source", "function-source", "lens-source"].includes(unit.kind));

  for (const unit of dumpUnits) {
    const ops = detectOps(unit.text);
    for (const op of ops) {
      inferredMoves.push({
        id: `move:${op.id}:${unit.id}`,
        name: op.name,
        description: bounded(`Drawn from dump “${unit.label}”: ${unit.text}`, 1_200),
        kind: "move",
        evidenceRefs: [unit.id],
        authorship: "organized",
      });
    }
    const frames = detectFrames(unit.text);
    for (const frame of frames) {
      inferredLenses.push({
        id: frame.id,
        name: frame.name,
        description: bounded(`Cultivated way of seeing from “${unit.label}”: ${unit.text}`, 1_200),
        kind: "lens",
        strength: 0.72,
        evidenceRefs: [unit.id],
        authorship: "organized",
      });
    }
    // Freeform dump with no detected op/frame still becomes a Move so richness is not lost.
    if (!ops.length && !frames.length && unit.text.length > 40) {
      inferredMoves.push({
        id: `move:hold:${unit.id}`,
        name: bounded(unit.label || "Hold material", 80),
        description: bounded(unit.text, 1_200),
        kind: "move",
        evidenceRefs: [unit.id],
        authorship: "organized",
      });
    }
  }

  const beforeMoveCount = existingMoves.length + inferredMoves.length;
  const beforeLensCount = existingLenses.length + inferredLenses.length;
  const moves = dedupeBySimilarity([...existingMoves, ...inferredMoves], (entry) => `${entry.name} ${entry.description}`);
  const lenses = dedupeBySimilarity([...existingLenses, ...inferredLenses], (entry) => `${entry.name} ${entry.description}`);

  let functions = [...existingFunctions];
  if (!functions.length && (moves.length >= 2 || dumpUnits.length >= 2)) {
    functions = [{
      id: `function:organize:${pearl.id || "pearl"}`,
      name: bounded(`${pearl.name || "Pearl"} organized process`, 72),
      description: bounded(
        `Replay the organized dump as Moves → Functions → Lenses while keeping ${dumpUnits.length} evidence unit${dumpUnits.length === 1 ? "" : "s"} intact.`,
        1_200,
      ),
      kind: "function",
      steps: dumpUnits.slice(0, 12).map((unit, index) => ({
        name: bounded(unit.label || `Step ${index + 1}`, 72),
        prompt: unit.text,
        evidenceRefs: [unit.id],
      })),
      evidenceRefs: dumpUnits.map((unit) => unit.id),
      authorship: "organized",
    }];
  } else {
    functions = dedupeBySimilarity(functions, (entry) => `${entry.name} ${entry.description}`);
  }

  const preservedEvidence = dumpUnits.map((unit) => ({
    id: unit.id,
    kind: unit.kind,
    label: unit.label,
    text: unit.text,
    mime: unit.mime,
    pinned: true,
    organized: true,
    ...(unit.source && typeof unit.source === "object" ? { sourceSnapshot: unit.source } : {}),
  }));

  const removedRedundantCount = Math.max(
    0,
    (beforeMoveCount - moves.length) + (beforeLensCount - lenses.length),
  );

  return {
    version: PEARL_ORGANIZE_VERSION,
    ok: true,
    reason: `Organized into ${moves.length} Moves · ${functions.length} Functions · ${lenses.length} Lenses. Preserved ${preservedEvidence.length} evidence unit${preservedEvidence.length === 1 ? "" : "s"}; removed ${removedRedundantCount} redundant structure.`,
    organization: {
      order: [...PEARL_STUDIO_COGNITIVE_SECTION_ORDER],
      moves,
      functions,
      lenses,
    },
    preservedEvidence,
    removedRedundantCount,
    bounds: {
      modelRequiredForOpenRewrite: true,
      note: "Deterministic organize preserves richness. Deeper semantic rewrite needs model credentials and must not fake mutation.",
    },
  };
}

/** Apply an organize result onto a semantic-orb-shaped pearl object. */
export function applyOrganizeToPearl(pearl, organized) {
  if (!organized?.ok) return pearl;
  const byId = new Map((pearl.workingSet?.context || []).map((item) => [item.id, item]));
  for (const item of organized.preservedEvidence || []) byId.set(item.id, item);
  return {
    ...pearl,
    moves: organized.organization.moves,
    functions: organized.organization.functions,
    lenses: organized.organization.lenses,
    workingSet: {
      ...(pearl.workingSet || {}),
      context: [...byId.values()],
      lenses: organized.organization.lenses.map((lens) => ({
        id: lens.id,
        name: lens.name,
        strength: lens.strength ?? 0.7,
        description: lens.description,
      })),
    },
    provenance: {
      ...(pearl.provenance || {}),
      organize: {
        version: PEARL_ORGANIZE_VERSION,
        at: new Date().toISOString(),
        removedRedundantCount: organized.removedRedundantCount,
        evidenceCount: organized.preservedEvidence.length,
        note: "Organize-only: richness preserved as evidence; structure deduped into Moves → Functions → Lenses.",
      },
    },
  };
}

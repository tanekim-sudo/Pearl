/**
 * Grounded evaluation through active gauntlet pearls + captured page/screen material.
 * Builds a query packet for companion/extension execution — does not invent model success.
 */

export const GAUNTLET_EVAL_VERSION = 1;

const bounded = (value, limit = 400) => String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);

function packLensLines(pack) {
  const lenses = pack.lenses || [];
  if (!lenses.length) return "no bound lenses (use pearl context and functions)";
  return lenses.map((lens) => {
    const judgment = lens.judgment || lens.description || "";
    return `${lens.name}${judgment ? ` — ${bounded(judgment, 160)}` : ""}`;
  }).join("; ");
}

function packMoveLines(pack) {
  const moves = pack.moves || [];
  if (!moves.length) return "";
  return moves.slice(0, 8).map((move) => move.name || move.id).filter(Boolean).join(", ");
}

function packContextLines(pack) {
  return (pack.context || [])
    .slice(0, 8)
    .map((entry) => bounded(entry.summary || entry.text || entry.label || "", 220))
    .filter(Boolean);
}

/**
 * Normalize page/deck material from selection, visible tab, or pasted text.
 */
export function normalizeEvalMaterial(input = {}) {
  const text = bounded(
    input.text || input.quote || input.selection || input.content || input.html || "",
    24_000,
  );
  const title = bounded(input.title || input.pageTitle || input.name || "", 160);
  const url = bounded(input.url || input.pageUrl || "", 500);
  const kind = String(input.kind || input.source || (text ? "page-selection" : "empty"));
  return {
    kind,
    title: title || null,
    url: url || null,
    text,
    characters: text.length,
    capturedAt: input.capturedAt || new Date().toISOString(),
  };
}

/**
 * Build a grounded evaluation query from gauntlet working-memory packs + material.
 */
export function buildGauntletEvaluationQuery({
  workingMemory = null,
  packs = null,
  material = {},
  instruction = "",
} = {}) {
  const memoryPacks = packs
    || workingMemory?.packs
    || [];
  const normalized = normalizeEvalMaterial(material);
  const ask = bounded(
    instruction
      || "Evaluate this material through the active gauntlet pearls. Apply each pearl's cultivated lenses (judgment, taste, philosophy, concerns, attractions). Prefer evidenced critique over generic advice.",
    800,
  );

  if (!memoryPacks.length) {
    return {
      version: GAUNTLET_EVAL_VERSION,
      ok: false,
      reason: "Gauntlet working memory is empty — wear at least one pearl (e.g. a startup lens pearl) before evaluating on-screen material.",
      query: null,
      material: normalized,
      requiresModel: true,
    };
  }
  if (!normalized.text) {
    return {
      version: GAUNTLET_EVAL_VERSION,
      ok: false,
      reason: "No page/deck material captured. Select text on the page, capture the visible tab, or paste the deck content.",
      query: null,
      material: normalized,
      requiresModel: true,
      packs: memoryPacks.map((pack) => ({ pearlId: pack.pearlId, name: pack.name })),
    };
  }

  const stackLines = memoryPacks.map((pack, index) => {
    const moves = packMoveLines(pack);
    const context = packContextLines(pack);
    return [
      `${index + 1}. Pearl “${pack.name}” (${pack.pearlId})`,
      `   Lenses: ${packLensLines(pack)}`,
      moves ? `   Moves: ${moves}` : null,
      (pack.functions || []).length ? `   Functions: ${(pack.functions || []).map((fn) => fn.name).filter(Boolean).join(", ")}` : null,
      context.length ? `   Context: ${context.slice(0, 3).join(" · ")}` : null,
    ].filter(Boolean).join("\n");
  });

  const prompt = [
    "[GAUNTLET CULTIVATED EVALUATION]",
    ask,
    "",
    "Active gauntlet stack (ways of seeing — apply these; do not invent pack contents):",
    ...stackLines,
    "",
    "On-screen / deck material (verbatim; do not pretend to see more than disclosed):",
    normalized.title ? `Title: ${normalized.title}` : null,
    normalized.url ? `URL: ${normalized.url}` : null,
    `Characters: ${normalized.characters}`,
    "---",
    normalized.text,
    "---",
    "Respond with a structured evaluation: strengths, risks, taste/judgment conflicts, open questions, and concrete next probes — grounded in the pearl lenses above.",
  ].filter((line) => line != null).join("\n");

  return {
    version: GAUNTLET_EVAL_VERSION,
    ok: true,
    reason: `Ready to evaluate ${normalized.characters.toLocaleString()} characters through ${memoryPacks.length} gauntlet pearl${memoryPacks.length === 1 ? "" : "s"}.`,
    requiresModel: true,
    material: normalized,
    packs: memoryPacks.map((pack) => ({
      pearlId: pack.pearlId,
      name: pack.name,
      lensCount: (pack.lenses || []).length,
      functionCount: (pack.functions || []).length,
      contextCount: (pack.context || []).length,
    })),
    query: {
      kind: "gauntlet-cultivated-evaluation",
      instruction: ask,
      prompt,
      disclosure: {
        characters: normalized.characters,
        origins: [normalized.kind],
        title: normalized.title,
        url: normalized.url,
      },
    },
  };
}

/** Prompt fragment for execution requests that carry a gauntlet evaluation. */
export function gauntletEvaluationPrompt(evaluation) {
  if (!evaluation?.ok || !evaluation.query?.prompt) return "";
  return evaluation.query.prompt;
}

/**
 * Full pearl context for Companion / planner / runtime (internal).
 * Users see title + system prompt + actions — never this metadata soup.
 * Extends pearl-system-prompt: systemPrompt remains the primary field.
 */

import { normalizePearlSystemPrompt, readPearlSystemPrompt } from "./pearl-system-prompt.js";

export const PEARL_COMPANION_CONTEXT_VERSION = 1;

const bounded = (value, limit = 280) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, limit);
const soft = (value, limit = 1_200) => String(value ?? "").trim().slice(0, limit);

function privacySummary(pearl) {
  const policy = pearl?.privacy?.effectivePolicy
    || pearl?.privacy?.policy
    || pearl?.privacyPolicy
    || null;
  if (!policy || typeof policy !== "object") {
    return {
      audience: "local-only",
      sensitivity: "personal",
      storageMode: "device-only",
      researchAllowed: false,
      summary: "Local on this device; research locked unless the user opens sharing.",
    };
  }
  const audience = policy.audience || "local-only";
  const sensitivity = policy.sensitivity || "personal";
  const storageMode = policy.storage?.mode || (audience === "local-only" ? "device-only" : "account");
  const researchAllowed = Boolean(policy.disclosure?.research?.allowed);
  const parts = [
    `Audience ${audience}`,
    `sensitivity ${sensitivity}`,
    `storage ${storageMode}`,
    researchAllowed ? "research allowed" : "research locked",
  ];
  return {
    audience,
    sensitivity,
    storageMode,
    researchAllowed,
    summary: parts.join(" · "),
  };
}

function summarizeFunctions(pearl) {
  return (pearl?.functions || []).slice(0, 24).map((fn) => {
    const steps = Array.isArray(fn.steps) ? fn.steps : (fn.graph?.nodes || []);
    return {
      name: bounded(fn.name || "Function", 80),
      description: bounded(fn.description || "", 180),
      moveCount: steps.length || Number(fn.stepCount) || 0,
    };
  });
}

function summarizeMoves(pearl) {
  return (pearl?.moves || []).slice(0, 24).map((move) => ({
    name: bounded(move.name || "Move", 80),
    description: bounded(move.description || move.transformation || "", 180),
  }));
}

function summarizeLenses(pearl) {
  const lenses = pearl?.workingSet?.lenses || pearl?.lenses || [];
  return lenses.slice(0, 20).map((lens) => ({
    name: bounded(lens.name || lens.label || "Lens", 80),
    description: bounded(lens.description || lens.judgment || "", 220),
    strength: Number.isFinite(lens.strength) ? lens.strength : null,
  }));
}

function summarizeContext(pearl) {
  return (pearl?.workingSet?.context || []).slice(0, 40).map((entry) => ({
    kind: bounded(entry.kind || "material", 40),
    label: bounded(entry.label || entry.name || entry.text || "Context", 120),
    summary: bounded(entry.text || entry.verbatim || entry.content || entry.label || "", 220),
  }));
}

function lineageHints(pearl) {
  const lineage = Array.isArray(pearl?.lineage) ? pearl.lineage : [];
  const related = pearl?.relationships?.relatedPearlIds || [];
  const children = pearl?.relationships?.childPearlIds || pearl?.relationships?.nestedPearlIds || [];
  const checkpoints = pearl?.history?.checkpoints || [];
  const revision = Math.max(0, Number(pearl?.revision) || 0);
  const parentId = pearl?.relationships?.parentPearlId || pearl?.parentOrbId || null;
  return {
    revision,
    lineageCount: lineage.length,
    relatedCount: related.length,
    childCount: children.length,
    checkpointCount: checkpoints.length,
    hasParent: Boolean(parentId),
    versionHint: revision > 0
      ? `revision ${revision}${checkpoints.length ? ` · ${checkpoints.length} saved versions` : ""}`
      : (checkpoints.length ? `${checkpoints.length} saved versions` : "no named versions yet"),
  };
}

/**
 * Structured companion context for one pearl + optional app state.
 * Keep ids here for the model; never dump this object into user chat.
 */
export function buildPearlCompanionContext(pearl, appState = {}) {
  if (!pearl || typeof pearl !== "object") return null;
  const name = bounded(
    pearl.name || pearl.identity?.name || pearl.representation?.label || "Pearl",
    120,
  );
  const systemPrompt = normalizePearlSystemPrompt(readPearlSystemPrompt(pearl));
  const purpose = soft(
    pearl.identity?.purpose || pearl.purpose || "",
    1_000,
  );
  const functions = summarizeFunctions(pearl);
  const moves = summarizeMoves(pearl);
  const lenses = summarizeLenses(pearl);
  const context = summarizeContext(pearl);
  const privacy = privacySummary(pearl);
  const lineage = lineageHints(pearl);
  const pearlId = String(pearl.id || pearl.pearlId || "").trim() || null;
  const wornIds = Array.isArray(appState.wornPearlIds) ? appState.wornPearlIds.map(String) : [];
  const primaryWornId = appState.primaryPearlId || wornIds[0] || null;
  const worn = Boolean(appState.worn === true || (pearlId && wornIds.includes(pearlId)));
  const slotIndex = pearlId && wornIds.length
    ? wornIds.indexOf(pearlId)
    : (Number.isInteger(appState.slot) ? appState.slot : -1);
  const gauntlet = {
    worn,
    primary: Boolean(pearlId && primaryWornId && pearlId === primaryWornId),
    slot: slotIndex >= 0 ? slotIndex : null,
    filled: Number.isInteger(appState.gauntletFilled) ? appState.gauntletFilled : wornIds.length,
    capacity: Number.isInteger(appState.gauntletCapacity) ? appState.gauntletCapacity : 5,
  };
  const scene = {
    id: appState.sceneId || pearl.sceneId || null,
    name: bounded(appState.sceneName || "", 120) || null,
  };
  const aesthetic = pearl.aesthetic && typeof pearl.aesthetic === "object"
    ? {
      preset: bounded(pearl.aesthetic.preset || "", 40) || null,
      label: bounded(pearl.aesthetic.label || "", 80) || null,
    }
    : null;
  const taste = lenses.length
    ? lenses.map((lens) => lens.name).filter(Boolean).join(", ")
    : (systemPrompt ? soft(systemPrompt, 160) : "");
  return {
    version: PEARL_COMPANION_CONTEXT_VERSION,
    pearlId,
    name,
    systemPrompt,
    purpose: purpose || null,
    taste: taste || null,
    functions,
    moves,
    lenses,
    context,
    privacy,
    lineage,
    gauntlet,
    scene,
    wear: {
      worn: gauntlet.worn,
      primary: gauntlet.primary,
      slot: gauntlet.slot,
    },
    aesthetic,
    representationKind: bounded(pearl.representation?.kind || pearl.kind || "pearl", 40),
    summary: bounded(
      [
        name,
        systemPrompt ? "system prompt set" : "no system prompt",
        functions.length ? `${functions.length} functions` : null,
        moves.length ? `${moves.length} moves` : null,
        lenses.length ? `${lenses.length} lenses` : null,
        context.length ? `${context.length} context` : null,
        gauntlet.worn ? `gauntlet ${gauntlet.filled}/${gauntlet.capacity}` : "on shelf",
      ].filter(Boolean).join(" · "),
      280,
    ),
  };
}

/**
 * Inject into Companion / planner / runtime prompts (model-facing).
 */
export function formatPearlCompanionContextForModel(context, options = {}) {
  if (!context) {
    return [
      "No pearl is active in working memory.",
      "Companion still helps fully — wear or create a pearl when the user wants one.",
    ].join(" ");
  }
  const promptLimit = Number.isFinite(options.promptLimit) ? options.promptLimit : 2_400;
  const lines = [
    `Active pearl context for Companion (internal — do not echo ids/hashes/raw JSON to the user unless they explicitly ask to “show id”):`,
    `Title: “${context.name}”`,
    context.pearlId ? `Internal id: ${context.pearlId}` : null,
    context.purpose ? `Purpose: ${soft(context.purpose, 600)}` : null,
    `System prompt (${context.systemPrompt ? "present" : "empty"}):`,
    context.systemPrompt ? soft(context.systemPrompt, promptLimit) : "(empty — ask the user to set one, or infer carefully)",
    context.functions?.length
      ? `Functions: ${context.functions.map((fn) => `${fn.name}${fn.moveCount ? ` (${fn.moveCount} moves)` : ""}`).join("; ")}`
      : "Functions: none",
    context.moves?.length
      ? `Moves: ${context.moves.map((move) => move.name).join("; ")}`
      : "Moves: none listed",
    context.lenses?.length
      ? `Lenses / taste: ${context.lenses.map((lens) => lens.name).join("; ")}`
      : "Lenses / taste: (from system prompt)",
    context.context?.length
      ? `Working context: ${context.context.map((entry) => entry.label).slice(0, 12).join("; ")}`
      : "Working context: empty",
    `Gauntlet: ${context.gauntlet?.worn ? `worn slot ${context.gauntlet.slot ?? "?"} (${context.gauntlet.filled}/${context.gauntlet.capacity})${context.gauntlet.primary ? " · primary" : ""}` : "not worn"}`,
    context.scene?.name || context.scene?.id
      ? `Scene: ${context.scene.name || "unnamed"}${context.scene.id ? ` (${context.scene.id})` : ""}`
      : null,
    context.privacy?.summary ? `Privacy: ${context.privacy.summary}` : null,
    context.lineage?.versionHint ? `Lineage / versions: ${context.lineage.versionHint}` : null,
    context.aesthetic?.label || context.aesthetic?.preset
      ? `Appearance: ${context.aesthetic.label || context.aesthetic.preset}`
      : null,
    "Interpret and act through the system prompt first. Prefer this pearl's functions, moves, lenses, and context before inventing new ones.",
    "Users edit the system prompt via setPearlSystemPrompt / editPearlSystemPrompt; never dump machine metadata in chat replies.",
  ];
  return lines.filter(Boolean).join("\n");
}

/**
 * Short user-facing wear / inspect copy — title + prompt presence, no metadata.
 */
export function userFacingPearlWearMessage(context) {
  if (!context) {
    return "Gauntlet is empty. Wear a pearl when you want Companion to use one.";
  }
  if (context.gauntlet?.worn) {
    return context.systemPrompt
      ? `Wearing “${context.name}”. Companion will follow its system prompt.`
      : `Wearing “${context.name}”. Set a system prompt so Companion knows how to use it.`;
  }
  return `“${context.name}” is ready. Wear it to load it into Companion.`;
}

/** Detect explicit power-user request to reveal ids / raw metadata. */
export function userAskedToRevealPearlMetadata(utterance = "") {
  return /\b(?:show|reveal|print|dump|copy)\b.{0,40}\b(?:id|ids|uuid|hash|metadata|json|raw|schema|storage\s*key|contract)\b/i
    .test(String(utterance || ""));
}

/**
 * Scrub technical pearl metadata from companion chat / dumps.
 * Does not delete storage — display-only.
 */
export function scrubPearlMetadataFromUserText(text, options = {}) {
  const raw = String(text ?? "");
  if (!raw) return "";
  if (options.revealIds === true || userAskedToRevealPearlMetadata(options.utterance || "")) {
    return raw;
  }
  let out = raw;
  // UUIDs and long hex hashes
  out = out.replace(
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
    "",
  );
  out = out.replace(/\b[0-9a-f]{32,64}\b/gi, "");
  // Internal pearl / orb id tokens
  out = out.replace(/\b(?:pearl|orb|semantic-orb|entity|layer|fn|move|lens)[:_-][a-z0-9._:-]{6,}\b/gi, "");
  // Parenthetical id dumps: (“Name” (pearl:…)) or (p1)
  out = out.replace(/\(\s*(?:pearl|orb|id)[:\s][^)]+\)/gi, "");
  out = out.replace(/\(\s*[a-z]{0,8}[-_]?\d{1,4}\s*\)/gi, "");
  // Machine field dumps
  out = out.replace(/\b(?:schemaVersion|stableId|contractId|storageKey|idempotencyKey|provisionalId)\b\s*[:=]\s*\S+/gi, "");
  out = out.replace(/\brev(?:ision)?\s*[:=]?\s*\d+\b/gi, "");
  out = out.replace(/\bstep\s*:\s*\d+\b/gi, "");
  out = out.replace(/\bsemantic[- ]orbs?\b/gi, "pearls");
  out = out.replace(/\blens\.(?:companion|pearl|orb)[.\w-]*/gi, "");
  // Raw JSON-ish privacy / policy blobs in chat
  out = out.replace(/\{[^{}]{0,40}"(?:audience|sensitivity|disclosure|acl|encryption)"[^{}]{0,400}\}/g, "");
  out = out.replace(/[ \t]{2,}/g, " ");
  out = out.replace(/\n{3,}/g, "\n\n");
  return out.trim();
}

/**
 * Enrich an existing worn pack with companionContext (non-destructive).
 */
export function attachPearlCompanionContext(pack, pearl, appState = {}) {
  if (!pack) return null;
  const companionContext = buildPearlCompanionContext(pearl, {
    ...appState,
    worn: true,
    wornPearlIds: appState.wornPearlIds || (pack.pearlId ? [pack.pearlId] : []),
    primaryPearlId: appState.primaryPearlId || pack.pearlId || null,
  });
  return {
    ...pack,
    companionContext,
    purpose: companionContext?.purpose || pack.purpose || null,
    privacy: companionContext?.privacy || pack.privacy || null,
    lineage: companionContext?.lineage || pack.lineage || null,
    scene: companionContext?.scene || pack.scene || null,
    taste: companionContext?.taste || pack.taste || null,
  };
}

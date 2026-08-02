/**
 * Pearl companion harness — Cursor-for-pearls execution loop:
 *   Observe pearl(s) → Interpret any NL request → Propose tool actions → Apply → Reveal
 *
 * Tools: create / edit layers (Moves·Weights·Lenses) / compare / produce output / ask.
 * systemPrompt is a readable projection — never a dump of chat/execution requests.
 *
 * Composes: pearl-companion-context, pearl-system-prompt, pearl-layer-*, pearl-compare.
 * Parsers in companion-intent remain optional fast-path hints.
 */

import {
  buildPearlCompanionContext,
  formatPearlCompanionContextForModel,
  scrubPearlMetadataFromUserText,
} from "./pearl-companion-context.js";
import {
  buildCompanionGrounding,
  formatCompanionGroundingForModel,
  formatCompanionPearlJobForModel,
} from "./companion-pearl-job.js";
import {
  defaultSystemPromptFromIntent,
  editPearlSystemPrompt,
  normalizePearlSystemPrompt,
  readPearlSystemPrompt,
  scrubExecutionRequestsFromSystemPrompt,
} from "./pearl-system-prompt.js";
import { EXECUTION_CODES } from "./execution-result.js";
import {
  buildPearlLayerPack,
  formatPearlLayerInstructionsForCompanion,
  projectSystemPromptFromLayers,
  seedPearlLayersFromIntent,
  syncLayersFromSystemPrompt,
  titleFromStyleAndDomain,
} from "./pearl-layer-instructions.js";
import { readPearlWeights } from "./pearl-weights.js";
import {
  looksLikePearlCompareRequest,
  looksLikePearlExecutionRequest,
  looksLikeProduceOutputRequest,
  proposePearlCompare,
} from "./pearl-compare.js";

export const PEARL_PROMPT_HARNESS_VERSION = 2;

/** Structured intents the harness understands. */
export const PEARL_PROMPT_INTENTS = Object.freeze([
  "create_pearl",
  "edit_layers",
  "edit_prompt",
  "replace_prompt",
  "compare_pearls",
  "produce_output",
  "ask",
  "clarify",
  "other",
]);

/** Cursor-like trail stages shown in Companion chat. */
export const PEARL_PROMPT_TRAIL_STAGES = Object.freeze([
  "working",
  "interpreting",
  "proposed",
  "applied",
  "blocked",
]);

/** JSON schema for intelligent layer + prompt rewrite via /api/run. */
export const PEARL_PROMPT_REWRITE_SCHEMA = Object.freeze({
  name: "pearl_prompt_rewrite",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["intent", "systemPrompt", "summary", "rationale"],
    properties: {
      intent: {
        type: "string",
        enum: ["create_pearl", "edit_prompt", "replace_prompt", "clarify"],
      },
      title: { type: "string" },
      systemPrompt: { type: "string" },
      summary: { type: "string" },
      rationale: { type: "string" },
      moves: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "description"],
          properties: {
            name: { type: "string" },
            description: { type: "string" },
          },
        },
      },
      weights: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "priority"],
          properties: {
            name: { type: "string" },
            priority: { type: "number" },
            note: { type: "string" },
          },
        },
      },
      lenses: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "description"],
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            strength: { type: "number" },
          },
        },
      },
    },
  },
});

const soft = (value, limit = 2_000) => String(value ?? "").trim().slice(0, limit);
const compact = (value) => String(value || "").replace(/\s+/g, " ").trim();

/**
 * Observe: load full pearl companion context (internal — never dump to chat).
 */
export function observePearlPromptContext(pearl, appState = {}) {
  const companionContext = pearl
    ? buildPearlCompanionContext(pearl, appState)
    : null;
  const layers = pearl ? buildPearlLayerPack(pearl) : null;
  const layerInstructions = formatPearlLayerInstructionsForCompanion({
    pearl: pearl || null,
    includeExamples: false,
  });
  const grounding = buildCompanionGrounding({
    pearl,
    pearlContext: companionContext,
    appState,
    appSnapshot: appState.appSnapshot || null,
  });
  return {
    version: PEARL_PROMPT_HARNESS_VERSION,
    stage: "working",
    pearlId: companionContext?.pearlId || null,
    name: companionContext?.name || null,
    systemPrompt: companionContext?.systemPrompt || (pearl ? readPearlSystemPrompt(pearl) : ""),
    weights: pearl ? readPearlWeights(pearl) : [],
    layers,
    layerInstructions,
    companionContext,
    grounding,
    appSnapshot: grounding.appSnapshot,
    modelContext: [
      formatCompanionGroundingForModel(grounding, {
        includePearlContext: Boolean(companionContext),
        promptLimit: 2_400,
      }),
      companionContext ? null : "No active pearl.",
      "",
      layerInstructions,
    ].filter((line) => line != null).join("\n"),
  };
}

/**
 * Interpret: utterance → structured intent.
 * Deterministic parsers are optional hints; soft heuristics catch novel phrasing
 * so create/edit never fall through to unknown-error when a pearl path is clear.
 */
export function interpretPearlPromptUtterance(utterance, options = {}) {
  const text = compact(utterance);
  if (!text) {
    return {
      intent: "clarify",
      confidence: 1,
      reason: "empty",
      utterance: "",
      hint: null,
      titleHint: "",
      mode: null,
    };
  }

  const hasActivePearl = Boolean(options.hasActivePearl || options.pearl);
  const fastPath = options.fastPathHint || null;

  // Compare / produce_output / explain-diff — NEVER edit_prompt / append into systemPrompt.
  // Must win over soft-adapt ("investor" etc.) and over fast-path prompt edits.
  if (looksLikePearlCompareRequest(text) || looksLikePearlExecutionRequest(text)) {
    const wantOutput = looksLikeProduceOutputRequest(text);
    return {
      intent: wantOutput ? "produce_output" : "compare_pearls",
      confidence: 0.95,
      reason: wantOutput ? "compare+produce-output" : "compare-signal",
      utterance: text,
      hint: soft(text, 2_000),
      titleHint: "",
      mode: null,
      compare: true,
      produceOutput: wantOutput,
      verb: "comparePearls",
    };
  }
  if (looksLikeProduceOutputRequest(text) && !/^(?:make|create|save|build|forge)\b/i.test(text)) {
    return {
      intent: "produce_output",
      confidence: 0.9,
      reason: "produce-output-signal",
      utterance: text,
      hint: soft(text, 2_000),
      titleHint: "",
      mode: null,
      produceOutput: true,
      verb: "producePearlOutput",
    };
  }

  if (fastPath?.verb === "getPearlSystemPrompt") {
    return {
      intent: "ask",
      confidence: 1,
      reason: "read-prompt",
      utterance: text,
      hint: null,
      titleHint: "",
      mode: null,
      verb: "getPearlSystemPrompt",
    };
  }
  if (fastPath?.verb === "comparePearls") {
    return {
      intent: looksLikeProduceOutputRequest(text) ? "produce_output" : "compare_pearls",
      confidence: 0.98,
      reason: "fast-path-compare",
      utterance: text,
      hint: soft(text, 2_000),
      titleHint: "",
      mode: null,
      compare: true,
      produceOutput: looksLikeProduceOutputRequest(text),
      verb: "comparePearls",
    };
  }
  if (fastPath?.verb === "createSemanticOrb") {
    return {
      intent: "create_pearl",
      confidence: 0.95,
      reason: "fast-path-create",
      utterance: text,
      hint: soft(fastPath.args?.systemPromptHint || fastPath.args?.intent || text, 2_000),
      titleHint: soft(fastPath.args?.name || "", 80),
      mode: "seed",
    };
  }
  if (fastPath?.verb === "editPearlSystemPrompt" || fastPath?.verb === "setPearlSystemPrompt") {
    // Guard: never honor a fast-path edit when the utterance is an execution request.
    if (looksLikePearlExecutionRequest(text)) {
      return {
        intent: "compare_pearls",
        confidence: 0.95,
        reason: "execution-overrides-edit-fast-path",
        utterance: text,
        hint: soft(text, 2_000),
        titleHint: "",
        mode: null,
        compare: true,
        produceOutput: looksLikeProduceOutputRequest(text),
        verb: "comparePearls",
      };
    }
    const mode = String(fastPath.args?.mode || "rewrite").toLowerCase();
    return {
      intent: mode === "append" ? "edit_prompt" : "replace_prompt",
      confidence: 0.95,
      reason: "fast-path-edit",
      utterance: text,
      hint: soft(fastPath.args?.text || fastPath.args?.systemPrompt || fastPath.args?.instruction || text, 2_000),
      titleHint: soft(fastPath.args?.name || "", 80),
      mode: mode === "append" ? "append" : "rewrite",
    };
  }

  // Create signals — any make/create/save … pearl …
  if (
    /^(?:make|create|save|build|spin\s*up|forge)\b/i.test(text)
    && /\bpearl\b/i.test(text)
    && !/^(?:make|turn)\s+(?:this|that|the)\s+/i.test(text)
    && !/\b(?:rename|delete|remove|wear|merge|open|activate|compare|difference)\b/i.test(text)
  ) {
    const topic = text.match(
      /(?:make|create|save|build|spin\s*up|forge)(?:\s+(?:me|us))?\s+(?:an?)\s+(.+?)\s+pearl\b/i,
    )?.[1]?.trim();
    const about = text.match(/\b(?:about|called|named|titled)\s+(.+?)(?:\s*[:\-–]|$)/i)?.[1]?.trim();
    const titleHint = soft(about || topic || "", 80).replace(/^["“]|["”]$/g, "");
    return {
      intent: "create_pearl",
      confidence: 0.85,
      reason: "create-signal",
      utterance: text,
      hint: soft(text, 2_000),
      titleHint,
      mode: "seed",
    };
  }

  // Explicit replace / rewrite of the prompt body
  if (
    /\b(?:rewrite|replace|set|overwrite)\b.{0,40}\b(?:system\s+)?prompt\b/i.test(text)
    || /^(?:make|turn)\s+(?:this|that|the)\s+(?:active\s+|current\s+)?pearl\s+about\b/i.test(text)
  ) {
    return {
      intent: "replace_prompt",
      confidence: 0.9,
      reason: "replace-signal",
      utterance: text,
      hint: soft(text, 2_000),
      titleHint: "",
      mode: "rewrite",
    };
  }

  // Layer-targeted edits (Moves / Weights / Lenses language)
  if (
    hasActivePearl
    && /\b(?:move|moves|weight|weights|lens|lenses)\b/i.test(text)
    && /\b(?:add|reorder|remove|change|update|edit|prefer|care|weight)\b/i.test(text)
    && !looksLikePearlExecutionRequest(text)
  ) {
    return {
      intent: "edit_layers",
      confidence: 0.85,
      reason: "layer-edit-signal",
      utterance: text,
      hint: soft(text, 2_000),
      titleHint: "",
      mode: "rewrite",
    };
  }

  // Soft edit / adapt — natural language refinements when a pearl is in focus
  // Hard exclude: compare / PDF / download / differences (execution, not taste edit).
  const editSignals = (
    /\b(?:more like|less like|inspired by|in the style of|append|include|prefer|always|never|observe)\b/i.test(text)
    || /\badd\b/i.test(text)
    || /\bskeptic/i.test(text)
    || /\b(?:make (?:it|this|the prompt)|update (?:the |this )?prompt|change (?:the |this )?prompt|tweak|refine|adapt|adjust)\b/i.test(text)
    || (hasActivePearl && /\b(?:prompt|instructions|taste|voice|tone|style)\b/i.test(text)
      && /\b(?:add|make|change|update|rewrite|more|less|like|about)\b/i.test(text))
  );
  if (
    editSignals
    && !looksLikePearlExecutionRequest(text)
    && (hasActivePearl || /\b(?:this|that|the)\s+(?:active\s+|current\s+)?(?:pearl|prompt)\b/i.test(text))
  ) {
    const appendish = /^(?:add|append|include)\b/i.test(text)
      || /\badd (?:that|some|a|skepticism|skeptical)\b/i.test(text);
    return {
      intent: "edit_prompt",
      confidence: hasActivePearl ? 0.8 : 0.65,
      reason: appendish ? "append-signal" : "adapt-signal",
      utterance: text,
      hint: soft(text, 2_000),
      titleHint: "",
      mode: appendish ? "append" : "rewrite",
    };
  }

  // Active pearl + short taste instruction with no other clear verb → edit
  if (
    hasActivePearl
    && text.length >= 8
    && text.length <= 280
    && !looksLikePearlExecutionRequest(text)
    && !/^(?:what|why|how|who|where|when|show|list|open|wear|merge|delete|rename|navigate|go\b|explain)\b/i.test(text)
    && !/\b(?:function|move|lens|gauntlet|encode|install|extension|download|pdf|difference|differences|compare)\b/i.test(text)
    && /(?:like|about|skeptic|observe|prefer|always|never|voice|tone|style|haiku|memo|poetry|investor)/i.test(text)
  ) {
    return {
      intent: "edit_prompt",
      confidence: 0.55,
      reason: "soft-adapt-active",
      utterance: text,
      hint: soft(text, 2_000),
      titleHint: "",
      mode: "rewrite",
    };
  }

  // Read-only ask about the active pearl (not an edit)
  if (
    hasActivePearl
    && /^(?:what|why|how|who|where|when|explain|tell\s+me|show)\b/i.test(text)
    && !looksLikePearlExecutionRequest(text)
  ) {
    return {
      intent: "ask",
      confidence: 0.5,
      reason: "ask-signal",
      utterance: text,
      hint: soft(text, 2_000),
      titleHint: "",
      mode: null,
    };
  }

  return {
    intent: "other",
    confidence: 0.2,
    reason: "no-pearl-prompt-signal",
    utterance: text,
    hint: null,
    titleHint: "",
    mode: null,
  };
}

/**
 * Offline / no-credentials propose: best-effort local merge so UX never dies.
 */
export function proposePearlPromptLocal(interpretation, observation = {}) {
  const intent = interpretation?.intent || "other";
  const utterance = soft(interpretation?.utterance || interpretation?.hint || "", 2_000);
  const prior = normalizePearlSystemPrompt(observation.systemPrompt || "");
  const name = soft(interpretation?.titleHint || observation.name || "", 80);

  if (intent === "clarify") {
    return {
      ok: false,
      source: "local",
      intent,
      code: EXECUTION_CODES.NEEDS_CLARIFICATION,
      summary: "Say what this pearl should do, or how to change its system prompt.",
      rationale: "Empty utterance",
      title: name || null,
      systemPrompt: prior,
      mode: null,
    };
  }

  if (intent === "create_pearl") {
    const title = name
      || titleFromStyleAndDomain(utterance)
      || titleFromUtterance(utterance)
      || "New pearl";
    const layers = seedPearlLayersFromIntent({
      name: title,
      intent: utterance,
      systemPromptHint: interpretation?.hint || utterance,
      materialText: utterance,
      titleHint: name,
    });
    const layerSummary = [
      layers.moves?.length ? `${layers.moves.length} Moves` : null,
      layers.weights?.length ? `${layers.weights.length} Weights` : null,
      layers.lenses?.length ? `${layers.lenses.length} Lenses` : null,
    ].filter(Boolean).join(" · ");
    return {
      ok: true,
      source: "local",
      intent,
      title: layers.title || title,
      systemPrompt: layers.systemPrompt,
      layers,
      summary: `Seed ${layerSummary || "Moves · Weights · Lenses"} for “${layers.title || title}”.`,
      rationale: "Offline layer seed (AI can refine when signed in — never required for create).",
      mode: "seed",
      // Create succeeds offline; AI enrich is optional post-step, not a blocker.
      needsRicherRewrite: false,
      aiEnrichOptional: true,
    };
  }

  // Compare / produce_output are handled by proposePearlCompare — never mutate prompt here.
  if (
    intent === "compare_pearls"
    || intent === "produce_output"
    || interpretation?.compare
    || looksLikePearlExecutionRequest(utterance)
  ) {
    return {
      ok: false,
      source: "local",
      intent: intent === "produce_output" ? "produce_output" : "compare_pearls",
      code: EXECUTION_CODES.OK,
      summary: "Route to comparePearls — do not edit systemPrompt.",
      rationale: "Execution request (compare/output), not a prompt edit",
      title: observation.name || name || null,
      systemPrompt: prior,
      mode: null,
      mutatesSystemPrompt: false,
      passToCompare: true,
    };
  }

  if (intent === "ask") {
    return {
      ok: false,
      source: "local",
      intent: "ask",
      code: EXECUTION_CODES.UNKNOWN_INTENT,
      summary: "Ask routed outside prompt mutation.",
      rationale: "Read-only ask",
      title: observation.name || name || null,
      systemPrompt: prior,
      mode: null,
      mutatesSystemPrompt: false,
      passThrough: true,
    };
  }

  if (intent === "replace_prompt" || intent === "edit_prompt" || intent === "edit_layers") {
    // Hard stop: never treat execution requests as refinements.
    if (looksLikePearlExecutionRequest(utterance)) {
      return {
        ok: false,
        source: "local",
        intent: "compare_pearls",
        code: EXECUTION_CODES.OK,
        summary: "Blocked prompt mutation — this is a compare/output request.",
        rationale: "execution-request-guard",
        title: observation.name || name || null,
        systemPrompt: prior,
        mode: null,
        mutatesSystemPrompt: false,
        passToCompare: true,
      };
    }
    if (!observation.pearlId && !prior && !optionsHasPearl(observation)) {
      return {
        ok: false,
        source: "local",
        intent,
        code: EXECUTION_CODES.MISSING_ARGS,
        summary: "Wear or open a pearl first, then tell me how to change its system prompt.",
        rationale: "No active pearl",
        title: null,
        systemPrompt: "",
        mode: null,
      };
    }
    const mode = interpretation?.mode === "append" ? "append" : "rewrite";
    let nextText;
    if (mode === "append") {
      nextText = extractAppendInstruction(utterance);
      if (looksLikePearlExecutionRequest(nextText)) {
        return {
          ok: false,
          source: "local",
          intent: "compare_pearls",
          code: EXECUTION_CODES.OK,
          summary: "Blocked append of execution request into systemPrompt.",
          rationale: "execution-request-guard",
          title: observation.name || name || null,
          systemPrompt: prior,
          mode: null,
          mutatesSystemPrompt: false,
          passToCompare: true,
        };
      }
      const edited = editPearlSystemPrompt(prior, { mode: "append", text: nextText });
      return {
        ok: edited.ok,
        source: "local",
        intent: "edit_prompt",
        title: observation.name || name || null,
        systemPrompt: scrubExecutionRequestsFromSystemPrompt(edited.systemPrompt),
        prior,
        summary: edited.ok
          ? `Append intent into the system prompt${observation.name ? ` for “${observation.name}”` : ""}.`
          : (edited.reason || "Could not append."),
        rationale: "Offline append merge. Connect AI for a full intelligent rewrite.",
        mode: "append",
        needsRicherRewrite: true,
        code: edited.ok ? EXECUTION_CODES.OK : EXECUTION_CODES.VALIDATION_ERROR,
      };
    }
    // Intelligent-looking local rewrite: merge instruction into a full prompt body,
    // then re-seed / sync structured layers so fidelity stays in Moves · Weights · Lenses.
    nextText = mergeInstructionIntoPrompt(prior, utterance, {
      name: observation.name || name,
    });
    const layerSeed = seedPearlLayersFromIntent({
      name: observation.name || name || "Pearl",
      intent: utterance,
      systemPrompt: nextText,
      systemPromptHint: utterance,
    });
    const synced = syncLayersFromSystemPrompt(nextText, {
      moves: observation.layers?.moves?.length ? observation.layers.moves : layerSeed.moves,
      weights: observation.weights?.length ? observation.weights : layerSeed.weights,
      lenses: observation.layers?.lenses?.length ? observation.layers.lenses : layerSeed.lenses,
    });
    // Prefer newly seeded factors from the utterance when prior layers are empty.
    const mergedLayers = {
      ...layerSeed,
      moves: synced.moves?.length ? synced.moves : layerSeed.moves,
      weights: synced.weights?.length ? synced.weights : layerSeed.weights,
      lenses: synced.lenses?.length ? synced.lenses : layerSeed.lenses,
    };
    const projected = projectSystemPromptFromLayers(mergedLayers, {
      name: observation.name || name,
      intent: utterance,
      basePrompt: nextText,
      voice: mergedLayers.voice,
    });
    return {
      ok: true,
      source: "local",
      intent: intent === "edit_layers" ? "edit_layers" : "edit_prompt",
      title: observation.name || name || null,
      systemPrompt: scrubExecutionRequestsFromSystemPrompt(projected),
      layers: mergedLayers,
      prior,
      summary: `Updated Moves · Weights · Lenses${observation.name ? ` for “${observation.name}”` : ""} from your instruction.`,
      rationale: "Offline structured merge. Connect AI for a deeper taste-preserving rewrite.",
      mode: "rewrite",
      needsRicherRewrite: true,
      aiEnrichOptional: true,
    };
  }

  return {
    ok: false,
    source: "local",
    intent: "other",
    code: EXECUTION_CODES.UNKNOWN_INTENT,
    summary: "That does not look like a pearl create or system-prompt edit.",
    rationale: interpretation?.reason || "other",
    title: null,
    systemPrompt: prior,
    mode: null,
  };
}

function optionsHasPearl(observation) {
  return Boolean(observation?.companionContext || observation?.pearlId);
}

function titleFromUtterance(utterance) {
  const styled = titleFromStyleAndDomain(utterance);
  if (styled) return soft(styled, 80);
  const about = compact(utterance).match(/\b(?:about|called|named|titled)\s+(.+)$/i)?.[1];
  if (about) return soft(about.replace(/^["“]|["”]$/g, ""), 80);
  const topic = compact(utterance).match(
    /(?:make|create|save)(?:\s+(?:me|us))?\s+(?:an?)\s+(.+?)\s+pearl\b/i,
  )?.[1];
  if (topic && !/^(?:new|this|that|the|a|an)$/i.test(topic)) return soft(topic, 80);
  return "";
}

function extractAppendInstruction(utterance) {
  const match = compact(utterance).match(
    /^(?:add|append|include)\s+(?:that\s+)?(.+)$/i,
  );
  return soft(match?.[1] || utterance, 2_000);
}

/**
 * Local merge: preserve prior taste lines, fold the new instruction in.
 */
export function mergeInstructionIntoPrompt(prior, instruction, options = {}) {
  const base = scrubExecutionRequestsFromSystemPrompt(normalizePearlSystemPrompt(prior));
  const note = soft(instruction, 2_000);
  const name = soft(options.name || "", 120);
  if (!note) return base;
  // Never fold compare/PDF/execution chat into the brain.
  if (looksLikePearlExecutionRequest(note)) {
    return base;
  }
  if (!base) {
    return scrubExecutionRequestsFromSystemPrompt(defaultSystemPromptFromIntent({
      name,
      intent: note,
      systemPromptHint: note,
      topic: name || note.slice(0, 80),
    }));
  }
  // Avoid duplicating an identical instruction already present.
  if (base.toLowerCase().includes(note.toLowerCase().slice(0, Math.min(80, note.length)))) {
    return base;
  }
  const header = name ? `You are the Pearl “${name}”.` : null;
  const preserved = base
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^user refinement:/i.test(line))
    .filter((line) => !/^source request:/i.test(line));
  const lines = [
    ...(header && !preserved.some((line) => /you are the pearl/i.test(line)) ? [header] : []),
    ...preserved,
    "",
    `User refinement: ${note}`,
    "Honor the refinement while preserving prior taste, voice, and constraints unless the user clearly overrides them.",
  ];
  return scrubExecutionRequestsFromSystemPrompt(normalizePearlSystemPrompt(lines.filter((line, index, all) => {
    if (line === "" && all[index - 1] === "") return false;
    return true;
  }).join("\n")));
}

/**
 * Build the model system + user prompts for intelligent rewrite.
 */
export function buildPearlPromptRewriteRequest(observation, interpretation) {
  const system = [
    formatCompanionPearlJobForModel({
      extra: "This turn is mutate_brain only — rewrite Moves·Weights·Lenses. If the utterance is compare/PDF/export, refuse and leave systemPrompt unchanged.",
    }),
    "You rewrite Pearl brains with full intelligence: Moves, Weights, Lenses, and a projected systemPrompt.",
    "Canonical fidelity is Moves (how work is done) + Weights (what is valued) + Lenses (how to see). systemPrompt is the readable projection of those layers — not a flat-only brain.",
    "Always return structured moves[], weights[], and lenses[] when creating or materially editing a pearl. Keep them non-empty for create.",
    "Preserve the user's taste and prior constraints; merge edits rather than discarding history unless they ask to replace everything.",
    "Never expose internal ids, hashes, storage keys, revisions, or raw metadata in title/summary/rationale/systemPrompt.",
    "Never paste the user's task/request into systemPrompt as Source request / User refinement when it is an operate request.",
    "Return only structured JSON matching the schema.",
    "systemPrompt must be a complete, usable prompt that includes ## Moves, ## Weights, and ## Lenses sections mirroring the arrays.",
    "summary: one short human sentence of what changed (for Companion chat).",
    "rationale: one short internal why (also user-safe).",
    observation.layerInstructions || "",
    observation.modelContext || "",
  ].filter(Boolean).join("\n\n");

  const user = [
    `Utterance: ${interpretation.utterance || ""}`,
    `Interpreted intent: ${interpretation.intent}`,
    `Preferred mode: ${interpretation.mode || "rewrite"}`,
    observation.systemPrompt
      ? `Current system prompt:\n${soft(observation.systemPrompt, 4_000)}`
      : "Current system prompt: (empty)",
    observation.name ? `Pearl title: ${observation.name}` : null,
    observation.layers
      ? `Current layers JSON:\n${soft(JSON.stringify({
        moves: observation.layers.moves,
        weights: observation.layers.weights,
        lenses: observation.layers.lenses,
      }), 3_000)}`
      : null,
    "Produce the next moves, weights, lenses, and projected systemPrompt.",
  ].filter(Boolean).join("\n\n");

  return {
    system,
    prompt: user,
    temperature: 0.2,
    jsonSchema: PEARL_PROMPT_REWRITE_SCHEMA,
    maxTokens: 2_400,
    profile: "companion_planning",
  };
}

/**
 * Normalize a model JSON rewrite into a proposal (fallback to local on failure).
 */
export function normalizePearlPromptProposal(raw, interpretation, observation) {
  const local = proposePearlPromptLocal(interpretation, observation);
  let parsed = raw;
  if (typeof raw === "string") {
    try {
      const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      parsed = JSON.parse(trimmed);
    } catch {
      return { ...local, source: "local-fallback", modelError: "unparseable" };
    }
  }
  if (!parsed || typeof parsed !== "object") {
    return { ...local, source: "local-fallback", modelError: "empty" };
  }
  const systemPrompt = normalizePearlSystemPrompt(parsed.systemPrompt || "");
  if (!systemPrompt) {
    return { ...local, source: "local-fallback", modelError: "empty-prompt" };
  }
  const intent = PEARL_PROMPT_INTENTS.includes(parsed.intent)
    ? parsed.intent
    : interpretation.intent;
  if (intent === "clarify") {
    return {
      ok: false,
      source: "model",
      intent: "clarify",
      code: EXECUTION_CODES.NEEDS_CLARIFICATION,
      summary: scrubPearlMetadataFromUserText(parsed.summary || "Need a bit more detail."),
      rationale: scrubPearlMetadataFromUserText(parsed.rationale || ""),
      title: soft(parsed.title || observation.name || "", 80) || null,
      systemPrompt: observation.systemPrompt || "",
      mode: null,
    };
  }
  const modelLayers = {
    moves: Array.isArray(parsed.moves)
      ? parsed.moves.map((move, index) => ({
        id: `move:model:${index + 1}`,
        name: soft(move?.name || `Move ${index + 1}`, 80),
        description: soft(move?.description || "", 400),
        kind: "move",
      })).filter((entry) => entry.name)
      : null,
    weights: Array.isArray(parsed.weights) ? parsed.weights : null,
    lenses: Array.isArray(parsed.lenses)
      ? parsed.lenses.map((lens, index) => ({
        id: `lens:model:${index + 1}`,
        name: soft(lens?.name || `Lens ${index + 1}`, 64),
        description: soft(lens?.description || "", 400),
        kind: "lens",
        strength: Number.isFinite(lens?.strength) ? lens.strength : 0.75,
      })).filter((entry) => entry.name)
      : null,
  };
  const fallbackLayers = local.layers || seedPearlLayersFromIntent({
    name: soft(parsed.title || interpretation.titleHint || observation.name || "", 80),
    intent: interpretation.utterance || "",
    systemPrompt,
  });
  const layers = {
    ...fallbackLayers,
    moves: modelLayers.moves?.length ? modelLayers.moves : fallbackLayers.moves,
    weights: modelLayers.weights?.length
      ? modelLayers.weights
      : fallbackLayers.weights,
    lenses: modelLayers.lenses?.length ? modelLayers.lenses : fallbackLayers.lenses,
  };
  const projected = projectSystemPromptFromLayers(layers, {
    name: soft(parsed.title || interpretation.titleHint || observation.name || "", 80),
    intent: interpretation.utterance || "",
    basePrompt: systemPrompt,
    voice: layers.voice,
  });
  return {
    ok: true,
    source: "model",
    intent,
    title: soft(parsed.title || interpretation.titleHint || observation.name || "", 80) || null,
    systemPrompt: projected,
    layers,
    prior: observation.systemPrompt || "",
    summary: scrubPearlMetadataFromUserText(
      parsed.summary || "Updated Moves · Weights · Lenses.",
      { utterance: interpretation.utterance },
    ),
    rationale: scrubPearlMetadataFromUserText(parsed.rationale || "", {
      utterance: interpretation.utterance,
    }),
    mode: intent === "create_pearl" ? "seed" : (interpretation.mode || "rewrite"),
    needsRicherRewrite: false,
  };
}

/**
 * Apply: map a proposal to domain-command args (caller executes).
 */
export function applyPearlPromptProposal(proposal, options = {}) {
  if (!proposal?.ok) {
    return {
      ok: false,
      code: proposal?.code || EXECUTION_CODES.VALIDATION_ERROR,
      message: proposal?.summary || "Prompt change blocked.",
      command: null,
    };
  }
  if (proposal.intent === "create_pearl") {
    const layers = proposal.layers || seedPearlLayersFromIntent({
      name: proposal.title || "New pearl",
      intent: options.utterance || proposal.summary || "",
      systemPrompt: proposal.systemPrompt,
    });
    return {
      ok: true,
      command: {
        verb: "createSemanticOrb",
        args: {
          ...(options.sceneId ? { sceneId: options.sceneId } : {}),
          name: proposal.title || "New pearl",
          systemPrompt: layers.systemPrompt || proposal.systemPrompt,
          intent: options.utterance || proposal.summary || "",
          activate: options.activate !== false,
          orb: {
            name: proposal.title || "New pearl",
            systemPrompt: layers.systemPrompt || proposal.systemPrompt,
            moves: layers.moves,
            functions: layers.functions,
            weights: layers.weights,
            lenses: layers.lenses,
            organization: layers.organization,
          },
        },
      },
    };
  }
  if (
    proposal.intent === "edit_prompt"
    || proposal.intent === "replace_prompt"
    || proposal.intent === "edit_layers"
  ) {
    const pearlId = options.pearlId || options.observation?.pearlId;
    if (!pearlId && !options.name) {
      return {
        ok: false,
        code: EXECUTION_CODES.MISSING_ARGS,
        message: "Choose a pearl to edit its system prompt.",
        command: null,
      };
    }
    return {
      ok: true,
      command: {
        verb: "setPearlSystemPrompt",
        args: {
          id: pearlId || undefined,
          name: options.name || options.observation?.name || undefined,
          systemPrompt: proposal.systemPrompt,
          mode: "replace",
          sceneId: options.sceneId,
        },
      },
    };
  }
  return {
    ok: false,
    code: EXECUTION_CODES.UNKNOWN_INTENT,
    message: proposal.summary || "Nothing to apply.",
    command: null,
  };
}

/**
 * Reveal: Cursor-like trail for Companion chat (no metadata).
 */
export function formatPearlPromptTrail(steps = []) {
  const labels = {
    working: "Working…",
    interpreting: "Interpreting…",
    proposed: "Proposed layer changes",
    applied: "Applied",
    blocked: "Blocked",
  };
  return (Array.isArray(steps) ? steps : [])
    .map((step) => {
      const stage = String(step.stage || "").toLowerCase();
      const head = labels[stage] || stage || "Working…";
      const detail = scrubPearlMetadataFromUserText(step.detail || step.summary || "", {
        utterance: step.utterance,
      });
      if (stage === "proposed" && detail) return `${head}: ${detail}`;
      if (stage === "blocked") {
        const code = step.code ? ` [${step.code}]` : "";
        return detail ? `${head}${code}: ${detail}` : `${head}${code}`;
      }
      if (stage === "applied" && detail) return `${head}: ${detail}`;
      if (stage === "interpreting" && detail) return `${head} ${detail}`;
      return head;
    })
    .filter(Boolean);
}

export function buildPearlPromptRevealMessage(proposal, applyResult, trail = []) {
  const lines = formatPearlPromptTrail(trail);
  const hasApplied = lines.some((line) => /^Applied\b/i.test(line));
  const hasBlocked = lines.some((line) => /^Blocked\b/i.test(line));
  if (applyResult?.ok && proposal?.ok) {
    if (!hasApplied) {
      const summary = scrubPearlMetadataFromUserText(
        applyResult.message || proposal.summary || "Updated the system prompt.",
      );
      const richer = proposal.needsRicherRewrite
        ? " (Local merge — richer rewrite when AI is connected.)"
        : "";
      lines.push(`Applied: ${summary}${richer}`);
    } else if (proposal.needsRicherRewrite) {
      const last = lines.length - 1;
      if (last >= 0 && !/richer rewrite/i.test(lines[last])) {
        lines[last] = `${lines[last]} (Local merge — richer rewrite when AI is connected.)`;
      }
    }
    return {
      visibleText: lines.join("\n"),
      trail: lines,
      code: EXECUTION_CODES.OK,
      status: "success",
    };
  }
  const code = applyResult?.code || proposal?.code || EXECUTION_CODES.UNKNOWN_ERROR;
  const detail = scrubPearlMetadataFromUserText(
    applyResult?.message || proposal?.summary || "Blocked.",
  );
  if (!hasBlocked) lines.push(`Blocked [${code}]: ${detail}`);
  return {
    visibleText: lines.join("\n"),
    trail: lines,
    code,
    status: "blocked",
  };
}

/**
 * Full pipeline helper (sync offline path). Async LLM propose is injected by caller.
 */
export function runPearlPromptHarnessOffline({
  utterance,
  pearl = null,
  appState = {},
  fastPathHint = null,
  sceneId = null,
  pearls = null,
} = {}) {
  const observation = observePearlPromptContext(pearl, appState);
  const interpretation = interpretPearlPromptUtterance(utterance, {
    hasActivePearl: Boolean(pearl || observation.pearlId),
    pearl,
    fastPathHint,
  });
  const trail = [
    { stage: "working" },
    {
      stage: "interpreting",
      detail: interpretation.intent !== "other"
        ? `(${interpretation.intent.replace(/_/g, " ")})`
        : "",
    },
  ];

  // Compare + produce_output: Observe → Interpret → Propose compare → Apply download/chat.
  // Never touches systemPrompt.
  if (
    interpretation.intent === "compare_pearls"
    || interpretation.intent === "produce_output"
    || interpretation.compare
    || interpretation.verb === "comparePearls"
  ) {
    const catalog = Array.isArray(pearls) && pearls.length
      ? pearls
      : [pearl].filter(Boolean);
    const compareProposal = proposePearlCompare(utterance, catalog, {
      activePearl: pearl,
      appState,
      produceOutput: interpretation.produceOutput || interpretation.intent === "produce_output",
    });
    trail.push({
      stage: "proposed",
      detail: compareProposal.summary,
      summary: compareProposal.summary,
    });
    if (!compareProposal.ok) {
      const reveal = buildPearlPromptRevealMessage(
        { ...compareProposal, ok: false },
        { ok: false, code: compareProposal.code, message: compareProposal.summary },
        trail,
      );
      return {
        observation,
        interpretation,
        proposal: compareProposal,
        apply: {
          ok: false,
          code: compareProposal.code,
          message: compareProposal.summary,
          command: null,
        },
        trail,
        reveal,
        handled: true,
        passThrough: false,
        mutatesSystemPrompt: false,
      };
    }
    return {
      observation,
      interpretation,
      proposal: compareProposal,
      apply: {
        ok: true,
        command: {
          verb: "comparePearls",
          args: {
            utterance,
            leftId: compareProposal.leftId,
            rightId: compareProposal.rightId,
            leftName: compareProposal.leftName,
            rightName: compareProposal.rightName,
            produceOutput: compareProposal.produceOutput,
            sceneId,
          },
        },
      },
      trail,
      handled: true,
      passThrough: false,
      mutatesSystemPrompt: false,
    };
  }

  if (
    interpretation.intent === "other"
    || interpretation.intent === "ask"
    || interpretation.verb === "getPearlSystemPrompt"
  ) {
    return {
      observation,
      interpretation,
      proposal: null,
      apply: null,
      trail,
      handled: interpretation.verb === "getPearlSystemPrompt",
      passThrough: (interpretation.intent === "other" || interpretation.intent === "ask")
        && !interpretation.verb,
    };
  }
  const proposal = proposePearlPromptLocal(interpretation, observation);
  if (proposal?.passToCompare) {
    trail.push({
      stage: "proposed",
      detail: proposal.summary,
      summary: proposal.summary,
    });
    return {
      observation,
      interpretation: { ...interpretation, intent: "compare_pearls", verb: "comparePearls" },
      proposal,
      apply: {
        ok: true,
        command: {
          verb: "comparePearls",
          args: { utterance, sceneId },
        },
      },
      trail,
      handled: true,
      passThrough: false,
      mutatesSystemPrompt: false,
    };
  }
  trail.push({
    stage: "proposed",
    detail: proposal.summary,
    summary: proposal.summary,
  });
  if (!proposal.ok) {
    const reveal = buildPearlPromptRevealMessage(proposal, { ok: false, code: proposal.code, message: proposal.summary }, trail);
    return {
      observation,
      interpretation,
      proposal,
      apply: null,
      trail,
      reveal,
      handled: true,
      passThrough: false,
    };
  }
  const apply = applyPearlPromptProposal(proposal, {
    pearlId: observation.pearlId,
    name: observation.name,
    sceneId,
    utterance,
    observation,
  });
  return {
    observation,
    interpretation,
    proposal,
    apply,
    trail,
    handled: true,
    passThrough: false,
  };
}

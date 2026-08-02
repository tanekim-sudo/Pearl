/**
 * Pearl prompt harness — thin Observe → Interpret → Propose → Apply → Reveal
 * pipeline for systemPrompt (the pearl's brain).
 *
 * Composes existing pieces; does not reinvent Companion planning or metadata harness:
 *   Observe  → pearl-companion-context
 *   Propose  → pearl-system-prompt (offline) + optional /api/run JSON rewrite
 *   Apply    → domain commands setPearlSystemPrompt / createSemanticOrb
 *   Reveal   → Cursor-like trail labels (pairs with companion-harness status)
 *
 * Parsers in companion-intent remain optional fast-path hints.
 */

import {
  buildPearlCompanionContext,
  formatPearlCompanionContextForModel,
  scrubPearlMetadataFromUserText,
} from "./pearl-companion-context.js";
import {
  defaultSystemPromptFromIntent,
  editPearlSystemPrompt,
  normalizePearlSystemPrompt,
  readPearlSystemPrompt,
} from "./pearl-system-prompt.js";
import { EXECUTION_CODES } from "./execution-result.js";

export const PEARL_PROMPT_HARNESS_VERSION = 1;

/** Structured intents the harness understands. */
export const PEARL_PROMPT_INTENTS = Object.freeze([
  "create_pearl",
  "edit_prompt",
  "replace_prompt",
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

/** JSON schema for intelligent prompt rewrite via /api/run. */
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
  return {
    version: PEARL_PROMPT_HARNESS_VERSION,
    stage: "working",
    pearlId: companionContext?.pearlId || null,
    name: companionContext?.name || null,
    systemPrompt: companionContext?.systemPrompt || (pearl ? readPearlSystemPrompt(pearl) : ""),
    companionContext,
    modelContext: companionContext
      ? formatPearlCompanionContextForModel(companionContext, { promptLimit: 2_400 })
      : "No active pearl.",
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

  if (fastPath?.verb === "getPearlSystemPrompt") {
    return {
      intent: "other",
      confidence: 1,
      reason: "read-prompt",
      utterance: text,
      hint: null,
      titleHint: "",
      mode: null,
      verb: "getPearlSystemPrompt",
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
    && !/\b(?:rename|delete|remove|wear|merge|open|activate)\b/i.test(text)
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

  // Soft edit / adapt — natural language refinements when a pearl is in focus
  const editSignals = (
    /\b(?:more like|less like|inspired by|in the style of|append|include|prefer|always|never|observe)\b/i.test(text)
    || /\badd\b/i.test(text)
    || /\bskeptic/i.test(text)
    || /\b(?:make (?:it|this|the prompt)|update (?:the |this )?prompt|change (?:the |this )?prompt|tweak|refine|adapt|adjust)\b/i.test(text)
    || (hasActivePearl && /\b(?:prompt|instructions|taste|voice|tone|style)\b/i.test(text)
      && /\b(?:add|make|change|update|rewrite|more|less|like|about)\b/i.test(text))
  );
  if (editSignals && (hasActivePearl || /\b(?:this|that|the)\s+(?:active\s+|current\s+)?(?:pearl|prompt)\b/i.test(text))) {
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
    && !/^(?:what|why|how|who|where|when|show|list|open|wear|merge|delete|rename|navigate|go\b)/i.test(text)
    && !/\b(?:function|move|lens|gauntlet|encode|install|extension|download)\b/i.test(text)
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
    const systemPrompt = defaultSystemPromptFromIntent({
      name: name || utterance.slice(0, 80),
      intent: utterance,
      materialText: utterance,
      topic: name || utterance.slice(0, 80),
      systemPromptHint: interpretation?.hint || utterance,
    });
    const title = name || titleFromUtterance(utterance) || "New pearl";
    return {
      ok: true,
      source: "local",
      intent,
      title,
      systemPrompt,
      summary: `Seed system prompt for “${title}” from your request.`,
      rationale: "Offline seed from intent (richer rewrite when AI is connected).",
      mode: "seed",
      needsRicherRewrite: true,
    };
  }

  if (intent === "replace_prompt" || intent === "edit_prompt") {
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
      const edited = editPearlSystemPrompt(prior, { mode: "append", text: nextText });
      return {
        ok: edited.ok,
        source: "local",
        intent: "edit_prompt",
        title: observation.name || name || null,
        systemPrompt: edited.systemPrompt,
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
    // Intelligent-looking local rewrite: merge instruction into a full prompt body.
    nextText = mergeInstructionIntoPrompt(prior, utterance, {
      name: observation.name || name,
    });
    return {
      ok: true,
      source: "local",
      intent: "edit_prompt",
      title: observation.name || name || null,
      systemPrompt: nextText,
      prior,
      summary: `Updated system prompt${observation.name ? ` for “${observation.name}”` : ""} from your instruction.`,
      rationale: "Offline merge rewrite. Connect AI for a deeper taste-preserving rewrite.",
      mode: "rewrite",
      needsRicherRewrite: true,
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
  const base = normalizePearlSystemPrompt(prior);
  const note = soft(instruction, 2_000);
  const name = soft(options.name || "", 120);
  if (!note) return base;
  if (!base) {
    return defaultSystemPromptFromIntent({
      name,
      intent: note,
      systemPromptHint: note,
      topic: name || note.slice(0, 80),
    });
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
    .filter((line) => !/^user refinement:/i.test(line));
  const lines = [
    ...(header && !preserved.some((line) => /you are the pearl/i.test(line)) ? [header] : []),
    ...preserved,
    "",
    `User refinement: ${note}`,
    "Honor the refinement while preserving prior taste, voice, and constraints unless the user clearly overrides them.",
  ];
  return normalizePearlSystemPrompt(lines.filter((line, index, all) => {
    if (line === "" && all[index - 1] === "") return false;
    return true;
  }).join("\n"));
}

/**
 * Build the model system + user prompts for intelligent rewrite.
 */
export function buildPearlPromptRewriteRequest(observation, interpretation) {
  const system = [
    "You rewrite Pearl system prompts with full intelligence.",
    "Preserve the user's taste and prior constraints; merge edits rather than discarding history unless they ask to replace everything.",
    "Never expose internal ids, hashes, storage keys, revisions, or raw metadata in title/summary/rationale/systemPrompt.",
    "Return only structured JSON matching the schema.",
    "systemPrompt must be a complete, usable prompt (not a diff patch).",
    "summary: one short human sentence of what changed (for Companion chat).",
    "rationale: one short internal why (also user-safe).",
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
    "Produce the next systemPrompt.",
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
  return {
    ok: true,
    source: "model",
    intent,
    title: soft(parsed.title || interpretation.titleHint || observation.name || "", 80) || null,
    systemPrompt,
    prior: observation.systemPrompt || "",
    summary: scrubPearlMetadataFromUserText(
      parsed.summary || "Updated the system prompt.",
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
    return {
      ok: true,
      command: {
        verb: "createSemanticOrb",
        args: {
          ...(options.sceneId ? { sceneId: options.sceneId } : {}),
          name: proposal.title || "New pearl",
          systemPrompt: proposal.systemPrompt,
          intent: options.utterance || proposal.summary || "",
          activate: options.activate !== false,
        },
      },
    };
  }
  if (proposal.intent === "edit_prompt" || proposal.intent === "replace_prompt") {
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
    proposed: "Proposed change",
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
  if (interpretation.intent === "other" || interpretation.verb === "getPearlSystemPrompt") {
    return {
      observation,
      interpretation,
      proposal: null,
      apply: null,
      trail,
      handled: interpretation.verb === "getPearlSystemPrompt",
      passThrough: interpretation.intent === "other" && !interpretation.verb,
    };
  }
  const proposal = proposePearlPromptLocal(interpretation, observation);
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

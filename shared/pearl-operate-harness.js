/**
 * Pearl operate harness — Cursor-for-pearls *operation* path.
 *
 * Separates two universes that must never mix:
 *   mutate_brain  → create / edit Moves·Weights·Lenses (pearl-prompt-harness)
 *   operate       → compare / produce_output / summarize / ask-about pearls
 *
 * Operate requests load full pearl companion context and execute tools.
 * They NEVER append user task text into systemPrompt.
 *
 * Loop: Observe → Classify → Propose tool → Apply → Reveal
 */

import { EXECUTION_CODES } from "./execution-result.js";
import {
  looksLikePearlCompareRequest,
  looksLikePearlExecutionRequest,
  looksLikeProduceOutputRequest,
  proposePearlCompare,
  extractComparePearlHints,
} from "./pearl-compare.js";
import { buildPearlLayerPack } from "./pearl-layer-instructions.js";
import { buildPearlCompanionContext } from "./pearl-companion-context.js";
import { scrubPearlMetadataFromUserText } from "./pearl-companion-context.js";
import { readPearlSystemPrompt } from "./pearl-system-prompt.js";
import {
  buildCompanionAppSnapshot,
  buildCompanionGrounding,
} from "./companion-pearl-job.js";

export const PEARL_OPERATE_HARNESS_VERSION = 1;

/** Top-level companion intent classes for pearl work. */
export const PEARL_COMPANION_CLASSES = Object.freeze([
  "mutate_brain", // create / edit layers / edit prompt projection
  "operate", // compare, export, summarize, evaluate, ask-about
  "other",
]);

export const PEARL_OPERATE_INTENTS = Object.freeze([
  "compare_pearls",
  "produce_output",
  "summarize_layers",
  "ask_about_pearl",
  "clarify",
]);

const compact = (value) => String(value || "").replace(/\s+/g, " ").trim();
const soft = (value, limit = 2_000) => String(value ?? "").trim().slice(0, limit);

/**
 * Load-bearing gate: mutate brain vs operate on pearls.
 * Operate wins over soft prompt-edit heuristics (investor/style words, etc.).
 */
export function classifyPearlCompanionClass(utterance = "", options = {}) {
  const text = compact(utterance);
  if (!text) return { class: "other", intent: "clarify", confidence: 1, reason: "empty" };

  // OPERATE first — never fall through to mutate.
  if (looksLikePearlCompareRequest(text) || looksLikePearlExecutionRequest(text)) {
    const produce = looksLikeProduceOutputRequest(text);
    return {
      class: "operate",
      intent: produce ? "produce_output" : "compare_pearls",
      confidence: 0.98,
      reason: produce ? "compare+produce" : "compare",
      produceOutput: produce,
    };
  }

  if (
    /\b(?:summarize|summary|show|list|what are)\b/i.test(text)
    && /\b(?:moves?|weights?|lenses|layers)\b/i.test(text)
    && !/\b(?:add|change|edit|update|rewrite|make|create)\b/i.test(text)
  ) {
    return {
      class: "operate",
      intent: "summarize_layers",
      confidence: 0.9,
      reason: "summarize-layers",
    };
  }

  if (
    /^(?:what|why|how|explain|tell\s+me|show)\b/i.test(text)
    && /\bpearl\b/i.test(text)
    && !/\b(?:make|create|add|change|edit|rewrite|more like)\b/i.test(text)
  ) {
    return {
      class: "operate",
      intent: "ask_about_pearl",
      confidence: 0.75,
      reason: "ask-about-pearl",
    };
  }

  // MUTATE — create / taste edit / layer edit
  if (
    /^(?:make|create|save|build|spin\s*up|forge)\b/i.test(text)
    && /\bpearl\b/i.test(text)
    && !/^(?:make|turn)\s+(?:this|that|the)\s+/i.test(text)
  ) {
    return {
      class: "mutate_brain",
      intent: "create_pearl",
      confidence: 0.9,
      reason: "create",
    };
  }

  if (
    /\b(?:rewrite|replace|set|overwrite)\b.{0,40}\b(?:system\s+)?prompt\b/i.test(text)
    || /^(?:make|turn)\s+(?:this|that|the)\s+(?:active\s+|current\s+)?pearl\s+about\b/i.test(text)
    || /\b(?:more like|less like|add that|append|add skepticism)\b/i.test(text)
    || (options.hasActivePearl && /\b(?:tweak|refine|adapt|adjust)\b.{0,40}\b(?:prompt|pearl|taste|voice|style)\b/i.test(text))
  ) {
    return {
      class: "mutate_brain",
      intent: "edit_prompt",
      confidence: 0.85,
      reason: "edit-brain",
    };
  }

  if (
    options.hasActivePearl
    && /\b(?:move|moves|weight|weights|lens|lenses)\b/i.test(text)
    && /\b(?:add|reorder|remove|change|update|edit|prefer|care|weight)\b/i.test(text)
  ) {
    return {
      class: "mutate_brain",
      intent: "edit_layers",
      confidence: 0.85,
      reason: "edit-layers",
    };
  }

  return { class: "other", intent: "other", confidence: 0.2, reason: "no-pearl-signal" };
}

/**
 * Observe: catalog of pearls available for operate tools.
 */
export function observeOperateContext(pearls = [], options = {}) {
  const list = (Array.isArray(pearls) ? pearls : []).filter(Boolean);
  const appState = options.appState || {};
  const appSnapshot = appState.appSnapshot
    || options.appSnapshot
    || buildCompanionAppSnapshot({
      ...appState,
      pearls: list,
      reefPearlNames: list.map((pearl) => pearl.name || pearl.identity?.name).filter(Boolean),
      activePearl: options.activePearl || null,
      openPearl: options.activePearl
        ? { name: options.activePearl.name, id: options.activePearl.id }
        : null,
    });
  const grounding = buildCompanionGrounding({
    pearl: options.activePearl || list[0] || null,
    appState: { ...appState, appSnapshot },
    appSnapshot,
  });
  return {
    version: PEARL_OPERATE_HARNESS_VERSION,
    stage: "working",
    count: list.length,
    pearls: list.map((pearl) => {
      const pack = buildPearlLayerPack(pearl) || {};
      const ctx = buildPearlCompanionContext(pearl, appState);
      return {
        id: pearl.id,
        name: pearl.name || pearl.identity?.name || "Pearl",
        moves: pack.moves?.length || 0,
        weights: pack.weights?.length || 0,
        lenses: pack.lenses?.length || 0,
        systemPrompt: soft(readPearlSystemPrompt(pearl), 400),
        summary: ctx?.summary || "",
      };
    }),
    activePearlId: options.activePearl?.id || null,
    grounding,
    appSnapshot,
  };
}

/**
 * Propose an operate tool action (never mutates systemPrompt).
 */
export function proposePearlOperate(utterance, pearls = [], options = {}) {
  const classification = classifyPearlCompanionClass(utterance, {
    hasActivePearl: Boolean(options.activePearl || options.hasActivePearl),
  });
  if (classification.class !== "operate") {
    return {
      ok: false,
      code: EXECUTION_CODES.UNKNOWN_INTENT,
      summary: "Not an operate request.",
      classification,
      mutatesSystemPrompt: false,
      passThrough: true,
    };
  }

  if (
    classification.intent === "compare_pearls"
    || classification.intent === "produce_output"
  ) {
    const compare = proposePearlCompare(utterance, pearls, {
      activePearl: options.activePearl,
      appState: options.appState,
      produceOutput: classification.produceOutput || classification.intent === "produce_output",
      forceCompare: options.forceCompare,
    });
    return {
      ...compare,
      classification,
      mutatesSystemPrompt: false,
    };
  }

  if (classification.intent === "summarize_layers") {
    const pearl = options.activePearl
      || pearls[0]
      || null;
    if (!pearl) {
      return {
        ok: false,
        code: EXECUTION_CODES.MISSING_ARGS,
        summary: "Wear or open a pearl first, then ask me to summarize its layers.",
        classification,
        mutatesSystemPrompt: false,
      };
    }
    const pack = buildPearlLayerPack(pearl) || {};
    const lines = [
      `“${pearl.name || "Pearl"}” layers:`,
      `Moves (${pack.moves?.length || 0}): ${(pack.moves || []).map((m) => m.name).filter(Boolean).join(" · ") || "—"}`,
      `Weights (${pack.weights?.length || 0}): ${(pack.weights || []).map((w) => w.name).filter(Boolean).join(" · ") || "—"}`,
      `Lenses (${pack.lenses?.length || 0}): ${(pack.lenses || []).map((l) => l.name).filter(Boolean).join(" · ") || "—"}`,
    ];
    return {
      ok: true,
      intent: "summarize_layers",
      classification,
      chatSummary: lines.join("\n"),
      summary: lines[0],
      mutatesSystemPrompt: false,
      command: null, // pure reveal
    };
  }

  if (classification.intent === "ask_about_pearl") {
    const pearl = options.activePearl || pearls[0] || null;
    if (!pearl) {
      return {
        ok: false,
        code: EXECUTION_CODES.MISSING_ARGS,
        summary: "Wear or name a pearl first.",
        classification,
        mutatesSystemPrompt: false,
      };
    }
    const pack = buildPearlLayerPack(pearl) || {};
    return {
      ok: true,
      intent: "ask_about_pearl",
      classification,
      chatSummary: [
        `“${pearl.name}” — ${(pack.moves || []).length} Moves · ${(pack.weights || []).length} Weights · ${(pack.lenses || []).length} Lenses.`,
        soft(readPearlSystemPrompt(pearl), 500) || "(empty system prompt projection)",
      ].join("\n"),
      summary: `Described “${pearl.name}”.`,
      mutatesSystemPrompt: false,
      command: null,
    };
  }

  return {
    ok: false,
    code: EXECUTION_CODES.UNKNOWN_INTENT,
    summary: "I could not map that operate request yet.",
    classification,
    mutatesSystemPrompt: false,
  };
}

/**
 * Map operate proposal → director verb (or chat-only reveal).
 */
export function applyPearlOperateProposal(proposal, options = {}) {
  if (!proposal?.ok) {
    return {
      ok: false,
      code: proposal?.code || EXECUTION_CODES.VALIDATION_ERROR,
      message: proposal?.summary || "Operate blocked.",
      command: null,
      mutatesSystemPrompt: false,
    };
  }
  if (
    proposal.intent === "compare_pearls"
    || proposal.intent === "compare_pearls+produce_output"
    || proposal.classification?.intent === "compare_pearls"
    || proposal.classification?.intent === "produce_output"
    || proposal.produceOutput
  ) {
    const hints = extractComparePearlHints(options.utterance || "");
    return {
      ok: true,
      command: {
        verb: "comparePearls",
        args: {
          utterance: options.utterance || "",
          leftId: proposal.leftId,
          rightId: proposal.rightId,
          leftName: proposal.leftName || hints.left || undefined,
          rightName: proposal.rightName || hints.right || undefined,
          produceOutput: Boolean(proposal.produceOutput),
          sceneId: options.sceneId,
        },
      },
      mutatesSystemPrompt: false,
    };
  }
  // Chat-only operate (summarize / ask)
  return {
    ok: true,
    command: null,
    visibleText: scrubPearlMetadataFromUserText(proposal.chatSummary || proposal.summary || ""),
    mutatesSystemPrompt: false,
  };
}

/**
 * Full offline operate pipeline.
 */
export function runPearlOperateHarnessOffline({
  utterance,
  pearls = [],
  activePearl = null,
  appState = {},
  sceneId = null,
} = {}) {
  const classification = classifyPearlCompanionClass(utterance, {
    hasActivePearl: Boolean(activePearl),
  });
  const observation = observeOperateContext(pearls, { activePearl, appState });
  const trail = [
    { stage: "working" },
    {
      stage: "interpreting",
      detail: classification.class !== "other"
        ? `(${classification.intent.replace(/_/g, " ")})`
        : "",
    },
  ];

  if (classification.class !== "operate") {
    return {
      observation,
      classification,
      proposal: null,
      apply: null,
      trail,
      handled: false,
      passThrough: true,
      mutatesSystemPrompt: false,
    };
  }

  const proposal = proposePearlOperate(utterance, pearls, {
    activePearl,
    appState,
  });
  trail.push({
    stage: "proposed",
    detail: proposal.summary,
    summary: proposal.summary,
  });

  if (!proposal.ok) {
    return {
      observation,
      classification,
      proposal,
      apply: {
        ok: false,
        code: proposal.code,
        message: proposal.summary,
        command: null,
      },
      trail,
      handled: true,
      passThrough: false,
      mutatesSystemPrompt: false,
      reveal: {
        visibleText: `Blocked [${proposal.code || "blocked"}]: ${proposal.summary}`,
        status: "blocked",
        code: proposal.code,
      },
    };
  }

  const apply = applyPearlOperateProposal(proposal, { utterance, sceneId });
  return {
    observation,
    classification,
    proposal,
    apply,
    trail,
    handled: true,
    passThrough: false,
    mutatesSystemPrompt: false,
    reveal: apply.command
      ? null
      : {
        visibleText: apply.visibleText || proposal.chatSummary || proposal.summary,
        status: "success",
        code: EXECUTION_CODES.OK,
      },
  };
}

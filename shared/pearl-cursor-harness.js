/**
 * Cursor-for-pearls turn harness — one coherent loop:
 *   Observe (app world + pearl(s)) → Classify (operate vs mutate) → Propose tools → Apply → Reveal
 *
 * Composes companion-pearl-job grounding, operate harness, prompt harness.
 */

import {
  buildCompanionGrounding,
  formatCompanionGroundingForModel,
  formatCompanionPearlJobForModel,
  buildPearlAppSnapshot,
  COMPANION_PEARL_JOB_VERSION,
  toolClassFromPearlClassification as toolClassFromJobPack,
} from "./companion-pearl-job.js";
import {
  classifyPearlCompanionClass,
  runPearlOperateHarnessOffline,
} from "./pearl-operate-harness.js";
import {
  interpretPearlPromptUtterance,
  runPearlPromptHarnessOffline,
  observePearlPromptContext,
} from "./pearl-prompt-harness.js";
import { EXECUTION_CODES } from "./execution-result.js";

export const PEARL_CURSOR_HARNESS_VERSION = 1;

function toolClassFromPearlClassification(classification = {}) {
  const fromPack = toolClassFromJobPack(classification);
  if (fromPack === "operate" || fromPack === "mutate_brain") return fromPack;
  const cls = String(classification.class || classification.intent || "").toLowerCase();
  if (cls === "mutate_brain" || /create_pearl|edit_/.test(cls)) return "mutate_brain";
  if (cls === "operate" || /compare|produce|summarize|ask_about/.test(cls)) return "operate";
  return "other";
}

/**
 * Observe everything Companion needs for a Cursor-like turn.
 */
export function observePearlCursorContext({
  utterance = "",
  pearls = [],
  activePearl = null,
  appSnapshotOptions = {},
  appState = {},
} = {}) {
  const snapshot = buildPearlAppSnapshot({
    activePearl,
    reefPearls: pearls,
    gauntletPearls: appSnapshotOptions.gauntletPearls || [],
    screen: appSnapshotOptions.screen || "reef",
    studioOpen: appSnapshotOptions.studioOpen,
    sceneName: appSnapshotOptions.sceneName,
    primaryPearlId: appSnapshotOptions.primaryPearlId,
    path: appSnapshotOptions.path,
  });
  const pearlObservation = observePearlPromptContext(activePearl, {
    ...appState,
    appSnapshot: snapshot,
  });
  const grounding = buildCompanionGrounding({
    pearl: activePearl,
    pearlContext: pearlObservation.companionContext,
    appSnapshot: snapshot,
    appState: { ...appState, appSnapshot: snapshot },
  });
  return {
    version: PEARL_CURSOR_HARNESS_VERSION,
    jobVersion: COMPANION_PEARL_JOB_VERSION,
    stage: "working",
    utterance: String(utterance || "").trim(),
    snapshot,
    grounding,
    pearlObservation,
    modelContext: formatCompanionGroundingForModel(grounding, {
      includePearlContext: Boolean(activePearl),
      promptLimit: 2_400,
    }),
  };
}

/**
 * Offline Cursor-for-pearls turn (no LLM required for route/apply mapping).
 */
export function runPearlCursorHarnessOffline({
  utterance,
  pearls = [],
  activePearl = null,
  appSnapshotOptions = {},
  appState = {},
  sceneId = null,
  fastPathHint = null,
} = {}) {
  const observation = observePearlCursorContext({
    utterance,
    pearls,
    activePearl,
    appSnapshotOptions,
    appState,
  });
  const classification = classifyPearlCompanionClass(utterance, {
    hasActivePearl: Boolean(activePearl),
  });
  const toolClass = toolClassFromPearlClassification(classification);
  const trail = [
    { stage: "working", detail: "Observing Pearl app world…" },
    {
      stage: "interpreting",
      detail: `(${toolClass}${classification.intent ? ` · ${classification.intent.replace(/_/g, " ")}` : ""})`,
    },
  ];
  const enrichedState = { ...appState, appSnapshot: observation.snapshot };

  if (classification.class === "operate") {
    const operate = runPearlOperateHarnessOffline({
      utterance,
      pearls,
      activePearl,
      appState: enrichedState,
      sceneId,
    });
    return {
      ...operate,
      observation,
      classification,
      toolClass,
      trail: [
        ...trail,
        ...(operate.trail || []).filter((step) => step.stage !== "working" && step.stage !== "interpreting"),
      ],
      modelContext: observation.modelContext,
      cursorForPearls: true,
    };
  }

  if (classification.class === "mutate_brain") {
    const mutate = runPearlPromptHarnessOffline({
      utterance,
      pearl: activePearl,
      pearls,
      appState: enrichedState,
      sceneId,
      fastPathHint,
    });
    return {
      ...mutate,
      observation,
      classification,
      toolClass,
      trail: [
        ...trail,
        ...(mutate.trail || []).filter((step) => step.stage !== "working" && step.stage !== "interpreting"),
      ],
      modelContext: observation.modelContext,
      cursorForPearls: true,
    };
  }

  const soft = interpretPearlPromptUtterance(utterance, {
    hasActivePearl: Boolean(activePearl),
    pearl: activePearl,
    fastPathHint,
  });
  if (
    soft.intent === "create_pearl"
    || soft.intent === "edit_prompt"
    || soft.intent === "replace_prompt"
    || soft.intent === "edit_layers"
  ) {
    const mutate = runPearlPromptHarnessOffline({
      utterance,
      pearl: activePearl,
      pearls,
      appState: enrichedState,
      sceneId,
      fastPathHint,
    });
    return {
      ...mutate,
      observation,
      classification: {
        class: "mutate_brain",
        intent: soft.intent,
        confidence: soft.confidence,
        reason: "soft-interpret",
      },
      toolClass: "mutate_brain",
      trail: [
        ...trail,
        ...(mutate.trail || []).filter((step) => step.stage !== "working" && step.stage !== "interpreting"),
      ],
      modelContext: observation.modelContext,
      cursorForPearls: true,
    };
  }

  return {
    observation,
    classification,
    toolClass,
    proposal: null,
    apply: null,
    trail,
    handled: false,
    passThrough: true,
    mutatesSystemPrompt: false,
    modelContext: observation.modelContext,
    cursorForPearls: true,
    code: EXECUTION_CODES.UNKNOWN_INTENT,
  };
}

/**
 * System prompt prefix for planner / Claude turns.
 */
export function buildCursorForPearlsSystemPrefix(options = {}) {
  const grounding = buildCompanionGrounding({
    appSnapshot: options.snapshot || null,
    pearl: options.pearl || null,
    appState: options.appState || {},
  });
  return formatCompanionGroundingForModel(grounding, {
    includePearlContext: Boolean(options.pearl),
    ...options,
  });
}

export { formatCompanionPearlJobForModel };
export { toolClassFromPearlClassification };

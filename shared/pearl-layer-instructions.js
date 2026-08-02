/**
 * Companion instructions for Pearl's three load-bearing layers:
 * Moves · Weights · Lenses.
 *
 * systemPrompt is a readable projection; canonical fidelity is these layers.
 * Under the hood, ordered Moves may still live as function-of-moves storage —
 * Companion and users see them as the Moves layer (not a separate "Functions" brain).
 */

import { PEARL_STUDIO_COGNITIVE_SECTION_ORDER } from "./pearl-studio.js";
import {
  normalizePearlWeights,
  readPearlWeights,
  seedWeightsFromIntent,
  summarizeWeightsForPrompt,
} from "./pearl-weights.js";
import { defaultSystemPromptFromIntent, normalizePearlSystemPrompt } from "./pearl-system-prompt.js";

export const PEARL_LAYER_INSTRUCTIONS_VERSION = 1;

/** Canonical user/Companion order — Moves → Weights → Lenses. */
export const PEARL_LAYER_ORDER = PEARL_STUDIO_COGNITIVE_SECTION_ORDER;

export const PEARL_LAYER_DEFINITIONS = Object.freeze({
  moves: {
    id: "moves",
    label: "Moves",
    role: "procedural / execution",
    meaning: "How work is done — ordered steps, procedures, and transformations this pearl can run. (Internally may be stored as function-of-moves; present and edit as Moves.)",
    editWhen: "User asks to add/reorder/decompose steps, change process, or describe how to do the work (e.g. “add a move that drafts a haiku”, “put risk first”).",
    verbs: [
      "reorderPearlFunctionMoves",
      "decomposePearlFunctionMove",
      "organizePearl",
      "editPearlEntity",
    ],
    examples: [
      "add a move that free-writes for two minutes",
      "reorder so the critique move comes before polish",
      "break that move into smaller steps",
    ],
  },
  weights: {
    id: "weights",
    label: "Weights",
    role: "evaluative / preference",
    meaning: "What the user values — preferences, judgements, tradeoffs, taste priorities, and which factors count more. Not procedures (Moves) and not perspectives (Lenses).",
    editWhen: "User states care/priority/tradeoff language (e.g. “I care more about honesty than polish”, “weight risk over upside”, “always include risks”).",
    verbs: [
      "getPearlWeights",
      "setPearlWeights",
      "editPearlWeights",
      "interpretPearlPrompt",
    ],
    examples: [
      "I care more about honesty than polish",
      "weight risk over upside",
      "prefer concrete imagery over abstraction",
    ],
  },
  lenses: {
    id: "lenses",
    label: "Lenses",
    role: "perspective / frame",
    meaning: "Contextual frames for seeing — whose eyes, which angle, what atmosphere of judgment. Wear/apply to change how material is perceived.",
    editWhen: "User asks for a perspective, role frame, or to wear/apply a lens (e.g. “through a skeptical investor lens”, “wear the poetry pearl”).",
    verbs: [
      "applySemanticOrbLens",
      "removeSemanticOrbLens",
      "addOrbLens",
      "wearPearl",
      "evaluateWithGauntlet",
    ],
    examples: [
      "apply a skeptical lens",
      "see this through a poet’s eyes",
      "wear this pearl when reviewing decks",
    ],
  },
});

/**
 * Classify which layer an utterance most likely targets.
 * Returns "moves" | "weights" | "lenses" | "prompt" | "mixed" | null.
 */
export function classifyUtteranceLayer(utterance = "") {
  const text = String(utterance || "").replace(/\s+/g, " ").trim();
  if (!text) return null;
  const scores = { moves: 0, weights: 0, lenses: 0, prompt: 0 };

  if (/\b(?:move|steps?|reorder|decompose|procedure|process|how to|workflow)\b/i.test(text)) {
    scores.moves += 2;
  }
  if (/\b(?:add|insert)\b.{0,24}\b(?:move|step)\b/i.test(text)) scores.moves += 2;

  if (/\b(?:weight|weights|prefer|priority|prioriti[sz]e|trade.?off|care more|value|than|over)\b/i.test(text)) {
    scores.weights += 2;
  }
  if (/\b(?:always|never)\b.{0,40}\b(?:want|include|prefer|use)\b/i.test(text)) scores.weights += 1;
  if (/\bweight\s+.+\sover\b/i.test(text) || /\bcare more about\b/i.test(text)) scores.weights += 2;

  if (/\b(?:lens|lenses|perspective|through .+ eyes|frame|angle|wear)\b/i.test(text)) {
    scores.lenses += 2;
  }
  if (/\b(?:apply|remove)\b.{0,20}\b(?:lens|perspective)\b/i.test(text)) scores.lenses += 2;

  if (/\b(?:system\s+)?prompt|instructions|taste|voice|style|like\b/i.test(text)) {
    scores.prompt += 1;
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (ranked[0][1] <= 0) return null;
  if (ranked[1][1] >= ranked[0][1] && ranked[0][1] >= 2) return "mixed";
  return ranked[0][0];
}

/**
 * Seed Moves + Weights + Lenses from an intent (offline, best-effort).
 * Functions-as-ordered-moves may be stored under `functions` for editor reuse,
 * but organization.order is always Moves → Weights → Lenses.
 */
export function seedPearlLayersFromIntent(options = {}) {
  const utterance = String(options.intent || options.utterance || options.materialText || "").trim();
  const name = String(options.name || options.topic || "").trim() || "Pearl";
  const systemPrompt = normalizePearlSystemPrompt(
    options.systemPrompt
    || defaultSystemPromptFromIntent({
      name,
      intent: utterance,
      materialText: utterance,
      topic: name,
      systemPromptHint: options.systemPromptHint || utterance,
    }),
  );

  const style = utterance.match(
    /\b(?:like|in the style of|inspired by|as if(?:\s+by)?)\s+(.+?)(?:\n|$)/i,
  )?.[1]?.trim();
  const topic = name.replace(/\s*[·|-].*$/, "").trim() || name;

  const moveSteps = [];
  if (style || /\b(?:poetry|poem|haiku|verse|thought process)\b/i.test(utterance)) {
    moveSteps.push(
      { name: "Notice", description: "Attend to concrete sensory detail before interpreting." },
      { name: "Compress", description: "Cut to the charged image or line; drop filler." },
      { name: "Voice check", description: style ? `Re-read in the thought process of ${style}.` : "Check emotional honesty over polish." },
    );
  } else if (/\b(?:investor|memo|diligence|startup)\b/i.test(utterance)) {
    moveSteps.push(
      { name: "Frame the ask", description: "State what decision this memo supports." },
      { name: "Evidence pass", description: "List claims with sources; flag gaps." },
      { name: "Risks & upside", description: "Weight downside clarity before narrative upside." },
    );
  } else if (utterance) {
    moveSteps.push(
      { name: "Gather", description: `Collect material relevant to ${topic}.` },
      { name: "Shape", description: "Turn material into a clear draft or next action." },
      { name: "Refine", description: "Tighten against this pearl's weights and lenses." },
    );
  }

  const moves = moveSteps.map((step, index) => ({
    id: `move:seed:${index + 1}`,
    name: step.name,
    description: step.description,
    kind: "move",
  }));

  // Keep ordered-move storage for LensTreeEditor reuse — presented as Moves.
  const functions = moves.length
    ? [{
      id: `function:moves:${Date.now().toString(36)}`,
      name: `${topic} process`,
      description: "Ordered Moves for this pearl (Companion presents these as Moves).",
      kind: "function",
      steps: moveSteps.map((step) => ({
        name: step.name,
        prompt: step.description,
      })),
    }]
    : [];

  const weights = seedWeightsFromIntent(utterance, { limit: 10 });

  const lenses = [];
  if (style) {
    lenses.push({
      id: "lens:seed:style",
      name: `${style} awareness`.slice(0, 64),
      description: `See through the thought process and taste of ${style}.`,
      kind: "lens",
      strength: 0.75,
    });
  } else if (/\b(?:skeptic|investor|poetry|poet)\b/i.test(utterance)) {
    const lensName = /\binvestor\b/i.test(utterance)
      ? "Investor awareness"
      : /\bpoet|poetry\b/i.test(utterance)
        ? "Poetic awareness"
        : "Skeptical awareness";
    lenses.push({
      id: "lens:seed:topic",
      name: lensName,
      description: `Primary seeing-frame for ${topic}.`,
      kind: "lens",
      strength: 0.7,
    });
  } else if (utterance) {
    lenses.push({
      id: "lens:seed:default",
      name: `${topic} awareness`.slice(0, 64),
      description: "How this pearl sees the user and the problem space.",
      kind: "lens",
      strength: 0.65,
    });
  }

  const weightBlock = summarizeWeightsForPrompt(weights);
  const projectedPrompt = normalizePearlSystemPrompt([
    systemPrompt,
    "",
    "## Moves (how work is done)",
    ...moves.map((move, index) => `${index + 1}. ${move.name} — ${move.description}`),
    "",
    "## Weights (what is valued)",
    weightBlock || "- (none yet — ask what factors matter)",
    "",
    "## Lenses (how to see)",
    ...lenses.map((lens) => `- ${lens.name}: ${lens.description}`),
  ].join("\n"));

  return {
    version: PEARL_LAYER_INSTRUCTIONS_VERSION,
    order: [...PEARL_LAYER_ORDER],
    moves,
    weights: normalizePearlWeights(weights),
    lenses,
    functions,
    systemPrompt: projectedPrompt,
    organization: {
      order: [...PEARL_LAYER_ORDER],
      moves,
      weights: normalizePearlWeights(weights),
      lenses,
      // Legacy key kept for readers that still look for functions under organization.
      functions,
    },
  };
}

/**
 * Compact layer pack for observe / planner / worn context.
 */
export function buildPearlLayerPack(pearl = {}) {
  const weights = readPearlWeights(pearl);
  const moves = Array.isArray(pearl.moves) ? pearl.moves : [];
  const functionMoves = (pearl.functions || []).flatMap((fn) => (
    Array.isArray(fn.steps)
      ? fn.steps.map((step, index) => ({
        name: step.name || `Move ${index + 1}`,
        description: step.prompt || step.description || "",
        fromFunction: fn.name || "process",
      }))
      : []
  ));
  const lenses = pearl.lenses || pearl.workingSet?.lenses || [];
  return {
    version: PEARL_LAYER_INSTRUCTIONS_VERSION,
    order: [...PEARL_LAYER_ORDER],
    moves: [
      ...moves.map((move) => ({
        name: move.name || "Move",
        description: move.description || move.transformation || "",
      })),
      ...functionMoves,
    ].slice(0, 40),
    weights: weights.map((entry) => ({
      name: entry.name,
      priority: entry.priority,
      note: entry.note,
    })),
    lenses: lenses.map((lens) => ({
      name: lens.name || lens.label || "Lens",
      description: lens.description || "",
      strength: lens.strength,
    })),
  };
}

/**
 * Full Companion instruction block — how to understand and manipulate each layer.
 */
export function formatPearlLayerInstructionsForCompanion(options = {}) {
  const pack = options.pearl ? buildPearlLayerPack(options.pearl) : null;
  const defs = PEARL_LAYER_DEFINITIONS;
  const lines = [
    "Pearl load-bearing layers (canonical fidelity — systemPrompt summarizes these):",
    "1) Moves — procedural/execution: ordered steps for how work is done. Add/reorder/decompose via reorderPearlFunctionMoves, decomposePearlFunctionMove, organizePearl. Present function-of-moves storage as Moves, never as a separate brain called Functions.",
    "2) Weights — evaluative preferences: factors the user values, judgements, tradeoffs, priorities. Update via getPearlWeights / setPearlWeights / editPearlWeights when they say care/weight/prefer/always/never tradeoff language.",
    "3) Lenses — perspectives/frames for seeing. Apply/remove/wear via applySemanticOrbLens, wearPearl, evaluateWithGauntlet.",
    "Routing: process/how-to → Moves; value/tradeoff → Weights; perspective/wear → Lenses; taste voice that spans all three → interpretPearlPrompt (update layers + project systemPrompt).",
    "Never expose internal ids, hashes, or storage keys in chat. Offline local create/edit must succeed without sign-in; AI enrich is optional.",
  ];
  if (pack) {
    lines.push(
      `Current Moves (${pack.moves.length}): ${pack.moves.map((m) => m.name).slice(0, 8).join("; ") || "none"}`,
      `Current Weights (${pack.weights.length}): ${pack.weights.map((w) => w.name).slice(0, 8).join("; ") || "none"}`,
      `Current Lenses (${pack.lenses.length}): ${pack.lenses.map((l) => l.name).slice(0, 8).join("; ") || "none"}`,
    );
  }
  if (options.includeExamples) {
    lines.push(
      `Moves examples: ${defs.moves.examples.join(" · ")}`,
      `Weights examples: ${defs.weights.examples.join(" · ")}`,
      `Lenses examples: ${defs.lenses.examples.join(" · ")}`,
    );
  }
  return lines.join("\n");
}

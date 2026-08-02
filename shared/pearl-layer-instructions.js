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
import {
  extractStyleAndDomain,
  resolvePearlLayerTemplate,
  titleFromStyleAndDomain,
} from "./pearl-layer-templates.js";

export const PEARL_LAYER_INSTRUCTIONS_VERSION = 1;

/** Canonical user/Companion order — Moves → Weights → Lenses. */
export const PEARL_LAYER_ORDER = PEARL_STUDIO_COGNITIVE_SECTION_ORDER;

export {
  extractStyleAndDomain,
  resolvePearlLayerTemplate,
  titleFromStyleAndDomain,
};

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
  // Style+taste+lens creates are mixed layer materialization, not prompt-only.
  if (/\bstyle\b.+\btaste\b.+\blens\b/i.test(text) || /\breflects?\b.+\bstyle\b/i.test(text)) {
    return "mixed";
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (ranked[0][1] <= 0) return null;
  if (ranked[1][1] >= ranked[0][1] && ranked[0][1] >= 2) return "mixed";
  return ranked[0][0];
}

/**
 * Project Moves · Weights · Lenses into a readable systemPrompt (one direction).
 */
export function projectSystemPromptFromLayers(layers = {}, options = {}) {
  const name = String(options.name || layers.name || "Pearl").trim() || "Pearl";
  const voice = String(options.voice || layers.voice || "").trim();
  const intent = String(options.intent || layers.intent || "").trim();
  const moves = Array.isArray(layers.moves) ? layers.moves : [];
  const weights = normalizePearlWeights(layers.weights || []);
  const lenses = Array.isArray(layers.lenses) ? layers.lenses : [];
  const weightBlock = summarizeWeightsForPrompt(weights);
  const base = normalizePearlSystemPrompt(
    options.basePrompt
    || defaultSystemPromptFromIntent({
      name,
      intent: intent || name,
      materialText: intent,
      topic: name,
      systemPromptHint: voice ? `${name} — like ${voice}` : intent || name,
    }),
  );
  // Strip prior projection sections so re-projection stays idempotent.
  const head = base
    .split(/\n## (?:Moves|Weights|Lenses)\b/)[0]
    .trim();
  return normalizePearlSystemPrompt([
    head,
    voice && !head.toLowerCase().includes(voice.toLowerCase().slice(0, 24))
      ? `\nAdopt the taste, voice, and thought process of: ${voice}.`
      : "",
    "",
    "## Moves (how work is done)",
    ...(moves.length
      ? moves.map((move, index) => `${index + 1}. ${move.name} — ${move.description || ""}`.trim())
      : ["- (none yet — ask how work should be done)"]),
    "",
    "## Weights (what is valued)",
    weightBlock || "- (none yet — ask what factors matter)",
    "",
    "## Lenses (how to see)",
    ...(lenses.length
      ? lenses.map((lens) => `- ${lens.name}: ${lens.description || ""}`.trim())
      : ["- (none yet — ask which perspective to wear)"]),
  ].filter((line, index, all) => !(line === "" && all[index - 1] === "")).join("\n"));
}

/**
 * When Companion edits systemPrompt prose, pull structured layer hints back out
 * (best-effort) and merge onto existing layers — sync both ways.
 */
export function syncLayersFromSystemPrompt(systemPrompt = "", priorLayers = {}) {
  const text = String(systemPrompt || "");
  const section = (label) => {
    const match = text.match(
      new RegExp(`##\\s*${label}\\b[^\\n]*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, "i"),
    );
    return match?.[1]?.trim() || "";
  };
  const moveBlock = section("Moves");
  const weightBlock = section("Weights");
  const lensBlock = section("Lenses");

  const movesFromPrompt = [...moveBlock.matchAll(/^\s*(?:\d+\.|[-*])\s*(.+?)(?:\s*[—–-]\s*(.+))?$/gm)]
    .map((match, index) => ({
      id: priorLayers.moves?.[index]?.id || `move:sync:${index + 1}`,
      name: String(match[1] || "").replace(/\s+/g, " ").trim().slice(0, 80) || `Move ${index + 1}`,
      description: String(match[2] || "").replace(/\s+/g, " ").trim().slice(0, 400),
      kind: "move",
    }))
    .filter((entry) => entry.name);

  const weightsFromPrompt = [...weightBlock.matchAll(/^\s*[-*]\s*(.+?)(?:\s*\((\d+)%\))?(?::\s*(.+))?$/gm)]
    .map((match, index) => ({
      id: priorLayers.weights?.[index]?.id || `weight:sync:${index + 1}`,
      name: String(match[1] || "").replace(/\s+/g, " ").trim().slice(0, 80),
      priority: match[2] ? Number(match[2]) / 100 : (priorLayers.weights?.[index]?.priority ?? 0.7),
      note: String(match[3] || "").replace(/\s+/g, " ").trim().slice(0, 400),
      kind: "weight",
    }))
    .filter((entry) => entry.name);

  const lensesFromPrompt = [...lensBlock.matchAll(/^\s*[-*]\s*(.+?)(?::\s*(.+))?$/gm)]
    .map((match, index) => ({
      id: priorLayers.lenses?.[index]?.id || `lens:sync:${index + 1}`,
      name: String(match[1] || "").replace(/\s+/g, " ").trim().slice(0, 64),
      description: String(match[2] || "").replace(/\s+/g, " ").trim().slice(0, 400),
      kind: "lens",
      strength: priorLayers.lenses?.[index]?.strength ?? 0.7,
    }))
    .filter((entry) => entry.name);

  return {
    moves: movesFromPrompt.length ? movesFromPrompt : (priorLayers.moves || []),
    weights: normalizePearlWeights(
      weightsFromPrompt.length ? weightsFromPrompt : (priorLayers.weights || []),
    ),
    lenses: lensesFromPrompt.length ? lensesFromPrompt : (priorLayers.lenses || []),
  };
}

/**
 * Seed Moves + Weights + Lenses from an intent (offline, best-effort).
 * Functions-as-ordered-moves may be stored under `functions` for editor reuse,
 * but organization.order is always Moves → Weights → Lenses.
 */
export function seedPearlLayersFromIntent(options = {}) {
  const utterance = String(options.intent || options.utterance || options.materialText || "").trim();
  const extracted = extractStyleAndDomain(utterance);
  const template = resolvePearlLayerTemplate(utterance, {
    style: extracted.style,
    domain: extracted.domain,
    personaKey: extracted.personaKey,
  });
  const name = String(
    options.name
    || options.topic
    || titleFromStyleAndDomain(utterance, { name: options.titleHint || "" })
    || "Pearl",
  ).trim() || "Pearl";

  let moveSteps = [];
  let weights = [];
  let lenses = [];
  let voice = template?.voice || extracted.style || "";

  if (template) {
    moveSteps = template.moves.map((step) => ({
      name: step.name,
      description: step.description,
    }));
    weights = normalizePearlWeights(template.weights);
    lenses = template.lenses.map((lens, index) => ({
      id: `lens:seed:${index + 1}`,
      name: lens.name,
      description: lens.description,
      kind: "lens",
      strength: lens.strength ?? 0.75,
    }));
  } else {
    const topic = name.replace(/\s*[·|-].*$/, "").trim() || name;
    if (/\b(?:poetry|poem|haiku|verse|thought process)\b/i.test(utterance) || extracted.style) {
      moveSteps = [
        { name: "Notice", description: "Attend to concrete sensory detail before interpreting." },
        { name: "Compress", description: "Cut to the charged image or line; drop filler." },
        {
          name: "Voice check",
          description: extracted.style
            ? `Re-read in the thought process of ${extracted.style}.`
            : "Check emotional honesty over polish.",
        },
      ];
    } else if (/\b(?:investor|investing|memo|diligence|startup|underwrit)\b/i.test(utterance)) {
      moveSteps = [
        { name: "Frame the ask", description: "State what decision this memo supports." },
        { name: "Evidence pass", description: "List claims with sources; flag gaps." },
        { name: "Risks & upside", description: "Weight downside clarity before narrative upside." },
      ];
    } else if (utterance) {
      moveSteps = [
        { name: "Gather", description: `Collect material relevant to ${topic}.` },
        { name: "Shape", description: "Turn material into a clear draft or next action." },
        { name: "Refine", description: "Tighten against this pearl's weights and lenses." },
      ];
    }
    weights = seedWeightsFromIntent(utterance, { limit: 10 });
    if (extracted.style) {
      lenses.push({
        id: "lens:seed:style",
        name: `${extracted.style} awareness`.slice(0, 64),
        description: `See through the thought process and taste of ${extracted.style}.`,
        kind: "lens",
        strength: 0.75,
      });
    } else if (/\b(?:skeptic|investor|investing|poetry|poet)\b/i.test(utterance)) {
      const lensName = /\binvest/i.test(utterance)
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
  }

  // Merge any explicit care/weight language onto template weights.
  const spokenWeights = seedWeightsFromIntent(utterance, { limit: 6 });
  if (spokenWeights.length) {
    weights = normalizePearlWeights([...weights, ...spokenWeights]);
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
      name: `${name.replace(/\s*[·|-].*$/, "").trim() || name} process`,
      description: "Ordered Moves for this pearl (Companion presents these as Moves).",
      kind: "function",
      steps: moveSteps.map((step) => ({
        name: step.name,
        prompt: step.description,
      })),
    }]
    : [];

  const organization = {
    order: [...PEARL_LAYER_ORDER],
    moves,
    weights: normalizePearlWeights(weights),
    lenses,
    functions,
  };

  const projectedPrompt = projectSystemPromptFromLayers({
    moves,
    weights: organization.weights,
    lenses,
    voice,
    intent: utterance,
    name,
  }, {
    name,
    voice,
    intent: utterance,
    basePrompt: options.systemPrompt || null,
  });

  return {
    version: PEARL_LAYER_INSTRUCTIONS_VERSION,
    order: [...PEARL_LAYER_ORDER],
    moves,
    weights: organization.weights,
    lenses,
    functions,
    voice,
    title: name,
    personaKey: extracted.personaKey || template?.id || null,
    systemPrompt: projectedPrompt,
    organization,
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
    "Cursor-for-pearls: trail Working → Interpreting → Proposed layer changes → Applied / Blocked. Offline structured merge always; AI enrich optional when signed in. Never abort local create for needs-credentials.",
    "Never expose internal ids, hashes, or storage keys in chat.",
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

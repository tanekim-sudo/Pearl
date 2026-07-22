/**
 * Companion is the app. Pearls are optional capability packs the companion can wear.
 * Wearing a pearl injects its working set, lenses, and bound functions into companion context.
 */

export const COMPANION_PEARL_WEAR_VERSION = 1;
export const WORN_PEARL_STORAGE_KEY = "lens.companion.worn-pearl.v1";

const bounded = (value, limit = 280) => String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);

function tokenize(value) {
  return bounded(value, 4_000)
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length > 2);
}

/**
 * Build the capability pack the companion gains when a pearl is worn.
 */
export function buildWornPearlPack(pearl, options = {}) {
  if (!pearl?.id) return null;
  const workingSet = pearl.workingSet || {};
  const context = (workingSet.context || []).slice(0, 40).map((entry) => ({
    id: entry.id,
    kind: entry.kind || "material",
    label: bounded(entry.label || entry.name || entry.text || "Context", 120),
    summary: bounded(entry.text || entry.verbatim || entry.content || entry.label || "", 220),
  }));
  const lenses = (workingSet.lenses || []).slice(0, 20).map((lens) => ({
    id: lens.id,
    name: bounded(lens.name || lens.label || "Lens", 80),
    strength: Number.isFinite(lens.strength) ? lens.strength : 0.7,
  }));
  const representation = pearl.representation || {};
  const boundRefs = [...new Set([
    ...(representation.refs || []),
    ...(options.libraryRefs || []),
  ].filter(Boolean))].slice(0, 40);
  const functions = (options.functions || [])
    .filter((fn) => boundRefs.includes(fn.id) || boundRefs.includes(fn.stableId) || fn.pearlId === pearl.id)
    .slice(0, 24)
    .map((fn) => ({
      id: fn.id || fn.stableId,
      name: bounded(fn.name || "Function", 80),
      description: bounded(fn.description || "", 180),
      stepCount: Array.isArray(fn.steps) ? fn.steps.length : Number(fn.stepCount) || 0,
    }));
  return {
    version: COMPANION_PEARL_WEAR_VERSION,
    pearlId: pearl.id,
    name: bounded(pearl.name || representation.label || "Untitled pearl", 120),
    kind: pearl.kind || representation.kind || "semantic-orb",
    representationKind: representation.kind || "empty",
    wornAt: Number(options.wornAt) || Date.now(),
    context,
    lenses,
    functions,
    boundRefs,
    summary: bounded(
      options.summary
        || `${pearl.name || "Pearl"} · ${context.length} context · ${lenses.length} lenses · ${functions.length} functions`,
      220,
    ),
    capabilities: {
      canExecuteBoundFunctions: functions.length > 0,
      canApplyLenses: lenses.length > 0,
      hasContext: context.length > 0,
    },
  };
}

export function companionWearPrompt(pack) {
  if (!pack) {
    return [
      "Companion is always available without a worn pearl.",
      "Pearls are optional add-ons. Use wearPearl to put one on; removeWornPearl to take it off.",
      "When no pearl is worn, still help with screen context, capture, learning, and creating new pearls.",
    ].join(" ");
  }
  return [
    `Worn pearl “${pack.name}” (${pack.pearlId}).`,
    `Context items: ${pack.context.length}. Lenses: ${pack.lenses.length}. Bound functions: ${pack.functions.map((fn) => fn.name).join(", ") || "none"}.`,
    "Interpret and execute through this pearl’s lens. Prefer its bound functions and context before inventing new ones.",
    "The user can still create another pearl or switch worn pearls at any time.",
  ].join(" ");
}

/**
 * Score existing pearls as homes for a new conversation-derived function.
 */
export function suggestPearlForConversation(pearls = [], artifact = {}) {
  const corpus = tokenize([
    artifact.name,
    artifact.description,
    artifact.summary,
    ...(artifact.keywords || []),
    ...(artifact.steps || []).map((step) => step.name || step.prompt || step.description || ""),
  ].join(" "));
  if (!corpus.length) {
    return { version: COMPANION_PEARL_WEAR_VERSION, suggestions: [], preferNew: true, reason: "No comparable keywords in the conversation artifact." };
  }
  const suggestions = (pearls || [])
    .filter((pearl) => pearl && !pearl.archived)
    .map((pearl) => {
      const hay = tokenize([
        pearl.name,
        pearl.representation?.label,
        ...(pearl.workingSet?.context || []).map((entry) => entry.label || entry.text || ""),
        ...(pearl.workingSet?.lenses || []).map((lens) => lens.name || ""),
      ].join(" "));
      const overlap = corpus.filter((token) => hay.includes(token));
      const score = overlap.length / Math.max(corpus.length, 1);
      return {
        pearlId: pearl.id,
        name: pearl.name || "Untitled pearl",
        score: Math.round(score * 1000) / 1000,
        overlap: overlap.slice(0, 8),
        reason: overlap.length
          ? `Shares themes: ${overlap.slice(0, 4).join(", ")}`
          : "Little thematic overlap",
      };
    })
    .filter((entry) => entry.score >= 0.12)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  return {
    version: COMPANION_PEARL_WEAR_VERSION,
    suggestions,
    preferNew: suggestions.length === 0 || (suggestions[0]?.score || 0) < 0.28,
    reason: suggestions[0]?.score >= 0.28
      ? `Strongest match is “${suggestions[0].name}”.`
      : "No existing pearl is a strong home — create a new one.",
  };
}

/**
 * Deterministic compression of a transcript into a pearl + function spec
 * (no model required for the structural proposal).
 */
export function compressConversationToPearlSpec(transcript, options = {}) {
  const messages = (transcript?.messages || []).filter((message) => message.included !== false);
  if (!messages.length) throw new Error("conversation is empty");
  const userTurns = messages.filter((message) => message.role === "user");
  const assistantTurns = messages.filter((message) => message.role === "assistant");
  const titleSeed = bounded(
    options.name
      || userTurns.find((message) => message.content.length > 12)?.content
      || "Conversation function",
    80,
  );
  const name = bounded(
    options.name
      || titleSeed.replace(/^(please\s+)?/i, "").replace(/[.?!].*$/, "").slice(0, 64)
      || "Conversation function",
    80,
  );
  const steps = [];
  const processCue = /\b(?:first|then|next|finally|step|stage)\b/i;
  for (const message of userTurns.slice(0, 12)) {
    if (processCue.test(message.content) || message.content.length > 40) {
      steps.push({
        name: bounded(message.content.split(/[.?\n]/)[0] || `Step ${steps.length + 1}`, 72),
        prompt: bounded(message.content, 600),
        evidenceRefs: [message.index],
      });
    }
  }
  if (!steps.length) {
    steps.push({
      name: "Replay conversation intent",
      prompt: bounded(userTurns.map((message) => message.content).join("\n\n") || "Replay the captured conversation intent.", 1_200),
      evidenceRefs: userTurns.slice(0, 6).map((message) => message.index),
    });
  }
  if (assistantTurns[0]) {
    steps.push({
      name: "Apply the successful pattern",
      prompt: bounded(`Reproduce the assistant pattern evidenced here:\n${assistantTurns[0].content}`, 900),
      evidenceRefs: [assistantTurns[0].index],
    });
  }
  const description = bounded(
    options.description
      || `Reusable function learned from a ${messages.length}-turn conversation (${userTurns.length} user / ${assistantTurns.length} assistant).`,
    280,
  );
  return {
    version: COMPANION_PEARL_WEAR_VERSION,
    pearl: {
      name,
      representation: { kind: "function", label: name },
      workingSet: {
        context: [{
          id: `conversation:${transcript.fingerprint || Date.now()}`,
          kind: "transcript",
          label: "Source conversation",
          text: bounded(messages.map((message) => `${message.role}: ${message.content}`).join("\n"), 4_000),
          fingerprint: transcript.fingerprint || null,
        }],
        lenses: [],
      },
    },
    function: {
      name,
      description,
      steps: steps.slice(0, 12),
      learnedFrom: {
        kind: "llm-transcript",
        messageCount: messages.length,
        fingerprint: transcript.fingerprint || null,
        private: true,
      },
    },
    keywords: tokenize(`${name} ${description} ${steps.map((step) => step.name).join(" ")}`).slice(0, 24),
  };
}

export function loadWornPearlId(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem?.(WORN_PEARL_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.pearlId || null;
  } catch {
    return null;
  }
}

export function saveWornPearlId(pearlId, storage = globalThis.localStorage) {
  if (!storage) return pearlId;
  if (!pearlId) {
    storage.removeItem?.(WORN_PEARL_STORAGE_KEY);
    return null;
  }
  storage.setItem?.(WORN_PEARL_STORAGE_KEY, JSON.stringify({
    version: COMPANION_PEARL_WEAR_VERSION,
    pearlId,
    wornAt: Date.now(),
  }));
  return pearlId;
}

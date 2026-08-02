/**
 * Pearl = a system prompt the Companion interprets and can edit.
 * Keep this module small: normalize, seed from intent, apply edits.
 */

export const PEARL_SYSTEM_PROMPT_MAX = 12_000;
export const PEARL_SYSTEM_PROMPT_VERSION = 1;

const bounded = (value, limit = PEARL_SYSTEM_PROMPT_MAX) => String(value ?? "").trim().slice(0, limit);

/**
 * Normalize any raw value to a clean system-prompt string (may be empty).
 */
export function normalizePearlSystemPrompt(value) {
  return bounded(value, PEARL_SYSTEM_PROMPT_MAX);
}

/**
 * Read the primary system prompt from a pearl / semantic orb / entity.
 * Falls back through legacy purpose / description / role instructions.
 */
export function readPearlSystemPrompt(pearl) {
  if (!pearl || typeof pearl !== "object") return "";
  const direct = pearl.systemPrompt
    ?? pearl.identity?.systemPrompt
    ?? pearl.prompt
    ?? pearl.instructions;
  if (direct != null && String(direct).trim()) {
    return normalizePearlSystemPrompt(direct);
  }
  const purpose = pearl.identity?.purpose || pearl.purpose;
  if (purpose && String(purpose).trim()) return normalizePearlSystemPrompt(purpose);
  const description = pearl.identity?.description || pearl.description;
  if (description && String(description).trim()) return normalizePearlSystemPrompt(description);
  const roleLayer = (pearl.cognition?.layers || pearl.roles || []).find((layer) => (
    (layer.kind === "role" || layer.kind === "Role")
    && (layer.definition?.instructions || layer.instructions || layer.definition?.prompt || layer.prompt)
  ));
  if (roleLayer) {
    return normalizePearlSystemPrompt(
      roleLayer.definition?.instructions
      || roleLayer.instructions
      || roleLayer.definition?.prompt
      || roleLayer.prompt,
    );
  }
  return "";
}

/**
 * Seed a sensible system prompt from a create utterance / topic.
 * Never returns empty junk for a named intent.
 */
export function defaultSystemPromptFromIntent(options = {}) {
  const name = bounded(options.name || "", 180);
  const intent = bounded(options.intent || options.utterance || options.materialText || "", 2_000);
  const topic = bounded(options.topic || name || intent, 180);
  const hint = bounded(options.systemPromptHint || options.materialText || "", 2_000);
  if (!topic && !intent && !hint) {
    return "You are a focused Pearl companion. Follow the user's instructions carefully and keep outputs clear.";
  }
  const about = topic || intent || hint;
  const styleSource = `${hint}\n${intent}`;
  const styleMatch = styleSource.match(
    /\b(?:like|in the style of|inspired by|as if(?:\s+by)?)\s+(.+?)(?:\n|$)/i,
  ) || styleSource.match(
    /\breflects?\s+(.+?)(?:['’]s)?\s+(?:style|taste|voice|thought\s+process|lens)\b/i,
  );
  const style = bounded(styleMatch?.[1] || "", 400);
  const lines = [
    `You are the Pearl “${about}”.`,
    `Interpret requests through this pearl's taste and instructions.`,
    style
      ? `Adopt the taste, voice, and thought process of: ${style}.`
      : null,
    intent && intent !== about
      ? `Formation intent: ${intent}`
      : `Help the user think, write, and act about ${about}.`,
    "Prefer concrete, skeptical, useful output over generic praise.",
  ];
  return normalizePearlSystemPrompt(lines.filter(Boolean).join("\n"));
}

/**
 * Apply replace / append / rewrite edits to an existing prompt.
 * `rewrite` replaces with the provided text (Companion or Studio supplies the rewrite body).
 */
export function editPearlSystemPrompt(current, options = {}) {
  const prior = normalizePearlSystemPrompt(current);
  const mode = String(options.mode || "replace").toLowerCase();
  const text = normalizePearlSystemPrompt(options.text || options.instruction || options.prompt || "");
  if (!text && mode !== "clear") {
    return { ok: false, reason: "Tell me what to change in the system prompt.", systemPrompt: prior };
  }
  if (mode === "append" || mode === "add") {
    const next = prior
      ? normalizePearlSystemPrompt(`${prior}\n\n${text}`)
      : text;
    return { ok: true, mode: "append", systemPrompt: next, prior };
  }
  if (mode === "clear") {
    return { ok: true, mode: "clear", systemPrompt: "", prior };
  }
  // replace | rewrite | set
  return { ok: true, mode: mode === "rewrite" ? "rewrite" : "replace", systemPrompt: text, prior };
}

/**
 * Patch helpers for semantic orbs and pearl entities (shared field name).
 */
export function applySystemPromptToPearl(pearl, systemPrompt, options = {}) {
  const nextPrompt = normalizePearlSystemPrompt(systemPrompt);
  const base = pearl && typeof pearl === "object" ? { ...pearl } : {};
  const identity = base.identity && typeof base.identity === "object"
    ? { ...base.identity, purpose: nextPrompt.slice(0, 1_000) || base.identity.purpose || "" }
    : base.identity;
  return {
    ...base,
    systemPrompt: nextPrompt,
    ...(identity ? { identity } : {}),
    ...(options.alsoPurpose !== false && !identity
      ? { purpose: nextPrompt.slice(0, 1_000) || base.purpose || "" }
      : {}),
    updatedAt: options.updatedAt || base.updatedAt || Date.now(),
  };
}

/**
 * Migrate empty / missing systemPrompt from legacy fields.
 */
export function migratePearlSystemPrompt(pearl) {
  const existing = normalizePearlSystemPrompt(pearl?.systemPrompt ?? pearl?.identity?.systemPrompt);
  if (existing) {
    return {
      systemPrompt: existing,
      migrated: false,
      from: "systemPrompt",
    };
  }
  const legacy = readPearlSystemPrompt(pearl);
  if (legacy) {
    return { systemPrompt: legacy, migrated: true, from: "legacy" };
  }
  const name = pearl?.name || pearl?.identity?.name || "";
  return {
    systemPrompt: defaultSystemPromptFromIntent({ name, topic: name }),
    migrated: true,
    from: "default",
  };
}

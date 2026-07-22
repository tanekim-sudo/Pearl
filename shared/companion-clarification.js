/**
 * Cursor-like clarifying check-ins for vague or underspecified companion work.
 * Used before compiling or executing Automation Pearls and complex transforms.
 */

export const COMPANION_CLARIFICATION_VERSION = 1;
export const CLARIFICATION_STORAGE_KEY = "lens.companion.clarification.v1";

const VAGUE = /\b(?:somehow|whatever|stuff|things?|make it good|do the usual|you know|figure it out|as appropriate|etc\.?|and so on)\b/i;
const MISSING_FORMAT = /\b(?:memo|brief|one[- ]pager|deck|report|email|briefing)\b/i;
const HAS_FORMAT_DETAIL = /\b(?:section|heading|template|format|include|must include|structure|bullet|table)\b/i;
const MISSING_AUDIENCE = /\b(?:lp|limited partner|investor|partner|ic|board|founder|customer)\b/i;
const HAS_AUDIENCE = /\b(?:for|audience|reader|send to|briefing for)\b/i;
const MISSING_SOURCE = /\b(?:from|using|based on|with (?:this|these|the)|source|pitchbook|affinity|drive|crm)\b/i;
const DESTRUCTIVE = /\b(?:delete|overwrite|replace all|send|email|share externally|publish|clear)\b/i;
const IMPLEMENTATION = /\b(?:automat|workflow|every time|whenever|pipeline|encode|compile)\b/i;

function bounded(value, limit = 280) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function pushQuestion(list, id, prompt, reason, options = []) {
  if (list.some((entry) => entry.id === id)) return;
  list.push({
    id,
    prompt: bounded(prompt, 320),
    reason: bounded(reason, 220),
    options: options.slice(0, 6).map((entry) => bounded(entry, 120)),
    required: true,
  });
}

/**
 * Inspect free-form instructions and/or a compiled Automation Pearl for vagueness
 * and missing implementation specifics.
 */
export function inspectInstructionSpecificity(input = {}) {
  const instruction = bounded(input.instruction || input.text || "", 20_000);
  const pearl = input.pearl || null;
  const evidence = pearl?.material?.evidence || input.evidence || [];
  const evidenceText = evidence.map((entry) => entry.verbatim || entry.content || "").join("\n");
  const corpus = `${instruction}\n${evidenceText}`.trim();
  const questions = [];
  const unresolved = [...(pearl?.semanticDiff?.unresolved || [])];

  if (!corpus) {
    pushQuestion(questions, "missing-instruction", "What should this automation do?", "No instruction or evidence was supplied.");
    return summarize(questions, unresolved, corpus, pearl);
  }

  if (VAGUE.test(corpus) || corpus.split(/\s+/).length < 8) {
    pushQuestion(
      questions,
      "vague-goal",
      "What exact output should this produce, and for whom?",
      "The instruction is vague or too short to execute safely.",
      ["Investment memo", "LP briefing", "One-pager", "Email draft"],
    );
  }

  if (MISSING_FORMAT.test(corpus) && !HAS_FORMAT_DETAIL.test(corpus) && !evidence.some((entry) => ["template", "format-template", "example"].includes(entry.kind))) {
    pushQuestion(
      questions,
      "format-specificity",
      "Which format or example should I match exactly — can you show a tab/template, or name the required sections?",
      "Output type is named but format specifics are missing.",
      ["Capture the format tab now", "Use firm memo sections", "I will paste a template"],
    );
  }

  if (IMPLEMENTATION.test(corpus) && !MISSING_SOURCE.test(corpus) && !evidence.some((entry) => ["email-thread", "drive-doc", "crm-export", "attachment-extract"].includes(entry.kind))) {
    pushQuestion(
      questions,
      "source-inputs",
      "What inputs should each run use (Pitchbook/Affinity paste, Drive doc, email thread, or screen capture)?",
      "Automation is requested without concrete source bindings.",
      ["Capture the current tab", "Paste CRM export", "Attach a Drive link"],
    );
  }

  if ((MISSING_AUDIENCE.test(corpus) || /\bbriefing\b/i.test(corpus)) && !HAS_AUDIENCE.test(corpus) && !/\bfor\s+[A-Z][\w .'-]{2,}/.test(corpus)) {
    pushQuestion(
      questions,
      "audience",
      "Who is the audience for this run (for example which LP or internal reader)?",
      "Audience is implied but not specific enough for a safe first execution.",
    );
  }

  const fields = pearl?.contextSchema?.fields || pearl?.automation?.contextSchema?.fields || [];
  for (const field of fields.filter((entry) => entry.required)) {
    const supplied = input.inputs?.[field.name] != null && String(input.inputs[field.name]).trim();
    if (!supplied) {
      pushQuestion(
        questions,
        `field:${field.name}`,
        `What value should I use for required field “${field.name}”?`,
        "Required automation input is unset.",
      );
    }
  }

  if (pearl?.researchPlan?.required && pearl?.researchPlan?.blockedUntilApproval && input.researchApproved !== true) {
    pushQuestion(
      questions,
      "research-approval",
      "This run wants verified research. Approve a bounded public research plan, or keep it local-only?",
      "Research is required but not yet approved.",
      ["Approve bounded research", "Stay local-only for this run"],
    );
  }

  if (DESTRUCTIVE.test(corpus) && input.destructiveConfirmed !== true) {
    pushQuestion(
      questions,
      "destructive-confirm",
      "This may send, publish, overwrite, or delete. Confirm the exact target and that you want me to proceed.",
      "Potentially destructive side effects need an explicit check-in.",
      ["Proceed with confirmation", "Stop — show a dry run only"],
    );
  }

  for (const entry of unresolved) {
    const text = typeof entry === "string" ? entry : entry.prompt || entry.question || entry.message;
    if (text) pushQuestion(questions, `unresolved:${bounded(text, 40)}`, text, "Compiler left this unresolved.");
  }

  return summarize(questions, unresolved, corpus, pearl);
}

function summarize(questions, unresolved, corpus, pearl) {
  const blocking = questions.filter((entry) => entry.required);
  return {
    version: COMPANION_CLARIFICATION_VERSION,
    ready: blocking.length === 0,
    severity: blocking.some((entry) => entry.id === "destructive-confirm")
      ? "high"
      : blocking.length
        ? "medium"
        : "low",
    questionCount: questions.length,
    questions,
    unresolved: unresolved.slice(0, 20),
    summary: blocking.length
      ? `I need ${blocking.length} clarification${blocking.length === 1 ? "" : "s"} before committing this automation.`
      : "Instructions look specific enough to proceed.",
    pearlId: pearl?.id || null,
    inspectedCharacters: corpus.length,
  };
}

export function createClarificationSession(inspection, context = {}) {
  if (!inspection || inspection.ready) return null;
  return {
    version: COMPANION_CLARIFICATION_VERSION,
    id: `clarify:${globalThis.crypto?.randomUUID?.() || Date.now()}`,
    status: "awaiting",
    createdAt: Date.now(),
    resumeAction: context.resumeAction || null,
    resumeArgs: context.resumeArgs || {},
    instruction: bounded(context.instruction || "", 8_000),
    pearlId: context.pearlId || inspection.pearlId || null,
    questions: inspection.questions,
    answers: {},
    summary: inspection.summary,
  };
}

export function answerClarificationSession(session, answerText, options = {}) {
  if (!session || session.status !== "awaiting") throw new Error("no clarification is awaiting an answer");
  const text = bounded(answerText, 4_000);
  if (!text) throw new Error("clarification answer is empty");
  const pending = session.questions.filter((question) => !session.answers[question.id]);
  const target = options.questionId
    ? session.questions.find((question) => question.id === options.questionId)
    : pending[0];
  if (!target) {
    return { ...session, status: "resolved", resolvedAt: Date.now() };
  }
  const answers = { ...session.answers, [target.id]: { text, at: Date.now() } };
  const remaining = session.questions.filter((question) => !answers[question.id]);
  return {
    ...session,
    answers,
    status: remaining.length ? "awaiting" : "resolved",
    resolvedAt: remaining.length ? null : Date.now(),
    summary: remaining.length
      ? `${remaining.length} clarification${remaining.length === 1 ? "" : "s"} still open.`
      : "All clarifications answered — ready to continue.",
  };
}

export function clarificationPromptText(session) {
  if (!session?.questions?.length) return "";
  const open = session.questions.filter((question) => !session.answers?.[question.id]);
  const lines = open.slice(0, 4).map((question, index) => {
    const opts = question.options?.length ? ` (${question.options.join(" / ")})` : "";
    return `${index + 1}. ${question.prompt}${opts}`;
  });
  return `${session.summary}\n\n${lines.join("\n")}`;
}

export function loadClarificationSession(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem?.(CLARIFICATION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveClarificationSession(session, storage = globalThis.localStorage) {
  if (!storage) return session;
  if (!session || session.status === "resolved" || session.status === "cancelled") {
    storage.removeItem?.(CLARIFICATION_STORAGE_KEY);
    return null;
  }
  storage.setItem?.(CLARIFICATION_STORAGE_KEY, JSON.stringify(session));
  return session;
}

/**
 * Structural ambiguities the automation compiler should surface even without a model.
 */
export function inferAutomationAmbiguities(evidenceInput = [], pearl = null) {
  const evidence = Array.isArray(evidenceInput) ? evidenceInput : [];
  const text = evidence.map((entry) => entry.verbatim || entry.content || "").join("\n");
  const inspection = inspectInstructionSpecificity({ evidence, pearl, instruction: text });
  return inspection.questions.map((question) => ({
    id: question.id,
    prompt: question.prompt,
    reason: question.reason,
  }));
}

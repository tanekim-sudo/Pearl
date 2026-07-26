/**
 * Structured companion/director/GO execution results.
 * Users always see why something did not run — exact problem, stable code, stage.
 * Never put secrets (tokens, passwords, cookies, API keys) in details.
 */

export const EXECUTION_RESULT_VERSION = 1;
export const EXECUTION_EVENTS_KEY = "lens.companion.execution-events.v1";
export const MAX_EXECUTION_EVENTS = 40;

export const EXECUTION_STATUSES = Object.freeze([
  "success",
  "blocked",
  "failed",
  "cancelled",
]);

export const EXECUTION_STAGES = Object.freeze([
  "parse",
  "plan",
  "confirm",
  "execute",
  "animate",
  "persist",
  "api",
]);

/** Stable machine codes — prefer these over freeform strings. */
export const EXECUTION_CODES = Object.freeze({
  OK: "ok",
  UNKNOWN_INTENT: "unknown-intent",
  MISSING_ARGS: "missing-args",
  MISSING_EXTENSION_ID: "missing-extension-id",
  EXTENSION_UNAVAILABLE: "extension-unavailable",
  EXTENSION_REJECTED: "extension-rejected",
  INVALID_TOKEN: "invalid-token",
  NEEDS_CREDENTIALS: "needs-credentials",
  EMPTY_GAUNTLET: "empty-gauntlet",
  NO_MATERIAL: "no-material",
  PERMISSION_DENIED: "permission-denied",
  NETWORK_ERROR: "network-error",
  PLANNER_UNAVAILABLE: "planner-unavailable",
  VALIDATION_ERROR: "validation-error",
  RUNTIME_UNAVAILABLE: "runtime-unavailable",
  NEEDS_CLARIFICATION: "needs-clarification",
  NEEDS_APPROVAL: "needs-approval",
  CANCELLED: "cancelled",
  ABORTED: "aborted",
  DIRECTOR_FAILED: "director-failed",
  PERSIST_FAILED: "persist-failed",
  CRASH: "crash",
  UNKNOWN_ERROR: "unknown-error",
});

const SECRET_KEY = /token|secret|password|credential|authorization|cookie|api[_-]?key|bearer/i;

const CODE_MESSAGES = Object.freeze({
  [EXECUTION_CODES.OK]: "Done.",
  [EXECUTION_CODES.UNKNOWN_INTENT]: "I could not map that request to a known action.",
  [EXECUTION_CODES.MISSING_ARGS]: "That action is missing a required argument.",
  [EXECUTION_CODES.MISSING_EXTENSION_ID]: "Extension id is not configured for this build.",
  [EXECUTION_CODES.EXTENSION_UNAVAILABLE]: "The browser extension is not available from this page.",
  [EXECUTION_CODES.EXTENSION_REJECTED]: "The extension rejected the handoff.",
  [EXECUTION_CODES.INVALID_TOKEN]: "That handoff token is invalid or expired.",
  [EXECUTION_CODES.NEEDS_CREDENTIALS]: "Live model output needs credentials — nothing was invented.",
  [EXECUTION_CODES.EMPTY_GAUNTLET]: "Gauntlet working memory is empty — wear at least one pearl first.",
  [EXECUTION_CODES.NO_MATERIAL]: "No page or deck material was captured to evaluate.",
  [EXECUTION_CODES.PERMISSION_DENIED]: "Permission was denied for that action.",
  [EXECUTION_CODES.NETWORK_ERROR]: "The planning service is unavailable right now. Your workspace was not changed.",
  [EXECUTION_CODES.PLANNER_UNAVAILABLE]: "The planning service is unavailable right now. Your workspace was not changed.",
  [EXECUTION_CODES.VALIDATION_ERROR]: "I could not validate that action safely. Your workspace was not changed; you can retry it.",
  [EXECUTION_CODES.RUNTIME_UNAVAILABLE]: "Companion runtime is still starting — try again in a moment.",
  [EXECUTION_CODES.NEEDS_CLARIFICATION]: "I need a choice or more detail before running that.",
  [EXECUTION_CODES.NEEDS_APPROVAL]: "That plan is waiting for your approval.",
  [EXECUTION_CODES.CANCELLED]: "Cancelled. The workspace was not changed.",
  [EXECUTION_CODES.ABORTED]: "That action was stopped. Nothing else changed.",
  [EXECUTION_CODES.DIRECTOR_FAILED]: "The demonstration could not finish safely.",
  [EXECUTION_CODES.PERSIST_FAILED]: "The change could not be saved.",
  [EXECUTION_CODES.CRASH]: "Pearl hit a crash while rendering.",
  [EXECUTION_CODES.UNKNOWN_ERROR]: "That action could not be completed safely. Your workspace was not changed.",
});

function sanitizeDetails(details) {
  if (details == null || typeof details !== "object") return undefined;
  const out = {};
  for (const [key, value] of Object.entries(details)) {
    if (SECRET_KEY.test(key)) continue;
    if (typeof value === "string") out[key] = value.slice(0, 500);
    else if (typeof value === "number" || typeof value === "boolean") out[key] = value;
    else if (Array.isArray(value)) {
      out[key] = value.slice(0, 20).map((entry) => {
        if (typeof entry === "string") return entry.slice(0, 200);
        if (typeof entry === "number" || typeof entry === "boolean") return entry;
        if (entry && typeof entry === "object" && typeof entry.id === "string") return { id: entry.id.slice(0, 80) };
        return String(entry).slice(0, 120);
      });
    } else if (value && typeof value === "object" && typeof value.id === "string") {
      out[key] = { id: String(value.id).slice(0, 80) };
    }
  }
  return Object.keys(out).length ? out : undefined;
}

export function createExecutionResult({
  status = "failed",
  code = EXECUTION_CODES.UNKNOWN_ERROR,
  message = "",
  stage = "execute",
  details = undefined,
  at = Date.now(),
} = {}) {
  const normalizedStatus = EXECUTION_STATUSES.includes(status) ? status : "failed";
  const normalizedStage = EXECUTION_STAGES.includes(stage) ? stage : "execute";
  const normalizedCode = String(code || EXECUTION_CODES.UNKNOWN_ERROR).slice(0, 80);
  const fallback = CODE_MESSAGES[normalizedCode] || CODE_MESSAGES[EXECUTION_CODES.UNKNOWN_ERROR];
  const human = String(message || fallback).replace(/\s+/g, " ").trim().slice(0, 800)
    || fallback;
  return {
    version: EXECUTION_RESULT_VERSION,
    status: normalizedStatus,
    code: normalizedCode,
    message: human,
    stage: normalizedStage,
    details: sanitizeDetails(details),
    at,
  };
}

export function inferExecutionCode(messageOrError, hint = {}) {
  const known = new Set(Object.values(EXECUTION_CODES));
  const direct = hint.code || messageOrError?.executionCode || messageOrError?.code;
  if (direct && known.has(String(direct))) return String(direct);
  const raw = hint.reason || messageOrError?.code || messageOrError?.name || "";
  const message = String(messageOrError?.message || messageOrError || raw || "");
  const blob = `${raw} ${message}`.toLowerCase();

  if (messageOrError?.name === "AbortError" || /\baborted\b|\babort(ed)?\b/.test(blob)) {
    return EXECUTION_CODES.ABORTED;
  }
  if (/missing-extension-id|extension id is not configured/.test(blob)) {
    return EXECUTION_CODES.MISSING_EXTENSION_ID;
  }
  if (/extension-unavailable|extension is not available/.test(blob)) {
    return EXECUTION_CODES.EXTENSION_UNAVAILABLE;
  }
  if (/extension-rejected/.test(blob)) return EXECUTION_CODES.EXTENSION_REJECTED;
  if (/invalid-token|handoff token/.test(blob)) return EXECUTION_CODES.INVALID_TOKEN;
  if (/gauntlet working memory is empty|empty.?gauntlet|wear at least one pearl/.test(blob)) {
    return EXECUTION_CODES.EMPTY_GAUNTLET;
  }
  if (/no page\/deck material|no material captured|select text on the page/.test(blob)) {
    return EXECUTION_CODES.NO_MATERIAL;
  }
  if (
    /needs credentials|model_gateway_unconfigured|gateway.?unconfigured|live model|requiresmodel|provider.*not configured|api key/i.test(blob)
  ) {
    return EXECUTION_CODES.NEEDS_CREDENTIALS;
  }
  if (/permission|not-allowed|service-not-allowed|denied|blocked until/.test(blob)) {
    return EXECUTION_CODES.PERMISSION_DENIED;
  }
  if (/fetch failed|network|timeout|gateway|econnrefused|failed to fetch/.test(blob)) {
    return EXECUTION_CODES.NETWORK_ERROR;
  }
  if (/plan\.|schema|supported workspace query|is not accepted|must be|unknown capability|invalid companion plan|referenceerror|is not defined/.test(blob)) {
    return EXECUTION_CODES.VALIDATION_ERROR;
  }
  if (/runtime is still starting|did not become ready|__lensorbruntime/.test(blob)) {
    return EXECUTION_CODES.RUNTIME_UNAVAILABLE;
  }
  if (/clarif|which .+ should|choose |name this|select a /.test(blob)) {
    return EXECUTION_CODES.NEEDS_CLARIFICATION;
  }
  if (/approval|plan rejected|waiting for your approval|preview/.test(blob) && /reject|waiting|approve/.test(blob)) {
    return EXECUTION_CODES.NEEDS_APPROVAL;
  }
  if (/cancelled|canceled|rejected\. the workspace/.test(blob)) return EXECUTION_CODES.CANCELLED;
  if (/unknown intent|could not map|no matching|i don't know how/.test(blob)) {
    return EXECUTION_CODES.UNKNOWN_INTENT;
  }
  if (/missing .+ arg|required argument|name this function/.test(blob)) {
    return EXECUTION_CODES.MISSING_ARGS;
  }
  if (
    /director|demonstration|cannot set properties of null \(setting 'status'\)|activetrace/i.test(blob)
  ) {
    return EXECUTION_CODES.DIRECTOR_FAILED;
  }
  return EXECUTION_CODES.UNKNOWN_ERROR;
}

const BLOCKED_CODES = new Set([
  EXECUTION_CODES.EMPTY_GAUNTLET,
  EXECUTION_CODES.NO_MATERIAL,
  EXECUTION_CODES.NEEDS_CREDENTIALS,
  EXECUTION_CODES.NEEDS_CLARIFICATION,
  EXECUTION_CODES.NEEDS_APPROVAL,
  EXECUTION_CODES.MISSING_ARGS,
  EXECUTION_CODES.MISSING_EXTENSION_ID,
  EXECUTION_CODES.EXTENSION_UNAVAILABLE,
  EXECUTION_CODES.UNKNOWN_INTENT,
  EXECUTION_CODES.PERMISSION_DENIED,
  EXECUTION_CODES.RUNTIME_UNAVAILABLE,
]);

export function mapErrorToExecutionResult(error, {
  status = undefined,
  stage = "execute",
  code = undefined,
  details = undefined,
  message = undefined,
} = {}) {
  const inferred = inferExecutionCode(error, { code });
  const safeMessage = message
    || (inferred !== EXECUTION_CODES.UNKNOWN_ERROR && CODE_MESSAGES[inferred]
      ? (String(error?.message || "").trim() && !/plan\.|referenceerror|is not defined|fetch failed|y is not defined/i.test(String(error?.message || ""))
        ? String(error.message).replace(/\s+/g, " ").trim().slice(0, 800)
        : CODE_MESSAGES[inferred])
      : null)
    || publicSafeMessage(error, inferred);

  const resolvedStatus = error?.name === "AbortError" || inferred === EXECUTION_CODES.ABORTED || inferred === EXECUTION_CODES.CANCELLED
    ? "cancelled"
    : status || (BLOCKED_CODES.has(inferred) ? "blocked" : "failed");

  return createExecutionResult({
    status: resolvedStatus,
    code: inferred,
    message: safeMessage,
    stage: error?.stage || stage,
    details: {
      ...(typeof error?.status === "number" ? { httpStatus: error.status } : {}),
      ...(error?.verb ? { verb: error.verb } : {}),
      ...sanitizeDetails(details),
      ...sanitizeDetails(error?.details),
    },
  });
}

function publicSafeMessage(error, code) {
  const message = String(error?.message || error || "");
  if (error?.name === "AbortError") return CODE_MESSAGES[EXECUTION_CODES.ABORTED];
  if (code && code !== EXECUTION_CODES.UNKNOWN_ERROR && CODE_MESSAGES[code]) {
    // Prefer exact product copy when the raw message is already user-safe.
    if (
      message
      && message.length < 400
      && !/plan\.|supported workspace query|referenceerror|is not defined|fetch failed|econnrefused|stack|at\s+\S+\s+\(/i.test(message)
    ) {
      return message.replace(/\s+/g, " ").trim();
    }
    return CODE_MESSAGES[code];
  }
  if (/fetch failed|network|timeout|gateway/i.test(message)) {
    return CODE_MESSAGES[EXECUTION_CODES.NETWORK_ERROR];
  }
  if (/plan\.|schema|supported workspace query|is not accepted|must be|unknown capability|invalid companion plan|referenceerror|is not defined/i.test(message)) {
    return CODE_MESSAGES[EXECUTION_CODES.VALIDATION_ERROR];
  }
  return CODE_MESSAGES[EXECUTION_CODES.UNKNOWN_ERROR];
}

/**
 * Normalize any companion/director return value into a structured execution result.
 */
export function normalizeCompanionCommandResult(result, error = null) {
  if (error) return mapErrorToExecutionResult(error);
  if (result?.execution && typeof result.execution === "object") {
    return createExecutionResult(result.execution);
  }
  if (result == null) {
    return createExecutionResult({
      status: "success",
      code: EXECUTION_CODES.OK,
      message: "Done.",
      stage: "execute",
    });
  }
  // Staged confirmation is success of the staging step — never "Blocked"/unknown-error.
  if (result.awaitingConfirmation) {
    return createExecutionResult({
      status: "success",
      code: result.code || "awaiting-confirmation",
      message: result.text || "Confirm in chat to continue. Nothing has been changed yet.",
      stage: result.stage || "approve",
      details: sanitizeDetails(result.details || { effects: result.effects }),
    });
  }
  if (result.completed === false) {
    return createExecutionResult({
      status: result.status === "cancelled" || result.cancelled ? "cancelled" : "failed",
      code: result.code || inferExecutionCode(result.text || result.error || result.failure),
      message: result.text || result.message || publicSafeMessage(result.error || result.failure, result.code),
      stage: result.stage || "execute",
      details: sanitizeDetails(result.details || { effects: result.effects }),
    });
  }
  if (result.visible && result.text) {
    const looksBlocked = result.completed !== true;
    const code = result.code || inferExecutionCode(result.text);
    const status = result.status
      || (result.completed === true ? "success" : looksBlocked ? (
        code === EXECUTION_CODES.CANCELLED || code === EXECUTION_CODES.ABORTED ? "cancelled" : "blocked"
      ) : "success");
    return createExecutionResult({
      status,
      code: result.completed === true ? (result.code || EXECUTION_CODES.OK) : code,
      message: result.text,
      stage: result.stage || "execute",
      details: sanitizeDetails(result.details || { effects: result.effects }),
    });
  }
  if (result.completed === true) {
    const effects = Array.isArray(result.effects) ? result.effects.filter(Boolean) : [];
    return createExecutionResult({
      status: "success",
      code: EXECUTION_CODES.OK,
      message: effects.length
        ? `Ran: ${effects.slice(0, 4).map((effect) => String(effect).replace(/-/g, " ")).join(", ")}.`
        : "Done.",
      stage: "execute",
      details: sanitizeDetails({ effects, verb: result.verb }),
    });
  }
  return createExecutionResult({
    status: "failed",
    code: EXECUTION_CODES.UNKNOWN_ERROR,
    message: CODE_MESSAGES[EXECUTION_CODES.UNKNOWN_ERROR],
    stage: "execute",
  });
}

export function formatExecutionChatMessage(execution) {
  const result = createExecutionResult(execution || {});
  if (result.status === "success") {
    return result.message || "Done.";
  }
  const label = result.status === "blocked"
    ? "Blocked"
    : result.status === "cancelled"
      ? "Cancelled"
      : "Failed";
  return `${label}: ${result.message} [${result.code}]`;
}

export function companionCommandReply(execution, extras = {}) {
  const result = createExecutionResult(execution);
  const isProblem = result.status === "blocked" || result.status === "failed" || result.status === "cancelled";
  return {
    completed: result.status === "success",
    visible: isProblem || Boolean(extras.forceVisible) || (result.status === "success" && Boolean(extras.confirmSuccess)),
    text: formatExecutionChatMessage(result),
    code: result.code,
    stage: result.stage,
    status: result.status,
    execution: result,
    ...extras,
  };
}

export function ensureExecutionOnReply(result) {
  if (result?.execution) return result;
  const execution = normalizeCompanionCommandResult(result);
  if (result == null) {
    return {
      completed: true,
      visible: false,
      text: execution.message,
      code: execution.code,
      status: "success",
      execution,
    };
  }
  return {
    ...result,
    completed: result.completed ?? execution.status === "success",
    code: result.code || execution.code,
    stage: result.stage || execution.stage,
    status: result.status || execution.status,
    execution,
  };
}

function storageRef(storage) {
  if (storage) return storage;
  try {
    return globalThis.sessionStorage;
  } catch {
    return null;
  }
}

export function loadExecutionEvents(storage = storageRef()) {
  try {
    const value = JSON.parse(storage?.getItem(EXECUTION_EVENTS_KEY) || "[]");
    return Array.isArray(value) ? value.slice(-MAX_EXECUTION_EVENTS) : [];
  } catch {
    return [];
  }
}

export function recordExecutionEvent(execution, storage = storageRef()) {
  const entry = createExecutionResult(execution);
  const next = [...loadExecutionEvents(storage), entry].slice(-MAX_EXECUTION_EVENTS);
  try {
    storage?.setItem(EXECUTION_EVENTS_KEY, JSON.stringify(next));
  } catch {
    /* sessionStorage may be unavailable (private mode / quota) */
  }
  return entry;
}

export function clearExecutionEvents(storage = storageRef()) {
  try {
    storage?.removeItem(EXECUTION_EVENTS_KEY);
  } catch {
    /* ignore */
  }
}

export function logExecutionResult(execution, { force = false } = {}) {
  const result = createExecutionResult(execution);
  const isDev = force
    || (typeof import.meta !== "undefined" && import.meta.env?.DEV)
    || (typeof process !== "undefined" && process.env?.NODE_ENV !== "production");
  if (!isDev && result.status === "success") return result;
  const payload = {
    status: result.status,
    code: result.code,
    message: result.message,
    stage: result.stage,
    details: result.details,
    at: result.at,
  };
  if (result.status === "failed" || result.status === "blocked") {
    console.error("[pearl:execution]", payload);
  } else if (result.status === "cancelled") {
    console.warn("[pearl:execution]", payload);
  } else if (isDev) {
    console.info("[pearl:execution]", payload);
  }
  return result;
}

export function recordAndLogExecution(execution, storage = storageRef()) {
  const entry = recordExecutionEvent(execution, storage);
  logExecutionResult(entry);
  return entry;
}

/** Build a crash digest for error boundaries (dev shows stack snippet). */
export function formatCrashDiagnostic(error, { isDev = false, stackLimit = 600 } = {}) {
  const message = String(error?.message || error || "Unknown render error").slice(0, 400);
  const stack = String(error?.stack || "").slice(0, stackLimit);
  const digest = error?.digest
    || (typeof crypto !== "undefined" && crypto.subtle == null
      ? `e${Date.now().toString(36)}`
      : `e${Math.abs(hashString(message + stack.slice(0, 80))).toString(36)}`);
  return {
    message,
    digest: String(digest).slice(0, 48),
    stackSnippet: isDev && stack ? stack : null,
  };
}

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i);
    hash |= 0;
  }
  return hash || 1;
}

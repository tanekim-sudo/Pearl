/**
 * Director — scripted demonstration engine for the companion.
 *
 * Verbs run REAL app actions (registered by App via registerDirectorVerbs)
 * while a ghost cursor overlay shows the exact gesture a user would make.
 * Scripts are sequential async steps; any real pointer input aborts.
 */
import {
  COMPANION_CAPABILITIES,
  COMPANION_DIRECTOR_ARG_METADATA,
} from "./companion-capabilities.js";
import { validateCapabilityArgs } from "./companion-plan.js";

const listeners = new Set();
export const DIRECTOR_EFFECT_TRACE_VERSION = 1;
const MAX_COMPLETED_TRACES = 100;
const completedTraces = [];
const completedDirectEffects = [];
let activeTrace = null;
let activeStep = null;

const state = {
  running: false,
  scriptTitle: null,
  caption: null,
  abortRequested: false,
  speed: 1,
  cursor: {
    x: typeof window !== "undefined" ? window.innerWidth / 2 : 0,
    y: typeof window !== "undefined" ? window.innerHeight / 2 : 0,
    visible: false,
    pressed: false,
    dragLabel: null,
    pulse: 0,
  },
};

function snapshot() {
  return { ...state, cursor: { ...state.cursor } };
}

function emit() {
  const snap = snapshot();
  for (const l of listeners) l(snap);
}

function reducedMotionRequested() {
  return Boolean(globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
}

function traceEvent(type, detail = {}) {
  if (!activeTrace) return;
  const event = {
    sequence: activeTrace.events.length,
    elapsedMs: Math.max(0, Math.round(performance.now() - activeTrace.startedAtMonotonic)),
    type,
    capability: activeStep?.capability || null,
    stepId: activeStep?.id || null,
    ...detail,
  };
  activeTrace.events.push(event);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("lens:director-effect-trace", {
      detail: {
        version: DIRECTOR_EFFECT_TRACE_VERSION,
        traceId: activeTrace.id,
        event,
      },
    }));
  }
}

function publicTrace(trace) {
  if (!trace) return null;
  const { startedAtMonotonic, ...value } = trace;
  return structuredClone(value);
}

export function getDirectorEffectTraces() {
  return {
    active: publicTrace(activeTrace),
    completed: completedTraces.map(publicTrace),
  };
}

export function clearDirectorEffectTraces() {
  completedTraces.length = 0;
  if (!state.running) activeTrace = null;
}

export function getDirectCapabilityEffects() {
  return completedDirectEffects.map((entry) => structuredClone(entry));
}

export function clearDirectCapabilityEffects() {
  completedDirectEffects.length = 0;
}

export function subscribeDirector(fn) {
  listeners.add(fn);
  fn(snapshot());
  return () => listeners.delete(fn);
}

export function directorRunning() {
  return state.running;
}

let verbs = {};
let activeAbortController = null;
const capabilityByName = new Map(
  COMPANION_CAPABILITIES.filter((entry) => entry.platform === "app").map((entry) => [entry.name, entry])
);

export function registerDirectorVerbs(map) {
  verbs = { ...verbs, ...map };
}

export function listDirectorVerbs() {
  return Object.keys(verbs);
}

export function resolveDirectorCapabilities(names = []) {
  const requested = [...new Set(names.filter(Boolean))];
  return {
    available: requested.filter((name) => typeof verbs[name] === "function"),
    missing: requested.filter((name) => typeof verbs[name] !== "function"),
  };
}

// ---- motion primitives ----

function easeInOut(t) {
  return t * t * (3 - 2 * t);
}

export function directorWait(ms) {
  // Visual beats stay readable but never turn a walkthrough into a slideshow.
  // Callers that poll asynchronous work invoke multiple short waits.
  const scaled = Math.min(420, Math.max(0, ms || 0)) / (state.speed || 1);
  return new Promise((resolve) => {
    const start = performance.now();
    function tick(now) {
      if (state.abortRequested || now - start >= scaled) return resolve();
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

export function cursorJumpTo(x, y) {
  const from = { x: state.cursor.x, y: state.cursor.y };
  state.cursor.x = x;
  state.cursor.y = y;
  state.cursor.visible = true;
  traceEvent("cursor-jump", { from, to: { x, y } });
  emit();
}

export function cursorMoveTo(x, y, ms = 340) {
  const from = { x: state.cursor.x, y: state.cursor.y };
  const dist = Math.hypot(x - from.x, y - from.y);
  if (reducedMotionRequested()) {
    state.cursor.x = x;
    state.cursor.y = y;
    state.cursor.visible = true;
    traceEvent("cursor-move", {
      from,
      to: { x, y },
      durationMs: 0,
      reducedMotion: true,
    });
    emit();
    return Promise.resolve();
  }
  const duration = Math.max(140, Math.min(360, ms, 140 + dist * 0.32)) / (state.speed || 1);
  state.cursor.visible = true;
  traceEvent("cursor-move-start", { from, to: { x, y }, durationMs: Math.round(duration) });
  emit();
  return new Promise((resolve) => {
    const start = performance.now();
    function frame(now) {
      if (state.abortRequested) return resolve();
      const t = Math.min(1, (now - start) / duration);
      const k = easeInOut(t);
      state.cursor.x = from.x + (x - from.x) * k;
      state.cursor.y = from.y + (y - from.y) * k;
      emit();
      if (t < 1) requestAnimationFrame(frame);
      else {
        traceEvent("cursor-move-complete", { from, to: { x, y } });
        resolve();
      }
    }
    requestAnimationFrame(frame);
  });
}

export async function cursorPress(dragLabel = null) {
  state.cursor.pressed = true;
  state.cursor.dragLabel = dragLabel;
  state.cursor.pulse += 1;
  traceEvent("gesture-press", {
    at: { x: state.cursor.x, y: state.cursor.y },
    dragLabel,
  });
  emit();
  await directorWait(70);
}

export async function cursorRelease() {
  state.cursor.pressed = false;
  state.cursor.dragLabel = null;
  state.cursor.pulse += 1;
  traceEvent("gesture-release", { at: { x: state.cursor.x, y: state.cursor.y } });
  emit();
  await directorWait(70);
}

export async function cursorClick(x, y, ms) {
  await cursorMoveTo(x, y, ms);
  await cursorPress();
  await cursorRelease();
}

export function setDirectorCaption(text) {
  state.caption = text || null;
  traceEvent("caption", { text: state.caption });
  emit();
}

export function setDirectorSpeed(speed) {
  state.speed = Math.max(0.25, Math.min(3, speed || 1));
  emit();
}

const LEGACY_SEMANTIC_ANCHORS = Object.freeze({
  "scene-stage": '[data-semantic-anchor="scene-stage"], [data-tour="paper-canvas"]',
  "scene-object": "[data-item-id], [data-node-id]",
  "primary-orb": '[data-semantic-anchor="primary-orb"]',
  "library-moves": '[data-semantic-anchor="library-moves"], .move-quick-add',
  "library-functions": '[data-semantic-anchor="library-functions"], [data-tour="transformations-section"]',
  "library-lenses": '[data-semantic-anchor="library-lenses"], [data-tour="lenses-section"]',
});

export function resolveSemanticAnchor(anchor, root = document) {
  if (!anchor) return null;
  if (typeof anchor !== "string") return anchor;
  const id = anchor.startsWith("anchor:") ? anchor.slice(7) : anchor;
  const selector = LEGACY_SEMANTIC_ANCHORS[id] || `[data-semantic-anchor="${CSS.escape(id)}"]`;
  return root.querySelector(selector);
}

/** Center of a semantic anchor or DOM element (scrolled into view first), or null. */
export function elementCenter(selector, { scroll = true } = {}) {
  const el = typeof selector === "string"
    ? (selector.startsWith("anchor:") ? resolveSemanticAnchor(selector) : document.querySelector(selector))
    : selector;
  if (!el) return null;
  if (scroll) el.scrollIntoView({ block: "nearest", behavior: "auto" });
  const r = el.getBoundingClientRect();
  if (!r.width && !r.height) return null;
  const geometry = {
    x: r.left + r.width / 2,
    y: r.top + r.height / 2,
    rect: {
      x: r.x,
      y: r.y,
      top: r.top,
      right: r.right,
      bottom: r.bottom,
      left: r.left,
      width: r.width,
      height: r.height,
    },
  };
  traceEvent("target-resolved", {
    target: typeof selector === "string"
      ? selector
      : el.id || el.dataset?.itemId || el.dataset?.nodeId || el.getAttribute?.("data-testid") || el.tagName,
    geometry,
  });
  return geometry;
}

/**
 * Resolve a director target into client coordinates.
 * Accepts (x, y), { x, y }, a DOM element, or a selector / anchor: string.
 */
export function resolveDirectorPoint(xOrTarget, y) {
  if (typeof xOrTarget === "number" && typeof y === "number" && Number.isFinite(xOrTarget) && Number.isFinite(y)) {
    return { x: xOrTarget, y };
  }
  if (xOrTarget && typeof xOrTarget === "object") {
    if (typeof xOrTarget.x === "number" && typeof xOrTarget.y === "number"
      && Number.isFinite(xOrTarget.x) && Number.isFinite(xOrTarget.y)) {
      return { x: xOrTarget.x, y: xOrTarget.y };
    }
    if (typeof xOrTarget.getBoundingClientRect === "function") {
      const center = elementCenter(xOrTarget);
      return center ? { x: center.x, y: center.y } : null;
    }
  }
  if (typeof xOrTarget === "string") {
    const center = elementCenter(xOrTarget);
    return center ? { x: center.x, y: center.y } : null;
  }
  return null;
}

function resolveMoveDuration(xOrTarget, y, ms) {
  if (typeof xOrTarget === "number") return ms;
  if (typeof y === "number") return y;
  return ms;
}

async function toolkitMoveTo(xOrTarget, y, ms) {
  const point = resolveDirectorPoint(xOrTarget, y);
  if (!point) return;
  return cursorMoveTo(point.x, point.y, resolveMoveDuration(xOrTarget, y, ms));
}

function toolkitJumpTo(xOrTarget, y) {
  const point = resolveDirectorPoint(xOrTarget, y);
  if (!point) return;
  cursorJumpTo(point.x, point.y);
}

async function toolkitClick(xOrTarget, y, ms) {
  const point = resolveDirectorPoint(xOrTarget, y);
  if (!point) return;
  return cursorClick(point.x, point.y, resolveMoveDuration(xOrTarget, y, ms));
}

// ---- script runner ----

const toolkit = {
  moveTo: toolkitMoveTo,
  jumpTo: toolkitJumpTo,
  press: cursorPress,
  release: cursorRelease,
  click: toolkitClick,
  caption: setDirectorCaption,
  wait: directorWait,
  elementCenter,
  isAborted: () => state.abortRequested,
  get signal() {
    return activeAbortController?.signal || null;
  },
};

function resolveActiveSceneId() {
  try {
    const parsed = JSON.parse(globalThis.localStorage?.getItem?.("lens.scenes.v4") || "null");
    return parsed?.activeSceneId || parsed?.scenes?.[0]?.id || null;
  } catch {
    return null;
  }
}

/**
 * Fill required sceneId from the active Scene when planners/UI omit it.
 * Handlers already default to the live scene; schema validation must not
 * block that before the verb runs.
 */
export function enrichDirectorArgs(verb, suppliedArgs = {}) {
  const next = { ...(suppliedArgs || {}) };
  const capability = capabilityByName.get(verb);
  const schema = capability?.args || {};
  const sceneRequired = typeof schema.sceneId === "string"
    && schema.sceneId.startsWith("string")
    && !schema.sceneId.endsWith("?");
  if (sceneRequired && (next.sceneId == null || next.sceneId === "")) {
    const sceneId = resolveActiveSceneId();
    if (sceneId) next.sceneId = sceneId;
  }
  return next;
}

function validateDirectorArgs(verb, suppliedArgs) {
  const capability = capabilityByName.get(verb);
  if (!capability) return null;
  const enriched = enrichDirectorArgs(verb, suppliedArgs);
  const capabilityArgs = {};
  const metadataArgs = {};
  for (const [key, value] of Object.entries(enriched || {})) {
    if (key in COMPANION_DIRECTOR_ARG_METADATA) metadataArgs[key] = value;
    else capabilityArgs[key] = value;
  }
  validateCapabilityArgs(capability, capabilityArgs, `director.${verb}.args`);
  validateCapabilityArgs(
    { name: `${verb} director metadata`, args: COMPANION_DIRECTOR_ARG_METADATA },
    metadataArgs,
    `director.${verb}.metadata`
  );
  return { capability, args: enriched };
}

function createDirectToolkit(signal) {
  const wait = (ms = 0) => new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const timeout = setTimeout(resolve, Math.min(420, Math.max(0, Number(ms) || 0)));
    signal?.addEventListener("abort", () => {
      clearTimeout(timeout);
      reject(new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });
  return {
    moveTo: async () => {},
    jumpTo: () => {},
    press: async () => {},
    release: async () => {},
    click: async () => {},
    caption: () => {},
    wait,
    elementCenter,
    isAborted: () => signal?.aborted === true,
    signal,
  };
}

export async function executeCapabilityDirect(verb, args = {}, options = {}) {
  const fn = verbs[verb];
  if (typeof fn !== "function") throw new Error(`unavailable capability: ${verb}`);
  const validated = validateDirectorArgs(verb, args);
  const capability = validated?.capability || null;
  const effectiveArgs = validated?.args || args;
  const startedAt = new Date().toISOString();
  try {
    const result = await fn(effectiveArgs, createDirectToolkit(options.signal), options.context || { vars: {} });
    const resultType = capability?.resultType || "action-result";
    const value = result && typeof result === "object" && !Array.isArray(result)
      ? { type: resultType, ...result }
      : { type: resultType, capability: verb, status: "completed", ...(result == null ? {} : { value: result }) };
    const effect = {
      id: globalThis.crypto?.randomUUID?.() || `direct-${Date.now()}`,
      capability: verb,
      status: "completed",
      startedAt,
      completedAt: new Date().toISOString(),
      resultType,
      effects: value.effects || [],
    };
    completedDirectEffects.push(effect);
    if (completedDirectEffects.length > MAX_COMPLETED_TRACES) completedDirectEffects.splice(0, completedDirectEffects.length - MAX_COMPLETED_TRACES);
    globalThis.dispatchEvent?.(new CustomEvent("lens:capability-direct-effect", { detail: structuredClone(effect) }));
    return value;
  } catch (error) {
    completedDirectEffects.push({
      id: globalThis.crypto?.randomUUID?.() || `direct-${Date.now()}`,
      capability: verb,
      status: options.signal?.aborted ? "cancelled" : "failed",
      startedAt,
      completedAt: new Date().toISOString(),
      resultType: capability?.resultType || "action-result",
      error: error.message,
      effects: [],
    });
    throw error;
  }
}

export async function executeCapabilityScriptDirect(steps, options = {}) {
  if (!Array.isArray(steps) || !steps.length) return { completed: false, error: "empty script", errors: ["empty script"], results: [] };
  const context = { vars: {} };
  const results = [];
  try {
    for (const step of steps) {
      if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      results.push(await executeCapabilityDirect(step.verb, step.args || {}, { ...options, context }));
    }
    return { completed: true, errors: [], results, value: results.at(-1) };
  } catch (error) {
    return { completed: false, aborted: error.name === "AbortError", error: error.message, errors: [error.message], results, value: results.at(-1) };
  }
}

/**
 * Run sequential director steps against the current cursor/toolkit.
 * Used by top-level demos and by re-entrant verbs that play a sub-script
 * (playPearlCapabilityDemo / demonstratePearlPowers) without nesting a second
 * director session — nesting previously nulled `activeTrace` and crashed with
 * "Cannot set properties of null (setting 'status')" → [unknown-error].
 */
async function executeDirectorStepLoop(steps, { ctx, signal } = {}) {
  const errors = [];
  const results = [];
  let consecutiveFailures = 0;
  const parentStep = activeStep;
  try {
    for (const step of steps) {
      if (state.abortRequested || signal?.aborted) break;
      const fn = verbs[step.verb];
      activeStep = { capability: step.verb, id: step.id || null };
      traceEvent("step-start", {
        args: structuredClone(step.args || {}),
        initialCursor: { x: state.cursor.x, y: state.cursor.y },
      });
      try {
        const validated = validateDirectorArgs(step.verb, step.args || {});
        const capability = validated?.capability || null;
        const suppliedArgs = validated?.args || step.args || {};
        const result = await fn(suppliedArgs, toolkit, ctx);
        const resultType = capability?.resultType || "action-result";
        results.push(
          result && typeof result === "object" && !Array.isArray(result)
            ? { type: resultType, ...result }
            : {
                type: resultType,
                capability: step.verb,
                status: "completed",
                ...(result == null ? {} : { value: result }),
              }
        );
        traceEvent("step-complete", {
          resultType,
          finalCursor: { x: state.cursor.x, y: state.cursor.y },
        });
        consecutiveFailures = 0;
      } catch (err) {
        // One broken step shouldn't kill a long demonstration — note it,
        // let the viewer read the note, and carry on with the rest.
        const msg = err?.message || String(err);
        errors.push(msg);
        traceEvent("step-failed", { error: msg });
        consecutiveFailures += 1;
        setDirectorCaption(`skipping a step (${msg}) — continuing…`);
        await directorWait(1400);
        if (consecutiveFailures >= 3) {
          setDirectorCaption("too many steps failed in a row — stopping here");
          await directorWait(1400);
          break;
        }
      }
    }
  } finally {
    activeStep = parentStep;
  }
  const aborted = state.abortRequested || signal?.aborted === true;
  return {
    completed: !aborted && !errors.length,
    aborted,
    errors,
    results,
    value: results[results.length - 1],
    effects: results.flatMap((result) => (Array.isArray(result?.effects) ? result.effects : [])),
  };
}

export async function runDirectorScript(steps, opts = {}) {
  if (!Array.isArray(steps) || !steps.length) return { completed: false, error: "empty script" };
  const resolution = resolveDirectorCapabilities(steps.map((step) => step?.verb));
  if (resolution.missing.length) {
    const error = `unavailable capability: ${resolution.missing.join(", ")}`;
    return { completed: false, error, errors: [error], missing: resolution.missing };
  }
  if (opts.signal?.aborted) {
    return { completed: false, aborted: true, error: "Aborted", errors: ["Aborted"] };
  }
  // Re-entrant: a verb mid-demo calls runDirectorScript for a sub-tour.
  // Inline under the parent session — never stopDirector / replace activeTrace.
  if (state.running && activeStep && activeTrace) {
    if (opts.title) state.scriptTitle = opts.title;
    if (opts.speed != null) state.speed = Math.max(0.25, Math.min(3, opts.speed));
    const nestedCtx = { vars: { ...(opts.vars || {}) } };
    return executeDirectorStepLoop(steps, { ctx: nestedCtx, signal: opts.signal });
  }
  if (state.running) {
    stopDirector();
    await directorWait(80);
  }
  const previousSpeed = state.speed;
  state.speed = Math.max(0.25, Math.min(3, opts.speed ?? 1.35));
  state.running = true;
  state.abortRequested = false;
  activeAbortController = new AbortController();
  const onExternalAbort = () => stopDirector();
  opts.signal?.addEventListener?.("abort", onExternalAbort, { once: true });
  const startedAt = new Date().toISOString();
  const trace = {
    version: DIRECTOR_EFFECT_TRACE_VERSION,
    id: globalThis.crypto?.randomUUID?.() || `director-${Date.now()}`,
    title: opts.title || null,
    status: "running",
    startedAt,
    startedAtMonotonic: performance.now(),
    completedAt: null,
    reducedMotion: reducedMotionRequested(),
    viewport: {
      width: typeof window !== "undefined" ? window.innerWidth : null,
      height: typeof window !== "undefined" ? window.innerHeight : null,
    },
    expectedCapabilities: steps.map((step) => step?.verb).filter(Boolean),
    events: [],
  };
  activeTrace = trace;
  traceEvent("run-start", { stepCount: steps.length });
  state.scriptTitle = opts.title || null;
  state.cursor.visible = true;
  emit();
  document.body.classList.add("director-running");
  // Give the companion panel one short beat to tuck into the corner before
  // the cursor reaches its first target.
  await directorWait(320);
  const ctx = { vars: { ...(opts.vars || {}) } };
  let loopResult = {
    completed: false,
    aborted: false,
    errors: [],
    results: [],
    value: undefined,
    effects: [],
  };
  try {
    loopResult = await executeDirectorStepLoop(steps, { ctx, signal: opts.signal });
  } finally {
    opts.signal?.removeEventListener?.("abort", onExternalAbort);
    const aborted = loopResult.aborted || state.abortRequested || opts.signal?.aborted === true;
    const errors = loopResult.errors || [];
    // Capture the trace we own — nested runs must not null it out from under us.
    const owned = activeTrace === trace ? trace : activeTrace;
    if (owned) {
      traceEvent("run-complete", {
        status: aborted ? "cancelled" : errors.length ? "failed" : "completed",
        resultTypes: (loopResult.results || []).map((result) => result.type),
        errorCount: errors.length,
      });
      owned.status = aborted ? "cancelled" : errors.length ? "failed" : "completed";
      owned.completedAt = new Date().toISOString();
      completedTraces.push(owned);
      if (completedTraces.length > MAX_COMPLETED_TRACES) {
        completedTraces.splice(0, completedTraces.length - MAX_COMPLETED_TRACES);
      }
    }
    if (activeTrace === trace || activeTrace === owned) activeTrace = null;
    activeStep = null;
    state.running = false;
    state.scriptTitle = null;
    state.caption = null;
    state.cursor.visible = false;
    state.cursor.pressed = false;
    state.cursor.dragLabel = null;
    state.abortRequested = false;
    activeAbortController = null;
    state.speed = previousSpeed;
    document.body.classList.remove("director-running");
    emit();
    opts.onDone?.({
      completed: !aborted && !errors.length,
      aborted,
      errors,
    });
    loopResult = {
      ...loopResult,
      completed: !aborted && !errors.length,
      aborted,
      errors,
    };
  }
  return {
    completed: loopResult.completed,
    aborted: loopResult.aborted,
    errors: loopResult.errors,
    results: loopResult.results,
    value: loopResult.value,
    effects: loopResult.effects,
  };
}

export function stopDirector() {
  if (!state.running) return;
  state.abortRequested = true;
  activeAbortController?.abort();
  emit();
}

// Production-safe probe for headed audits: prove ghost-cursor motion ran.
// Full run/stop verb control stays DEV-only so demos cannot be hijacked in prod.
if (typeof window !== "undefined") {
  window.__lensDirectorProbe = {
    running: directorRunning,
    subscribe: subscribeDirector,
    traces: getDirectorEffectTraces,
    clearTraces: clearDirectorEffectTraces,
  };
  if (import.meta.env?.DEV) {
    window.__lensDirector = {
      run: runDirectorScript,
      stop: stopDirector,
      verbs: listDirectorVerbs,
      traces: getDirectorEffectTraces,
      clearTraces: clearDirectorEffectTraces,
      directEffects: getDirectCapabilityEffects,
      clearDirectEffects: clearDirectCapabilityEffects,
      probe: window.__lensDirectorProbe,
    };
  }
}

/**
 * Director — scripted demonstration engine for the companion.
 *
 * Verbs run REAL app actions (registered by App via registerDirectorVerbs)
 * while a ghost cursor overlay shows the exact gesture a user would make.
 * Scripts are sequential async steps; any real pointer input aborts.
 */

const listeners = new Set();

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
  state.cursor.x = x;
  state.cursor.y = y;
  state.cursor.visible = true;
  emit();
}

export function cursorMoveTo(x, y, ms = 340) {
  const from = { x: state.cursor.x, y: state.cursor.y };
  const dist = Math.hypot(x - from.x, y - from.y);
  const duration = Math.max(140, Math.min(360, ms, 140 + dist * 0.32)) / (state.speed || 1);
  state.cursor.visible = true;
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
      else resolve();
    }
    requestAnimationFrame(frame);
  });
}

export async function cursorPress(dragLabel = null) {
  state.cursor.pressed = true;
  state.cursor.dragLabel = dragLabel;
  state.cursor.pulse += 1;
  emit();
  await directorWait(70);
}

export async function cursorRelease() {
  state.cursor.pressed = false;
  state.cursor.dragLabel = null;
  state.cursor.pulse += 1;
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
  emit();
}

export function setDirectorSpeed(speed) {
  state.speed = Math.max(0.25, Math.min(3, speed || 1));
  emit();
}

/** Center of a DOM element (scrolled into view first), or null. */
export function elementCenter(selector, { scroll = true } = {}) {
  const el = typeof selector === "string" ? document.querySelector(selector) : selector;
  if (!el) return null;
  if (scroll) el.scrollIntoView({ block: "nearest", behavior: "auto" });
  const r = el.getBoundingClientRect();
  if (!r.width && !r.height) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, rect: r };
}

// ---- script runner ----

const toolkit = {
  moveTo: cursorMoveTo,
  jumpTo: cursorJumpTo,
  press: cursorPress,
  release: cursorRelease,
  click: cursorClick,
  caption: setDirectorCaption,
  wait: directorWait,
  elementCenter,
  isAborted: () => state.abortRequested,
  get signal() {
    return activeAbortController?.signal || null;
  },
};

export async function runDirectorScript(steps, opts = {}) {
  if (!Array.isArray(steps) || !steps.length) return { completed: false, error: "empty script" };
  const resolution = resolveDirectorCapabilities(steps.map((step) => step?.verb));
  if (resolution.missing.length) {
    const error = `unavailable capability: ${resolution.missing.join(", ")}`;
    return { completed: false, error, errors: [error], missing: resolution.missing };
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
  state.scriptTitle = opts.title || null;
  state.cursor.visible = true;
  emit();
  document.body.classList.add("director-running");
  // Give the companion panel one short beat to tuck into the corner before
  // the cursor reaches its first target.
  await directorWait(320);
  const ctx = { vars: {} };
  const errors = [];
  const results = [];
  let consecutiveFailures = 0;
  try {
    for (const step of steps) {
      if (state.abortRequested) break;
      const fn = verbs[step.verb];
      try {
        const result = await fn(step.args || {}, toolkit, ctx);
        results.push(result);
        consecutiveFailures = 0;
      } catch (err) {
        // One broken step shouldn't kill a long demonstration — note it,
        // let the viewer read the note, and carry on with the rest.
        const msg = err?.message || String(err);
        errors.push(msg);
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
    const aborted = state.abortRequested;
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
    opts.onDone?.({ completed: !aborted && !errors.length, aborted, errors });
  }
  return { completed: !errors.length, errors, results, value: results[results.length - 1] };
}

export function stopDirector() {
  if (!state.running) return;
  state.abortRequested = true;
  activeAbortController?.abort();
  emit();
}

// Dev-only hook so automated audits can exercise director verbs end to end.
if (typeof window !== "undefined" && import.meta.env?.DEV) {
  window.__lensDirector = { run: runDirectorScript, stop: stopDirector, verbs: listDirectorVerbs };
}

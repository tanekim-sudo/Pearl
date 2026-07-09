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

export function registerDirectorVerbs(map) {
  verbs = { ...verbs, ...map };
}

export function listDirectorVerbs() {
  return Object.keys(verbs);
}

// ---- motion primitives ----

function easeInOut(t) {
  return t * t * (3 - 2 * t);
}

export function directorWait(ms) {
  const scaled = ms / (state.speed || 1);
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

export function cursorMoveTo(x, y, ms = 650) {
  const from = { x: state.cursor.x, y: state.cursor.y };
  const dist = Math.hypot(x - from.x, y - from.y);
  const duration = Math.max(220, Math.min(ms, 220 + dist * 0.9)) / (state.speed || 1);
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
  await directorWait(180);
}

export async function cursorRelease() {
  state.cursor.pressed = false;
  state.cursor.dragLabel = null;
  state.cursor.pulse += 1;
  emit();
  await directorWait(160);
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
};

export async function runDirectorScript(steps, opts = {}) {
  if (!Array.isArray(steps) || !steps.length) return { completed: false, error: "empty script" };
  if (state.running) {
    stopDirector();
    await directorWait(80);
  }
  state.running = true;
  state.abortRequested = false;
  state.scriptTitle = opts.title || null;
  state.cursor.visible = true;
  emit();
  document.body.classList.add("director-running");
  const ctx = { vars: {} };
  let error = null;
  try {
    for (const step of steps) {
      if (state.abortRequested) break;
      const fn = verbs[step.verb];
      if (!fn) continue;
      try {
        await fn(step.args || {}, toolkit, ctx);
      } catch (err) {
        error = err?.message || String(err);
        setDirectorCaption(`something went wrong: ${error}`);
        await directorWait(1600);
        break;
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
    document.body.classList.remove("director-running");
    emit();
    opts.onDone?.({ completed: !aborted && !error, aborted, error });
  }
  return { completed: !error, error };
}

export function stopDirector() {
  if (!state.running) return;
  state.abortRequested = true;
  emit();
}

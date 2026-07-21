export const PEARL_GESTURE_VERSION = 1;
export const PEARL_GESTURE_DEFAULTS = Object.freeze({
  sequenceMs: 420,
  movementPx: 8,
  holdMs: 520,
});

export function createPearlGestureArbiter(handlers = {}, options = {}) {
  const config = { ...PEARL_GESTURE_DEFAULTS, ...options };
  let count = 0;
  let lastAt = 0;
  let origin = null;
  let pendingTimer = null;
  let held = false;

  function clearPending() {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }

  function reset() {
    clearPending();
    count = 0;
    lastAt = 0;
    origin = null;
    held = false;
  }

  function moved(point) {
    return origin && Math.hypot((point.x || 0) - origin.x, (point.y || 0) - origin.y) > config.movementPx;
  }

  function release(input = {}) {
    const at = Number(input.at) || Date.now();
    const point = { x: Number(input.x) || 0, y: Number(input.y) || 0 };
    if (input.dragged || input.held || held || moved(point)) {
      reset();
      return { type: input.dragged || moved(point) ? "drag" : "hold", consumed: false };
    }
    if (!lastAt || at - lastAt > config.sequenceMs) {
      count = 0;
      origin = point;
    }
    count += 1;
    lastAt = at;
    clearPending();
    if (count === 1) {
      const result = handlers.onSingle?.(input);
      pendingTimer = setTimeout(reset, config.sequenceMs);
      return { type: "single", consumed: true, result };
    }
    if (count === 3) {
      const result = handlers.onTriple?.(input);
      reset();
      return { type: "triple", consumed: true, result };
    }
    pendingTimer = setTimeout(reset, config.sequenceMs);
    return { type: "pending-triple", consumed: true };
  }

  function hold(input = {}) {
    held = true;
    clearPending();
    count = 0;
    handlers.onHold?.(input);
    return { type: "hold", consumed: true };
  }

  function keyboard(input = {}) {
    if ((input.key === "Enter" && input.shiftKey) || input.command === "open-pearl-studio") {
      const result = handlers.onTriple?.({ ...input, accessible: true });
      reset();
      return { type: "accessible-open", consumed: true, result };
    }
    return { type: "keyboard-pass-through", consumed: false };
  }

  return { release, hold, keyboard, reset, get pendingCount() { return count; } };
}

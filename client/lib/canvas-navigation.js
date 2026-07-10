import { zoomAtPoint } from "./paper.js";

/** Mac trackpad pinch sets ctrlKey; ctrl/meta + wheel zooms toward the cursor. */
export function isWheelZoomGesture(e) {
  return e.ctrlKey || e.metaKey;
}

/** Two-finger scroll / plain wheel → pan by pixel delta. */
export function wheelPanDelta(e) {
  return { dx: -e.deltaX, dy: -e.deltaY };
}

/** Smooth exponential zoom factor from vertical wheel delta. */
export function wheelZoomFactor(e, sensitivity = 0.0032) {
  return Math.exp(-e.deltaY * sensitivity);
}

/**
 * Unified wheel navigation: pinch / ctrl+scroll zooms at cursor; plain scroll pans.
 * @param {(scale: number) => number} [clampScaleFn] zoom bounds — the effective
 *   scale is clamped BEFORE deriving the translation, so zooming at the clamp
 *   is a true no-op (no sideways drift from an unclamped anchor delta).
 * @returns {object|null} next camera, or null when unchanged
 */
export function applyWheelToCamera(e, camera, localX, localY, clampScaleFn = null) {
  if (isWheelZoomGesture(e)) {
    let factor = wheelZoomFactor(e);
    if (clampScaleFn) {
      const target = clampScaleFn(camera.scale * factor);
      if (Math.abs(target - camera.scale) < 1e-9) return null;
      factor = target / camera.scale;
    }
    return zoomAtPoint(camera, localX, localY, factor);
  }
  const { dx, dy } = wheelPanDelta(e);
  if (!dx && !dy) return null;
  return { ...camera, x: camera.x + dx, y: camera.y + dy };
}

/** Minimum pointer movement before object drag/clone activates. */
export const PAN_DRAG_THRESHOLD = 8;

const WHEEL_IDLE_MS = 140;

/**
 * Attach non-passive wheel handler for canvas pan/zoom.
 * @param {HTMLElement} el
 * @param {() => object} getCamera
 * @param {(next: object) => void} setCamera
 * @param {(e: WheelEvent) => { x: number, y: number }} getLocalPoint
 * @param {(prev: object, next: object, e: WheelEvent) => void} [onAfterZoom]
 * @param {{ onWheelActive?: () => void, onWheelIdle?: () => void, clampScale?: (scale: number) => number }} [opts]
 */
export function attachCanvasWheel(el, getCamera, setCamera, getLocalPoint, onAfterZoom, opts = {}) {
  let wheelEndTimer = null;

  function onWheel(e) {
    e.preventDefault();
    opts.onWheelActive?.();
    if (wheelEndTimer) clearTimeout(wheelEndTimer);
    wheelEndTimer = setTimeout(() => {
      wheelEndTimer = null;
      opts.onWheelIdle?.();
    }, WHEEL_IDLE_MS);

    const camera = getCamera();
    const local = getLocalPoint(e);
    const prevScale = camera.scale;
    const next = applyWheelToCamera(e, camera, local.x, local.y, opts.clampScale || null);
    if (!next) return;
    setCamera(next);
    if (isWheelZoomGesture(e) && next.scale !== prevScale) {
      onAfterZoom?.(camera, next, e);
    }
  }

  el.addEventListener("wheel", onWheel, { passive: false });
  return () => {
    if (wheelEndTimer) clearTimeout(wheelEndTimer);
    el.removeEventListener("wheel", onWheel);
  };
}

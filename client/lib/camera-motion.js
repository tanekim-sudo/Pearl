/** Shared easing + rAF camera interpolation for paper and AI viewports. */

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Animate a camera state { x, y, scale } with cancel support.
 * @returns {() => void} cancel
 */
export function animateCameraState(from, to, { duration = 420, ease = easeInOutCubic, onUpdate, onDone } = {}) {
  let raf = 0;
  const t0 = performance.now();

  function tick(now) {
    const t = Math.min(1, (now - t0) / duration);
    const k = ease(t);
    onUpdate?.({
      x: lerp(from.x, to.x, k),
      y: lerp(from.y, to.y, k),
      scale: lerp(from.scale, to.scale, k),
    });
    if (t < 1) raf = requestAnimationFrame(tick);
    else onDone?.();
  }

  raf = requestAnimationFrame(tick);
  return () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };
}

/** Keep the same world point at viewport center when width/height changes. */
export function compensateCameraForViewportResize(camera, prevW, prevH, nextW, nextH) {
  if (!prevW || !prevH || (prevW === nextW && prevH === nextH)) return camera;
  const worldX = (prevW / 2 - camera.x) / camera.scale;
  const worldY = (prevH / 2 - camera.y) / camera.scale;
  return {
    scale: camera.scale,
    x: nextW / 2 - worldX * camera.scale,
    y: nextH / 2 - worldY * camera.scale,
  };
}

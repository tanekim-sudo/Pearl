import React, { useEffect, useId, useRef, useState } from "react";
import { orbCursorPresentation } from "../../shared/orb-cursor.js";

export default function OrbCursorLayer({ state, onDisable }) {
  const id = useId();
  const rootRef = useRef(null);
  const motionRef = useRef({ x: innerWidth / 2, y: innerHeight / 2, vx: 0, vy: 0, at: 0 });
  const frameRef = useRef(0);
  const [presentation, setPresentation] = useState("precision");
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    function render(now) {
      const motion = motionRef.current;
      const elapsed = motion.at ? Math.min(48, now - motion.at) : 16;
      if (reducedMotion.matches || elapsed > 40) {
        motion.vx = 0;
        motion.vy = 0;
      } else {
        const decay = Math.exp(-elapsed / 54);
        motion.vx *= decay;
        motion.vy *= decay;
      }
      motion.at = now;
      const speed = reducedMotion.matches ? 0 : Math.min(1, Math.hypot(motion.vx, motion.vy) / 900);
      const root = rootRef.current;
      root?.style.setProperty("--pearl-light-x", String(Math.max(-1, Math.min(1, motion.vx / 420))));
      root?.style.setProperty("--pearl-light-y", String(Math.max(-1, Math.min(1, motion.vy / 420))));
      root?.style.setProperty("--pearl-motion", String(speed));
      if (Math.hypot(motion.vx, motion.vy) > 4) {
        frameRef.current = requestAnimationFrame(render);
      } else {
        frameRef.current = 0;
      }
    }
    function move(event) {
      const now = performance.now();
      const motion = motionRef.current;
      const elapsed = Math.max(8, Math.min(48, now - (motion.at || now - 16)));
      motion.vx = (event.clientX - motion.x) / elapsed * 1000;
      motion.vy = (event.clientY - motion.y) / elapsed * 1000;
      motion.x = event.clientX;
      motion.y = event.clientY;
      motion.at = now;
      const root = rootRef.current;
      root?.style.setProperty("--cursor-x", `${motion.x}px`);
      root?.style.setProperty("--cursor-y", `${motion.y}px`);
      setPresentation(orbCursorPresentation(event.target, (target) => getComputedStyle(target)));
      if (!frameRef.current) frameRef.current = requestAnimationFrame(render);
    }
    function down(event) {
      if (event.button === 0) setPressed(true);
    }
    function up() {
      setPressed(false);
    }
    function key(event) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onDisable?.();
    }
    addEventListener("pointermove", move, { capture: true, passive: true });
    addEventListener("pointerdown", down, { capture: true, passive: true });
    addEventListener("pointerup", up, { capture: true, passive: true });
    addEventListener("pointercancel", up, { capture: true, passive: true });
    addEventListener("keydown", key, true);
    return () => {
      cancelAnimationFrame(frameRef.current);
      removeEventListener("pointermove", move, true);
      removeEventListener("pointerdown", down, true);
      removeEventListener("pointerup", up, true);
      removeEventListener("pointercancel", up, true);
      removeEventListener("keydown", key, true);
    };
  }, [onDisable]);

  const phase = state?.phase || "idle";
  const workers = phase === "executing" && !(state?.workers || []).length
    ? [{ id: "execution", role: "working" }]
    : (state?.workers || []).slice(0, 3);
  return <div
    ref={rootRef}
    className={`orb-cursor-layer ${pressed ? "pressed" : ""}`}
    data-cursor-presentation={presentation}
    data-orb-state={phase}
    style={{ "--cursor-x": `${motionRef.current.x}px`, "--cursor-y": `${motionRef.current.y}px` }}
    aria-hidden="true"
  >
    {workers.length > 0 && <svg className="orb-cursor-tether" viewBox="0 0 96 64">
      <path d="M12 32 C38 13 59 52 84 25" />
    </svg>}
    {workers.map((worker, index) => <span className="orb-cursor-worker" key={worker.id} style={{ "--worker-index": index }} />)}
    <svg className="orb-cursor-visual" viewBox="0 0 100 100">
      <defs>
        <radialGradient id={`cursor-body-${id}`} cx="39%" cy="58%" r="72%">
          <stop offset="0" stopColor="#fff7e8" />
          <stop offset=".3" stopColor="#f6efe3" />
          <stop offset=".7" stopColor="#e4e4da" />
          <stop offset="1" stopColor="#b4b7af" />
        </radialGradient>
        <linearGradient id={`cursor-nacre-${id}`} x1="8%" y1="14%" x2="92%" y2="84%">
          <stop offset="0" stopColor="#e8c9c3" stopOpacity=".18" />
          <stop offset=".35" stopColor="#c6dcd3" stopOpacity=".34" />
          <stop offset=".64" stopColor="#f0deb8" stopOpacity=".26" />
          <stop offset="1" stopColor="#e4c7c0" stopOpacity=".16" />
        </linearGradient>
      </defs>
      <ellipse className="orb-cursor-shadow" cx="51" cy="96" rx="25" ry="2" />
      <g className="orb-cursor-pearl">
        <circle className="orb-cursor-core" cx="50" cy="50" r="43" fill={`url(#cursor-body-${id})`} />
        <circle className="orb-cursor-nacre" cx="50" cy="50" r="41.5" fill={`url(#cursor-nacre-${id})`} />
        <ellipse className="orb-cursor-reflection" cx="58" cy="61" rx="28" ry="17" />
        <ellipse className="orb-cursor-glint" cx="33" cy="28" rx="8" ry="4.5" transform="rotate(-38 33 28)" />
        <circle className="orb-cursor-pinlight" cx="27.5" cy="22.5" r="2" />
      </g>
    </svg>
  </div>;
}

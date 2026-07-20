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
          <stop offset="0" stopColor="#fffaf0" />
          <stop offset=".3" stopColor="#f5f0e7" />
          <stop offset=".68" stopColor="#e7e6de" />
          <stop offset=".88" stopColor="#d1d4ce" />
          <stop offset="1" stopColor="#aeb3af" />
        </radialGradient>
        <radialGradient id={`cursor-nucleus-${id}`} cx="38%" cy="62%" r="58%">
          <stop offset="0" stopColor="#f2d9ce" stopOpacity=".52" />
          <stop offset=".36" stopColor="#d2e2da" stopOpacity=".34" />
          <stop offset=".72" stopColor="#eadcb9" stopOpacity=".15" />
          <stop offset="1" stopColor="#c6ced0" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`cursor-nacre-${id}`} x1="8%" y1="14%" x2="92%" y2="84%">
          <stop offset="0" stopColor="#dfbfb9" stopOpacity=".11" />
          <stop offset=".31" stopColor="#bfd8ce" stopOpacity=".28" />
          <stop offset=".53" stopColor="#f2e4c2" stopOpacity=".18" />
          <stop offset=".72" stopColor="#d9bdba" stopOpacity=".21" />
          <stop offset="1" stopColor="#bdd3cc" stopOpacity=".1" />
        </linearGradient>
        <linearGradient id={`cursor-rim-${id}`} x1="18%" y1="8%" x2="82%" y2="92%">
          <stop offset="0" stopColor="#fff" stopOpacity=".78" />
          <stop offset=".5" stopColor="#edf2ee" stopOpacity=".18" />
          <stop offset=".82" stopColor="#78817e" stopOpacity=".35" />
          <stop offset="1" stopColor="#f4ecdf" stopOpacity=".48" />
        </linearGradient>
      </defs>
      <ellipse className="orb-cursor-shadow" cx="51" cy="96" rx="25" ry="2" />
      <g className="orb-cursor-pearl">
        <circle className="orb-cursor-core" cx="50" cy="50" r="43" fill={`url(#cursor-body-${id})`} />
        <ellipse className="orb-cursor-nucleus" cx="43" cy="57" rx="25" ry="29" fill={`url(#cursor-nucleus-${id})`} />
        <circle className="orb-cursor-nacre" cx="50" cy="50" r="41.5" fill={`url(#cursor-nacre-${id})`} />
        <ellipse className="orb-cursor-reflection" cx="58" cy="61" rx="28" ry="17" />
        <circle className="orb-cursor-rim" cx="50" cy="50" r="42.2" fill="none" stroke={`url(#cursor-rim-${id})`} />
        <ellipse className="orb-cursor-glint" cx="33" cy="28" rx="8" ry="4.5" transform="rotate(-38 33 28)" />
        <circle className="orb-cursor-pinlight" cx="27.5" cy="22.5" r="2" />
      </g>
    </svg>
  </div>;
}

import React, { useEffect, useRef, useState } from "react";
import { orbCursorPresentation } from "../../shared/orb-cursor.js";
import PhysicalPearl from "./PhysicalPearl.jsx";

export default function OrbCursorLayer({ state, onDisable }) {
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
      <path className="orb-cursor-tether-core" d="M12 32 C38 13 59 52 84 25" />
    </svg>}
    {workers.map((worker, index) => <PhysicalPearl
      className="orb-cursor-worker"
      variant="worker"
      state="executing"
      animation={phase === "executing" ? "charge" : null}
      size={16}
      decorative
      key={worker.id}
      style={{ "--worker-index": index }}
    />)}
    <PhysicalPearl
      className="orb-cursor-visual"
      variant="cursor"
      state={phase === "executing" ? "executing" : presentation === "blocked" ? "blocked" : "idle"}
      animation={phase === "executing" ? "charge" : null}
      size={18}
      decorative
    />
  </div>;
}

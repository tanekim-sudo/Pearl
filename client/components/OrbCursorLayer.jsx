import React, { useEffect, useRef, useState } from "react";
import { orbCursorPresentation } from "../../shared/orb-cursor.js";

const RAYS = [
  [4, 13, 35, 2], [43, 18, 36, -1], [82, 11, 34, 1], [129, 18, 36, 2],
  [174, 14, 35, -1], [220, 19, 36, 1], [266, 12, 34, -2], [309, 17, 36, 1], [341, 15, 35, -1],
];

export default function OrbCursorLayer({ state, onDisable }) {
  const pointRef = useRef({ x: innerWidth / 2, y: innerHeight / 2 });
  const frameRef = useRef(0);
  const [point, setPoint] = useState(pointRef.current);
  const [presentation, setPresentation] = useState("precision");
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    function render() {
      frameRef.current = 0;
      setPoint(pointRef.current);
    }
    function move(event) {
      pointRef.current = { x: event.clientX, y: event.clientY };
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
    className={`orb-cursor-layer ${pressed ? "pressed" : ""}`}
    data-cursor-presentation={presentation}
    data-orb-state={phase}
    style={{ "--cursor-x": `${point.x}px`, "--cursor-y": `${point.y}px` }}
    aria-hidden="true"
  >
    {workers.length > 0 && <svg className="orb-cursor-tether" viewBox="0 0 96 64">
      <path d="M12 32 C38 13 59 52 84 25" />
    </svg>}
    {workers.map((worker, index) => <span className="orb-cursor-worker" key={worker.id} style={{ "--worker-index": index }} />)}
    <svg className="orb-cursor-visual" viewBox="0 0 100 100">
      <g className="orb-rays">
        {RAYS.map(([angle, start, end, bend]) => <path key={angle} d={`M50 ${start} C${50 + bend} ${start + 7} ${50 - bend} ${end - 5} 50 ${end}`} transform={`rotate(${angle} 50 50)`} />)}
      </g>
      <circle className="orb-halo" cx="50" cy="50" r="30" />
      <circle className="orb-core" cx="50" cy="50" r="16" />
      <circle className="orb-cursor-hotspot" cx="50" cy="50" r="3" />
    </svg>
  </div>;
}

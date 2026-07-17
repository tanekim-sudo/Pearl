import React, { useEffect, useState } from "react";
import { subscribeDirector, stopDirector } from "../lib/director.js";

/**
 * Ghost cursor overlay — renders the director's animated cursor, drag chip,
 * click ripples, and caption bubble while a demonstration plays.
 * Any real pointer press stops the show (the user takes back the controls).
 */
export default function GhostCursor() {
  const [d, setD] = useState(null);
  const [ripples, setRipples] = useState([]);

  useEffect(() => subscribeDirector(setD), []);

  useEffect(() => {
    if (!d?.running) return undefined;
    const onRealPointer = (e) => {
      // Allow clicks on the companion panel (stop button etc.)
      if (e.target.closest?.(".companion-panel, .ghost-cursor-stop")) return;
      stopDirector();
    };
    window.addEventListener("pointerdown", onRealPointer, true);
    window.addEventListener("keydown", onRealPointer, true);
    return () => {
      window.removeEventListener("pointerdown", onRealPointer, true);
      window.removeEventListener("keydown", onRealPointer, true);
    };
  }, [d?.running]);

  useEffect(() => {
    if (!d?.cursor?.pulse) return;
    const id = `${Date.now()}-${d.cursor.pulse}`;
    setRipples((r) => [...r.slice(-3), { id, x: d.cursor.x, y: d.cursor.y }]);
    const t = setTimeout(() => {
      setRipples((r) => r.filter((x) => x.id !== id));
    }, 620);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d?.cursor?.pulse]);

  if (!d?.running && !d?.cursor?.visible) return null;

  return (
    <>
      <div
        className="ghost-cursor-effect-status"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {d.running ? `Demonstrating ${d.scriptTitle || "the requested action"}.` : "Demonstration complete."}
      </div>
      <div className="ghost-cursor-layer" aria-hidden="true">
        {ripples.map((r) => (
          <span key={r.id} className="ghost-cursor-ripple" style={{ left: r.x, top: r.y }} />
        ))}
        {d.cursor.visible && (
          <div
            className={"ghost-cursor" + (d.cursor.pressed ? " pressed" : "")}
            style={{ transform: `translate(${d.cursor.x}px, ${d.cursor.y}px)` }}
          >
            <svg width="26" height="30" viewBox="0 0 26 30" className="ghost-cursor-arrow">
              <path
                d="M 3 2 L 3 24 L 9 18.5 L 13 27 L 16.5 25.4 L 12.6 17 L 21 16.4 Z"
                fill="#1a1a1a"
                stroke="#ffffff"
                strokeWidth="1.6"
              />
            </svg>
            {d.cursor.dragLabel && <span className="ghost-cursor-chip">{d.cursor.dragLabel}</span>}
          </div>
        )}
        {d.caption && (
          <div className="ghost-cursor-caption">
            <span className="ghost-cursor-caption-text">{d.caption}</span>
          </div>
        )}
        {d.running && (
          <button type="button" className="ghost-cursor-stop" onClick={() => stopDirector()}>
            stop demonstration
          </button>
        )}
      </div>
    </>
  );
}

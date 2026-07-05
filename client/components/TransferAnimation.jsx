import React, { useEffect } from "react";

const DURATION_MS = 780;

/**
 * Full-screen golden transfer streak: paper ↔ AI boundary.
 * anim: { key, direction: 'to-ai' | 'to-paper', fromX, fromY, boundaryX, toX, toY }
 */
export default function TransferAnimation({ anim, onComplete }) {
  useEffect(() => {
    if (!anim) return;
    const t = window.setTimeout(() => onComplete?.(anim.key), DURATION_MS);
    return () => window.clearTimeout(t);
  }, [anim, onComplete]);

  if (!anim) return null;

  const { direction, fromX, fromY, boundaryX, toX, toY } = anim;
  const streakEndX = direction === "to-ai" ? boundaryX : toX;
  const streakEndY = direction === "to-ai" ? fromY : toY;
  const streakStartX = direction === "to-ai" ? fromX : boundaryX;
  const streakStartY = direction === "to-ai" ? fromY : fromY;
  const flashX = direction === "to-ai" ? boundaryX + 28 : toX;
  const flashY = direction === "to-ai" ? fromY : toY;

  return (
    <svg className="transfer-animation-layer" aria-hidden="true">
      <defs>
        <radialGradient id="transfer-gold-flash" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFD700" stopOpacity="0.85" />
          <stop offset="55%" stopColor="#F5C842" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#E8B923" stopOpacity="0" />
        </radialGradient>
        <filter id="transfer-gold-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle
        className="transfer-ring"
        cx={fromX}
        cy={fromY}
        r="8"
        fill="none"
        stroke="#FFD700"
        strokeWidth="3"
        filter="url(#transfer-gold-glow)"
      />

      <line
        className="transfer-streak"
        x1={streakStartX}
        y1={streakStartY}
        x2={streakEndX}
        y2={streakEndY}
        stroke="#E8B923"
        strokeWidth="3"
        strokeLinecap="round"
        filter="url(#transfer-gold-glow)"
      />

      <circle
        className="transfer-particle"
        r="5"
        fill="#FFD700"
        filter="url(#transfer-gold-glow)"
      >
        <animateMotion
          dur={`${DURATION_MS * 0.72}ms`}
          begin="0.08s"
          fill="freeze"
          path={`M ${streakStartX} ${streakStartY} L ${streakEndX} ${streakEndY}`}
        />
      </circle>

      <circle
        className="transfer-node-flash"
        cx={flashX}
        cy={flashY}
        r="6"
        fill="url(#transfer-gold-flash)"
      />

      {direction === "to-paper" && (
        <circle
          className="transfer-land-splash"
          cx={toX}
          cy={toY}
          r="10"
          fill="none"
          stroke="#F5C842"
          strokeWidth="2"
        />
      )}
    </svg>
  );
}

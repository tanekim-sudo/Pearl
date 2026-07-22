import React, { useEffect, useState } from "react";
import {
  PEARL_POWER_EVENT,
  ensurePearlPowerFxStyles,
  filamentPath,
  normalizePowerFx,
} from "../../shared/pearl-power-fx.js";

function EffectLayer({ effect }) {
  const fx = normalizePowerFx(effect);
  if (fx.reducedMotion) return null;
  const durationStyle = { "--fx-ms": `${fx.durationMs}ms` };
  return <>
    {(fx.kind === "burst") && <div
      className="pearl-power-fx__burst"
      style={{ ...durationStyle, left: fx.from.x, top: fx.from.y }}
    />}
    {fx.kind === "charge" && <div
      className="pearl-power-fx__charge-ring"
      style={{ ...durationStyle, left: fx.from.x, top: fx.from.y }}
    />}
    {(fx.kind === "filament" || fx.kind === "mark" || fx.toRects.length > 0) && <svg
      className="pearl-power-fx__layer"
      style={durationStyle}
      aria-hidden="true"
    >
      {fx.toRects.map((rect, index) => {
        const to = { x: (rect.cx ?? rect.x + rect.width / 2), y: (rect.cy ?? rect.y + rect.height / 2) };
        const d = filamentPath(fx.from, to);
        return <g key={`${fx.id}:f:${index}`}>
          <path className="pearl-power-fx__filament" d={d} />
          <path className="pearl-power-fx__filament pearl-power-fx__filament-core" d={d} />
          <rect
            className="pearl-power-fx__mark"
            x={rect.x - 2}
            y={rect.y - 2}
            width={Math.max(8, rect.width + 4)}
            height={Math.max(8, rect.height + 4)}
            rx="3"
          />
        </g>;
      })}
    </svg>}
    {(fx.kind === "fission" || fx.kind === "echo") && fx.satellites.map((satellite) => (
      <div
        key={`${fx.id}:s:${satellite.index}`}
        className="pearl-power-fx__satellite"
        data-kind={fx.kind}
        style={{
          ...durationStyle,
          left: fx.from.x,
          top: fx.from.y,
          "--dx": `${satellite.x - fx.from.x}px`,
          "--dy": `${satellite.y - fx.from.y}px`,
        }}
      />
    ))}
    {fx.kind === "fuse" && fx.satellites.map((satellite) => (
      <div
        key={`${fx.id}:fuse:${satellite.index}`}
        className="pearl-power-fx__satellite"
        data-kind="fuse"
        style={{
          ...durationStyle,
          left: satellite.x,
          top: satellite.y,
          "--dx": `${fx.from.x - satellite.x}px`,
          "--dy": `${fx.from.y - satellite.y}px`,
        }}
      />
    ))}
    {fx.kind === "seek" && fx.to && <div
      className="pearl-power-fx__seek-ghost"
      style={{
        ...durationStyle,
        left: fx.from.x,
        top: fx.from.y,
        "--dx": `${fx.to.x - fx.from.x}px`,
        "--dy": `${fx.to.y - fx.from.y}px`,
      }}
    />}
  </>;
}

export default function PearlPowerFxOverlay() {
  const [effects, setEffects] = useState([]);
  useEffect(() => {
    ensurePearlPowerFxStyles(document);
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    function onPower(event) {
      const detail = normalizePowerFx({
        ...event.detail,
        reducedMotion: reduced?.matches === true,
      });
      setEffects((current) => [...current.slice(-7), detail]);
      window.setTimeout(() => {
        setEffects((current) => current.filter((entry) => entry.id !== detail.id));
      }, Math.max(320, detail.durationMs) + 80);
    }
    document.addEventListener(PEARL_POWER_EVENT, onPower);
    return () => document.removeEventListener(PEARL_POWER_EVENT, onPower);
  }, []);
  if (!effects.length) return null;
  return <div
    className="pearl-power-fx-host"
    data-reduced-motion={String(effects.some((entry) => entry.reducedMotion))}
    aria-hidden="true"
  >
    {effects.map((effect) => <EffectLayer key={effect.id} effect={effect} />)}
  </div>;
}

/** Play a local pearl CSS animation on an element, clearing after duration. */
export function playPearlHostAnimation(element, animation) {
  if (!element || !animation?.semantic) return false;
  const visual = element.classList?.contains?.("physical-pearl")
    ? element
    : element.querySelector?.(".physical-pearl");
  if (!visual) return false;
  visual.dataset.pearlAnimation = animation.semantic;
  window.setTimeout(() => {
    if (visual.dataset.pearlAnimation === animation.semantic) delete visual.dataset.pearlAnimation;
  }, Math.max(0, Number(animation.durationMs) || 0) + 40);
  return true;
}

import React, { useMemo, useState } from "react";
import {
  listPearlAestheticPresets,
  normalizePearlAesthetic,
  patchPearlAesthetic,
  applyPearlAestheticPreset,
  defaultPearlAesthetic,
} from "../../shared/pearl-aesthetic.js";
import PhysicalPearl from "./PhysicalPearl.jsx";

const LAYER_FIELDS = [
  ["nacre", "Nacre"],
  ["nucleusA", "Nucleus warm"],
  ["nucleusB", "Nucleus cool"],
  ["edge", "Edge"],
  ["caustic", "Caustic"],
  ["bodyHighlight", "Body highlight"],
  ["bodyMid", "Body mid"],
  ["bodyShadow", "Body shadow"],
  ["reflectionLight", "Reflection light"],
  ["reflectionMid", "Reflection mid"],
  ["reflectionDark", "Reflection dark"],
  ["specular", "Specular"],
];

const MATERIAL_FIELDS = [
  ["nacreIntensity", "Nacre intensity"],
  ["nucleusIntensity", "Nucleus intensity"],
  ["gloss", "Gloss"],
  ["contrast", "Contrast"],
  ["warmth", "Warmth"],
  ["saturation", "Saturation"],
  ["brightness", "Brightness"],
];

export default function PearlAestheticPanel({
  aesthetic: aestheticInput = null,
  onChange,
  title = "Pearl appearance",
  compact = false,
}) {
  const aesthetic = useMemo(() => normalizePearlAesthetic(aestheticInput || defaultPearlAesthetic()), [aestheticInput]);
  const presets = useMemo(() => listPearlAestheticPresets(), []);
  const [advanced, setAdvanced] = useState(false);

  function commit(next) {
    onChange?.(normalizePearlAesthetic(next));
  }

  return <section className={`pearl-aesthetic-panel ${compact ? "compact" : ""}`} aria-label={title}>
    <style>{`
      .pearl-aesthetic-panel{display:grid;gap:14px;margin-top:22px;padding-top:14px;border-top:1px solid color-mix(in srgb,currentColor 12%,transparent)}
      .pearl-aesthetic-panel h2{margin:0;font:500 13px/1.3 inherit;letter-spacing:.02em}
      .pearl-aesthetic-panel__preview{display:flex;align-items:center;gap:14px}
      .pearl-aesthetic-panel__presets{display:flex;flex-wrap:wrap;gap:8px}
      .pearl-aesthetic-panel__preset{display:inline-flex;align-items:center;gap:7px;padding:6px 0;border:0;border-bottom:1px solid transparent;background:transparent;color:inherit;cursor:pointer;font:inherit}
      .pearl-aesthetic-panel__preset[aria-pressed=true]{border-bottom-color:currentColor}
      .pearl-aesthetic-panel__swatch{width:14px;height:14px;border-radius:50%;border:1px solid color-mix(in srgb,currentColor 28%,transparent)}
      .pearl-aesthetic-panel__grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px 14px}
      .pearl-aesthetic-panel label{display:grid;gap:4px;font-size:11px;opacity:.86}
      .pearl-aesthetic-panel input[type=color]{width:100%;height:28px;padding:0;border:0;background:transparent;cursor:pointer}
      .pearl-aesthetic-panel input[type=range]{width:100%}
      .pearl-aesthetic-panel__actions{display:flex;flex-wrap:wrap;gap:12px}
      .pearl-aesthetic-panel button{border:0;border-bottom:1px solid color-mix(in srgb,currentColor 20%,transparent);background:transparent;color:inherit;padding:6px 0;cursor:pointer;font:inherit}
    `}</style>
    <h2>{title}</h2>
    <div className="pearl-aesthetic-panel__preview">
      <PhysicalPearl variant="primary" state="idle" size={compact ? 34 : 56} aesthetic={aesthetic} decorative />
      <small>{aesthetic.label} · {aesthetic.preset}</small>
    </div>
    <div className="pearl-aesthetic-panel__presets" role="listbox" aria-label="Appearance presets">
      {presets.map((preset) => (
        <button
          key={preset.id}
          type="button"
          className="pearl-aesthetic-panel__preset"
          role="option"
          aria-selected={aesthetic.preset === preset.id}
          aria-pressed={aesthetic.preset === preset.id}
          onClick={() => commit(applyPearlAestheticPreset(aesthetic, preset.id))}
        >
          <span className="pearl-aesthetic-panel__swatch" style={{ background: preset.swatch }} aria-hidden="true" />
          {preset.label}
        </button>
      ))}
    </div>
    <div className="pearl-aesthetic-panel__actions">
      <button type="button" onClick={() => setAdvanced((value) => !value)} aria-expanded={advanced}>
        {advanced ? "Hide layers" : "Edit layers"}
      </button>
      <button type="button" onClick={() => commit(defaultPearlAesthetic())}>Reset</button>
    </div>
    {advanced && <>
      <div className="pearl-aesthetic-panel__grid">
        {LAYER_FIELDS.map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              type="color"
              aria-label={label}
              value={aesthetic.colors[key]}
              onChange={(event) => commit(patchPearlAesthetic(aesthetic, { colors: { [key]: event.target.value } }))}
            />
          </label>
        ))}
      </div>
      <div className="pearl-aesthetic-panel__grid">
        {MATERIAL_FIELDS.map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              aria-label={label}
              value={aesthetic.material[key]}
              onChange={(event) => commit(patchPearlAesthetic(aesthetic, {
                material: { [key]: Number(event.target.value) },
              }))}
            />
          </label>
        ))}
        <label>
          Light X
          <input
            type="range"
            min="-1"
            max="1"
            step="0.01"
            aria-label="Light X"
            value={aesthetic.light.x}
            onChange={(event) => commit(patchPearlAesthetic(aesthetic, {
              light: { x: Number(event.target.value) },
            }))}
          />
        </label>
        <label>
          Light Y
          <input
            type="range"
            min="-1"
            max="1"
            step="0.01"
            aria-label="Light Y"
            value={aesthetic.light.y}
            onChange={(event) => commit(patchPearlAesthetic(aesthetic, {
              light: { y: Number(event.target.value) },
            }))}
          />
        </label>
        <label>
          Surrounding
          <select
            aria-label="Surrounding adaptation"
            value={aesthetic.surrounding}
            onChange={(event) => commit(patchPearlAesthetic(aesthetic, { surrounding: event.target.value }))}
          >
            {["auto", "light", "dark", "colored", "text-heavy"].map((entry) => (
              <option key={entry} value={entry}>{entry}</option>
            ))}
          </select>
        </label>
      </div>
    </>}
  </section>;
}

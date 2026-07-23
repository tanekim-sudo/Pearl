/**
 * Pearl aesthetic — fully user-customizable color/material model.
 * Inspired by design-tool controls: presets, swatches, per-layer fills,
 * HSL/hex, material sliders, light direction, eyedropper sample, reset.
 */

export const PEARL_AESTHETIC_VERSION = 1;
export const PEARL_AESTHETIC_STORAGE_KEY = "lens.companion.aesthetic.v1";

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export const PEARL_AESTHETIC_PRESETS = Object.freeze({
  classic: {
    id: "classic",
    label: "Classic",
    swatch: "#9fd4e8",
    colors: {
      nacre: "#9fd4e8",
      nucleusA: "#e8f7ff",
      nucleusB: "#7ec8e0",
      edge: "#3d5a66",
      caustic: "#d4f4ff",
      bodyHighlight: "#f4fcff",
      bodyMid: "#b9d4e0",
      bodyShadow: "#2a414c",
      reflectionLight: "#f4fbff",
      reflectionMid: "#7a9aaa",
      reflectionDark: "#0e171c",
      specular: "#f7fcff",
    },
    material: { nacreIntensity: 0.46, nucleusIntensity: 0.9, gloss: 0.68, contrast: 0.52, warmth: 0.22, saturation: 0.4, brightness: 0.72 },
  },
  celadon: {
    id: "celadon",
    label: "Celadon",
    swatch: "#78b89f",
    colors: {
      nacre: "#78b89f",
      nucleusA: "#cee2d2",
      nucleusB: "#78ad97",
      edge: "#3f5a50",
      caustic: "#d8f0e4",
      bodyHighlight: "#f3faf6",
      bodyMid: "#c5d6cd",
      bodyShadow: "#4a6358",
      reflectionLight: "#f2fff8",
      reflectionMid: "#7fa896",
      reflectionDark: "#163028",
      specular: "#ffffff",
    },
    material: { nacreIntensity: 0.42, nucleusIntensity: 0.74, gloss: 0.5, contrast: 0.52, warmth: 0.28, saturation: 0.48, brightness: 0.56 },
  },
  rose: {
    id: "rose",
    label: "Rose",
    swatch: "#d7a9a4",
    colors: {
      nacre: "#d7a9a4",
      nucleusA: "#f0d4c3",
      nucleusB: "#c9a8a4",
      edge: "#6a504c",
      caustic: "#ffe4d6",
      bodyHighlight: "#fff6f2",
      bodyMid: "#e4d2cd",
      bodyShadow: "#6e524d",
      reflectionLight: "#fff8f5",
      reflectionMid: "#b8948e",
      reflectionDark: "#2a1c1a",
      specular: "#fff7f4",
    },
    material: { nacreIntensity: 0.4, nucleusIntensity: 0.78, gloss: 0.52, contrast: 0.48, warmth: 0.72, saturation: 0.5, brightness: 0.58 },
  },
  gold: {
    id: "gold",
    label: "Pale gold",
    swatch: "#e8d69f",
    colors: {
      nacre: "#e8d69f",
      nucleusA: "#efe0b8",
      nucleusB: "#c9bea0",
      edge: "#6a6048",
      caustic: "#fff1c2",
      bodyHighlight: "#fffaf0",
      bodyMid: "#e6dfc8",
      bodyShadow: "#6b6248",
      reflectionLight: "#fffdf5",
      reflectionMid: "#b8aa7e",
      reflectionDark: "#2a2414",
      specular: "#fffef8",
    },
    material: { nacreIntensity: 0.44, nucleusIntensity: 0.72, gloss: 0.58, contrast: 0.5, warmth: 0.78, saturation: 0.52, brightness: 0.6 },
  },
  ink: {
    id: "ink",
    label: "Ink",
    swatch: "#6b7a76",
    colors: {
      nacre: "#8a9a94",
      nucleusA: "#c5b8b0",
      nucleusB: "#6b7a76",
      edge: "#d6ddd8",
      caustic: "#cfd8d2",
      bodyHighlight: "#eceae4",
      bodyMid: "#9aa39e",
      bodyShadow: "#2a322f",
      reflectionLight: "#eef4ef",
      reflectionMid: "#a8b7b0",
      reflectionDark: "#51625b",
      specular: "#f4f7f5",
    },
    material: { nacreIntensity: 0.28, nucleusIntensity: 0.62, gloss: 0.4, contrast: 0.62, warmth: 0.32, saturation: 0.28, brightness: 0.42 },
  },
  moonlight: {
    id: "moonlight",
    label: "Moonlight",
    swatch: "#c8d4e0",
    colors: {
      nacre: "#c8d4e0",
      nucleusA: "#e8eef5",
      nucleusB: "#9eb0c2",
      edge: "#4a5560",
      caustic: "#e4eef8",
      bodyHighlight: "#f7f9fc",
      bodyMid: "#d0d7e0",
      bodyShadow: "#4a5563",
      reflectionLight: "#ffffff",
      reflectionMid: "#9aabbc",
      reflectionDark: "#1a222c",
      specular: "#ffffff",
    },
    material: { nacreIntensity: 0.38, nucleusIntensity: 0.68, gloss: 0.55, contrast: 0.48, warmth: 0.22, saturation: 0.35, brightness: 0.62 },
  },
  coral: {
    id: "coral",
    label: "Coral",
    swatch: "#e0a090",
    colors: {
      nacre: "#e0a090",
      nucleusA: "#f2c4b4",
      nucleusB: "#c88878",
      edge: "#6a4238",
      caustic: "#ffd8c8",
      bodyHighlight: "#fff4ef",
      bodyMid: "#e8cfc6",
      bodyShadow: "#6e453c",
      reflectionLight: "#fff8f5",
      reflectionMid: "#c89888",
      reflectionDark: "#2c1814",
      specular: "#fff9f6",
    },
    material: { nacreIntensity: 0.46, nucleusIntensity: 0.76, gloss: 0.54, contrast: 0.52, warmth: 0.8, saturation: 0.58, brightness: 0.57 },
  },
  jade: {
    id: "jade",
    label: "Jade",
    swatch: "#6fad8e",
    colors: {
      nacre: "#6fad8e",
      nucleusA: "#b8dbc8",
      nucleusB: "#4e8f72",
      edge: "#2f4f40",
      caustic: "#c8f0d8",
      bodyHighlight: "#f0faf4",
      bodyMid: "#b8d0c2",
      bodyShadow: "#355546",
      reflectionLight: "#f4fff8",
      reflectionMid: "#6f9a82",
      reflectionDark: "#12261c",
      specular: "#ffffff",
    },
    material: { nacreIntensity: 0.48, nucleusIntensity: 0.75, gloss: 0.5, contrast: 0.55, warmth: 0.35, saturation: 0.55, brightness: 0.54 },
  },
});

const COLOR_KEYS = Object.freeze([
  "nacre", "nucleusA", "nucleusB", "edge", "caustic",
  "bodyHighlight", "bodyMid", "bodyShadow",
  "reflectionLight", "reflectionMid", "reflectionDark", "specular",
]);

const MATERIAL_KEYS = Object.freeze([
  "nacreIntensity", "nucleusIntensity", "gloss", "contrast", "warmth", "saturation", "brightness",
]);

const CSS_VAR_MAP = Object.freeze({
  nacre: "--pearl-nacre",
  nucleusA: "--pearl-nucleus-a",
  nucleusB: "--pearl-nucleus-b",
  edge: "--pearl-edge-dark",
  caustic: "--pearl-caustic",
  bodyHighlight: "--pearl-body-highlight",
  bodyMid: "--pearl-body-mid",
  bodyShadow: "--pearl-body-shadow",
  reflectionLight: "--pearl-reflection-light",
  reflectionMid: "--pearl-reflection-mid",
  reflectionDark: "--pearl-reflection-dark",
  specular: "--pearl-specular",
  nacreIntensity: "--pearl-nacre-intensity",
  nucleusIntensity: "--pearl-nucleus-intensity",
  gloss: "--pearl-gloss",
  contrast: "--pearl-contrast",
  warmth: "--pearl-warmth",
  saturation: "--pearl-saturation",
  brightness: "--pearl-brightness",
  lightX: "--pearl-light-x",
  lightY: "--pearl-light-y",
});

function clamp01(value, fallback = 0.5) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
}

function normalizeHex(value, fallback) {
  const raw = String(value || "").trim();
  if (!HEX.test(raw)) return fallback;
  if (raw.length === 4) {
    const [, r, g, b] = raw;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return raw.slice(0, 7).toLowerCase();
}

function expandPreset(presetId) {
  return PEARL_AESTHETIC_PRESETS[presetId] || PEARL_AESTHETIC_PRESETS.classic;
}

export function defaultPearlAesthetic(options = {}) {
  const base = expandPreset(options.preset || "classic");
  return normalizePearlAesthetic({
    preset: base.id,
    colors: { ...base.colors },
    material: { ...base.material },
    light: { x: 0, y: 0 },
    surrounding: "auto",
    ...options,
  });
}

export function normalizePearlAesthetic(input = {}) {
  const presetId = PEARL_AESTHETIC_PRESETS[input.preset] ? input.preset : (input.colors ? "custom" : "classic");
  const base = expandPreset(presetId === "custom" ? "classic" : presetId);
  const colors = {};
  for (const key of COLOR_KEYS) {
    colors[key] = normalizeHex(input.colors?.[key] ?? base.colors[key], base.colors[key]);
  }
  const material = {};
  for (const key of MATERIAL_KEYS) {
    material[key] = clamp01(input.material?.[key] ?? base.material[key], base.material[key]);
  }
  const light = {
    x: Math.max(-1, Math.min(1, Number(input.light?.x ?? input.lightX) || 0)),
    y: Math.max(-1, Math.min(1, Number(input.light?.y ?? input.lightY) || 0)),
  };
  const surrounding = ["auto", "light", "dark", "colored", "text-heavy"].includes(input.surrounding)
    ? input.surrounding
    : "auto";
  const custom = presetId === "custom"
    || COLOR_KEYS.some((key) => colors[key] !== base.colors[key])
    || MATERIAL_KEYS.some((key) => Math.abs(material[key] - base.material[key]) > 0.01)
    || light.x !== 0
    || light.y !== 0;
  return {
    version: PEARL_AESTHETIC_VERSION,
    preset: custom ? "custom" : base.id,
    label: custom ? (input.label || "Custom") : base.label,
    colors,
    material,
    light,
    surrounding,
    updatedAt: Number(input.updatedAt) || Date.now(),
  };
}

export function applyPearlAestheticPreset(aesthetic, presetId) {
  const preset = expandPreset(presetId);
  return normalizePearlAesthetic({
    ...aesthetic,
    preset: preset.id,
    label: preset.label,
    colors: { ...preset.colors },
    material: { ...preset.material },
    light: aesthetic?.light || { x: 0, y: 0 },
    surrounding: aesthetic?.surrounding || "auto",
  });
}

export function patchPearlAesthetic(aesthetic, patch = {}) {
  const current = normalizePearlAesthetic(aesthetic);
  return normalizePearlAesthetic({
    ...current,
    preset: patch.preset || "custom",
    label: patch.label || current.label,
    colors: { ...current.colors, ...(patch.colors || {}) },
    material: { ...current.material, ...(patch.material || {}) },
    light: { ...current.light, ...(patch.light || {}) },
    surrounding: patch.surrounding || current.surrounding,
    updatedAt: Date.now(),
  });
}

/** Convert #rgb/#rrggbb to {r,g,b}. */
export function hexToRgb(hex) {
  const value = normalizeHex(hex, "#888888").slice(1);
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

export function rgbToHex(r, g, b) {
  const to = (n) => Math.max(0, Math.min(255, Math.round(Number(n) || 0))).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** Sample a dominant RGB into a full aesthetic (eyedropper / screen sample). */
export function aestheticFromSampleColor(rgb = {}, options = {}) {
  const r = Math.max(0, Math.min(255, Number(rgb.r) || 0));
  const g = Math.max(0, Math.min(255, Number(rgb.g) || 0));
  const b = Math.max(0, Math.min(255, Number(rgb.b) || 0));
  const base = rgbToHex(r, g, b);
  const light = rgbToHex(Math.min(255, r + 40), Math.min(255, g + 36), Math.min(255, b + 32));
  const mid = rgbToHex(Math.round(r * 0.82 + 30), Math.round(g * 0.82 + 30), Math.round(b * 0.82 + 30));
  const dark = rgbToHex(Math.round(r * 0.35), Math.round(g * 0.38), Math.round(b * 0.36));
  const warm = rgbToHex(Math.min(255, r + 24), Math.min(255, g + 8), Math.max(0, b - 8));
  return normalizePearlAesthetic({
    preset: "custom",
    label: options.label || "Sampled",
    colors: {
      nacre: base,
      nucleusA: warm,
      nucleusB: mid,
      edge: dark,
      caustic: light,
      bodyHighlight: light,
      bodyMid: mid,
      bodyShadow: dark,
      reflectionLight: "#ffffff",
      reflectionMid: mid,
      reflectionDark: dark,
      specular: "#ffffff",
    },
    material: {
      nacreIntensity: 0.42,
      nucleusIntensity: 0.72,
      gloss: 0.5,
      contrast: 0.5,
      warmth: clamp01((r - b + 128) / 255, 0.5),
      saturation: clamp01((Math.max(r, g, b) - Math.min(r, g, b)) / 255, 0.45),
      brightness: clamp01((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255, 0.55),
    },
    surrounding: options.surrounding || "auto",
  });
}

export function pearlAestheticToCssVars(aestheticInput) {
  const aesthetic = normalizePearlAesthetic(aestheticInput);
  const vars = {};
  for (const key of COLOR_KEYS) vars[CSS_VAR_MAP[key]] = aesthetic.colors[key];
  for (const key of MATERIAL_KEYS) vars[CSS_VAR_MAP[key]] = String(aesthetic.material[key]);
  vars[CSS_VAR_MAP.lightX] = String(aesthetic.light.x);
  vars[CSS_VAR_MAP.lightY] = String(aesthetic.light.y);
  return vars;
}

export function pearlAestheticStyle(aestheticInput) {
  return pearlAestheticToCssVars(aestheticInput);
}

export function listPearlAestheticPresets() {
  return Object.values(PEARL_AESTHETIC_PRESETS).map((entry) => ({
    id: entry.id,
    label: entry.label,
    swatch: entry.swatch,
  }));
}

export function loadCompanionAesthetic(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem?.(PEARL_AESTHETIC_STORAGE_KEY);
    return raw ? normalizePearlAesthetic(JSON.parse(raw)) : defaultPearlAesthetic();
  } catch {
    return defaultPearlAesthetic();
  }
}

export function saveCompanionAesthetic(aesthetic, storage = globalThis.localStorage) {
  const next = normalizePearlAesthetic(aesthetic);
  storage?.setItem?.(PEARL_AESTHETIC_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function aestheticSummary(aestheticInput) {
  const aesthetic = normalizePearlAesthetic(aestheticInput);
  return {
    preset: aesthetic.preset,
    label: aesthetic.label,
    swatch: aesthetic.colors.nacre,
    material: { ...aesthetic.material },
    light: { ...aesthetic.light },
  };
}

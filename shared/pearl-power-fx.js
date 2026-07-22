/**
 * Pearl power FX — ephemeral optical spectacle layered on the shared Physical Pearl.
 * Primitives: charge, burst, echo, fission, fuse, filament, seek, mark.
 * Spectacle uses refractive caustic language (no neon / permanent outer glow).
 */

import { MAX_ORB_WORKERS } from "./orb-swarm.js";
import { PEARL_ANIMATION_VOCABULARY } from "./pearl-animation.js";

export const PEARL_POWER_FX_VERSION = 1;
export const PEARL_POWER_EVENT = "lens:pearl-power-fx";
export const MAX_FILAMENT_TARGETS = 24;
export const MAX_FISSION_COUNT = MAX_ORB_WORKERS;

export const PEARL_POWER_PRIMITIVES = Object.freeze([
  "charge",
  "burst",
  "echo",
  "fission",
  "fuse",
  "filament",
  "seek",
  "mark",
]);

/** Map local pearl animation semantics → primary power overlay kind. */
export const SEMANTIC_POWER_KIND = Object.freeze({
  stream: "charge",
  settle: "burst",
  duplicate: "echo",
  split: "fission",
  emerge: "burst",
  merge: "fuse",
  nest: "fuse",
  compose: "fuse",
  arrive: "seek",
  transfer: "filament",
  absorb: "burst",
  refract: "charge",
  remix: "charge",
  recover: "burst",
  unlock: "burst",
  lock: "burst",
  fail: "burst",
  unfold: "burst",
  crossfade: "charge",
  charge: "charge",
  burst: "burst",
  echo: "echo",
  fission: "fission",
  fuse: "fuse",
  filament: "filament",
  seek: "seek",
  mark: "mark",
});

const COMMAND_POWER = Object.freeze({
  createWorker: { kind: "fission", countFrom: "specs" },
  spawnSubAgentPearls: { kind: "fission", countFrom: "specs" },
  mergeWorkers: { kind: "fuse" },
  fuseSubAgentPearls: { kind: "fuse" },
  splitSemanticOrb: { kind: "fission", countFrom: "parts" },
  duplicateSemanticOrb: { kind: "echo", count: 1 },
  mergeSemanticOrbs: { kind: "fuse" },
  composeSemanticOrbs: { kind: "fuse" },
  synthesizeSemanticOrbs: { kind: "charge" },
  nestSemanticOrb: { kind: "fuse" },
  createSemanticOrb: { kind: "burst" },
  spawnResultPearl: { kind: "burst" },
  setResultPearlStatus: { kind: "charge" },
  editPearlEntity: { kind: "charge" },
  findOnScreenMatching: { kind: "filament" },
  beamPearlToTargets: { kind: "filament" },
  seekPearlToTarget: { kind: "seek" },
  moveSemanticOrb: { kind: "seek" },
});

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function point(value, fallback = { x: 0, y: 0 }) {
  return {
    x: Number.isFinite(value?.x) ? value.x : fallback.x,
    y: Number.isFinite(value?.y) ? value.y : fallback.y,
  };
}

function normalizeRect(rect) {
  if (!rect) return null;
  const x = Number(rect.x ?? rect.left);
  const y = Number(rect.y ?? rect.top);
  const width = Math.max(0, Number(rect.width) || 0);
  const height = Math.max(0, Number(rect.height) || 0);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y, width, height, cx: x + width / 2, cy: y + height / 2 };
}

export function radialFissionPoints(origin, count, radius = 72) {
  const n = clamp(Math.floor(Number(count) || 0), 1, MAX_FISSION_COUNT);
  const center = point(origin);
  return Array.from({ length: n }, (_, index) => {
    const angle = -Math.PI / 2 + index * ((Math.PI * 2) / n) + (n === 2 ? Math.PI / 2 : 0);
    return {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
      index,
    };
  });
}

export function filamentPath(from, to) {
  const a = point(from);
  const b = point(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const midX = a.x + dx * 0.5;
  const midY = a.y + dy * 0.5 - Math.min(48, Math.hypot(dx, dy) * 0.18);
  return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} Q ${midX.toFixed(1)} ${midY.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}

export function normalizePowerFx(input = {}) {
  const kind = PEARL_POWER_PRIMITIVES.includes(input.kind)
    ? input.kind
    : SEMANTIC_POWER_KIND[input.semantic] || "burst";
  const from = point(input.from);
  const toRects = (input.toRects || [])
    .map(normalizeRect)
    .filter(Boolean)
    .slice(0, MAX_FILAMENT_TARGETS);
  const count = clamp(
    Number(input.count) || toRects.length || (kind === "echo" ? 1 : kind === "fission" ? 2 : 1),
    1,
    kind === "filament" || kind === "mark" ? MAX_FILAMENT_TARGETS : MAX_FISSION_COUNT,
  );
  const durationMs = Math.max(
    0,
    Number(input.durationMs)
      || PEARL_ANIMATION_VOCABULARY[input.semantic]?.durationMs
      || (kind === "charge" ? 680 : kind === "fission" ? 720 : kind === "filament" ? 900 : 480),
  );
  const satellites = kind === "fission" || kind === "echo"
    ? (input.satellites?.length ? input.satellites.map((entry, index) => ({ ...point(entry), index })) : radialFissionPoints(from, count))
    : [];
  return {
    version: PEARL_POWER_FX_VERSION,
    id: String(input.id || `power:${kind}:${Date.now()}`),
    kind,
    semantic: input.semantic || null,
    pearlId: input.pearlId || null,
    command: input.command || null,
    from,
    to: input.to ? point(input.to) : (toRects[0] ? { x: toRects[0].cx, y: toRects[0].cy } : null),
    toRects,
    count,
    satellites,
    durationMs,
    reducedMotion: input.reducedMotion === true,
    quote: input.quote ? String(input.quote).slice(0, 200) : null,
  };
}

export function powerFxForCommand(command, options = {}) {
  const mapping = COMMAND_POWER[command] || null;
  const semantic = options.semantic
    || (command === "createWorker" || command === "spawnSubAgentPearls" || command === "splitSemanticOrb" ? "split"
      : command === "duplicateSemanticOrb" ? "duplicate"
        : command === "mergeWorkers" || command === "fuseSubAgentPearls" || command === "mergeSemanticOrbs" ? "merge"
          : null);
  let count = options.count;
  if (count == null && mapping?.countFrom === "specs") {
    count = Array.isArray(options.specs) ? options.specs.length : Number(options.limit) || 2;
  }
  if (count == null && Array.isArray(options.parts)) count = options.parts.length;
  const kind = options.kind || mapping?.kind || SEMANTIC_POWER_KIND[semantic] || "burst";
  return normalizePowerFx({
    ...options,
    kind,
    semantic,
    command,
    count: count ?? mapping?.count,
  });
}

export function powerFxForAnimation(animation, options = {}) {
  if (!animation?.semantic) return normalizePowerFx({ kind: "burst", ...options });
  return normalizePowerFx({
    ...options,
    kind: options.kind || SEMANTIC_POWER_KIND[animation.semantic] || "burst",
    semantic: animation.semantic,
    command: animation.command,
    durationMs: options.durationMs ?? animation.durationMs,
    pearlId: options.pearlId,
  });
}

export function dispatchPearlPowerFx(effect, target = globalThis.document) {
  if (typeof target?.dispatchEvent !== "function") return effect;
  const detail = normalizePowerFx(effect);
  target.dispatchEvent(new CustomEvent(PEARL_POWER_EVENT, { detail, bubbles: true }));
  return detail;
}

/** CSS for the shared power overlay host (separate from PhysicalPearl idle stack). */
export const PEARL_POWER_FX_CSS = `
.pearl-power-fx-host{position:fixed;inset:0;pointer-events:none;z-index:48;overflow:hidden}
.pearl-power-fx-host[data-reduced-motion=true] .pearl-power-fx__filament,
.pearl-power-fx-host[data-reduced-motion=true] .pearl-power-fx__satellite,
.pearl-power-fx-host[data-reduced-motion=true] .pearl-power-fx__mark,
.pearl-power-fx-host[data-reduced-motion=true] .pearl-power-fx__burst{animation:none!important;opacity:.55}
.pearl-power-fx__layer{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.pearl-power-fx__filament{fill:none;stroke:rgba(232,209,159,.55);stroke-width:1.35;stroke-linecap:round;filter:none;opacity:0;animation:pearl-power-filament-draw var(--fx-ms,.9s) cubic-bezier(.18,.72,.22,1) forwards}
.pearl-power-fx__filament-core{stroke:rgba(255,248,230,.42);stroke-width:.55}
.pearl-power-fx__mark{fill:rgba(232,209,159,.14);stroke:rgba(186,168,122,.55);stroke-width:1;transform-box:fill-box;transform-origin:center;animation:pearl-power-mark-hit .55s ease-out forwards}
.pearl-power-fx__satellite{position:absolute;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;pointer-events:none;background:radial-gradient(circle at 35% 30%,#fff8ee 0%,#e8d7c4 38%,#b8c4bc 72%,#7e8985 100%);box-shadow:none;opacity:0;animation:pearl-power-satellite-fly var(--fx-ms,.72s) cubic-bezier(.16,.78,.22,1) forwards}
.pearl-power-fx__satellite[data-kind=echo]{animation-name:pearl-power-echo-peel}
.pearl-power-fx__burst{position:absolute;width:64px;height:64px;margin:-32px 0 0 -32px;border-radius:50%;border:1px solid rgba(232,209,159,.35);opacity:0;animation:pearl-power-burst .42s ease-out forwards}
.pearl-power-fx__charge-ring{position:absolute;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:1px solid rgba(184,209,200,.4);opacity:0;animation:pearl-power-charge 1.1s ease-in-out infinite}
.pearl-power-fx__seek-ghost{position:absolute;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:radial-gradient(circle at 35% 30%,rgba(255,248,238,.9),rgba(184,196,188,.55) 70%,transparent 100%);opacity:0;animation:pearl-power-seek var(--fx-ms,.7s) cubic-bezier(.2,.7,.2,1) forwards}
@keyframes pearl-power-filament-draw{0%{opacity:0;stroke-dasharray:4 240;stroke-dashoffset:240}18%{opacity:.85}100%{opacity:.2;stroke-dasharray:240 0;stroke-dashoffset:0}}
@keyframes pearl-power-mark-hit{0%{opacity:0;transform:scale(.4)}40%{opacity:.9;transform:scale(1.08)}100%{opacity:0;transform:scale(1)}}
@keyframes pearl-power-satellite-fly{0%{opacity:0;transform:translate(0,0) scale(.35)}22%{opacity:1;transform:translate(calc(var(--dx)*0.22),calc(var(--dy)*0.22)) scale(1.08)}100%{opacity:.92;transform:translate(var(--dx),var(--dy)) scale(1)}}
@keyframes pearl-power-echo-peel{0%{opacity:0;transform:translate(0,0) scale(.55)}35%{opacity:1;transform:translate(calc(var(--dx)*0.4),calc(var(--dy)*0.4)) scale(1.06)}100%{opacity:.85;transform:translate(var(--dx),var(--dy)) scale(1)}}
@keyframes pearl-power-burst{0%{opacity:.7;transform:scale(.35)}70%{opacity:.35;transform:scale(1.15)}100%{opacity:0;transform:scale(1.4)}}
@keyframes pearl-power-charge{0%,100%{opacity:.15;transform:scale(.92)}50%{opacity:.55;transform:scale(1.12)}}
@keyframes pearl-power-seek{0%{opacity:.2;transform:translate(0,0) scale(.8)}70%{opacity:.85;transform:translate(var(--dx),var(--dy)) scale(1.05)}100%{opacity:0;transform:translate(var(--dx),var(--dy)) scale(1)}}
@media(prefers-reduced-motion:reduce){.pearl-power-fx-host *{animation:none!important}.pearl-power-fx__filament,.pearl-power-fx__mark,.pearl-power-fx__satellite{opacity:.45}}
`;

export function ensurePearlPowerFxStyles(doc = globalThis.document) {
  if (!doc?.head) return false;
  const id = "pearl-power-fx-styles";
  if (doc.getElementById(id)) return true;
  const style = doc.createElement("style");
  style.id = id;
  style.textContent = PEARL_POWER_FX_CSS;
  doc.head.appendChild(style);
  return true;
}

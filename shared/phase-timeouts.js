/** Phase timeouts — aligned with Vercel maxDuration (300s); client waits much longer. */

export const PHASE_TIMEOUT = {
  resolve: 60000,
  research: 120000,
  synthesizePrimitive: 180000,
  synthesizeComposite: 270000,
};

/** Client-side fetch abort — 15 min; server/Vercel limits apply first. */
export const CLIENT_ABORT_MS = 900000;

export function synthesizeTimeoutMs(estimatedMs, composite = false) {
  const base = estimatedMs || 30000;
  const ceiling = composite ? PHASE_TIMEOUT.synthesizeComposite : PHASE_TIMEOUT.synthesizePrimitive;
  return Math.min(Math.max(base * 3, 90000), ceiling);
}

export function phaseClientAbortMs(_phase) {
  return CLIENT_ABORT_MS;
}

export function pipelineClientAbortMs(_phases) {
  return CLIENT_ABORT_MS;
}

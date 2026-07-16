export const MERGE_PROXIMITY = Object.freeze({
  armPx: 72,
  releasePx: 96,
  dwellMs: 420,
});

export function nearestMergeTarget(draggedId, pointer, nodes, camera, viewportRect, thresholdPx = MERGE_PROXIMITY.armPx) {
  let nearest = null;
  for (const node of nodes || []) {
    if (!node || node.id === draggedId || node.loading) continue;
    const screenX = viewportRect.left + node.x * camera.scale + camera.x;
    const screenY = viewportRect.top + node.y * camera.scale + camera.y;
    const distancePx = Math.hypot(pointer.x - screenX, pointer.y - screenY);
    if (distancePx <= thresholdPx && (!nearest || distancePx < nearest.distancePx)) {
      nearest = { id: node.id, distancePx };
    }
  }
  return nearest;
}

export function updateMergeProximity(state = {}, input, now = Date.now(), config = MERGE_PROXIMITY) {
  const candidateId = input?.candidateId || null;
  const distancePx = Number(input?.distancePx);
  if (!candidateId || !Number.isFinite(distancePx)) return { candidateId: null, enteredAt: null, armed: false };
  if (state.candidateId === candidateId) {
    if (distancePx > config.releasePx) return { candidateId: null, enteredAt: null, armed: false };
    return {
      candidateId,
      enteredAt: state.enteredAt ?? now,
      armed: state.armed || now - (state.enteredAt ?? now) >= config.dwellMs,
    };
  }
  if (distancePx > config.armPx) return { candidateId: null, enteredAt: null, armed: false };
  return { candidateId, enteredAt: now, armed: false };
}

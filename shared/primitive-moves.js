export const PRIMITIVE_MOVE_PREFERENCES_VERSION = 1;

export function normalizePrimitiveMovePreferences(value = {}, canonicalMoves = []) {
  const canonicalIds = canonicalMoves.filter((move) => move.primitive || move.primitiveMove).map((move) => move.id);
  const demoted = [...new Set(value.demoted || [])];
  const promoted = [...new Set(value.promoted || [])].filter((id) => !demoted.includes(id));
  const active = [...new Set([...canonicalIds.filter((id) => !demoted.includes(id)), ...promoted])];
  const rank = [...new Set([...(value.rank || []), ...active])].filter((id) => active.includes(id));
  return { version: PRIMITIVE_MOVE_PREFERENCES_VERSION, promoted, demoted, rank };
}

export function applyPrimitiveMovePreferences(moves = [], preferences = {}) {
  const normalized = normalizePrimitiveMovePreferences(preferences, moves);
  const rank = new Map(normalized.rank.map((id, index) => [id, index]));
  return moves.map((move) => ({
    ...move,
    primitiveMove: normalized.rank.includes(move.id),
    primitiveRank: rank.has(move.id) ? rank.get(move.id) : null,
  }));
}

export function promotePrimitiveMove(preferences, moveId, canonicalMoves = []) {
  const next = normalizePrimitiveMovePreferences(preferences, canonicalMoves);
  next.demoted = next.demoted.filter((id) => id !== moveId);
  if (!next.promoted.includes(moveId) && !canonicalMoves.some((move) => move.id === moveId && (move.primitive || move.primitiveMove))) next.promoted.push(moveId);
  if (!next.rank.includes(moveId)) next.rank.push(moveId);
  return normalizePrimitiveMovePreferences(next, canonicalMoves);
}

export function demotePrimitiveMove(preferences, moveId, canonicalMoves = []) {
  const next = normalizePrimitiveMovePreferences(preferences, canonicalMoves);
  next.promoted = next.promoted.filter((id) => id !== moveId);
  if (!next.demoted.includes(moveId)) next.demoted.push(moveId);
  next.rank = next.rank.filter((id) => id !== moveId);
  return normalizePrimitiveMovePreferences(next, canonicalMoves);
}

export function reorderPrimitiveMove(preferences, moveId, to, canonicalMoves = []) {
  const next = normalizePrimitiveMovePreferences(preferences, canonicalMoves);
  const from = next.rank.indexOf(moveId);
  if (from < 0) return next;
  const [id] = next.rank.splice(from, 1);
  next.rank.splice(Math.max(0, Math.min(Number(to) || 0, next.rank.length)), 0, id);
  return next;
}

export function primitiveMoveLevels(operators = []) {
  const primitives = operators.filter((op) => op.primitiveMove).sort((a, b) => (a.primitiveRank ?? Infinity) - (b.primitiveRank ?? Infinity) || a.name.localeCompare(b.name));
  const moves = operators.filter((op) => !op.primitiveMove && op.kind !== "pipeline");
  const functions = operators.filter((op) => op.kind === "pipeline");
  return [
    { id: "primitive-moves", label: "Primitive Moves", choices: primitives },
    { id: "moves", label: "Moves", choices: moves },
    { id: "functions", label: "Functions", choices: functions },
  ];
}

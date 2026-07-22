/**
 * Mother companion + orbiting worn-pearl add-ons.
 * The default white primary pearl is always the mother; selected pearls orbit it.
 */

export const COMPANION_PEARL_ORBIT_VERSION = 1;
/** Active working-memory orbit capacity (gauntlet sockets). */
export const MAX_WORN_ORBIT_PEARLS = 5;
export const MOTHER_COMPANION_ID = "companion-mother";

/**
 * Evenly space orbiting add-ons around the mother pearl.
 * Distinct radii from workers (inner) and candidates (outer).
 */
export function wornPearlOrbitSlots(count, options = {}) {
  const n = Math.max(0, Math.min(MAX_WORN_ORBIT_PEARLS, Math.floor(Number(count) || 0)));
  const radius = Number.isFinite(options.radius) ? options.radius : 52;
  const startDeg = Number.isFinite(options.startDeg) ? options.startDeg : -90;
  const slots = [];
  for (let index = 0; index < n; index += 1) {
    const angleDeg = startDeg + (360 / Math.max(n, 1)) * index;
    const rad = (angleDeg * Math.PI) / 180;
    slots.push({
      index,
      angleDeg,
      radius,
      x: Math.cos(rad) * radius,
      y: Math.sin(rad) * radius,
      css: {
        "--worn-index": String(index),
        "--worn-count": String(n),
        "--worn-angle": `${angleDeg}deg`,
        "--worn-radius": `${radius}px`,
      },
    });
  }
  return slots;
}

export function normalizeWornOrbitState(input = {}) {
  const pearlIds = [...new Set(
    (Array.isArray(input.pearlIds) ? input.pearlIds : input.pearlId ? [input.pearlId] : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean),
  )].slice(0, MAX_WORN_ORBIT_PEARLS);
  return {
    version: COMPANION_PEARL_ORBIT_VERSION,
    motherId: MOTHER_COMPANION_ID,
    pearlIds,
    primaryPearlId: pearlIds.includes(input.primaryPearlId) ? input.primaryPearlId : (pearlIds[0] || null),
    updatedAt: Number(input.updatedAt) || Date.now(),
  };
}

export function addPearlToOrbit(state, pearlId) {
  const id = String(pearlId || "").trim();
  if (!id) return normalizeWornOrbitState(state);
  const current = normalizeWornOrbitState(state);
  if (current.pearlIds.includes(id)) return current;
  if (current.pearlIds.length >= MAX_WORN_ORBIT_PEARLS) {
    throw new Error(`At most ${MAX_WORN_ORBIT_PEARLS} pearls can orbit the companion.`);
  }
  return normalizeWornOrbitState({
    ...current,
    pearlIds: [...current.pearlIds, id],
    primaryPearlId: current.primaryPearlId || id,
  });
}

export function removePearlFromOrbit(state, pearlId = null) {
  const current = normalizeWornOrbitState(state);
  if (!pearlId) return normalizeWornOrbitState({ pearlIds: [] });
  const id = String(pearlId).trim();
  const pearlIds = current.pearlIds.filter((entry) => entry !== id);
  return normalizeWornOrbitState({
    ...current,
    pearlIds,
    primaryPearlId: pearlIds.includes(current.primaryPearlId) ? current.primaryPearlId : (pearlIds[0] || null),
  });
}

export function reorderOrbitPearls(state, pearlIds) {
  const current = normalizeWornOrbitState(state);
  const next = [...new Set((pearlIds || []).map((id) => String(id || "").trim()).filter(Boolean))]
    .filter((id) => current.pearlIds.includes(id))
    .slice(0, MAX_WORN_ORBIT_PEARLS);
  for (const id of current.pearlIds) {
    if (!next.includes(id)) next.push(id);
  }
  return normalizeWornOrbitState({ ...current, pearlIds: next });
}

export function mergeWornPearlPacks(packs = []) {
  const list = (Array.isArray(packs) ? packs : []).filter(Boolean);
  if (!list.length) return null;
  if (list.length === 1) {
    return {
      ...list[0],
      orbit: {
        motherId: MOTHER_COMPANION_ID,
        pearlIds: [list[0].pearlId],
        count: 1,
        slots: wornPearlOrbitSlots(1),
      },
    };
  }
  const seenContext = new Set();
  const seenLenses = new Set();
  const seenFunctions = new Set();
  const context = [];
  const lenses = [];
  const functions = [];
  const boundRefs = [];
  for (const pack of list) {
    for (const entry of pack.context || []) {
      const key = entry.id || entry.summary;
      if (seenContext.has(key)) continue;
      seenContext.add(key);
      context.push(entry);
    }
    for (const lens of pack.lenses || []) {
      if (seenLenses.has(lens.id)) continue;
      seenLenses.add(lens.id);
      lenses.push(lens);
    }
    for (const fn of pack.functions || []) {
      if (seenFunctions.has(fn.id)) continue;
      seenFunctions.add(fn.id);
      functions.push(fn);
    }
    boundRefs.push(...(pack.boundRefs || []));
  }
  return {
    version: list[0].version,
    pearlId: list[0].pearlId,
    name: list.map((pack) => pack.name).join(" · "),
    kind: "orbit-pack",
    representationKind: "composed",
    wornAt: Math.min(...list.map((pack) => pack.wornAt || Date.now())),
    context: context.slice(0, 80),
    lenses: lenses.slice(0, 40),
    functions: functions.slice(0, 48),
    boundRefs: [...new Set(boundRefs)].slice(0, 80),
    packs: list,
    summary: `${list.length} orbiting pearls · ${context.length} context · ${lenses.length} lenses · ${functions.length} functions`,
    capabilities: {
      canExecuteBoundFunctions: functions.length > 0,
      canApplyLenses: lenses.length > 0,
      hasContext: context.length > 0,
      multiWear: true,
    },
    orbit: {
      motherId: MOTHER_COMPANION_ID,
      pearlIds: list.map((pack) => pack.pearlId),
      count: list.length,
      slots: wornPearlOrbitSlots(list.length),
    },
  };
}

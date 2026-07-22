/**
 * Extension gauntlet — five active pearl slots as working memory.
 * The companion is the gauntlet; toolkit pearls load into slots without replacing the mother.
 */

import {
  MAX_WORN_ORBIT_PEARLS,
  wornPearlOrbitSlots,
} from "./companion-pearl-orbit.js";
import {
  loadWornOrbitState,
  saveWornOrbitState,
  normalizeWornOrbitState,
} from "./companion-pearl-wear.js";

export const GAUNTLET_VERSION = 1;
export const MAX_GAUNTLET_SLOTS = 5;
export const GAUNTLET_STORAGE_KEY = "lens.companion.gauntlet.v1";

const emptySlots = () => Array.from({ length: MAX_GAUNTLET_SLOTS }, () => null);

export function normalizeGauntletState(input = {}) {
  const fromSlots = Array.isArray(input.slots) ? input.slots : null;
  const fromIds = Array.isArray(input.pearlIds) ? input.pearlIds : (input.pearlId ? [input.pearlId] : []);
  const slots = emptySlots();
  if (fromSlots) {
    for (let i = 0; i < MAX_GAUNTLET_SLOTS; i += 1) {
      const id = fromSlots[i] == null || fromSlots[i] === "" ? null : String(fromSlots[i]);
      slots[i] = id;
    }
  } else {
    const unique = [...new Set(fromIds.map((id) => String(id || "").trim()).filter(Boolean))];
    unique.slice(0, MAX_GAUNTLET_SLOTS).forEach((id, index) => { slots[index] = id; });
  }
  // Deduplicate while preserving first slot occupancy.
  const seen = new Set();
  for (let i = 0; i < slots.length; i += 1) {
    if (!slots[i]) continue;
    if (seen.has(slots[i])) slots[i] = null;
    else seen.add(slots[i]);
  }
  const pearlIds = slots.filter(Boolean);
  return {
    version: GAUNTLET_VERSION,
    kind: "gauntlet",
    slots,
    pearlIds,
    filled: pearlIds.length,
    capacity: MAX_GAUNTLET_SLOTS,
    activeSlot: Number.isInteger(input.activeSlot)
      && input.activeSlot >= 0
      && input.activeSlot < MAX_GAUNTLET_SLOTS
      && slots[input.activeSlot]
      ? input.activeSlot
      : (pearlIds.length ? slots.findIndex((id) => id === pearlIds[0]) : null),
    updatedAt: Number(input.updatedAt) || Date.now(),
  };
}

export function gauntletOrbitSlots(filledCount = MAX_GAUNTLET_SLOTS) {
  return wornPearlOrbitSlots(Math.min(MAX_GAUNTLET_SLOTS, Math.max(0, filledCount)), {
    radius: 44,
    startDeg: -110,
  });
}

/** Fixed five visual socket positions around the gauntlet (empty sockets still render). */
export function gauntletSocketLayout(options = {}) {
  return wornPearlOrbitSlots(MAX_GAUNTLET_SLOTS, {
    radius: Number.isFinite(options.radius) ? options.radius : 44,
    startDeg: Number.isFinite(options.startDeg) ? options.startDeg : -110,
  }).map((slot, index) => ({
    ...slot,
    socketIndex: index,
  }));
}

/** Persist wear into the next open gauntlet socket (throws when full). */
export function wearPearlIdInGauntlet(pearlId, options = {}, storage = globalThis.localStorage) {
  return saveGauntletState(wearPearlInGauntlet(loadGauntletState(storage), pearlId, options), storage);
}

/** Remove one socket (id or index) or clear the whole gauntlet. */
export function removePearlIdFromGauntlet(pearlIdOrSlot = null, storage = globalThis.localStorage) {
  return saveGauntletState(removePearlFromGauntlet(loadGauntletState(storage), pearlIdOrSlot), storage);
}

export function loadGauntletState(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem?.(GAUNTLET_STORAGE_KEY);
    if (raw) return normalizeGauntletState(JSON.parse(raw));
  } catch { /* migrate from wear orbit */ }
  const orbit = loadWornOrbitState(storage);
  return normalizeGauntletState({
    pearlIds: orbit.pearlIds.slice(0, MAX_GAUNTLET_SLOTS),
    updatedAt: orbit.updatedAt,
  });
}

export function saveGauntletState(state, storage = globalThis.localStorage) {
  const next = normalizeGauntletState(state);
  if (!storage) return next;
  storage.setItem?.(GAUNTLET_STORAGE_KEY, JSON.stringify(next));
  // Keep wear-orbit mirror in sync for companion packs / page bridge.
  saveWornOrbitState({
    pearlIds: next.pearlIds,
    primaryPearlId: next.slots[next.activeSlot] || next.pearlIds[0] || null,
    updatedAt: next.updatedAt,
  }, storage);
  return next;
}

export function wearPearlInGauntlet(state, pearlId, options = {}) {
  const id = String(pearlId || "").trim();
  if (!id) return normalizeGauntletState(state);
  const current = normalizeGauntletState(state);
  const existing = current.slots.indexOf(id);
  if (existing >= 0) {
    return normalizeGauntletState({ ...current, activeSlot: existing, updatedAt: Date.now() });
  }
  if (options.replace === true) {
    const slots = emptySlots();
    slots[0] = id;
    return normalizeGauntletState({ slots, activeSlot: 0, updatedAt: Date.now() });
  }
  const open = current.slots.findIndex((slot) => !slot);
  if (open < 0) {
    throw new Error(`Gauntlet is full (${MAX_GAUNTLET_SLOTS} active pearls). Remove one before wearing another.`);
  }
  const slots = [...current.slots];
  const target = Number.isInteger(options.slot) && options.slot >= 0 && options.slot < MAX_GAUNTLET_SLOTS && !slots[options.slot]
    ? options.slot
    : open;
  slots[target] = id;
  return normalizeGauntletState({ slots, activeSlot: target, updatedAt: Date.now() });
}

export function removePearlFromGauntlet(state, pearlIdOrSlot = null) {
  const current = normalizeGauntletState(state);
  if (pearlIdOrSlot == null || pearlIdOrSlot === "") {
    return normalizeGauntletState({ slots: emptySlots(), activeSlot: null, updatedAt: Date.now() });
  }
  const slots = [...current.slots];
  if (Number.isInteger(pearlIdOrSlot) || /^\d+$/.test(String(pearlIdOrSlot))) {
    const index = Number(pearlIdOrSlot);
    if (index >= 0 && index < MAX_GAUNTLET_SLOTS) slots[index] = null;
  } else {
    const id = String(pearlIdOrSlot);
    for (let i = 0; i < slots.length; i += 1) {
      if (slots[i] === id) slots[i] = null;
    }
  }
  return normalizeGauntletState({ slots, updatedAt: Date.now() });
}

export function setGauntletActiveSlot(state, slotIndex) {
  const current = normalizeGauntletState(state);
  const index = Number(slotIndex);
  if (!Number.isInteger(index) || index < 0 || index >= MAX_GAUNTLET_SLOTS || !current.slots[index]) {
    throw new Error("Gauntlet slot is empty or out of range.");
  }
  return normalizeGauntletState({ ...current, activeSlot: index, updatedAt: Date.now() });
}

export function reorderGauntletSlots(state, orderedPearlIds = []) {
  const current = normalizeGauntletState(state);
  const wanted = [...new Set((orderedPearlIds || []).map((id) => String(id || "").trim()).filter(Boolean))]
    .filter((id) => current.pearlIds.includes(id))
    .slice(0, MAX_GAUNTLET_SLOTS);
  for (const id of current.pearlIds) {
    if (!wanted.includes(id)) wanted.push(id);
  }
  return normalizeGauntletState({ pearlIds: wanted, updatedAt: Date.now() });
}

export function gauntletSummary(state, packsById = {}) {
  const gauntlet = normalizeGauntletState(state);
  return {
    ...gauntlet,
    sockets: gauntlet.slots.map((pearlId, index) => ({
      index,
      pearlId,
      empty: !pearlId,
      active: gauntlet.activeSlot === index,
      pack: pearlId ? packsById[pearlId] || { pearlId, name: pearlId } : null,
      layout: gauntletSocketLayout()[index],
    })),
    // Cap note for shared orbit helpers that still allow up to MAX_WORN_ORBIT_PEARLS on web.
    orbitCap: MAX_GAUNTLET_SLOTS,
    toolkitCap: MAX_WORN_ORBIT_PEARLS,
  };
}

export function syncGauntletFromWearOrbit(storage = globalThis.localStorage) {
  const orbit = normalizeWornOrbitState(loadWornOrbitState(storage));
  return saveGauntletState({
    pearlIds: orbit.pearlIds.slice(0, MAX_GAUNTLET_SLOTS),
    updatedAt: Date.now(),
  }, storage);
}

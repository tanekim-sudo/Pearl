import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_GAUNTLET_SLOTS,
  gauntletSocketLayout,
  loadGauntletState,
  normalizeGauntletState,
  removePearlFromGauntlet,
  removePearlIdFromGauntlet,
  saveGauntletState,
  wearPearlIdInGauntlet,
  wearPearlInGauntlet,
} from "./companion-pearl-gauntlet.js";
import { loadWornOrbitState } from "./companion-pearl-wear.js";

function memoryStorage() {
  const memory = new Map();
  return {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, String(value)),
    removeItem: (key) => memory.delete(key),
  };
}

test("gauntlet has five sockets and fills the next empty slot", () => {
  let state = normalizeGauntletState();
  assert.equal(state.capacity, 5);
  assert.equal(MAX_GAUNTLET_SLOTS, 5);
  assert.equal(gauntletSocketLayout().length, 5);
  state = wearPearlInGauntlet(state, "a");
  state = wearPearlInGauntlet(state, "b");
  assert.deepEqual(state.slots.slice(0, 2), ["a", "b"]);
  assert.equal(state.filled, 2);
  assert.equal(state.activeSlot, 1);
});

test("gauntlet refuses a sixth pearl and supports remove by id or slot", () => {
  let state = normalizeGauntletState();
  for (const id of ["a", "b", "c", "d", "e"]) state = wearPearlInGauntlet(state, id);
  assert.throws(() => wearPearlInGauntlet(state, "f"));
  state = removePearlFromGauntlet(state, "c");
  assert.equal(state.slots[2], null);
  assert.equal(state.filled, 4);
  state = wearPearlInGauntlet(state, "f");
  assert.equal(state.slots[2], "f");
  state = removePearlFromGauntlet(state, 0);
  assert.equal(state.slots[0], null);
});

test("gauntlet persistence mirrors wear orbit for bridge packs", () => {
  const storage = memoryStorage();
  saveGauntletState(wearPearlInGauntlet({}, "p1"), storage);
  saveGauntletState(wearPearlInGauntlet(loadGauntletState(storage), "p2"), storage);
  const loaded = loadGauntletState(storage);
  assert.deepEqual(loaded.pearlIds, ["p1", "p2"]);
  assert.deepEqual(loadWornOrbitState(storage).pearlIds, ["p1", "p2"]);
});

test("storage helpers wear and remove without silently dropping a sixth pearl", () => {
  const storage = memoryStorage();
  for (const id of ["a", "b", "c", "d", "e"]) wearPearlIdInGauntlet(id, {}, storage);
  assert.throws(() => wearPearlIdInGauntlet("f", {}, storage));
  assert.deepEqual(loadGauntletState(storage).pearlIds, ["a", "b", "c", "d", "e"]);
  removePearlIdFromGauntlet("c", storage);
  wearPearlIdInGauntlet("f", { slot: 2 }, storage);
  assert.equal(loadGauntletState(storage).slots[2], "f");
});

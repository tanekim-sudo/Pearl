import assert from "node:assert/strict";
import test from "node:test";
import {
  addPearlToOrbit,
  mergeWornPearlPacks,
  normalizeWornOrbitState,
  removePearlFromOrbit,
  wornPearlOrbitSlots,
} from "./companion-pearl-orbit.js";
import {
  addWornPearlId,
  buildWornPearlPack,
  loadWornOrbitState,
  loadWornPearlId,
  removeWornPearlId,
  saveWornPearlId,
} from "./companion-pearl-wear.js";

test("orbit slots space worn pearls around the mother", () => {
  const slots = wornPearlOrbitSlots(3);
  assert.equal(slots.length, 3);
  assert.equal(slots[0].angleDeg, -90);
  assert.ok(Math.abs(slots[0].x) < 1e-9);
  assert.ok(slots[0].y < 0);
});

test("multi-wear storage migrates v1 single pearlId", () => {
  const memory = new Map();
  const storage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, String(value)),
    removeItem: (key) => memory.delete(key),
  };
  saveWornPearlId("p1", storage);
  assert.equal(loadWornPearlId(storage), "p1");
  addWornPearlId("p2", storage);
  const orbit = loadWornOrbitState(storage);
  assert.deepEqual(orbit.pearlIds, ["p1", "p2"]);
  removeWornPearlId("p1", storage);
  assert.deepEqual(loadWornOrbitState(storage).pearlIds, ["p2"]);
});

test("merged packs keep distinct context and mark multiWear", () => {
  const a = buildWornPearlPack({
    id: "a",
    name: "A",
    workingSet: { context: [{ id: "c1", label: "one" }], lenses: [] },
  });
  const b = buildWornPearlPack({
    id: "b",
    name: "B",
    workingSet: { context: [{ id: "c2", label: "two" }], lenses: [{ id: "l1", name: "Lens" }] },
  });
  const merged = mergeWornPearlPacks([a, b]);
  assert.equal(merged.capabilities.multiWear, true);
  assert.equal(merged.orbit.count, 2);
  assert.equal(merged.context.length, 2);
  assert.equal(merged.lenses.length, 1);
});

test("orbit helpers refuse more than eight pearls", () => {
  let state = normalizeWornOrbitState();
  for (let i = 0; i < 8; i += 1) state = addPearlToOrbit(state, `p${i}`);
  assert.throws(() => addPearlToOrbit(state, "p9"));
  state = removePearlFromOrbit(state, "p0");
  assert.equal(state.pearlIds.length, 7);
});

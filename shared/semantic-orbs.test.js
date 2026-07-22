import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPearlMutualObservations,
  createSemanticOrb,
  summarizeSemanticOrbForSynthesis,
} from "./semantic-orbs.js";

function orb(id, name, extras = {}) {
  return createSemanticOrb({
    id,
    name,
    sceneId: "scene-1",
    placement: { x: 0, y: 0 },
    representation: { kind: "material", refs: [`mat-${id}`], label: name },
    workingSet: {
      context: [{ id: `ctx-${id}`, text: `${name} note`, label: `${name} note` }],
      lenses: [{ id: `lens-${id}`, name: `${name} Lens` }],
    },
    ...extras,
  });
}

test("mutual synthesize builds bidirectional observations without mutating sources", () => {
  const a = orb("a", "Alpha");
  const b = orb("b", "Beta");
  const snapshotA = structuredClone(a);
  const snapshotB = structuredClone(b);
  const result = buildPearlMutualObservations([a, b], { mode: "mutual" });
  assert.equal(result.mode, "mutual");
  assert.deepEqual(result.sourceIds, ["a", "b"]);
  assert.equal(result.observations.length, 2);
  assert.ok(result.observations.some((item) => item.fromPearlId === "a" && item.aboutPearlId === "b"));
  assert.ok(result.observations.some((item) => item.fromPearlId === "b" && item.aboutPearlId === "a"));
  assert.match(result.observations[0].text, /notices about/);
  assert.deepEqual(a, snapshotA);
  assert.deepEqual(b, snapshotB);
});

test("directed synthesize is one-way apply onto", () => {
  const result = buildPearlMutualObservations([orb("a", "Alpha"), orb("b", "Beta")], {
    mode: "directed",
    instruction: "find tensions",
  });
  assert.equal(result.mode, "directed");
  assert.equal(result.observations.length, 1);
  assert.equal(result.observations[0].fromPearlId, "a");
  assert.equal(result.observations[0].aboutPearlId, "b");
  assert.match(result.observations[0].text, /find tensions/);
});

test("summarizeSemanticOrbForSynthesis exposes lens and context labels", () => {
  const summary = summarizeSemanticOrbForSynthesis(orb("a", "Alpha"));
  assert.equal(summary.id, "a");
  assert.deepEqual(summary.lensNames, ["Alpha Lens"]);
  assert.ok(summary.contextLabels.includes("Alpha note"));
});

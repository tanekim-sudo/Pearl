import test from "node:test";
import assert from "node:assert/strict";
import {
  collectPearlDump,
  organizePearlContents,
  applyOrganizeToPearl,
} from "./pearl-organize.js";
import { buildCounterPearlSpec } from "./pearl-counter.js";
import { buildGauntletEvaluationQuery } from "./pearl-gauntlet-eval.js";

test("organizePearlContents maps multimodal dump into Moves → Functions → Lenses without dropping evidence", () => {
  const pearl = {
    id: "orb-messy",
    name: "Messy startup dump",
    workingSet: {
      context: [
        { id: "c1", kind: "text", text: "As a skeptical LP, evaluate traction and moat for this deck. Care about capital efficiency." },
        { id: "c2", kind: "drawing", label: "whiteboard sketch", text: "Draw the competitive map and compare alternatives." },
        { id: "c3", kind: "transcript", text: "Voice note: rewrite the problem slide but keep the weird metaphors." },
        { id: "c1-dup", kind: "text", text: "As a skeptical LP, evaluate traction and moat for this deck. Care about capital efficiency." },
      ],
      lenses: [],
    },
    moves: [],
    functions: [],
    lenses: [],
  };
  const organized = organizePearlContents(pearl);
  assert.equal(organized.ok, true);
  assert.deepEqual(organized.organization.order, ["moves", "weights", "lenses"]);
  assert.ok(organized.organization.moves.length >= 2);
  assert.ok(organized.organization.lenses.length >= 1);
  assert.equal(organized.preservedEvidence.length, 4, "all dump units preserved including near-duplicate");
  assert.ok(organized.removedRedundantCount >= 1, "near-duplicate structure collapsed");
  const applied = applyOrganizeToPearl(pearl, organized);
  assert.equal(applied.workingSet.context.length, 4);
  assert.ok(applied.provenance.organize);
  assert.equal(collectPearlDump(pearl).length >= 4, true);
});

test("buildCounterPearlSpec creates opposition lineage without mutating source fields", () => {
  const source = {
    id: "orb-startup",
    name: "3-year startup pearl",
    placement: { x: 10, y: 20, radius: 24 },
    workingSet: {
      context: [{ id: "ctx-1", text: "Prefer capital-efficient B2B" }],
      lenses: [{ id: "lens-1", name: "Skeptical LP", strength: 0.8 }],
    },
    lenses: [{ id: "lens-1", name: "Skeptical LP", strength: 0.8 }],
    moves: [{ id: "m1", name: "Underwrite" }],
  };
  const frozen = structuredClone(source);
  const spec = buildCounterPearlSpec(source, { instruction: "foil the LP taste" });
  assert.equal(spec.representation.kind, "counter");
  assert.equal(spec.representation.opposition, true);
  assert.deepEqual(spec.lineage[0], { orbId: "orb-startup", operation: "counter", preserved: true, mode: "opposition" });
  assert.ok(spec.moves.length >= 3);
  assert.ok(spec.lenses.some((lens) => /foil|Disconfirm|Failure/i.test(lens.name)));
  assert.equal(spec.provenance.counter.sourcePearlId, "orb-startup");
  assert.deepEqual(source, frozen, "source pearl must remain unchanged");
});

test("buildGauntletEvaluationQuery requires packs and disclosed material", () => {
  const empty = buildGauntletEvaluationQuery({ packs: [], material: { text: "deck" } });
  assert.equal(empty.ok, false);
  assert.match(empty.reason, /empty/i);

  const noMaterial = buildGauntletEvaluationQuery({
    packs: [{ pearlId: "p1", name: "Startup", lenses: [{ name: "LP" }], context: [], functions: [] }],
    material: {},
  });
  assert.equal(noMaterial.ok, false);
  assert.match(noMaterial.reason, /captured|paste/i);

  const ready = buildGauntletEvaluationQuery({
    packs: [{
      pearlId: "p1",
      name: "3-year startup pearl",
      lenses: [{ name: "Skeptical LP", description: "Care about capital efficiency" }],
      moves: [{ name: "Underwrite" }],
      functions: [{ name: "Deck review" }],
      context: [{ summary: "Prefer B2B" }],
    }],
    material: { text: "Slide 1: We are Uber for dentists.", title: "Deck", url: "https://example.com/deck" },
    instruction: "Evaluate this startup deck",
  });
  assert.equal(ready.ok, true);
  assert.equal(ready.requiresModel, true);
  assert.match(ready.query.prompt, /GAUNTLET CULTIVATED EVALUATION/);
  assert.match(ready.query.prompt, /Skeptical LP/);
  assert.match(ready.query.prompt, /Uber for dentists/);
  assert.equal(ready.query.disclosure.characters > 0, true);
});

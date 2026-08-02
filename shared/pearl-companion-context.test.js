import assert from "node:assert/strict";
import test from "node:test";
import {
  attachPearlCompanionContext,
  buildPearlCompanionContext,
  formatPearlCompanionContextForModel,
  scrubPearlMetadataFromUserText,
  userAskedToRevealPearlMetadata,
  userFacingPearlWearMessage,
} from "./pearl-companion-context.js";

const samplePearl = {
  id: "pearl:abc-123",
  name: "Investor notes",
  systemPrompt: "Be skeptical. Always list risks.",
  purpose: "LP briefings",
  kind: "semantic",
  revision: 3,
  representation: { kind: "function" },
  functions: [{ id: "fn-1", name: "Memo", description: "Write memo", steps: [{ name: "Draft" }, { name: "Risks" }] }],
  moves: [{ id: "m1", name: "Challenge", description: "Push back" }],
  lenses: [{ id: "l1", name: "Skeptical", strength: 0.9 }],
  workingSet: {
    context: [{ id: "c1", kind: "material", label: "CRM export", text: "thesis…" }],
    lenses: [{ id: "l1", name: "Skeptical", strength: 0.9 }],
  },
  privacyPolicy: {
    audience: "local-only",
    sensitivity: "firm-internal",
    storage: { mode: "device-only" },
    disclosure: { research: { allowed: false } },
  },
  relationships: { parentPearlId: "pearl:parent", relatedPearlIds: ["pearl:r1"] },
  history: { checkpoints: [{ id: "cp1" }] },
  aesthetic: { preset: "ink", label: "Ink" },
};

test("buildPearlCompanionContext includes system prompt and app wear state", () => {
  const ctx = buildPearlCompanionContext(samplePearl, {
    wornPearlIds: ["pearl:abc-123"],
    primaryPearlId: "pearl:abc-123",
    gauntletFilled: 1,
    gauntletCapacity: 5,
    sceneId: "scene-1",
    sceneName: "Shelf",
  });
  assert.equal(ctx.name, "Investor notes");
  assert.match(ctx.systemPrompt, /skeptical/i);
  assert.equal(ctx.functions[0].name, "Memo");
  assert.equal(ctx.functions[0].moveCount, 2);
  assert.equal(ctx.lenses[0].name, "Skeptical");
  assert.equal(ctx.gauntlet.worn, true);
  assert.equal(ctx.gauntlet.primary, true);
  assert.equal(ctx.scene.name, "Shelf");
  assert.match(ctx.privacy.summary, /local-only|firm-internal|research locked/i);
  assert.match(ctx.lineage.versionHint, /revision 3/);
});

test("formatPearlCompanionContextForModel is model-facing and complete", () => {
  const ctx = buildPearlCompanionContext(samplePearl, { wornPearlIds: ["pearl:abc-123"] });
  const text = formatPearlCompanionContextForModel(ctx);
  assert.match(text, /System prompt/);
  assert.match(text, /Be skeptical/);
  assert.match(text, /Functions:/);
  assert.match(text, /Lenses/);
  assert.match(text, /Privacy:/);
  assert.match(text, /do not echo ids/i);
});

test("userFacingPearlWearMessage hides ids and metadata", () => {
  const ctx = buildPearlCompanionContext(samplePearl, { wornPearlIds: ["pearl:abc-123"] });
  const msg = userFacingPearlWearMessage(ctx);
  assert.match(msg, /Investor notes/);
  assert.doesNotMatch(msg, /pearl:abc/);
  assert.doesNotMatch(msg, /schemaVersion|firm-internal|revision/);
});

test("scrubPearlMetadataFromUserText strips ids unless power path", () => {
  const dirty = 'Wearing “Memo” (pearl:abc-123). rev 3 · semantic orb · {"audience":"local-only","sensitivity":"x"} step:2';
  const clean = scrubPearlMetadataFromUserText(dirty);
  assert.doesNotMatch(clean, /pearl:abc/);
  assert.doesNotMatch(clean, /rev 3/);
  assert.doesNotMatch(clean, /semantic orb/i);
  assert.doesNotMatch(clean, /audience/);
  assert.equal(userAskedToRevealPearlMetadata("show me the pearl id"), true);
  const revealed = scrubPearlMetadataFromUserText(dirty, { utterance: "show me the pearl id" });
  assert.match(revealed, /pearl:abc/);
});

test("attachPearlCompanionContext enriches a worn pack", () => {
  const pack = attachPearlCompanionContext(
    { pearlId: samplePearl.id, name: samplePearl.name, systemPrompt: samplePearl.systemPrompt },
    samplePearl,
    { wornPearlIds: [samplePearl.id] },
  );
  assert.ok(pack.companionContext);
  assert.equal(pack.companionContext.functions.length, 1);
  assert.ok(pack.privacy?.summary);
});

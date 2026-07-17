import test from "node:test";
import assert from "node:assert/strict";

import {
  applyTasteLensDiff,
  attachTasteBeforeAfter,
  compileTasteJudgmentEnvelope,
  createTasteLensModel,
  evaluateThroughTasteLens,
  exportTasteLensModel,
  interpretTasteTeaching,
  mergeTasteLenses,
  proposeTasteLensDiff,
} from "./taste-lens.js";
import { executeDomainCommand } from "./domain-commands.js";
import { createLensFromDrop } from "./library-objects.js";

test("Taste Lens extends the one canonical perceptual Lens model", () => {
  const model = createTasteLensModel({ domains: ["writing"], scopes: ["account"] });
  assert.ok(model.profile.purposes.includes("taste/judgment"));
  assert.deepEqual(model.profile.domains, ["writing"]);
  assert.equal(model.profile.privacy.rawExamples, "private");
  assert.ok(model.sections.preferences);
  assert.ok(model.sections.pairedExamples);
});

test("natural filler teaching creates an editable negative principle with exceptions", () => {
  const interpretation = interpretTasteTeaching("I hate filler words.", {
    explicitSave: true,
    source: { id: "utterance-1", sourceType: "voice", scope: "account" },
  });
  assert.equal(interpretation.persistentIntent, true);
  assert.equal(interpretation.operations.length, 1);
  assert.match(interpretation.operations[0].text, /filler words/);
  assert.ok(interpretation.operations[0].conditions.some((condition) => /quoted speech/i.test(condition)));

  const diff = proposeTasteLensDiff(createTasteLensModel({ domains: ["writing"] }), interpretation);
  const applied = applyTasteLensDiff(createTasteLensModel({ domains: ["writing"] }), diff);
  assert.equal(applied.model.sections.antiPatterns.length, 1);
  assert.equal(applied.receipt.undo.restoreFingerprint, diff.baseFingerprint);
});

test("AI-generated-looking request becomes observable suggestions, never a detector claim", () => {
  const interpretation = interpretTasteTeaching("Get rid of anything that looks AI generated.", { explicitSave: true });
  assert.ok(interpretation.operations.length >= 6);
  assert.match(interpretation.caveats[0], /No reliable perfect AI-text detector/);
  assert.ok(interpretation.operations.every((operation) => /not an AI-authorship detector/i.test(operation.definition)));
  assert.ok(interpretation.operations.every((operation) => operation.reviewStatus === "unreviewed"));
});

test("persistent mutation requires explicit save while run preserve overrides stay transient", () => {
  const model = createTasteLensModel({ domains: ["writing"] });
  const diff = proposeTasteLensDiff(model, "Prefer concise sentences");
  assert.equal(diff.persistentIntent, false);
  assert.throws(() => applyTasteLensDiff(model, diff), /explicit save or remember intent/);

  const envelope = compileTasteJudgmentEnvelope({ id: "writing-taste", version: 3, perceptualModel: model }, {
    preserve: ["the author's unusual rhythm"],
  });
  assert.equal(envelope.runOverrides.length, 1);
  assert.match(envelope.sections.preserve[0].text, /unusual rhythm/);
  assert.equal(model.sections.preserve.length, 0);
});

test("before/after creates a selective review diff and keeps private artifact refs", () => {
  const model = createTasteLensModel({ domains: ["writing"] });
  const diff = attachTasteBeforeAfter(model, {
    before: { id: "before-1", modality: "text", private: true },
    after: { id: "after-1", modality: "text", private: true },
    preserved: ["technical precision"],
  }, { explicitSave: true, inferredPrinciple: "Remove repetition while keeping technical precision" });
  assert.equal(diff.operations[0].section, "pairedExamples");
  const applied = applyTasteLensDiff(model, diff);
  assert.equal(applied.model.sections.pairedExamples[0].pair.beforeRef.id, "before-1");
  assert.equal(applied.model.sections.pairedExamples[0].reviewStatus, "unreviewed");
});

test("judgment returns evidence and a separate preserve-original revision Function", () => {
  const model = createTasteLensModel({ domains: ["writing"] });
  const diff = proposeTasteLensDiff(model, interpretTasteTeaching("Remember: avoid canned framing", { explicitSave: true }));
  const applied = applyTasteLensDiff(model, diff);
  const envelope = compileTasteJudgmentEnvelope({ id: "writing", version: 2, perceptualModel: applied.model });
  const evaluation = evaluateThroughTasteLens("This uses canned framing throughout.", envelope);
  assert.equal(evaluation.violations.length, 1);
  assert.equal(evaluation.suggestedAction.name, "Revise to fit Lens");
  assert.equal(evaluation.suggestedAction.preserveOriginal, true);
  assert.match(evaluation.uncertainty, /not an objective scalar/);
});

test("Lens merge surfaces conflicts and public export omits private examples", () => {
  const concise = createTasteLensModel({
    current: { sections: { preserve: ["include lyrical detail"], pairedExamples: [{ text: "private pair", source: { private: true } }] } },
    domains: ["writing"],
  });
  const lyrical = createTasteLensModel({
    current: { sections: { preserve: ["not include lyrical detail"] } },
    domains: ["writing"],
  });
  const merged = mergeTasteLenses([concise, lyrical]);
  assert.ok(merged.conflicts.length);
  const exported = exportTasteLensModel(concise);
  assert.equal(exported.sections.pairedExamples.length, 0);
});

test("canonical domain command versions accepted Taste Lens diffs with undo", async () => {
  const lens = createLensFromDrop([], {
    id: "writing-taste",
    name: "Writing Taste",
    perceptualModel: createTasteLensModel({ domains: ["writing"] }),
  });
  const diff = proposeTasteLensDiff(lens.perceptualModel, interpretTasteTeaching("Remember: prefer concrete evidence", { explicitSave: true }));
  const execution = await executeDomainCommand("applyTasteLensDiff", { objects: [lens] }, {
    lensId: lens.id,
    expectedVersion: lens.version,
    diff,
    acceptedOperationIds: diff.operations.map((operation) => operation.id),
    explicitSave: true,
  }, { now: 1234, idFactory: () => "unused" });
  assert.equal(execution.result.effects.includes("taste-lens-versioned"), true);
  assert.equal(execution.result.object.version, lens.version + 1);
  assert.equal(execution.undo().objects[0].version, lens.version);
});

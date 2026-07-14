import test from "node:test";
import assert from "node:assert/strict";
import {
  addGrindExample,
  applyCompiledGrind,
  buildGrindCompilationPrompt,
  createGrindDraft,
  deterministicFidelity,
  forgedOperatorFromDraft,
  manualForgedSkeleton,
  removeGrindExample,
  reorderGrindExample,
  testForgedDraft,
} from "./lens-grinding.js";

const example = (id, input, output, extra = {}) => ({ id, input, output, note: `liked ${id}`, domain: "mixed", ...extra });

test("grind drafts retain input, output, notes, polarity and provenance", () => {
  let draft = createGrindDraft({ id: "g" });
  draft = addGrindExample(draft, example("a", "claim", "specific counterexample", { source: { lensId: "ground", historyId: "h1" } }));
  draft = addGrindExample(draft, example("b", "idea", "bad result", { polarity: "negative" }));
  assert.equal(draft.examples[0].source.lensId, "ground");
  assert.equal(draft.examples[1].polarity, "negative");
  draft = reorderGrindExample(draft, "b", 0);
  assert.equal(draft.examples[0].id, "b");
  draft = removeGrindExample(draft, "b");
  assert.deepEqual(draft.examples.map((entry) => entry.id), ["a"]);
});

test("compilation prompt includes pairs, notes, negatives and generalization", () => {
  const draft = createGrindDraft({
    examples: [
      example("a", "abstract claim", "dated concrete disproof"),
      example("b", "startup thesis", "named customer counterexample", { polarity: "negative" }),
    ],
  });
  const built = buildGrindCompilationPrompt(draft);
  assert.match(built.prompt, /Generalize.*across domains/i);
  assert.match(built.prompt, /INPUT:\nabstract claim/);
  assert.match(built.prompt, /negative/);
  assert.match(built.prompt, /WHY USER KEPT IT/);
});

test("token budget omits excess examples without truncating pairs", () => {
  const huge = "word ".repeat(1000);
  const draft = createGrindDraft({
    examples: [example("a", huge, huge), example("b", huge, huge), example("c", huge, huge)],
  });
  const built = buildGrindCompilationPrompt(draft, { tokenBudget: 3000, maxExampleChars: 800 });
  assert.ok(built.approximateTokens <= 3000);
  assert.ok(built.includedExampleIds.length >= 2);
});

test("sensitive tokens are stripped", () => {
  const draft = createGrindDraft({
    examples: [
      example("a", "token sk-abcdefghijklmnopqrst", "safe output"),
      example("b", "other", "Bearer abcdefghijklmnopqrstuvwxyz"),
    ],
  });
  const built = buildGrindCompilationPrompt(draft);
  assert.doesNotMatch(built.prompt, /sk-abcdefghijklmnopqrst/);
  assert.match(built.prompt, /\[redacted\]/);
});

test("manual fallback produces an editable skeleton, never fake success", () => {
  const draft = createGrindDraft({ examples: [example("a", "x", "y"), example("b", "m", "n")] });
  const skeleton = manualForgedSkeleton(draft);
  assert.equal(skeleton.manualFallback, true);
  assert.ok(skeleton.generalizedPrompt);
});

test("compiled proposal versions and saves forged provenance", () => {
  const draft = createGrindDraft({ id: "g", examples: [example("a", "x", "y"), example("b", "m", "n")] });
  const shaped = applyCompiledGrind(draft, {
    name: "Concrete inversion",
    generalizedPrompt: "Return a concrete counterexample.",
    rules: ["invert", "ground"],
  });
  const op = forgedOperatorFromDraft(shaped, () => "forged");
  assert.equal(op.id, "forged");
  assert.equal(op.lensKind, "forged");
  assert.deepEqual(op.forgedFrom.exampleIds, ["a", "b"]);
  assert.equal(shaped.versions.length, 1);
});

test("holdout testing reports deterministic evidence without a fake score", async () => {
  const draft = createGrindDraft({ examples: [example("a", "x", "alpha beta"), example("b", "m", "alpha gamma")] });
  const results = await testForgedDraft(draft, async () => "alpha delta");
  assert.equal(results.length, 1);
  assert.equal(results[0].rubric, null);
  assert.match(results[0].deterministic.label, /deterministic/);
  assert.equal(deterministicFidelity("same", "same").exact, true);
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  BEFORE_AFTER_SCHEMA_VERSION,
  emptyExample,
  examplesForPublicExport,
  inferenceResultToOperator,
  normalizeBeforeAfterExamples,
  normalizeInferenceResult,
  validateBeforeAfterExamples,
} from "./before-after-examples.js";
import { createLensPack, importLensPack } from "./lens-rack.js";

const textPair = () => ({
  version: BEFORE_AFTER_SCHEMA_VERSION,
  private: true,
  examples: [{
    id: "pair",
    counterexample: false,
    before: { text: "A long paragraph", assets: [], objectRefs: [] },
    after: { text: "- one bullet", assets: [], objectRefs: [] },
  }],
});

const inference = () => ({
  name: "Bullet summary",
  summary: "Condense prose into bullets",
  operation: "Extract the essential claims and return concise bullets. Preserve factual meaning and do not add facts.",
  invariants: ["factual meaning"],
  changes: ["reformat as bullets", "remove repetition"],
  inputRequirements: ["readable source material"],
  outputSpec: {
    version: 1,
    mode: "custom",
    semanticType: "bullet summary",
    machineKind: "list",
    cardinality: { min: 1, max: 1 },
  },
  modality: { input: ["text"], output: ["text"], constraints: [] },
  confidence: 0.82,
  ambiguity: "",
  alternatives: [{ name: "Outline", operation: "Create a hierarchical outline.", rationale: "Structure may be the intent." }],
});

test("normalizes and validates complete versioned text examples", () => {
  const normalized = normalizeBeforeAfterExamples(textPair());
  assert.equal(normalized.version, BEFORE_AFTER_SCHEMA_VERSION);
  assert.equal(validateBeforeAfterExamples(normalized, { requireComplete: true }).complete.length, 1);
  assert.equal(normalized.private, true);
});

test("rejects incomplete, unsafe, and scriptable uploads", () => {
  assert.equal(validateBeforeAfterExamples({ examples: [emptyExample()] }, { requireComplete: true }).ok, false);
  const unsafe = textPair();
  unsafe.examples[0].before.assets = [{ kind: "image", mime: "image/svg+xml", dataUrl: "data:image/svg+xml;base64,PHN2Zz4=" }];
  assert.match(validateBeforeAfterExamples(unsafe).error, /PNG, JPEG, or WebP/);
  const deep = {};
  let cursor = deep;
  for (let index = 0; index < 20; index += 1) cursor.next = cursor = {};
  assert.throws(() => normalizeBeforeAfterExamples(deep), /deeply nested/);
});

test("parses structured inference and populates the normal operator model", () => {
  const parsed = normalizeInferenceResult(inference());
  const operator = inferenceResultToOperator(parsed, textPair(), "learned");
  assert.equal(operator.kind, "prompt");
  assert.equal(operator.outputSpec.machineKind, "list");
  assert.equal(operator.learnedFrom.exampleCount, 1);
  assert.equal(operator.learnedFrom.examplesPrivate, true);
  assert.match(operator.prompt, /do not add facts/i);
});

test("user-edited inferred fields win until explicit re-inference", () => {
  const edited = { ...normalizeInferenceResult(inference()), name: "My edited name", operation: "My exact reusable instruction." };
  const operator = inferenceResultToOperator(edited, textPair(), "edited");
  assert.equal(operator.name, "My edited name");
  assert.equal(operator.prompt, "My exact reusable instruction.");
});

test("public export strips private bodies while opt-in preserves them", () => {
  const operator = inferenceResultToOperator(inference(), textPair(), "private");
  const safe = examplesForPublicExport(operator);
  assert.deepEqual(safe.learnedFrom.examples, []);
  assert.equal(safe.learnedFrom.exampleCount, 1);
  const pack = createLensPack(["private"], [operator]);
  assert.deepEqual(pack.operators[0].learnedFrom.examples, []);
  const optedIn = createLensPack(["private"], [operator], { includePrivateExamples: true });
  assert.equal(optedIn.operators[0].learnedFrom.examples.length, 1);
});

test("learned lens import remains idempotent by content", () => {
  const operator = inferenceResultToOperator(inference(), textPair(), "learned");
  const pack = createLensPack(["learned"], [operator]);
  const first = importLensPack(pack, []).operators;
  const second = importLensPack(pack, first).operators;
  assert.equal(first.length, 1);
  assert.equal(second.length, 1);
});

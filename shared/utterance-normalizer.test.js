import test from "node:test";
import assert from "node:assert/strict";
import { normalizeUtterance } from "./utterance-normalizer.js";

test("removes bounded fillers and repeated starts", () => {
  const value = normalizeUtterance("um make make the opening concrete, you know, and keep the evidence");
  assert.equal(value.cleanedText, "make the opening concrete, and keep the evidence");
  assert.equal(value.semanticClauses.length, 1);
  assert.ok(value.removed.length >= 3);
});

test("preserves meaningful like, quoted filler, names, numbers, and code", () => {
  const raw = `Make it look like a table named "Um, Like, Well", keep 42, and use \`like(value)\``;
  assert.equal(normalizeUtterance(raw).cleanedText, raw);
});

test("records repairs and resolves final intended attribute", () => {
  const value = normalizeUtterance("make it red—no, blue");
  assert.equal(value.cleanedText, "blue");
  assert.equal(value.corrections[0].superseded, "make it red");
  assert.equal(value.corrections[0].replacement, "blue");
});

test("does not erase negation in delete-actually-keep repair", () => {
  const value = normalizeUtterance("delete the second one—actually keep the second one");
  assert.match(value.cleanedText, /keep the second one/);
  assert.doesNotMatch(value.cleanedText, /^delete/);
});

test("reports pronouns for live entity resolution", () => {
  const value = normalizeUtterance("make this stronger and put it beside the last one");
  assert.deepEqual(value.unresolvedReferences.sort(), ["it", "the last one", "this"]);
});

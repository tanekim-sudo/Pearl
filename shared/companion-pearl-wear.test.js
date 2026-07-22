import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWornPearlPack,
  companionWearPrompt,
  compressConversationToPearlSpec,
  suggestPearlForConversation,
} from "./companion-pearl-wear.js";
import { parseTranscript } from "./transcript-learning.js";

test("worn pearl pack exposes context lenses and bound functions", () => {
  const pack = buildWornPearlPack({
    id: "p1",
    name: "LP briefings",
    representation: { kind: "function", refs: ["fn-1"], label: "LP briefings" },
    workingSet: {
      context: [{ id: "c1", kind: "material", label: "Memo template", text: "Sections: thesis, risks" }],
      lenses: [{ id: "l1", name: "Skeptical", strength: 0.8 }],
    },
  }, {
    functions: [{ id: "fn-1", name: "LP memo", description: "Write LP memo", steps: [{ name: "Draft" }] }],
  });
  assert.equal(pack.pearlId, "p1");
  assert.equal(pack.context.length, 1);
  assert.equal(pack.lenses.length, 1);
  assert.equal(pack.functions[0].name, "LP memo");
  assert.equal(pack.capabilities.canExecuteBoundFunctions, true);
  assert.match(companionWearPrompt(pack), /Worn pearl/);
  assert.match(companionWearPrompt(null), /always available/);
});

test("conversation compresses into named pearl + replayable function", () => {
  const transcript = parseTranscript(`
User: First gather the company thesis from the CRM export.
Assistant: Thesis collected.
User: Then draft risks and a recommendation for the LP.
Assistant: Draft ready.
`);
  const spec = compressConversationToPearlSpec(transcript);
  assert.ok(spec.pearl.name);
  assert.ok(spec.function.steps.length >= 2);
  assert.equal(spec.pearl.workingSet.context[0].kind, "transcript");
  assert.equal(spec.function.learnedFrom.kind, "llm-transcript");
});

test("suggests existing pearl when themes overlap, else prefers new", () => {
  const pearls = [
    {
      id: "a",
      name: "LP briefing kit",
      workingSet: { context: [{ label: "limited partner memo thesis risks" }], lenses: [] },
    },
    {
      id: "b",
      name: "Color study",
      workingSet: { context: [{ label: "palette contrast" }], lenses: [] },
    },
  ];
  const match = suggestPearlForConversation(pearls, {
    name: "LP memo function",
    description: "limited partner briefing with thesis and risks",
    steps: [{ name: "Draft LP memo" }],
  });
  assert.equal(match.preferNew, false);
  assert.equal(match.suggestions[0].pearlId, "a");
  const fresh = suggestPearlForConversation(pearls, {
    name: "Kitchen inventory",
    description: "track pantry items",
    steps: [{ name: "List spices" }],
  });
  assert.equal(fresh.preferNew, true);
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyPearlCompanionClass,
  proposePearlOperate,
  runPearlOperateHarnessOffline,
} from "./pearl-operate-harness.js";
import { interpretPearlPromptUtterance, runPearlPromptHarnessOffline } from "./pearl-prompt-harness.js";

const COMPARE_PDF = "explain the differences between my investor pearl and the Warren Buffett investor pearl and then give me a PDF output of the differences";

const investor = {
  id: "pearl:investor",
  name: "My investor pearl",
  systemPrompt: "You are an investor pearl.",
  moves: [{ name: "Draft memo" }],
  weights: [{ name: "Evidence", priority: 90 }],
  lenses: [{ name: "Skeptical investor" }],
};

const buffett = {
  id: "pearl:buffett",
  name: "Buffett · investing",
  systemPrompt: "You are Buffett.",
  moves: [{ name: "Read the filings" }, { name: "Margin of safety" }],
  weights: [{ name: "Moat durability", priority: 92 }],
  lenses: [{ name: "Owner mindset" }],
};

test("classify: compare+PDF is operate, never mutate_brain", () => {
  const c = classifyPearlCompanionClass(COMPARE_PDF, { hasActivePearl: true });
  assert.equal(c.class, "operate");
  assert.ok(c.intent === "compare_pearls" || c.intent === "produce_output");
});

test("classify: create Buffett is mutate_brain", () => {
  const c = classifyPearlCompanionClass(
    "make me a pearl that reflects Warren Buffett's style and taste and lens of investing",
  );
  assert.equal(c.class, "mutate_brain");
  assert.equal(c.intent, "create_pearl");
});

test("classify: soft taste edit is mutate_brain", () => {
  const c = classifyPearlCompanionClass("more like Plath", { hasActivePearl: true });
  assert.equal(c.class, "mutate_brain");
});

test("classify: summarize layers is operate", () => {
  const c = classifyPearlCompanionClass("summarize this pearl's moves weights and lenses", {
    hasActivePearl: true,
  });
  assert.equal(c.class, "operate");
  assert.equal(c.intent, "summarize_layers");
});

test("operate propose compare+PDF never mutates systemPrompt", () => {
  const proposal = proposePearlOperate(COMPARE_PDF, [investor, buffett], {
    activePearl: investor,
  });
  assert.equal(proposal.ok, true);
  assert.equal(proposal.mutatesSystemPrompt, false);
  assert.equal(proposal.produceOutput, true);
  assert.ok(proposal.artifact?.ok);
});

test("offline operate harness routes compare to comparePearls verb", () => {
  const run = runPearlOperateHarnessOffline({
    utterance: COMPARE_PDF,
    pearls: [investor, buffett],
    activePearl: investor,
  });
  assert.equal(run.handled, true);
  assert.equal(run.mutatesSystemPrompt, false);
  assert.equal(run.apply?.command?.verb, "comparePearls");
  assert.equal(run.apply?.command?.args?.produceOutput, true);
});

test("prompt harness still refuses to soft-adapt compare+PDF into edit", () => {
  const interpreted = interpretPearlPromptUtterance(COMPARE_PDF, {
    hasActivePearl: true,
    pearl: investor,
  });
  assert.notEqual(interpreted.intent, "edit_prompt");
  const run = runPearlPromptHarnessOffline({
    utterance: COMPARE_PDF,
    pearl: investor,
    pearls: [investor, buffett],
  });
  assert.equal(run.apply?.command?.verb, "comparePearls");
  assert.equal(investor.systemPrompt, "You are an investor pearl.");
});

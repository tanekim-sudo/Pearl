import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPearlComparisonArtifact,
  comparePearlLayers,
  extractComparePearlHints,
  formatPearlComparisonMarkdown,
  looksLikePearlCompareRequest,
  looksLikePearlExecutionRequest,
  looksLikeProduceOutputRequest,
  proposePearlCompare,
  resolveComparePearls,
} from "./pearl-compare.js";
import {
  interpretPearlPromptUtterance,
  runPearlPromptHarnessOffline,
} from "./pearl-prompt-harness.js";
import { scrubExecutionRequestsFromSystemPrompt } from "./pearl-system-prompt.js";

const COMPARE_PDF = "explain the differences between my investor pearl and the Warren Buffett investor pearl and then give me a PDF output of the differences";

const investorPearl = {
  id: "pearl:investor",
  name: "My investor pearl",
  systemPrompt: "You are an investor pearl.\nWrite memos with risks.",
  moves: [
    { id: "m1", name: "Draft memo", description: "Write the memo" },
    { id: "m2", name: "List risks", description: "Surface risks" },
  ],
  weights: [
    { name: "Evidence", priority: 90, note: "Facts over story" },
    { name: "Risk clarity", priority: 85, note: "Name the downside" },
  ],
  lenses: [
    { id: "l1", name: "Skeptical investor", description: "Question TAM" },
  ],
};

const buffettPearl = {
  id: "pearl:buffett",
  name: "Buffett · investing",
  systemPrompt: "You are the Pearl “Buffett · investing”.\n## Moves\n1. Read the filings",
  moves: [
    { id: "b1", name: "Read the filings", description: "10-K first" },
    { id: "b2", name: "Margin of safety", description: "Require a cushion" },
  ],
  weights: [
    { name: "Moat durability", priority: 92, note: "Widening moats" },
    { name: "Margin of safety", priority: 88, note: "Price vs value" },
  ],
  lenses: [
    { id: "bl1", name: "Owner mindset", description: "Own forever" },
    { id: "bl2", name: "Mr. Market", description: "Price is moody" },
  ],
};

test("compare+PDF utterance is an execution request, not a prompt edit signal", () => {
  assert.equal(looksLikePearlCompareRequest(COMPARE_PDF), true);
  assert.equal(looksLikeProduceOutputRequest(COMPARE_PDF), true);
  assert.equal(looksLikePearlExecutionRequest(COMPARE_PDF), true);
});

test("interpret never classifies compare+PDF as edit_prompt", () => {
  const interpreted = interpretPearlPromptUtterance(COMPARE_PDF, {
    hasActivePearl: true,
    pearl: investorPearl,
  });
  assert.notEqual(interpreted.intent, "edit_prompt");
  assert.notEqual(interpreted.intent, "replace_prompt");
  assert.ok(
    interpreted.intent === "compare_pearls" || interpreted.intent === "produce_output",
  );
  assert.equal(interpreted.verb, "comparePearls");
});

test("offline harness compare+PDF does not mutate systemPrompt", () => {
  const prior = investorPearl.systemPrompt;
  const run = runPearlPromptHarnessOffline({
    utterance: COMPARE_PDF,
    pearl: investorPearl,
    pearls: [investorPearl, buffettPearl],
    appState: { wornPearlIds: [investorPearl.id] },
  });
  assert.equal(run.handled, true);
  assert.equal(run.mutatesSystemPrompt, false);
  assert.equal(run.apply?.command?.verb, "comparePearls");
  assert.ok(run.proposal?.ok);
  assert.equal(run.proposal?.mutatesSystemPrompt, false);
  assert.match(run.proposal?.markdown || "", /Buffett|investor/i);
  assert.ok(run.proposal?.artifact?.ok);
  assert.equal(run.proposal?.artifact?.ext, "pdf");
  // Active pearl prompt unchanged by the proposal path
  assert.equal(investorPearl.systemPrompt, prior);
  assert.ok(!/User refinement:/i.test(run.proposal?.markdown || ""));
  assert.ok(!/Source request:/i.test(run.proposal?.markdown || ""));
});

test("extractComparePearlHints pulls investor vs Buffett", () => {
  const hints = extractComparePearlHints(COMPARE_PDF);
  assert.match(hints.left, /investor/i);
  assert.match(hints.right, /buffett/i);
});

test("resolve + compare produces layer diffs", () => {
  const resolved = resolveComparePearls([investorPearl, buffettPearl], COMPARE_PDF, {
    activePearl: investorPearl,
  });
  assert.equal(resolved.ok, true);
  const comparison = comparePearlLayers(resolved.left, resolved.right);
  assert.ok(comparison.diffs.moves.onlyA.length + comparison.diffs.moves.onlyB.length > 0);
  const md = formatPearlComparisonMarkdown(comparison);
  assert.match(md, /## Layer differences/);
  assert.match(md, /Moves/);
});

test("PDF artifact is non-empty bytes", () => {
  const comparison = comparePearlLayers(investorPearl, buffettPearl);
  const artifact = buildPearlComparisonArtifact(comparison, COMPARE_PDF);
  assert.equal(artifact.ok, true);
  assert.ok(artifact.bytes?.byteLength > 100);
  const head = new TextDecoder().decode(artifact.bytes.slice(0, 8));
  assert.equal(head.startsWith("%PDF"), true);
});

test("proposePearlCompare never claims systemPrompt mutation", () => {
  const proposal = proposePearlCompare(COMPARE_PDF, [investorPearl, buffettPearl], {
    activePearl: investorPearl,
  });
  assert.equal(proposal.ok, true);
  assert.equal(proposal.mutatesSystemPrompt, false);
  assert.equal(proposal.produceOutput, true);
});

test("scrub removes Source request / User refinement execution dumps", () => {
  const dirty = [
    "You are an investor pearl.",
    "Source request: and then give me a PDF output of the differences",
    "User refinement: explain the differences between my investor pearl and Buffett",
    "Honor the refinement while preserving prior taste.",
    "Prefer concrete risks.",
  ].join("\n");
  const clean = scrubExecutionRequestsFromSystemPrompt(dirty);
  assert.match(clean, /investor pearl/i);
  assert.match(clean, /Prefer concrete risks/);
  assert.ok(!/Source request:/i.test(clean));
  assert.ok(!/User refinement:/i.test(clean));
  assert.ok(!/Honor the refinement/i.test(clean));
  assert.ok(!/\bPDF\b/i.test(clean));
});

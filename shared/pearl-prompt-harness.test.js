import assert from "node:assert/strict";
import test from "node:test";
import {
  applyPearlPromptProposal,
  buildPearlPromptRewriteRequest,
  formatPearlPromptTrail,
  interpretPearlPromptUtterance,
  mergeInstructionIntoPrompt,
  normalizePearlPromptProposal,
  observePearlPromptContext,
  proposePearlPromptLocal,
  runPearlPromptHarnessOffline,
} from "./pearl-prompt-harness.js";

test("observe loads companion context with systemPrompt", () => {
  const observation = observePearlPromptContext({
    id: "pearl:h1",
    name: "Poetry",
    systemPrompt: "Observe street scenes for haiku.",
  }, { wornPearlIds: ["pearl:h1"] });
  assert.equal(observation.pearlId, "pearl:h1");
  assert.match(observation.systemPrompt, /haiku/i);
  assert.match(observation.modelContext, /Poetry/);
});

test("interpret novel create without brittle phrase whitelist", () => {
  const interpreted = interpretPearlPromptUtterance(
    "forge me a pearl that watches rain and drafts short poems",
  );
  assert.equal(interpreted.intent, "create_pearl");
  assert.ok(interpreted.confidence >= 0.8);
});

test("interpret soft adapt on active pearl — any natural language", () => {
  const interpreted = interpretPearlPromptUtterance("more like Plath", {
    hasActivePearl: true,
  });
  assert.equal(interpreted.intent, "edit_prompt");

  const tam = interpretPearlPromptUtterance("add skepticism about TAM", {
    hasActivePearl: true,
  });
  assert.equal(tam.intent, "edit_prompt");
  assert.equal(tam.mode, "append");

  const street = interpretPearlPromptUtterance(
    "make it observe street scenes for haiku",
    { hasActivePearl: true },
  );
  assert.equal(street.intent, "edit_prompt");
});

test("offline propose/apply create seeds non-empty systemPrompt", () => {
  const run = runPearlPromptHarnessOffline({
    utterance: "build a pearl for skeptical investor memos",
  });
  assert.equal(run.handled, true);
  assert.equal(run.proposal.ok, true);
  assert.ok(run.proposal.systemPrompt.length > 20);
  assert.match(run.proposal.systemPrompt, /skeptical|investor|memo/i);
  assert.equal(run.apply.ok, true);
  assert.equal(run.apply.command.verb, "createSemanticOrb");
  assert.ok(run.apply.command.args.systemPrompt);
});

test("offline propose/apply edit merges instruction into prompt", () => {
  const pearl = {
    id: "pearl:edit-1",
    name: "Memo",
    systemPrompt: "You are the Pearl “Memo”. Prefer concrete output.",
  };
  const run = runPearlPromptHarnessOffline({
    utterance: "add skepticism about TAM",
    pearl,
    appState: { wornPearlIds: [pearl.id] },
  });
  assert.equal(run.handled, true);
  assert.equal(run.proposal.ok, true);
  assert.match(run.proposal.systemPrompt, /Prefer concrete output/);
  assert.match(run.proposal.systemPrompt, /TAM|skepticism/i);
  assert.equal(run.apply.command.verb, "setPearlSystemPrompt");
  assert.equal(run.apply.command.args.id, pearl.id);
  assert.equal(run.proposal.needsRicherRewrite, true);
});

test("mergeInstructionIntoPrompt preserves prior taste", () => {
  const next = mergeInstructionIntoPrompt(
    "You are the Pearl “Poetry”.\nKeep lines short.",
    "more like Plath",
    { name: "Poetry" },
  );
  assert.match(next, /Keep lines short/);
  assert.match(next, /more like Plath/);
});

test("normalizePearlPromptProposal accepts mock LLM JSON", () => {
  const observation = observePearlPromptContext({
    id: "p1",
    name: "Notes",
    systemPrompt: "Be brief.",
  });
  const interpretation = interpretPearlPromptUtterance("make it more skeptical", {
    hasActivePearl: true,
  });
  const proposal = normalizePearlPromptProposal({
    intent: "edit_prompt",
    title: "Notes",
    systemPrompt: "Be brief and skeptical of unsupported claims.",
    summary: "Added skepticism.",
    rationale: "User asked for skepticism.",
  }, interpretation, observation);
  assert.equal(proposal.ok, true);
  assert.equal(proposal.source, "model");
  assert.match(proposal.systemPrompt, /skeptical/);
  assert.equal(proposal.needsRicherRewrite, false);
});

test("normalizePearlPromptProposal falls back locally on bad model output", () => {
  const observation = observePearlPromptContext({
    id: "p1",
    name: "Notes",
    systemPrompt: "Be brief.",
  });
  const interpretation = interpretPearlPromptUtterance("more like Plath", {
    hasActivePearl: true,
  });
  const proposal = normalizePearlPromptProposal("not-json{{{", interpretation, observation);
  assert.equal(proposal.ok, true);
  assert.match(proposal.source, /local/);
  assert.match(proposal.systemPrompt, /Plath|User refinement/i);
});

test("buildPearlPromptRewriteRequest includes schema and context", () => {
  const observation = observePearlPromptContext({
    id: "p1",
    name: "Haiku",
    systemPrompt: "Watch quietly.",
  });
  const interpretation = interpretPearlPromptUtterance(
    "make it observe street scenes for haiku",
    { hasActivePearl: true },
  );
  const req = buildPearlPromptRewriteRequest(observation, interpretation);
  assert.equal(req.jsonSchema.name, "pearl_prompt_rewrite");
  assert.match(req.system, /Never expose internal ids/i);
  assert.match(req.prompt, /street scenes/);
});

test("trail formatting is Cursor-like and metadata-free", () => {
  const lines = formatPearlPromptTrail([
    { stage: "working" },
    { stage: "interpreting", detail: "(edit prompt)" },
    { stage: "proposed", detail: "Added skepticism about TAM." },
    { stage: "applied", detail: "Updated system prompt for “Memo”." },
  ]);
  assert.deepEqual(lines[0], "Working…");
  assert.match(lines[1], /Interpreting/);
  assert.match(lines[2], /Proposed change:/);
  assert.match(lines[3], /Applied:/);
});

test("proposePearlPromptLocal create never returns empty junk", () => {
  const proposal = proposePearlPromptLocal(
    interpretPearlPromptUtterance("create a pearl about morning pages"),
    observePearlPromptContext(null),
  );
  assert.equal(proposal.ok, true);
  assert.ok(proposal.systemPrompt.length > 10);
  const applied = applyPearlPromptProposal(proposal, {});
  assert.equal(applied.command.args.name.length > 0, true);
});

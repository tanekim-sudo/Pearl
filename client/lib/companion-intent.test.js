import test from "node:test";
import assert from "node:assert/strict";

import {
  COMPANION_VERBS,
  buildCompanionSystemPrompt,
  classifyInterviewInput,
  looksLikeProfileAnswer,
  parseAdministrativeCommand,
  parseCompanionReply,
  parseSaveChainCommand,
} from "./companion-intent.js";

test("compound administrative command composes every requested clear domain", () => {
  const intent = parseAdministrativeCommand(
    "delete all the functions in my current function tab as well as all the generators and delete every single thing that's in my whiteboard as well as in my AI space"
  );

  assert.deepEqual(intent, {
    kind: "clear-workspace",
    domains: ["paper", "ai", "lenses", "generators"],
  });
});

test("administrative parser recognizes user-facing and legacy domain names", () => {
  assert.deepEqual(parseAdministrativeCommand("wipe the entire canvas and all AI nodes"), {
    kind: "clear-workspace",
    domains: ["paper", "ai"],
  });
  assert.deepEqual(parseAdministrativeCommand("remove all operators and structures"), {
    kind: "clear-workspace",
    domains: ["lenses", "generators"],
  });
});

test("typo-filled first-run clear request routes before profile capture", () => {
  const text = "get rid fo all functions and drawings and ai stuff let me start completely from scratch";
  assert.deepEqual(parseAdministrativeCommand(text), {
    kind: "clear-workspace",
    domains: ["paper", "ai", "lenses"],
  });
  assert.equal(classifyInterviewInput(text, "identity").kind, "command");
});

test("compound clear tolerates the common whiteboard transposition typo", () => {
  const text =
    "delete all the functions in my current function tab as well as all the generators and delete every single thing that's in my whitebaord as well as in my AI space";
  assert.deepEqual(parseAdministrativeCommand(text), {
    kind: "clear-workspace",
    domains: ["paper", "ai", "lenses", "generators"],
  });
  assert.equal(classifyInterviewInput(text, "identity").kind, "command");
});

test("profile-shaped answers advance while commands interrupt setup", () => {
  assert.equal(looksLikeProfileAnswer("Tan", "identity"), true);
  assert.equal(looksLikeProfileAnswer("I run a research lab", "role"), true);
  assert.equal(classifyInterviewInput("Tan", "identity").kind, "profile");
  assert.equal(classifyInterviewInput("I run a research lab", "role").kind, "profile");
  assert.equal(classifyInterviewInput("create a note about markets", "identity").kind, "command");
});

test("administrative parser rejects non-bulk and non-destructive requests", () => {
  assert.equal(parseAdministrativeCommand("delete the function named memo"), null);
  assert.equal(parseAdministrativeCommand("show me all generators"), null);
  assert.equal(parseAdministrativeCommand("clear this up for me"), null);
});

test("bulk clear verbs are accepted by validated companion replies", () => {
  const parsed = parseCompanionReply(
    JSON.stringify({
      say: "I'll ask before clearing.",
      steps: [
        {
          verb: "clearWorkspaceDomains",
          args: { domains: ["paper", "ai", "lenses", "generators"] },
        },
      ],
    })
  );

  assert.equal(parsed.steps[0].verb, "clearWorkspaceDomains");
  assert.deepEqual(parsed.steps[0].args.domains, ["paper", "ai", "lenses", "generators"]);
  for (const verb of [
    "clearPaper",
    "clearAiSpace",
    "clearUserLenses",
    "clearGenerators",
    "clearWorkspaceDomains",
  ]) {
    assert.ok(COMPANION_VERBS[verb], `${verb} is documented for the companion`);
  }
});

test("planner requires executable commands to act without chatter", () => {
  const prompt = buildCompanionSystemPrompt();
  assert.match(prompt, /for every executable request, set "say" to ""/);
  assert.match(prompt, /Do not acknowledge, praise, summarize, or announce/);
});

test("save-chain requests use the deterministic local path", () => {
  assert.deepEqual(parseSaveChainCommand("save how I got here as a lens"), {
    kind: "save-chain",
    name: null,
  });
  assert.deepEqual(parseSaveChainCommand("save this chain as investment memo"), {
    kind: "save-chain",
    name: "investment memo",
  });
  assert.deepEqual(parseSaveChainCommand("capture this thread named Contrarian Map"), {
    kind: "save-chain",
    name: "Contrarian Map",
  });
  assert.equal(parseSaveChainCommand("save this page"), null);
});

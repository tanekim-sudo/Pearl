import test from "node:test";
import assert from "node:assert/strict";

import {
  COMPANION_VERBS,
  buildAdaptiveCompanionPrompt,
  buildCompanionSystemPrompt,
  classifyInterviewInput,
  looksLikeProfileAnswer,
  parseAdministrativeCommand,
  parseExtensionDownloadCommand,
  parseFunctionOutputCommand,
  parseCompanionReply,
  parseMixedProfileCommand,
  parseSaveChainCommand,
} from "./companion-intent.js";

test("exact mixed identity question and typo clear resets only workspace domains", () => {
  const text = "Who are you?\nclear everything let me start fomr scratch";
  assert.deepEqual(parseAdministrativeCommand(text), {
    kind: "clear-workspace",
    domains: ["paper", "ai"],
  });
  assert.deepEqual(classifyInterviewInput(text, "identity"), {
    kind: "command",
    intent: { kind: "clear-workspace", domains: ["paper", "ai"] },
  });
});

test("compound administrative command composes every requested clear domain", () => {
  const intent = parseAdministrativeCommand(
    "delete all the functions in my current function tab as well as all the generators and delete every single thing that's in my whiteboard as well as in my AI space"
  );

  assert.deepEqual(intent, {
    kind: "clear-workspace",
    domains: ["paper", "ai", "lenses", "generators"],
  });
});

test("function output edits use deterministic real capability paths", () => {
  assert.deepEqual(
    parseFunctionOutputCommand("make this function output an investment memo and a one-page brief"),
    {
      verb: "editFunctionOutput",
      args: { op: "last", outputs: ["investment memo", "one-page brief"] },
    }
  );
  assert.deepEqual(parseFunctionOutputCommand("change the second branch to a table"), {
    verb: "editFunctionBranchOutput",
    args: { op: "last", branch: 2, label: "table", machineKind: "table" },
  });
  assert.equal(parseFunctionOutputCommand("tell me about tables"), null);
});

test("extension download requests use the deterministic local path", () => {
  assert.deepEqual(parseExtensionDownloadCommand("download the Lens Everywhere Chrome extension"), {
    kind: "open-extension-download",
  });
  assert.equal(parseExtensionDownloadCommand("download this page"), null);
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

test("a unified whiteboard clear includes paper and AI material", () => {
  assert.deepEqual(parseAdministrativeCommand("delete everything in the Whiteboard"), {
    kind: "clear-workspace",
    domains: ["paper", "ai"],
  });
});

test("destructive follow-ups amend recent clear context without becoming profile data", () => {
  const followup = parseAdministrativeCommand("including the notes delete the nodes", {
    previousDomains: ["paper"],
    pending: true,
  });
  assert.deepEqual(followup, {
    kind: "clear-workspace",
    domains: ["paper", "ai"],
  });
  assert.equal(classifyInterviewInput("including the notes delete the nodes", "identity").kind, "command");
  assert.deepEqual(
    parseAdministrativeCommand("also the generators, not the lenses", {
      previousDomains: ["paper", "ai"],
      pending: true,
    }),
    { kind: "clear-workspace", domains: ["paper", "ai", "generators"] }
  );
});

test("confirmation and cancellation are grounded in a pending clear", () => {
  assert.deepEqual(parseAdministrativeCommand("yes", { previousDomains: ["paper", "ai"], pending: true }), {
    kind: "confirm-clear",
    domains: ["paper", "ai"],
  });
  assert.deepEqual(parseAdministrativeCommand("cancel", { previousDomains: ["paper"], pending: true }), {
    kind: "cancel-clear",
    domains: ["paper"],
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

test("mixed onboarding utterances retain short profile facts and execute the remainder", () => {
  assert.deepEqual(
    parseMixedProfileCommand(
      "I'm an investor and I want three functions that combine into one workflow",
      "identity"
    ),
    {
      kind: "mixed",
      profile: { role: "investor" },
      command: "three functions that combine into one workflow",
    }
  );
  assert.deepEqual(parseMixedProfileCommand("I’m Sarah, a founder—build a launch lens", "identity"), {
    kind: "mixed",
    profile: { identity: "Sarah", role: "founder" },
    command: "build a launch lens",
  });
  assert.deepEqual(parseMixedProfileCommand("I invest in biotech. Create a diligence workflow", "identity"), {
    kind: "mixed",
    profile: { role: "investor in biotech" },
    command: "Create a diligence workflow",
  });
  assert.deepEqual(parseMixedProfileCommand("im Sarah a founder build a launch lens", "identity"), {
    kind: "mixed",
    profile: { identity: "Sarah", role: "founder" },
    command: "build a launch lens",
  });
  assert.equal(
    classifyInterviewInput("I'm an investor and I want create a memo lens", "identity").kind,
    "mixed"
  );
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

test("adaptive planner documents framework metadata outside capability args", () => {
  const prompt = buildAdaptiveCompanionPrompt();
  assert.match(prompt, /Framework action metadata \(never place these keys inside args\)/);
  assert.match(prompt, /action\.confirmed/);
  assert.match(prompt, /Handler-confirmed actions stage the app's normal counted confirmation/);
});

test("flat reply parser rejects fake verbs instead of silently dropping them", () => {
  assert.throws(
    () =>
      parseCompanionReply(
        JSON.stringify({ say: "", steps: [{ verb: "hallucinateResearch", args: {} }] })
      ),
    /unsupported companion verb/
  );
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

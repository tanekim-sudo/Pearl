import test from "node:test";
import assert from "node:assert/strict";

import {
  COMPANION_VERBS,
  buildAdaptiveCompanionPrompt,
  buildCompanionSystemPrompt,
  classifyInterviewInput,
  looksLikeProfileAnswer,
  parseAdministrativeCommand,
  parseBeforeAfterCommand,
  parseCognitiveWorkflowCommand,
  parseExtensionDownloadCommand,
  parseFunctionCreationCommand,
  parseFunctionOutputCommand,
  parseInvestorRolePearlCommand,
  parseLibraryObjectCommand,
  parseParallelBranchCommand,
  parsePearlCreationCommand,
  titleFromPearlPurpose,
  parsePearlEditCommand,
  parsePearlSystemPromptCommand,
  parsePearlFunctionMovesCommand,
  parseCritiqueCommand,
  parsePearlVersionCommand,
  parsePearlRemixCommand,
  parseAutomationLoopCommand,
  parsePearlCapabilityDemoCommand,
  parseSafeDemonstrationCommand,
  parseSemanticTransferCommand,
  parseTranscriptLearningCommand,
  parsePearlAestheticCommand,
  parseOutputDestinationCommand,
  parseCompanionReply,
  parseMixedProfileCommand,
  parseSaveChainCommand,
} from "./companion-intent.js";

test("pearl creation intent uses the canonical semantic capsule command", () => {
  assert.deepEqual(parsePearlCreationCommand("make a pearl from this"), {
    verb: "createSemanticOrb",
    args: { sceneId: "", name: "", intent: "make a pearl from this" },
  });
  assert.deepEqual(parsePearlCreationCommand("make a pearl from these notes called Evidence"), {
    verb: "createSemanticOrb",
    args: { sceneId: "", name: "Evidence", intent: "make a pearl from these notes called Evidence" },
  });
  assert.deepEqual(parsePearlCreationCommand("make a pearl about Friday standup"), {
    verb: "createSemanticOrb",
    args: {
      sceneId: "",
      name: "Friday standup",
      materialText: "Friday standup",
      intent: "make a pearl about Friday standup",
      systemPromptHint: "Friday standup",
    },
  });
  assert.equal(parsePearlCreationCommand("make a pearl from this: ship the shelf").args.materialText, "ship the shelf");
  assert.deepEqual(parsePearlCreationCommand("create pearl"), {
    verb: "createSemanticOrb",
    args: { sceneId: "", name: "", intent: "create pearl" },
  });
  assert.deepEqual(parsePearlCreationCommand("make me a pearl"), {
    verb: "createSemanticOrb",
    args: { sceneId: "", name: "", intent: "make me a pearl" },
  });
});

test("make me a pearl to … purpose intents create titled pearls without planner", () => {
  const utterance = "make me a pearl to observe and generate inspiration for poetry";
  assert.equal(titleFromPearlPurpose("observe and generate inspiration for poetry"), "poetry inspiration");
  const parsed = parsePearlCreationCommand(utterance);
  assert.equal(parsed?.verb, "createSemanticOrb");
  assert.equal(parsed.args.name, "poetry inspiration");
  assert.match(parsed.args.materialText, /inspiration for poetry/i);
  assert.equal(parsed.args.intent, utterance);
  assert.equal(parsed.args.systemPromptHint, parsed.args.materialText);
  assert.equal(parsePearlCreationCommand("make a pearl for morning pages").args.name, "morning pages");
  assert.equal(
    parsePearlCreationCommand("create me a pearl that helps me write skeptical investor memos").args.name.slice(0, 40),
    "helps me write skeptical investor memos".slice(0, 40),
  );
  // Must not steal system-prompt edits on an existing pearl.
  assert.equal(parsePearlCreationCommand("make this pearl about investor memos"), null);
});

test("pearl system prompt intents are deterministic", () => {
  assert.equal(parsePearlSystemPromptCommand("make this pearl about investor memos that are skeptical of TAM").verb, "editPearlSystemPrompt");
  assert.equal(parsePearlSystemPromptCommand("make this pearl about investor memos that are skeptical of TAM").args.mode, "rewrite");
  assert.match(
    parsePearlSystemPromptCommand("make this pearl about investor memos that are skeptical of TAM").args.text,
    /skeptical of TAM/i,
  );
  assert.deepEqual(parsePearlSystemPromptCommand("add that I always want a risks section"), {
    verb: "editPearlSystemPrompt",
    args: { mode: "append", text: "I always want a risks section" },
  });
  assert.equal(parsePearlSystemPromptCommand("rewrite the system prompt to critique hand-wavy market sizing").verb, "editPearlSystemPrompt");
  assert.equal(parsePearlSystemPromptCommand("what's the system prompt for this pearl").verb, "getPearlSystemPrompt");
  assert.equal(parsePearlSystemPromptCommand("add budget concerns to this pearl"), null);
});

test("pearl edit/rename/experiment intents are deterministic without planner credentials", () => {
  assert.deepEqual(parsePearlEditCommand("rename this pearl Visual grammar"), {
    verb: "renameSemanticOrb",
    args: { name: "Visual grammar" },
  });
  assert.deepEqual(parsePearlEditCommand("rename Friday standup to Morning notes"), {
    verb: "renameSemanticOrb",
    args: { fromName: "Friday standup", name: "Morning notes" },
  });
  assert.deepEqual(parsePearlEditCommand("change the pearl title to Shelf brief"), {
    verb: "renameSemanticOrb",
    args: { name: "Shelf brief" },
  });
  assert.deepEqual(parsePearlEditCommand("edit this pearl: shorter memo for investors"), {
    verb: "editPearlOutput",
    args: { text: "shorter memo for investors", append: false },
  });
  assert.deepEqual(parsePearlEditCommand("add to this pearl: extra evidence from the call"), {
    verb: "addSemanticOrbContext",
    args: { text: "extra evidence from the call" },
  });
  assert.equal(parsePearlRemixCommand("experiment with this pearl").verb, "createCounterPearl");
  assert.equal(parsePearlRemixCommand("remix this pearl").verb, "createCounterPearl");
  // Characterization: these used to fall through to the planner and fail for humans without credentials.
  assert.equal(parsePearlEditCommand("edit this pearl"), null);
  assert.ok(parsePearlEditCommand("rename this pearl Hello"));
});

test("critique stream and version history intents are deterministic", () => {
  assert.equal(parseCritiqueCommand("start critique mode").verb, "startCritiqueSession");
  assert.deepEqual(parseCritiqueCommand("make the opening warmer", { sessionActive: true }), {
    verb: "ingestCritique",
    args: { text: "make the opening warmer", autoApply: true },
  });
  assert.equal(parseCritiqueCommand("make this output warmer").verb, "revisePearlFromFeedback");
  assert.equal(parseCritiqueCommand("make this pearl about investor memos that are skeptical of TAM"), null);
  assert.equal(parsePearlVersionCommand("show version history").verb, "browsePearlHistory");
  assert.deepEqual(parsePearlVersionCommand("name this version Review ready"), {
    verb: "snapshotPearlVersion",
    args: { label: "Review ready" },
  });
  assert.equal(parsePearlVersionCommand("restore the Review ready version").verb, "restorePearlVersion");
  assert.equal(parsePearlRemixCommand("merge these orbs").verb, "mergeSemanticOrbs");
  assert.equal(parsePearlRemixCommand("merge these pearls").verb, "mergeSemanticOrbs");
  assert.equal(parsePearlRemixCommand("combine these pearls").verb, "mergeSemanticOrbs");
  assert.equal(parsePearlRemixCommand("put these pearls together").verb, "mergeSemanticOrbs");
  assert.equal(parsePearlRemixCommand("try something with this pearl").verb, "createCounterPearl");
  assert.equal(parsePearlRemixCommand("split this pearl").verb, "splitSemanticOrb");
  assert.equal(parsePearlRemixCommand("open studio for this pearl").verb, "openPearlStudio");
  assert.deepEqual(parsePearlEditCommand("edit it to add budget concerns"), {
    verb: "addSemanticOrbContext",
    args: { text: "budget concerns" },
  });
  assert.deepEqual(parsePearlEditCommand("add budget concerns to this pearl"), {
    verb: "addSemanticOrbContext",
    args: { text: "budget concerns" },
  });
  assert.equal(parsePearlRemixCommand("add budget concerns to this pearl"), null);
  assert.deepEqual(parsePearlRemixCommand("what do these pearls notice about each other"), {
    verb: "synthesizeSemanticOrbs",
    args: { ids: [], sceneId: "", mode: "mutual" },
  });
  assert.equal(parsePearlRemixCommand("synthesize these pearls").verb, "synthesizeSemanticOrbs");
  assert.equal(parsePearlRemixCommand("apply this pearl onto that pearl").args.mode, "directed");
  assert.equal(parsePearlRemixCommand("organize this pearl").verb, "organizePearl");
  assert.equal(parsePearlRemixCommand("organize the dump into moves functions and lenses").verb, "organizePearl");
  assert.equal(parsePearlRemixCommand("develop a counter pearl to this one").verb, "createCounterPearl");
  assert.equal(parsePearlRemixCommand("create a counter pearl").verb, "createCounterPearl");
  assert.equal(parsePearlRemixCommand("make a foil pearl against that orb").verb, "createCounterPearl");
  assert.deepEqual(parsePearlRemixCommand("wear the Alpha pearl"), {
    verb: "wearPearl",
    args: { name: "Alpha" },
  });
  assert.equal(parsePearlRemixCommand("remove the worn pearl").verb, "removeWornPearl");
  assert.equal(parsePearlRemixCommand("evaluate this deck with my startup pearl").verb, "evaluateWithGauntlet");
  assert.equal(parsePearlRemixCommand("run the gauntlet over this page").verb, "evaluateWithGauntlet");
  assert.equal(parsePearlRemixCommand("split this orb").verb, "splitSemanticOrb");
  assert.equal(parsePearlRemixCommand("apply my skeptical Lens to this orb").verb, "applySemanticOrbLens");
  assert.equal(parseAutomationLoopCommand("capture this tab as the format").verb, "captureScreenAsEvidence");
  assert.equal(parseAutomationLoopCommand("automate LP briefings from what I am showing").verb, "encodeAutomationFromInstruction");
  assert.equal(parseAutomationLoopCommand("run the LP briefing pearl").verb, "runAutomationPearl");
});

test("cognitive workflow intents preserve teaching scope and grounded review boundaries", () => {
  assert.deepEqual(parseCognitiveWorkflowCommand("From now on, when I say 'Founder pass', run orchestrateCognitiveWorkflow only remember this in workspace"), {
    title: "Teach personal command",
    steps: [{ verb: "teachPersonalCommand", args: { trigger: "Founder pass", command: "orchestrateCognitiveWorkflow", scope: "workspace" }, confirmed: true }],
  });
  assert.equal(parseCognitiveWorkflowCommand("open my vocabulary").steps[0].args.tab, "vocabulary");
  assert.equal(parseCognitiveWorkflowCommand("extract all Moves, Functions, and Lenses from this meeting transcript").steps[0].verb, "openCognitivePullRequest");
  assert.equal(parseCognitiveWorkflowCommand("browse packages").steps[0].verb, "openPackageRegistry");
});
import {
  beginCommand,
  isRetryRequest,
  lastRecoverableCommand,
  publicCompanionError,
  updateCommand,
} from "./companion-command-ledger.js";

test("Move, Function, and Lens save intents stay distinct", () => {
  assert.deepEqual(parseLibraryObjectCommand("save this text as a move"), {
    verb: "saveCurrentAsMove",
    args: {},
  });
  assert.deepEqual(parseLibraryObjectCommand("save how I got here as a function"), {
    verb: "captureLineageAsFunction",
    args: {},
  });
  assert.deepEqual(parseLibraryObjectCommand("collect these in a lens"), {
    verb: "openSaveAsChooser",
    args: {},
    followup: { verb: "chooseSaveAsKind", args: { kind: "lens" } },
  });
  assert.deepEqual(parseTranscriptLearningCommand("make all three from this chat transcript"), {
    verb: "chooseTranscriptArtifacts",
    args: { kind: "all" },
    followup: { verb: "generateTranscriptArtifacts", args: {} },
  });
});

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
    "delete all the functions in my current function tab as well as all the lenses and delete every single thing that's in my whiteboard as well as in my AI space"
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
  assert.deepEqual(parseFunctionOutputCommand("change the second branch of Branch Move to a table"), {
    verb: "editFunctionBranchOutput",
    args: { op: "Branch Move", branch: 2, label: "table", machineKind: "table" },
  });
  assert.equal(parseFunctionOutputCommand("tell me about tables"), null);
});

test("before and after lens requests use deterministic real editor actions", () => {
  assert.deepEqual(parseBeforeAfterCommand("make a lens from this before and after"), {
    verb: "openBeforeAfterCreation",
    args: {},
  });
  assert.deepEqual(parseBeforeAfterCommand("learn a Move or Function from this before and after"), {
    verb: "openBeforeAfterCreation",
    args: {},
  });
  assert.deepEqual(parseBeforeAfterCommand("this image became that image—learn the transformation"), {
    verb: "inferBeforeAfterTransformation",
    args: {},
  });
  assert.deepEqual(parseBeforeAfterCommand("add another example"), {
    verb: "addBeforeAfterExample",
    args: {},
  });
  assert.deepEqual(parseBeforeAfterCommand("set the after text to a concise memo"), {
    verb: "setBeforeAfterText",
    args: { side: "after", text: "a concise memo" },
  });
  assert.equal(parseBeforeAfterCommand("infer a reusable Function from this Lens"), null);
});

test("extension download requests use the deterministic local path", () => {
  assert.deepEqual(parseExtensionDownloadCommand("download the Lens Everywhere Chrome extension"), {
    kind: "open-extension-download",
  });
  assert.deepEqual(parseExtensionDownloadCommand("install Pearl Everywhere"), {
    kind: "open-extension-download",
  });
  assert.equal(parseExtensionDownloadCommand("download this page"), null);
});

test("administrative parser recognizes canonical domain names", () => {
  assert.deepEqual(parseAdministrativeCommand("wipe the entire canvas and all AI nodes"), {
    kind: "clear-workspace",
    domains: ["paper", "ai"],
  });
  assert.deepEqual(parseAdministrativeCommand("remove all functions and lenses"), {
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
    parseAdministrativeCommand("also the lenses, not the functions", {
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

test("pending clear accepts only explicit confirmation, denial, or clear-domain amendments", () => {
  assert.equal(parseAdministrativeCommand("create an investment memo function", {
    previousDomains: ["generators"],
    pending: true,
  }), null);
  assert.equal(parseAdministrativeCommand("show me what you can do", {
    previousDomains: ["generators"],
    pending: true,
  }), null);
});

test("screenshot Function requests use canonical deterministic steps without gateway planning", () => {
  const parsed = parseFunctionCreationCommand(
    "create me a function that gives me an investment memo and decompose all the steps that would go into that and also one that analyzes a movie from the evaluation criteria of Steven Spielberg"
  );
  assert.equal(parsed.steps.length, 2);
  assert.deepEqual(parsed.steps.map((step) => step.verb), ["createFunction", "createFunction"]);
  assert.ok(parsed.steps.every((step) => step.args.steps.length >= 5));
  assert.match(parsed.steps[1].args.description, /without claiming his private judgment/);
  assert.equal(parseFunctionCreationCommand("create an investment memo function").steps.length, 1);
});

test("S32 investor utterance scaffolds a role pearl instead of orphan Functions", () => {
  const utterance =
    "I'm an investor at S32 and I want you to research a pearl and make me a pearl that has an investment memo function and a diligence function that understands my lens as an investor.";
  const role = parseInvestorRolePearlCommand(utterance);
  assert.equal(role.verb, "createRolePearl");
  assert.equal(role.args.firm, "S32");
  assert.equal(role.args.wear, true);
  assert.equal(role.args.openStudio, true);
  assert.equal(parseFunctionCreationCommand(utterance), null);
});

test("three named branch perspectives parse exactly and vague safe requests choose a reversible demo", () => {
  const parsed = parseParallelBranchCommand(
    "Branch A: optimistic, Branch B: conservative, Branch C: inverted opposition perspective"
  );
  assert.deepEqual(parsed.args.branchSpecs.map((branch) => branch.instruction), [
    "optimistic",
    "conservative",
    "inverted opposition perspective",
  ]);
  assert.equal(parseSafeDemonstrationCommand("do anything give me anything show me what you can do", true).demoId, "safe-capability-sample");
  assert.equal(parsePearlCapabilityDemoCommand("watch what pearl can do")?.verb, "playPearlCapabilityDemo");
  assert.equal(parseSafeDemonstrationCommand("watch what pearl can do")?.verb, "playPearlCapabilityDemo");
});

test("universal transfer requests use the shared deterministic capability", () => {
  assert.deepEqual(
    parseSemanticTransferCommand("turn this whole command into a Move exactly as written"),
    { verb: "semanticTransfer", args: { destination: "moves" } }
  );
  assert.deepEqual(
    parseSemanticTransferCommand("drop this into Functions and decompose it"),
    { verb: "semanticTransfer", args: { destination: "functions" } }
  );
  assert.deepEqual(
    parseSemanticTransferCommand("put these into a Lens even though I don't know what connects them"),
    { verb: "semanticTransfer", args: { destination: "lenses" } }
  );
  assert.deepEqual(
    parseSemanticTransferCommand("combine whatever I selected in the way that makes most sense"),
    { verb: "semanticTransfer", args: { destination: "functions" } }
  );
});

test("command ledger retries only the last failed or unexecuted executable command", () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  const first = beginCommand("create an investment memo function", {}, storage);
  updateCommand(first.id, { status: "failed", failure: "planner unavailable", plan: { version: 1 } }, storage);
  const second = beginCommand("show me what you can do", {}, storage);
  updateCommand(second.id, { status: "executed", effects: ["demo"] }, storage);
  assert.equal(lastRecoverableCommand(storage).id, first.id);
  assert.equal(isRetryRequest("you didn't execute my last command"), true);
  assert.equal(isRetryRequest("do it again"), true);
});

test("raw planner, schema, gateway, and ReferenceError details never become user copy", () => {
  for (const error of [
    new Error("plan.root.steps[0].query: is not a supported workspace query"),
    new ReferenceError("y is not defined"),
    new Error("fetch failed"),
  ]) {
    const copy = publicCompanionError(error);
    assert.doesNotMatch(copy, /plan\.root|supported workspace query|y is not defined|fetch failed/);
  }
});

test("empty gauntlet and credential blockers map to stable execution codes in chat copy", async () => {
  const { formatExecutionChatMessage, inferExecutionCode, EXECUTION_CODES } = await import("../../shared/execution-result.js");
  assert.equal(
    inferExecutionCode("Gauntlet working memory is empty — wear at least one pearl before evaluating on-screen material."),
    EXECUTION_CODES.EMPTY_GAUNTLET,
  );
  const chat = formatExecutionChatMessage({
    status: "blocked",
    code: EXECUTION_CODES.EMPTY_GAUNTLET,
    message: "Gauntlet working memory is empty — wear at least one pearl first.",
  });
  assert.match(chat, /\[empty-gauntlet\]/);
  assert.match(chat, /^Blocked:/);
  assert.equal(inferExecutionCode("Live model critique needs credentials"), EXECUTION_CODES.NEEDS_CREDENTIALS);
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
    "delete all the functions in my current function tab as well as all the lenses and delete every single thing that's in my whitebaord as well as in my AI space";
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
  assert.equal(parseAdministrativeCommand("show me all lenses"), null);
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
    "clearFunctions",
    "clearLenses",
    "clearWorkspaceDomains",
  ]) {
    assert.ok(COMPANION_VERBS[verb], `${verb} is documented for the companion`);
  }
});

test("output destination intents cover download tab textbox and cursor", () => {
  assert.deepEqual(parseOutputDestinationCommand("download this as markdown"), {
    verb: "chooseResultDestination",
    args: { pearlId: "last", answer: "download this as markdown" },
  });
  assert.deepEqual(parseOutputDestinationCommand("open it in a new tab"), {
    verb: "chooseResultDestination",
    args: { pearlId: "last", answer: "open it in a new tab" },
  });
  assert.equal(parseOutputDestinationCommand("point with the pearl where the output should go").verb, "indicateOutputWithCursor");
  assert.equal(parseOutputDestinationCommand("drag a text box for the output").verb, "chooseResultDestination");
});

test("pearl aesthetic commands parse presets, reset, and sample", () => {
  assert.deepEqual(parsePearlAestheticCommand("use the celadon pearl look"), {
    verb: "applyPearlAestheticPreset",
    args: { preset: "celadon" },
  });
  assert.deepEqual(parsePearlAestheticCommand("reset the pearl colors"), {
    verb: "resetPearlAesthetic",
    args: {},
  });
  assert.deepEqual(parsePearlAestheticCommand("sample #78b89f for the pearl"), {
    verb: "samplePearlAestheticFromScreen",
    args: { color: "#78b89f" },
  });
  assert.deepEqual(parsePearlAestheticCommand("make the pearl more gloss"), {
    verb: "setPearlAesthetic",
    args: { material: { gloss: 0.72 } },
  });
  assert.ok(COMPANION_VERBS.setPearlAesthetic);
  assert.ok(COMPANION_VERBS.applyPearlAestheticPreset);
  assert.ok(COMPANION_VERBS.samplePearlAestheticFromScreen);
});

test("wear / remove / encode conversation parse as companion pearl verbs", () => {
  assert.deepEqual(parsePearlRemixCommand("wear Friday standup"), {
    verb: "wearPearl",
    args: { name: "Friday standup" },
  });
  assert.deepEqual(parseTranscriptLearningCommand("put on the LP briefings pearl"), {
    verb: "wearPearl",
    args: { name: "LP briefings" },
  });
  assert.deepEqual(parseTranscriptLearningCommand("load the LP briefings pearl into the gauntlet"), {
    verb: "wearPearl",
    args: { name: "LP briefings" },
  });
  assert.deepEqual(parseTranscriptLearningCommand("which pearls are in working memory"), {
    verb: "listWornPearls",
    args: {},
  });
  assert.deepEqual(parseTranscriptLearningCommand("take off the worn pearl"), {
    verb: "removeWornPearl",
    args: {},
  });
  assert.deepEqual(parseTranscriptLearningCommand("make this conversation a function I can replay"), {
    verb: "encodeConversationAsPearl",
    args: { preferExisting: true },
  });
  assert.deepEqual(parseTranscriptLearningCommand("encode this chat into a new pearl"), {
    verb: "encodeConversationAsPearl",
    args: { forceNew: true },
  });
  assert.deepEqual(parseTranscriptLearningCommand("add this conversation into the LP briefings pearl"), {
    verb: "encodeConversationAsPearl",
    args: { targetPearlName: "LP briefings" },
  });
  const adaptive = buildAdaptiveCompanionPrompt({
    wornPearlPack: { name: "LP briefings", pearlId: "p1", functions: [{ name: "Memo" }], lenses: [], context: [{}] },
  });
  assert.match(adaptive, /Worn pearl: “LP briefings”/);
  assert.match(adaptive, /System prompt/);
  assert.doesNotMatch(adaptive, /\(p1\)/);
  assert.ok(COMPANION_VERBS.wearPearl);
  assert.ok(COMPANION_VERBS.removeWornPearl);
  assert.ok(COMPANION_VERBS.encodeConversationAsPearl);
  assert.ok(COMPANION_VERBS.discoverFormingPearls);
  assert.ok(COMPANION_VERBS.inspectPearlMetadata);
  assert.ok(COMPANION_VERBS.rearrangeGauntlet);
});

test("pearl remix maps exchange/breed/import/metadata intents to validated verbs", () => {
  assert.deepEqual(parsePearlRemixCommand("exchange insights between these pearls"), {
    verb: "synthesizeSemanticOrbs",
    args: { ids: [], sceneId: "", mode: "mutual" },
  });
  assert.deepEqual(parsePearlRemixCommand("import this chat and find the pearls that were already forming"), {
    verb: "discoverFormingPearls",
    args: { materialize: true },
  });
  assert.equal(
    parsePearlRemixCommand("import this chat and find the pearls that were already forming")?.args?.text,
    undefined,
  );
  const pasted = [
    "User: Can you summarize this investment memo as an LP briefing for partners?",
    "Assistant: Here is a draft.",
    "User: Rewrite that for a limited partner meeting and tighten bios.",
    "find the pearls that were already forming",
  ].join("\n\n");
  const withCorpus = parsePearlRemixCommand(pasted);
  assert.equal(withCorpus?.verb, "discoverFormingPearls");
  assert.match(withCorpus?.args?.text || "", /summarize this investment memo/);
  assert.equal(parsePearlRemixCommand("inspect the metadata under this pearl")?.verb, "inspectPearlMetadata");
  assert.deepEqual(parsePearlRemixCommand("reorder the gauntlet pearls"), {
    verb: "rearrangeGauntlet",
    args: { pearlIds: [] },
  });
});

test("function-move reorder/decompose parsers are deterministic and capability-backed", () => {
  assert.deepEqual(parsePearlFunctionMovesCommand("put the last move first"), {
    verb: "reorderPearlFunctionMoves",
    args: { from: "last", to: "first" },
  });
  assert.deepEqual(parsePearlFunctionMovesCommand("move the first move to the end"), {
    verb: "reorderPearlFunctionMoves",
    args: { from: "first", to: "last" },
  });
  assert.equal(parsePearlRemixCommand("put the last move first")?.verb, "reorderPearlFunctionMoves");
  assert.deepEqual(parsePearlFunctionMovesCommand("decompose the first move"), {
    verb: "decomposePearlFunctionMove",
    args: { move: "first" },
  });
  assert.equal(parsePearlFunctionMovesCommand("break that step into smaller moves")?.verb, "decomposePearlFunctionMove");
  assert.ok(COMPANION_VERBS.reorderPearlFunctionMoves);
  assert.ok(COMPANION_VERBS.decomposePearlFunctionMove);
  assert.ok(COMPANION_VERBS.reorderExternalPearlFunctionMoves);
  assert.ok(COMPANION_VERBS.decomposeExternalPearlFunctionMove);
  assert.match(COMPANION_VERBS.reorderPearlFunctionMoves.purpose, /reorderStep|LensTreeEditor/i);
  assert.match(COMPANION_VERBS.decomposePearlFunctionMove.purpose, /Decompose/i);
});

test("planner requires executable commands to act without chatter", () => {
  const prompt = buildCompanionSystemPrompt();
  assert.match(prompt, /for every executable request, set "say" to ""/);
  assert.match(prompt, /Do not acknowledge, praise, summarize, or announce/);
  assert.match(prompt, /Cursor-style check-ins/);
  assert.match(prompt, /captureScreenAsEvidence/);
  assert.match(prompt, /wearPearl/);
  assert.match(prompt, /encodeConversationAsPearl/);
  const worn = buildCompanionSystemPrompt({
    wornPearlPack: { name: "LP briefings", functions: [{ name: "Memo" }], context: [{}] },
  });
  assert.match(worn, /Worn pearl: “LP briefings”/);
});

test("adaptive planner documents framework metadata outside capability args", () => {
  const prompt = buildAdaptiveCompanionPrompt();
  assert.match(prompt, /Framework action metadata \(never place these keys inside args\)/);
  assert.match(prompt, /action\.confirmed/);
  assert.match(prompt, /Handler-confirmed actions stage the app's normal counted confirmation/);
});

test("adaptive planner preserves canonical Taste Lens and creative attribution boundaries", () => {
  const taste = buildAdaptiveCompanionPrompt({
    goal: { rawWording: "save this to my taste Lens for writing", outcomes: ["remember this writing preference"] },
  });
  assert.match(taste, /resolveTasteLens\(/);
  assert.match(taste, /saveTasteTeaching\(/);
  assert.match(taste, /Taste Lens is the canonical Lens/);
  assert.match(taste, /never an authorship detector claim/);

  const creative = buildAdaptiveCompanionPrompt({
    goal: { rawWording: "make me Picasso's five most common Functions", outcomes: ["five inferred recurring processes"] },
  });
  assert.match(creative, /createCreativeResearchProposal\(/);
  assert.match(creative, /Historical\/persona creativity must research first/);
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

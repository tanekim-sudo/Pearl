import test from "node:test";
import assert from "node:assert/strict";

import {
  COMPANION_LLM_TIMEOUT_MS,
  COMPANION_VERBS,
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

test("companion LLM timeout is below the product maximum", () => {
  assert.ok(COMPANION_LLM_TIMEOUT_MS <= 10_000);
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

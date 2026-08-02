import assert from "node:assert/strict";
import test from "node:test";
import {
  observePearlCursorContext,
  runPearlCursorHarnessOffline,
  buildCursorForPearlsSystemPrefix,
} from "./pearl-cursor-harness.js";
import { COMPANION_PEARL_JOB_PACK } from "./companion-pearl-job.js";

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
  moves: [{ name: "Read the filings" }],
  weights: [{ name: "Moat durability", priority: 92 }],
  lenses: [{ name: "Owner mindset" }],
};

test("observePearlCursorContext injects job pack + app snapshot", () => {
  const observation = observePearlCursorContext({
    utterance: COMPARE_PDF,
    pearls: [investor, buffett],
    activePearl: investor,
    appSnapshotOptions: {
      screen: "reef",
      gauntletPearls: [investor],
      reefPearls: [investor, buffett],
    },
  });
  assert.equal(observation.grounding?.jobPack, COMPANION_PEARL_JOB_PACK);
  assert.equal(observation.snapshot?.currentScreen, "reef");
  assert.match(observation.modelContext || "", /Cursor for pearls/);
  assert.match(observation.modelContext || "", /App understanding snapshot/);
});

test("cursor harness offline routes compare+PDF as operate without mutating prompt", () => {
  const prior = investor.systemPrompt;
  const run = runPearlCursorHarnessOffline({
    utterance: COMPARE_PDF,
    pearls: [investor, buffett],
    activePearl: investor,
    appSnapshotOptions: {
      reefPearls: [investor, buffett],
      gauntletPearls: [investor],
    },
  });
  assert.equal(run.cursorForPearls, true);
  assert.equal(run.toolClass, "operate");
  assert.equal(run.mutatesSystemPrompt, false);
  assert.equal(run.apply?.command?.verb, "comparePearls");
  assert.equal(investor.systemPrompt, prior);
  assert.ok(!String(investor.systemPrompt).includes("explain the differences"));
});

test("buildCursorForPearlsSystemPrefix always includes identity pack", () => {
  const prefix = buildCursorForPearlsSystemPrefix({
    snapshot: {
      currentScreen: "studio",
      openPearl: { name: investor.name, id: investor.id },
      gauntletTitles: [investor.name],
      reefPearlNames: [investor.name, buffett.name],
      studioOpen: true,
    },
  });
  assert.match(prefix, /Cursor for pearls/);
  assert.match(prefix, /mutate_brain/);
  assert.match(prefix, /operate/);
  assert.match(prefix, /Current screen: studio/);
});

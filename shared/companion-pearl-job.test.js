import assert from "node:assert/strict";
import test from "node:test";
import {
  COMPANION_PEARL_JOB_PACK,
  COMPANION_PEARL_JOB_VERSION,
  attachCompanionGrounding,
  buildCompanionAppSnapshot,
  buildCompanionGrounding,
  formatCompanionAppSnapshotForModel,
  formatCompanionGroundingForModel,
  formatCompanionPearlJobPack,
  inferCompanionScreen,
} from "./companion-pearl-job.js";
import {
  classifyPearlCompanionClass,
  proposePearlOperate,
  runPearlOperateHarnessOffline,
} from "./pearl-operate-harness.js";
import {
  observePearlPromptContext,
  runPearlPromptHarnessOffline,
} from "./pearl-prompt-harness.js";

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

test("job pack exports durable Companion identity", () => {
  assert.equal(COMPANION_PEARL_JOB_VERSION, 1);
  assert.equal(typeof COMPANION_PEARL_JOB_PACK, "string");
  assert.equal(formatCompanionPearlJobPack(), COMPANION_PEARL_JOB_PACK);
  assert.match(COMPANION_PEARL_JOB_PACK, /Cursor for pearls/i);
  assert.match(COMPANION_PEARL_JOB_PACK, /Moves/);
  assert.match(COMPANION_PEARL_JOB_PACK, /Weights/);
  assert.match(COMPANION_PEARL_JOB_PACK, /Lenses/);
  assert.match(COMPANION_PEARL_JOB_PACK, /systemPrompt/);
  assert.match(COMPANION_PEARL_JOB_PACK, /mutate_brain/);
  assert.match(COMPANION_PEARL_JOB_PACK, /operate/);
  assert.match(COMPANION_PEARL_JOB_PACK, /Never call editPearlSystemPrompt|never append/i);
  assert.match(COMPANION_PEARL_JOB_PACK, /Reef/);
  assert.match(COMPANION_PEARL_JOB_PACK, /Gauntlet/);
  assert.match(COMPANION_PEARL_JOB_PACK, /Studio/);
});

test("app snapshot includes required turn fields", () => {
  const snap = buildCompanionAppSnapshot({
    path: "/",
    openPearl: { name: "Buffett · investing", id: "pearl:buffett" },
    gauntletTitles: ["Buffett · investing", "My investor pearl"],
    reefPearlNames: ["Buffett · investing", "My investor pearl", "Poetry"],
    studioOpen: true,
    studioPearlName: "Buffett · investing",
    sceneName: "Investing play",
  });
  assert.equal(snap.currentScreen, "studio");
  assert.equal(snap.openPearl?.name, "Buffett · investing");
  assert.deepEqual(snap.gauntletTitles, ["Buffett · investing", "My investor pearl"]);
  assert.ok(snap.reefPearlNames.includes("Poetry"));
  assert.equal(snap.studioOpen, true);
  assert.equal(snap.studioPearlName, "Buffett · investing");
  assert.match(snap.summary, /screen:studio/);
  const text = formatCompanionAppSnapshotForModel(snap);
  assert.match(text, /Current screen: studio/);
  assert.match(text, /Gauntlet/);
  assert.match(text, /Reef pearls/);
  assert.match(text, /Studio: open/);
});

test("inferCompanionScreen maps path and studio", () => {
  assert.equal(inferCompanionScreen({ path: "/" }), "reef");
  assert.equal(inferCompanionScreen({ path: "/install" }), "install");
  assert.equal(inferCompanionScreen({ hash: "#pearl-studio" }), "studio");
  assert.equal(inferCompanionScreen({ sceneOpen: true }), "scene");
});

test("grounding combines job pack + snapshot + pearl context", () => {
  const grounding = buildCompanionGrounding({
    pearl: investor,
    appSnapshot: buildCompanionAppSnapshot({
      path: "/",
      gauntletTitles: ["My investor pearl"],
      reefPearlNames: ["My investor pearl", "Buffett · investing"],
      openPearl: { name: investor.name, id: investor.id },
    }),
    appState: { wornPearlIds: [investor.id], worn: true },
  });
  assert.equal(grounding.jobPack, COMPANION_PEARL_JOB_PACK);
  assert.equal(grounding.appSnapshot.currentScreen, "reef");
  assert.ok(grounding.pearlContext);
  assert.equal(grounding.pearlContext.name, "My investor pearl");
  const formatted = formatCompanionGroundingForModel(grounding);
  assert.match(formatted, /Cursor for pearls/);
  assert.match(formatted, /App understanding snapshot/);
  assert.match(formatted, /Active pearl context|Title:/);
  const attached = attachCompanionGrounding({ verb: "comparePearls" }, { appSnapshot: grounding.appSnapshot, pearl: investor });
  assert.equal(attached.verb, "comparePearls");
  assert.ok(attached.grounding?.appSnapshot);
});

test("operate path still never mutates systemPrompt with grounding present", () => {
  const prior = investor.systemPrompt;
  assert.equal(classifyPearlCompanionClass(COMPARE_PDF, { hasActivePearl: true }).class, "operate");
  const proposal = proposePearlOperate(COMPARE_PDF, [investor, buffett], {
    activePearl: investor,
    appState: {
      appSnapshot: buildCompanionAppSnapshot({
        path: "/",
        reefPearlNames: [investor.name, buffett.name],
        gauntletTitles: [investor.name],
      }),
    },
  });
  assert.equal(proposal.ok, true);
  assert.equal(proposal.mutatesSystemPrompt, false);
  const run = runPearlOperateHarnessOffline({
    utterance: COMPARE_PDF,
    pearls: [investor, buffett],
    activePearl: investor,
    appState: {
      appSnapshot: buildCompanionAppSnapshot({
        reefPearlNames: [investor.name, buffett.name],
      }),
    },
  });
  assert.equal(run.mutatesSystemPrompt, false);
  assert.equal(run.apply?.command?.verb, "comparePearls");
  assert.ok(run.observation?.grounding?.jobPack);
  assert.ok(run.observation?.appSnapshot?.currentScreen);
  assert.equal(investor.systemPrompt, prior);

  const promptRun = runPearlPromptHarnessOffline({
    utterance: COMPARE_PDF,
    pearl: investor,
    pearls: [investor, buffett],
    appState: {
      appSnapshot: buildCompanionAppSnapshot({ path: "/", openPearl: investor }),
    },
  });
  assert.equal(promptRun.apply?.command?.verb, "comparePearls");
  assert.equal(promptRun.mutatesSystemPrompt, false);
  assert.equal(investor.systemPrompt, prior);
});

test("observePearlPromptContext includes job grounding fields", () => {
  const observation = observePearlPromptContext(investor, {
    worn: true,
    wornPearlIds: [investor.id],
    appSnapshot: buildCompanionAppSnapshot({
      path: "/",
      openPearl: { name: investor.name, id: investor.id },
      gauntletTitles: [investor.name],
      reefPearlNames: [investor.name],
      studioOpen: false,
    }),
  });
  assert.ok(observation.grounding?.jobPack);
  assert.ok(observation.appSnapshot?.currentScreen);
  assert.equal(observation.appSnapshot.openPearl?.name, investor.name);
  assert.match(observation.modelContext || "", /Cursor for pearls/);
  assert.match(observation.modelContext || "", /App understanding snapshot/);
});

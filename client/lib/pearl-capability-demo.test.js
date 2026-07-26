import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPearlCapabilityDemoSteps,
  hasPlayedPearlCapabilityDemo,
  isPearlCapabilityDemoPearl,
  markPearlCapabilityDemoPlayed,
  PEARL_CAPABILITY_DEMO_ID,
  PEARL_CAPABILITY_DEMO_NAME,
  PEARL_CAPABILITY_DEMO_STORAGE_KEY,
} from "./pearl-capability-demo.js";
import { findDemo } from "./companion-demos.js";
import { parsePearlCapabilityDemoCommand } from "./companion-intent.js";

test("pearl capability demo steps stay on current Pearl vision verbs", () => {
  const steps = buildPearlCapabilityDemoSteps();
  const verbs = steps.map((step) => step.verb);
  assert.ok(verbs.includes("createRolePearl"));
  assert.ok(verbs.includes("wearPearl"));
  assert.ok(verbs.includes("openPearlStudio"));
  assert.ok(verbs.includes("reorderPearlFunctionMoves"));
  assert.ok(verbs.includes("openEncodeAnything"));
  assert.ok(verbs.includes("openExtensionDownload"));
  assert.ok(!verbs.includes("spawnText"));
  assert.ok(!verbs.includes("highlight"));
  assert.ok(!verbs.includes("dragItemToAi"));
  assert.equal(findDemo(PEARL_CAPABILITY_DEMO_ID)?.id, PEARL_CAPABILITY_DEMO_ID);
  assert.match(findDemo(PEARL_CAPABILITY_DEMO_ID)?.title || "", /Watch what Pearl can do/i);
});

test("demo pearl identity helper matches disposable namespace", () => {
  assert.equal(isPearlCapabilityDemoPearl({ id: "demo:capability-1", name: "x" }), true);
  assert.equal(isPearlCapabilityDemoPearl({ id: "p1", name: PEARL_CAPABILITY_DEMO_NAME }), true);
  assert.equal(isPearlCapabilityDemoPearl({ id: "p1", name: "Series A notes" }), false);
});

test("parsePearlCapabilityDemoCommand matches Play demo phrases", () => {
  assert.equal(parsePearlCapabilityDemoCommand("watch what pearl can do")?.verb, "playPearlCapabilityDemo");
  assert.equal(parsePearlCapabilityDemoCommand("show me what Pearl can do")?.verb, "playPearlCapabilityDemo");
  assert.equal(parsePearlCapabilityDemoCommand("play demo")?.verb, "playPearlCapabilityDemo");
  assert.equal(parsePearlCapabilityDemoCommand("make a pearl about cats"), null);
});

test("markPearlCapabilityDemoPlayed persists a played flag", () => {
  const mem = new Map();
  const storage = {
    getItem: (key) => (mem.has(key) ? mem.get(key) : null),
    setItem: (key, value) => { mem.set(key, String(value)); },
  };
  assert.equal(hasPlayedPearlCapabilityDemo(storage), false);
  markPearlCapabilityDemoPlayed(storage);
  assert.equal(hasPlayedPearlCapabilityDemo(storage), true);
  assert.ok(mem.get(PEARL_CAPABILITY_DEMO_STORAGE_KEY));
});

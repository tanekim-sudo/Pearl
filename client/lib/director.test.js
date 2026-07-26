import test from "node:test";
import assert from "node:assert/strict";

import {
  DIRECTOR_EFFECT_TRACE_VERSION,
  clearDirectorEffectTraces,
  directorRunning,
  enrichDirectorArgs,
  executeCapabilityScriptDirect,
  getDirectorEffectTraces,
  registerDirectorVerbs,
  resolveDirectorPoint,
  runDirectorScript,
} from "./director.js";

test("enrichDirectorArgs injects active sceneId for required merge/synthesize args", () => {
  const previous = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: () => JSON.stringify({ activeSceneId: "scene-active", scenes: [{ id: "scene-active" }] }),
    setItem() {},
    removeItem() {},
  };
  try {
    const merged = enrichDirectorArgs("mergeSemanticOrbs", { ids: ["a", "b"], name: "Merged" });
    assert.equal(merged.sceneId, "scene-active");
    const kept = enrichDirectorArgs("mergeSemanticOrbs", { ids: ["a"], sceneId: "explicit", name: "X" });
    assert.equal(kept.sceneId, "explicit");
    const optional = enrichDirectorArgs("organizePearl", { id: "p1" });
    assert.equal(optional.sceneId, undefined);
  } finally {
    globalThis.localStorage = previous;
  }
});

test("resolveDirectorPoint accepts coordinates, points, and element-like targets", () => {
  assert.deepEqual(resolveDirectorPoint(10, 20), { x: 10, y: 20 });
  assert.deepEqual(resolveDirectorPoint({ x: 3, y: 4 }), { x: 3, y: 4 });
  assert.equal(resolveDirectorPoint(null), null);
});

test("nested runDirectorScript from inside a verb does not crash parent trace", async () => {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const originalMatchMedia = globalThis.matchMedia;
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  const classes = new Set();
  globalThis.document = {
    body: {
      classList: {
        add: (name) => classes.add(name),
        remove: (name) => classes.delete(name),
      },
    },
  };
  globalThis.window = {
    innerWidth: 1280,
    innerHeight: 800,
    dispatchEvent: () => {},
  };
  globalThis.matchMedia = () => ({ matches: true });
  globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(performance.now()), 0);

  try {
    clearDirectorEffectTraces();
    let nestedRan = 0;
    registerDirectorVerbs({
      nestedLeaf: async () => {
        nestedRan += 1;
        return { effects: ["nested-leaf"] };
      },
      nestedDemoHost: async (_args, _tk, ctx) => {
        const inner = await runDirectorScript(
          [{ verb: "nestedLeaf", args: {} }],
          { title: "inner tour", vars: ctx.vars, speed: 3 },
        );
        return {
          type: "demo",
          completed: inner.completed !== false,
          effects: ["nested-demo-host", ...(inner.effects || [])],
        };
      },
    });
    const execution = await runDirectorScript(
      [{ verb: "nestedDemoHost", args: {} }],
      { title: "outer demo", speed: 3 },
    );
    assert.equal(execution.completed, true, `expected success, got errors=${JSON.stringify(execution.errors)}`);
    assert.equal(nestedRan, 1);
    assert.equal(directorRunning(), false);
    const { active, completed } = getDirectorEffectTraces();
    assert.equal(active, null);
    assert.equal(completed.length, 1);
    assert.equal(completed[0].status, "completed");
    assert.ok(completed[0].events.some((event) => event.type === "run-start"));
    assert.ok(completed[0].events.some((event) => event.capability === "nestedLeaf"));
    assert.ok(completed[0].events.some((event) => event.type === "run-complete"));
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
    globalThis.matchMedia = originalMatchMedia;
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
  }
});

test("direct capability execution mutates without starting demonstration motion", async () => {
  let mutations = 0;
  registerDirectorVerbs({
    directFixture: async (_args, toolkit) => {
      await toolkit.moveTo(900, 500);
      toolkit.caption("must stay silent");
      mutations += 1;
      return { effects: ["fixture-mutated"] };
    },
  });
  clearDirectorEffectTraces();
  const execution = await executeCapabilityScriptDirect([{ verb: "directFixture", args: {} }]);
  assert.equal(execution.completed, true);
  assert.equal(mutations, 1);
  assert.equal(directorRunning(), false);
  assert.deepEqual(getDirectorEffectTraces(), { active: null, completed: [] });
});

test("director records versioned causal effect traces in reduced-motion mode", async () => {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const originalMatchMedia = globalThis.matchMedia;
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  const classes = new Set();
  globalThis.document = {
    body: {
      classList: {
        add: (name) => classes.add(name),
        remove: (name) => classes.delete(name),
      },
    },
  };
  globalThis.window = {
    innerWidth: 360,
    innerHeight: 720,
    dispatchEvent: () => {},
  };
  globalThis.matchMedia = () => ({ matches: true });
  globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(performance.now()), 0);

  try {
    clearDirectorEffectTraces();
    registerDirectorVerbs({
      traceFixture: async (_args, toolkit) => {
        await toolkit.click(40, 60);
        return { fixtureId: "fixture-1" };
      },
    });
    const execution = await runDirectorScript(
      [{ id: "step-1", verb: "traceFixture", args: {} }],
      { title: "reduced motion trace", speed: 3 }
    );
    assert.equal(execution.completed, true);
    const { active, completed } = getDirectorEffectTraces();
    assert.equal(active, null);
    assert.equal(completed.length, 1);
    const trace = completed[0];
    assert.equal(trace.version, DIRECTOR_EFFECT_TRACE_VERSION);
    assert.equal(trace.status, "completed");
    assert.equal(trace.reducedMotion, true);
    assert.deepEqual(trace.viewport, { width: 360, height: 720 });
    assert.deepEqual(trace.expectedCapabilities, ["traceFixture"]);
    assert.ok(trace.events.some((event) =>
      event.type === "cursor-move" &&
      event.reducedMotion === true &&
      event.capability === "traceFixture"
    ));
    assert.ok(trace.events.some((event) => event.type === "gesture-press"));
    assert.ok(trace.events.some((event) => event.type === "step-complete"));
    assert.equal(trace.events.at(-1).type, "run-complete");
    assert.equal(classes.size, 0);
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
    globalThis.matchMedia = originalMatchMedia;
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
  }
});

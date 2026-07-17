import test from "node:test";
import assert from "node:assert/strict";

import {
  DIRECTOR_EFFECT_TRACE_VERSION,
  clearDirectorEffectTraces,
  getDirectorEffectTraces,
  registerDirectorVerbs,
  runDirectorScript,
} from "./director.js";

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

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  TOUR_STEPS,
  TOUR_PHASES,
  createTourContext,
  isStepComplete,
  snapshotTourBaseline,
  tourEvent,
  getPhaseIndex,
} from "./onboarding-steps.js";

describe("onboarding-steps", () => {
  it("covers all major phases", () => {
    for (const phase of TOUR_PHASES) {
      assert.ok(TOUR_STEPS.some((s) => s.phase === phase), `missing step for phase ${phase}`);
    }
  });

  it("has unique step ids", () => {
    const ids = TOUR_STEPS.map((s) => s.id);
    assert.equal(ids.length, new Set(ids).size);
  });

  it("verifies pen draw when stroke count increases", () => {
    const ctx = createTourContext();
    const state = { items: [{ type: "stroke" }, { type: "stroke" }] };
    snapshotTourBaseline(ctx, { items: [{ type: "stroke" }] });
    const step = TOUR_STEPS.find((s) => s.id === "pen-draw");
    assert.ok(step);
    assert.equal(isStepComplete(step, ctx, state), true);
  });

  it("pen draw stays complete after re-baseline at new count", () => {
    const ctx = createTourContext();
    const state = { items: [{ type: "stroke" }] };
    snapshotTourBaseline(ctx, { items: [] });
    const step = TOUR_STEPS.find((s) => s.id === "pen-draw");
    assert.ok(step);
    assert.equal(isStepComplete(step, ctx, state), true);
    snapshotTourBaseline(ctx, state);
    assert.equal(isStepComplete(step, ctx, state), false);
  });

  it("records tour events", () => {
    const ctx = createTourContext();
    tourEvent(ctx, "tools-expanded");
    const step = TOUR_STEPS.find((s) => s.id === "tools-bar");
    assert.ok(step);
    assert.equal(isStepComplete(step, ctx, {}), true);
  });

  it("manual steps always complete", () => {
    const ctx = createTourContext();
    const welcome = TOUR_STEPS.find((s) => s.id === "welcome");
    assert.equal(isStepComplete(welcome, ctx, {}), true);
  });

  it("getPhaseIndex returns valid indices", () => {
    assert.equal(getPhaseIndex("Welcome"), 0);
    assert.equal(getPhaseIndex("Extras"), TOUR_PHASES.length - 1);
  });
});

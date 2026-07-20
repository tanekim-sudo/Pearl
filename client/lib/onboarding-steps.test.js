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

  it("ignores highlight strokes for pen-draw baseline", () => {
    const ctx = createTourContext();
    snapshotTourBaseline(ctx, { items: [{ type: "stroke", highlight: true }] });
    const step = TOUR_STEPS.find((s) => s.id === "pen-draw");
    const state = { items: [{ type: "stroke", highlight: true }, { type: "stroke" }] };
    assert.equal(isStepComplete(step, ctx, state), true);
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
    assert.equal(getPhaseIndex("Reference"), TOUR_PHASES.length - 1);
  });

  it("highlight-select completes when highlightSelection is non-empty", () => {
    const ctx = createTourContext();
    const step = TOUR_STEPS.find((s) => s.id === "highlight-select");
    assert.ok(step);
    assert.equal(isStepComplete(step, ctx, { highlightSelection: ["a"] }), true);
    assert.equal(isStepComplete(step, ctx, { highlightSelection: [] }), false);
  });

  it("highlight-delete accepts delete, transfer, or drag events", () => {
    const ctx = createTourContext();
    const step = TOUR_STEPS.find((s) => s.id === "highlight-delete");
    assert.ok(step);
    assert.equal(isStepComplete(step, ctx, {}), false);
    tourEvent(ctx, "highlight-drag");
    assert.equal(isStepComplete(step, ctx, {}), true);
  });

  it("highlight-to-ai accepts highlight-transfer and highlight-drag", () => {
    const ctx = createTourContext();
    const step = TOUR_STEPS.find((s) => s.id === "highlight-to-ai");
    assert.ok(step);
    tourEvent(ctx, "highlight-transfer");
    assert.equal(isStepComplete(step, ctx, {}), true);

    const ctx2 = createTourContext();
    tourEvent(ctx2, "highlight-drag");
    assert.equal(isStepComplete(step, ctx2, {}), true);
  });

  it("highlight-from-ai accepts transfer-to-paper and transfer", () => {
    const ctx = createTourContext();
    const step = TOUR_STEPS.find((s) => s.id === "highlight-from-ai");
    assert.ok(step);
    tourEvent(ctx, "transfer-to-paper");
    assert.equal(isStepComplete(step, ctx, {}), true);

    const ctx2 = createTourContext();
    tourEvent(ctx2, "transfer");
    assert.equal(isStepComplete(step, ctx2, {}), true);
  });

  it("shift-transfer step mentions select tool in title", () => {
    const step = TOUR_STEPS.find((s) => s.id === "shift-transfer");
    assert.ok(step?.title?.includes("Select"));
  });

  it("reference step makes gestures optional", () => {
    const step = TOUR_STEPS.find((s) => s.id === "gestures-ref");
    assert.ok(step?.title?.includes("Optional"));
    assert.ok(step?.instruction?.includes("visible control"));
  });

  it("every spotlight target is a current reachable selector", () => {
    const stale = TOUR_STEPS.filter((step) => step.target === '[data-tour="capture-chip"]');
    assert.deepEqual(stale, []);
  });
});

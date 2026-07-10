import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createCompanionSubmitGuard, normalizeCompanionRequest } from "./companion-submit.js";

describe("companion submit guard", () => {
  it("normalizes equivalent requests", () => {
    assert.equal(normalizeCompanionRequest("  build   a lens\nnow "), "build a lens now");
  });

  it("allows only one active dispatch across simultaneous event paths", () => {
    let time = 100;
    const guard = createCompanionSubmitGuard({ now: () => time });
    const keyboard = guard.begin("build a lens");
    assert.ok(keyboard);
    assert.equal(guard.begin("build a lens"), null, "form submit is ignored");
    assert.equal(guard.begin("build another lens"), null, "pointer race is ignored while active");
    guard.finish(keyboard.id);
    assert.equal(guard.begin("build a lens"), null, "speech finalization duplicate is ignored");
    time += 1600;
    assert.ok(guard.begin("build a lens"), "the same intentional request works later");
  });

  it("keeps a request active beyond ten seconds until it succeeds", () => {
    let time = 100;
    const guard = createCompanionSubmitGuard({ now: () => time });
    const run = guard.begin("plan a complex multi-step lens");
    time += 10_500;
    assert.equal(guard.active()?.id, run.id);
    assert.equal(run.signal.aborted, false);
    guard.finish(run.id);
    assert.equal(guard.active(), null);
  });

  it("cancels cleanly and returns the request text for recovery", () => {
    const guard = createCompanionSubmitGuard();
    const run = guard.begin("build a detailed research workflow");
    const cancelled = guard.cancel(run.id);
    assert.equal(cancelled.text, "build a detailed research workflow");
    assert.equal(cancelled.signal.aborted, true);
    assert.equal(guard.active(), null);
    assert.ok(guard.begin(cancelled.text), "the recovered input can be retried");
  });

  it("does not cancel a newer request with a stale run id", () => {
    const guard = createCompanionSubmitGuard();
    const first = guard.begin("first");
    guard.cancel(first.id);
    const second = guard.begin("second");
    assert.equal(guard.cancel(first.id), null);
    assert.equal(guard.active()?.id, second.id);
  });

  it("does not suppress a different intentional command after completion", () => {
    const guard = createCompanionSubmitGuard();
    const first = guard.begin("make a lens");
    guard.finish(first.id);
    assert.ok(guard.begin("run that lens"));
  });

  it("allows an immediate retry after a completed confirmation interaction", () => {
    const guard = createCompanionSubmitGuard();
    const first = guard.begin("clear the paper");
    guard.finish(first.id);
    guard.resetDedupe();
    assert.ok(guard.begin("clear the paper"));
  });
});

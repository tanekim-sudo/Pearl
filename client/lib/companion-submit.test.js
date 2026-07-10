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

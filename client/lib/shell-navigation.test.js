import assert from "node:assert/strict";
import test from "node:test";
import { navigateBackOrHome, nextEscapeAction } from "./shell-navigation.js";

test("Escape prefers approval cancel over collapsing Pearl", () => {
  assert.equal(nextEscapeAction({
    approvalPending: true,
    companionExpanded: true,
    emittedView: "settings",
  }), "cancelApproval");
});

test("Escape walks emission then cursor then guide then install", () => {
  assert.equal(nextEscapeAction({ companionExpanded: true }), "collapseCompanion");
  assert.equal(nextEscapeAction({ emittedView: "encode" }), "closeEmission");
  assert.equal(nextEscapeAction({ cursorMode: true }), "exitCursor");
  assert.equal(nextEscapeAction({ guideOpen: true }), "closeGuide");
  assert.equal(nextEscapeAction({ welcomeOpen: true }), "dismissWelcome");
  assert.equal(nextEscapeAction({ installRoute: true }), "leaveInstall");
  assert.equal(nextEscapeAction({ studioOpen: true }), "leaveStudio");
  assert.equal(nextEscapeAction({}), null);
});

test("navigateBackOrHome stays on-origin when history was not Pearl-pushed", () => {
  const result = navigateBackOrHome();
  assert.equal(result.via, "home");
  assert.equal(result.path, "/");
});

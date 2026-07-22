import assert from "node:assert/strict";
import test from "node:test";
import { collectReefPearls, isReefHomePath } from "./reef-home.js";
import { matchShellNavigationIntent, navigateBackOrHome, navigateHome, nextEscapeAction } from "./shell-navigation.js";

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

test("navigateHome lands on the Reef root path", () => {
  assert.equal(navigateHome().path, "/");
  assert.equal(isReefHomePath("/"), true);
  assert.equal(isReefHomePath("/library"), true);
  assert.equal(isReefHomePath("/toolbox"), true);
  assert.equal(isReefHomePath("/scene/x"), false);
});

test("shell navigation intents match Reef and Scene companion phrases", () => {
  assert.equal(matchShellNavigationIntent("go home"), "navigateHome");
  assert.equal(matchShellNavigationIntent("go home to the reef"), "navigateHome");
  assert.equal(matchShellNavigationIntent("open the reef"), "navigateHome");
  assert.equal(matchShellNavigationIntent("go back"), "navigateBack");
  assert.equal(matchShellNavigationIntent("open the library"), "openLibrary");
  assert.equal(matchShellNavigationIntent("go to toolbox"), "openToolbox");
  assert.equal(matchShellNavigationIntent("merge these pearls"), null);
});

test("Reef collects every non-archived pearl across scenes", () => {
  const pearls = collectReefPearls([
    {
      id: "scene-a",
      name: "Briefings",
      semanticOrbs: [
        { id: "p1", name: "LP", kind: "semantic" },
        { id: "p2", name: "Archived", archived: true },
      ],
    },
    {
      id: "scene-b",
      name: "Research",
      semanticOrbs: [{ id: "p3", name: "Sources" }],
    },
  ]);
  assert.deepEqual(pearls.map((entry) => entry.id), ["p1", "p3"]);
  assert.equal(pearls[0].sceneName, "Briefings");
  assert.equal(pearls[1].sceneId, "scene-b");
});

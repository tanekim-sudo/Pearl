import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  PRIMARY_SHELL_SCREENS,
  VISIBLE_SHELL_NAV_IDS,
  visibleShellNavScreens,
} from "./pearl-primary-screens.js";

const root = path.resolve(import.meta.dirname, "../..");
const source = (file) => readFileSync(path.join(root, file), "utf8");

test("primary shell screens inventory is complete and unique", () => {
  assert.ok(PRIMARY_SHELL_SCREENS.length >= 8);
  assert.equal(new Set(PRIMARY_SHELL_SCREENS.map((s) => s.id)).size, PRIMARY_SHELL_SCREENS.length);
  for (const screen of PRIMARY_SHELL_SCREENS) {
    assert.ok(screen.label, `${screen.id} missing label`);
    assert.ok(screen.companionPhrases?.length, `${screen.id} missing companion phrases`);
    assert.ok(screen.worldVisible, `${screen.id} missing worldVisible`);
  }
});

test("visible shell nav ids are mounted in OrbUniverseShell", () => {
  const shell = source("client/components/OrbUniverseShell.jsx");
  assert.match(shell, /data-testid="pearl-shell-nav"/);
  assert.match(shell, /visibleShellNavScreens/);
  assert.match(shell, /data-testid=\{screen\.testId\}/);
  assert.deepEqual(
    visibleShellNavScreens().map((s) => s.testId),
    ["shell-nav-reef", "shell-nav-install", "shell-nav-settings", "shell-nav-encode", "shell-nav-packages"],
  );
  assert.match(shell, /data-testid="extension-download-cta"/);
  assert.match(shell, /CognitivePackageRegistry/);
  assert.match(shell, /function PearlShellNav/);
});

test("install download fallback points at packaged zip under /downloads", () => {
  const shell = source("client/components/OrbUniverseShell.jsx");
  assert.match(shell, /\/downloads\/lens-everywhere-chrome/);
  assert.doesNotMatch(shell, /\/extension\/lens-everywhere-chrome\.zip/);
});

test("VISIBLE_SHELL_NAV_IDS matches helper", () => {
  assert.deepEqual(
    visibleShellNavScreens().map((s) => s.id),
    [...VISIBLE_SHELL_NAV_IDS],
  );
});

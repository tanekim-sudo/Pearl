import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  PHYSICAL_PEARL_CSS,
  PHYSICAL_PEARL_VERSION,
  physicalPearlMarkup,
} from "./physical-pearl.js";
import { defaultPearlAesthetic } from "./pearl-aesthetic.js";
import { inspectPearlVisualContract, PEARL_VISUAL_CONTRACT_VERSION } from "./pearl-visual-contract.js";

const root = path.resolve(import.meta.dirname, "..");

test("arc-reactor mother stack stays inside visual budgets", () => {
  assert.equal(PHYSICAL_PEARL_VERSION, 3);
  assert.equal(PEARL_VISUAL_CONTRACT_VERSION, 3);
  const audit = inspectPearlVisualContract({ variant: "primary", size: 34 });
  assert.equal(audit.valid, true, JSON.stringify(audit));
  assert.ok(audit.metrics.svgElements <= 40);
  const markup = physicalPearlMarkup({ id: "reactor", variant: "primary", size: 34 });
  assert.match(markup, /physical-pearl__core/);
  assert.match(markup, /physical-pearl__ring--outer/);
  assert.match(markup, /physical-pearl__ring--inner/);
  assert.match(PHYSICAL_PEARL_CSS, /physical-pearl-core-breath/);
  assert.match(PHYSICAL_PEARL_CSS, /prefers-reduced-motion/);
  assert.doesNotMatch(PHYSICAL_PEARL_CSS, /\b(?:glow|halo|aura|bloom|neon)\b/i);
});

test("classic aesthetic defaults to cool white-cyan reactor palette", () => {
  const classic = defaultPearlAesthetic({ preset: "classic" });
  assert.equal(classic.colors.nacre, "#9fd4e8");
  assert.equal(classic.colors.nucleusA, "#e8f7ff");
  assert.ok(classic.material.brightness >= 0.68);
  assert.ok(classic.material.nucleusIntensity >= 0.86);
});

test("gauntlet sockets distinguish uncharged empty from charged filled stones", () => {
  const web = readFileSync(path.join(root, "client/orb-universe.css"), "utf8");
  const side = readFileSync(path.join(root, "extension/src/sidepanel/sidepanel.css"), "utf8");
  const bridge = readFileSync(path.join(root, "extension/src/content/bridge.js"), "utf8");
  for (const [label, source] of [["web", web], ["sidepanel", side], ["bridge", bridge]]) {
    assert.match(source, /gauntlet-socket\.empty/, `${label} missing empty socket`);
    assert.match(source, /gauntlet-socket\.filled/, `${label} missing filled socket`);
    assert.match(source, /saturate\(1\.2/, `${label} missing charged stone intensity`);
  }
});

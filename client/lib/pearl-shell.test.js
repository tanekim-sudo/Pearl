import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { FEATURE_CONTRACTS } from "../../shared/feature-contracts.js";
import { DOMAIN_COMMANDS } from "../../shared/domain-commands.js";
import { COMPANION_CAPABILITIES } from "./companion-capabilities.js";
import { EXTENSION_VERBS } from "../../extension/src/sidepanel/companion.js";
import {
  PEARL_ACTIONS,
  PEARL_ACTION_CATEGORIES,
  PEARL_REACHABILITY,
  pearlReachabilityFor,
  searchPearlActions,
} from "./pearl-shell.js";

const root = path.resolve(import.meta.dirname, "../..");
const source = (file) => readFileSync(path.join(root, file), "utf8");

test("Pearl shell characterizes every existing capability without renaming it", () => {
  assert.equal(PEARL_ACTIONS.length, COMPANION_CAPABILITIES.length);
  assert.deepEqual(
    new Set(PEARL_ACTIONS.map((entry) => entry.capability)),
    new Set(COMPANION_CAPABILITIES.map((entry) => entry.name)),
  );
  assert.equal(new Set(PEARL_ACTIONS.map((entry) => entry.id)).size, PEARL_ACTIONS.length);
  assert.equal(PEARL_ACTIONS.every((entry) => entry.example && entry.execution && entry.direct.length), true);
});

test("every feature contract retains a Pearl route, canonical mutation, and persistence ledger", () => {
  assert.equal(PEARL_REACHABILITY.length, FEATURE_CONTRACTS.length);
  for (const feature of FEATURE_CONTRACTS) {
    const proof = pearlReachabilityFor(feature.id);
    assert.ok(proof, `${feature.id} is absent from Pearl reachability`);
    assert.ok(proof.routes.length, `${feature.id} has no route`);
    for (const command of feature.commands) {
      assert.ok(DOMAIN_COMMANDS[command], `${feature.id} lost command ${command}`);
      assert.ok(proof.routes.some((route) => route.id === `domain:${command}`));
    }
    for (const capability of [...feature.companion, ...feature.extension]) {
      assert.ok(proof.routes.some((route) => route.id === `pearl:${capability}`), `${feature.id} strands ${capability}`);
    }
    assert.deepEqual(proof.persistence, feature.persistence);
  }
});

test("extension verbs and app director capabilities are discoverable from one action search", () => {
  const extension = searchPearlActions("", { platform: "extension" });
  const ids = new Set(extension.map((entry) => entry.capability));
  for (const name of Object.keys(EXTENSION_VERBS)) assert.ok(ids.has(name), `extension verb ${name} is unreachable`);
  for (const capability of COMPANION_CAPABILITIES.filter((entry) => entry.platform === "app")) {
    assert.ok(ids.has(capability.name), `web handoff ${capability.name} is unreachable from extension Pearl`);
  }
  assert.ok(searchPearlActions("before after", { platform: "extension" }).some((entry) => /BeforeAfter/.test(entry.capability)));
  assert.ok(searchPearlActions("candidate", { platform: "all" }).some((entry) => entry.category === "generate"));
  assert.deepEqual(PEARL_ACTION_CATEGORIES.map((entry) => entry.id), ["make", "use", "shape", "generate", "learn", "navigate", "manage", "recover"]);
});

test("web and extension render transient Pearl-emitted surfaces instead of persistent navigation chrome", () => {
  const orb = source("client/components/CompanionOrb.jsx");
  const universe = source("client/components/OrbUniverseShell.jsx");
  const panel = source("extension/src/sidepanel/main.jsx");
  const bridge = source("extension/src/content/bridge.js");
  assert.match(orb, /pearl-action-search/);
  assert.match(universe, /pearl-scene-actions/);
  assert.doesNotMatch(universe, /className="orb-stage-bar"/);
  assert.match(panel, /extension-pearl-halo/);
  assert.doesNotMatch(panel, /className="orb-view-tabs"/);
  assert.match(panel, /onDropMaterial=\{dropOnPearl\}/);
  assert.match(bridge, /Find every Pearl action/);
  assert.match(bridge, /\["move", "function", "operator"\]/);
});

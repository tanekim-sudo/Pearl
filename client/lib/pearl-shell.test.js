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
  PEARL_NOVICE_INTENT_PROBES,
  PEARL_REACHABILITY,
  pearlActionPrompt,
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
  assert.match(bridge, /What do you want\?/);
  assert.doesNotMatch(bridge, /data-view=/);
  assert.match(bridge, /\["move", "function", "operator"\]/);
});

test("novice outcome language reaches every representative capability family", () => {
  assert.ok(PEARL_NOVICE_INTENT_PROBES.length >= 16);
  for (const probe of PEARL_NOVICE_INTENT_PROBES) {
    const matches = searchPearlActions(probe.intent);
    assert.ok(
      matches.some((entry) => entry.capability === probe.capability),
      `${probe.family} novice intent did not reach ${probe.capability}`,
    );
    assert.doesNotMatch(probe.intent, /\b(?:move|function|lens|model|output spec|semantic orb|scene|plan|mode|package)\b/i);
  }
});

test("click surfaces remain single-field while keyboard search preserves exhaustive reachability", () => {
  const orb = source("client/components/CompanionOrb.jsx");
  const panel = source("extension/src/sidepanel/main.jsx");
  assert.match(orb, /powerSearch && <section/);
  assert.doesNotMatch(orb, /Pearl action categories/);
  assert.doesNotMatch(orb, />Context<\/button>|>Library<\/button>|>Actions<\/button>|>Scene<\/button>/);
  assert.match(panel, /powerSearch &&/);
  assert.doesNotMatch(panel, /Immediate Pearl views/);
  assert.equal(searchPearlActions("").length, COMPANION_CAPABILITIES.length);
});

test("Companion and Studio remain explicit without simultaneous management clutter", () => {
  const orb = source("client/components/CompanionOrb.jsx");
  const studio = source("client/components/PearlStudioView.jsx");
  const extensionStudio = source("extension/src/result/main.js");
  assert.match(orb, /click to ask · hold to speak · Shift\+Enter for Studio/);
  assert.match(orb, /triple-click or press Shift\+Enter for Studio/);
  assert.match(orb, />Open Studio<\/button>/);
  assert.match(orb, /!powerSearch && !approval && !nextAction/);
  assert.match(studio, /useState\(false\)/);
  assert.match(studio, />Inspect structure<\/button>/);
  assert.match(studio, /structureOpen && <>/);
  assert.match(studio, /CognitiveLayerStudio/);
  assert.match(extensionStudio, /studio-inspect/);
  assert.match(extensionStudio, /setStructureOpen\(false\)/);
  assert.match(extensionStudio, /CognitiveLayerStudio/);
});

test("every capability family remains reachable by intent and relevant Studio commands", () => {
  for (const feature of FEATURE_CONTRACTS) {
    for (const capability of [...feature.companion, ...feature.extension]) {
      assert.ok(
        searchPearlActions("", { platform: "all" }).some((entry) => entry.capability === capability),
        `${feature.id} capability ${capability} is absent from Companion intent search`,
      );
    }
    for (const command of feature.commands) {
      const proof = pearlReachabilityFor(feature.id);
      assert.ok(
        proof.routes.some((route) => route.id === `domain:${command}`),
        `${feature.id} command ${command} is absent from Studio's canonical command path`,
      );
    }
  }
});

test("power search presents outcomes without requiring internal ontology", () => {
  for (const action of PEARL_ACTIONS) {
    assert.doesNotMatch(
      pearlActionPrompt(action),
      /\b(?:move|function|lens|model|output spec|semantic orb|scene|package|branch|plan)\b/i,
      `${action.capability} leaks internal ontology`,
    );
  }
});

test("cold first use is visible and renders only the actionable primary Pearl", () => {
  const universe = source("client/components/OrbUniverseShell.jsx");
  const styles = source("client/orb-universe.css");

  assert.match(universe, /Begin with something you noticed\./);
  assert.match(universe, /const firstUse = isRoot && scenes\.length === 0/);
  assert.match(universe, /const emptyLibrary = !isRoot && scenes\.length === 0/);
  assert.match(universe, /Click Pearl to begin/);
  assert.match(universe, /No saved work yet\./);
  assert.doesNotMatch(styles, /\.orb-home-intro,\s*\.orb-home-prompt\s*\{\s*display:\s*none/);
  assert.match(styles, /\.orb-universe:has\(\.companion-orb-shell\.expanded\) \.orb-home-prompt/);
  assert.doesNotMatch(universe, /className="orb-continuation-pearl"/);
  assert.doesNotMatch(universe, /className="orb-stage-locus"/);
});

test("ordinary-page overlay has no placeholder Pearls and cannot intercept native pages at rest", () => {
  const bridge = source("extension/src/content/bridge.js");

  assert.doesNotMatch(bridge, /\["Question assumptions","Find strongest signal","Offer contrary path"\]/);
  assert.match(bridge, /host\.style\.cssText\s*=\s*"[^"]*pointer-events:none/);
  assert.match(bridge, /\.orb\{[^}]*pointer-events:auto/);
  assert.match(bridge, /\.emission\{[^}]*pointer-events:auto/);
  assert.match(bridge, /\.phase\{[^}]*right:0[^}]*text-align:right/);
});

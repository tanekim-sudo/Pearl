import assert from "node:assert/strict";
import test from "node:test";
import {
  aestheticFromSampleColor,
  aestheticSummary,
  applyPearlAestheticPreset,
  defaultPearlAesthetic,
  listPearlAestheticPresets,
  loadCompanionAesthetic,
  normalizePearlAesthetic,
  patchPearlAesthetic,
  pearlAestheticStyle,
  saveCompanionAesthetic,
} from "./pearl-aesthetic.js";
import { executeDomainCommand } from "./domain-commands.js";
import { createPearlEntity } from "./pearl-entity.js";
import { createSemanticOrb } from "./semantic-orbs.js";

test("presets expand into full color + material layers", () => {
  const presets = listPearlAestheticPresets();
  assert.ok(presets.length >= 8);
  const rose = applyPearlAestheticPreset(null, "rose");
  assert.equal(rose.preset, "rose");
  assert.equal(rose.colors.nacre, "#d7a9a4");
  assert.ok(rose.material.gloss > 0);
  const vars = pearlAestheticStyle(rose);
  assert.equal(vars["--pearl-nacre"], "#d7a9a4");
});

test("sample color expands into a custom aesthetic", () => {
  const sampled = aestheticFromSampleColor({ r: 40, g: 120, b: 90 }, { label: "Forest" });
  assert.equal(sampled.preset, "custom");
  assert.equal(sampled.label, "Forest");
  assert.match(sampled.colors.nacre, /^#[0-9a-f]{6}$/);
});

test("patch marks custom when layers diverge from preset", () => {
  const base = defaultPearlAesthetic({ preset: "classic" });
  const next = patchPearlAesthetic(base, { colors: { nacre: "#112233" }, material: { gloss: 0.9 } });
  assert.equal(next.preset, "custom");
  assert.equal(next.colors.nacre, "#112233");
  assert.equal(next.material.gloss, 0.9);
});

test("companion aesthetic persists through storage helpers", () => {
  const memory = new Map();
  const storage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, String(value)),
  };
  const saved = saveCompanionAesthetic(applyPearlAestheticPreset(null, "ink"), storage);
  assert.equal(saved.preset, "ink");
  assert.equal(loadCompanionAesthetic(storage).preset, "ink");
});

test("setPearlAesthetic updates entity, companion, and matching semantic orb", async () => {
  const entity = createPearlEntity({ id: "pearl-a", kind: "primary", name: "Briefing" });
  const orb = createSemanticOrb({ id: "pearl-a", name: "Briefing", sceneId: "s1" });
  const executed = await executeDomainCommand("setPearlAesthetic", {
    pearlEntities: { "pearl-a": entity },
    semanticOrbs: [orb],
    activePearlId: "pearl-a",
  }, {
    pearlId: "pearl-a",
    preset: "celadon",
  }, { now: Date.now() });
  assert.equal(executed.result.object.aesthetic.preset, "celadon");
  assert.equal(executed.state.pearlEntities["pearl-a"].aesthetic.preset, "celadon");
  assert.equal(executed.state.companionAesthetic.preset, "celadon");
  assert.equal(executed.state.semanticOrbs[0].aesthetic.preset, "celadon");
});

test("aesthetic summary exposes inspectable fields", () => {
  const summary = aestheticSummary(normalizePearlAesthetic({ preset: "moonlight" }));
  assert.equal(summary.preset, "moonlight");
  assert.ok(summary.swatch);
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  buildInvestorRolePearlScaffold,
  extractInvestorFirm,
  looksLikeInvestorRolePearl,
  parseRolePearlCommand,
} from "./role-pearl-scaffold.js";
import { createPearlEntity } from "./pearl-entity.js";
import { createPearlStudioViewModel } from "./pearl-studio.js";
import { executeDomainCommand } from "./domain-commands.js";

const S32 =
  "I'm an investor at S32 and I want you to research a pearl and make me a pearl that has an investment memo function and a diligence function that understands my lens as an investor.";

test("extracts firm and matches the S32 investor utterance", () => {
  assert.equal(extractInvestorFirm(S32), "S32");
  assert.equal(looksLikeInvestorRolePearl(S32), true);
  assert.equal(looksLikeInvestorRolePearl("make a pearl about lunch"), false);
  assert.equal(looksLikeInvestorRolePearl("make a pearl about my investor notes"), false);
  assert.equal(looksLikeInvestorRolePearl("make me an investor pearl"), true);
  assert.equal(
    looksLikeInvestorRolePearl(
      "make me a pearl that reflects Warren Buffett's style and taste and lens of investing",
    ),
    false,
    "Buffett style+taste+lens create is harness seed, not investor role scaffold",
  );
});

test("deterministic scaffold materializes memo, diligence, investor lens, and moves", () => {
  const scaffold = buildInvestorRolePearlScaffold({ utterance: S32 });
  assert.equal(scaffold.mode, "deterministic-scaffold");
  assert.equal(scaffold.firm, "S32");
  assert.equal(scaffold.pearl.name, "S32 investor pearl");
  assert.equal(scaffold.organization.functions.length, 2);
  assert.deepEqual(
    scaffold.organization.functions.map((entry) => entry.name),
    ["Investment memo", "Diligence"],
  );
  assert.match(scaffold.organization.lenses[0].name, /S32 investor lens/i);
  assert.ok(scaffold.organization.moves.length >= 3);
  assert.equal(scaffold.organization.order.join("→"), "moves→weights→lenses");
  assert.ok(Array.isArray(scaffold.organization.weights));
  assert.ok(scaffold.pearl.workingSet.context.some((entry) => /S32/.test(entry.text)));
});

test("parseRolePearlCommand returns createRolePearl with wear + studio", () => {
  const parsed = parseRolePearlCommand(S32);
  assert.equal(parsed.verb, "createRolePearl");
  assert.equal(parsed.args.firm, "S32");
  assert.equal(parsed.args.openStudio, true);
  assert.equal(parsed.args.wear, true);
  assert.equal(parsed.args.materializeLibrary, true);
});

test("Studio view model exposes Moves → Weights → Lenses for the scaffolded pearl", () => {
  const scaffold = buildInvestorRolePearlScaffold({ utterance: S32, now: 1 });
  const entity = createPearlEntity({
    id: "pearl-s32",
    kind: "semantic",
    ...scaffold.pearl,
    weights: scaffold.organization.weights,
  });
  const view = createPearlStudioViewModel(entity);
  const movesSection = view.sections.find((section) => section.id === "moves");
  assert.ok(movesSection);
  assert.ok(
    (movesSection.value.items?.length || 0) >= 3
    || (movesSection.value.orderedGroups?.length || 0) === 2,
  );
  assert.ok(view.sections.some((section) => section.id === "weights"));
  assert.ok(view.sections.some((section) => section.id === "lenses" && section.value.items.length === 1));
});

test("createRolePearl domain command persists organized pearl structure", async () => {
  let nextId = 0;
  const created = await executeDomainCommand(
    "createRolePearl",
    { semanticOrbs: [], activeSemanticOrbId: null },
    {
      sceneId: "scene-1",
      utterance: S32,
      firm: "S32",
      activate: true,
      wear: false,
      openStudio: false,
    },
    { idFactory: () => `role-${++nextId}`, now: 100 },
  );
  const orb = created.state.semanticOrbs[0];
  assert.equal(created.result.type, "role-pearl");
  assert.equal(orb.name, "S32 investor pearl");
  assert.equal(orb.functions.length, 2);
  assert.equal(orb.lenses[0].name.includes("S32"), true);
  assert.equal(orb.moves.length >= 3, true);
  assert.equal(created.state.activeSemanticOrbId, orb.id);
});

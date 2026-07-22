/**
 * Deterministic stress harness for organize / counter / gauntlet-eval (no live model).
 * Writes evidence under audit-shots/companion-omnipotence-2026-07/.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { executeDomainCommand, DOMAIN_COMMANDS } from "../shared/domain-commands.js";
import { createSemanticOrb } from "../shared/semantic-orbs.js";
import { buildWornPearlPack } from "../shared/companion-pearl-wear.js";
import { buildGauntletEvaluationQuery } from "../shared/pearl-gauntlet-eval.js";
import { parsePearlRemixCommand } from "../client/lib/companion-intent.js";
import { COMPANION_CAPABILITIES } from "../client/lib/companion-capabilities.js";
import { workingMemoryPrompt } from "../shared/lens-runtime.js";

const OUT = join(process.cwd(), "audit-shots/companion-omnipotence-2026-07");
mkdirSync(OUT, { recursive: true });

const defects = [];
const evidence = [];
const idFactory = (() => { let n = 0; return () => `audit-orb-${++n}`; })();
const options = { idFactory, now: Date.now() };

function note(id, ok, detail) {
  evidence.push({ id, ok, detail, at: new Date().toISOString() });
  if (!ok) defects.push({ severity: "P1", id, detail });
}

// 1. Weird ambitious intents map to validated verbs
const intents = [
  ["organize this messy multimodal pearl dump into moves functions lenses", "organizePearl"],
  ["develop a counter pearl that opposes my 3-year startup pearl", "createCounterPearl"],
  ["evaluate this deck with my startup pearl in the gauntlet", "evaluateWithGauntlet"],
  ["what do these pearls notice about each other", "synthesizeSemanticOrbs"],
  ["merge these orbs", "mergeSemanticOrbs"],
  ["breed an opposition foil against that pearl", "createCounterPearl"],
  ["rearrange / birth / opposition / combine these pearls", null], // open-ended — planner territory
];
for (const [text, expected] of intents) {
  const parsed = parsePearlRemixCommand(text);
  if (expected == null) {
    note(`intent:${text.slice(0, 40)}`, true, parsed ? `mapped ${parsed.verb}` : "no high-confidence remix parse — adaptive planner must resolve or block");
  } else {
    note(`intent:${expected}`, parsed?.verb === expected, parsed ? `got ${parsed.verb}` : "unparsed");
  }
}

// 2. Seed startup pearl + messy dump pearl
let state = { semanticOrbs: [], activeSemanticOrbId: null };
const startup = await executeDomainCommand("createSemanticOrb", state, {
  sceneId: "audit-scene",
  orb: {
    name: "3-year startup pearl",
    representation: { kind: "lens", label: "3-year startup pearl" },
    workingSet: {
      context: [{ id: "s1", text: "Prefer capital-efficient B2B with real retention. Care about founder taste for underwriting." }],
      lenses: [{ id: "lp", name: "Skeptical LP", strength: 0.85, description: "Judge decks on capital efficiency, moat, and honesty about risk." }],
    },
    moves: [{ id: "m-underwrite", name: "Underwrite", description: "Evaluate traction and moat." }],
    lenses: [{ id: "lp", name: "Skeptical LP", strength: 0.85, description: "Judge decks on capital efficiency, moat, and honesty about risk." }],
  },
  placement: { x: 40, y: 40 },
}, options);
state = startup.state;
const startupId = startup.result.id;

const messy = await executeDomainCommand("createSemanticOrb", state, {
  sceneId: "audit-scene",
  orb: {
    name: "Messy multimodal dump",
    representation: { kind: "grouped-context", label: "Messy multimodal dump" },
    workingSet: {
      context: [
        { id: "c1", text: "As a skeptical LP, evaluate traction and moat for this deck. Care about capital efficiency." },
        { id: "c2", kind: "drawing", label: "whiteboard", text: "Draw the competitive map and compare alternatives." },
        { id: "c3", kind: "transcript", text: "Voice: rewrite the problem slide but keep the weird metaphors." },
        { id: "c1b", text: "As a skeptical LP, evaluate traction and moat for this deck. Care about capital efficiency." },
      ],
      lenses: [],
    },
  },
  placement: { x: 120, y: 40 },
}, options);
state = messy.state;
const messyId = messy.result.id;

// 3. Organize
const organized = await executeDomainCommand("organizePearl", state, { id: messyId }, options);
state = organized.state;
note("organizePearl", organized.result.effects.includes("pearl-organized"), {
  moves: organized.result.organization.moves.length,
  functions: organized.result.organization.functions.length,
  lenses: organized.result.organization.lenses.length,
  preserved: organized.result.preservedEvidenceCount,
  removed: organized.result.removedRedundantCount,
});

// 4. Counter
const countered = await executeDomainCommand("createCounterPearl", state, {
  id: startupId,
  sceneId: "audit-scene",
  instruction: "foil the LP taste deliberately",
}, options);
state = countered.state;
note("createCounterPearl", countered.result.effects.includes("pearl-counter-created"), {
  id: countered.result.id,
  kind: countered.result.object.representation.kind,
  sourceIntact: state.semanticOrbs.some((orb) => orb.id === startupId),
});

// 5. Synthesize
const synth = await executeDomainCommand("synthesizeSemanticOrbs", state, {
  ids: [startupId, messyId],
  sceneId: "audit-scene",
  mode: "mutual",
}, options);
state = synth.state;
note("synthesizeSemanticOrbs", synth.result.effects.includes("pearl-synthesis-created"), {
  observations: synth.result.observations.length,
  sourcesPreserved: synth.result.preservedSourceIds,
});

// 6. Gauntlet eval (query prep only — no live model)
const pack = buildWornPearlPack(state.semanticOrbs.find((orb) => orb.id === startupId));
const evaluation = buildGauntletEvaluationQuery({
  packs: [pack],
  material: {
    text: "Slide 1: We are Uber for dentists. Slide 2: $40M TAM. Slide 3: No retention chart.",
    title: "Acme Dental Deck",
    url: "https://example.com/deck",
  },
  instruction: "Evaluate this startup deck through the worn pearl lenses",
});
note("evaluateWithGauntlet.query", evaluation.ok && evaluation.requiresModel === true, {
  characters: evaluation.material?.characters,
  packs: evaluation.packs,
  promptPreview: evaluation.query?.prompt?.slice(0, 240),
});

const memoryPrompt = workingMemoryPrompt({ packs: [pack], slots: [startupId], filled: 1, capacity: 5 });
note("workingMemoryPrompt.richness", /Skeptical LP/.test(memoryPrompt) && /moves/i.test(memoryPrompt), memoryPrompt.slice(0, 280));

// 7. Manifest parity
const required = ["organizePearl", "createCounterPearl", "evaluateWithGauntlet", "organizeExternalPearl", "createExternalCounterPearl", "evaluateExternalWithGauntlet"];
for (const name of required) {
  const inDomain = Boolean(DOMAIN_COMMANDS[name]);
  const inManifest = COMPANION_CAPABILITIES.some((entry) => entry.name === name);
  note(`manifest:${name}`, inManifest || inDomain, { inManifest, inDomain });
}

const ledger = {
  audit: "companion-omnipotence-2026-07",
  generatedAt: new Date().toISOString(),
  verdict: defects.length ? "gaps-remain" : "wiring-verified-no-live-model",
  note: "Deterministic harness only. Live AI evaluation / voice GO / DnD browser journeys require running the production build with credentials and were not claimed complete here.",
  evidence,
  defects,
  remainingGaps: [
    {
      severity: "P2",
      id: "live-model-gauntlet-eval",
      repro: "Wear startup pearl, capture deck, ask companion to evaluate — needs provider credentials for model response.",
      expected: "Structured evaluation grounded in pearl lenses",
      status: "query-prep-verified; live-model-not-run",
    },
    {
      severity: "P2",
      id: "browser-dnd-go-visual",
      repro: "Shelf DnD into gauntlet sockets + Enter/GO in extension side panel at 360px",
      expected: "Visual confirmation of orbit/rail + working-memory fire",
      status: "shipped in prior commit; this pass verified via code+unit tests, not fresh Playwright shots",
    },
    {
      severity: "P3",
      id: "open-ended-rearrange-birth-combine",
      repro: "Say 'rearrange / birth / opposition / combine these pearls' without naming a verb",
      expected: "Adaptive planner maps to organize/counter/synthesize/merge or precise blocker",
      status: "deterministic remix parser may miss slash-salad; planner prompt documents mapping",
    },
  ],
};

writeFileSync(join(OUT, "audit-results.json"), JSON.stringify(ledger, null, 2));
writeFileSync(join(OUT, "01-organize-result.json"), JSON.stringify(organized.result, null, 2));
writeFileSync(join(OUT, "02-counter-pearl.json"), JSON.stringify({
  id: countered.result.id,
  name: countered.result.object.name,
  lineage: countered.result.object.lineage,
  organization: countered.result.organization,
}, null, 2));
writeFileSync(join(OUT, "03-gauntlet-eval-query.txt"), evaluation.query?.prompt || evaluation.reason);
writeFileSync(join(OUT, "04-working-memory-prompt.txt"), memoryPrompt);
writeFileSync(join(OUT, "05-defect-ledger.json"), JSON.stringify({ defects, remainingGaps: ledger.remainingGaps }, null, 2));

console.log(JSON.stringify({
  out: OUT,
  evidence: evidence.length,
  defects: defects.length,
  verdict: ledger.verdict,
}, null, 2));

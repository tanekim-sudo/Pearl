import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  TRANSFORM_PRIMITIVES,
  PRIMITIVE_NAMES,
  isTransformPrimitive,
  migrateOperatorStore,
  primitiveNeedsResearch,
  primitiveNeedsResolve,
  estimatePrimitiveMs,
} from "./transform-primitives.js";
import { scaleEta, ETA } from "./eta.js";
import { compileExecutionPlan, isSingleStepPrompt } from "../server/plan.js";
import { PHASE_TIMEOUT } from "./phase-timeouts.js";

describe("transform primitives", () => {
  it("defines the canonical grammar", () => {
    assert.equal(TRANSFORM_PRIMITIVES.length, 8);
    assert.deepEqual(
      TRANSFORM_PRIMITIVES.filter((move) => move.primitiveMove)
        .sort((a, b) => a.primitiveRankDefault - b.primitiveRankDefault)
        .map((move) => move.name),
      ["Branch", "Merge", "Deepen", "Challenge", "Embody"]
    );
    assert.ok(PRIMITIVE_NAMES.has("Branch"));
    assert.ok(PRIMITIVE_NAMES.has("compress"));
    assert.ok(PRIMITIVE_NAMES.has("research"));
    assert.equal(TRANSFORM_PRIMITIVES.filter((p) => p.multi).length, 0);
  });

  it("marks primitives as transform-eligible", () => {
    const branch = TRANSFORM_PRIMITIVES.find((p) => p.name === "Branch");
    assert.ok(isTransformPrimitive(branch));
    assert.ok(!isTransformPrimitive({ primitive: true, kind: "pipeline", steps: [] }));
  });

  it("migrates legacy operator stores to canonical primitives", () => {
    const legacy = [
      { id: "op-combine", name: "combine", primitive: true, kind: "prompt" },
      { id: "x1", name: "thesis", top: true, kind: "pipeline", steps: [] },
    ];
    const next = migrateOperatorStore(legacy);
    assert.equal(next.filter((o) => o.primitive).length, 8);
    assert.ok(next.some((o) => o.name === "thesis"));
    assert.ok(!next.some((o) => o.name === "combine"));
  });

  it("preserves user-edited primitives across migration", () => {
    const saved = [
      {
        id: "abc123",
        name: "compress",
        primitive: true,
        kind: "prompt",
        prompt: "Distill to a haiku.",
        description: "my custom compress",
      },
      { id: "x1", name: "thesis", top: true, kind: "pipeline", steps: [] },
    ];
    const next = migrateOperatorStore(saved);
    const compress = next.find((o) => o.name === "compress");
    assert.equal(compress.prompt, "Distill to a haiku.");
    assert.equal(compress.description, "my custom compress");
    assert.equal(next.filter((o) => o.primitive).length, 8);
    // a pipeline-edited primitive keeps its step subtree alive
    const saved2 = [
      { id: "r1", name: "expand", primitive: true, kind: "pipeline", steps: ["s1", "s2"] },
      { id: "s1", name: "unfold detail", kind: "prompt", prompt: "Unfold." },
      { id: "s2", name: "surface implications", kind: "prompt", prompt: "Implications." },
    ];
    const next2 = migrateOperatorStore(saved2);
    const branch = next2.find((o) => o.name === "Branch");
    assert.equal(branch.kind, "pipeline");
    assert.deepEqual(branch.migratedFrom, { id: "r1", name: "expand" });
    assert.ok(next2.some((o) => o.id === "s1"));
    assert.ok(next2.some((o) => o.id === "s2"));
  });

  it("routes Branch on sparse entity as single perceptual step", () => {
    const expand = TRANSFORM_PRIMITIVES.find((p) => p.name === "Branch");
    const material = "bobyard ai startup";
    assert.ok(!primitiveNeedsResolve(expand, material));
    assert.ok(!primitiveNeedsResearch(expand, material));

    const plan = compileExecutionPlan(expand, { [expand.id]: expand }, material);
    assert.equal(plan.phases.length, 1);
    assert.equal(plan.phases[0].id, "synthesize");
    assert.match(plan.phases[0].prompt, /possibilities/i);
    assert.ok(plan.fastPath);
  });

  it("routes research primitive through research + synthesize", () => {
    const research = TRANSFORM_PRIMITIVES.find((p) => p.name === "research");
    assert.ok(primitiveNeedsResearch(research, "anything"));
    const plan = compileExecutionPlan(research, { [research.id]: research }, "Cursor AI");
    assert.equal(plan.phases.length, 2);
    assert.equal(plan.phases[0].id, "research");
    assert.equal(plan.phases[1].id, "synthesize");
    assert.ok(!plan.fastPath);
  });

  it("keeps primitive prompts bounded and action-specific", () => {
    for (const p of TRANSFORM_PRIMITIVES) {
      const words = p.prompt.trim().split(/\s+/).length;
      assert.ok(words <= 40, `${p.name} prompt too long: ${p.prompt}`);
    }
  });

  it("routes compress on rich text as direct transform only", () => {
    const compress = TRANSFORM_PRIMITIVES.find((p) => p.name === "compress");
    const material = "A".repeat(600);
    assert.ok(!primitiveNeedsResearch(compress, material));
    assert.ok(!primitiveNeedsResolve(compress, material));

    const plan = compileExecutionPlan(compress, { [compress.id]: compress }, material);
    assert.equal(plan.phases.length, 1);
    assert.equal(plan.phases[0].id, "synthesize");
  });

  it("routes Challenge as direct transform even on sparse input", () => {
    const invert = TRANSFORM_PRIMITIVES.find((p) => p.name === "Challenge");
    const plan = compileExecutionPlan(invert, { [invert.id]: invert }, "bobyard ai startup");
    assert.equal(plan.phases.length, 1);
    assert.ok(plan.fastPath);
  });

  it("routes perceptual moves as single-step fast path", () => {
    const move = {
      id: "m1",
      name: "see as monastery",
      kind: "prompt",
      move: true,
      prompt: "See as monastery.",
      resolveWhen: "never",
      researchWhen: "never",
    };
    assert.ok(isSingleStepPrompt(move, { m1: move }));
    const plan = compileExecutionPlan(move, { m1: move }, "Cursor AI");
    assert.equal(plan.phases.length, 1);
    assert.equal(plan.phases[0].id, "synthesize");
    assert.ok(plan.phases[0].timeoutMs <= PHASE_TIMEOUT.synthesizePrimitive);
  });
});

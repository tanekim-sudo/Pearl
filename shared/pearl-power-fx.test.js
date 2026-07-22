import assert from "node:assert/strict";
import test from "node:test";
import { pearlAnimationForCommand, PEARL_ANIMATION_VOCABULARY, validatePearlAnimation } from "./pearl-animation.js";
import {
  MAX_FISSION_COUNT,
  PEARL_POWER_PRIMITIVES,
  filamentPath,
  normalizePowerFx,
  powerFxForAnimation,
  powerFxForCommand,
  radialFissionPoints,
} from "./pearl-power-fx.js";
import { PHYSICAL_PEARL_ANIMATIONS } from "./physical-pearl.js";
import { inspectPearlVisualContract } from "./pearl-visual-contract.js";

test("power primitives cover charge echo fission fuse filament seek mark burst", () => {
  for (const kind of ["charge", "burst", "echo", "fission", "fuse", "filament", "seek", "mark"]) {
    assert.ok(PEARL_POWER_PRIMITIVES.includes(kind), kind);
    assert.ok(PEARL_ANIMATION_VOCABULARY[kind], kind);
    assert.ok(PHYSICAL_PEARL_ANIMATIONS.includes(kind), kind);
  }
});

test("command mapping attaches fission/echo/fuse/filament power kinds", () => {
  assert.equal(powerFxForCommand("createWorker", { specs: [{ role: "a" }, { role: "b" }] }).kind, "fission");
  assert.equal(powerFxForCommand("createWorker", { specs: [{ role: "a" }, { role: "b" }] }).count, 2);
  assert.equal(powerFxForCommand("duplicateSemanticOrb").kind, "echo");
  assert.equal(powerFxForCommand("mergeWorkers").kind, "fuse");
  assert.equal(powerFxForCommand("findOnScreenMatching").kind, "filament");
  assert.equal(powerFxForCommand("seekPearlToTarget").kind, "seek");
  assert.equal(pearlAnimationForCommand("createWorker").semantic, "fission");
  assert.equal(pearlAnimationForCommand("spawnSubAgentPearls").semantic, "fission");
  assert.equal(pearlAnimationForCommand("splitSemanticOrb").power, "fission");
});

test("radial fission respects hard worker cap", () => {
  const points = radialFissionPoints({ x: 100, y: 100 }, 99);
  assert.equal(points.length, MAX_FISSION_COUNT);
  assert.ok(points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)));
});

test("filament path and normalizePowerFx are deterministic enough for overlays", () => {
  const path = filamentPath({ x: 10, y: 10 }, { x: 110, y: 40 });
  assert.match(path, /^M /);
  const fx = normalizePowerFx({
    kind: "filament",
    from: { x: 10, y: 10 },
    toRects: [{ x: 100, y: 20, width: 40, height: 12 }],
  });
  assert.equal(fx.kind, "filament");
  assert.equal(fx.toRects.length, 1);
  assert.equal(fx.toRects[0].cx, 120);
  const animation = pearlAnimationForCommand("duplicateSemanticOrb", { effectReceiptId: "e1" });
  assert.equal(validatePearlAnimation(animation, { id: "e1" }), true);
  assert.equal(powerFxForAnimation(animation, { pearlId: "p1" }).kind, "echo");
});

test("visual contract still passes after power keyframes (no permanent neon glow)", () => {
  const report = inspectPearlVisualContract();
  assert.equal(report.valid, true, JSON.stringify(report));
});

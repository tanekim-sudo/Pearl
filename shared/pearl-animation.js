export const PEARL_ANIMATION_VERSION = 2;
export const PEARL_ANIMATION_VOCABULARY = Object.freeze({
  absorb: { durationMs: 420, motion: "surface-tension-inward", layers: ["nucleus", "nacre"], cancellable: true, power: "burst" },
  refract: { durationMs: 360, motion: "thin-film-refract", layers: ["nacre", "reflection"], cancellable: true, power: "charge" },
  emerge: { durationMs: 520, motion: "mass-emerge-settle", layers: ["body", "nucleus", "contact"], cancellable: true, power: "burst" },
  stream: { durationMs: 680, motion: "internal-warmth-flow", layers: ["nucleus", "nacre"], cancellable: true, repeatWhileEffect: true, power: "charge" },
  unfold: { durationMs: 420, motion: "thin-membrane-unfold", layers: ["nacre", "surface"], cancellable: true, power: "burst" },
  settle: { durationMs: 360, motion: "soft-overshoot-settle", layers: ["body", "contact"], cancellable: true, power: "burst" },
  split: { durationMs: 720, motion: "mass-fission-burst", layers: ["body", "nucleus", "satellites"], cancellable: true, power: "fission" },
  merge: { durationMs: 560, motion: "surface-tension-fuse", layers: ["body", "nucleus"], cancellable: true, power: "fuse" },
  nest: { durationMs: 440, motion: "child-orbit-settle", layers: ["body", "satellites", "nacre"], cancellable: true, power: "fuse" },
  compose: { durationMs: 520, motion: "ordered-surface-braid", layers: ["body", "nucleus", "nacre"], cancellable: true, power: "fuse" },
  duplicate: { durationMs: 640, motion: "mass-echo-peel", layers: ["body", "nucleus", "contact"], cancellable: true, power: "echo" },
  remix: { durationMs: 560, motion: "interior-recombine", layers: ["nucleus", "nacre", "reflection"], cancellable: true, power: "charge" },
  arrive: { durationMs: 420, motion: "sparse-source-arrival", layers: ["satellites", "nacre"], cancellable: true, power: "seek" },
  crossfade: { durationMs: 650, motion: "interior-crossfade", layers: ["nucleus"], cancellable: true, power: "charge" },
  transfer: { durationMs: 760, motion: "mass-transfer-settle", layers: ["body", "contact", "nacre"], cancellable: true, power: "filament" },
  lock: { durationMs: 300, motion: "interior-cool-occlude", layers: ["nucleus", "body"], cancellable: false, power: "burst" },
  unlock: { durationMs: 360, motion: "interior-warm-reveal", layers: ["nucleus", "nacre"], cancellable: true, power: "burst" },
  recover: { durationMs: 420, motion: "checkpoint-return-settle", layers: ["reflection", "body"], cancellable: true, power: "burst" },
  fail: { durationMs: 260, motion: "cool-opacity-settle", layers: ["nucleus", "body"], cancellable: false, power: "burst" },
  charge: { durationMs: 900, motion: "nucleus-charge-windup", layers: ["nucleus", "caustic", "nacre"], cancellable: true, repeatWhileEffect: true, power: "charge" },
  burst: { durationMs: 420, motion: "refractive-commit-flash", layers: ["nacre", "specular"], cancellable: true, power: "burst" },
  echo: { durationMs: 640, motion: "afterimage-echo-peel", layers: ["body", "nucleus", "contact"], cancellable: true, power: "echo" },
  fission: { durationMs: 720, motion: "mass-fission-burst", layers: ["body", "nucleus", "satellites"], cancellable: true, power: "fission" },
  fuse: { durationMs: 560, motion: "satellite-fuse-inward", layers: ["body", "nucleus"], cancellable: true, power: "fuse" },
  filament: { durationMs: 900, motion: "caustic-filament-out", layers: ["nacre", "caustic"], cancellable: true, power: "filament" },
  seek: { durationMs: 700, motion: "autonomous-seek-settle", layers: ["body", "contact"], cancellable: true, power: "seek" },
  mark: { durationMs: 550, motion: "target-mark-hit", layers: ["nacre", "pinlight"], cancellable: true, power: "mark" },
});

const COMMAND_ANIMATION = Object.freeze({
  addOrbContext: "absorb",
  addSemanticOrbContext: "absorb",
  collectLensMaterial: "absorb",
  applyOrbLens: "refract",
  applySemanticOrbLens: "refract",
  applyLensInference: "refract",
  removeOrbLens: "settle",
  removeSemanticOrbLens: "settle",
  createSemanticOrb: "emerge",
  createRolePearl: "emerge",
  openOrbCreationPreview: "unfold",
  duplicateSemanticOrb: "duplicate",
  nestSemanticOrb: "nest",
  unnestSemanticOrb: "emerge",
  mergeSemanticOrbs: "merge",
  composeSemanticOrbs: "compose",
  synthesizeSemanticOrbs: "remix",
  organizePearl: "compose",
  createCounterPearl: "echo",
  evaluateWithGauntlet: "refract",
  discoverFormingPearls: "emerge",
  inspectPearlMetadata: "unfold",
  rearrangeGauntlet: "settle",
  splitSemanticOrb: "split",
  bindSemanticOrb: "absorb",
  renameSemanticOrb: "settle",
  getPearlSystemPrompt: "settle",
  setPearlSystemPrompt: "charge",
  editPearlSystemPrompt: "charge",
  interpretPearlPrompt: "charge",
  comparePearls: "refract",
  operatePearl: "unfold",
  moveSemanticOrb: "settle",
  archiveSemanticOrb: "settle",
  deleteSemanticOrb: "settle",
  spawnResultPearl: "emerge",
  setResultPearlStatus: "stream",
  requestOutputPlacement: "unfold",
  interpretOutputPlacement: "refract",
  confirmOutputPlacement: "settle",
  completeOutputPlacement: "settle",
  activateSemanticOrb: "settle",
  activatePearlPageCanvas: "unfold",
  setPearlCanvasInputMode: "refract",
  openPearlStudio: "unfold",
  reorderPearlFunctionMoves: "settle",
  decomposePearlFunctionMove: "split",
  editPearlEntity: "stream",
  browsePearlHistory: "unfold",
  snapshotPearlVersion: "settle",
  labelPearlVersion: "settle",
  restorePearlVersion: "recover",
  undoPearlEntityEdit: "recover",
  redoPearlEntityEdit: "recover",
  createWorker: "fission",
  spawnSubAgentPearls: "fission",
  mergeWorkers: "fuse",
  fuseSubAgentPearls: "fuse",
  findOnScreenMatching: "filament",
  beamPearlToTargets: "filament",
  seekPearlToTarget: "seek",
  proposeAutomationContextPatch: "arrive",
  approveAutomationContextPatch: "absorb",
  transitionPearlSoundscape: "crossfade",
  createPearlShareGrant: "transfer",
  consumePearlShareGrant: "transfer",
  installValidatedPearlPackage: "settle",
  applyPearlPrivacyPatch: "refract",
  lockPearlPrivacy: "lock",
  rotatePearlOrganizationKey: "refract",
  undoResultPearl: "recover",
  undoPearlPageCanvas: "recover",
  failOutputPlacement: "fail",
  addPearlCognitiveLayer: "emerge",
  mutatePearlCognitiveLayer: "remix",
  composePearlCognitiveLayers: "compose",
  proposePearlCognitivePatch: "refract",
  applyPearlCognitivePatch: "absorb",
  resolvePearlCognitiveUncertainty: "unlock",
  startPearlCognitivePlayback: "fission",
  advancePearlCognitivePlayback: "absorb",
  cancelPearlCognitivePlayback: "settle",
  composeObjects: "compose",
  setPearlAesthetic: "refract",
});

function inferAnimationSemantic(command) {
  if (COMMAND_ANIMATION[command]) return COMMAND_ANIMATION[command];
  if (/createWorker|spawnSubAgent|fission/i.test(command)) return "fission";
  if (/fuseSubAgent|mergeWorkers/i.test(command)) return "fuse";
  if (/findOnScreen|beamPearl|filament/i.test(command)) return "filament";
  if (/seekPearl/i.test(command)) return "seek";
  if (/createSemanticOrb|spawn|birth|duplicate/i.test(command)) return /duplicate/i.test(command) ? "duplicate" : "emerge";
  if (/compose/i.test(command)) return "compose";
  if (/merge|combine|fuse/i.test(command)) return /fuse/i.test(command) ? "fuse" : "merge";
  if (/nest/i.test(command) && !/unnest/i.test(command)) return "nest";
  if (/split|fork/i.test(command)) return "split";
  if (/remix|recombin|mutate/i.test(command)) return "remix";
  if (/delete|revoke|archive/i.test(command)) return "settle";
  if (/undo|restore|retry|recover/i.test(command)) return "recover";
  if (/lens|refract|encode/i.test(command)) return "refract";
  if (/context|absorb|bind/i.test(command)) return "absorb";
  return "refract";
}

export function pearlAnimationForCommand(command, options = {}) {
  const semantic = options.semantic || inferAnimationSemantic(command);
  const definition = PEARL_ANIMATION_VOCABULARY[semantic];
  if (!definition) throw new Error(`unknown Pearl animation semantic "${semantic}"`);
  return {
    version: PEARL_ANIMATION_VERSION,
    id: options.id || `animation:${command}:${Date.now()}`,
    command,
    semantic,
    power: definition.power || null,
    ...definition,
    reducedMotion: {
      durationMs: 0,
      staticState: options.staticState || (semantic === "fail" ? "failed" : semantic === "lock" ? "locked" : "settled"),
    },
    effectReceiptId: options.effectReceiptId || null,
    startsWithEffect: options.startsWithEffect !== false,
    finishesOnEffectReceipt: true,
    narration: false,
  };
}

export function validatePearlAnimation(animation, effectReceipt) {
  if (!animation?.finishesOnEffectReceipt || animation.narration !== false) throw new Error("Pearl animation contract is invalid");
  if (effectReceipt && animation.effectReceiptId && animation.effectReceiptId !== effectReceipt.id) throw new Error("Pearl animation effect receipt mismatch");
  // Word-bounded: avoid false positives like "array" matching "ray".
  if (/\b(?:spin|bounce|confetti|glow|neon|halo|aura|bloom)\b/i.test(JSON.stringify(animation))) {
    throw new Error("Pearl animation uses forbidden generic motion");
  }
  return true;
}

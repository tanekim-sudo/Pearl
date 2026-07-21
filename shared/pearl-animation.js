export const PEARL_ANIMATION_VERSION = 1;
export const PEARL_ANIMATION_VOCABULARY = Object.freeze({
  absorb: { durationMs: 420, motion: "surface-tension-inward", layers: ["nucleus", "nacre"], cancellable: true },
  refract: { durationMs: 360, motion: "thin-film-refract", layers: ["nacre", "reflection"], cancellable: true },
  emerge: { durationMs: 520, motion: "mass-emerge-settle", layers: ["body", "nucleus", "contact"], cancellable: true },
  stream: { durationMs: 680, motion: "internal-warmth-flow", layers: ["nucleus", "nacre"], cancellable: true, repeatWhileEffect: true },
  unfold: { durationMs: 420, motion: "thin-membrane-unfold", layers: ["nacre", "surface"], cancellable: true },
  settle: { durationMs: 360, motion: "soft-overshoot-settle", layers: ["body", "contact"], cancellable: true },
  split: { durationMs: 480, motion: "mass-separate", layers: ["body", "satellites"], cancellable: true },
  merge: { durationMs: 480, motion: "surface-tension-merge", layers: ["body", "nucleus"], cancellable: true },
  arrive: { durationMs: 420, motion: "sparse-source-arrival", layers: ["satellites", "nacre"], cancellable: true },
  crossfade: { durationMs: 650, motion: "interior-crossfade", layers: ["nucleus"], cancellable: true },
  transfer: { durationMs: 760, motion: "mass-transfer-settle", layers: ["body", "contact", "nacre"], cancellable: true },
  lock: { durationMs: 300, motion: "interior-cool-occlude", layers: ["nucleus", "body"], cancellable: false },
  unlock: { durationMs: 360, motion: "interior-warm-reveal", layers: ["nucleus", "nacre"], cancellable: true },
  recover: { durationMs: 420, motion: "checkpoint-return-settle", layers: ["reflection", "body"], cancellable: true },
  fail: { durationMs: 260, motion: "cool-opacity-settle", layers: ["nucleus", "body"], cancellable: false },
});

const COMMAND_ANIMATION = Object.freeze({
  addOrbContext: "absorb",
  collectLensMaterial: "absorb",
  applyOrbLens: "refract",
  applyLensInference: "refract",
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
  createWorker: "split",
  mergeWorkers: "merge",
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
  mutatePearlCognitiveLayer: "settle",
  composePearlCognitiveLayers: "merge",
  proposePearlCognitivePatch: "refract",
  applyPearlCognitivePatch: "absorb",
  resolvePearlCognitiveUncertainty: "unlock",
  startPearlCognitivePlayback: "split",
  advancePearlCognitivePlayback: "absorb",
  cancelPearlCognitivePlayback: "settle",
});

export function pearlAnimationForCommand(command, options = {}) {
  const semantic = options.semantic || COMMAND_ANIMATION[command] || (/delete|revoke|archive/i.test(command) ? "settle" : /undo|restore|retry/i.test(command) ? "recover" : "refract");
  const definition = PEARL_ANIMATION_VOCABULARY[semantic];
  if (!definition) throw new Error(`unknown Pearl animation semantic "${semantic}"`);
  return {
    version: PEARL_ANIMATION_VERSION,
    id: options.id || `animation:${command}:${Date.now()}`,
    command,
    semantic,
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
  if (/spin|bounce|confetti|glow|ray/i.test(JSON.stringify(animation))) throw new Error("Pearl animation uses forbidden generic motion");
  return true;
}

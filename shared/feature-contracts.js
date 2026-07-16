export const FEATURE_CONTRACT_VERSION = 1;

const feature = (id, value) => Object.freeze({ id, status: "active", migrationVersion: 2, ...value });

export const FEATURE_CONTRACTS = Object.freeze([
  feature("observation.workspace", {
    domains: ["paper", "ai", "lens", "extension"],
    commands: ["observeWorkspace", "interpretObservationThroughLens"],
    ui: ["client/lib/companion-observation.js"], companion: ["transformMaterial", "selectItems", "zoomToItem"],
    extension: ["capturePageSelection", "openExternalArtifact"], persistence: [],
    tests: ["shared/workspace-observation.test.js", "client/lib/companion-observation.test.js"], owner: "shared/workspace-observation.js",
  }),
  feature("generation.taste-branching", {
    domains: ["move", "function", "ai", "extension"],
    commands: ["setGenerationPlan", "startGenerationBatch", "updateGenerationCandidate", "recordTasteFeedback", "prepareMoreLikeThis"],
    ui: ["client/components/LensTreeEditor.jsx", "extension/src/sidepanel/main.jsx"], companion: [],
    extension: ["pressExternalGo"], persistence: ["lens.unified-workspace.v2"],
    tests: ["shared/generation-plan.test.js"], owner: "shared/generation-plan.js",
  }),
  feature("lens.perceptual-encoding", {
    domains: ["lens", "paper", "ai", "extension"],
    commands: ["encodeMaterialAsLens", "updateLensPerceptualModel", "applyLensInference"],
    ui: ["client/components/LensSettingsDialog.jsx"], companion: ["createLens", "addLensMaterial", "inferFunctionFromLens"],
    extension: ["saveExternalCaptureAsLens", "setExternalLensContext"], persistence: ["lens.lenses.v2"],
    tests: ["shared/lens-perceptual-model.test.js"], owner: "shared/lens-perceptual-model.js",
  }),
  feature("composition.universal", {
    domains: ["move", "function", "lens"],
    commands: ["composeCanonicalObjects"],
    ui: ["client/components/LensGrammarPanels.jsx"], companion: ["stackFunctions", "saveCompoundFunction"],
    extension: ["queueExternalAction"], persistence: ["lens.board.operators.v2", "lens.lenses.v2"],
    tests: ["shared/composition-algebra.test.js", "shared/material.test.js"], owner: "shared/composition-algebra.js",
  }),
  feature("library.move", {
    domains: ["move"], commands: ["createMoveFromContent", "upsertCanonicalObject"],
    ui: ["client/App.jsx:↦ Moves"], companion: ["createMove", "editMove", "applyMove", "saveCurrentAsMove"],
    extension: ["saveExternalCaptureAsMove", "queueExternalAction"], persistence: ["lens.board.operators.v2"],
    tests: ["shared/library-objects.test.js", "client/lib/companion-verb-coverage.test.js"], owner: "shared/library-objects.js",
  }),
  feature("library.function", {
    domains: ["function"], commands: ["captureFunctionFromLineage", "upsertCanonicalObject"],
    ui: ["client/components/LensTreeEditor.jsx"], companion: ["createFunction", "captureLineageAsFunction", "applyFunction", "forkFunction", "mergeFunctions"],
    extension: ["queueExternalAction"], persistence: ["lens.board.operators.v2"],
    tests: ["shared/library-objects.test.js", "client/lib/function-tree-editor.test.js"], owner: "shared/library-objects.js",
  }),
  feature("library.lens", {
    domains: ["lens"], commands: ["collectLensMaterial", "upsertCanonicalObject"],
    ui: ["client/components/LensSettingsDialog.jsx"], companion: ["createLens", "addLensMaterial", "armLensContext"],
    extension: ["saveExternalCaptureAsLens", "setExternalLensContext"], persistence: ["lens.lenses.v2"],
    tests: ["shared/library-objects.test.js", "shared/lens-context.test.js"], owner: "shared/lens-context.js",
  }),
  feature("library.save-as", {
    domains: ["move", "function", "lens"], commands: ["createMoveFromContent", "captureFunctionFromLineage", "collectLensMaterial"],
    ui: ["client/App.jsx:library-save-as-drop"], companion: ["openSaveAsChooser", "chooseSaveAsKind"],
    extension: ["openExternalSaveAs"], persistence: ["lens.board.operators.v2", "lens.lenses.v2"],
    tests: ["shared/domain-commands.test.js"], owner: "shared/domain-commands.js",
  }),
  feature("library.primitive-moves", {
    domains: ["move"], commands: ["setPrimitiveMove", "reorderPrimitiveMove"],
    ui: ["client/App.jsx:Primitive Moves"], companion: ["promotePrimitiveMove", "demotePrimitiveMove", "reorderPrimitiveMove"],
    extension: [], persistence: ["lens.primitive-moves.v1"], tests: ["shared/primitive-moves.test.js"], owner: "shared/primitive-moves.js",
  }),
  feature("ai.branch-chooser", {
    domains: ["move", "function", "ai"], commands: [],
    ui: ["client/components/AiNodeCanvas.jsx:ai-strand-choice-hud"], companion: ["applyFunctionToAiNode"],
    extension: [], persistence: ["lens.primitive-moves.v1"], tests: ["client/lib/ai-nodes.test.js"], owner: "client/lib/ai-nodes.js",
  }),
  feature("execution.lens-context", {
    domains: ["lens", "move", "function"], commands: [],
    ui: ["client/components/HighlightToolbar.jsx"], companion: ["armLensContext", "setBrushLensContext", "pressBrushGo"],
    extension: ["setExternalLensContext", "pressExternalGo"], persistence: ["lens.item.history.v1"],
    tests: ["shared/lens-context.test.js", "shared/library-objects.test.js"], owner: "shared/lens-context.js",
  }),
  feature("learning.before-after", {
    domains: ["move", "function"], commands: ["upsertCanonicalObject"],
    ui: ["client/components/BeforeAfterLensEditor.jsx"], companion: ["openBeforeAfterCreation", "inferBeforeAfterTransformation", "saveLearnedFunction"],
    extension: ["openExternalBeforeAfter", "inferExternalBeforeAfter"], persistence: ["lens.before-after.draft.v1"],
    tests: ["shared/before-after-examples.test.js"], owner: "shared/before-after-examples.js",
  }),
  feature("learning.transcript", {
    domains: ["move", "function", "lens"], commands: ["upsertCanonicalObject"],
    ui: ["client/components/LearnFromChat.jsx"], companion: ["openTranscriptLearning", "generateTranscriptArtifacts", "saveTranscriptArtifacts"],
    extension: [], persistence: ["lens.learn-from-chat.draft.v1"], tests: ["shared/transcript-learning.test.js"], owner: "shared/transcript-learning.js",
  }),
  feature("highlight.explicit-go", {
    domains: ["paper", "ai", "move", "function", "lens"], commands: [],
    ui: ["client/components/HighlightToolbar.jsx"], companion: ["pressBrushGo", "cancelPendingBrush"],
    extension: ["pressExternalGo"], persistence: [], tests: ["shared/lens-runtime.test.js"], owner: "shared/lens-runtime.js",
  }),
  feature("ai.node-gestures", {
    domains: ["ai"], commands: [], ui: ["client/components/AiNodeCanvas.jsx"],
    companion: ["moveAiNode"], extension: [], persistence: ["lens.ai.nodes.v1"],
    tests: ["client/lib/ai-nodes.test.js", "client/lib/ai-layout.test.js"], owner: "client/lib/ai-nodes.js",
  }),
  feature("persistence.account-adoption", {
    domains: ["move", "function", "lens", "paper", "ai"], commands: ["upsertCanonicalObject"],
    ui: ["client/components/AuthOverlay.jsx"], companion: [], extension: ["showExternalLibraryImport"],
    persistence: ["lens.board.items.v1", "lens.board.operators.v2", "lens.lenses.v2"],
    tests: ["client/lib/board-sync.test.js", "shared/lens-library.test.js"], owner: "client/lib/board-sync.js",
  }),
  feature("extension.distribution", {
    domains: ["extension"], commands: [], ui: ["client/components/ExtensionDownloadModal.jsx"],
    companion: ["openExtensionDownload"], extension: ["showExternalLibraryImport"], persistence: [],
    tests: ["extension/tests/release.test.js"], owner: "extension/scripts/package.mjs",
  }),
  feature("companion.destructive-clear", {
    domains: ["paper", "ai", "function", "lens"], commands: [], ui: ["client/components/CompanionChat.jsx"],
    companion: ["clearWorkspaceDomains", "clearFunctions", "clearLenses"], extension: [], persistence: ["lens.board.items.v1"],
    tests: ["client/lib/companion-intent.test.js", "client/lib/companion-plan.test.js"], owner: "client/lib/companion-plan.js",
  }),
]);

export const FEATURE_BASELINE = Object.freeze({
  version: FEATURE_CONTRACT_VERSION,
  features: FEATURE_CONTRACTS.length,
  minimumCompanionCapabilities: 130,
  minimumExtensionCapabilities: 15,
  requiredKinds: ["move", "function", "lens"],
  requiredExports: [
    "shared/library-objects.js:normalizeLibraryObject",
    "shared/library-objects.js:executeLibraryObject",
    "shared/domain-commands.js:executeDomainCommand",
    "shared/lens-context.js:compileLensContext",
    "shared/transcript-learning.js:parseTranscript",
    "shared/before-after-examples.js:normalizeInferenceResult",
    "client/lib/companion-capabilities.js:COMPANION_CAPABILITIES",
    "extension/src/sidepanel/companion.js:EXTENSION_VERBS",
  ],
});

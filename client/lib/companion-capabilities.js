/**
 * Canonical public surface the companion may plan against.
 * Every entry must correspond to a real director verb registered by App.
 */
const RAW_CAPABILITIES = [
  ["caption", {}, false, ["interface"], "Explain an action while it happens"],
  ["pause", { ms: "number?" }, false, ["interface"], "Pause between visible actions"],
  ["switchTool", { tool: "string" }, false, ["interface", "paper"], "Select a canvas tool"],
  ["fitPaper", {}, false, ["paper", "ai", "interface"], "Fit the paper frame in the unified workspace"],
  ["zoomPaper", { direction: "in|out|reset" }, false, ["paper", "ai", "interface"], "Zoom the unified workspace"],
  ["panPaper", { dx: "number", dy: "number" }, false, ["paper", "ai", "interface"], "Pan the unified world"],
  ["spawnText", { text: "string", saveAs: "string?", caption: "string?" }, false, ["paper"], "Create text on paper"],
  ["createFunction", { name: "string", description: "string?", steps: "array", saveAs: "string?" }, false, ["lens"], "Create a reusable transformation lens"],
  ["applyFunction", { op: "string", target: "string", wait: "boolean?" }, false, ["lens", "paper", "ai"], "Apply a lens to paper material"],
  ["dragItemToAi", { target: "string" }, false, ["paper", "ai"], "Use paper material as a node source in the unified world"],
  ["applyFunctionToAiNode", { op: "string" }, false, ["lens", "ai"], "Branch an AI node through a lens"],
  ["focusAiResult", {}, false, ["ai", "interface"], "Focus the latest AI result"],
  ["fitAiSpace", {}, false, ["ai", "interface"], "Fit the AI constellation in view"],
  ["selectAiNode", { target: "string?" }, false, ["ai"], "Select an AI node"],
  ["dragAiResultToPaper", {}, false, ["ai", "paper"], "Materialize an AI result as editable paper content"],
  ["highlight", { targets: "array" }, false, ["highlight", "paper"], "Highlight paper material"],
  ["operateHighlight", { op: "string" }, false, ["highlight", "paper", "ai", "lens", "generator"], "Queue a lens for the cross-domain highlight selection"],
  ["armLensBrush", { lens: "string" }, false, ["highlight", "lens", "interface"], "Queue a lens for a pending brush action"],
  ["armGeneratorBrush", { generator: "string" }, false, ["highlight", "generator", "interface"], "Queue a generator destination without collecting yet"],
  ["disarmBrushTarget", {}, false, ["highlight", "lens", "generator", "interface"], "Cancel the pending brush plan"],
  ["applyArmedBrush", {}, false, ["highlight", "paper", "ai", "lens", "generator"], "Press GO for the pending brush action"],
  ["queueBrushLens", { lens: "string" }, false, ["highlight", "lens"], "Queue a lens without executing it"],
  ["setBrushGeneratorDestination", { generator: "string", mode: "source?" }, false, ["highlight", "generator"], "Queue a generator destination without mutating it"],
  ["reorderBrushQueue", { from: "number", to: "number" }, false, ["highlight", "lens"], "Reorder the pending brush stack"],
  ["removeBrushQueue", { index: "number" }, false, ["highlight", "lens"], "Remove one queued brush lens"],
  ["previewBrushQueue", {}, false, ["highlight", "lens"], "Preview pending stack compatibility and outputs"],
  ["pressBrushGo", {}, false, ["highlight", "paper", "ai", "lens"], "Commit the pending brush stack exactly once"],
  ["cancelPendingBrush", {}, false, ["highlight", "lens", "generator"], "Cancel pending brush operations without clearing highlighted material"],
  ["saveBrushQueueAsLens", {}, false, ["highlight", "lens"], "Open the pending brush stack as an editable compound preview"],
  ["makeHighlightNode", {}, false, ["highlight", "paper", "ai", "lens", "generator"], "Combine the highlighted material into one provenance-preserving source node"],
  ["clearHighlight", {}, false, ["highlight", "paper", "ai", "lens", "generator"], "Clear the persistent cross-domain highlight selection"],
  ["captureThread", { target: "string?", name: "string?" }, false, ["lens", "paper", "ai"], "Save the selected node's full lineage as a lens"],
  ["showLenses", {}, false, ["generator", "interface"], "Open the generators rail"],
  ["openExtensionDownload", {}, false, ["extension", "interface"], "Open Lens Everywhere download and installation help"],
  ["openExtensionLibraryExport", {}, false, ["extension", "lens", "generator", "interface"], "Open the explicit library privacy review and export surface"],
  ["savePageAsLens", {}, false, ["generator", "paper"], "Capture the page as a generator"],
  ["waitForJobs", {}, false, ["interface"], "Wait for running transformations"],
  ["moveItem", { target: "string", to: "{x,y}?", dx: "number?", dy: "number?" }, false, ["paper"], "Move a paper object"],
  ["editItem", { target: "string", text: "string", append: "boolean?" }, false, ["paper"], "Edit a paper object"],
  ["deleteItem", { target: "string" }, true, ["paper"], "Delete one paper object"],
  ["selectItems", { targets: "array" }, false, ["paper"], "Select paper objects"],
  ["organizePage", {}, false, ["paper"], "Organize the current page"],
  ["addBlock", { type: "string", text: "string?", variant: "string?" }, false, ["paper"], "Add a paper block"],
  ["renamePage", { name: "string" }, false, ["paper", "interface"], "Rename the current page"],
  ["zoomToItem", { target: "string" }, false, ["paper", "interface"], "Zoom to a paper object"],
  ["walkItemPath", { target: "string" }, false, ["paper", "path"], "Walk the lineage that produced a paper object"],
  ["stepSharedPath", { index: "number?", delta: "number?" }, false, ["path"], "Move through an active shared path"],
  ["noteSharedPath", { text: "string" }, false, ["path"], "Attach a note to the current shared-path step"],
  ["branchSharedPath", {}, false, ["path", "ai"], "Branch from the current shared-path step"],
  ["materializeSharedPath", {}, false, ["path", "ai"], "Materialize the active shared path into AI space"],
  ["leaveSharedPath", {}, false, ["path"], "Leave the active shared-path walk"],
  ["moveAiNode", { target: "string?", dx: "number?", dy: "number?" }, false, ["ai"], "Move an AI node"],
  ["arrangeItems", { targets: "array", layout: "align|distribute|stack|grid|cluster|move-relative", options: "object?" }, false, ["paper", "ai"], "Arrange material with a geometry-aware reusable layout"],
  ["groupItems", { targets: "array", name: "string?" }, false, ["paper", "ai"], "Group selected material without flattening its contents"],
  ["linkItems", { from: "string", to: "string", label: "string?" }, false, ["paper", "ai", "path"], "Create a visible relationship between two objects"],
  ["transformMaterial", { mode: "synthesize|compare|critique|reflect|alternatives|counterexamples|revise|cluster-semantically", targets: "array", instruction: "string?", criteria: "array?", outputCount: "number?", preserveOriginal: "boolean?" }, false, ["paper", "ai", "lens", "generator"], "Run a reusable creative or evaluative operation and materialize its output"],
  ["annotateFeedback", { target: "string", text: "string", kind: "feedback|assumption|tension|evidence|research", sources: "array?" }, false, ["paper", "ai", "path"], "Place linked feedback or provenance beside its target"],
  ["openFunctionEditor", { op: "string" }, false, ["lens", "interface"], "Open a lens in the editor"],
  ["editFunction", { op: "string", name: "string?", description: "string?", prompt: "string?" }, false, ["lens"], "Edit lens metadata or prompt"],
  ["addFunctionStep", { op: "string", name: "string?", prompt: "string?", description: "string?", after: "string?", use: "string?" }, false, ["lens"], "Add a step to a lens"],
  ["addFunctionBranch", { op: "string", from: "string?", name: "string", prompt: "string?" }, false, ["lens"], "Add a branch to a lens"],
  ["setFunctionStep", { op: "string", step: "string", name: "string?", prompt: "string?", description: "string?" }, false, ["lens"], "Edit a lens step"],
  ["saveFunction", { op: "string", message: "string?" }, false, ["lens"], "Commit edits to a lens"],
  ["forkLens", { lens: "string", message: "string?" }, false, ["lens"], "Fork a lens"],
  ["mergeLenses", { a: "string", b: "string", name: "string?" }, false, ["lens"], "Merge two lenses"],
  ["previewLensComposition", { a: "string", b: "string" }, false, ["lens"], "Preview ordered lens composition"],
  ["stackLenses", { a: "string", b: "string", name: "string?", linkMode: "pinned|latest?" }, false, ["lens"], "Open an ordered compound lens preview"],
  ["saveCompoundLens", { edit: "boolean?" }, false, ["lens"], "Save the reviewed compound lens"],
  ["addGrindExample", { input: "string", output: "string", note: "string?", domain: "string?", polarity: "positive|negative?" }, false, ["lens", "paper", "ai"], "Keep an explicit transformation example"],
  ["removeGrindExample", { example: "string" }, false, ["lens"], "Remove a grinding example"],
  ["reorderGrindExample", { example: "string", to: "number" }, false, ["lens"], "Reorder grinding examples"],
  ["compileGrindDraft", {}, false, ["lens"], "Analyze examples and propose editable rules"],
  ["testGrindDraft", {}, false, ["lens"], "Test the forged proposal on a holdout"],
  ["refineGrindDraft", { instruction: "string" }, false, ["lens"], "Refine a forged proposal"],
  ["shapeForgedLens", {}, false, ["lens", "interface"], "Open the forged lens in the tree editor"],
  ["rackSearch", { query: "string" }, false, ["lens", "interface"], "Search the lens rack"],
  ["rackFilter", { type: "string", sort: "string?" }, false, ["lens", "interface"], "Filter and sort the lens rack"],
  ["pinLens", { lens: "string", pinned: "boolean?" }, false, ["lens"], "Pin or unpin a rack lens"],
  ["archiveLens", { lens: "string" }, false, ["lens"], "Archive a lens without deleting it"],
  ["restoreLens", { lens: "string" }, false, ["lens"], "Restore an archived lens"],
  ["editLensByInstruction", { op: "string", instruction: "string" }, false, ["lens"], "Rewrite a lens from an instruction"],
  ["newGenerator", { saveAs: "string?" }, false, ["generator"], "Create a generator"],
  ["attachToGenerator", { generator: "string", target: "string" }, false, ["generator", "paper"], "Attach an observation to a generator"],
  ["graduateGenerator", { generator: "string", name: "string" }, false, ["generator"], "Name a mature generator"],
  ["probeGenerator", { generator: "string", domain: "string" }, false, ["generator", "ai"], "Probe a generator in another domain"],
  ["makeLensFromGenerator", { generator: "string" }, false, ["generator", "lens"], "Craft a lens from a generator"],
  ["clearPaper", {}, true, ["paper"], "Clear paper after confirmation"],
  ["clearAiSpace", {}, true, ["ai"], "Clear AI space after confirmation"],
  ["clearUserLenses", {}, true, ["lens"], "Clear user lenses after confirmation"],
  ["clearGenerators", {}, true, ["generator"], "Clear generators after confirmation"],
  ["clearWorkspaceDomains", { domains: "array" }, true, ["paper", "ai", "lens", "generator"], "Clear chosen domains after confirmation"],
  ["capturePageSelection", {}, false, ["extension", "highlight"], "Capture the current external page selection", "extension"],
  ["togglePageHighlighter", { enabled: "boolean?" }, false, ["extension", "highlight", "interface"], "Toggle the external page highlighter", "extension"],
  ["queueExternalLens", { lens: "string" }, false, ["extension", "highlight", "lens"], "Queue a lens in the external page stack without running it", "extension"],
  ["setExternalGenerator", { generator: "string" }, false, ["extension", "generator"], "Set the external generator destination without mutating it", "extension"],
  ["previewExternalGo", {}, false, ["extension", "highlight", "lens"], "Preview external-page disclosure and output count", "extension"],
  ["pressExternalGo", {}, false, ["extension", "highlight", "lens"], "Run the external stack only at the explicit GO boundary", "extension"],
  ["copyExternalResult", { result: "string" }, false, ["extension"], "Copy a staged external-page result", "extension"],
  ["insertExternalResult", { result: "string" }, false, ["extension"], "Insert a staged result through the verified page adapter", "extension"],
  ["replaceExternalSelection", { result: "string" }, false, ["extension"], "Replace an unchanged page selection through the verified adapter", "extension"],
  ["annotateExternalResult", { result: "string" }, false, ["extension", "highlight"], "Annotate a staged result without replacing page material", "extension"],
  ["openExternalArtifact", { result: "string" }, false, ["extension", "paper"], "Open a staged extension artifact in Lens", "extension"],
  ["showExternalLibraryImport", {}, false, ["extension", "lens", "generator", "interface"], "Show pending library import status and review", "extension"],
];

const RESULT_TYPES = {
  spawnText: "paper-item",
  createFunction: "lens",
  applyFunction: "ai-node",
  dragItemToAi: "ai-node",
  applyFunctionToAiNode: "ai-node",
  makeHighlightNode: "ai-node",
  armLensBrush: "lens",
  armGeneratorBrush: "generator",
  stackLenses: "lens-preview",
  saveCompoundLens: "lens",
  addGrindExample: "grind-example",
  compileGrindDraft: "grind-draft",
  shapeForgedLens: "lens",
  captureThread: "lens",
  addBlock: "paper-item",
  forkLens: "lens",
  mergeLenses: "lens",
  newGenerator: "generator",
  makeLensFromGenerator: "lens",
};

const REF_ARG_TYPES = {
  applyFunction: { op: "lens", target: "paper-item" },
  applyFunctionToAiNode: { op: "lens" },
  operateHighlight: { op: "lens" },
  armLensBrush: { lens: "lens" },
  armGeneratorBrush: { generator: "generator" },
  queueBrushLens: { lens: "lens" },
  setBrushGeneratorDestination: { generator: "generator" },
  previewLensComposition: { a: "lens", b: "lens" },
  stackLenses: { a: "lens", b: "lens" },
  pinLens: { lens: "lens" },
  archiveLens: { lens: "lens" },
  restoreLens: { lens: "lens" },
  openFunctionEditor: { op: "lens" },
  editFunction: { op: "lens" },
  addFunctionStep: { op: "lens", use: "lens" },
  addFunctionBranch: { op: "lens" },
  setFunctionStep: { op: "lens" },
  saveFunction: { op: "lens" },
  forkLens: { lens: "lens" },
  mergeLenses: { a: "lens", b: "lens" },
  editLensByInstruction: { op: "lens" },
  attachToGenerator: { generator: "generator", target: "paper-item" },
  graduateGenerator: { generator: "generator" },
  probeGenerator: { generator: "generator" },
  makeLensFromGenerator: { generator: "generator" },
};

const INTENT_EXAMPLES = {
  switchTool: ["switch to the highlighter"],
  spawnText: ["put this idea on paper"],
  createFunction: ["build a diligence lens with three steps"],
  applyFunction: ["run my diligence lens on this note"],
  dragItemToAi: ["send this note into AI space"],
  applyFunctionToAiNode: ["branch this AI node through invert"],
  makeHighlightNode: ["make the highlighted material one node"],
  armLensBrush: ["use my diligence lens as a brush"],
  armGeneratorBrush: ["collect what I brush into the evidence generator"],
  disarmBrushTarget: ["put down the brush"],
  applyArmedBrush: ["apply the armed brush to everything highlighted"],
  queueBrushLens: ["queue invert then ground, but do not run yet"],
  pressBrushGo: ["press GO on the pending stack"],
  setBrushGeneratorDestination: ["collect the highlighted source in my evidence generator when GO runs"],
  cancelPendingBrush: ["cancel the pending brush stack but keep the highlight"],
  saveBrushQueueAsLens: ["save this pending stack as a lens"],
  stackLenses: ["stack invert then ground as a reusable lens"],
  addGrindExample: ["add this as a positive example"],
  compileGrindDraft: ["use these five transformations to forge a lens"],
  testGrindDraft: ["test the forged lens"],
  refineGrindDraft: ["tighten it"],
  rackSearch: ["find my argument lenses"],
  captureThread: ["save how I got here as a lens"],
  newGenerator: ["create a new generator"],
  attachToGenerator: ["attach this observation to my generator"],
  arrangeItems: ["rearrange these notes into three columns"],
  groupItems: ["group the market evidence in the upper right"],
  linkItems: ["link this counterexample to the claim"],
  transformMaterial: ["compare these branches for evidence quality and novelty"],
  annotateFeedback: ["annotate the weakest assumption beside this branch"],
  clearWorkspaceDomains: ["clear all functions, drawings, and AI stuff"],
};

export const COMPANION_CAPABILITIES = RAW_CAPABILITIES.map(
  ([name, args, destructive, domains, purpose, platform = "app"]) => ({
    name,
    args,
    destructive,
    domains,
    purpose,
    resultType: RESULT_TYPES[name] || "action-result",
    refArgs: REF_ARG_TYPES[name] || {},
    examples: INTENT_EXAMPLES[name] || [`please ${purpose.charAt(0).toLowerCase()}${purpose.slice(1)}`],
    animation: "director",
    observation: domains.includes("interface") && domains.length === 1 ? [] : ["selection", "objects", "viewport"],
    risk: destructive ? "high" : ["transformMaterial", "arrangeItems", "groupItems"].includes(name) ? "medium" : "low",
    testCaseId: `capability-${name}`,
    platform,
  })
);

export const EXTENSION_COMPANION_CAPABILITIES = COMPANION_CAPABILITIES.filter((entry) => entry.platform === "extension");

export const COMPANION_VERBS = Object.fromEntries(
  COMPANION_CAPABILITIES.map(({ name, args, destructive, domains, purpose }) => [
    name,
    { args, destructive, domains, purpose },
  ])
);

export function capabilityPrompt(platform = "app") {
  return COMPANION_CAPABILITIES.filter((entry) => entry.platform === platform).map(
    (capability) =>
      `- ${capability.name}(${Object.entries(capability.args).map(([key, type]) => `${key}: ${type}`).join(", ")}) -> ${capability.resultType} — ${capability.purpose}; e.g. “${capability.examples[0]}”${capability.destructive ? " [confirmation required]" : ""}`
  ).join("\n");
}

export function validateCapabilityNames(registeredNames, capabilities = COMPANION_CAPABILITIES.filter((entry) => entry.platform === "app")) {
  const documented = new Set(capabilities.map((entry) => entry.name));
  const registered = new Set(registeredNames);
  return {
    undocumented: [...registered].filter((name) => !documented.has(name)),
    unregistered: [...documented].filter((name) => !registered.has(name)),
  };
}

export function validateCapabilityManifest(registeredNames, capabilities = COMPANION_CAPABILITIES) {
  const registeredCapabilities = capabilities === COMPANION_CAPABILITIES
    ? capabilities.filter((entry) => entry.platform === "app")
    : capabilities;
  const names = validateCapabilityNames.call(null, registeredNames, registeredCapabilities);
  const missingExamples = capabilities.filter((entry) => !entry.examples?.length).map((entry) => entry.name);
  const missingAnimation = capabilities
    .filter((entry) => entry.animation !== "director")
    .map((entry) => entry.name);
  const missingArgumentSchema = capabilities
    .filter((entry) => !entry.args || typeof entry.args !== "object" || Array.isArray(entry.args))
    .map((entry) => entry.name);
  const missingRisk = capabilities
    .filter((entry) => !["low", "medium", "high"].includes(entry.risk))
    .map((entry) => entry.name);
  const missingObservation = capabilities
    .filter((entry) => !Array.isArray(entry.observation))
    .map((entry) => entry.name);
  const missingTestCase = capabilities.filter((entry) => !entry.testCaseId).map((entry) => entry.name);
  return {
    ...names,
    missingExamples,
    missingAnimation,
    missingArgumentSchema,
    missingRisk,
    missingObservation,
    missingTestCase,
  };
}

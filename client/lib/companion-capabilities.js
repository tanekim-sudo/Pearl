/**
 * Canonical public surface the companion may plan against.
 * Every entry must correspond to a real director verb registered by App.
 */
const RAW_CAPABILITIES = [
  ["caption", { text: "string?" }, false, ["interface"], "Explain an action while it happens"],
  ["pause", { ms: "number?" }, false, ["interface"], "Pause between visible actions"],
  ["switchTool", { tool: "string" }, false, ["interface", "paper"], "Select a canvas tool"],
  ["fitPaper", {}, false, ["paper", "ai", "interface"], "Fit the paper frame in the unified workspace"],
  ["zoomPaper", { direction: "in|out|reset" }, false, ["paper", "ai", "interface"], "Zoom the unified workspace"],
  ["panPaper", { dx: "number", dy: "number" }, false, ["paper", "ai", "interface"], "Pan the unified world"],
  ["spawnText", { text: "string", saveAs: "string?", caption: "string?" }, false, ["paper"], "Create text on paper"],
  ["createMove", { name: "string", prompt: "string", outputSpec: "object?" }, false, ["move"], "Create a one-action Move without a child graph"],
  ["editMove", { move: "string", name: "string?", prompt: "string?", outputSpec: "object?" }, false, ["move"], "Edit and version an atomic Move"],
  ["forkMove", { move: "string", name: "string?" }, false, ["move"], "Fork a Move without mutating its source"],
  ["applyMove", { move: "string", target: "string", wait: "boolean?" }, false, ["move", "paper", "ai"], "Apply a Move as exactly one model call"],
  ["saveCurrentAsMove", { target: "string?", name: "string?" }, false, ["move", "paper", "ai", "highlight"], "Save selected content verbatim as a Move"],
  ["promotePrimitiveMove", { move: "string" }, false, ["move", "interface"], "Promote a Move into the ordered Primitive Moves section"],
  ["demotePrimitiveMove", { move: "string" }, false, ["move", "interface"], "Remove a Move from Primitive Moves without deleting it"],
  ["reorderPrimitiveMove", { move: "string", to: "number" }, false, ["move", "interface"], "Reorder a Primitive Move"],
  ["captureLineageAsFunction", { target: "string?", name: "string?" }, false, ["function", "paper", "ai"], "Capture only the selected result's contributing lineage as a Function"],
  ["openSaveAsChooser", { target: "string?" }, false, ["move", "function", "lens", "interface"], "Open the Move, Function, or Lens chooser"],
  ["chooseSaveAsKind", { kind: "move|function|lens" }, false, ["move", "function", "lens", "interface"], "Choose an eligible kind in the Save As preview"],
  ["openTranscriptLearning", {}, false, ["move", "function", "lens", "interface"], "Open the private Learn from a chat workspace"],
  ["setTranscriptDraft", { text: "string", source: "string?" }, false, ["move", "function", "lens", "interface"], "Set transcript evidence supplied explicitly by the user"],
  ["chooseTranscriptArtifacts", { kind: "move|function|lens|all" }, false, ["move", "function", "lens", "interface"], "Choose which canonical artifacts to infer"],
  ["excludeTranscriptMessages", { messages: "array" }, false, ["move", "function", "lens"], "Exclude explicit message indices before inference"],
  ["redactTranscriptText", { text: "string", replacement: "string?" }, false, ["move", "function", "lens"], "Redact explicit sensitive text locally"],
  ["generateTranscriptArtifacts", {}, false, ["move", "function", "lens"], "Generate previews from untrusted transcript evidence"],
  ["selectTranscriptAlternative", { kind: "move|function|lens", alternative: "number" }, false, ["move", "function", "lens"], "Choose an inferred artifact alternative"],
  ["editTranscriptArtifact", { kind: "move|function|lens", name: "string?", content: "string?" }, false, ["move", "function", "lens"], "Edit an inferred artifact preview"],
  ["saveTranscriptArtifacts", { kinds: "array" }, false, ["move", "function", "lens"], "Save selected transcript artifacts through canonical persistence"],
  ["wrapMoveAsFunction", { move: "string", name: "string?" }, false, ["move", "function"], "Wrap a Move as a one-step Function"],
  ["flattenFunctionToMove", { function: "string", name: "string?" }, false, ["move", "function"], "Explicitly flatten an eligible one-step Function to a Move"],
  ["createFunction", { name: "string", description: "string?", steps: "array", saveAs: "string?" }, false, ["function"], "Create a reusable transformation Function"],
  ["openBeforeAfterCreation", {}, false, ["move", "function", "interface"], "Open real before-and-after Move/Function learning"],
  ["setBeforeAfterText", { side: "before|after", text: "string", example: "number?" }, false, ["move", "function"], "Set before or after text on the active private example"],
  ["attachSelectionToBeforeAfter", { side: "before|after", target: "string?", example: "number?" }, false, ["move", "function", "paper", "ai"], "Attach a selected app object to a before or after slot"],
  ["addBeforeAfterExample", {}, false, ["move", "function"], "Add another private before-and-after example"],
  ["removeBeforeAfterExample", { example: "number" }, false, ["move", "function"], "Remove one private before-and-after example"],
  ["inferBeforeAfterTransformation", {}, false, ["move", "function"], "Infer an editable reusable Move or Function specification"],
  ["chooseBeforeAfterAlternative", { alternative: "number" }, false, ["move", "function"], "Choose one inferred alternative hypothesis"],
  ["editInferredFunctionSpec", { name: "string?", summary: "string?", operation: "string?" }, false, ["move", "function"], "Edit the inferred specification before use"],
  ["useInferredFunction", {}, false, ["move", "function", "interface"], "Populate the canonical Move or Function editor"],
  ["saveLearnedFunction", {}, false, ["move", "function"], "Save the reviewed learned Move or Function"],
  ["applyFunction", { op: "string", target: "string", wait: "boolean?" }, false, ["function", "paper", "ai"], "Apply a Function process to paper material"],
  ["dragItemToAi", { target: "string" }, false, ["paper", "ai"], "Use paper material as a node source in the unified world"],
  ["applyFunctionToAiNode", { op: "string" }, false, ["function", "ai"], "Branch an AI node through a Function"],
  ["focusAiResult", {}, false, ["ai", "interface"], "Focus the latest AI result"],
  ["fitAiSpace", {}, false, ["ai", "interface"], "Fit the AI constellation in view"],
  ["selectAiNode", { target: "string?" }, false, ["ai"], "Select an AI node"],
  ["dragAiResultToPaper", {}, false, ["ai", "paper"], "Materialize an AI result as editable paper content"],
  ["highlight", { targets: "array" }, false, ["highlight", "paper"], "Highlight paper material"],
  ["operateHighlight", { op: "string" }, false, ["highlight", "paper", "ai", "move", "function"], "Queue a Move or Function for the cross-domain highlight selection"],
  ["armFunctionBrush", { function: "string" }, false, ["highlight", "function", "interface"], "Queue a Function for a pending brush action"],
  ["armLensContext", { lens: "string" }, false, ["highlight", "lens", "interface"], "Queue Lens context without executing"],
  ["disarmBrushTarget", {}, false, ["highlight", "move", "function", "lens", "interface"], "Cancel the pending brush plan"],
  ["applyArmedBrush", {}, false, ["highlight", "paper", "ai", "move", "function", "lens"], "Press GO for the pending brush action"],
  ["queueBrushAction", { action: "string" }, false, ["highlight", "move", "function"], "Queue a Move or Function without executing it"],
  ["setBrushLensContext", { lens: "string" }, false, ["highlight", "lens"], "Queue bounded Lens context without mutating it"],
  ["reorderBrushQueue", { from: "number", to: "number" }, false, ["highlight", "lens"], "Reorder the pending brush stack"],
  ["removeBrushQueue", { index: "number" }, false, ["highlight", "lens"], "Remove one queued brush lens"],
  ["previewBrushQueue", {}, false, ["highlight", "lens"], "Preview pending stack compatibility and outputs"],
  ["pressBrushGo", {}, false, ["highlight", "paper", "ai", "lens"], "Commit the pending brush stack exactly once"],
  ["cancelPendingBrush", {}, false, ["highlight", "move", "function", "lens"], "Cancel pending brush operations without clearing highlighted material"],
  ["saveBrushQueueAsFunction", {}, false, ["highlight", "function"], "Open the pending action stack as an editable Function preview"],
  ["makeHighlightNode", {}, false, ["highlight", "paper", "ai", "move", "function", "lens"], "Combine the highlighted material into one provenance-preserving source node"],
  ["clearHighlight", {}, false, ["highlight", "paper", "ai", "move", "function", "lens"], "Clear the persistent cross-domain highlight selection"],
  ["captureThreadAsFunction", { target: "string?", name: "string?" }, false, ["function", "paper", "ai"], "Save the selected node's contributing lineage as a Function"],
  ["showLenses", {}, false, ["lens", "interface"], "Open the Lenses rail"],
  ["openExtensionDownload", {}, false, ["extension", "interface"], "Open Lens Everywhere download and installation help"],
  ["openExtensionLibraryExport", {}, false, ["extension", "move", "function", "lens", "interface"], "Open the explicit library privacy review and export surface"],
  ["savePageAsLens", {}, false, ["lens", "paper"], "Capture the page as contextual Lens material"],
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
  ["transformMaterial", { mode: "synthesize|compare|critique|reflect|alternatives|counterexamples|revise|cluster-semantically", targets: "array", instruction: "string?", criteria: "array?", outputCount: "number?", preserveOriginal: "boolean?" }, false, ["paper", "ai", "move", "function", "lens"], "Run a reusable creative or evaluative operation and materialize its output"],
  ["annotateFeedback", { target: "string", text: "string", kind: "feedback|assumption|tension|evidence|research", sources: "array?" }, false, ["paper", "ai", "path"], "Place linked feedback or provenance beside its target"],
  ["openFunctionEditor", { op: "string" }, false, ["function", "interface"], "Open a Function in the editor"],
  ["editFunction", { op: "string", name: "string?", description: "string?", prompt: "string?" }, false, ["function"], "Edit Function metadata or instructions"],
  ["inspectFunctionOutput", { op: "string" }, false, ["function", "interface"], "Inspect a Function output specification"],
  ["editFunctionOutput", { op: "string", semanticType: "string?", machineKind: "string?", description: "string?", instructions: "string?", cardinality: "number?", outputs: "array?" }, false, ["function"], "Edit the semantic output contract of a Function"],
  ["editFunctionBranchOutput", { op: "string", branch: "number|string", label: "string?", machineKind: "string?", to: "number?" }, false, ["function"], "Edit or reorder one stable Function branch output"],
  ["setFunctionOutputMode", { op: "string", mode: "derived|override" }, false, ["function"], "Choose derived child outputs or a Function-level override"],
  ["resetFunctionOutput", { op: "string" }, false, ["function"], "Reset a Function to its deterministic suggested output"],
  ["addFunctionStep", { op: "string", name: "string?", prompt: "string?", description: "string?", after: "string?", use: "string?" }, false, ["function"], "Add a step to a Function"],
  ["addFunctionBranch", { op: "string", from: "string?", name: "string", prompt: "string?" }, false, ["function"], "Add a branch to a Function"],
  ["setFunctionStep", { op: "string", step: "string", name: "string?", prompt: "string?", description: "string?" }, false, ["function"], "Edit a Function step"],
  ["saveFunction", { op: "string", message: "string?" }, false, ["function"], "Commit edits to a Function"],
  ["forkFunction", { function: "string", message: "string?" }, false, ["function"], "Fork a Function"],
  ["mergeFunctions", { a: "string", b: "string", name: "string?" }, false, ["function"], "Merge two Functions"],
  ["previewFunctionComposition", { a: "string", b: "string" }, false, ["function"], "Preview ordered Function composition"],
  ["stackFunctions", { a: "string", b: "string", name: "string?", linkMode: "pinned|latest?" }, false, ["function"], "Open an ordered compound Function preview"],
  ["saveCompoundFunction", { edit: "boolean?" }, false, ["function"], "Save the reviewed compound Function"],
  ["addGrindExample", { input: "string", output: "string", note: "string?", domain: "string?", polarity: "positive|negative?" }, false, ["lens", "paper", "ai"], "Keep an explicit transformation example"],
  ["removeGrindExample", { example: "string" }, false, ["lens"], "Remove a grinding example"],
  ["reorderGrindExample", { example: "string", to: "number" }, false, ["lens"], "Reorder grinding examples"],
  ["compileGrindDraft", {}, false, ["lens"], "Analyze examples and propose editable rules"],
  ["testGrindDraft", {}, false, ["lens"], "Test the forged proposal on a holdout"],
  ["refineGrindDraft", { instruction: "string" }, false, ["lens"], "Refine a forged proposal"],
  ["shapeForgedFunction", {}, false, ["function", "interface"], "Open the forged Function in the process editor"],
  ["rackSearch", { query: "string" }, false, ["move", "function", "lens", "interface"], "Search the library rack"],
  ["rackFilter", { type: "string", sort: "string?" }, false, ["move", "function", "lens", "interface"], "Filter and sort the library rack"],
  ["pinFunction", { function: "string", pinned: "boolean?" }, false, ["function"], "Pin or unpin a rack Function"],
  ["archiveFunction", { function: "string" }, false, ["function"], "Archive a Function without deleting it"],
  ["restoreFunction", { function: "string" }, false, ["function"], "Restore an archived Function"],
  ["editFunctionByInstruction", { function: "string", instruction: "string" }, false, ["function"], "Rewrite a Function from an instruction"],
  ["createLens", { saveAs: "string?", contextPolicy: "empty|bounded|rich?" }, false, ["lens"], "Create an emerging or empty contextual Lens"],
  ["addLensMaterial", { lens: "string", target: "string" }, false, ["lens", "paper"], "Attach contextual evidence to a Lens"],
  ["nameLens", { lens: "string", name: "string" }, false, ["lens"], "Name an emerging Lens"],
  ["probeLens", { lens: "string", domain: "string" }, false, ["lens", "ai"], "Probe Lens context in another domain"],
  ["inferFunctionFromLens", { lens: "string" }, false, ["lens", "function"], "Infer a Function while preserving its source Lens"],
  ["clearPaper", {}, true, ["paper"], "Clear paper after confirmation"],
  ["clearAiSpace", {}, true, ["ai"], "Clear AI space after confirmation"],
  ["clearFunctions", {}, true, ["function"], "Clear user Functions after confirmation"],
  ["clearLenses", {}, true, ["lens"], "Clear contextual Lenses after confirmation"],
  ["clearWorkspaceDomains", { domains: "array" }, true, ["paper", "ai", "move", "function", "lens"], "Clear chosen domains after confirmation"],
  ["capturePageSelection", {}, false, ["extension", "highlight"], "Capture the current external page selection", "extension"],
  ["openExternalSaveAs", {}, false, ["extension", "move", "function", "lens", "interface"], "Open the external Move, Function, or Lens chooser", "extension"],
  ["saveExternalCaptureAsMove", {}, false, ["extension", "move", "highlight"], "Save captured page text verbatim as a Move", "extension"],
  ["saveExternalCaptureAsLens", {}, false, ["extension", "lens", "highlight"], "Collect captured page material in a Lens", "extension"],
  ["togglePageHighlighter", { enabled: "boolean?" }, false, ["extension", "highlight", "interface"], "Toggle the external page highlighter", "extension"],
  ["queueExternalAction", { action: "string" }, false, ["extension", "highlight", "move", "function"], "Queue a Move or Function in the external action stack without running it", "extension"],
  ["setExternalLensContext", { lens: "string" }, false, ["extension", "lens"], "Set external Lens context without mutating it", "extension"],
  ["previewExternalGo", {}, false, ["extension", "highlight", "lens"], "Preview external-page disclosure and output count", "extension"],
  ["pressExternalGo", {}, false, ["extension", "highlight", "lens"], "Run the external stack only at the explicit GO boundary", "extension"],
  ["copyExternalResult", { result: "string" }, false, ["extension"], "Copy a staged external-page result", "extension"],
  ["insertExternalResult", { result: "string" }, false, ["extension"], "Insert a staged result through the verified page adapter", "extension"],
  ["replaceExternalSelection", { result: "string" }, false, ["extension"], "Replace an unchanged page selection through the verified adapter", "extension"],
  ["annotateExternalResult", { result: "string" }, false, ["extension", "highlight"], "Annotate a staged result without replacing page material", "extension"],
  ["openExternalArtifact", { result: "string" }, false, ["extension", "paper"], "Open a staged extension artifact in Lens", "extension"],
  ["showExternalLibraryImport", {}, false, ["extension", "move", "function", "lens", "interface"], "Show pending library import status and review", "extension"],
  ["openExternalBeforeAfter", {}, false, ["extension", "move", "function", "interface"], "Open compact external before-and-after learning", "extension"],
  ["setExternalBeforeAfterText", { side: "before|after", text: "string" }, false, ["extension", "move", "function"], "Set text in an external before or after capture slot", "extension"],
  ["inferExternalBeforeAfter", {}, false, ["extension", "move", "function"], "Infer and sync a Move or Function from explicit external examples", "extension"],
];

const HANDLER_CONFIRMED_CAPABILITIES = new Set([
  "clearPaper",
  "clearAiSpace",
  "clearFunctions",
  "clearLenses",
  "clearWorkspaceDomains",
]);

export const COMPANION_ACTION_METADATA = Object.freeze({
  confirmed: Object.freeze({
    type: "boolean",
    placement: "action",
    purpose: "Framework confirmation metadata; never pass inside capability args",
  }),
});

export const COMPANION_DIRECTOR_ARG_METADATA = Object.freeze({
  caption: "string?",
});

const RESULT_TYPES = {
  spawnText: "paper-item",
  createMove: "move",
  forkMove: "move",
  applyMove: "ai-node",
  saveCurrentAsMove: "move",
  captureLineageAsFunction: "function",
  wrapMoveAsFunction: "function",
  flattenFunctionToMove: "move",
  createFunction: "function",
  openBeforeAfterCreation: "before-after-draft",
  inferBeforeAfterTransformation: "before-after-inference",
  useInferredFunction: "function-preview",
  saveLearnedFunction: "function",
  applyFunction: "ai-node",
  dragItemToAi: "ai-node",
  applyFunctionToAiNode: "ai-node",
  makeHighlightNode: "ai-node",
  armFunctionBrush: "function",
  armLensContext: "lens",
  stackFunctions: "function-preview",
  saveCompoundFunction: "function",
  addGrindExample: "grind-example",
  compileGrindDraft: "grind-draft",
  shapeForgedFunction: "function",
  captureThreadAsFunction: "function",
  addBlock: "paper-item",
  forkFunction: "function",
  mergeFunctions: "function",
  createLens: "lens",
  inferFunctionFromLens: "function",
};

const REF_ARG_TYPES = {
  editMove: { move: "move" },
  forkMove: { move: "move" },
  applyMove: { move: "move", target: "paper-item" },
  promotePrimitiveMove: { move: "move" },
  demotePrimitiveMove: { move: "move" },
  reorderPrimitiveMove: { move: "move" },
  wrapMoveAsFunction: { move: "move" },
  flattenFunctionToMove: { function: "function" },
  applyFunction: { op: "function", target: "paper-item" },
  applyFunctionToAiNode: { op: "function" },
  armFunctionBrush: { function: "function" },
  armLensContext: { lens: "lens" },
  queueBrushAction: { action: "function" },
  setBrushLensContext: { lens: "lens" },
  previewFunctionComposition: { a: "function", b: "function" },
  stackFunctions: { a: "function", b: "function" },
  pinFunction: { function: "function" },
  archiveFunction: { function: "function" },
  restoreFunction: { function: "function" },
  openFunctionEditor: { op: "function" },
  editFunction: { op: "function" },
  inspectFunctionOutput: { op: "function" },
  editFunctionOutput: { op: "function" },
  editFunctionBranchOutput: { op: "function" },
  setFunctionOutputMode: { op: "function" },
  resetFunctionOutput: { op: "function" },
  addFunctionStep: { op: "function", use: "function" },
  addFunctionBranch: { op: "function" },
  setFunctionStep: { op: "function" },
  saveFunction: { op: "function" },
  forkFunction: { function: "function" },
  mergeFunctions: { a: "function", b: "function" },
  editFunctionByInstruction: { function: "function" },
  addLensMaterial: { lens: "lens", target: "paper-item" },
  nameLens: { lens: "lens" },
  probeLens: { lens: "lens" },
  inferFunctionFromLens: { lens: "lens" },
};

const INTENT_EXAMPLES = {
  switchTool: ["switch to the highlighter"],
  spawnText: ["put this idea on paper"],
  createMove: ["make a Move called executive summary with this one action"],
  saveCurrentAsMove: ["save this text as a Move"],
  promotePrimitiveMove: ["add summarize to Primitive Moves"],
  demotePrimitiveMove: ["remove invert from Primitive Moves"],
  reorderPrimitiveMove: ["move expand to the first Primitive Move"],
  captureLineageAsFunction: ["save how I got here as a Function"],
  openSaveAsChooser: ["save this as…"],
  chooseSaveAsKind: ["collect these in a Lens"],
  openTranscriptLearning: ["open Learn from a chat"],
  setTranscriptDraft: ["use this pasted chat transcript"],
  chooseTranscriptArtifacts: ["make all three from this chat"],
  excludeTranscriptMessages: ["exclude messages two and five"],
  redactTranscriptText: ["redact this token before analysis"],
  generateTranscriptArtifacts: ["turn this chat into a Move"],
  selectTranscriptAlternative: ["use the second Function candidate"],
  editTranscriptArtifact: ["rename the inferred Lens"],
  saveTranscriptArtifacts: ["save the Move and Lens from this chat"],
  wrapMoveAsFunction: ["turn this Move into a one-step Function"],
  flattenFunctionToMove: ["explicitly flatten this single-step Function into a Move"],
  createFunction: ["build a diligence Function with three steps"],
  openBeforeAfterCreation: ["learn a Move or Function from this before and after"],
  setBeforeAfterText: ["set the before text to these raw notes"],
  attachSelectionToBeforeAfter: ["this image became that image—learn the transformation"],
  addBeforeAfterExample: ["add another example"],
  inferBeforeAfterTransformation: ["infer the shared transformation"],
  chooseBeforeAfterAlternative: ["use the second hypothesis"],
  editInferredFunctionSpec: ["make the inferred operation preserve headings"],
  useInferredFunction: ["use this inferred transformation"],
  saveLearnedFunction: ["save this learned Function"],
  applyFunction: ["run my diligence Function on this note"],
  dragItemToAi: ["send this note into AI space"],
  applyFunctionToAiNode: ["branch this AI node through invert"],
  makeHighlightNode: ["make the highlighted material one node"],
  armFunctionBrush: ["use my diligence Function as a brush"],
  armLensContext: ["use the evidence Lens as context"],
  disarmBrushTarget: ["put down the brush"],
  applyArmedBrush: ["apply the armed brush to everything highlighted"],
  queueBrushAction: ["queue invert then ground, but do not run yet"],
  pressBrushGo: ["press GO on the pending stack"],
  setBrushLensContext: ["scope the pending action with my evidence Lens"],
  cancelPendingBrush: ["cancel the pending brush stack but keep the highlight"],
  saveBrushQueueAsFunction: ["save this pending stack as a Function"],
  stackFunctions: ["stack invert then ground as a reusable Function"],
  addGrindExample: ["add this as a positive example"],
  compileGrindDraft: ["use these five transformations to forge a Function"],
  testGrindDraft: ["test the forged Function"],
  refineGrindDraft: ["tighten it"],
  rackSearch: ["find my argument Functions"],
  captureThreadAsFunction: ["save how I got here as a Function"],
  inspectFunctionOutput: ["show me what this function outputs"],
  editFunctionOutput: ["make this function output an investment memo and a one-page brief"],
  editFunctionBranchOutput: ["change the second branch to a table"],
  setFunctionOutputMode: ["derive this function output from its branches"],
  resetFunctionOutput: ["reset this function to its suggested output"],
  createLens: ["create a New Chat Lens with no context"],
  addLensMaterial: ["attach this observation to my Lens"],
  nameLens: ["name this emerging Lens evidence-first"],
  probeLens: ["view this Lens in the healthcare domain"],
  inferFunctionFromLens: ["infer a reusable Function from this Lens"],
  arrangeItems: ["rearrange these notes into three columns"],
  groupItems: ["group the market evidence in the upper right"],
  linkItems: ["link this counterexample to the claim"],
  transformMaterial: ["compare these branches for evidence quality and novelty"],
  annotateFeedback: ["annotate the weakest assumption beside this branch"],
  clearWorkspaceDomains: ["clear all functions, drawings, and AI stuff"],
  openExternalSaveAs: ["save this page selection as…"],
  saveExternalCaptureAsMove: ["save this text as a Move"],
  saveExternalCaptureAsLens: ["collect these in a Lens"],
  setExternalLensContext: ["use the evidence Lens as context"],
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
    confirmation: HANDLER_CONFIRMED_CAPABILITIES.has(name)
      ? "handler"
      : destructive
        ? "framework"
        : "none",
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
      `- ${capability.name}(${Object.entries(capability.args).map(([key, type]) => `${key}: ${type}`).join(", ")}) -> ${capability.resultType} — ${capability.purpose}; e.g. “${capability.examples[0]}”${capability.confirmation === "handler" ? " [handler stages confirmation; do not add confirmed]" : capability.confirmation === "framework" ? " [action.confirmed:true required; never put confirmed in args]" : ""}`
  ).join("\n");
}

export function companionActionMetadataPrompt() {
  return Object.entries(COMPANION_ACTION_METADATA)
    .map(([name, metadata]) => `- action.${name}: ${metadata.type} — ${metadata.purpose}`)
    .join("\n");
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
  const missingConfirmation = capabilities
    .filter((entry) => !["none", "framework", "handler"].includes(entry.confirmation))
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
    missingConfirmation,
    missingObservation,
    missingTestCase,
  };
}

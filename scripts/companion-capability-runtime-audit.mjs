import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import {
  COMPANION_CAPABILITIES,
} from "../client/lib/companion-capabilities.js";
import {
  parseCompanionPlan,
  validateCapabilityArgs,
} from "../client/lib/companion-plan.js";
import {
  executeExtensionVerb,
  parseExtensionIntent,
} from "../extension/src/sidepanel/companion.js";

const BASE = process.env.AUDIT_URL || "http://127.0.0.1:5190";
const auditUrl = (value) => {
  const url = new URL(value);
  url.searchParams.set("capabilityAudit", "1");
  return url.href;
};
const OUT = path.resolve(process.env.AUDIT_OUT || "audit-shots/post-audit-r046-r060-2026-07/companion-runtime");
const INPUT_PATH = process.env.AUDIT_INPUT_PATH === "visible" ? "visible" : "director";
fs.mkdirSync(OUT, { recursive: true });

const appCapabilities = COMPANION_CAPABILITIES.filter((entry) => entry.platform === "app");
const extensionCapabilities = COMPANION_CAPABILITIES.filter((entry) => entry.platform === "extension");
const requestedNames = new Set(
  String(process.env.AUDIT_NAMES || "").split(",").map((entry) => entry.trim()).filter(Boolean)
);
const selectedAppCapabilities = requestedNames.size
  ? appCapabilities.filter((entry) => requestedNames.has(entry.name))
  : appCapabilities;
const selectedExtensionCapabilities = requestedNames.size
  ? extensionCapabilities.filter((entry) => requestedNames.has(entry.name))
  : extensionCapabilities;

const items = [
  { id: "claim", type: "text", x: 110, y: 120, w: 220, text: "Claim material", pageId: "page-main", bornAt: 1 },
  { id: "evidence", type: "text", x: 390, y: 230, w: 220, text: "Evidence material", pageId: "page-main", bornAt: 2 },
  { id: "derived", type: "text", x: 250, y: 390, w: 220, text: "Derived material", pageId: "page-main", bornAt: 3, bornFrom: ["claim"], via: { name: "Audit lens" } },
];
const nodes = [
  { id: "node-root", nodeKind: "source", x: 810, y: 220, radius: 28, label: "AI source", expandedText: "AI source material" },
  { id: "node-child", nodeKind: "expanded", parentId: "node-root", x: 970, y: 320, radius: 24, label: "AI child", expandedText: "AI child material" },
  { id: "node-candidate", nodeKind: "expanded", parentId: "node-root", x: 1080, y: 430, radius: 24, label: "Candidate", expandedText: "Candidate material", generationBatchId: "batch-a", candidateIndex: 0, opId: "op-a" },
];
const multiOutputSpec = {
  version: 1,
  mode: "override",
  semanticType: "multi-output",
  machineKind: "multi",
  cardinality: { min: 2, max: 2 },
  branches: [
    { id: "branch-one", label: "brief", spec: { version: 1, mode: "custom", semanticType: "brief", machineKind: "text", cardinality: { min: 1, max: 1 }, branches: [] } },
    { id: "branch-two", label: "memo", spec: { version: 1, mode: "custom", semanticType: "memo", machineKind: "text", cardinality: { min: 1, max: 1 }, branches: [] } },
  ],
};
const operators = [
  { id: "op-a", name: "Audit Move", kind: "prompt", libraryKind: "move", prompt: "Transform.", top: true, primitiveMove: true, primitiveRank: 0, outputSpec: { version: 1, mode: "suggested", semanticType: "text", machineKind: "text", cardinality: { min: 1, max: 1 }, branches: [] } },
  { id: "op-b", name: "Second Move", kind: "prompt", libraryKind: "move", prompt: "Compare.", top: true },
  { id: "op-branch", name: "Branch Move", kind: "prompt", libraryKind: "move", prompt: "Branch.", top: true, outputSpec: multiOutputSpec, outputCount: 2 },
  { id: "op-pipeline", name: "Pipeline Function", kind: "pipeline", libraryKind: "function", steps: ["op-step"], top: true },
  { id: "op-step", name: "First step", kind: "prompt", libraryKind: "move", prompt: "First.", parentId: "op-pipeline" },
  { id: "op-pipeline-b", name: "Second Function", kind: "pipeline", libraryKind: "function", steps: ["op-b"], top: true },
];
const repos = operators
  .filter((entry) => entry.top)
  .map((entry) => ({ id: `repo-${entry.id}`, opId: entry.id, name: entry.name, moveIds: [entry.id], version: 1, commits: [] }));
const generators = [
  { id: "generator-a", title: "Audit Lens", name: "Audit Lens", kind: "lens", contextPolicy: "bounded", items: [items[0]], savedAt: 1 },
];

function seedScript(payload) {
  const { items, nodes, operators, repos, generators } = payload;
  window.__LENS_TEST_CAPTURE_IMAGE__ = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
  if (localStorage.getItem("lens.runtime-audit.seeded") === "1") return;
  localStorage.clear();
  localStorage.setItem("lens.runtime-audit.seeded", "1");
  localStorage.setItem("lens.onboarded.v1", "1");
  localStorage.setItem("lens.tour.v1", "1");
  localStorage.setItem("lens.companion.seen.v1", "1");
  localStorage.setItem("lens.board.pages.v1", JSON.stringify([{ id: "page-main", name: "Runtime audit" }]));
  localStorage.setItem("lens.doc.title.v1", "Runtime audit");
  localStorage.setItem("lens.board.items.v1", JSON.stringify(items));
  localStorage.setItem("lens.item.history.v1", JSON.stringify([{ id: "history-derived", itemId: "derived", type: "transform", opId: "op-a", opName: "Audit Move" }]));
  localStorage.setItem("lens.ai.nodes.v1", JSON.stringify(nodes));
  localStorage.setItem("lens.unified-workspace.v2", JSON.stringify({
    version: 3,
    camera: { x: 100, y: 40, scale: 0.7 },
    items,
    nodes,
  }));
  localStorage.setItem("lens.scenes.v4", JSON.stringify({
    version: 4,
    activeSceneId: "release-audit",
    scenes: [{
      id: "release-audit",
      kind: "scene",
      version: 4,
      name: "Runtime audit",
      items,
      nodes,
      frames: [],
      orbInstances: [],
      workingSet: { context: [], lenses: [], selections: [], branches: [], checkpoints: [] },
      camera: { x: 100, y: 40, scale: 0.7 },
      metadata: { createdFrom: "runtime-audit-fixture" },
    }],
  }));
  localStorage.setItem("lens.board.operators.v2", JSON.stringify(operators));
  localStorage.setItem("lens.primitive-moves.v1", JSON.stringify({ version: 1, promoted: ["op-b"], demoted: [], rank: ["op-a", "op-b"] }));
  localStorage.setItem("lens.transformation-repos.v1", JSON.stringify(repos));
  localStorage.setItem("lens.lenses.v2", JSON.stringify(generators));
  localStorage.setItem("lens.companion.memory.v1:anonymous", JSON.stringify({
    version: 1,
    identity: "Runtime auditor",
    role: "tester",
    goals: ["verify capabilities"],
    preferences: { autonomy: "act-immediately" },
    references: { lenses: [], generators: [], paths: [] },
    actions: [],
    interviewComplete: true,
  }));
}

function requiredFixture(rawType) {
  const type = rawType.replace(/\?$/, "");
  if (type.includes("|")) {
    const options = type.split("|");
    if (options.every((entry) => ["string", "number", "boolean", "array", "object"].includes(entry))) {
      return requiredFixture(options[0]);
    }
    return options[0];
  }
  if (type === "string") return "fixture";
  if (type === "number") return 1;
  if (type === "boolean") return true;
  if (type === "array") return ["claim"];
  if (type === "object") return { columns: 2 };
  if (type === "{x,y}") return { x: 240, y: 220 };
  return "fixture";
}

const argsByName = {
  caption: { text: "runtime audit" },
  pause: { ms: 1 },
  switchTool: { tool: "select" },
  zoomPaper: { direction: "in" },
  panPaper: { dx: 24, dy: 16 },
  spawnText: { text: "Runtime-created note" },
  createMove: { name: "Runtime-created Move", prompt: "Transform once." },
  editMove: { move: "op-a", name: "Edited Move" },
  forkMove: { move: "op-a", name: "Forked Move" },
  applyMove: { move: "op-a", target: "claim", wait: true },
  saveCurrentAsMove: { target: "claim", name: "Captured Move" },
  captureLineageAsFunction: { target: "derived", name: "Captured Function" },
  openSaveAsChooser: { target: "claim" },
  promotePrimitiveMove: { move: "op-b" },
  demotePrimitiveMove: { move: "op-a" },
  reorderPrimitiveMove: { move: "op-branch", to: 0 },
  wrapMoveAsFunction: { move: "op-a", name: "Wrapped Move" },
  flattenFunctionToMove: { function: "op-pipeline", name: "Flattened Function" },
  createFunction: { name: "Runtime-created Function", steps: [{ name: "Observe" }, { name: "Synthesize" }] },
  runFunctionTestBench: {
    function: "op-pipeline",
    fixtures: [{ id: "fixture-a", input: "Alpha evidence" }],
    holdouts: [{ id: "holdout-a", input: "Unrelated beta evidence" }],
    models: ["auto"],
    rubric: ["substantive output"],
  },
  setTranscriptDraft: { text: "User: Verify sources.\nAssistant: Compare evidence.", source: "runtime-audit" },
  chooseTranscriptArtifacts: { kind: "all" },
  excludeTranscriptMessages: { messages: [2] },
  redactTranscriptText: { text: "sources", replacement: "[REDACTED]" },
  selectTranscriptAlternative: { kind: "move", alternative: 1 },
  editTranscriptArtifact: { kind: "move", name: "Edited transcript Move", content: "Verify primary sources." },
  saveTranscriptArtifacts: { kinds: ["move", "function", "lens"] },
  setBeforeAfterText: { side: "before", text: "Raw runtime notes" },
  attachSelectionToBeforeAfter: { side: "after", target: "claim" },
  removeBeforeAfterExample: { example: 2 },
  chooseBeforeAfterAlternative: { alternative: 1 },
  editInferredFunctionSpec: { name: "Edited learned lens", summary: "Runtime summary", operation: "Compare evidence" },
  applyFunction: { op: "op-a", target: "claim", wait: true },
  dragItemToAi: { target: "claim" },
  applyFunctionToAiNode: { op: "op-a" },
  selectAiNode: { target: "node-root" },
  highlight: { targets: ["claim", "evidence"] },
  operateHighlight: { op: "op-a" },
  armFunctionBrush: { function: "op-pipeline" },
  armLensContext: { lens: "generator-a" },
  queueBrushAction: { action: "op-a" },
  setBrushLensContext: { lens: "generator-a" },
  reorderBrushQueue: { from: 0, to: 1 },
  removeBrushQueue: { index: 0 },
  captureThreadAsFunction: { target: "derived", name: "Captured runtime path" },
  moveItem: { target: "claim", dx: 80, dy: 30 },
  editItem: { target: "claim", text: "Edited by runtime audit" },
  deleteItem: { target: "evidence" },
  selectItems: { targets: ["claim", "evidence"] },
  addBlock: { type: "sticky", text: "Runtime block" },
  renamePage: { name: "Renamed runtime page" },
  addOrbContext: { items: [{ id: "claim", kind: "text", text: "Claim material", label: "Claim material" }], priority: .8 },
  updateOrbContext: { id: "claim", priority: 1, pinned: true },
  removeOrbContext: { id: "claim" },
  addOrbLens: { lens: { id: "orb-lens-audit", kind: "lens", name: "Runtime orb Lens" }, strength: .8 },
  updateOrbLens: { id: "orb-lens-audit", strength: .3 },
  removeOrbLens: { id: "orb-lens-audit" },
  zoomToItem: { target: "claim" },
  walkItemPath: { target: "derived" },
  stepSharedPath: { delta: 1 },
  noteSharedPath: { text: "Runtime path note" },
  moveAiNode: { target: "node-root", dx: 90, dy: 0 },
  arrangeItems: { targets: ["claim", "evidence", "node-root"], layout: "grid", options: { columns: 2, gap: 28 } },
  groupItems: { targets: ["claim", "evidence"], name: "Runtime group" },
  linkItems: { from: "claim", to: "evidence", label: "supports" },
  transformMaterial: { mode: "compare", targets: ["claim", "evidence"], instruction: "Compare faithfully." },
  annotateFeedback: { target: "claim", text: "Runtime feedback", kind: "feedback" },
  openFunctionEditor: { op: "op-a" },
  editFunction: { op: "op-a", name: "Edited audit lens" },
  inspectFunctionOutput: { op: "op-a" },
  editFunctionOutput: { op: "op-a", outputs: ["brief", "memo"] },
  editFunctionBranchOutput: { op: "op-branch", branch: 2, label: "table", machineKind: "table" },
  setFunctionOutputMode: { op: "op-branch", mode: "derived" },
  resetFunctionOutput: { op: "op-a" },
  addFunctionStep: { op: "op-pipeline", name: "Added runtime step" },
  addFunctionBranch: { op: "op-pipeline", from: "First step", name: "Runtime branch" },
  setFunctionStep: { op: "op-pipeline", step: "First step", name: "Edited first step" },
  saveFunction: { op: "op-pipeline", message: "runtime save" },
  forkFunction: { function: "Pipeline Function", message: "runtime fork" },
  mergeFunctions: { a: "Pipeline Function", b: "Second Function", name: "Runtime merged Function" },
  previewFunctionComposition: { a: "op-a", b: "op-b" },
  stackFunctions: { a: "op-a", b: "op-b", name: "Runtime stack" },
  saveCompoundFunction: { edit: false },
  addGrindExample: { input: "Before example", output: "After example", note: "runtime" },
  removeGrindExample: { example: "last" },
  reorderGrindExample: { example: "last", to: 0 },
  refineGrindDraft: { instruction: "Tighten the rule" },
  rackSearch: { query: "Audit" },
  rackFilter: { type: "all", sort: "recent" },
  pinFunction: { function: "op-pipeline", pinned: true },
  archiveFunction: { function: "op-pipeline" },
  restoreFunction: { function: "op-pipeline" },
  editFunctionByInstruction: { function: "op-pipeline", instruction: "Make the Function compare evidence" },
  createLens: {},
  resolveTasteLens: { name: "Runtime Writing Taste", domain: "writing", scope: "workspace" },
  saveTasteTeaching: { lens: "generator-a", instruction: "Remember: avoid filler words", explicitSave: true, source: { sourceId: "runtime-teaching", sourceType: "instruction", scope: "workspace", private: true } },
  attachTasteBeforeAfter: { lens: "generator-a", before: "claim", after: "evidence", preserved: ["technical precision"] },
  inspectTasteLens: { lens: "generator-a" },
  evaluateThroughTasteLens: { lens: "generator-a", target: "claim", preserve: ["unusual rhythm"] },
  addLensMaterial: { lens: "generator-a", target: "claim" },
  nameLens: { lens: "generator-a", name: "Named runtime Lens" },
  probeLens: { lens: "generator-a", domain: "music" },
  inferFunctionFromLens: { lens: "generator-a" },
  composeObjects: { a: "op-a", b: "op-b", name: "Runtime composition" },
  encodeLens: { lens: "generator-a" },
  inspectGenerationPlan: { artifact: "op-a" },
  setGenerationPlan: { artifact: "op-a", count: 3, model: "auto", mode: "single" },
  resetGenerationPlan: { artifact: "op-a" },
  tasteCandidate: { decision: "yes" },
  moreLikeThis: { count: 2 },
  observeWorkspace: { scope: "viewport" },
  interpretThroughLens: { lens: "generator-a", scope: "viewport" },
  interpretVisibleScreenThroughLens: { lens: "generator-a" },
  captureInstructionAsMove: { text: "Verify every primary source", source: "voice" },
  ingestCritique: { text: "Keep the first claim but rewrite the second." },
  createSignedPackage: { namespace: "runtime.audit", name: "evidence-tools", version: "1.0.0", artifactIds: ["op-a"], visibility: "private" },
  installCognitivePackage: { manifest: {} },
  rollbackCognitivePackage: { package: "runtime.audit/evidence-tools" },
  deprecateCognitivePackage: { namespace: "runtime.audit", name: "evidence-tools", version: "1.0.0" },
  openCognitiveWorkflowStudio: { tab: "higher-order" },
  proposeHigherOrderPatch: { artifact: "op-a", purpose: "Require evidence for every claim" },
  applyHigherOrderPatch: { patchId: "last", acceptedHunkIds: ["primary-hunk"] },
  teachPersonalCommand: { trigger: "runtime founder pass", command: "openCognitiveWorkflowStudio", scope: "workspace" },
  disablePersonalCommand: { trigger: "runtime founder pass" },
  forgetPersonalCommand: { trigger: "runtime founder pass" },
  openCognitivePullRequest: { source: "claim", kinds: ["move", "function", "lens"] },
  reviewCognitiveCandidate: { requestId: "last", candidateId: "first", decision: "accept" },
  mergeCognitivePullRequest: { requestId: "last", candidateIds: ["accepted"] },
  orchestrateCognitiveWorkflow: { source: "claim", visibility: "private" },
  createCreativeResearchProposal: {
    goal: { version: 1, id: "creative-runtime", rawWording: "Create one evidence-inspired Function", desiredArtifactKinds: ["function"], count: 1, groundingLevel: "evidence-inspired", noveltyTarget: .6, diversityDimensions: ["mechanism"], constraints: [], prohibitedImitation: [], audience: "tester", useContext: "audit", modelPolicy: { strategy: "auto" }, budget: { maxSources: 3, maxModelCalls: 4, maxUsd: 1, maxLatencyMs: 30000 }, rubric: ["grounding"], attribution: { subject: null, exactFrequencyRequested: false, endorsementAllowed: false }, sourcePolicy: { primaryPreferred: true, independentPerspectives: 1, datesRequiredWhenAvailable: true } },
    research: { provider: "runtime-mock", sources: [{ id: "runtime-source", title: "Runtime source", url: "https://example.com/runtime", publisher: "Example", snippet: "Documented iterative variation.", retrievedAt: "2026-07-17T18:00:00.000Z" }] },
    patterns: [{ id: "creative-function", kind: "function", title: "Inferred variation", blurb: "Iterate across explicit constraints", purpose: "Test variation", category: "variation", sourceIds: ["runtime-source"], steps: [{ name: "Vary", instruction: "Generate bounded variations." }, { name: "Compare", instruction: "Compare outcomes." }] }],
  },
  saveExternalTasteTeaching: { lens: "Writing Taste Lens", text: "explicit-selection", kind: "example" },
  openExternalCreativeExtraction: { goal: "Create from this selected tradition", kinds: ["move", "function", "lens"] },
  clearWorkspaceDomains: { domains: ["paper", "ai"] },
};

const setupByName = {
  saveCurrentAsMove: [{ verb: "selectItems", args: { targets: ["claim"] } }],
  captureLineageAsFunction: [{ verb: "selectItems", args: { targets: ["derived"] } }],
  openSaveAsChooser: [{ verb: "selectItems", args: { targets: ["claim"] } }],
  chooseSaveAsKind: [
    { verb: "selectItems", args: { targets: ["claim"] } },
    { verb: "openSaveAsChooser", args: { target: "claim" } },
  ],
  semanticTransfer: [{ verb: "selectItems", args: { targets: ["claim"] } }],
  setTranscriptDraft: [{ verb: "openTranscriptLearning", args: {} }],
  chooseTranscriptArtifacts: [{ verb: "openTranscriptLearning", args: {} }],
  excludeTranscriptMessages: [
    { verb: "openTranscriptLearning", args: {} },
    { verb: "setTranscriptDraft", args: { text: "User: Verify sources.\nAssistant: Compare evidence." } },
  ],
  redactTranscriptText: [
    { verb: "openTranscriptLearning", args: {} },
    { verb: "setTranscriptDraft", args: { text: "User: Verify sources.\nAssistant: Compare evidence." } },
  ],
  generateTranscriptArtifacts: [
    { verb: "openTranscriptLearning", args: {} },
    { verb: "setTranscriptDraft", args: { text: "User: Verify sources.\nAssistant: Compare evidence." } },
    { verb: "chooseTranscriptArtifacts", args: { kind: "all" } },
  ],
  selectTranscriptAlternative: [
    { verb: "openTranscriptLearning", args: {} },
    { verb: "setTranscriptDraft", args: { text: "User: Verify sources.\nAssistant: Compare evidence." } },
    { verb: "chooseTranscriptArtifacts", args: { kind: "all" } },
    { verb: "generateTranscriptArtifacts", args: {} },
  ],
  editTranscriptArtifact: [
    { verb: "openTranscriptLearning", args: {} },
    { verb: "setTranscriptDraft", args: { text: "User: Verify sources.\nAssistant: Compare evidence." } },
    { verb: "chooseTranscriptArtifacts", args: { kind: "all" } },
    { verb: "generateTranscriptArtifacts", args: {} },
  ],
  saveTranscriptArtifacts: [
    { verb: "openTranscriptLearning", args: {} },
    { verb: "setTranscriptDraft", args: { text: "User: Verify sources.\nAssistant: Compare evidence." } },
    { verb: "chooseTranscriptArtifacts", args: { kind: "all" } },
    { verb: "generateTranscriptArtifacts", args: {} },
  ],
  setBeforeAfterText: [{ verb: "openBeforeAfterCreation", args: {} }],
  attachSelectionToBeforeAfter: [{ verb: "openBeforeAfterCreation", args: {} }],
  addBeforeAfterExample: [{ verb: "openBeforeAfterCreation", args: {} }],
  removeBeforeAfterExample: [
    { verb: "openBeforeAfterCreation", args: {} },
    { verb: "addBeforeAfterExample", args: {} },
  ],
  inferBeforeAfterTransformation: [
    { verb: "openBeforeAfterCreation", args: {} },
    { verb: "setBeforeAfterText", args: { side: "before", text: "Raw notes" } },
    { verb: "setBeforeAfterText", args: { side: "after", text: "Structured summary" } },
  ],
  chooseBeforeAfterAlternative: [
    { verb: "openBeforeAfterCreation", args: {} },
    { verb: "setBeforeAfterText", args: { side: "before", text: "Raw notes" } },
    { verb: "setBeforeAfterText", args: { side: "after", text: "Structured summary" } },
    { verb: "inferBeforeAfterTransformation", args: {} },
  ],
  editInferredFunctionSpec: [
    { verb: "openBeforeAfterCreation", args: {} },
    { verb: "setBeforeAfterText", args: { side: "before", text: "Raw notes" } },
    { verb: "setBeforeAfterText", args: { side: "after", text: "Structured summary" } },
    { verb: "inferBeforeAfterTransformation", args: {} },
  ],
  useInferredFunction: [
    { verb: "openBeforeAfterCreation", args: {} },
    { verb: "setBeforeAfterText", args: { side: "before", text: "Raw notes" } },
    { verb: "setBeforeAfterText", args: { side: "after", text: "Structured summary" } },
    { verb: "inferBeforeAfterTransformation", args: {} },
  ],
  saveLearnedFunction: [
    { verb: "openBeforeAfterCreation", args: {} },
    { verb: "setBeforeAfterText", args: { side: "before", text: "Raw notes" } },
    { verb: "setBeforeAfterText", args: { side: "after", text: "Structured summary" } },
    { verb: "inferBeforeAfterTransformation", args: {} },
    { verb: "useInferredFunction", args: {} },
  ],
  applyArmedBrush: [
    { verb: "highlight", args: { targets: ["claim"] } },
    { verb: "queueBrushAction", args: { action: "op-a" } },
  ],
  reorderBrushQueue: [
    { verb: "queueBrushAction", args: { action: "op-a" } },
    { verb: "queueBrushAction", args: { action: "op-b" } },
  ],
  removeBrushQueue: [{ verb: "queueBrushAction", args: { action: "op-a" } }],
  previewBrushQueue: [{ verb: "queueBrushAction", args: { action: "op-a" } }],
  pressBrushGo: [
    { verb: "highlight", args: { targets: ["claim"] } },
    { verb: "queueBrushAction", args: { action: "op-a" } },
  ],
  cancelPendingBrush: [{ verb: "queueBrushAction", args: { action: "op-a" } }],
  saveBrushQueueAsFunction: [
    { verb: "queueBrushAction", args: { action: "op-a" } },
    { verb: "queueBrushAction", args: { action: "op-b" } },
  ],
  makeHighlightNode: [{ verb: "highlight", args: { targets: ["claim", "evidence"] } }],
  clearHighlight: [{ verb: "highlight", args: { targets: ["claim"] } }],
  captureThreadAsFunction: [{ verb: "selectItems", args: { targets: ["derived"] } }],
  saveCompoundFunction: [{ verb: "stackFunctions", args: { a: "op-a", b: "op-b", name: "Runtime stack" } }],
  removeGrindExample: [{ verb: "addGrindExample", args: { input: "Before", output: "After" } }],
  reorderGrindExample: [
    { verb: "addGrindExample", args: { input: "Before one", output: "After one" } },
    { verb: "addGrindExample", args: { input: "Before two", output: "After two" } },
  ],
  compileGrindDraft: [
    { verb: "addGrindExample", args: { input: "Before one", output: "After one" } },
    { verb: "addGrindExample", args: { input: "Before two", output: "After two" } },
  ],
  testGrindDraft: [
    { verb: "addGrindExample", args: { input: "Before one", output: "After one" } },
    { verb: "addGrindExample", args: { input: "Before two", output: "After two" } },
    { verb: "compileGrindDraft", args: {} },
  ],
  refineGrindDraft: [
    { verb: "addGrindExample", args: { input: "Before one", output: "After one" } },
    { verb: "addGrindExample", args: { input: "Before two", output: "After two" } },
    { verb: "compileGrindDraft", args: {} },
  ],
  shapeForgedFunction: [
    { verb: "addGrindExample", args: { input: "Before one", output: "After one" } },
    { verb: "addGrindExample", args: { input: "Before two", output: "After two" } },
    { verb: "compileGrindDraft", args: {} },
  ],
  restoreFunction: [{ verb: "archiveFunction", args: { function: "op-pipeline" } }],
  updateOrbContext: [{ verb: "addOrbContext", args: { items: [{ id: "claim", kind: "text", text: "Claim material" }] } }],
  removeOrbContext: [{ verb: "addOrbContext", args: { items: [{ id: "claim", kind: "text", text: "Claim material" }] } }],
  updateOrbLens: [{ verb: "addOrbLens", args: { lens: { id: "orb-lens-audit", kind: "lens", name: "Runtime orb Lens" }, strength: .8 } }],
  removeOrbLens: [{ verb: "addOrbLens", args: { lens: { id: "orb-lens-audit", kind: "lens", name: "Runtime orb Lens" }, strength: .8 } }],
  tasteCandidate: [{ verb: "selectAiNode", args: { target: "node-candidate" } }],
  moreLikeThis: [{ verb: "selectAiNode", args: { target: "node-candidate" } }],
  extendSelectedCandidates: [{ verb: "selectAiNode", args: { target: "node-candidate" } }],
  startCritiqueSession: [{ verb: "selectItems", args: { targets: ["claim", "evidence"] } }],
  ingestCritique: [
    { verb: "selectItems", args: { targets: ["claim", "evidence"] } },
    { verb: "startCritiqueSession", args: {} },
  ],
  stopCritiqueSession: [
    { verb: "selectItems", args: { targets: ["claim", "evidence"] } },
    { verb: "startCritiqueSession", args: {} },
  ],
  publishCognitivePackage: [
    { verb: "createSignedPackage", args: { namespace: "runtime.audit", name: "evidence-tools", version: "1.0.0", artifactIds: ["op-a"], visibility: "private" } },
  ],
  applyHigherOrderPatch: [
    { verb: "proposeHigherOrderPatch", args: { artifact: "op-a", purpose: "Require evidence for every claim" } },
  ],
  disablePersonalCommand: [
    { verb: "teachPersonalCommand", args: { trigger: "runtime founder pass", command: "openCognitiveWorkflowStudio", scope: "workspace" } },
  ],
  forgetPersonalCommand: [
    { verb: "teachPersonalCommand", args: { trigger: "runtime founder pass", command: "openCognitiveWorkflowStudio", scope: "workspace" } },
  ],
  reviewCognitiveCandidate: [
    { verb: "openCognitivePullRequest", args: { source: "claim", kinds: ["move", "function", "lens"] } },
  ],
  mergeCognitivePullRequest: [
    { verb: "openCognitivePullRequest", args: { source: "claim", kinds: ["move", "function", "lens"] } },
    { verb: "reviewCognitiveCandidate", args: { requestId: "last", candidateId: "first", decision: "accept" } },
  ],
};

const readOnlyJustification = {
  caption: "Visual caption only; typed completion and animation are the observable result.",
  pause: "Timing control only; typed completion is the intended result.",
  waitForJobs: "Synchronization barrier only; completion without fabricated work is the result.",
  previewBrushQueue: "Read-only compatibility preview; typed preview is the expected artifact.",
  previewLensComposition: "Read-only composition preview; typed preview is the expected artifact.",
  testGrindDraft: "Read-only holdout evaluation; typed test results are the expected artifact.",
  runFunctionTestBench: "Read-only structural, fixture, holdout, dependency, and rubric report is the expected artifact.",
  inspectGenerationPlan: "Read-only generation-plan inspection; typed plan and visible editor are the expected artifacts.",
  observeWorkspace: "Read-only bounded semantic observation; the typed snapshot is the expected artifact.",
  inspectTasteLens: "Read-only inspection opens the real Lens editor and returns its versioned facets.",
  evaluateThroughTasteLens: "Evaluation materializes linked feedback and preserves the original material.",
};
const expectedSafeBlockers = {
  publishCognitivePackage: /sign in is required to publish/i,
  installCognitivePackage: /choose a complete signed package manifest/i,
  rollbackCognitivePackage: /no package install checkpoint is available/i,
  deprecateCognitivePackage: /sign in is required to deprecate/i,
};
const sharedPathCapabilities = new Set([
  "stepSharedPath",
  "noteSharedPath",
  "branchSharedPath",
  "materializeSharedPath",
  "leaveSharedPath",
]);
let sharedPathUrl = null;

function argsFor(capability) {
  const base = Object.fromEntries(
    Object.entries(capability.args)
      .filter(([, type]) => !type.endsWith("?"))
      .map(([name, type]) => [name, requiredFixture(type)])
  );
  return { ...base, ...(argsByName[capability.name] || {}) };
}

function canonicalPlan(capability, args) {
  return {
    version: 1,
    title: capability.examples[0],
    root: {
      kind: "action",
      id: `audit-${capability.name}`,
      capability: capability.name,
      args,
      ...(capability.confirmation === "framework" ? { confirmed: true } : {}),
    },
  };
}

async function snapshot(page) {
  return page.evaluate(() => {
    const storage = {};
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith("lens.")) storage[key] = localStorage.getItem(key);
    }
    const visible = [...document.querySelectorAll(
      ".page-title-input,.page-title-chip,.companion-confirmation,.extension-download-modal,.lens-editor-overlay,.path-walk,.walk-overlay,.brush-status,.highlight-toolbar,.omni-highlight-bar,[aria-pressed='true'],.selected"
    )].map((node) => `${node.tagName}:${node.className}:${node.textContent?.trim().slice(0, 120)}`);
    const beforeAfter = [...document.querySelectorAll(
      "[data-before-after-editor] input,[data-before-after-editor] textarea,[data-before-after-editor] button,.ba-result,.ba-example"
    )].map((node) => `${node.tagName}:${node.getAttribute("aria-label") || ""}:${"value" in node ? node.value : node.textContent?.trim().slice(0, 160)}`);
    const transcript = [...document.querySelectorAll(
      ".learn-chat-modal input,.learn-chat-modal textarea,.learn-chat-modal button,.learn-chat-results,.learn-chat-stats"
    )].map((node) => `${node.tagName}:${node.getAttribute("aria-label") || ""}:${"value" in node ? node.value : node.textContent?.trim().slice(0, 160)}`);
    return { storage, visible, beforeAfter, transcript, url: location.href };
  });
}

function stable(value) {
  return JSON.stringify(value);
}

async function installModelRoute(page, stats, plannedResponse = null) {
  await page.route("**/api/lens-encode", async (route) => {
    stats.calls += 1;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        name: "Audit Lens",
        description: "Grounded runtime Lens",
        contextPolicy: "bounded",
        proposedPerceptualModel: {
          version: 1,
          sections: { notice: [{ id: "notice-runtime", text: "Primary claims", status: "provisional", source: "inferred", confidence: 0.9 }] },
        },
        diff: [{ id: "notice-runtime", section: "notice", type: "added", after: { text: "Primary claims" } }],
        provenance: { requestedModel: "auto", resolvedModel: "runtime/model", providerRoute: "mock" },
      }),
    });
  });
  await page.route("**/api/infer-transcript-artifacts", async (route) => {
    stats.calls += 1;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        transcript: { source: "runtime-audit", messageCount: 2, fingerprint: "runtime-transcript" },
        candidates: {
          move: { supported: true, name: "Verify", prompt: "Verify primary sources.", confidence: .9, evidenceRefs: [1], alternatives: [{ name: "Source check", prompt: "Check cited sources." }] },
          function: { supported: true, name: "Research", steps: [{ name: "Collect" }, { name: "Compare" }], confidence: .8, evidenceRefs: [1, 2] },
          lens: { supported: true, name: "Evidence-first", material: [{ content: "Prefer primary evidence." }], confidence: .8, evidenceRefs: [2] },
        },
      }),
    });
  });
  await page.route("**/api/infer-transformation", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        specification: {
          name: "Runtime learned lens",
          summary: "I think this transformation structures raw notes.",
          operation: "Structure raw notes into a concise summary while preserving facts.",
          invariants: ["Preserve facts"],
          changes: ["Improve structure"],
          inputRequirements: ["Text input"],
          outputSpec: {
            version: 1,
            mode: "custom",
            semanticType: "structured summary",
            machineKind: "text",
            description: "A structured summary of the source notes.",
            instructions: "Preserve facts and improve structure.",
            schema: null,
            cardinality: { min: 1, max: 1 },
            branches: [],
          },
          modality: { input: ["text"], output: ["text"], constraints: [] },
          ambiguity: "",
          confidence: 0.9,
          alternatives: [
            { name: "Concise notes", operation: "Compress notes.", rationale: "Alternative hypothesis" },
          ],
        },
        exampleCount: 1,
        examplesPrivate: true,
        model: "runtime-audit",
      }),
    });
  });
  await page.route("**/api/run", async (route) => {
    stats.calls += 1;
    const body = JSON.parse(route.request().postData() || "{}");
    if (body.prompt === "Create the validated action plan for this request." && plannedResponse) {
      stats.plannerCalls += 1;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ outputs: [JSON.stringify(plannedResponse)] }),
      });
      return;
    }
    const prompt = String(body.prompt || "");
    stats.effectCalls += 1;
    let output = "Runtime audit transformed output.";
    if (/forge|transformation examples|generalize/i.test(prompt)) {
      output = JSON.stringify({
        name: "Forged runtime lens",
        description: "Derived from runtime examples",
        rules: ["Preserve meaning", "Apply the learned change"],
        prompt: "Apply the learned transformation faithfully.",
      });
    } else if (/rewrite|edit.*function|lens tree/i.test(prompt)) {
      output = JSON.stringify({
        name: "Edited audit lens",
        description: "Rewritten by runtime audit",
        prompt: "Compare evidence faithfully.",
      });
    } else if (/candidate|probe/i.test(prompt)) {
      output = "Candidate one\n---OUTPUT---\nCandidate two";
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ outputs: [output] }),
    });
  });
}

async function runAppCapability(browser, capability) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  const pageErrors = [];
  const modelStats = { calls: 0, plannerCalls: 0, effectCalls: 0 };
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const args = argsFor(capability);
  const plannedResponse = canonicalPlan(capability, args);
  await installModelRoute(page, modelStats, plannedResponse);
  await page.route("**/api/models", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ models: [] }),
  }));
  await page.addInitScript(seedScript, { items, nodes, operators, repos, generators });
  const started = performance.now();
  try {
    validateCapabilityArgs(capability, args);
    parseCompanionPlan(JSON.stringify(canonicalPlan(capability, args)));
    const targetUrl = auditUrl(sharedPathCapabilities.has(capability.name) && sharedPathUrl ? sharedPathUrl : BASE);
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    try {
      await page.waitForSelector(".canvas-column-main", { timeout: 15_000 });
    } catch {
      await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.waitForSelector(".canvas-column-main", { timeout: 60_000 });
    }
    await page.waitForFunction(() => window.__lensDirector?.run, null, { timeout: 60_000 });
    const setup = setupByName[capability.name] || [];
    if (setup.length) {
      for (const step of setup) {
        const setupResult = await page.evaluate(
          (targetStep) => window.__lensDirector.run([targetStep], { title: "runtime audit setup", speed: 3 }),
          step
        );
        if (!setupResult.completed) throw new Error(`setup failed: ${setupResult.errors.join(" | ")}`);
        await page.waitForTimeout(100);
      }
    }
    await page.waitForTimeout(80);
    const before = await snapshot(page);
    const effectCallsBefore = modelStats.effectCalls;
    await page.evaluate(() => {
      window.__lensDirector.clearTraces();
      window.__lensDirector.clearDirectEffects?.();
    });
    let dispatchCount = 0;
    if (INPUT_PATH === "visible") {
      await page.evaluate(() => {
        window.__companionVisibleAuditRuns = 0;
        window.addEventListener("lens:companion-run", () => {
          window.__companionVisibleAuditRuns += 1;
        }, { once: true });
      });
      const fab = page.locator(".companion-fab");
      if (await fab.isVisible()) await fab.click();
      const input = page.locator(".companion-input");
      await input.fill(capability.examples[0]);
      await input.press("Enter");
      await page.waitForFunction(() => {
        const inputNode = document.querySelector(".companion-input");
        const traces = window.__lensDirector?.traces?.();
        return inputNode && !inputNode.disabled && !traces?.active;
      }, null, { timeout: 30_000 });
      const confirm = page.getByTestId("companion-clear-confirm");
      if (await confirm.isVisible().catch(() => false)) await confirm.click();
      dispatchCount = await page.evaluate(() => window.__companionVisibleAuditRuns);
    } else {
      await page.evaluate(
        ({ name, args: targetArgs }) =>
          window.__lensDirector.run([{ verb: name, args: targetArgs }], {
            title: `runtime audit · ${name}`,
            speed: 3,
          }),
        { name: capability.name, args }
      );
    }
    await page.waitForTimeout(
      ["applyArmedBrush", "pressBrushGo", "saveLearnedFunction"].includes(capability.name) ? 2600 : 650
    );
    const after = await snapshot(page);
    const trace = await page.evaluate(() => window.__lensDirector.traces().completed.at(-1) || null);
    const directEffect = await page.evaluate(() => window.__lensDirector.directEffects?.().at(-1) || null);
    const ledger = await page.evaluate(() => JSON.parse(
      localStorage.getItem("lens.companion.command-ledger.v1") || "{\"entries\":[]}"
    ).entries.at(-1) || null);
    const value = directEffect?.resultType
      ? { type: directEffect.resultType }
      : trace?.events?.findLast?.((event) => event.type === "step-complete")?.resultType
      ? { type: trace.events.findLast((event) => event.type === "step-complete").resultType }
      : null;
    const execution = {
      completed: directEffect ? directEffect.status === "completed" : trace?.status === "completed",
      errors: directEffect?.error
        ? [directEffect.error]
        : trace?.events?.filter((event) => event.type === "step-failed").map((event) => event.error) || [],
      value,
    };
    const typedResult = Boolean(value && typeof value === "object" && typeof value.type === "string");
    const changed = stable(before) !== stable(after);
    const modelDispatched = modelStats.effectCalls > effectCallsBefore;
    const justifiedReadOnly = readOnlyJustification[capability.name] || null;
    const observable = changed || modelDispatched || Boolean(justifiedReadOnly);
    const messages = INPUT_PATH === "visible"
      ? await page.locator(".companion-msg").allTextContents()
      : [];
    const rawErrorLeak = messages.some((message) =>
      /plan\.root|supported workspace query|is not accepted by|referenceerror|is not defined|schema/i.test(message)
    );
    const safelyBlocked = Boolean(
      expectedSafeBlockers[capability.name]?.test(execution.errors.join(" ")) &&
      pageErrors.length === 0 &&
      !rawErrorLeak
    );
    const passed = (execution.completed && typedResult && observable || safelyBlocked) && pageErrors.length === 0 &&
      (INPUT_PATH !== "visible" || (dispatchCount === 1 && !rawErrorLeak));
    if (process.env.AUDIT_SCREENSHOTS === "1") {
      await page.screenshot({ path: path.join(OUT, `${capability.name}.png`), fullPage: true });
    }
    return {
      name: capability.name,
      platform: "app",
      utterance: capability.examples[0],
      args,
      planner: INPUT_PATH === "visible"
        ? "visible CompanionChat input → deterministic route or controlled adaptive planner → validated plan"
        : "canonical adaptive plan parsed and validated",
      schema: "pass",
      runtimeHandler: execution.completed ? "invoked" : safelyBlocked ? "safely-blocked" : "failed",
      typedResult: typedResult ? value.type : safelyBlocked ? "safe-blocker" : null,
      observableEffect: changed
        ? "state-or-visible-artifact-changed"
        : modelDispatched
          ? "bounded model execution dispatched and returned"
          : justifiedReadOnly || (safelyBlocked ? "precise setup or authentication boundary before mutation" : null),
      persistence: changed ? "local store or visible runtime state observed" : safelyBlocked ? "zero mutation before blocker" : "not-applicable",
      animation: trace
        ? {
            version: trace.version,
            traceId: trace.id,
            status: trace.status,
            events: trace.events.length,
            reducedMotion: trace.reducedMotion,
          }
        : null,
      directExecution: directEffect
        ? {
            id: directEffect.id,
            status: directEffect.status,
            capability: directEffect.capability,
            resultType: directEffect.resultType,
            effects: directEffect.effects,
          }
        : null,
      dispatchCount: INPUT_PATH === "visible" ? dispatchCount : null,
      ledgerStatus: ledger?.status || null,
      rawErrorLeak,
      status: passed ? "passed" : "failed",
      durationMs: Math.round(performance.now() - started),
      errors: [...execution.errors, ...pageErrors],
      ...(typedResult ? {} : { debugExecution: execution }),
    };
  } catch (error) {
    const debugState = await page.evaluate(() => ({
      input: (() => {
        const node = document.querySelector(".companion-input");
        return node ? { disabled: node.disabled, value: node.value, connected: node.isConnected } : null;
      })(),
      progress: document.querySelector(".companion-progress")?.textContent?.trim() || null,
      plan: document.querySelector(".companion-plan-strip")?.textContent?.trim() || null,
      editor: Boolean(document.querySelector("[data-before-after-editor],.fn-editor-fullscreen")),
      trace: window.__lensDirector?.traces?.() || null,
      messages: [...document.querySelectorAll(".companion-msg")].map((node) => node.textContent?.trim()).slice(-4),
    })).catch(() => null);
    return {
      name: capability.name,
      platform: "app",
      utterance: capability.examples[0],
      args,
      planner: "canonical adaptive plan",
      schema: "unknown",
      runtimeHandler: "failed",
      typedResult: null,
      observableEffect: null,
      persistence: null,
      animation: null,
      status: "failed",
      durationMs: Math.round(performance.now() - started),
      errors: [error.message, ...pageErrors],
      debugState,
    };
  } finally {
    await page.close();
  }
}

async function runExtensionCapabilities() {
  const rows = [];
  for (const capability of selectedExtensionCapabilities) {
    const args = argsFor(capability);
    const events = [];
    const state = {
      lastAction: null,
      highlighter: false,
      queuedLens: null,
      generator: null,
      previewed: false,
      go: false,
      copied: null,
      operation: null,
      artifact: false,
      importShown: false,
      orbCursor: false,
    };
    const resultRecord = { id: "result-a", text: "Runtime extension result", machineKind: "text", outputSpec: { machineKind: "text" } };
    const context = {
      confirmed: capability.approval?.required === true,
      approvalScope: capability.approval?.scope === "external-write" ? "runtime verified page target" : "runtime fixture",
      idempotencyKey: `runtime:${capability.name}`,
      animate: async (event) => events.push(event.path),
      action: async (type, payload = {}) => {
        events.push(type);
        state.lastAction = type;
        if (type === "toggle-highlighter") state.highlighter = payload.enabled;
        if (type === "queue-lens") state.queuedLens = payload.lens.id;
        if (type === "set-generator") state.generator = payload.generator.id;
        if (type === "result-action") state.operation = payload.plan.operation;
        if (type === "open-artifact") state.artifact = true;
        return { type: "extension-action", action: type };
      },
      resolveLens: () => ({ id: "lens-a", name: "Audit lens" }),
      resolveGenerator: () => ({ id: "generator-a", title: "Audit generator" }),
      resolveResult: () => resultRecord,
      readPreview: () => {
        state.previewed = true;
        return { type: "extension-preview", outputs: 1 };
      },
      pressGo: async () => {
        state.go = true;
        return { type: "extension-run", outputs: [resultRecord] };
      },
      showImport: () => {
        state.importShown = true;
        return { type: "extension-import-review" };
      },
      browsePackages: () => {
        state.operation = "browse-packages";
        return { type: "package-list", packages: [] };
      },
      installPackage: () => {
        state.operation = "install-package";
        return { type: "package-install-receipt", package: "runtime.audit/evidence-tools@1.0.0", verified: true };
      },
      openBeforeAfter: () => {
        state.operation = "open-before-after";
        return { type: "extension-before-after-draft" };
      },
      setBeforeAfterText: (side, text) => {
        state.operation = `set-${side}:${text}`;
        return { type: "extension-before-after-draft" };
      },
      inferBeforeAfter: () => {
        state.operation = "infer-before-after";
        return { type: "extension-before-after-inference" };
      },
      openSaveAs: () => {
        state.operation = "open-save-as";
        return { type: "extension-save-as" };
      },
      saveCaptureAs: (kind) => {
        state.operation = `save-${kind}`;
        return { type: kind, id: `saved-${kind}` };
      },
      toggleOrbCursor: (enabled = true) => {
        state.orbCursor = enabled;
        return { type: "orb-cursor-state", enabled };
      },
    };
    const originalNavigator = globalThis.navigator;
    if (!globalThis.navigator) Object.defineProperty(globalThis, "navigator", { value: {}, configurable: true });
    const originalClipboard = globalThis.navigator.clipboard;
    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: { writeText: async (text) => { state.copied = text; return { type: "clipboard-write" }; } },
      configurable: true,
    });
    try {
      validateCapabilityArgs(capability, args);
      const plan = canonicalPlan(capability, args);
      parseCompanionPlan(JSON.stringify(plan));
      const result = await executeExtensionVerb(capability.name, args, context);
      const typed = Boolean(result && typeof result === "object" && typeof result.type === "string");
      const effect = Object.values(state).some((value) => value === true || typeof value === "string");
      rows.push({
        name: capability.name,
        platform: "extension",
        utterance: capability.examples[0],
        args,
        planner: (() => {
          try {
            return parseExtensionIntent(capability.examples[0]).name === capability.name
              ? "deterministic extension intent"
              : "canonical extension plan";
          } catch {
            return "canonical extension plan";
          }
        })(),
        schema: "pass",
        runtimeHandler: "invoked",
        typedResult: typed ? result.type : null,
        observableEffect: effect ? "controlled extension state changed" : null,
        persistence: "extension action boundary observed",
        animation: events.at(-1) === "orb-effect-trace" ? "verified orb effect trace completed" : null,
        status: typed && effect && events.at(-1) === "orb-effect-trace" ? "passed" : "failed",
        errors: [],
      });
    } catch (error) {
      rows.push({
        name: capability.name,
        platform: "extension",
        utterance: capability.examples[0],
        args,
        planner: "canonical extension plan",
        schema: "unknown",
        runtimeHandler: "failed",
        typedResult: null,
        observableEffect: null,
        persistence: null,
        animation: null,
        status: "failed",
        errors: [error.message],
      });
    } finally {
      if (originalClipboard === undefined) delete globalThis.navigator.clipboard;
      else Object.defineProperty(globalThis.navigator, "clipboard", { value: originalClipboard, configurable: true });
      if (originalNavigator === undefined) delete globalThis.navigator;
    }
  }
  return rows;
}

async function createSharedPathUrl(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  try {
    await page.addInitScript(seedScript, { items, nodes, operators, repos, generators });
    await page.goto(auditUrl(BASE), { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForFunction(() => window.__lensPathShare?.share, null, { timeout: 60_000 });
    return await page.evaluate(() => window.__lensPathShare.share("node-child"));
  } finally {
    await page.close();
  }
}

const browser = await chromium.launch({
  ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
});
const appRows = [];
try {
  sharedPathUrl = await createSharedPathUrl(browser);
  for (const [index, capability] of selectedAppCapabilities.entries()) {
    const row = await runAppCapability(browser, capability);
    appRows.push(row);
    console.log(`${row.status === "passed" ? "PASS" : "FAIL"} ${index + 1}/${selectedAppCapabilities.length} ${row.name}${row.errors?.length ? ` — ${row.errors.join(" | ")}` : ""}`);
  }
} finally {
  await browser.close();
}
const extensionRows = await runExtensionCapabilities();
extensionRows.forEach((row, index) => {
  console.log(`${row.status === "passed" ? "PASS" : "FAIL"} ext ${index + 1}/${extensionRows.length} ${row.name}${row.errors?.length ? ` — ${row.errors.join(" | ")}` : ""}`);
});

const rows = [...appRows, ...extensionRows];
const counts = {
  total: rows.length,
  passed: rows.filter((row) => row.status === "passed").length,
  failed: rows.filter((row) => row.status === "failed").length,
  skipped: rows.filter((row) => row.status === "skipped").length,
  app: appRows.length,
  extension: extensionRows.length,
};
const output = {
  generatedAt: new Date().toISOString(),
  harness: INPUT_PATH === "visible"
    ? "visible CompanionChat input with controlled planner and real director handlers"
    : "controlled real director/extension handler execution",
  inputPath: INPUT_PATH,
  counts,
  rows,
};
fs.writeFileSync(path.join(OUT, "capability-execution-matrix.json"), JSON.stringify(output, null, 2));
fs.writeFileSync(path.join(OUT, "capability-execution-matrix.md"), `# Companion capability runtime-effect matrix

- Total: ${counts.total}
- Passed: ${counts.passed}
- Failed: ${counts.failed}
- Skipped: ${counts.skipped}

${rows.map((row) => `- ${row.status === "passed" ? "PASS" : row.status === "skipped" ? "SKIP" : "FAIL"} — \`${row.name}\` (${row.platform}): ${row.observableEffect || row.errors.join(" | ")}`).join("\n")}
`);
console.log(JSON.stringify(counts));
if (counts.failed || counts.skipped || (!requestedNames.size && counts.total !== COMPANION_CAPABILITIES.length)) process.exitCode = 1;

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
const OUT = path.resolve("audit-shots/companion-release-audit-2026-07");
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
  { id: "op-a", name: "Audit lens", kind: "prompt", prompt: "Transform.", top: true, outputSpec: { version: 1, mode: "suggested", semanticType: "text", machineKind: "text", cardinality: { min: 1, max: 1 }, branches: [] } },
  { id: "op-b", name: "Second lens", kind: "prompt", prompt: "Compare.", top: true },
  { id: "op-branch", name: "Branch lens", kind: "prompt", prompt: "Branch.", top: true, outputSpec: multiOutputSpec, outputCount: 2 },
  { id: "op-pipeline", name: "Pipeline lens", kind: "pipeline", steps: ["op-step"], top: true },
  { id: "op-step", name: "First step", kind: "prompt", prompt: "First.", parentId: "op-pipeline" },
];
const repos = operators
  .filter((entry) => entry.top)
  .map((entry) => ({ id: `repo-${entry.id}`, opId: entry.id, name: entry.name, moveIds: [entry.id], version: 1, commits: [] }));
const generators = [
  { id: "generator-a", title: "Audit generator", kind: "idea", items: [], savedAt: 1 },
];

function seedScript(payload) {
  const { items, nodes, operators, repos, generators } = payload;
  if (localStorage.getItem("lens.runtime-audit.seeded") === "1") return;
  localStorage.clear();
  localStorage.setItem("lens.runtime-audit.seeded", "1");
  localStorage.setItem("lens.onboarded.v1", "1");
  localStorage.setItem("lens.tour.v1", "1");
  localStorage.setItem("lens.companion.seen.v1", "1");
  localStorage.setItem("lens.board.pages.v1", JSON.stringify([{ id: "page-main", name: "Runtime audit" }]));
  localStorage.setItem("lens.doc.title.v1", "Runtime audit");
  localStorage.setItem("lens.board.items.v1", JSON.stringify(items));
  localStorage.setItem("lens.ai.nodes.v1", JSON.stringify(nodes));
  localStorage.setItem("lens.unified-workspace.v2", JSON.stringify({
    version: 3,
    camera: { x: 100, y: 40, scale: 0.7 },
    items,
    nodes,
  }));
  localStorage.setItem("lens.board.operators.v2", JSON.stringify(operators));
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
  createFunction: { name: "Runtime-created lens", steps: [{ name: "Observe" }, { name: "Synthesize" }] },
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
  armLensBrush: { lens: "op-a" },
  armGeneratorBrush: { generator: "generator-a" },
  queueBrushLens: { lens: "op-a" },
  setBrushGeneratorDestination: { generator: "generator-a", mode: "source" },
  reorderBrushQueue: { from: 0, to: 1 },
  removeBrushQueue: { index: 0 },
  captureThread: { target: "derived", name: "Captured runtime path" },
  moveItem: { target: "claim", dx: 80, dy: 30 },
  editItem: { target: "claim", text: "Edited by runtime audit" },
  deleteItem: { target: "evidence" },
  selectItems: { targets: ["claim", "evidence"] },
  addBlock: { type: "sticky", text: "Runtime block" },
  renamePage: { name: "Renamed runtime page" },
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
  forkLens: { lens: "Audit lens", message: "runtime fork" },
  mergeLenses: { a: "Audit lens", b: "Second lens", name: "Runtime merged lens" },
  previewLensComposition: { a: "op-a", b: "op-b" },
  stackLenses: { a: "op-a", b: "op-b", name: "Runtime stack" },
  saveCompoundLens: { edit: false },
  addGrindExample: { input: "Before example", output: "After example", note: "runtime" },
  removeGrindExample: { example: "last" },
  reorderGrindExample: { example: "last", to: 0 },
  refineGrindDraft: { instruction: "Tighten the rule" },
  rackSearch: { query: "Audit" },
  rackFilter: { type: "all", sort: "recent" },
  pinLens: { lens: "op-a", pinned: true },
  archiveLens: { lens: "op-a" },
  restoreLens: { lens: "op-a" },
  editLensByInstruction: { op: "op-a", instruction: "Make the lens compare evidence" },
  newGenerator: {},
  attachToGenerator: { generator: "generator-a", target: "claim" },
  graduateGenerator: { generator: "generator-a", name: "Graduated runtime generator" },
  probeGenerator: { generator: "generator-a", domain: "music" },
  makeLensFromGenerator: { generator: "generator-a" },
  clearWorkspaceDomains: { domains: ["paper", "ai"] },
};

const setupByName = {
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
    { verb: "queueBrushLens", args: { lens: "op-a" } },
  ],
  reorderBrushQueue: [
    { verb: "queueBrushLens", args: { lens: "op-a" } },
    { verb: "queueBrushLens", args: { lens: "op-b" } },
  ],
  removeBrushQueue: [{ verb: "queueBrushLens", args: { lens: "op-a" } }],
  previewBrushQueue: [{ verb: "queueBrushLens", args: { lens: "op-a" } }],
  pressBrushGo: [
    { verb: "highlight", args: { targets: ["claim"] } },
    { verb: "queueBrushLens", args: { lens: "op-a" } },
  ],
  cancelPendingBrush: [{ verb: "queueBrushLens", args: { lens: "op-a" } }],
  saveBrushQueueAsLens: [
    { verb: "queueBrushLens", args: { lens: "op-a" } },
    { verb: "queueBrushLens", args: { lens: "op-b" } },
  ],
  makeHighlightNode: [{ verb: "highlight", args: { targets: ["claim", "evidence"] } }],
  clearHighlight: [{ verb: "highlight", args: { targets: ["claim"] } }],
  saveCompoundLens: [{ verb: "stackLenses", args: { a: "op-a", b: "op-b", name: "Runtime stack" } }],
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
  shapeForgedLens: [
    { verb: "addGrindExample", args: { input: "Before one", output: "After one" } },
    { verb: "addGrindExample", args: { input: "Before two", output: "After two" } },
    { verb: "compileGrindDraft", args: {} },
  ],
  restoreLens: [{ verb: "archiveLens", args: { lens: "op-a" } }],
};

const readOnlyJustification = {
  caption: "Visual caption only; typed completion and animation are the observable result.",
  pause: "Timing control only; typed completion is the intended result.",
  waitForJobs: "Synchronization barrier only; completion without fabricated work is the result.",
  previewBrushQueue: "Read-only compatibility preview; typed preview is the expected artifact.",
  previewLensComposition: "Read-only composition preview; typed preview is the expected artifact.",
  testGrindDraft: "Read-only holdout evaluation; typed test results are the expected artifact.",
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
      ".page-title-input,.page-title-chip,.companion-confirmation,.extension-download-modal,.lens-editor-overlay,.path-walk,.walk-overlay,.brush-status,.highlight-toolbar,[aria-pressed='true'],.selected"
    )].map((node) => `${node.tagName}:${node.className}:${node.textContent?.trim().slice(0, 120)}`);
    const beforeAfter = [...document.querySelectorAll(
      "[data-before-after-editor] input,[data-before-after-editor] textarea,[data-before-after-editor] button,.ba-result,.ba-example"
    )].map((node) => `${node.tagName}:${node.getAttribute("aria-label") || ""}:${"value" in node ? node.value : node.textContent?.trim().slice(0, 160)}`);
    return { storage, visible, beforeAfter, url: location.href };
  });
}

function stable(value) {
  return JSON.stringify(value);
}

async function installModelRoute(page, stats) {
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
    const prompt = String(body.prompt || "");
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
  const modelStats = { calls: 0 };
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await installModelRoute(page, modelStats);
  await page.addInitScript(seedScript, { items, nodes, operators, repos, generators });
  const args = argsFor(capability);
  const started = performance.now();
  try {
    validateCapabilityArgs(capability, args);
    parseCompanionPlan(JSON.stringify(canonicalPlan(capability, args)));
    await page.goto(sharedPathCapabilities.has(capability.name) && sharedPathUrl ? sharedPathUrl : BASE);
    await page.waitForSelector(".canvas-column-main");
    await page.waitForFunction(() => window.__lensDirector?.run);
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
    const modelCallsBefore = modelStats.calls;
    const execution = await page.evaluate(
      ({ name, args: targetArgs }) =>
        window.__lensDirector.run([{ verb: name, args: targetArgs }], {
          title: `runtime audit · ${name}`,
          speed: 3,
        }),
      { name: capability.name, args }
    );
    await page.waitForTimeout(
      ["applyArmedBrush", "pressBrushGo", "saveLearnedFunction"].includes(capability.name) ? 2600 : 650
    );
    const after = await snapshot(page);
    const value = execution.value;
    const typedResult = Boolean(value && typeof value === "object" && typeof value.type === "string");
    const changed = stable(before) !== stable(after);
    const modelDispatched = modelStats.calls > modelCallsBefore;
    const justifiedReadOnly = readOnlyJustification[capability.name] || null;
    const observable = changed || modelDispatched || Boolean(justifiedReadOnly);
    const passed = execution.completed && typedResult && observable && pageErrors.length === 0;
    return {
      name: capability.name,
      platform: "app",
      utterance: capability.examples[0],
      args,
      planner: "canonical adaptive plan parsed and validated",
      schema: "pass",
      runtimeHandler: execution.completed ? "invoked" : "failed",
      typedResult: typedResult ? value.type : null,
      observableEffect: changed
        ? "state-or-visible-artifact-changed"
        : modelDispatched
          ? "bounded model execution dispatched and returned"
          : justifiedReadOnly,
      persistence: changed ? "local store or visible runtime state observed" : "not-applicable",
      animation: "director-ghost-cursor completed",
      status: passed ? "passed" : "failed",
      durationMs: Math.round(performance.now() - started),
      errors: [...execution.errors, ...pageErrors],
      ...(typedResult ? {} : { debugExecution: execution }),
    };
  } catch (error) {
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
    };
    const resultRecord = { id: "result-a", text: "Runtime extension result", machineKind: "text", outputSpec: { machineKind: "text" } };
    const context = {
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
        animation: events[0] === "director-ghost-cursor" ? "director-ghost-cursor completed" : null,
        status: typed && effect && events[0] === "director-ghost-cursor" ? "passed" : "failed",
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
    await page.goto(BASE);
    await page.waitForFunction(() => window.__lensPathShare?.share);
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
  harness: "controlled real director/extension handler execution",
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

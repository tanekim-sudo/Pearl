/**
 * Canonical public surface the companion may plan against.
 * Every entry must correspond to a real director verb registered by App.
 */
export const COMPANION_CAPABILITIES = [
  ["caption", {}, false, ["interface"], "Explain an action while it happens"],
  ["pause", { ms: "number?" }, false, ["interface"], "Pause between visible actions"],
  ["switchTool", { tool: "string" }, false, ["interface", "paper"], "Select a canvas tool"],
  ["fitPaper", {}, false, ["paper", "interface"], "Fit the paper in view"],
  ["spawnText", { text: "string", saveAs: "string?", caption: "string?" }, false, ["paper"], "Create text on paper"],
  ["createFunction", { name: "string", description: "string?", steps: "array", saveAs: "string?" }, false, ["lens"], "Create a reusable transformation lens"],
  ["applyFunction", { op: "string", target: "string" }, false, ["lens", "paper", "ai"], "Apply a lens to paper material"],
  ["dragItemToAi", { target: "string" }, false, ["paper", "ai"], "Transfer paper material into AI space"],
  ["applyFunctionToAiNode", { op: "string" }, false, ["lens", "ai"], "Branch an AI node through a lens"],
  ["focusAiResult", {}, false, ["ai", "interface"], "Focus the latest AI result"],
  ["dragAiResultToPaper", {}, false, ["ai", "paper"], "Keep an AI result on paper"],
  ["highlight", { targets: "array" }, false, ["highlight", "paper"], "Highlight paper material"],
  ["captureThread", { target: "string?", name: "string?" }, false, ["lens", "paper", "ai"], "Save the selected node's full lineage as a lens"],
  ["showLenses", {}, false, ["generator", "interface"], "Open the generators rail"],
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
  ["moveAiNode", { target: "string?", dx: "number?", dy: "number?" }, false, ["ai"], "Move an AI node"],
  ["openFunctionEditor", { op: "string" }, false, ["lens", "interface"], "Open a lens in the editor"],
  ["editFunction", { op: "string", name: "string?", description: "string?", prompt: "string?" }, false, ["lens"], "Edit lens metadata or prompt"],
  ["addFunctionStep", { op: "string", name: "string?", prompt: "string?", description: "string?", after: "string?", use: "string?" }, false, ["lens"], "Add a step to a lens"],
  ["addFunctionBranch", { op: "string", from: "string?", name: "string", prompt: "string?" }, false, ["lens"], "Add a branch to a lens"],
  ["setFunctionStep", { op: "string", step: "string", name: "string?", prompt: "string?", description: "string?" }, false, ["lens"], "Edit a lens step"],
  ["saveFunction", { op: "string", message: "string?" }, false, ["lens"], "Commit edits to a lens"],
  ["forkLens", { lens: "string", message: "string?" }, false, ["lens"], "Fork a lens"],
  ["mergeLenses", { a: "string", b: "string" }, false, ["lens"], "Merge two lenses"],
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
].map(([name, args, destructive, domains, purpose]) => ({ name, args, destructive, domains, purpose }));

export const COMPANION_VERBS = Object.fromEntries(
  COMPANION_CAPABILITIES.map(({ name, args, destructive, domains, purpose }) => [
    name,
    { args, destructive, domains, purpose },
  ])
);

export function capabilityPrompt() {
  return COMPANION_CAPABILITIES.map(
    (capability) =>
      `- ${capability.name}(${Object.entries(capability.args).map(([key, type]) => `${key}: ${type}`).join(", ")}) — ${capability.purpose}${capability.destructive ? " [confirmation required]" : ""}`
  ).join("\n");
}

export function validateCapabilityNames(registeredNames) {
  const documented = new Set(COMPANION_CAPABILITIES.map((entry) => entry.name));
  const registered = new Set(registeredNames);
  return {
    undocumented: [...registered].filter((name) => !documented.has(name)),
    unregistered: [...documented].filter((name) => !registered.has(name)),
  };
}

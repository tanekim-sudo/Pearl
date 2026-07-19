import { EXTENSION_COMPANION_CAPABILITIES } from "../../../client/lib/companion-capabilities.js";
import { validateCapabilityArgs } from "../../../client/lib/companion-plan.js";

export const EXTENSION_VERBS = Object.freeze({
  capturePageSelection: ({ action }) => action("capture-selection"),
  openExternalSaveAs: ({ openSaveAs }) => openSaveAs(),
  saveExternalCaptureAsMove: ({ saveCaptureAs }) => saveCaptureAs("move"),
  saveExternalCaptureAsFunction: ({ saveCaptureAs }) => saveCaptureAs("function"),
  saveExternalCaptureAsLens: ({ saveCaptureAs }) => saveCaptureAs("lens"),
  togglePageHighlighter: ({ args, action }) => action("toggle-highlighter", { enabled: args.enabled }),
  toggleExternalOrbCursor: async ({ args, toggleOrbCursor }) => {
    const result = await toggleOrbCursor(args.enabled);
    return {
      type: "orb-cursor-state",
      enabled: result?.enabled ?? args.enabled ?? true,
    };
  },
  createExternalSemanticOrb: ({ args, semanticOrbAction }) => semanticOrbAction("create", args),
  openExternalSemanticOrb: ({ args, semanticOrbAction }) => semanticOrbAction("open", args),
  addExternalSemanticOrbContext: ({ args, semanticOrbAction }) => semanticOrbAction("add-context", args),
  applyExternalSemanticOrbLens: ({ args, semanticOrbAction }) => semanticOrbAction("apply-lens", args),
  mergeExternalSemanticOrbs: ({ args, semanticOrbAction }) => semanticOrbAction("merge", args),
  archiveExternalSemanticOrb: ({ args, semanticOrbAction }) => semanticOrbAction("archive", args),
  openExternalSemanticOrbScene: ({ args, action }) => action("open-web-handoff", {
    surface: "semantic-orb-scene",
    orbId: args.id,
    preservePayload: true,
  }),
  queueExternalAction: ({ args, action, resolveLens }) => action("queue-lens", { lens: resolveLens(args.action) }),
  setExternalLensContext: ({ args, action, resolveGenerator }) => action("set-generator", { generator: resolveGenerator(args.lens) }),
  previewExternalGo: ({ readPreview }) => Promise.resolve(readPreview()),
  pressExternalGo: ({ args, pressGo }) => pressGo(args),
  copyExternalResult: ({ args, resolveResult }) => navigator.clipboard.writeText(resolveResult(args.result).text),
  insertExternalResult: ({ args, action, resolveResult }) => {
    const result = resolveResult(args.result);
    return action("result-action", { text: result.text, outputSpec: result.outputSpec, machineKind: result.machineKind, plan: { operation: "insert" } });
  },
  replaceExternalSelection: ({ args, action, resolveResult }) => {
    const result = resolveResult(args.result);
    return action("result-action", { text: result.text, outputSpec: result.outputSpec, machineKind: result.machineKind, plan: { operation: "replace" } });
  },
  annotateExternalResult: ({ args, action, resolveResult }) => action("result-action", { text: resolveResult(args.result).text, plan: { operation: "annotate" } }),
  openExternalArtifact: ({ args, action, resolveResult }) => action("open-artifact", { result: resolveResult(args.result) }),
  showExternalLibraryImport: ({ showImport }) => showImport(),
  browseExternalPackages: ({ browsePackages }) => browsePackages(),
  installExternalPackage: ({ args, installPackage }) => installPackage(args.manifest),
  openExternalCognitiveStudio: ({ args, action }) => action("open-web-handoff", { surface: "cognitive-workflow-studio", tab: args.tab || "integrate", preservePayload: true }),
  teachExternalPersonalCommand: ({ args, action }) => action("personal-command-save", { ...args, sharedResolver: true }),
  openExternalCognitivePullRequest: ({ args, action }) => action("open-cognitive-pull-request", { kinds: args.kinds || ["move", "function", "lens"], captureScope: "explicit-selection", preservePayload: true }),
  openExternalCreativeExtraction: ({ args, action }) => action("open-web-handoff", {
    surface: "cognitive-workflow-studio",
    tab: "pull-request",
    workflow: "research-grounded-creativity",
    goal: args.goal,
    kinds: args.kinds || ["move", "function", "lens"],
    captureScope: "explicit-selection",
    preservePayload: true,
    collectFullPage: false,
  }),
  saveExternalTasteTeaching: ({ args, action }) => action("open-web-handoff", {
    surface: "cognitive-workflow-studio",
    tab: "pull-request",
    workflow: "taste-lens-teaching",
    lens: args.lens,
    teaching: { text: args.text, kind: args.kind || "preference" },
    captureScope: "explicit-selection",
    preservePayload: true,
    collectFullPage: false,
    privateExamples: true,
  }),
  openExternalBeforeAfter: ({ openBeforeAfter }) => openBeforeAfter(),
  setExternalBeforeAfterText: ({ args, setBeforeAfterText }) => setBeforeAfterText(args.side, args.text),
  inferExternalBeforeAfter: ({ inferBeforeAfter }) => inferBeforeAfter(),
  captureExternalVisibleTab: ({ action }) => action("capture-visible-tab", { authorized: true }),
  tasteExternalCandidate: ({ args, action, resolveResult }) => action("taste-feedback", {
    outputId: resolveResult(args.result).id,
    decision: args.decision === "yes" ? "accepted" : args.decision === "no" ? "rejected" : "undecided",
  }),
  startExternalCritique: ({ action }) => action("critique-start"),
  ingestExternalCritique: ({ args, action }) => action("critique-ingest", { text: args.text }),
  stopExternalCritique: ({ action }) => action("critique-stop"),
  composeExternalObjects: ({ args, action }) => action("compose-library-objects", { a: args.a, b: args.b, name: args.name }),
  invokeExternalPrimitive: ({ args, action }) => action("invoke-primitive", {
    primitive: args.primitive,
    targets: args.targets,
    branchSpecs: args.branchSpecs,
  }),
  reorderExternalPrimitive: ({ args, action }) => action("reorder-primitive", { primitive: args.primitive, to: args.to }),
  setExternalGenerationBranches: ({ args, action }) => action("set-generation-branches", {
    artifact: args.artifact,
    branchSpecs: args.branchSpecs,
  }),
  armExternalMerge: ({ args, action }) => action("arm-merge-preview", { targets: args.targets, destructive: false }),
});

export function validateExtensionVerbParity() {
  const documented = new Set(EXTENSION_COMPANION_CAPABILITIES.map((entry) => entry.name));
  const runtime = new Set(Object.keys(EXTENSION_VERBS));
  return {
    undocumented: [...runtime].filter((name) => !documented.has(name)),
    unregistered: [...documented].filter((name) => !runtime.has(name)),
  };
}

export async function executeExtensionVerb(name, args, context) {
  const capability = EXTENSION_COMPANION_CAPABILITIES.find((entry) => entry.name === name);
  const handler = EXTENSION_VERBS[name];
  if (!capability || !handler) throw new Error(`unsupported extension action: ${name}`);
  validateCapabilityArgs(capability, args || {}, `extension.${name}.args`);
  if (capability.approval?.required && !context.confirmed) {
    throw new Error("scoped preview approval required");
  }
  const result = await handler({ ...context, args: args || {} });
  if (result?.ok === false || result?.error) throw new Error(result.error || "extension action failed");
  const effectId = result?.effectId || result?.receipt?.id || `${context.idempotencyKey || name}:effect`;
  const observation = await context.observe?.({ name, args: args || {}, result, effectId });
  if (observation?.verified === false) throw new Error(observation.error || "extension effect could not be verified");
  await context.animate?.({ name, args, result, effectId, path: "orb-effect-trace", mutationAuthority: false });
  if (capability.approval?.scope === "external-write") {
    return {
      type: "external-write-receipt",
      result,
      receipt: {
        id: context.idempotencyKey || `${name}:${JSON.stringify(args || {})}`,
        capability: name,
        scope: context.approvalScope || "current verified page target",
        at: new Date().toISOString(),
        effectId,
      },
    };
  }
  return result && typeof result === "object" ? { ...result, effectId } : { result, effectId };
}

export function parseExtensionIntent(text) {
  const value = String(text || "").trim();
  if (/^(capture|highlight) (this |the )?(selection|text)$/i.test(value)) return { name: "capturePageSelection", args: {} };
  if (/^save (?:this|the selection) as(?:…|\.\.\.)?$/i.test(value)) return { name: "openExternalSaveAs", args: {} };
  if (/^save (?:this|the selected|selected) (?:text|content|selection)? ?as (?:a )?move$/i.test(value)) return { name: "saveExternalCaptureAsMove", args: {} };
  if (/^save (?:this|the selected|selected) (?:text|content|selection)? ?as (?:a )?(?:one-step )?function$/i.test(value)) return { name: "saveExternalCaptureAsFunction", args: {} };
  if (/^(?:collect|save) (?:this|these|the selected|selected) (?:items|material|content)? ?(?:in|as) (?:a )?lens$/i.test(value)) return { name: "saveExternalCaptureAsLens", args: {} };
  if (/^(turn on|enable|start) (the )?highlighter$/i.test(value)) return { name: "togglePageHighlighter", args: { enabled: true } };
  if (/^(turn off|disable|stop) (the )?highlighter$/i.test(value)) return { name: "togglePageHighlighter", args: { enabled: false } };
  if (/^(?:make|turn) (?:the )?orb (?:into|on as) (?:my |the )?cursor$/i.test(value)) return { name: "toggleExternalOrbCursor", args: { enabled: true } };
  if (/^(?:return to|restore|use) (?:the )?native cursor$/i.test(value)) return { name: "toggleExternalOrbCursor", args: { enabled: false } };
  const createOrb = value.match(/^(?:make|create|save)(?: this| the selection)? (?:as )?(?:a )?new orb(?: called (.+))?$/i);
  if (createOrb) return { name: "createExternalSemanticOrb", args: { name: createOrb[1] || "Untitled orb" } };
  const openOrb = value.match(/^open (?:the )?(.+?) orb$/i);
  if (openOrb) return { name: "openExternalSemanticOrb", args: { id: openOrb[1] } };
  const addOrb = value.match(/^add (?:this|the selection|current capture) to (?:the )?(.+?) orb$/i);
  if (addOrb) return { name: "addExternalSemanticOrbContext", args: { id: addOrb[1] } };
  if (/^(go|press go|run the stack)$/i.test(value)) return { name: "pressExternalGo", args: {} };
  if (/^preview( the)? (stack|go)$/i.test(value)) return { name: "previewExternalGo", args: {} };
  if (/^(show|open|review)( the)? (library )?import$/i.test(value)) return { name: "showExternalLibraryImport", args: {} };
  if (/^(show|open|browse)( the)? (cognitive )?packages$/i.test(value)) return { name: "browseExternalPackages", args: {} };
  if (/\bopen\b.*\b(?:cognitive workflow|higher-order|vocabulary)\b/i.test(value)) return { name: "openExternalCognitiveStudio", args: { tab: /\bvocabulary\b/i.test(value) ? "vocabulary" : "higher-order" } };
  if (/\bextract\b.*\b(?:move|function|lens|all)\b.*\bfrom (?:this|the selection)\b/i.test(value)) return { name: "openExternalCognitivePullRequest", args: { kinds: ["move", "function", "lens"] } };
  if (/\b(?:creative extraction|create from|inspired by|recurring (?:moves|functions|processes))\b/i.test(value) && /\b(?:this|selection|person|tradition|domain)\b/i.test(value)) {
    return { name: "openExternalCreativeExtraction", args: { goal: value, kinds: ["move", "function", "lens"] } };
  }
  const taste = value.match(/\bsave (?:this(?: selection)?|the selection) to (?:my )?(.+?taste lens)(?: for ([\p{L}\p{N} -]+))?$/iu);
  if (taste) return { name: "saveExternalTasteTeaching", args: { lens: taste[1], text: "explicit-selection", kind: "example" } };
  if (/\b(?:open|make|create|learn)\b/i.test(value) && /\bbefore\s*(?:\/|and|&)?\s*after\b/i.test(value)) return { name: "openExternalBeforeAfter", args: {} };
  const setExample = value.match(/^(?:set|use) (before|after)(?: text)? (?:to|as) (.+)$/i);
  if (setExample) return { name: "setExternalBeforeAfterText", args: { side: setExample[1].toLowerCase(), text: setExample[2] } };
  if (/^(?:infer|learn)(?: the)? (?:transformation|move|function)$/i.test(value)) return { name: "inferExternalBeforeAfter", args: {} };
  if (/^(?:capture|interpret) (?:what is|what's) visible(?: in this tab)?$/i.test(value)) return { name: "captureExternalVisibleTab", args: {} };
  if (/^start critique(?: mode)?$/i.test(value)) return { name: "startExternalCritique", args: {} };
  if (/^stop critique(?: mode)?$/i.test(value)) return { name: "stopExternalCritique", args: {} };
  const critique = value.match(/^critique:\s*(.+)$/i);
  if (critique) return { name: "ingestExternalCritique", args: { text: critique[1] } };
  const primitive = value.match(/^(branch|merge|deepen|challenge|embody) (?:these|this|the selection)$/i);
  if (primitive) return { name: "invokeExternalPrimitive", args: { primitive: primitive[1][0].toUpperCase() + primitive[1].slice(1).toLowerCase(), targets: ["selection"] } };
  if (/^copy (result )?(.+)$/i.test(value)) return { name: "copyExternalResult", args: { result: value.match(/^copy (?:result )?(.+)$/i)[1] } };
  if (/^insert (result )?(.+)$/i.test(value)) return { name: "insertExternalResult", args: { result: value.match(/^insert (?:result )?(.+)$/i)[1] } };
  if (/^replace (with )?(.+)$/i.test(value)) return { name: "replaceExternalSelection", args: { result: value.match(/^replace (?:with )?(.+)$/i)[1] } };
  throw new Error("Use capture selection, learn from before/after, review library import, preview GO, press GO, copy, insert, or replace.");
}

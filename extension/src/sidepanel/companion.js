import { EXTENSION_COMPANION_CAPABILITIES } from "../../../client/lib/companion-capabilities.js";
import { validateCapabilityArgs } from "../../../client/lib/companion-plan.js";

function canonicalPearlAction({ action, args, confirmed }, command, commandArgs) {
  return action("pearl-action", {
    event: {
      pearlId: args.pearlId,
      command,
      args: { pearlId: args.pearlId, ...commandArgs },
      surface: "companion",
      idempotencyKey: crypto.randomUUID(),
      destructiveApproved: confirmed === true,
    },
  });
}

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
  inspectExternalPrivacy: ({ inspectPrivacy }) => inspectPrivacy(),
  executeExternalPearlAction: ({ args, action }) => action("pearl-action", {
    event: {
      pearlId: args.pearlId,
      command: args.command,
      args: args.args || {},
      surface: "companion",
      idempotencyKey: crypto.randomUUID(),
    },
  }),
  openExternalPearlStudio: ({ args, action }) => action("pearl-open-studio", { pearlId: args.pearlId }),
  inspectExternalPearlCognition: ({ args, action }) => action("pearl-entity-get", { pearlId: args.pearlId }),
  proposeExternalPearlCognitiveEdit: (context) => canonicalPearlAction(context, "proposePearlCognitivePatch", { layerId: context.args.layerId, patch: context.args.patch, rationale: context.args.rationale }),
  applyExternalPearlCognitiveEdit: (context) => canonicalPearlAction(context, "applyPearlCognitivePatch", { proposalId: context.args.proposalId, confirmed: context.confirmed === true }),
  composeExternalPearlCognitiveLayers: (context) => canonicalPearlAction(context, "composePearlCognitiveLayers", { leftId: context.args.leftId, rightId: context.args.rightId, options: { intent: context.args.intent }, confirmed: false }),
  applyExternalPearlCognitiveComposition: (context) => canonicalPearlAction(context, "composePearlCognitiveLayers", { leftId: context.args.leftId, rightId: context.args.rightId, options: { intent: context.args.intent }, confirmed: context.confirmed === true }),
  mutateExternalPearlCognitiveLayer: (context) => canonicalPearlAction(context, "mutatePearlCognitiveLayer", { layerId: context.args.layerId, operation: context.args.operation, value: context.args.value, to: context.args.to, confirmed: context.confirmed === true }),
  resolveExternalPearlCognitiveUncertainty: (context) => canonicalPearlAction(context, "resolvePearlCognitiveUncertainty", { layerId: context.args.layerId, resolution: context.args.resolution || {}, confirmed: context.confirmed === true }),
  playExternalPearlFunction: (context) => canonicalPearlAction(context, "startPearlCognitivePlayback", { functionLayerId: context.args.functionLayerId, inputs: context.args.inputs, lensIds: context.args.lensIds, roleId: context.args.roleId, branchId: context.args.branchId }),
  stepExternalPearlFunction: (context) => canonicalPearlAction(context, "advancePearlCognitivePlayback", { effect: context.args.effect }),
  cancelExternalPearlFunction: (context) => canonicalPearlAction(context, "cancelPearlCognitivePlayback", {}),
  inspectExternalPearlPrivacy: ({ args, action }) => action("privacy-policy-get", { pearlId: args.pearlId }),
  proposeExternalPearlPrivacyChange: ({ args, action }) => action("privacy-policy-propose", { pearlId: args.pearlId, patch: args.patch }),
  applyExternalPearlPrivacyChange: ({ args, action }) => action("privacy-policy-apply", { pearlId: args.pearlId, proposalId: args.proposalId, confirmed: true }),
  prepareExternalPearlShare: async (context) => {
    const current = await context.action("pearl-entity-get", { pearlId: context.args.pearlId });
    return canonicalPearlAction(context, "preparePearlShare", { pearl: current.entity, selection: context.args.selection || {} });
  },
  installExternalSharedPearl: (context) => canonicalPearlAction(context, "installValidatedPearlPackage", {
    package: context.args.package,
    validationReceipt: context.args.validationReceipt,
    localPearlId: context.args.localPearlId,
    confirmed: context.confirmed === true,
  }),
  compileExternalAutomationPearl: (context) => canonicalPearlAction(context, "compileAutomationPearl", {
    evidence: context.args.evidence,
    inference: context.args.inference,
    id: context.args.id,
  }),
  chooseExternalResultDestination: ({ args, action }) => action("output-routing-answer", { resultId: args.resultId, answer: args.answer }),
  confirmExternalResultPlacement: ({ args, action }) => action("output-routing-confirm", { resultId: args.resultId }),
  cancelExternalResultPlacement: ({ args, action }) => action("output-routing-cancel", { resultId: args.resultId }),
  exportExternalLocalData: ({ exportLocalData }) => exportLocalData(),
  setExternalSync: ({ args, setSync }) => setSync(args.enabled),
  deleteExternalLocalData: ({ deleteLocalData }) => deleteLocalData(),
  lockExternalPearls: ({ lockPearls }) => lockPearls(),
  unlockExternalPearls: ({ unlockPearls }) => unlockPearls(),
  activateExternalPearlCanvas: ({ action }) => action("page-canvas-command", { command: "activatePearlPageCanvas", args: {} }),
  deactivateExternalPearlCanvas: ({ action }) => action("page-canvas-command", { command: "deactivatePearlPageCanvas", args: {} }),
  setExternalCanvasMode: ({ args, action }) => action("page-canvas-command", { command: "setPearlCanvasInputMode", args: { mode: args.mode } }),
  bindExternalCanvasContext: ({ bindCanvasContext }) => bindCanvasContext(),
  setExternalOutputDestination: ({ args, action }) => action("page-canvas-command", { command: "setPearlCanvasOutputDestination", args: { destination: { type: args.type } } }),
  undoExternalPearlCanvas: ({ action }) => action("page-canvas-command", { command: "undoPearlPageCanvas", args: {} }),
  exportExternalPearlCanvasPdf: ({ action }) => action("page-canvas-export-pdf"),
  searchExternalPearlSoundscape: ({ args, searchAudio }) => searchAudio(args.query, args.provider),
  uploadExternalPearlAudio: ({ chooseAudio }) => chooseAudio(),
  useExternalPearlAudioTrack: ({ args, addAudio }) => addAudio(args.track),
  controlExternalPearlSoundscape: ({ args, controlAudio }) => controlAudio(args.action),
  updateExternalPearlSoundscape: ({ args, updateAudio }) => updateAudio(args),
  saveExternalPearlTrackOffline: ({ args, action }) => action("pearl-audio-save-offline", { trackId: args.trackId, confirmed: true }),
  removeExternalPearlAudioTrack: ({ args, action }) => action("pearl-audio-delete", { trackId: args.trackId, confirmed: true }),
  expandExternalResultPearl: ({ args, action }) => action("result-pearl-command", { command: "expandResultPearl", resultId: args.resultId }),
  collapseExternalResultPearl: ({ args, action }) => action("result-pearl-command", { command: "collapseResultPearl", resultId: args.resultId }),
  openExternalResultPearlTab: ({ args, action }) => action("result-pearl-open-tab", { resultId: args.resultId }),
  presentExternalResultAsChat: ({ args, action }) => action("result-pearl-command", { command: "presentResultPearlAsChat", resultId: args.resultId }),
  redirectExternalResult: ({ args, action }) => action("output-routing-answer", { resultId: args.resultId, answer: args.destination }),
  acceptExternalResultPearl: ({ args, action }) => action("result-pearl-command", { command: "acceptResultPearl", resultId: args.resultId }),
  archiveExternalResultPearl: ({ args, action }) => action("result-pearl-command", { command: "archiveResultPearl", resultId: args.resultId }),
  deleteExternalResultPearl: ({ args, action }) => action("result-pearl-command", { command: "deleteResultPearl", resultId: args.resultId }),
  undoExternalResultPearl: ({ args, action }) => action("result-pearl-command", { command: "undoResultPearl", resultId: args.resultId }),
  createExternalSemanticOrb: ({ args, semanticOrbAction }) => semanticOrbAction("create", args),
  openExternalSemanticOrb: ({ args, semanticOrbAction }) => semanticOrbAction("open", args),
  addExternalSemanticOrbContext: ({ args, semanticOrbAction }) => semanticOrbAction("add-context", args),
  removeExternalSemanticOrbContext: ({ args, semanticOrbAction }) => semanticOrbAction("remove-context", args),
  applyExternalSemanticOrbLens: ({ args, semanticOrbAction }) => semanticOrbAction("apply-lens", args),
  removeExternalSemanticOrbLens: ({ args, semanticOrbAction }) => semanticOrbAction("remove-lens", args),
  renameExternalSemanticOrb: ({ args, semanticOrbAction }) => semanticOrbAction("rename", args),
  mergeExternalSemanticOrbs: ({ args, semanticOrbAction }) => semanticOrbAction("merge", args),
  duplicateExternalSemanticOrb: ({ args, semanticOrbAction }) => semanticOrbAction("duplicate", args),
  splitExternalSemanticOrb: ({ args, semanticOrbAction }) => semanticOrbAction("split", args),
  unnestExternalSemanticOrb: ({ args, semanticOrbAction }) => semanticOrbAction("unnest", args),
  archiveExternalSemanticOrb: ({ args, semanticOrbAction }) => semanticOrbAction("archive", args),
  deleteExternalSemanticOrb: ({ args, semanticOrbAction }) => semanticOrbAction("delete", args),
  openExternalSemanticOrbScene: ({ args, action }) => action("open-web-handoff", {
    surface: "semantic-orb-scene",
    orbId: args.id,
    preservePayload: true,
  }),
  queueExternalAction: ({ args, action, resolveLens }) => action("queue-lens", { lens: resolveLens(args.action) }),
  setExternalLensContext: ({ args, action, resolveGenerator }) => action("set-generator", { generator: resolveGenerator(args.lens) }),
  previewExternalGo: ({ readPreview }) => Promise.resolve(readPreview()),
  pressExternalGo: ({ args, pressGo }) => pressGo(args),
  copyExternalResult: ({ args, resolveResult, action }) => {
    const result = resolveResult(args.result);
    return action("output-routing-answer", { resultId: result.id, answer: "copy it" });
  },
  insertExternalResult: ({ args, resolveResult, action }) => {
    const result = resolveResult(args.result);
    return action("output-routing-answer", { resultId: result.id, answer: "insert at the selected caret" });
  },
  replaceExternalSelection: ({ args, resolveResult, action }) => {
    const result = resolveResult(args.result);
    return action("output-routing-answer", { resultId: result.id, answer: "replace the current selection" });
  },
  annotateExternalResult: ({ args, resolveResult, action }) => action("output-routing-answer", { resultId: resolveResult(args.result).id, answer: "place in a companion-created region" }),
  openExternalArtifact: ({ args, resolveResult, action }) => action("output-routing-answer", { resultId: resolveResult(args.result).id, answer: "open in the web scene" }),
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
  const createOrb = value.match(/^(?:(?:make|create|save)(?: this| the selection)? (?:as )?(?:a )?new orb|make (?:a )?pearl(?: from (?:this|the selection))?)(?: called (.+))?$/i);
  if (createOrb) return { name: "createExternalSemanticOrb", args: { name: createOrb[1] || "Untitled pearl" } };
  const renameOrb = value.match(/^rename (?:the )?(.+?) orb to (.+)$/i);
  if (renameOrb) return { name: "renameExternalSemanticOrb", args: { id: renameOrb[1], name: renameOrb[2] } };
  const duplicateOrb = value.match(/^duplicate (?:the )?(.+?) orb$/i);
  if (duplicateOrb) return { name: "duplicateExternalSemanticOrb", args: { id: duplicateOrb[1] } };
  const splitOrb = value.match(/^split (?:the )?(.+?) orb$/i);
  if (splitOrb) return { name: "splitExternalSemanticOrb", args: { id: splitOrb[1] } };
  const unnestOrb = value.match(/^unnest (?:the )?(.+?) orb$/i);
  if (unnestOrb) return { name: "unnestExternalSemanticOrb", args: { id: unnestOrb[1] } };
  const deleteOrb = value.match(/^delete (?:the )?(.+?) orb$/i);
  if (deleteOrb) return { name: "deleteExternalSemanticOrb", args: { id: deleteOrb[1] } };
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
  if (/^(?:use|activate) this pearl here$/i.test(value)) return { name: "activateExternalPearlCanvas", args: {} };
  if (/^(?:let me|return to) edit(?:ing)? the page(?: again)?$/i.test(value)) return { name: "deactivateExternalPearlCanvas", args: {} };
  if (/\b(?:draw|pen)\b/i.test(value)) return { name: "setExternalCanvasMode", args: { mode: "pen" } };
  if (/\bhighlighter?\b/i.test(value)) return { name: "setExternalCanvasMode", args: { mode: "highlighter" } };
  if (/\beraser?\b/i.test(value)) return { name: "setExternalCanvasMode", args: { mode: "eraser" } };
  if (/\b(?:text box|textbox)\b/i.test(value)) return { name: "setExternalOutputDestination", args: { type: "canvas-textbox" } };
  if (/\bdownload\b.*\bpdf\b/i.test(value)) return { name: "exportExternalPearlCanvasPdf", args: {} };
  const soundSearch = value.match(/^(?:give this pearl|search for|find)\s+(.+?)(?:\s+(?:soundscape|music|audio))?$/i);
  if (soundSearch && /\b(?:rain|ambience|music|audio|song|soundscape|room tone)\b/i.test(value)) {
    return { name: "searchExternalPearlSoundscape", args: { query: soundSearch[1], provider: /\b(?:rain|room tone|noise)\b/i.test(value) ? "procedural" : "internet-archive" } };
  }
  if (/^upload my (?:track|audio|song)$/i.test(value)) return { name: "uploadExternalPearlAudio", args: {} };
  if (/^(?:play|preview|pause|stop)(?: (?:the )?(?:music|soundscape|track))?$/i.test(value)) {
    return { name: "controlExternalPearlSoundscape", args: { action: /^pause/i.test(value) ? "pause" : /^stop/i.test(value) ? "stop" : "play" } };
  }
  if (/^turn (?:it|the music) down$/i.test(value)) return { name: "updateExternalPearlSoundscape", args: { volume: .35 } };
  if (/^what is stored(?: here| locally)?$/i.test(value)) return { name: "inspectExternalPrivacy", args: {} };
  if (/^lock (?:my |these )?pearls$/i.test(value)) return { name: "lockExternalPearls", args: {} };
  if (/^unlock (?:my |these )?pearls$/i.test(value)) return { name: "unlockExternalPearls", args: {} };
  if (/^(?:enable|turn on) sync$/i.test(value)) return { name: "setExternalSync", args: { enabled: true } };
  if (/^(?:disable|turn off) sync$/i.test(value)) return { name: "setExternalSync", args: { enabled: false } };
  if (/^open (?:this|the|latest) result in (?:a )?new tab$/i.test(value)) return { name: "openExternalResultPearlTab", args: { resultId: "latest" } };
  if (/^open (?:this|the|latest) result in chat$/i.test(value)) return { name: "presentExternalResultAsChat", args: { resultId: "latest" } };
  if (/^(?:open|expand) (?:this|the|latest) result$/i.test(value)) return { name: "expandExternalResultPearl", args: { resultId: "latest" } };
  if (/^collapse (?:this|the|latest) result$/i.test(value)) return { name: "collapseExternalResultPearl", args: { resultId: "latest" } };
  if (/^keep (?:this|the|latest) result$/i.test(value)) return { name: "acceptExternalResultPearl", args: { resultId: "latest" } };
  if (/^archive (?:this|the|latest) result(?: pearl)?$/i.test(value)) return { name: "archiveExternalResultPearl", args: { resultId: "latest" } };
  if (/^delete (?:this|the|latest) result(?: pearl)?$/i.test(value)) return { name: "deleteExternalResultPearl", args: { resultId: "latest" } };
  if (/^undo (?:the )?(?:last )?(?:change to )?(?:this|the|latest) result$/i.test(value)) return { name: "undoExternalResultPearl", args: { resultId: "latest" } };
  if (/^put (?:it|this result) here$/i.test(value)) return { name: "redirectExternalResult", args: { resultId: "latest", destination: "canvas-region" } };
  if (/^make (?:a |some )?space(?: for (?:it|this result))?$/i.test(value)) return { name: "redirectExternalResult", args: { resultId: "latest", destination: "companion-region" } };
  throw new Error("Use capture selection, learn from before/after, review library import, preview GO, press GO, copy, insert, or replace.");
}

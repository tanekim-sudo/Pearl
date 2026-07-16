import { EXTENSION_COMPANION_CAPABILITIES } from "../../../client/lib/companion-capabilities.js";
import { validateCapabilityArgs } from "../../../client/lib/companion-plan.js";

export const EXTENSION_VERBS = Object.freeze({
  capturePageSelection: ({ action }) => action("capture-selection"),
  openExternalSaveAs: ({ openSaveAs }) => openSaveAs(),
  saveExternalCaptureAsMove: ({ saveCaptureAs }) => saveCaptureAs("move"),
  saveExternalCaptureAsLens: ({ saveCaptureAs }) => saveCaptureAs("lens"),
  togglePageHighlighter: ({ args, action }) => action("toggle-highlighter", { enabled: args.enabled }),
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
  if (capability.destructive && !context.confirmed) throw new Error("confirmation required");
  await context.animate?.({ name, args, path: "director-ghost-cursor" });
  return handler({ ...context, args: args || {} });
}

export function parseExtensionIntent(text) {
  const value = String(text || "").trim();
  if (/^(capture|highlight) (this |the )?(selection|text)$/i.test(value)) return { name: "capturePageSelection", args: {} };
  if (/^save (?:this|the selection) as(?:…|\.\.\.)?$/i.test(value)) return { name: "openExternalSaveAs", args: {} };
  if (/^save (?:this|the selected|selected) (?:text|content|selection)? ?as (?:a )?move$/i.test(value)) return { name: "saveExternalCaptureAsMove", args: {} };
  if (/^(?:collect|save) (?:this|these|the selected|selected) (?:items|material|content)? ?(?:in|as) (?:a )?lens$/i.test(value)) return { name: "saveExternalCaptureAsLens", args: {} };
  if (/^(turn on|enable|start) (the )?highlighter$/i.test(value)) return { name: "togglePageHighlighter", args: { enabled: true } };
  if (/^(turn off|disable|stop) (the )?highlighter$/i.test(value)) return { name: "togglePageHighlighter", args: { enabled: false } };
  if (/^(go|press go|run the stack)$/i.test(value)) return { name: "pressExternalGo", args: {} };
  if (/^preview( the)? (stack|go)$/i.test(value)) return { name: "previewExternalGo", args: {} };
  if (/^(show|open|review)( the)? (library )?import$/i.test(value)) return { name: "showExternalLibraryImport", args: {} };
  if (/\b(?:open|make|create|learn)\b/i.test(value) && /\bbefore\s*(?:\/|and|&)?\s*after\b/i.test(value)) return { name: "openExternalBeforeAfter", args: {} };
  const setExample = value.match(/^(?:set|use) (before|after)(?: text)? (?:to|as) (.+)$/i);
  if (setExample) return { name: "setExternalBeforeAfterText", args: { side: setExample[1].toLowerCase(), text: setExample[2] } };
  if (/^(?:infer|learn)(?: the)? (?:transformation|move|function)$/i.test(value)) return { name: "inferExternalBeforeAfter", args: {} };
  if (/^(?:capture|interpret) (?:what is|what's) visible(?: in this tab)?$/i.test(value)) return { name: "captureExternalVisibleTab", args: {} };
  if (/^start critique(?: mode)?$/i.test(value)) return { name: "startExternalCritique", args: {} };
  if (/^stop critique(?: mode)?$/i.test(value)) return { name: "stopExternalCritique", args: {} };
  const critique = value.match(/^critique:\s*(.+)$/i);
  if (critique) return { name: "ingestExternalCritique", args: { text: critique[1] } };
  if (/^copy (result )?(.+)$/i.test(value)) return { name: "copyExternalResult", args: { result: value.match(/^copy (?:result )?(.+)$/i)[1] } };
  if (/^insert (result )?(.+)$/i.test(value)) return { name: "insertExternalResult", args: { result: value.match(/^insert (?:result )?(.+)$/i)[1] } };
  if (/^replace (with )?(.+)$/i.test(value)) return { name: "replaceExternalSelection", args: { result: value.match(/^replace (?:with )?(.+)$/i)[1] } };
  throw new Error("Use capture selection, learn from before/after, review library import, preview GO, press GO, copy, insert, or replace.");
}

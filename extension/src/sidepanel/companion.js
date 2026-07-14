import { EXTENSION_COMPANION_CAPABILITIES } from "../../../client/lib/companion-capabilities.js";
import { validateCapabilityArgs } from "../../../client/lib/companion-plan.js";

export const EXTENSION_VERBS = Object.freeze({
  capturePageSelection: ({ action }) => action("capture-selection"),
  togglePageHighlighter: ({ args, action }) => action("toggle-highlighter", { enabled: args.enabled }),
  queueExternalLens: ({ args, action, resolveLens }) => action("queue-lens", { lens: resolveLens(args.lens) }),
  setExternalGenerator: ({ args, action, resolveGenerator }) => action("set-generator", { generator: resolveGenerator(args.generator) }),
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
  if (/^(turn on|enable|start) (the )?highlighter$/i.test(value)) return { name: "togglePageHighlighter", args: { enabled: true } };
  if (/^(turn off|disable|stop) (the )?highlighter$/i.test(value)) return { name: "togglePageHighlighter", args: { enabled: false } };
  if (/^(go|press go|run the stack)$/i.test(value)) return { name: "pressExternalGo", args: {} };
  if (/^preview( the)? (stack|go)$/i.test(value)) return { name: "previewExternalGo", args: {} };
  if (/^(show|open|review)( the)? (library )?import$/i.test(value)) return { name: "showExternalLibraryImport", args: {} };
  if (/\b(?:open|make|create|learn)\b/i.test(value) && /\bbefore\s*(?:\/|and|&)?\s*after\b/i.test(value)) return { name: "openExternalBeforeAfter", args: {} };
  const setExample = value.match(/^(?:set|use) (before|after)(?: text)? (?:to|as) (.+)$/i);
  if (setExample) return { name: "setExternalBeforeAfterText", args: { side: setExample[1].toLowerCase(), text: setExample[2] } };
  if (/^(?:infer|learn)(?: the)? (?:transformation|lens)$/i.test(value)) return { name: "inferExternalBeforeAfter", args: {} };
  if (/^copy (result )?(.+)$/i.test(value)) return { name: "copyExternalResult", args: { result: value.match(/^copy (?:result )?(.+)$/i)[1] } };
  if (/^insert (result )?(.+)$/i.test(value)) return { name: "insertExternalResult", args: { result: value.match(/^insert (?:result )?(.+)$/i)[1] } };
  if (/^replace (with )?(.+)$/i.test(value)) return { name: "replaceExternalSelection", args: { result: value.match(/^replace (?:with )?(.+)$/i)[1] } };
  throw new Error("Use capture selection, learn from before/after, review library import, preview GO, press GO, copy, insert, or replace.");
}

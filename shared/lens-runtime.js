import {
  HARD_OUTPUT_CAP,
  createCompoundOperator,
  createPendingStackGate,
  contentFingerprint,
  previewCompositionSequence,
} from "./lens-grammar.js";

export const LENS_RUNTIME_VERSION = 1;
export const MATERIAL_FRAGMENT_VERSION = 1;
export const EXECUTION_REQUEST_VERSION = 1;
export const MAX_FRAGMENT_CHARACTERS = 120_000;

const clone = (value) => globalThis.structuredClone
  ? globalThis.structuredClone(value)
  : JSON.parse(JSON.stringify(value));

const immutable = (value) => Object.freeze(value);

function safeUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

export function revisionFingerprint(value) {
  return contentFingerprint(String(value || ""));
}

/**
 * Platform-neutral, immutable page material. Browser adapters are responsible
 * for producing the selection fields; credentials and executable instructions
 * are deliberately absent.
 */
export function createMaterialFragment(input = {}, options = {}) {
  const quote = String(input.quote || "").slice(0, options.maxCharacters || MAX_FRAGMENT_CHARACTERS);
  if (!quote) throw new Error("fragment quote is required");
  const url = safeUrl(input.url);
  if (!url) throw new Error("fragment requires an http(s) URL");
  const fragment = {
    kind: "material-fragment",
    version: MATERIAL_FRAGMENT_VERSION,
    id: String(input.id || globalThis.crypto?.randomUUID?.() || `fragment-${Date.now()}`),
    quote,
    prefix: String(input.prefix || "").slice(-256),
    suffix: String(input.suffix || "").slice(0, 256),
    offsets: immutable({
      start: Math.max(0, Number(input.offsets?.start) || 0),
      end: Math.max(0, Number(input.offsets?.end) || quote.length),
    }),
    formatting: immutable({
      plainText: input.formatting?.plainText !== false,
      blockTag: String(input.formatting?.blockTag || ""),
      direction: input.formatting?.direction === "rtl" ? "rtl" : "ltr",
    }),
    provenance: immutable({
      url,
      title: String(input.title || "").slice(0, 512),
      origin: new URL(url).origin,
      frameUrl: safeUrl(input.frameUrl || url),
      capturedAt: Number(input.capturedAt) || Date.now(),
      revision: String(input.revision || revisionFingerprint(`${input.prefix || ""}${quote}${input.suffix || ""}`)),
      confidence: Math.max(0, Math.min(1, Number(input.confidence) || 1)),
    }),
    anchor: immutable({
      selector: String(input.anchor?.selector || "").slice(0, 2048),
      field: String(input.anchor?.field || ""),
      startPath: clone(input.anchor?.startPath || []),
      endPath: clone(input.anchor?.endPath || []),
    }),
  };
  return immutable(fragment);
}

export function createProvenance(fragments = [], extra = {}) {
  return immutable({
    kind: "lens-provenance",
    version: 1,
    fragmentIds: fragments.map((entry) => entry.id),
    sources: fragments.map((entry) => entry.provenance),
    createdAt: Number(extra.createdAt) || Date.now(),
    actor: String(extra.actor || "user"),
    runId: String(extra.runId || ""),
  });
}

export function materialSelectionSnapshot(value = {}) {
  return {
    paperIds: [...new Set(value.paperIds || [])],
    aiNodeIds: [...new Set(value.aiNodeIds || [])],
    fragments: [...(value.fragments || [])],
  };
}

export function hasBrushMaterial(material) {
  return Boolean(material?.paperIds?.length || material?.aiNodeIds?.length || material?.fragments?.length);
}

export function composeBrushStack(queue, resolveOperator, opMap, options = {}) {
  const generator = queue.find((entry) => entry.kind === "generator") || null;
  const lensQueue = queue.filter((entry) => entry.kind === "lens");
  if (!lensQueue.length) {
    return generator
      ? { ok: true, target: generator, generator, count: 1, label: generator.name, errors: [], warnings: [] }
      : { ok: false, errors: ["queue at least one lens"], warnings: [] };
  }
  if (generator && !options.generatorMode) {
    return { ok: false, errors: ["choose how the generator joins this stack"], warnings: [] };
  }
  const resolved = lensQueue.map(resolveOperator);
  if (resolved.some((op) => !op)) return { ok: false, errors: ["queued lens is missing"], warnings: [] };
  let map = { ...opMap };
  let current = resolved[0];
  const preview = previewCompositionSequence(resolved, map, options);
  if (!preview.ok) return { ...preview, count: preview.predictedOutputCount };
  for (let index = 1; index < resolved.length; index += 1) {
    const made = createCompoundOperator(current, resolved[index], map, {
      confirmed: true,
      idFactory: options.idFactory,
      name: `${current.name} → ${resolved[index].name}`,
    });
    map = { ...map, ...Object.fromEntries(made.ops.map((op) => [op.id, op])) };
    current = map[made.rootId];
  }
  return {
    ok: true,
    errors: [],
    warnings: preview.warnings,
    count: preview.predictedOutputCount,
    label: [...resolved.map((op) => op.name), ...(generator ? [`collect source in ${generator.name}`] : [])].join(" → "),
    target: { kind: "lens", id: current.id, name: current.name, op: current, opMap: map },
    generator,
  };
}

export function createExecutionRequest({ fragments, queue, generator = null, idempotencyKey, disclosedCharacters }) {
  if (!fragments?.length) throw new Error("at least one fragment is required");
  if (!queue?.length && !generator) throw new Error("at least one lens or generator is required");
  const characters = fragments.reduce((sum, entry) => sum + entry.quote.length, 0);
  if (characters > MAX_FRAGMENT_CHARACTERS) throw new Error("selection exceeds execution limit");
  if (disclosedCharacters != null && Number(disclosedCharacters) !== characters) throw new Error("disclosure character count changed");
  return {
    kind: "lens-execution-request",
    version: EXECUTION_REQUEST_VERSION,
    idempotencyKey: String(idempotencyKey || globalThis.crypto?.randomUUID?.() || `run-${Date.now()}`),
    fragments: fragments.map((entry) => clone(entry)),
    queue: queue.map((entry) => ({ id: entry.id, version: Number(entry.version) || 1 })),
    generator: generator ? { id: generator.id, mode: generator.mode || "source" } : null,
    disclosure: {
      characters,
      origins: [...new Set(fragments.map((entry) => entry.provenance.origin))],
    },
  };
}

export function createExecutionResult(input = {}) {
  const outputs = (input.outputs || []).slice(0, HARD_OUTPUT_CAP).map((entry, index) => immutable({
    id: String(entry.id || `output-${index}`),
    text: String(entry.text ?? entry.output ?? entry),
    html: String(entry.html || ""),
    lineage: clone(entry.lineage || []),
  }));
  return immutable({
    kind: "lens-execution-result",
    version: 1,
    runId: String(input.runId || ""),
    status: input.status || "staged",
    outputs: immutable(outputs),
    provenance: input.provenance || null,
    stagedAt: Number(input.stagedAt) || Date.now(),
  });
}

export function createInsertionPlan(input = {}) {
  const operation = ["insert", "replace", "copy", "open", "annotate"].includes(input.operation)
    ? input.operation
    : "copy";
  return immutable({
    kind: "insertion-plan",
    version: 1,
    adapter: String(input.adapter || "generic"),
    frameId: Number(input.frameId) || 0,
    anchor: clone(input.anchor || {}),
    revision: String(input.revision || ""),
    originalText: String(input.originalText || ""),
    originalHtml: String(input.originalHtml || ""),
    proposedText: String(input.proposedText || ""),
    operation,
    formatting: input.formatting === "rich" ? "rich" : "plain",
    undo: clone(input.undo || {}),
  });
}

export function createLensRuntime(initial = {}) {
  const gate = createPendingStackGate(initial.queue || []);
  let fragments = [...(initial.fragments || [])];
  return {
    get fragments() { return [...fragments]; },
    get queue() { return gate.queue; },
    capture(fragment) {
      const value = fragment?.kind === "material-fragment" ? fragment : createMaterialFragment(fragment);
      fragments = [...fragments.filter((entry) => entry.id !== value.id), value];
      return value;
    },
    removeFragment(id) {
      fragments = fragments.filter((entry) => entry.id !== id);
      return [...fragments];
    },
    clearFragments() {
      fragments = [];
    },
    queueLens(lens) { return gate.add(lens); },
    removeLens(index) { return gate.remove(index); },
    reorderLens(from, to) { return gate.reorder(from, to); },
    preview(opMap, options) { return gate.preview(opMap, options); },
    go(key, execute) {
      if (!fragments.length) return Promise.resolve({ committed: false, error: new Error("highlight material before GO"), queue: gate.queue });
      return gate.go(key, (queue) => execute({ queue, fragments: [...fragments] }));
    },
  };
}

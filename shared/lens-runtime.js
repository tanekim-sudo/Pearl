import {
  HARD_OUTPUT_CAP,
  createCompoundOperator,
  createPendingStackGate,
  contentFingerprint,
  previewCompositionSequence,
} from "./lens-grammar.js";
import { normalizeOutputSpec, typedExecutionOutputs } from "./output-specifications.js";
import { normalizeGenerationPlan } from "./generation-plan.js";

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

function normalizeWorkingMemory(workingMemory = null) {
  if (!workingMemory || typeof workingMemory !== "object") return null;
  const slots = Array.isArray(workingMemory.slots)
    ? workingMemory.slots.slice(0, 5).map((slot) => (slot == null || slot === "" ? null : String(slot)))
    : [];
  const packs = (Array.isArray(workingMemory.packs) ? workingMemory.packs : [])
    .filter((pack) => pack && (pack.pearlId || pack.id))
    .slice(0, 5)
    .map((pack) => ({
      pearlId: String(pack.pearlId || pack.id),
      name: String(pack.name || pack.pearlId || pack.id).slice(0, 120),
      summary: String(pack.summary || "").slice(0, 400),
      context: (pack.context || []).slice(0, 12).map((entry) => ({
        id: String(entry.id || ""),
        label: String(entry.label || "").slice(0, 120),
        summary: String(entry.summary || entry.text || "").slice(0, 280),
      })),
      lenses: (pack.lenses || []).slice(0, 8).map((lens) => ({
        id: String(lens.id || ""),
        name: String(lens.name || "").slice(0, 80),
      })),
      functions: (pack.functions || []).slice(0, 8).map((fn) => ({
        id: String(fn.id || ""),
        name: String(fn.name || "").slice(0, 80),
      })),
    }));
  if (!packs.length && !slots.some(Boolean)) return null;
  return {
    kind: "gauntlet-working-memory",
    capacity: 5,
    filled: packs.length || slots.filter(Boolean).length,
    slots: slots.length ? slots : packs.map((pack) => pack.pearlId),
    activeSlot: Number.isInteger(workingMemory.activeSlot) ? workingMemory.activeSlot : null,
    packs,
  };
}

/** Prompt block for gauntlet working-memory packs carried into an execution. */
export function workingMemoryPrompt(workingMemory) {
  const memory = normalizeWorkingMemory(workingMemory);
  if (!memory?.packs?.length) return "";
  const lines = memory.packs.map((pack, index) => {
    const lenses = pack.lenses.map((lens) => lens.name).filter(Boolean).join(", ") || "none";
    const functions = pack.functions.map((fn) => fn.name).filter(Boolean).join(", ") || "none";
    const context = pack.context.map((entry) => entry.summary || entry.label).filter(Boolean).slice(0, 3).join(" · ");
    return `${index + 1}. ${pack.name}: lenses [${lenses}]; functions [${functions}]${context ? `; context: ${context}` : ""}`;
  });
  return [
    "[GAUNTLET WORKING MEMORY — active pearls the companion currently carries]",
    "Interpret and transform the selected material through this stack. Prefer bound lenses/functions and evidenced context. Do not invent pack contents.",
    ...lines,
  ].join("\n");
}

export function createExecutionRequest({
  fragments,
  queue,
  generator = null,
  idempotencyKey,
  disclosedCharacters,
  generationPlan,
  workingMemory = null,
}) {
  if (!fragments?.length) throw new Error("at least one fragment is required");
  if (!queue?.length && !generator) throw new Error("at least one lens or generator is required");
  const characters = fragments.reduce((sum, entry) => sum + entry.quote.length, 0);
  if (characters > MAX_FRAGMENT_CHARACTERS) throw new Error("selection exceeds execution limit");
  if (disclosedCharacters != null && Number(disclosedCharacters) !== characters) throw new Error("disclosure character count changed");
  const memory = normalizeWorkingMemory(workingMemory);
  return {
    kind: "lens-execution-request",
    version: EXECUTION_REQUEST_VERSION,
    idempotencyKey: String(idempotencyKey || globalThis.crypto?.randomUUID?.() || `run-${Date.now()}`),
    fragments: fragments.map((entry) => clone(entry)),
    queue: queue.map((entry) => ({
      id: entry.id,
      version: Number(entry.version) || 1,
      ...(entry.outputSpec ? { outputSpec: normalizeOutputSpec(entry.outputSpec, entry) } : {}),
    })),
    generator: generator ? { id: generator.id, mode: generator.mode || "source" } : null,
    generationPlan: normalizeGenerationPlan(generationPlan || queue.at(-1)?.generationPlan || {}),
    workingMemory: memory,
    disclosure: {
      characters,
      origins: [...new Set(fragments.map((entry) => entry.provenance.origin))],
    },
  };
}

export function createExecutionResult(input = {}) {
  const rawOutputs = input.outputSpec
    ? typedExecutionOutputs(input.outputs || [], input.outputSpec, {}, { runId: input.runId })
    : (input.outputs || []);
  const outputs = rawOutputs.slice(0, HARD_OUTPUT_CAP).map((entry, index) => immutable({
    id: String(entry.id || `output-${index}`),
    text: String(entry.text ?? entry.output ?? entry),
    html: String(entry.html || ""),
    lineage: clone(entry.lineage || []),
    outputSpec: entry.outputSpec ? normalizeOutputSpec(entry.outputSpec, entry) : null,
    semanticType: String(entry.semanticType || entry.outputSpec?.semanticType || ""),
    machineKind: String(entry.machineKind || entry.outputSpec?.machineKind || "text"),
    branchId: entry.branchId == null ? null : String(entry.branchId),
    branchIndex: Number.isInteger(entry.branchIndex) ? entry.branchIndex : null,
    branchProvenance: clone(entry.provenance || entry.branchProvenance || null),
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
    formatting: input.formatting === "rich" || ["richText", "table"].includes(input.machineKind) ? "rich" : "plain",
    machineKind: String(input.machineKind || "text"),
    outputSpec: input.outputSpec ? normalizeOutputSpec(input.outputSpec) : null,
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

import { importLensLibrary, prepareLibraryInput, previewLibraryImport } from "../../../shared/lens-library.js";
import { BrowserPlatform } from "../platform/browser-platform.js";
import { captureMoveFromInstruction, mergeInstructionEventJournal } from "../../../shared/instruction-events.js";
import { composeLibraryObjects } from "../../../shared/composition-algebra.js";
import { normalizeLibraryObject } from "../../../shared/library-objects.js";

const KEY = "lensEverywhereLibrary";
const empty = () => ({ operators: [], generators: [], instructionEvents: [], rack: {}, importedBundles: [], updatedAt: 0 });

export async function readLocalLibrary() {
  const stored = await BrowserPlatform.storage.get("local", [KEY]);
  return { ...empty(), ...(stored[KEY] || {}) };
}

export async function writeLocalLibrary(value) {
  const next = { ...empty(), ...value, updatedAt: Date.now() };
  await BrowserPlatform.storage.set("local", { [KEY]: next });
  return next;
}

export async function previewLibraryFile(raw) {
  const prepared = await prepareLibraryInput(raw);
  if (!prepared.ok) throw new Error(prepared.error);
  const local = await readLocalLibrary();
  return {
    bundle: prepared.bundle,
    counts: prepared.counts,
    conflicts: previewLibraryImport(prepared.bundle, local.operators, local.generators),
  };
}

export async function importLibraryFile(raw, choices = {}) {
  const prepared = await prepareLibraryInput(raw);
  if (!prepared.ok) throw new Error(prepared.error);
  const current = await readLocalLibrary();
  const imported = importLensLibrary(
    prepared.bundle,
    current.operators,
    current.generators,
    choices,
    () => crypto.randomUUID()
  );
  const importedBundles = [...new Set([...current.importedBundles, prepared.bundle.integrity.payloadHash])];
  return writeLocalLibrary({
    operators: imported.operators,
    generators: imported.generators,
    rack: { ...current.rack, ...(prepared.bundle.rack || {}) },
    importedBundles,
  });
}

export async function mergeRemoteLibrary(remote = {}) {
  const current = await readLocalLibrary();
  const operators = [...current.operators];
  const operatorIds = new Set(operators.map((entry) => entry.id));
  for (const operator of remote.operators || []) {
    const index = operators.findIndex((entry) => entry.id === operator.id);
    if (index < 0) {
      operators.push(operator);
      operatorIds.add(operator.id);
    } else if ((Number(operator.version) || 1) > (Number(operators[index].version) || 1)) {
      operators[index] = operator;
    }
  }
  const generators = [...current.generators];
  for (const generator of remote.generators || []) {
    const index = generators.findIndex((entry) => entry.id === generator.id);
    if (index < 0) generators.push(generator);
    else if ((Number(generator.version) || 1) > (Number(generators[index].version) || 1)) generators[index] = generator;
  }
  return writeLocalLibrary({ ...current, operators, generators });
}

export async function saveCapturedMove(fragments = [], input = {}) {
  const current = await readLocalLibrary();
  const prompt = fragments.map((fragment) => String(fragment.quote || "")).join(input.separator ?? "\n\n");
  if (!prompt) throw new Error("capture text before making a Move");
  const normalized = prompt.replace(/\r\n/g, "\n").trim();
  const duplicate = current.operators.find((operator) =>
    (operator.libraryKind === "move" || operator.kind !== "pipeline")
    && String(operator.prompt || "").replace(/\r\n/g, "\n").trim() === normalized
  );
  if (duplicate) return { library: current, object: duplicate, duplicate: true };
  const now = Date.now();
  const id = crypto.randomUUID();
  const capture = captureMoveFromInstruction({
    role: "unknown",
    instruction: prompt,
    status: "succeeded",
    inputRefs: fragments.map((fragment) => ({ id: fragment.id, type: "text" })),
    source: { surface: "extension", objectId: fragments[0]?.id || "" },
  }, { id, name: input.name, confirmInstruction: true });
  const object = {
    ...capture.move,
    kind: "prompt",
    libraryKind: "move",
    description: "One instruction · captured verbatim from page text",
    outputSpec: input.outputSpec || capture.move.outputSpec,
    provenance: { ...capture.move.provenance, private: true, fragmentIds: fragments.map((fragment) => fragment.id) },
    createdAt: now,
    updatedAt: now,
  };
  const library = await writeLocalLibrary({
    ...current,
    operators: [...current.operators, object],
    instructionEvents: mergeInstructionEventJournal(current.instructionEvents || [], [capture.event]),
  });
  return { library, object, duplicate: false };
}

export async function saveCapturedFunction(fragments = [], input = {}) {
  if (!fragments.length) throw new Error("capture material before making a Function");
  const exact = fragments.map((fragment) => String(fragment.quote || "")).join(input.separator ?? "\n\n");
  const moved = await saveCapturedMove(fragments, {
    name: input.moveName || input.name,
    separator: input.separator,
  });
  const current = moved.library;
  const duplicate = current.operators.find((operator) =>
    operator.libraryKind === "function" &&
    String(operator.sourceInstruction || "") === exact
  );
  if (duplicate) return { library: current, object: duplicate, duplicate: true };
  const now = Date.now();
  const id = crypto.randomUUID();
  const object = {
    id,
    stableId: id,
    version: 1,
    kind: "pipeline",
    libraryKind: "function",
    schemaVersion: 2,
    top: true,
    name: String(input.name || exact.split(/\r?\n/)[0] || "Captured Function").slice(0, 80),
    steps: [moved.object.id],
    sourceInstruction: exact,
    processInstructions: exact,
    provenance: {
      kind: "semantic-drop",
      wrappedMove: { id: moved.object.id, version: moved.object.version || 1 },
      private: true,
      fragmentIds: fragments.map((fragment) => fragment.id),
    },
    createdAt: now,
    updatedAt: now,
  };
  const library = await writeLocalLibrary({
    ...current,
    operators: [...current.operators, object],
  });
  return { library, object, duplicate: false };
}

export async function saveCapturedLens(fragments = [], input = {}) {
  if (!fragments.length) throw new Error("capture material before making a Lens");
  const current = await readLocalLibrary();
  const now = Date.now();
  const id = crypto.randomUUID();
  const object = {
    id,
    stableId: id,
    version: 1,
    kind: "lens",
    libraryKind: "lens",
    schemaVersion: 2,
    name: String(input.name || fragments[0]?.quote || "Page material").slice(0, 80),
    material: fragments.map((fragment) => ({
      id: fragment.id,
      content: fragment.quote,
      provenance: fragment.provenance,
    })),
    contextPolicy: "bounded",
    contextBudget: 24_000,
    contextGraph: { material: fragments.map((fragment) => ({ id: fragment.id, content: fragment.quote, provenance: fragment.provenance })), placements: [], relationships: [] },
    inclusionPolicy: { private: true, includeSources: true, excludeSensitive: true },
    structure: {},
    createdAt: now,
    updatedAt: now,
  };
  const library = await writeLocalLibrary({ ...current, generators: [...current.generators, object] });
  return { library, object };
}

export async function composeLocalLibraryObjects(aId, bId, options = {}) {
  const current = await readLocalLibrary();
  const resolve = (id) => current.operators.find((entry) => entry.id === id)
    || current.generators.find((entry) => entry.id === id);
  const leftRaw = resolve(aId);
  const rightRaw = resolve(bId);
  if (!leftRaw || !rightRaw) throw new Error("choose two synced Moves, Functions, or Lenses");
  const canonical = (value) => normalizeLibraryObject({
    ...value,
    kind: value.contextPolicy || value.kind === "lens" ? "lens" : value.kind === "pipeline" || value.libraryKind === "function" ? "function" : "move",
    name: value.name || value.title,
    material: value.material || value.items || [],
    processGraph: value.processGraph || (value.steps ? {
      nodes: value.steps.map((id, index) => ({ id: `step-${index + 1}`, ref: { id, version: 1 } })),
      edges: value.steps.slice(1).map((_, index) => ({ from: `step-${index + 1}`, to: `step-${index + 2}` })),
      outputs: value.steps.length ? [{ from: `step-${value.steps.length}` }] : [],
    } : undefined),
  });
  const compilation = composeLibraryObjects(canonical(leftRaw), canonical(rightRaw), { name: options.name });
  const object = compilation.object;
  if (object.kind === "lens") {
    const stored = { ...object, title: object.name, items: object.contextGraph.material, updatedAt: Date.now() };
    return { compilation, library: await writeLocalLibrary({ ...current, generators: [...current.generators, stored] }), object: stored };
  }
  const stored = {
    ...object,
    kind: "pipeline",
    libraryKind: "function",
    top: true,
    steps: object.processGraph.nodes.map((node) => node.ref.id),
    updatedAt: Date.now(),
  };
  return { compilation, library: await writeLocalLibrary({ ...current, operators: [...current.operators, stored] }), object: stored };
}

export async function saveTranscriptCandidates(result = {}, kinds = []) {
  const current = await readLocalLibrary();
  const selected = new Set(kinds);
  const operators = [...current.operators];
  const lenses = [...current.generators];
  const fingerprint = result.transcript?.fingerprint || "";
  const learnedFrom = { kind: "llm-transcript", fingerprint, messageCount: result.transcript?.messageCount || 0, private: true };
  const move = result.candidates?.move;
  if (selected.has("move") && move?.supported && move.prompt) {
    if (!operators.some((entry) => entry.learnedFrom?.fingerprint === fingerprint && entry.libraryKind === "move")) {
      const id = crypto.randomUUID();
      operators.push({ id, stableId: id, version: 1, kind: "prompt", libraryKind: "move", schemaVersion: 2, top: true, name: move.name || "Learned Move", prompt: move.prompt, outputSpec: move.outputSpec, learnedFrom, createdAt: Date.now(), updatedAt: Date.now() });
    }
  }
  const fn = result.candidates?.function;
  if (selected.has("function") && fn?.supported && fn.steps?.length) {
    if (!operators.some((entry) => entry.learnedFrom?.fingerprint === fingerprint && entry.libraryKind === "function")) {
      const children = fn.steps.map((step) => {
        const id = crypto.randomUUID();
        return { id, stableId: id, version: 1, kind: "prompt", libraryKind: "move", top: false, name: step.name || "Step", prompt: step.prompt || step.name };
      });
      const id = crypto.randomUUID();
      operators.push(...children, { id, stableId: id, version: 1, kind: "pipeline", libraryKind: "function", schemaVersion: 2, top: true, name: fn.name || "Learned Function", steps: children.map((entry) => entry.id), outputSpec: fn.outputSpec, learnedFrom, createdAt: Date.now(), updatedAt: Date.now() });
    }
  }
  const lens = result.candidates?.lens;
  if (selected.has("lens") && lens?.supported) {
    if (!lenses.some((entry) => entry.learnedFrom?.fingerprint === fingerprint)) {
      const id = crypto.randomUUID();
      const material = (lens.material || []).map((entry, index) => ({ id: `${id}:m:${index}`, content: typeof entry === "string" ? entry : entry.content || "" }));
      lenses.push({ id, stableId: id, version: 1, kind: "lens", libraryKind: "lens", schemaVersion: 2, name: lens.name || "Learned Lens", contextPolicy: lens.contextPolicy || "bounded", contextBudget: lens.contextBudget || 24_000, material, contextGraph: { material, placements: [], relationships: [] }, learnedFrom, createdAt: Date.now(), updatedAt: Date.now() });
    }
  }
  return writeLocalLibrary({ ...current, operators, generators: lenses });
}

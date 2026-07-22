/**
 * Breed a counter-pearl that deliberately cultivates opposition to a source pearl.
 * Sources stay intact; the counter pearl carries lineage + inverted lenses/moves.
 */

import { createSemanticOrb, placeSemanticOrb } from "./semantic-orbs.js";
import { PEARL_STUDIO_COGNITIVE_SECTION_ORDER } from "./pearl-studio.js";

export const PEARL_COUNTER_VERSION = 1;

const bounded = (value, limit = 280) => String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);

const OPPOSITION_LENS_TEMPLATES = Object.freeze([
  {
    idSuffix: "foil",
    nameFrom: (name) => `${name} foil`,
    description: (name) => `Deliberately opposite judgment to “${name}”: what would a rigorous foil notice, reject, or invert?`,
  },
  {
    idSuffix: "disconfirm",
    nameFrom: (name) => `Disconfirm ${name}`,
    description: (name) => `Hunt disconfirming evidence against the attractions and concerns cultivated in “${name}”.`,
  },
  {
    idSuffix: "failure-modes",
    nameFrom: () => "Failure modes first",
    description: (name) => `Prefer failure modes, weak assumptions, and opposition cases before charity toward “${name}”.`,
  },
]);

const OPPOSITION_MOVES = Object.freeze([
  {
    idSuffix: "invert",
    name: "Invert thesis",
    description: (name) => `Invert the core thesis and taste of “${name}” while citing the source verbatim.`,
  },
  {
    idSuffix: "steelman-then-attack",
    name: "Steelman then attack",
    description: (name) => `State the strongest charitable reading of “${name}”, then attack it with the strongest opposition case.`,
  },
  {
    idSuffix: "counterevidence",
    name: "Gather counterevidence",
    description: (name) => `Collect counterexamples and counterevidence that “${name}” would undervalue or miss.`,
  },
]);

function sourceContext(pearl) {
  return (pearl.workingSet?.context || []).slice(0, 40).map((item) => ({
    ...item,
    id: item.id ? `counter-src:${item.id}` : `counter-src:${Math.random().toString(36).slice(2, 8)}`,
    pinned: true,
    role: "source-preserved",
  }));
}

function sourceLensNames(pearl) {
  return (pearl.lenses || pearl.workingSet?.lenses || [])
    .map((lens) => String(lens.name || lens.label || "").trim())
    .filter(Boolean)
    .slice(0, 8);
}

/**
 * Build a counter-pearl specification from a source pearl (no mutation of source).
 */
export function buildCounterPearlSpec(source, options = {}) {
  if (!source?.id) throw new Error("source pearl is required");
  const sourceName = bounded(source.name || source.representation?.label || "Untitled pearl", 80);
  const name = bounded(options.name || `Counter · ${sourceName}`, 100);
  const instruction = bounded(options.instruction || "", 400);
  const lensNames = sourceLensNames(source);
  const moves = OPPOSITION_MOVES.map((template) => ({
    id: `move:counter:${source.id}:${template.idSuffix}`,
    name: template.name,
    description: bounded(
      `${template.description(sourceName)}${instruction ? ` Instruction: ${instruction}` : ""}`,
      1_200,
    ),
    kind: "move",
    evidenceRefs: [source.id],
    authorship: "counter",
  }));
  const lenses = OPPOSITION_LENS_TEMPLATES.map((template) => ({
    id: `lens:counter:${source.id}:${template.idSuffix}`,
    name: bounded(template.nameFrom(sourceName), 80),
    description: bounded(
      `${template.description(sourceName)}${lensNames.length ? ` Opposes lenses: ${lensNames.join(", ")}.` : ""}`,
      1_200,
    ),
    kind: "lens",
    strength: 0.78,
    evidenceRefs: [source.id],
    authorship: "counter",
    oppositionTo: {
      pearlId: source.id,
      pearlName: sourceName,
      opposedLensNames: lensNames,
    },
  }));
  const functions = [{
    id: `function:counter:${source.id}`,
    name: bounded(`${name} opposition process`, 72),
    description: bounded(
      `Cultivate deliberate opposition to “${sourceName}”: invert, steelman-then-attack, and gather counterevidence while preserving source material.`,
      1_200,
    ),
    kind: "function",
    steps: moves.map((move) => ({
      name: move.name,
      prompt: move.description,
      evidenceRefs: [source.id],
    })),
    evidenceRefs: [source.id],
    authorship: "counter",
  }];
  const observations = [{
    id: `observation:counter:${source.id}`,
    kind: "pearl-observation",
    type: "text",
    fromPearlId: null,
    aboutPearlId: source.id,
    text: bounded(
      `Counter-pearl cultivates opposition to ${sourceName}${lensNames.length ? ` (foil to ${lensNames.join(", ")})` : ""}.${instruction ? ` ${instruction}` : ""}`,
      800,
    ),
    role: "opposition",
  }];

  return {
    version: PEARL_COUNTER_VERSION,
    name,
    sourceId: source.id,
    sourceName,
    organization: {
      order: [...PEARL_STUDIO_COGNITIVE_SECTION_ORDER],
      moves,
      functions,
      lenses,
    },
    workingSet: {
      context: [...observations, ...sourceContext(source)],
      lenses: lenses.map((lens) => ({
        id: lens.id,
        name: lens.name,
        strength: lens.strength,
        description: lens.description,
      })),
    },
    representation: {
      kind: "counter",
      refs: [source.id],
      label: name,
      preserveIndividuals: true,
      sourcePearlIds: [source.id],
      opposition: true,
    },
    lineage: [{ orbId: source.id, operation: "counter", preserved: true, mode: "opposition" }],
    provenance: {
      counter: {
        version: PEARL_COUNTER_VERSION,
        sourcePearlId: source.id,
        sourcePearlName: sourceName,
        instruction: instruction || null,
        opposedLensNames: lensNames,
        note: "Source pearl remains independent; this pearl cultivates deliberate opposition.",
      },
    },
    moves,
    functions,
    lenses,
  };
}

/**
 * Materialize a counter semantic orb into state (append-only; source unchanged).
 */
export function materializeCounterPearl(state, source, options = {}, context = {}) {
  const spec = buildCounterPearlSpec(source, options);
  const id = context.idFactory?.() || options.id;
  if (!id) throw new Error("counter pearl id is required");
  const placement = placeSemanticOrb(state.semanticOrbs || [], {
    x: (source.placement?.x || 0) + 56,
    y: (source.placement?.y || 0) + 40,
  });
  const counter = createSemanticOrb({
    id,
    sceneId: options.sceneId || source.sceneId || null,
    name: spec.name,
    placement,
    representation: spec.representation,
    workingSet: spec.workingSet,
    lineage: spec.lineage,
    provenance: spec.provenance,
    moves: spec.moves,
    functions: spec.functions,
    lenses: spec.lenses,
  }, { now: context.now });
  return {
    orb: counter,
    spec,
    state: {
      ...state,
      semanticOrbs: [...(state.semanticOrbs || []), counter],
    },
  };
}

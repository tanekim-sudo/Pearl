import { createPearlEntity } from "./pearl-entity.js";

export const PEARL_STUDIO_VERSION = 1;
export const PEARL_STUDIO_REPRESENTATIONS = Object.freeze(["document", "gallery", "spatial", "lineage", "branch-comparison", "process"]);

const clone = (value) => value == null ? value : structuredClone(value);

function hasImages(entity) {
  return entity.canvas?.artifacts?.some((entry) => entry.type === "image")
    || entity.generation.candidates.some((entry) => entry.mimeType?.startsWith("image/") || entry.type === "image");
}

function hasText(entity) {
  return entity.results.some((entry) => String(entry.text || "").trim())
    || entity.generation.candidates.some((entry) => String(entry.text || "").trim())
    || entity.canvas?.artifacts?.some((entry) => ["text", "output"].includes(entry.type));
}

export function pearlStudioRepresentations(entityInput) {
  const entity = createPearlEntity(entityInput);
  const available = [];
  if (hasText(entity) || entity.identity.description || entity.workingSet.context.length) available.push("document");
  if (hasImages(entity)) available.push("gallery");
  if (entity.cognition.layers.length || entity.canvas?.artifacts?.length || hasImages(entity) && hasText(entity)) available.push("spatial");
  if (entity.lineage.length || entity.history.events.length || Object.keys(entity.provenance || {}).length) available.push("lineage");
  if (entity.generation.candidates.length > 1 || entity.results.length > 1) available.push("branch-comparison");
  if (entity.functions.length || entity.moves.length || entity.automation) available.push("process");
  if (!available.length) available.push("document");
  return available;
}

function studioSection(id, label, value, editable = true) {
  return { id, label, value: clone(value), editable };
}

export function createPearlStudioViewModel(entityInput, options = {}) {
  const entity = createPearlEntity(entityInput);
  const representations = pearlStudioRepresentations(entity);
  const preferred = options.representation || entity.representation.mode;
  const representation = representations.includes(preferred) ? preferred : representations[0];
  const sections = [
    studioSection("identity", "Identity", entity.identity),
    entity.representation.material && studioSection("material", "Material", entity.representation.material),
    entity.workingSet.context.length && studioSection("context", "Context", entity.workingSet.context),
    entity.lenses.length && studioSection("lenses", "Lenses", entity.lenses),
    (entity.moves.length || entity.functions.length || entity.automation) && studioSection("process", "Process", { moves: entity.moves, functions: entity.functions, automation: entity.automation }),
    entity.cognition.layers.length && studioSection("cognition", "Organized layers", {
      layers: entity.cognition.layers,
      semanticOrder: entity.cognition.semanticOrder,
      rawEvidence: entity.cognition.rawEvidence,
      sourceMapping: entity.cognition.sourceMapping,
      organizationDiffs: entity.cognition.organizationDiffs,
      activeExecution: entity.cognition.activeExecution,
      unresolvedLayerIds: entity.cognition.layers.filter((entry) => entry.uncertainty.status !== "resolved").map((entry) => entry.id),
    }),
    (entity.generation.plan || entity.generation.outputSpecs.length) && studioSection("generation", "Generation", entity.generation),
    (entity.results.length || entity.generation.candidates.length) && studioSection("outputs", "Outputs", { results: entity.results, candidates: entity.generation.candidates }),
    entity.canvas && studioSection("canvas", "Canvas", entity.canvas),
    entity.soundscape && studioSection("soundscape", "Soundscape", entity.soundscape),
    (entity.lineage.length || Object.keys(entity.provenance).length) && studioSection("lineage", "Lineage", { lineage: entity.lineage, provenance: entity.provenance }),
    (entity.relationships.parentPearlId || entity.relationships.childPearlIds.length || entity.relationships.relatedPearlIds.length) && studioSection("relationships", "Relationships", entity.relationships),
    studioSection("privacy", "Privacy", { policy: entity.privacy.effectivePolicy, permissions: entity.permissions }, false),
    entity.sharing.grants.length && studioSection("sharing", "Sharing", entity.sharing),
    entity.history.checkpoints.length && studioSection("history", "History", { checkpointCount: entity.history.checkpoints.length, undoCursor: entity.history.undoCursor }, false),
  ].filter(Boolean);
  return {
    version: PEARL_STUDIO_VERSION,
    pearlId: entity.id,
    revision: entity.revision,
    kind: entity.kind,
    representation,
    representations,
    sections,
    scrollPosition: entity.representation.scrollPosition,
    lockState: entity.permissions.lockState,
    readOnly: entity.permissions.lockState === "locked",
    actionSearchScope: sections.map((section) => section.id),
  };
}

export function createPearlStudioOpenRequest(entityInput, options = {}) {
  const entity = createPearlEntity(entityInput);
  return {
    version: PEARL_STUDIO_VERSION,
    type: "pearl-studio-open-request",
    id: options.id || `studio-open:${crypto.randomUUID()}`,
    pearlId: entity.id,
    revision: entity.revision,
    checkpointId: options.checkpointId || entity.history.checkpoints.at(-1)?.id || null,
    scrollPosition: options.scrollPosition ?? entity.representation.scrollPosition,
    sourceSurface: options.sourceSurface || "web",
    createdAt: Date.now(),
  };
}
export const PEARL_STUDIO_MAX_CHECKPOINTS = 40;
const bounded = (value, limit = 120_000) => String(value ?? "").slice(0, limit);
const nowIso = (now = Date.now()) => new Date(typeof now === "function" ? now() : now).toISOString();

function sourceSections(source = {}, extras = {}) {
  const workingSet = source.workingSet || {};
  const artifacts = extras.canvas?.artifacts || source.artifacts || [];
  const outputs = extras.results || source.outputs || source.results || [];
  return {
    identity: {
      name: bounded(source.name || source.label || source.title || "Pearl", 160),
      description: bounded(source.description || source.summary || "", 4_000),
    },
    material: clone(source.material || source.representation?.snapshot || source.primaryMaterial || null),
    context: clone(workingSet.context || source.context || []),
    lenses: clone(workingSet.lenses || source.lenses || []),
    process: clone(source.process || {
      moves: source.moves || [],
      functions: source.functions || [],
      branches: workingSet.branches || source.branches || [],
      outputSpec: source.outputSpec || null,
    }),
    outputs: clone(outputs),
    canvas: clone(extras.canvas || source.canvas || (artifacts.length ? { artifacts } : null)),
    soundscape: clone(extras.soundscape || source.soundscape || null),
    lineage: clone(source.lineage || []),
    provenance: clone(source.provenance || null),
    disclosureReceipt: clone(source.disclosureReceipt || null),
    relationships: {
      parentId: source.parentOrbId || source.parentId || null,
      childIds: clone(source.childOrbIds || source.childIds || []),
      relatedIds: clone(source.relatedIds || []),
    },
    privacy: clone(extras.privacy || source.privacy || { mode: "local-only" }),
  };
}

export function choosePearlStudioRepresentation(document) {
  const sections = document?.sections || {};
  const artifacts = sections.canvas?.artifacts || [];
  const images = artifacts.filter((entry) => entry.type === "image");
  const mixed = new Set(artifacts.map((entry) => entry.type)).size > 1;
  if (artifacts.length && (mixed || artifacts.some((entry) => ["ink", "highlight", "text", "output"].includes(entry.type)))) return "spatial";
  if (images.length && images.length === artifacts.length) return "gallery";
  if ((sections.process?.branches?.length || 0) > 1 || (sections.outputs?.length || 0) > 1) return "branch-comparison";
  if ((sections.process?.moves?.length || 0) || (sections.process?.functions?.length || 0)) return "process";
  if ((sections.lineage?.length || 0) > 1) return "lineage";
  return "document";
}

export function createPearlStudioDocument(input = {}) {
  if (!input.sourceId || !input.sourceType) throw new Error("Pearl Studio source identity is required");
  const source = clone(input.source || {});
  const studio = source.studio || input.studio || {};
  const document = {
    version: PEARL_STUDIO_VERSION,
    sourceId: String(input.sourceId),
    sourceType: String(input.sourceType),
    profileHash: input.profileHash || null,
    revision: Math.max(0, Number(studio.revision ?? source.revision) || 0),
    updatedAt: source.updatedAt || studio.updatedAt || nowIso(input.now),
    sections: sourceSections(source, input),
    representation: PEARL_STUDIO_REPRESENTATIONS.includes(studio.representation)
      ? studio.representation
      : null,
    scrollPosition: Math.max(0, Number(studio.scrollPosition) || 0),
    checkpoints: clone(studio.checkpoints || []).slice(-PEARL_STUDIO_MAX_CHECKPOINTS),
    redo: clone(studio.redo || []).slice(-PEARL_STUDIO_MAX_CHECKPOINTS),
    source,
  };
  document.representation ||= choosePearlStudioRepresentation(document);
  return document;
}

function checkpoint(document, label, now) {
  return {
    id: `studio-checkpoint:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`}`,
    label: bounded(label || "edit", 120),
    revision: document.revision,
    at: nowIso(now),
    sections: clone(document.sections),
    representation: document.representation,
    scrollPosition: document.scrollPosition,
  };
}

function arraySection(document, section) {
  const value = document.sections[section];
  if (!Array.isArray(value)) throw new Error("Pearl Studio section is not reorderable");
  return value;
}

function applyOperation(document, mutation) {
  const next = clone(document);
  const section = String(mutation.section || "");
  if (mutation.operation === "set-representation") {
    if (!PEARL_STUDIO_REPRESENTATIONS.includes(mutation.value)) throw new Error("unsupported Pearl Studio representation");
    next.representation = mutation.value;
  } else if (mutation.operation === "set-scroll") {
    next.scrollPosition = Math.max(0, Number(mutation.value) || 0);
  } else if (mutation.operation === "rename") {
    next.sections.identity.name = bounded(mutation.value, 160).trim() || "Pearl";
  } else if (mutation.operation === "set-description") {
    next.sections.identity.description = bounded(mutation.value, 4_000);
  } else if (mutation.operation === "set-material") {
    const current = next.sections.material || {};
    const field = ["text", "quote", "content", "label", "name"].includes(mutation.field) ? mutation.field : "text";
    next.sections.material = { ...current, [field]: bounded(mutation.value) };
  } else if (mutation.operation === "set-section") {
    if (!["process", "soundscape", "relationships", "privacy"].includes(section)) throw new Error("Pearl Studio section cannot be replaced");
    next.sections[section] = clone(mutation.value);
  } else if (mutation.operation === "add") {
    next.sections[section] = [...arraySection(next, section), clone(mutation.value)];
  } else if (mutation.operation === "remove") {
    next.sections[section] = arraySection(next, section).filter((entry, index) => (entry?.id ?? index) !== mutation.itemId);
  } else if (mutation.operation === "edit") {
    next.sections[section] = arraySection(next, section).map((entry, index) =>
      (entry?.id ?? index) === mutation.itemId ? { ...entry, ...clone(mutation.value) } : entry
    );
  } else if (mutation.operation === "reorder") {
    const values = [...arraySection(next, section)];
    const from = values.findIndex((entry, index) => (entry?.id ?? index) === mutation.itemId);
    if (from < 0) throw new Error("Pearl Studio item not found");
    const [entry] = values.splice(from, 1);
    values.splice(Math.max(0, Math.min(values.length, Number(mutation.to) || 0)), 0, entry);
    next.sections[section] = values;
  } else if (mutation.operation === "move-canvas-artifact") {
    const artifacts = [...(next.sections.canvas?.artifacts || [])];
    const index = artifacts.findIndex((entry) => entry.id === mutation.itemId);
    if (index < 0) throw new Error("Pearl Studio canvas artifact not found");
    artifacts[index] = { ...artifacts[index], box: { ...artifacts[index].box, ...clone(mutation.value) }, updatedAt: nowIso() };
    next.sections.canvas = { ...next.sections.canvas, artifacts };
  } else if (mutation.operation === "archive" || mutation.operation === "accept" || mutation.operation === "delete") {
    next.sections.status = mutation.operation === "delete" ? "deleted" : mutation.operation === "accept" ? "accepted" : "archived";
  } else {
    throw new Error("unsupported Pearl Studio mutation");
  }
  return next;
}

export function applyPearlStudioMutation(document, mutation, options = {}) {
  const current = createPearlStudioDocument(document);
  const expected = Number(options.expectedRevision ?? mutation.expectedRevision);
  if (Number.isFinite(expected) && expected !== current.revision) {
    return {
      ok: false,
      conflict: {
        type: "pearl-studio-conflict",
        sourceId: current.sourceId,
        expectedRevision: expected,
        actualRevision: current.revision,
        current,
        proposed: clone(mutation),
      },
    };
  }
  const snapshot = checkpoint(current, mutation.label || mutation.operation, options.now);
  const changed = applyOperation(current, mutation);
  const next = {
    ...changed,
    revision: current.revision + 1,
    updatedAt: nowIso(options.now),
    checkpoints: [...current.checkpoints, snapshot].slice(-PEARL_STUDIO_MAX_CHECKPOINTS),
    redo: [],
  };
  return { ok: true, document: next, checkpoint: snapshot };
}

export function undoPearlStudio(document, options = {}) {
  const current = createPearlStudioDocument(document);
  const previous = current.checkpoints.at(-1);
  if (!previous) return { ok: true, document: current, unchanged: true };
  const redo = checkpoint(current, "redo", options.now);
  return {
    ok: true,
    document: {
      ...current,
      revision: current.revision + 1,
      updatedAt: nowIso(options.now),
      sections: clone(previous.sections),
      representation: previous.representation,
      scrollPosition: previous.scrollPosition,
      checkpoints: current.checkpoints.slice(0, -1),
      redo: [...current.redo, redo].slice(-PEARL_STUDIO_MAX_CHECKPOINTS),
    },
  };
}

export function redoPearlStudio(document, options = {}) {
  const current = createPearlStudioDocument(document);
  const nextRedo = current.redo.at(-1);
  if (!nextRedo) return { ok: true, document: current, unchanged: true };
  const undo = checkpoint(current, "undo", options.now);
  return {
    ok: true,
    document: {
      ...current,
      revision: current.revision + 1,
      updatedAt: nowIso(options.now),
      sections: clone(nextRedo.sections),
      representation: nextRedo.representation,
      scrollPosition: nextRedo.scrollPosition,
      checkpoints: [...current.checkpoints, undo].slice(-PEARL_STUDIO_MAX_CHECKPOINTS),
      redo: current.redo.slice(0, -1),
    },
  };
}

export function mergePearlStudioIntoSource(document) {
  const studio = {
    version: PEARL_STUDIO_VERSION,
    revision: document.revision,
    representation: document.representation,
    scrollPosition: document.scrollPosition,
    checkpoints: clone(document.checkpoints),
    redo: clone(document.redo),
    updatedAt: document.updatedAt,
  };
  const source = { ...clone(document.source), studio, updatedAt: document.updatedAt };
  source.name = document.sections.identity.name;
  source.description = document.sections.identity.description;
  if (document.sections.material) {
    if (source.representation?.snapshot) source.representation = { ...source.representation, snapshot: clone(document.sections.material) };
    else source.material = clone(document.sections.material);
  }
  if (source.workingSet) {
    source.workingSet = {
      ...source.workingSet,
      context: clone(document.sections.context),
      lenses: clone(document.sections.lenses),
      branches: clone(document.sections.process?.branches || []),
    };
  } else {
    source.context = clone(document.sections.context);
    source.lenses = clone(document.sections.lenses);
  }
  source.process = clone(document.sections.process);
  source.outputs = clone(document.sections.outputs);
  source.canvas = clone(document.sections.canvas);
  source.soundscape = clone(document.sections.soundscape);
  source.parentOrbId = document.sections.relationships?.parentId || null;
  source.childOrbIds = clone(document.sections.relationships?.childIds || []);
  source.relatedIds = clone(document.sections.relationships?.relatedIds || []);
  if (document.sections.status === "archived") source.archived = true;
  if (document.sections.status === "accepted") source.accepted = true;
  if (document.sections.status === "deleted") source.deleted = true;
  return source;
}

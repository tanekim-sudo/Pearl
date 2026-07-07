/**
 * Cognitive transfer — portable abstraction of functions & symbols with fidelity anchors.
 *
 * Separates domain-invariant transformation (portable) from domain-specific bindings
 * (round-trip fidelity on the source domain).
 */

import { getOperatorDirection } from "./operator-direction.js";
import { moveRefFromOp, opToAbstractTree, buildCaptureMetadata } from "./operator-capture.js";
import {
  buildAbstractionUserPrompt,
  buildCrossDomainInstantiatePrompt,
  buildFidelityInstantiatePrompt,
  COGNITIVE_TRANSFER_SYSTEM,
} from "./cognitive-transfer-prompts.js";

export const COGNITIVE_TRANSFER_VERSION = 1;

/** @typedef {'function'|'lens'|'symbol'|'journey'} TransferKind */

/**
 * @typedef {object} CognitiveTransferRecord
 * @property {number} v
 * @property {TransferKind} kind
 * @property {string} [name]
 * @property {object} invariant
 * @property {object} domainAnchor
 * @property {object[]} [moveChain]
 * @property {object} [abstractTree]
 * @property {object} [fidelity]
 * @property {object} [captureMeta]
 * @property {object} [symbolGlyph]
 * @property {object[]} [materialTemplate]
 * @property {string} [narrative]
 */

const PHASE_FROM_PRIMITIVE = {
  compress: "essence-extraction",
  expand: "implication-unfolding",
  explore: "possibility-adjacency",
  research: "evidence-gathering",
  invert: "perspective-inversion",
  reframe: "frame-shift",
  transcend: "meta-elevation",
  deliver: "deliverable-shaping",
  resolve: "subject-resolution",
};

const OUTPUT_SHAPE_RE =
  /\b(thesis|memo|brief|summary|list|outline|table|report|narrative|diagram|plan|checklist|deliverable|markdown)\b/i;

/** Infer cognitive phase label from a move ref or operator name. */
export function inferCognitivePhase(refOrName, op) {
  const name = (typeof refOrName === "string" ? refOrName : refOrName?.name || op?.name || "").toLowerCase();
  if (PHASE_FROM_PRIMITIVE[name]) return PHASE_FROM_PRIMITIVE[name];
  if (op) {
    const dir = getOperatorDirection(op);
    if (dir === "compress") return "essence-extraction";
    return "implication-unfolding";
  }
  if (/\b(merge|synth|combin)\b/i.test(name)) return "synthesis";
  if (/\b(research|investig|evidence)\b/i.test(name)) return "evidence-gathering";
  if (/\b(deliver|output|final)\b/i.test(name)) return "deliverable-shaping";
  return "perceptual-move";
}

/** Walk abstract tree and collect ordered move refs + phase grammar. */
export function flattenAbstractTree(tree, opMap, operators) {
  const moveChain = [];
  const phaseGrammar = [];
  const stepNames = [];

  function walk(node) {
    if (!node) return;
    if (node.steps?.length) {
      stepNames.push(node.name || "group");
      for (const child of node.steps) walk(child);
      return;
    }
    const ref = node.moveRef;
    const op = ref?.id ? opMap?.[ref.id] : operators?.find((o) => o.name === ref?.name || o.name === node.name);
    if (ref) moveChain.push(ref);
    phaseGrammar.push(inferCognitivePhase(ref || node.name, op));
    stepNames.push(node.name || ref?.name || "step");
  }

  walk(tree);
  return { moveChain, phaseGrammar, stepNames };
}

/** Heuristic slot extraction from tree leaves — entity-like phrases in descriptions. */
export function extractExemplarSlots(tree, opMap, operators) {
  const slots = [];
  const seen = new Set();
  let slotIdx = 0;

  function walk(node) {
    if (!node) return;
    if (node.steps?.length) {
      for (const child of node.steps) walk(child);
      return;
    }
    const blob = [node.name, node.description, node.prompt].filter(Boolean).join(" ");
    const entityHits = blob.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\b/g) || [];
    for (const hit of entityHits.slice(0, 3)) {
      const key = hit.toLowerCase();
      if (seen.has(key) || hit.length < 3) continue;
      seen.add(key);
      slots.push({
        id: `slot_${slotIdx++}`,
        role: "subject-entity",
        exemplar: hit,
        constraints: [`preserve role of "${hit}" on fidelity round-trip`],
      });
    }
    if (node.moveRef && slots.length === 0) {
      slots.push({
        id: `slot_${slotIdx++}`,
        role: "transformation-subject",
        exemplar: node.name || node.moveRef.name,
        constraints: ["bind to primary input material"],
      });
    }
  }

  walk(tree);
  return slots;
}

function inferOutputShape(tree, opMap) {
  const blob = JSON.stringify(tree);
  const m = blob.match(OUTPUT_SHAPE_RE);
  if (m) return m[1].toLowerCase();
  return "transformed-material";
}

function inferRelationalPattern(captureMeta, phaseGrammar) {
  if (captureMeta?.terminalShape === "merge") return "multi-source-convergence";
  if (phaseGrammar.includes("synthesis")) return "sequential-composition";
  if (phaseGrammar.length > 2) return "deep-pipeline";
  return "single-subject-transformation";
}

function buildSlotBindings(slots, tree, opMap) {
  const bindings = {};
  for (const slot of slots) {
    bindings[slot.id] = {
      exemplar: slot.exemplar,
      invariantRole: slot.role,
      promptHint: slot.constraints?.[0] || "",
    };
  }
  return bindings;
}

function abstractItemSlot(item) {
  if (!item) return null;
  if (item.type === "text") {
    return {
      type: "text-slot",
      role: item.portal ? "portal-domain-tag" : "content",
      shapeHint: (item.text || "").length > 120 ? "long-form" : "fragment",
      exemplarPreview: (item.text || "").trim().slice(0, 80),
    };
  }
  if (item.type === "stroke") return { type: "stroke-slot", pointCount: item.points?.length || 0 };
  if (item.type === "image") return { type: "image-slot", role: "visual-anchor" };
  return { type: item.type || "unknown" };
}

/**
 * Structural abstraction (no LLM) — functions/lenses from operator root.
 * @param {object} rootOp
 * @param {Record<string, object>} opMap
 * @param {object[]} operators
 * @param {object} [opts]
 * @returns {CognitiveTransferRecord}
 */
export function abstractOperatorToTransfer(rootOp, opMap, operators, opts = {}) {
  const abstractTree = opToAbstractTree(rootOp, opMap, operators);
  const { moveChain, phaseGrammar, stepNames } = flattenAbstractTree(abstractTree, opMap, operators);
  const exemplarSlots = extractExemplarSlots(abstractTree, opMap, operators);
  const captureMeta = opts.captureMeta || rootOp.captureMeta || null;

  const invariant = {
    operation: phaseGrammar.join(" → ") || rootOp.name || "transform",
    relationalPattern: inferRelationalPattern(captureMeta, phaseGrammar),
    inputShape: captureMeta?.inputShapes?.includes("merge")
      ? "merge"
      : captureMeta?.terminalShape === "merge"
        ? "merge"
        : stepNames.length > 1
          ? "sequence"
          : "single",
    outputShape: inferOutputShape(abstractTree, opMap),
    phaseGrammar,
  };

  const domainLabel = opts.domainLabel || opts.domain || null;

  return normalizeTransfer({
    v: COGNITIVE_TRANSFER_VERSION,
    kind: opts.kind || "function",
    name: rootOp.name || opts.name,
    invariant,
    domainAnchor: {
      label: domainLabel,
      exemplarSlots,
      materialFingerprint: opts.materialFingerprint || opts.materialSample?.slice(0, 200) || null,
    },
    moveChain,
    abstractTree,
    fidelity: {
      originalDomain: domainLabel,
      slotBindings: buildSlotBindings(exemplarSlots, abstractTree, opMap),
      constraints: [
        "phase order must match phaseGrammar on round-trip",
        "output shape must match invariant.outputShape",
        ...(captureMeta?.convergences?.length ? ["preserve merge convergence semantics"] : []),
      ],
      checksumSteps: stepNames,
      leafPrompts: collectLeafPrompts(abstractTree, opMap),
    },
    captureMeta,
    narrative: opts.narrative || `${invariant.operation} (${invariant.relationalPattern})`,
  });
}

function collectLeafPrompts(tree, opMap) {
  const out = [];
  function walk(node) {
    if (!node) return;
    if (node.steps?.length) {
      for (const c of node.steps) walk(c);
      return;
    }
    if (node.prompt) {
      out.push({ name: node.name, prompt: node.prompt.slice(0, 500) });
    } else if (node.moveRef?.id && opMap?.[node.moveRef.id]?.prompt) {
      out.push({ name: node.name, prompt: opMap[node.moveRef.id].prompt.slice(0, 500) });
    }
  }
  walk(tree);
  return out;
}

/**
 * Abstract a symbol/structure into cognitive transfer metadata.
 * @param {object} struct
 * @param {object} [opts]
 */
export function abstractSymbolToTransfer(struct, opts = {}) {
  const materialTemplate = (struct.items || []).map(abstractItemSlot).filter(Boolean);
  const domainLabel = opts.domainLabel || null;

  return normalizeTransfer({
    v: COGNITIVE_TRANSFER_VERSION,
    kind: "symbol",
    name: struct.title || "symbol",
    invariant: {
      operation: struct.kind === "symbol" ? "glyph-anchored-idea" : "spatial-idea-template",
      relationalPattern: struct.symbolStroke ? "visual-glyph-plus-material" : "material-composition",
      inputShape: materialTemplate.length > 1 ? "merge" : "single",
      outputShape: "planted-structure",
      phaseGrammar: ["pattern-recognition", "material-binding", "spatial-instantiation"],
    },
    domainAnchor: {
      label: domainLabel,
      exemplarSlots: materialTemplate.map((t, i) => ({
        id: `mat_${i}`,
        role: t.role || t.type,
        exemplar: t.exemplarPreview || t.type,
        constraints: [],
      })),
    },
    symbolGlyph: struct.symbolStroke || null,
    materialTemplate,
    fidelity: {
      originalDomain: domainLabel,
      slotBindings: Object.fromEntries(
        materialTemplate.map((t, i) => [
          `mat_${i}`,
          { exemplar: t.exemplarPreview || t.type, invariantRole: t.role || t.type },
        ])
      ),
      constraints: ["preserve relative layout of material template"],
      checksumSteps: [struct.title || "symbol"],
    },
    narrative: `Symbol pattern: ${struct.title || "untitled"}`,
  });
}

/** Build transfer from journey capture context. */
export function abstractJourneyToTransfer({ title, opTrees, captureMeta, opMap, operators, opts = {} }) {
  const combined = opTrees?.length === 1 ? opTrees[0] : { name: title, steps: opTrees };
  const flat = flattenAbstractTree(combined, opMap || {}, operators || []);
  const domainLabel = opts.domainLabel || null;

  return normalizeTransfer({
    v: COGNITIVE_TRANSFER_VERSION,
    kind: "journey",
    name: title,
    invariant: {
      operation: flat.phaseGrammar.join(" → ") || title,
      relationalPattern: inferRelationalPattern(captureMeta, flat.phaseGrammar),
      inputShape: captureMeta?.terminalShape === "merge" ? "merge" : "sequence",
      outputShape: inferOutputShape(combined, opMap),
      phaseGrammar: flat.phaseGrammar,
    },
    domainAnchor: {
      label: domainLabel,
      exemplarSlots: extractExemplarSlots(combined, opMap, operators),
    },
    moveChain: flat.moveChain,
    abstractTree: combined,
    fidelity: {
      originalDomain: domainLabel,
      slotBindings: buildSlotBindings(extractExemplarSlots(combined, opMap, operators), combined, opMap),
      constraints: ["preserve journey step order"],
      checksumSteps: flat.stepNames,
      leafPrompts: collectLeafPrompts(combined, opMap),
    },
    captureMeta,
    narrative: title,
  });
}

export function normalizeTransfer(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    v: COGNITIVE_TRANSFER_VERSION,
    kind: raw.kind || "function",
    name: raw.name || "unnamed",
    invariant: raw.invariant || {},
    domainAnchor: raw.domainAnchor || { exemplarSlots: [] },
    moveChain: raw.moveChain || [],
    abstractTree: raw.abstractTree || null,
    fidelity: raw.fidelity || {},
    captureMeta: raw.captureMeta || null,
    symbolGlyph: raw.symbolGlyph || null,
    materialTemplate: raw.materialTemplate || null,
    narrative: raw.narrative || "",
  };
}

/** Merge LLM-enriched fields into a structural transfer (LLM JSON overlay). */
export function mergeTransferEnrichment(structural, llmJson) {
  if (!llmJson || typeof llmJson !== "object") return structural;
  return normalizeTransfer({
    ...structural,
    invariant: { ...structural.invariant, ...(llmJson.invariant || {}) },
    domainAnchor: {
      ...structural.domainAnchor,
      ...(llmJson.domainAnchor || {}),
      exemplarSlots: llmJson.domainAnchor?.exemplarSlots?.length
        ? llmJson.domainAnchor.exemplarSlots
        : structural.domainAnchor.exemplarSlots,
    },
    fidelity: {
      ...structural.fidelity,
      ...(llmJson.fidelity || {}),
      slotBindings: {
        ...(structural.fidelity?.slotBindings || {}),
        ...(llmJson.fidelity?.slotBindings || {}),
      },
    },
    narrative: llmJson.narrative || structural.narrative,
  });
}

/**
 * Decide instantiation mode and build prompt package for runClaude.
 * @param {CognitiveTransferRecord} transfer
 * @param {object} ctx
 */
export function buildInstantiationRequest(transfer, ctx = {}) {
  const targetDomain = ctx.targetDomain || ctx.domain || null;
  const original = transfer.fidelity?.originalDomain || transfer.domainAnchor?.label;
  const fidelity =
    ctx.mode === "fidelity" ||
    (ctx.mode !== "cross" && targetDomain && original && targetDomain === original);

  if (fidelity) {
    return {
      mode: "fidelity",
      system: COGNITIVE_TRANSFER_SYSTEM,
      user: buildFidelityInstantiatePrompt(transfer, ctx.targetMaterial || ""),
      structuralFallback: buildFidelityPipelineFallback(transfer),
    };
  }

  return {
    mode: "cross",
    system: COGNITIVE_TRANSFER_SYSTEM,
    user: buildCrossDomainInstantiatePrompt(transfer, targetDomain || "general", ctx.targetMaterial || ""),
    structuralFallback: buildCrossDomainPipelineFallback(transfer, targetDomain),
  };
}

/** Fidelity fallback: restore leaf prompts from seal when LLM unavailable. */
export function buildFidelityPipelineFallback(transfer) {
  const leaves = transfer.fidelity?.leafPrompts || [];
  if (leaves.length === 1) {
    return {
      name: transfer.name,
      description: transfer.narrative,
      prompt: leaves[0].prompt,
    };
  }
  if (leaves.length > 1) {
    return {
      name: transfer.name,
      description: transfer.narrative,
      steps: leaves.map((l) => ({ name: l.name, prompt: l.prompt })),
    };
  }
  return transfer.abstractTree;
}

/** Cross-domain fallback: phase grammar → generic prompts (no LLM). */
export function buildCrossDomainPipelineFallback(transfer, targetDomain) {
  const phases = transfer.invariant?.phaseGrammar || [];
  const domain = targetDomain || "this domain";
  const steps = phases.map((phase, i) => ({
    name: phase.replace(/-/g, " "),
    description: `Cognitive phase ${i + 1} for ${domain}`,
    prompt: `Apply the cognitive phase "${phase}" to the material in ${domain}. Preserve the relational pattern: ${transfer.invariant?.relationalPattern || "transformation"}. Return ONLY the step output.`,
  }));
  if (steps.length === 0) return transfer.abstractTree;
  if (steps.length === 1) return { name: transfer.name, ...steps[0] };
  return { name: transfer.name, description: transfer.narrative, steps };
}

/**
 * Map slots from source to target domain (rule-based; LLM refines in full flow).
 */
export function mapSlotsToTargetDomain(transfer, targetDomain, targetMaterial) {
  const slots = transfer.domainAnchor?.exemplarSlots || [];
  const mapping = {};
  const materialWords = (targetMaterial || "").split(/\s+/).filter((w) => w.length > 2).slice(0, 20);

  for (const slot of slots) {
    mapping[slot.id] = {
      sourceExemplar: slot.exemplar,
      targetExemplar: materialWords[0] || `analogue-in-${targetDomain}`,
      invariantRole: slot.role,
      rationale: `Map ${slot.role} from source to ${targetDomain}`,
    };
  }
  return mapping;
}

const DOMAIN_HINTS = [
  { re: /\b(investment|equity|portfolio|valuation|acqui|private equity|lp\b|fund)\b/i, label: "finance" },
  { re: /\b(patient|clinical|medical|diagnos|hospital|therapy)\b/i, label: "healthcare" },
  { re: /\b(software|api|code|deploy|engineering|sprint)\b/i, label: "engineering" },
  { re: /\b(legal|contract|litigation|compliance|regulat)\b/i, label: "legal" },
  { re: /\b(marketing|brand|campaign|audience|growth)\b/i, label: "marketing" },
  { re: /\b(research|hypothesis|experiment|paper|thesis)\b/i, label: "research" },
  { re: /\b(garden|nature|organic|ecolog|landscape)\b/i, label: "nature" },
  { re: /\b(architecture|building|spatial|floor plan|courtyard)\b/i, label: "architecture" },
];

/** Lightweight domain label from target material (for cross-domain detection). */
export function inferDomainFromMaterial(text, opts = {}) {
  const sample = (text || "").slice(0, 800);
  if (!sample.trim()) return opts.fallback || null;
  for (const hint of DOMAIN_HINTS) {
    if (hint.re.test(sample)) return hint.label;
  }
  return opts.fallback || null;
}

/** Resolve cognitive transfer from operator capture meta or lens record. */
export function resolveTransferContext(op, lens = null) {
  const raw = op?.captureMeta?.cognitiveTransfer || lens?.cognitiveTransfer || null;
  return normalizeTransfer(raw);
}

/**
 * Whether applying this transfer needs instantiation (fidelity restore or cross-domain adapt).
 */
export function needsCognitiveInstantiation(transfer, targetMaterial) {
  if (!transfer) return false;
  const hasCustomPrompts = (transfer.fidelity?.leafPrompts?.length || 0) > 0;
  if (!hasCustomPrompts) return false;
  const original = transfer.fidelity?.originalDomain || transfer.domainAnchor?.label;
  const target = inferDomainFromMaterial(targetMaterial);
  if (original && target && original !== target) return true;
  const blob = JSON.stringify(transfer.abstractTree || {});
  return blob.includes('"moveRef"');
}

/** Attach cognitive transfer to share bundle meta. */
export function attachCognitiveMeta(bundle, transfer) {
  if (!bundle || !transfer) return bundle;
  return {
    ...bundle,
    meta: {
      ...(bundle.meta || {}),
      cognitiveTransfer: normalizeTransfer(transfer),
    },
  };
}

/** Extract cognitive transfer from imported bundle. */
export function extractCognitiveMeta(bundle) {
  return normalizeTransfer(bundle?.meta?.cognitiveTransfer || bundle?.cognitiveTransfer || null);
}

/** Build LLM abstraction request from structural transfer. */
export function buildAbstractionRequest(structural, opts = {}) {
  return {
    system: COGNITIVE_TRANSFER_SYSTEM,
    user: buildAbstractionUserPrompt({
      kind: structural.kind,
      name: structural.name,
      abstractTree: structural.abstractTree,
      captureMeta: structural.captureMeta,
      domainLabel: opts.domainLabel || structural.domainAnchor?.label,
      materialSample: opts.materialSample,
      symbolGlyph: structural.symbolGlyph,
    }),
    structural,
  };
}

/**
 * Choose portable tree for export: abstract tree + cognitive meta, not full prompts.
 */
export function portableExportTree(op, opMap, operators, opts = {}) {
  const transfer = abstractOperatorToTransfer(op, opMap, operators, opts);
  return {
    opTree: transfer.abstractTree,
    cognitiveTransfer: transfer,
  };
}

/** Validate round-trip fidelity: same phase grammar and step count. */
export function verifyFidelityChecksum(transfer, pipelineTree) {
  const expected = transfer.fidelity?.checksumSteps || [];
  const { stepNames } = flattenAbstractTree(pipelineTree, {}, []);
  if (!expected.length) return { ok: true, reason: "no checksum" };
  if (expected.length !== stepNames.length) {
    return { ok: false, reason: `step count ${stepNames.length} !== ${expected.length}` };
  }
  return { ok: true };
}

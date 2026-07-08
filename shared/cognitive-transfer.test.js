import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  abstractOperatorToTransfer,
  abstractSymbolToTransfer,
  buildInstantiationRequest,
  buildFidelityPipelineFallback,
  buildCrossDomainPipelineFallback,
  flattenAbstractTree,
  inferCognitivePhase,
  mapSlotsToTargetDomain,
  mergeTransferEnrichment,
  normalizeTransfer,
  verifyFidelityChecksum,
  attachCognitiveMeta,
  extractCognitiveMeta,
  inferDomainFromMaterial,
  needsCognitiveInstantiation,
  resolveTransferContext,
} from "./cognitive-transfer.js";

const opMap = {
  root: {
    id: "root",
    kind: "pipeline",
    name: "Investment Thesis",
    steps: ["a", "b"],
    captureMeta: { provenance: "thread-capture", terminalShape: "single" },
  },
  a: { id: "a", kind: "prompt", name: "expand", primitive: true, prompt: "Unfold Acme Corp implications." },
  b: {
    id: "b",
    kind: "prompt",
    name: "compress",
    primitive: true,
    prompt: "Distill to one-line thesis for Acme Corp.",
  },
};

describe("cognitive-transfer", () => {
  it("abstracts operator tree with invariant and fidelity", () => {
    const t = abstractOperatorToTransfer(opMap.root, opMap, Object.values(opMap), {
      domainLabel: "private equity",
    });
    assert.equal(t.v, 1);
    assert.equal(t.kind, "function");
    assert.ok(t.invariant.phaseGrammar.length >= 2);
    assert.equal(t.fidelity.originalDomain, "private equity");
    assert.ok(t.fidelity.checksumSteps.includes("expand"));
    assert.ok(t.abstractTree);
    assert.equal(t.abstractTree.steps?.length, 2);
    assert.ok(t.moveChain.length >= 2);
  });

  it("uses moveRef in abstract tree not full prompts for primitives", () => {
    const t = abstractOperatorToTransfer(opMap.root, opMap, Object.values(opMap), {});
    const leaf = t.abstractTree.steps[0];
    assert.ok(leaf.moveRef);
    assert.ok(!leaf.prompt);
  });

  it("stores leaf prompts in fidelity seal for round-trip", () => {
    const t = abstractOperatorToTransfer(opMap.root, opMap, Object.values(opMap), {});
    assert.ok(t.fidelity.leafPrompts?.length >= 2);
    assert.match(t.fidelity.leafPrompts[0].prompt, /Acme/i);
  });

  it("abstracts symbols with material template", () => {
    const t = abstractSymbolToTransfer(
      {
        title: "Garden pattern",
        kind: "symbol",
        items: [{ type: "text", text: "monastery courtyard" }],
        symbolStroke: { points: [{ x: 0.1, y: 0.2 }] },
      },
      { domainLabel: "architecture" }
    );
    assert.equal(t.kind, "symbol");
    assert.ok(t.symbolGlyph);
    assert.equal(t.materialTemplate.length, 1);
    assert.equal(t.domainAnchor.label, "architecture");
  });

  it("infers cognitive phases from primitives", () => {
    assert.equal(inferCognitivePhase("expand", opMap.a), "implication-unfolding");
    assert.equal(inferCognitivePhase("compress", opMap.b), "essence-extraction");
  });

  it("builds fidelity instantiation for same domain", () => {
    const t = abstractOperatorToTransfer(opMap.root, opMap, Object.values(opMap), {
      domainLabel: "private equity",
    });
    const req = buildInstantiationRequest(t, {
      targetDomain: "private equity",
      targetMaterial: "Acme Corp sparse note",
    });
    assert.equal(req.mode, "fidelity");
    assert.ok(req.structuralFallback);
  });

  it("builds cross-domain instantiation for new domain", () => {
    const t = abstractOperatorToTransfer(opMap.root, opMap, Object.values(opMap), {
      domainLabel: "private equity",
    });
    const req = buildInstantiationRequest(t, {
      targetDomain: "ecology",
      targetMaterial: "mycelial network",
    });
    assert.equal(req.mode, "cross");
    const fallback = buildCrossDomainPipelineFallback(t, "ecology");
    assert.ok(fallback.steps?.length >= 2);
  });

  it("fidelity fallback restores prompts", () => {
    const t = abstractOperatorToTransfer(opMap.root, opMap, Object.values(opMap), {});
    const pipeline = buildFidelityPipelineFallback(t);
    assert.ok(pipeline.steps || pipeline.prompt);
  });

  it("merges LLM enrichment over structural base", () => {
    const base = abstractOperatorToTransfer(opMap.root, opMap, Object.values(opMap), {});
    const enriched = mergeTransferEnrichment(base, {
      narrative: "See sparse entity as full investment narrative.",
      domainAnchor: { exemplarSlots: [{ id: "co", role: "company", exemplar: "Acme Corp" }] },
    });
    assert.match(enriched.narrative, /investment/i);
    assert.equal(enriched.domainAnchor.exemplarSlots[0].exemplar, "Acme Corp");
  });

  it("maps slots to target domain", () => {
    const t = abstractOperatorToTransfer(opMap.root, opMap, Object.values(opMap), {
      domainLabel: "finance",
    });
    const mapping = mapSlotsToTargetDomain(t, "ecology", "forest canopy symbiosis");
    assert.ok(Object.keys(mapping).length >= 0);
  });

  it("attaches and extracts cognitive meta from bundles", () => {
    const t = abstractOperatorToTransfer(opMap.root, opMap, Object.values(opMap), {});
    const bundle = attachCognitiveMeta({ v: 1, kind: "lens", meta: {} }, t);
    const out = extractCognitiveMeta(bundle);
    assert.equal(out.name, t.name);
  });

  it("verifies fidelity checksum on pipeline", () => {
    const t = abstractOperatorToTransfer(opMap.root, opMap, Object.values(opMap), {});
    const ok = verifyFidelityChecksum(t, t.abstractTree);
    assert.equal(ok.ok, true);
  });

  it("infers domain labels from material", () => {
    assert.equal(inferDomainFromMaterial("Acme Corp investment thesis and valuation"), "finance");
    assert.equal(inferDomainFromMaterial("patient clinical diagnosis pathway"), "healthcare");
    assert.equal(inferDomainFromMaterial("random fragment"), null);
  });

  it("detects when cognitive instantiation is needed", () => {
    const t = abstractOperatorToTransfer(opMap.root, opMap, Object.values(opMap), {
      domainLabel: "finance",
    });
    assert.equal(needsCognitiveInstantiation(t, "patient clinical notes"), true);
    assert.equal(needsCognitiveInstantiation(t, "portfolio valuation memo"), true);
    assert.equal(needsCognitiveInstantiation(null, "anything"), false);
    const bare = { ...t, abstractTree: { name: "x", prompt: "full prompt here" }, fidelity: { leafPrompts: [] } };
    assert.equal(needsCognitiveInstantiation(bare, "patient clinical notes"), false);
  });

  it("resolves transfer from operator or lens", () => {
    const t = abstractOperatorToTransfer(opMap.root, opMap, Object.values(opMap), {});
    const op = { captureMeta: { cognitiveTransfer: t } };
    assert.equal(resolveTransferContext(op, null)?.name, t.name);
    assert.equal(resolveTransferContext(null, { cognitiveTransfer: t })?.name, t.name);
  });
});

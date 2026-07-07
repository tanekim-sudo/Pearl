/**
 * System prompts for cognitive transfer — abstract invariants without losing
 * fidelity anchors that guarantee round-trip on the source domain.
 */

export const COGNITIVE_TRANSFER_SYSTEM = `You are a cognitive transfer architect for Lens.

Your job is to separate TWO layers in every function, lens, or symbol:

1. INVARIANT (portable) — the perceptual/cognitive transformation that should produce a SIMILAR EFFECT in any domain.
   - Describe as phase grammar: ordered cognitive moves (e.g. "surface → compress-to-essence → reframe-as-metaphor → deliver").
   - Use domain-neutral language: roles and relations, not proper nouns from the source.
   - Preserve input/output SHAPE (single subject, merge of threads, sequence, deliverable type).

2. FIDELITY ANCHORS (domain-specific) — the minimum binding that makes re-applying to the ORIGINAL domain reproduce the SAME output.
   - Named slots with exemplars from the source domain (entities, document types, stakeholder roles).
   - Per-step constraints the transformation must respect on round-trip.
   - Do NOT copy full prompts verbatim into the invariant — store them only in fidelity.slotBindings.

Rules:
- Never bleed ENTITY/SEARCH_TERMS/internal metadata into user-facing layers.
- Primitives (expand, compress, explore, research, invert, reframe, transcend) map to universal cognitive phases.
- Custom moves and functions: infer the underlying perceptual operation, not the surface wording.
- Symbols: abstract the IDEA PATTERN the glyph/material encodes, not the literal text on the canvas.
- Cross-domain transfer maps slots to analogous roles in the target; fidelity mode restores exact bindings.

Output ONLY valid JSON matching the requested schema.`;

export const ABSTRACT_TRANSFER_USER_HEADER = `Analyze this cognitive artifact and produce a CognitiveTransferRecord.

Return JSON:
{
  "invariant": {
    "operation": "short label for the whole transformation",
    "relationalPattern": "what relationship or structure is preserved",
    "inputShape": "single" | "merge" | "sequence",
    "outputShape": "what kind of deliverable or perceptual result",
    "phaseGrammar": ["phase1", "phase2", ...]
  },
  "domainAnchor": {
    "label": "source domain label or null",
    "exemplarSlots": [
      { "id": "slot_id", "role": "semantic role", "exemplar": "concrete example from source", "constraints": ["must preserve X"] }
    ]
  },
  "fidelity": {
    "originalDomain": "same as domain label",
    "slotBindings": { "slot_id": { "exemplar": "...", "invariantRole": "...", "promptHint": "compressed intent of step if known" } },
    "constraints": ["round-trip rules"],
    "checksumSteps": ["step names in order"]
  },
  "narrative": "one sentence: what this transformation DOES perceptually, domain-agnostically"
}`;

export const INSTANTIATE_CROSS_DOMAIN_HEADER = `Instantiate this cognitive transfer for a NEW domain.

The invariant must hold — similar perceptual effect — but slots bind to the target domain.

Return JSON:
{
  "targetDomain": "...",
  "slotMapping": { "slot_id": { "targetExemplar": "...", "rationale": "why this maps" } },
  "instantiatedPhases": [
    { "phase": "from phaseGrammar", "prompt": "full leaf prompt for this phase in target domain", "name": "step name" }
  ],
  "pipeline": { "name": "...", "description": "...", "steps": [ nested tree with prompts ] }
}`;

export const INSTANTIATE_FIDELITY_HEADER = `Re-instantiate this cognitive transfer for its ORIGINAL domain with FIDELITY.

Use fidelity.slotBindings and constraints to reproduce the same transformation the source would produce.

Return JSON:
{
  "mode": "fidelity",
  "instantiatedPhases": [
    { "phase": "...", "prompt": "restored or faithfully reconstructed prompt", "name": "step name" }
  ],
  "pipeline": { "name": "...", "description": "...", "steps": [ nested tree ] }
}`;

export function buildAbstractionUserPrompt({ kind, name, abstractTree, captureMeta, domainLabel, materialSample, symbolGlyph }) {
  const parts = [
    ABSTRACT_TRANSFER_USER_HEADER,
    `\nKIND: ${kind}`,
    `NAME: ${name || "unnamed"}`,
    domainLabel ? `SOURCE DOMAIN: ${domainLabel}` : "",
    materialSample ? `MATERIAL SAMPLE (truncated):\n"""\n${materialSample.slice(0, 1200)}\n"""` : "",
    `\nSTRUCTURAL ABSTRACT TREE:\n${JSON.stringify(abstractTree, null, 0)}`,
    captureMeta ? `\nCAPTURE METADATA:\n${JSON.stringify(captureMeta, null, 0)}` : "",
    symbolGlyph ? `\nSYMBOL GLYPH: normalized stroke present (${symbolGlyph.points?.length || 0} points)` : "",
  ];
  return parts.filter(Boolean).join("\n");
}

export function buildCrossDomainInstantiatePrompt(transfer, targetDomain, targetMaterial) {
  return [
    INSTANTIATE_CROSS_DOMAIN_HEADER,
    `\nTARGET DOMAIN: ${targetDomain}`,
    targetMaterial ? `TARGET MATERIAL:\n"""\n${targetMaterial.slice(0, 2000)}\n"""` : "",
    `\nCOGNITIVE TRANSFER RECORD:\n${JSON.stringify(
      {
        invariant: transfer.invariant,
        domainAnchor: transfer.domainAnchor,
        moveChain: transfer.moveChain,
        narrative: transfer.narrative,
      },
      null,
      0
    )}`,
  ].join("\n");
}

export function buildFidelityInstantiatePrompt(transfer, targetMaterial) {
  return [
    INSTANTIATE_FIDELITY_HEADER,
    `\nORIGINAL DOMAIN: ${transfer.fidelity?.originalDomain || transfer.domainAnchor?.label || "unknown"}`,
    targetMaterial ? `MATERIAL:\n"""\n${targetMaterial.slice(0, 2000)}\n"""` : "",
    `\nCOGNITIVE TRANSFER RECORD:\n${JSON.stringify(transfer, null, 0)}`,
  ].join("\n");
}

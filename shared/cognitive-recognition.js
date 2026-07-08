/**
 * Cross-domain recognition — where else a portable operator might apply.
 */

import { inferDomainFromMaterial, resolveTransferContext } from "./cognitive-transfer.js";

/** Domains users can explicitly test an operator against. */
export const EXPLORABLE_DOMAINS = [
  "finance",
  "healthcare",
  "engineering",
  "legal",
  "marketing",
  "research",
  "nature",
  "architecture",
  "education",
  "product",
];

export function sourceDomainOf(transfer) {
  return transfer?.fidelity?.originalDomain || transfer?.domainAnchor?.label || null;
}

export function phaseChainLabel(transfer) {
  const phases = transfer?.invariant?.phaseGrammar || [];
  if (!phases.length) return transfer?.invariant?.operation || transfer?.name || "transformation";
  return phases.map((p) => p.replace(/-/g, " ")).join(" → ");
}

/** Domains worth trying — everything except where it was learned. */
export function suggestDomainsForTransfer(transfer) {
  const source = sourceDomainOf(transfer);
  if (!source) return [...EXPLORABLE_DOMAINS];
  return EXPLORABLE_DOMAINS.filter((d) => d !== source);
}

/**
 * Short hint when material domain differs from where an operator was learned.
 * @returns {string | null}
 */
export function recognitionHint(transfer, material) {
  if (!transfer || !String(material || "").trim()) return null;
  const source = sourceDomainOf(transfer);
  const target = inferDomainFromMaterial(material);
  const name = transfer.name || "this operator";
  if (source && target && source !== target) {
    return `“${name}” was learned in ${source} — your material looks like ${target}. The pattern may still apply.`;
  }
  if (!source && target) {
    return `“${name}” may transfer to ${target} material.`;
  }
  if (source && !target) {
    return `“${name}” carries a ${source} pattern — try it on unfamiliar material.`;
  }
  return null;
}

/**
 * Operators whose learned domain differs from the current material — cross-domain candidates.
 * @returns {{ op: object, transfer: object, reason: string }[]}
 */
export function matchingOperatorsForMaterial(operators, material, opMap = {}) {
  const sample = String(material || "").trim();
  if (!sample) return [];
  const target = inferDomainFromMaterial(sample);
  if (!target) return [];

  const hits = [];
  const seen = new Set();
  for (const op of operators || []) {
    if (!op?.id || seen.has(op.id)) continue;
    const transfer = resolveTransferContext(op);
    if (!transfer?.invariant?.phaseGrammar?.length && !transfer?.fidelity?.leafPrompts?.length) continue;
    const source = sourceDomainOf(transfer);
    if (!source || source === target) continue;
    seen.add(op.id);
    hits.push({
      op,
      transfer,
      reason: `${source} → ${target}`,
    });
  }
  return hits.slice(0, 4);
}

/** Whether an operator has enough transfer metadata to explore portability. */
export function isPortableOperator(op) {
  const transfer = resolveTransferContext(op);
  if (!transfer) return false;
  return (
    (transfer.invariant?.phaseGrammar?.length || 0) > 0 ||
    (transfer.fidelity?.leafPrompts?.length || 0) > 0 ||
    !!transfer.abstractTree
  );
}

/** Use-case bullets from cognitive transfer (for share welcome). */
export function transferUseCaseBullets(transfer, name) {
  if (!transfer) return null;
  const phases = phaseChainLabel(transfer);
  const source = sourceDomainOf(transfer);
  const others = suggestDomainsForTransfer(transfer).slice(0, 3);
  const bullets = [
    `Portable pattern: ${phases}`,
    source ? `Learned in ${source} — works beyond that context` : "Domain-independent transformation pattern",
  ];
  if (others.length) {
    bullets.push(`Try on ${others.join(", ")} material`);
  } else {
    bullets.push(`Apply “${name}” to any note on your board`);
  }
  return bullets.slice(0, 3);
}

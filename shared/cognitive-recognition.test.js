import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  EXPLORABLE_DOMAINS,
  isPortableOperator,
  matchingOperatorsForMaterial,
  phaseChainLabel,
  recognitionHint,
  sourceDomainOf,
  suggestDomainsForTransfer,
  transferUseCaseBullets,
} from "./cognitive-recognition.js";

describe("cognitive-recognition", () => {
  const transfer = {
    name: "distill thesis",
    invariant: { phaseGrammar: ["essence-extraction", "deliverable-shaping"] },
    fidelity: { originalDomain: "finance", leafPrompts: [{ name: "compress", prompt: "x" }] },
    domainAnchor: { label: "finance" },
  };

  it("sourceDomainOf reads fidelity and anchor", () => {
    assert.equal(sourceDomainOf(transfer), "finance");
    assert.equal(sourceDomainOf({ domainAnchor: { label: "legal" } }), "legal");
  });

  it("phaseChainLabel formats grammar", () => {
    assert.match(phaseChainLabel(transfer), /essence extraction/);
  });

  it("suggestDomainsForTransfer excludes source", () => {
    const domains = suggestDomainsForTransfer(transfer);
    assert.ok(domains.length > 0);
    assert.ok(!domains.includes("finance"));
    assert.ok(domains.every((d) => EXPLORABLE_DOMAINS.includes(d)));
  });

  it("recognitionHint surfaces cross-domain opportunity", () => {
    const hint = recognitionHint(transfer, "The patient diagnosis pathway needs review.");
    assert.ok(hint?.includes("healthcare"));
    assert.ok(hint?.includes("finance"));
  });

  it("matchingOperatorsForMaterial finds portable ops", () => {
    const op = {
      id: "op1",
      name: "distill thesis",
      captureMeta: { cognitiveTransfer: transfer },
    };
    const hits = matchingOperatorsForMaterial([op], "patient clinical trial outcomes", {});
    assert.equal(hits.length, 1);
    assert.equal(hits[0].op.id, "op1");
    assert.match(hits[0].reason, /finance/);
  });

  it("isPortableOperator checks transfer depth", () => {
    assert.equal(isPortableOperator({ captureMeta: { cognitiveTransfer: transfer } }), true);
    assert.equal(isPortableOperator({ name: "bare" }), false);
  });

  it("transferUseCaseBullets builds share copy", () => {
    const bullets = transferUseCaseBullets(transfer, "distill thesis");
    assert.equal(bullets.length, 3);
    assert.ok(bullets[0].includes("essence"));
  });
});

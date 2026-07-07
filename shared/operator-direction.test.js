import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  TRANSFORM_PRIMITIVES,
} from "./transform-primitives.js";
import {
  getOperatorDirection,
  isCompressionOperator,
  isExpansionOperator,
  partitionOperatorsByDirection,
  COMPRESSION_PRIMITIVE_IDS,
  EXPANSION_PRIMITIVE_IDS,
} from "./operator-direction.js";

describe("operator direction", () => {
  it("maps every canonical primitive to a side", () => {
    for (const p of TRANSFORM_PRIMITIVES) {
      assert.ok(COMPRESSION_PRIMITIVE_IDS.has(p.id) || EXPANSION_PRIMITIVE_IDS.has(p.id), p.name);
    }
    assert.equal(COMPRESSION_PRIMITIVE_IDS.size + EXPANSION_PRIMITIVE_IDS.size, TRANSFORM_PRIMITIVES.length);
  });

  it("classifies compression primitives", () => {
    assert.equal(getOperatorDirection({ id: "op-compress", name: "compress" }), "compress");
    assert.ok(isCompressionOperator(TRANSFORM_PRIMITIVES.find((p) => p.name === "compress")));
  });

  it("classifies expansion primitives", () => {
    assert.equal(getOperatorDirection({ id: "op-expand", name: "expand" }), "expand");
    assert.equal(getOperatorDirection({ id: "op-invert", name: "invert" }), "expand");
    assert.ok(isExpansionOperator(TRANSFORM_PRIMITIVES.find((p) => p.name === "explore")));
    assert.ok(isExpansionOperator(TRANSFORM_PRIMITIVES.find((p) => p.name === "research")));
  });

  it("respects explicit direction field", () => {
    assert.equal(getOperatorDirection({ name: "compress story", direction: "expand" }), "expand");
    assert.equal(getOperatorDirection({ name: "grow", direction: "compress" }), "compress");
  });

  it("heuristically classifies custom moves", () => {
    assert.equal(getOperatorDirection({ name: "distill to thesis", move: true }), "compress");
    assert.equal(getOperatorDirection({ name: "unfold implications", move: true }), "expand");
  });

  it("partitions mixed operator lists", () => {
    const ops = [
      { id: "op-compress", name: "compress" },
      { id: "op-expand", name: "expand" },
      { name: "summarize thread", move: true },
    ];
    const { compression, expansion } = partitionOperatorsByDirection(ops);
    assert.equal(compression.length, 2);
    assert.equal(expansion.length, 1);
  });
});

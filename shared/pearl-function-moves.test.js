import assert from "node:assert/strict";
import test from "node:test";
import { buildInvestorRolePearlScaffold } from "./role-pearl-scaffold.js";
import { createPearlEntity } from "./pearl-entity.js";
import { createSemanticOrb } from "./semantic-orbs.js";
import {
  decomposeFunctionMove,
  orderedMovesFromFunction,
  reorderFunctionMoves,
  summarizePearlFunctions,
} from "./pearl-function-moves.js";

test("investor scaffold Functions keep named ordered Moves through entity mapping", () => {
  const scaffold = buildInvestorRolePearlScaffold({ utterance: "make me an investor pearl" });
  const entity = createPearlEntity(createSemanticOrb({ ...scaffold.pearl, id: "investor-1" }));
  const memo = entity.functions.find((fn) => /investment memo/i.test(fn.name));
  assert.ok(memo, "Investment memo Function present");
  const moves = orderedMovesFromFunction(memo);
  assert.ok(moves.length >= 5, `expected ≥5 memo moves, got ${moves.length}`);
  assert.match(moves[0].name, /thesis/i);
  assert.match(moves.at(-1).name, /recommend/i);
  const summary = summarizePearlFunctions(entity);
  assert.ok(summary.some((entry) => /investment memo/i.test(entry.name) && entry.moveCount >= 5));
});

test("reorderFunctionMoves persists new order in steps and graph", () => {
  const fn = {
    id: "f1",
    name: "Memo",
    steps: [
      { id: "a", name: "First", description: "A" },
      { id: "b", name: "Second", description: "B" },
      { id: "c", name: "Third", description: "C" },
    ],
  };
  const result = reorderFunctionMoves(fn, 0, 2);
  assert.equal(result.ok, true);
  assert.deepEqual(result.moves.map((m) => m.name), ["Second", "Third", "First"]);
  assert.equal(result.function.graph.nodes[0].name, "Second");
  assert.equal(result.function.graph.edges[0].relation, "then");
});

test("decomposeFunctionMove expands a compound move into sub-moves", () => {
  const fn = {
    id: "f1",
    name: "Memo",
    steps: [
      { id: "a", name: "Assess", description: "Check market and validate team and size risk" },
      { id: "b", name: "Close", description: "Write recommendation" },
    ],
  };
  const result = decomposeFunctionMove(fn, 0);
  assert.equal(result.ok, true);
  assert.ok(result.moves.length >= 3);
  assert.ok(result.moves.some((m) => /market/i.test(m.name)));
});

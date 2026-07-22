import assert from "node:assert/strict";
import test from "node:test";
import {
  compileScreenMatchCondition,
  findTextMatches,
  MAX_SCREEN_MATCHES,
  matchRectsForPowerFx,
} from "./pearl-screen-match.js";

test("compiles substring, any-of, and regex conditions", () => {
  assert.equal(compileScreenMatchCondition("limited partner").type, "substring");
  assert.equal(compileScreenMatchCondition("alpha or beta").type, "any");
  assert.equal(compileScreenMatchCondition("/LP\\d+/i").type, "regex");
  assert.equal(compileScreenMatchCondition(""), null);
});

test("findTextMatches returns bounded grounded quotes", () => {
  const text = "An LP briefing for limited partners and another LP note.";
  const result = findTextMatches(text, "LP");
  assert.equal(result.ready, true);
  assert.ok(result.matchCount >= 2);
  assert.ok(result.matches.every((match) => match.quote.includes("LP")));
  const many = findTextMatches("x ".repeat(100), "x", { limit: 5 });
  assert.equal(many.matches.length, 5);
  assert.ok(many.matches.length <= MAX_SCREEN_MATCHES);
});

test("matchRectsForPowerFx flattens rects", () => {
  const rects = matchRectsForPowerFx({
    matches: [
      { rects: [{ x: 1, y: 2, width: 3, height: 4 }] },
      { rects: [{ x: 5, y: 6, width: 7, height: 8 }, { x: 9, y: 10, width: 1, height: 1 }] },
    ],
  });
  assert.equal(rects.length, 3);
});

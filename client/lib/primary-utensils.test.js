import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cyclePrimaryUtensil, PRIMARY_UTENSILS } from "./primary-utensils.js";

describe("primary-utensils", () => {
  it("cycles select → pen → highlight → select (select doubles as text)", () => {
    assert.equal(cyclePrimaryUtensil("select"), "pen");
    assert.equal(cyclePrimaryUtensil("pen"), "highlight");
    assert.equal(cyclePrimaryUtensil("highlight"), "select");
  });

  it("defaults unknown tools to select", () => {
    assert.equal(cyclePrimaryUtensil("marker"), "select");
    assert.equal(cyclePrimaryUtensil("text"), "select");
  });

  it("exports exactly three cursor modes", () => {
    assert.equal(PRIMARY_UTENSILS.length, 3);
    assert.equal(PRIMARY_UTENSILS[0], "select");
  });
});

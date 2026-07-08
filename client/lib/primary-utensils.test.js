import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cyclePrimaryUtensil, PRIMARY_UTENSILS } from "./primary-utensils.js";

describe("primary-utensils", () => {
  it("cycles select → pen → highlight → text → select", () => {
    assert.equal(cyclePrimaryUtensil("select"), "pen");
    assert.equal(cyclePrimaryUtensil("pen"), "highlight");
    assert.equal(cyclePrimaryUtensil("highlight"), "text");
    assert.equal(cyclePrimaryUtensil("text"), "select");
  });

  it("defaults unknown tools to select", () => {
    assert.equal(cyclePrimaryUtensil("marker"), "select");
  });

  it("exports four utensils", () => {
    assert.equal(PRIMARY_UTENSILS.length, 4);
    assert.equal(PRIMARY_UTENSILS[0], "select");
  });
});

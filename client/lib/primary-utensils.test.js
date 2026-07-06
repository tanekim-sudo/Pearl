import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cyclePrimaryUtensil, PRIMARY_UTENSILS } from "./primary-utensils.js";

describe("primary-utensils", () => {
  it("cycles pen → highlight → select → text → pen", () => {
    assert.equal(cyclePrimaryUtensil("pen"), "highlight");
    assert.equal(cyclePrimaryUtensil("highlight"), "select");
    assert.equal(cyclePrimaryUtensil("select"), "text");
    assert.equal(cyclePrimaryUtensil("text"), "pen");
  });

  it("defaults unknown tools to pen", () => {
    assert.equal(cyclePrimaryUtensil("marker"), "pen");
  });

  it("exports four utensils", () => {
    assert.equal(PRIMARY_UTENSILS.length, 4);
  });
});

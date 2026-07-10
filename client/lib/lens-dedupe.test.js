import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { findDuplicateLens, lensContentSignature } from "./lens-dedupe.js";

describe("lens-dedupe", () => {
  const existing = [
    { id: "a", top: true, kind: "prompt", name: "Invert", prompt: "Invert the material." },
    { id: "p", top: true, kind: "pipeline", name: "thread: expand → invert", steps: ["s1", "s2"] },
    { id: "s1", kind: "prompt", name: "expand", prompt: "Expand it." },
    { id: "s2", kind: "prompt", name: "invert", prompt: "Invert it." },
    { id: "hidden", top: false, kind: "prompt", name: "Invert", prompt: "Invert the material." },
  ];

  it("matches same trimmed case-insensitive name", () => {
    const root = { id: "new", name: "  invert ", kind: "prompt", prompt: "totally different" };
    assert.equal(findDuplicateLens(existing, root, { new: root })?.id, "a");
  });

  it("matches identical prompt content under a different name", () => {
    const root = { id: "new", name: "flip", kind: "prompt", prompt: "Invert the material." };
    assert.equal(findDuplicateLens(existing, root, { new: root })?.id, "a");
  });

  it("matches identical pipeline step content", () => {
    const draft = {
      r: { id: "r", name: "another chain", kind: "pipeline", steps: ["d1", "d2"] },
      d1: { id: "d1", kind: "prompt", name: "expand", prompt: "Expand it." },
      d2: { id: "d2", kind: "prompt", name: "invert", prompt: "Invert it." },
    };
    assert.equal(findDuplicateLens(existing, draft.r, draft)?.id, "p");
  });

  it("ignores non-top ops, the excluded root, and genuinely new lenses", () => {
    const root = { id: "new", name: "fresh idea", kind: "prompt", prompt: "Something new." };
    assert.equal(findDuplicateLens(existing, root, { new: root }), null);
    const edit = { id: "a2", name: "Invert", kind: "prompt", prompt: "Invert the material." };
    assert.equal(findDuplicateLens(existing, edit, { a2: edit }, { excludeId: "a" }), null);
  });

  it("signature is stable across ids and whitespace", () => {
    const a = lensContentSignature({ id: "x", kind: "prompt", prompt: " Hello  " }, {});
    const b = lensContentSignature({ id: "y", kind: "prompt", prompt: "hello" }, {});
    assert.equal(a, b);
  });
});

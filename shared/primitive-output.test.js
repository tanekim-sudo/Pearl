import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sanitizePrimitiveOutput, isPrimitiveMetaOutput } from "./primitive-output.js";

describe("primitive output", () => {
  it("strips meta-narration from expand-style responses", () => {
    const junk = `I notice you've given me just the word 'love' and asked 'What else?'

Let me take one perceptual step on this thinking canvas:

love → longing

The transformation reveals what often accompanies or hides within love: the ache of distance, the reaching toward, the space between what is and what is desired. Love carries longing in its very structure—we long because we love, we love through longing.`;
    const clean = sanitizePrimitiveOutput(junk);
    assert.ok(!/^I notice/i.test(clean));
    assert.ok(!/love → longing/.test(clean));
    assert.match(clean, /ache of distance|long because we love/i);
    assert.ok(!isPrimitiveMetaOutput(clean));
  });

  it("detects meta output", () => {
    assert.ok(isPrimitiveMetaOutput("I notice you've given me just the word love"));
    assert.ok(!isPrimitiveMetaOutput("Love opens toward the other — tenderness, risk, devotion."));
  });
});

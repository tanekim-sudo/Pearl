import assert from "node:assert/strict";
import test from "node:test";
import {
  applySystemPromptToPearl,
  defaultSystemPromptFromIntent,
  editPearlSystemPrompt,
  migratePearlSystemPrompt,
  normalizePearlSystemPrompt,
  readPearlSystemPrompt,
} from "./pearl-system-prompt.js";

test("defaultSystemPromptFromIntent seeds from topic, not empty junk", () => {
  const prompt = defaultSystemPromptFromIntent({
    name: "investor notes",
    intent: "make a pearl about my investor notes",
  });
  assert.match(prompt, /investor notes/i);
  assert.ok(!/untitled/i.test(prompt));
});

test("readPearlSystemPrompt prefers systemPrompt over purpose", () => {
  assert.equal(
    readPearlSystemPrompt({ systemPrompt: "Primary", purpose: "Legacy", identity: { purpose: "Id" } }),
    "Primary",
  );
  assert.equal(
    readPearlSystemPrompt({ purpose: "From purpose" }),
    "From purpose",
  );
});

test("editPearlSystemPrompt append and replace", () => {
  const appended = editPearlSystemPrompt("Base taste.", { mode: "append", text: "Always include risks." });
  assert.equal(appended.ok, true);
  assert.match(appended.systemPrompt, /Base taste/);
  assert.match(appended.systemPrompt, /Always include risks/);

  const replaced = editPearlSystemPrompt("Old", { mode: "rewrite", text: "New skeptical memo voice." });
  assert.equal(replaced.systemPrompt, "New skeptical memo voice.");
});

test("migratePearlSystemPrompt fills empty from legacy purpose", () => {
  const migrated = migratePearlSystemPrompt({ name: "Memo", purpose: "Skeptical TAM reviewer" });
  assert.equal(migrated.migrated, true);
  assert.equal(migrated.systemPrompt, "Skeptical TAM reviewer");
});

test("applySystemPromptToPearl writes top-level field", () => {
  const next = applySystemPromptToPearl({ id: "p1", name: "A" }, "  Be terse.  ");
  assert.equal(next.systemPrompt, "Be terse.");
  assert.equal(normalizePearlSystemPrompt("  x  "), "x");
});

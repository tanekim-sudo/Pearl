import test from "node:test";
import assert from "node:assert/strict";

const memory = {};
globalThis.chrome = {
  storage: {
    local: {
      get(keys, done) { done(Object.fromEntries(keys.filter((key) => key in memory).map((key) => [key, memory[key]]))); },
      set(values, done) { Object.assign(memory, structuredClone(values)); done(); },
      remove(keys, done) { for (const key of keys) delete memory[key]; done(); },
    },
    sync: { async get() { return {}; }, async set() {} },
    session: { async get() { return {}; }, async set() {} },
  },
};

const { readLocalLibrary, saveCapturedFunction, saveCapturedLens, saveCapturedMove, saveTranscriptCandidates } = await import("../src/background/library-store.js");

test("capture separates Move action from Lens context", async () => {
  const fragments = [{ id: "f1", quote: "Primary evidence", provenance: { url: "https://example.com" } }];
  const move = await saveCapturedMove(fragments, { name: "Check" });
  const lens = await saveCapturedLens(fragments, { name: "Evidence" });
  assert.equal(move.object.libraryKind, "move");
  assert.equal(move.object.prompt, "Primary evidence");
  assert.equal(lens.object.kind, "lens");
  assert.equal(lens.object.contextPolicy, "bounded");
  assert.equal((await readLocalLibrary()).operators.length, 1);
  assert.equal((await readLocalLibrary()).generators.length, 1);
});

test("capture without lineage wraps exact text in a one-step Function", async () => {
  const fragments = [
    { id: "fx1", quote: "First inspect the claim.", provenance: { url: "https://example.com/a" } },
    { id: "fx2", quote: "Then compare the evidence.", provenance: { url: "https://example.com/b" } },
  ];
  const saved = await saveCapturedFunction(fragments, { name: "Exact captured process" });
  const move = saved.library.operators.find((entry) => entry.id === saved.object.steps[0]);
  assert.equal(saved.object.libraryKind, "function");
  assert.equal(saved.object.steps.length, 1);
  assert.equal(saved.object.sourceInstruction, "First inspect the claim.\n\nThen compare the evidence.");
  assert.equal(move.promptTemplate, saved.object.sourceInstruction);
  const retried = await saveCapturedFunction(fragments, { name: "Exact captured process" });
  assert.equal(retried.duplicate, true);
  assert.equal(retried.object.id, saved.object.id);
});

test("transcript handoff saves all canonical kinds once across retries", async () => {
  const before = await readLocalLibrary();
  const result = {
    transcript: { fingerprint: "transcript-1", messageCount: 4 },
    candidates: {
      move: { supported: true, name: "Verify", prompt: "Verify claims." },
      function: { supported: true, name: "Research", steps: [{ name: "Collect" }, { name: "Compare" }] },
      lens: { supported: true, name: "Skeptical", material: [{ content: "Seek counterevidence." }] },
    },
  };
  await saveTranscriptCandidates(result, ["move", "function", "lens"]);
  const once = await readLocalLibrary();
  await saveTranscriptCandidates(result, ["move", "function", "lens"]);
  const twice = await readLocalLibrary();
  assert.equal(
    once.operators.filter((entry) => entry.top !== false).length,
    before.operators.filter((entry) => entry.top !== false).length + 2
  );
  assert.equal(once.generators.length, before.generators.length + 1);
  assert.equal(twice.operators.length, once.operators.length);
  assert.equal(twice.generators.length, once.generators.length);
});

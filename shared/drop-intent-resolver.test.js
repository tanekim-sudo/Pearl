import test from "node:test";
import assert from "node:assert/strict";

import {
  DROP_INTENT_VERSION,
  DROP_SOURCE_KINDS,
  DROP_TARGET_KINDS,
  resolveDropIntent,
} from "./drop-intent-resolver.js";

function source(kind, index = 0) {
  if (kind.startsWith("canonical-")) {
    const canonicalKind = kind.replace("canonical-", "");
    return {
      id: `${canonicalKind}-${index}`,
      kind: canonicalKind,
      schemaVersion: 2,
      version: 1,
      name: `${canonicalKind} fixture`,
      ...(canonicalKind === "move" ? { prompt: "Do the exact thing." } : {}),
      ...(canonicalKind === "function" ? {
        processGraph: { version: 1, nodes: [], edges: [], outputs: [] },
      } : {}),
      ...(canonicalKind === "lens" ? {
        contextPolicy: "bounded",
        material: [],
      } : {}),
    };
  }
  const base = { id: `${kind}-${index}`, sourceKind: kind };
  if (["image", "drawing", "audio", "file"].includes(kind)) {
    return { ...base, type: kind, content: { preserved: true } };
  }
  return { ...base, type: kind, text: `Exact ${kind} content ${index}` };
}

test("every actual source × target cell has a preserving productive intent", () => {
  let cells = 0;
  for (const sourceKind of DROP_SOURCE_KINDS) {
    for (const targetKind of DROP_TARGET_KINDS) {
      const resolved = resolveDropIntent(source(sourceKind), { kind: targetKind });
      cells += 1;
      assert.equal(resolved.version, DROP_INTENT_VERSION);
      assert.ok(resolved.intents.length > 0, `${sourceKind} → ${targetKind}`);
      assert.ok(resolved.defaultIntent, `${sourceKind} → ${targetKind} has a default`);
      assert.ok(
        resolved.intents.every((intent) =>
          intent.preserving || intent.destructive && intent.prerequisites.includes("explicit-scoped-confirmation")
        ),
        `${sourceKind} → ${targetKind} preserves content or explicitly confirms destruction`
      );
      assert.doesNotMatch(resolved.defaultIntent.preview, /cannot|unsupported|invalid/i);
    }
  }
  assert.equal(cells, DROP_SOURCE_KINDS.length * DROP_TARGET_KINDS.length);
});

test("complex paper command dropped in Moves is exact and never blocked as multi-step", () => {
  const exact = "Clear this page. Then create three branches; compare them, keep two, and export the memo.";
  const resolved = resolveDropIntent(
    { id: "paper-command", type: "paper-object", text: exact },
    { kind: "moves" }
  );
  assert.equal(resolved.defaultIntent.id, "create-move-verbatim");
  assert.equal(resolved.defaultIntent.resultKind, "move");
  assert.equal(resolved.defaultIntent.metadata.sourceInstruction, exact);
  assert.equal(resolved.defaultIntent.metadata.promptTemplate, exact);
  assert.ok(resolved.intents.some((intent) => intent.id === "preview-function-decomposition"));
});

test("Function drops prefer lineage, decompose commands, then wrap one-step material", () => {
  assert.equal(
    resolveDropIntent({ type: "ai-output", text: "Result", history: [{ opId: "move-a" }] }, { kind: "functions" }).defaultIntent.id,
    "capture-function-lineage"
  );
  assert.equal(
    resolveDropIntent({ type: "text", text: "First inspect. Then compare. Finally decide." }, { kind: "functions" }).defaultIntent.id,
    "preview-function-decomposition"
  );
  assert.equal(
    resolveDropIntent({ type: "text", text: "Rewrite this precisely." }, { kind: "functions" }).defaultIntent.id,
    "wrap-material-as-function"
  );
});

test("3×3 canonical object drops preserve the shipped composition result kinds", () => {
  const expected = {
    move: { move: "function", function: "function", lens: "function" },
    function: { move: "function", function: "function", lens: "function" },
    lens: { move: "function", function: "function", lens: "lens" },
  };
  for (const [left, targets] of Object.entries(expected)) {
    for (const [right, resultKind] of Object.entries(targets)) {
      const resolved = resolveDropIntent(source(`canonical-${left}`), {
        kind: `${right}-card`,
        object: source(`canonical-${right}`, 1),
      });
      assert.equal(resolved.defaultIntent.id, "compose-canonical-objects");
      assert.equal(resolved.defaultIntent.resultKind, resultKind);
      assert.equal(resolved.defaultIntent.metadata.order, "source-then-target");
    }
  }
});

test("multi-selection order, Unicode, malformed payloads, stale targets, and zoom stay safe", () => {
  const values = [
    { id: "rtl", type: "text", text: "مرحبا", order: 2 },
    { id: "unicode", type: "text", text: "研究 🧭", order: 1 },
  ];
  for (const zoom of [0.1, 1, 8]) {
    const resolved = resolveDropIntent(values, { kind: "moves", stale: zoom === 8 }, {
      zoom,
      separator: "\n---\n",
    });
    assert.equal(resolved.gesture.zoom, zoom);
    assert.equal(resolved.defaultIntent.metadata.sourceInstruction, "研究 🧭\n---\nمرحبا");
  }
  for (const malformed of [null, undefined, {}, { __proto__: null }, { type: "file", content: new Uint8Array([1, 2]) }]) {
    const resolved = resolveDropIntent(malformed, { kind: "unknown" });
    assert.ok(resolved.defaultIntent);
    assert.equal(resolved.defaultIntent.fallback, true);
  }
});

test("destructive destinations require explicit scoped confirmation", () => {
  for (const target of ["archive", "trash"]) {
    const intent = resolveDropIntent(source("text"), { kind: target }).defaultIntent;
    assert.ok(intent.prerequisites.includes("explicit-scoped-confirmation"));
    assert.equal(intent.destructive, target === "trash");
  }
});

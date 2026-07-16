import test from "node:test";
import assert from "node:assert/strict";
import {
  applyPerceptualInference,
  emptyPerceptualModel,
  mergePerceptualModels,
  normalizePerceptualModel,
  perceptualSummary,
} from "./lens-perceptual-model.js";
import { compileLensContext } from "./lens-context.js";
import { createLensFromDrop, createNewChatLens, normalizeLibraryObject } from "./library-objects.js";

test("normalizes sparse and rich perceptual models without fabricating unsupported facets", () => {
  const sparse = normalizePerceptualModel({ notice: ["variation"] });
  assert.deepEqual(perceptualSummary(sparse), ["variation"]);
  assert.deepEqual(sparse.sections.assumptions, []);
  const rich = normalizePerceptualModel({
    sections: {
      notice: [{ text: "selection pressures", confidence: 0.8, evidenceRefs: [{ sourceId: "s1" }] }],
      concepts: [{ text: "fitness", definition: "context-dependent reproductive success" }],
      blindSpots: ["teleological explanations"],
    },
  });
  assert.equal(rich.sections.notice[0].evidenceRefs[0].sourceId, "s1");
  assert.equal(rich.sections.concepts[0].definition, "context-dependent reproductive success");
});

test("empty New Chat Lens contains no inherited context", () => {
  const lens = createNewChatLens();
  assert.deepEqual(lens.perceptualModel, normalizePerceptualModel(emptyPerceptualModel()));
  const envelope = compileLensContext([lens]);
  assert.equal(envelope.mode, "isolated");
  assert.equal(envelope.text, "");
});

test("inference never overwrites user-edited sections", () => {
  const current = normalizePerceptualModel({
    sections: { notice: [{ text: "user-confirmed incentives", origin: "user", reviewStatus: "confirmed" }] },
    userEditedSections: ["notice"],
  });
  const inferred = normalizePerceptualModel({ sections: { notice: ["model replacement"], questions: ["who benefits?"] } });
  const preview = applyPerceptualInference(current, inferred);
  assert.equal(preview.proposed.sections.notice[0].text, "user-confirmed incentives");
  assert.equal(preview.proposed.sections.questions[0].text, "who benefits?");
  assert.ok(preview.changes.some((change) => change.action === "preserved-user-edit"));
});

test("compiler prioritizes confirmed perceptual facets and excludes private source bodies", () => {
  const lens = normalizeLibraryObject({
    ...createLensFromDrop([{ id: "private-source", text: "secret source body" }], { id: "evolution" }),
    name: "Evolutionary",
    perceptualModel: {
      sections: {
        notice: [
          { text: "variation", priority: 2 },
          { text: "selection pressures", priority: 1, reviewStatus: "confirmed", evidenceRefs: [{ sourceId: "private-source" }] },
        ],
        tensions: ["fitness tradeoffs"],
      },
    },
  });
  const envelope = compileLensContext([lens], { budget: 24000 });
  assert.match(envelope.text, /Notice: selection pressures/);
  assert.match(envelope.text, /Notice: variation/);
  assert.doesNotMatch(envelope.text, /secret source body/);
  assert.ok(envelope.excluded.some((entry) => entry.reason === "private"));
  assert.equal(envelope.enabledFacets.length, 3);
});

test("ordered merge exposes possible conflicts", () => {
  const merged = mergePerceptualModels([
    { sections: { preserve: ["include historical context"] } },
    { sections: { preserve: ["not include historical context"] } },
  ]);
  assert.equal(merged.model.sections.preserve.length, 2);
  assert.equal(merged.conflicts[0].type, "possible-opposition");
});

test("rejects prototype keys, cycles, and excessive depth", () => {
  assert.throws(() => normalizePerceptualModel(JSON.parse('{"sections":{"__proto__":[]}}')), /unsafe key/);
  const cyclic = {};
  cyclic.sections = cyclic;
  assert.throws(() => normalizePerceptualModel(cyclic), /cycle/);
  let deep = {};
  let cursor = deep;
  for (let index = 0; index < 25; index += 1) cursor = cursor.next = {};
  assert.throws(() => normalizePerceptualModel(deep), /depth/);
});

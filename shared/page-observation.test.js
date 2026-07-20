import test from "node:test";
import assert from "node:assert/strict";
import { createLocalPageObservation, disclosePageObservation } from "./page-observation.js";

test("local observation combines explicit multimodal context and excludes sensitive fields", () => {
  const observation = createLocalPageObservation({
    id: "observe:a",
    pearlId: "pearl:a",
    pageIdentity: "https://example.test",
    entries: [
      { id: "text", modality: "selected-text", explicit: true, text: "selected paragraph" },
      { id: "ink", modality: "ink", explicit: true, geometry: { points: [[1, 2], [3, 4]] } },
      { id: "voice", modality: "voice", explicit: false, text: "private working note" },
      { id: "password", modality: "dom", explicit: true, kind: "password", text: "never capture" },
      { id: "token", modality: "textbox", explicit: true, name: "auth-token", text: "never capture" },
    ],
  });
  assert.deepEqual(observation.entries.map((entry) => entry.id), ["text", "ink", "voice"]);
  assert.equal(observation.localOnly, true);
});

test("disclosure includes only explicit selected entries and returns content-free receipt", async () => {
  const observation = createLocalPageObservation({
    id: "observe:a",
    entries: [
      { id: "selected", modality: "selected-text", explicit: true, text: "sensitivepayload selection" },
      { id: "voice", modality: "voice", explicit: false, text: "unselected private note" },
    ],
  });
  const disclosure = await disclosePageObservation(observation, ["selected", "voice"], {
    maxCharacters: 7,
    destination: "configured-model",
  });
  assert.equal(disclosure.entries.length, 1);
  assert.equal(disclosure.entries[0].text, "sensiti");
  assert.equal(JSON.stringify(disclosure.receipt).includes("sensiti"), false);
  assert.equal(JSON.stringify(disclosure.receipt).includes("private"), false);
  assert.equal(disclosure.receipt.disclosedCharacters, 7);
});

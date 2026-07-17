import test from "node:test";
import assert from "node:assert/strict";
import { addCognitiveCandidates, createCognitivePullRequest, mergeCognitivePullRequest, reviewCognitiveCandidate, testCognitiveCandidates } from "./cognitive-pull-request.js";

const source = { id: "material-1", fingerprint: "sha-source", snapshot: { text: "Challenge assumptions. Compare evidence. View uncertainty as a signal." } };

test("cognitive pull requests keep kinds distinct, grounded, novel, reviewable, and partially mergeable", async () => {
  let request = createCognitivePullRequest({ source });
  request = addCognitiveCandidates(request, [
    { id: "m1", kind: "move", title: "Challenge assumptions", definition: "List and challenge each assumption.", evidence: [{ start: 0, end: 21 }], confidence: 0.9, category: "challenge" },
    { id: "f1", kind: "function", title: "Evidence comparison", definition: "Collect evidence, normalize it, then compare.", evidence: [{ start: 23, end: 40 }], confidence: 0.8, category: "comparison" },
    { id: "l1", kind: "lens", title: "Uncertainty signal", definition: "Attend to uncertainty as informative context.", evidence: [{ start: 42, end: 70 }], confidence: 0.85, category: "uncertainty" },
  ]);
  assert.deepEqual(request.candidates.map((entry) => entry.kind), ["move", "function", "lens"]);
  request = reviewCognitiveCandidate(request, "m1", "accept");
  request = reviewCognitiveCandidate(request, "f1", "reject");
  request = await testCognitiveCandidates(request, async () => ({ passed: true, evidence: "fixture-1" }));
  const merged = mergeCognitivePullRequest(request, { selectedCandidateIds: ["m1", "f1"] });
  assert.equal(merged.artifacts.length, 1);
  assert.equal(merged.request.status, "partially_accepted");
  assert.deepEqual(merged.receipt.undo.removeArtifactIds, [merged.artifacts[0].id]);
});

test("cognitive pull requests omit unsupported candidates and expose bounded saturation", () => {
  let request = createCognitivePullRequest({ source, kinds: ["move"], budget: 2 });
  request = addCognitiveCandidates(request, [{ kind: "move", title: "Unsupported", definition: "Guess", evidence: [] }]);
  assert.equal(request.candidates.length, 0);
  for (let round = 1; round <= 3; round += 1) request = addCognitiveCandidates(request, [], { round });
  assert.equal(request.saturation.reached, true);
});

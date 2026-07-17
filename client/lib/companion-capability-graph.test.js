import test from "node:test";
import assert from "node:assert/strict";

import {
  CompanionCapabilityGraph,
  capabilityContextPrompt,
  inspectCompanionCapability,
  recommendCompanionWorkflow,
  searchCompanionCapabilities,
  validateCompanionCapabilityGraph,
} from "./companion-capability-graph.js";
import { COMPANION_CAPABILITIES } from "./companion-capabilities.js";

test("generated capability graph covers the canonical manifest with valid dataflow edges", () => {
  const result = validateCompanionCapabilityGraph();
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.counts.nodes, COMPANION_CAPABILITIES.length);
  assert.ok(result.counts.edges > 0);
  assert.equal(new Set(CompanionCapabilityGraph.nodes.map((node) => node.id)).size, result.counts.nodes);
  assert.deepEqual(CompanionCapabilityGraph.architecture, ["Move", "Function", "Lens"]);
});

test("nodes expose policy, effect, source, and verification metadata", () => {
  const node = inspectCompanionCapability("createMove");
  assert.equal(node.id, "companion.capability.app.createMove");
  assert.equal(node.outputSchema.type, "move");
  assert.ok(node.surfaces.includes("companion"));
  assert.ok(node.tests.includes("capability-createMove"));
  assert.ok(node.featureIds.includes("library.move"));
  assert.equal(node.network.required, false);
});

test("semantic retrieval returns a bounded relevant planner subset", () => {
  const results = searchCompanionCapabilities("research, critique, and annotate the evidence", { platform: "app", limit: 8 });
  assert.ok(results.length > 0);
  assert.ok(results.length <= 8);
  assert.ok(results.some((node) => ["transformMaterial", "annotateFeedback"].includes(node.name)));

  const prompt = capabilityContextPrompt("create and apply a Move to this paper note", { limit: 10 });
  assert.match(prompt, /createMove\(/);
  assert.match(prompt, /applyMove\(/);
  assert.ok(prompt.split("\n").length <= 10);
  assert.doesNotMatch(prompt, /captureExternalVisibleTab\(/);
});

test("workflow recommendations cite graph nodes and disclose unsupported goals", () => {
  const workflow = recommendCompanionWorkflow("compose two Functions and test the result");
  assert.ok(workflow.capabilities.length);
  assert.equal(workflow.graphFingerprint, CompanionCapabilityGraph.fingerprint);

  const unsupported = recommendCompanionWorkflow("zyxwv qqqnonexistent");
  assert.equal(unsupported.capabilities.length, 0);
  assert.match(unsupported.limitations[0], /reviewable Move, Function, Lens, package, or connector/);
});

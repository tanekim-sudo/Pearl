import test from "node:test";
import assert from "node:assert/strict";
import { createCritiqueSession } from "./critique-session.js";

test("extracts critique categories without persisting taste by default", () => {
  const session = createCritiqueSession({ id: "c1", targets: [{ id: "output-1" }] });
  session.start({ outputs: [{ id: "output-1", text: "Original" }] });
  const result = session.ingest("I like the structure. Make the opening concrete. Keep the evidence.");
  assert.deepEqual(result.clauses.map((clause) => clause.kind), ["preference", "requested-edit", "preserve"]);
  assert.equal(result.preferences.length, 0);
  assert.equal(result.annotations.every((annotation) => annotation.private), true);
});

test("dispatch is exactly once and rollback restores checkpoint", () => {
  const original = { outputs: [{ id: "o", text: "before" }] };
  const session = createCritiqueSession({ id: "c2", targets: ["o"] });
  session.start(original);
  const [clause] = session.ingest("turn the comparison into a table").executable;
  assert.equal(session.markDispatched(clause.id), true);
  assert.equal(session.markDispatched(clause.id), false);
  assert.deepEqual(session.rollback(), original);
  assert.equal(session.snapshot().status, "rolled-back");
});

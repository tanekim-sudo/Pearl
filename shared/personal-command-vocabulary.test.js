import test from "node:test";
import assert from "node:assert/strict";
import { createPersonalCommandDefinition, mergePersonalVocabulary, resolvePersonalCommand, updatePersonalCommand } from "./personal-command-vocabulary.js";

test("personal vocabulary resolves exact and parameterized aliases while preserving literals", () => {
  const founder = createPersonalCommandDefinition({ trigger: "founder pass", scope: "workspace", target: { plan: ["researchFounder", "challengeAssumptions"] }, risk: "medium" });
  const memo = createPersonalCommandDefinition({ trigger: "memo [company]", scope: "session", target: { command: "createInvestmentMemo" }, risk: "low" }, [founder]);
  assert.equal(resolvePersonalCommand("Founder pass", [founder, memo]).definition.id, founder.id);
  assert.equal(resolvePersonalCommand("memo Acme Corp", [founder, memo]).parameters.company, "acme corp");
  assert.equal(resolvePersonalCommand('write the words "founder pass"', [founder]).literal, true);
});

test("personal vocabulary rejects collisions, reserved triggers, and merges versions deterministically", () => {
  const original = createPersonalCommandDefinition({ id: "alias-1", trigger: "distill this", target: { command: "openCognitivePullRequest" } });
  assert.throws(() => createPersonalCommandDefinition({ trigger: "yes", target: { command: "x" } }), /reserved/);
  assert.throws(() => createPersonalCommandDefinition({ trigger: "distill this", target: { command: "x" } }, [original]), /collides/);
  const updated = updatePersonalCommand(original, { active: false });
  assert.equal(mergePersonalVocabulary([original], [updated])[0].version, 2);
  assert.equal(resolvePersonalCommand("distill this", [updated]).matched, false);
});

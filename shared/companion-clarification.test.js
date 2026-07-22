import assert from "node:assert/strict";
import test from "node:test";
import {
  answerClarificationSession,
  clarificationPromptText,
  createClarificationSession,
  inferAutomationAmbiguities,
  inspectInstructionSpecificity,
} from "./companion-clarification.js";

test("vague IR automation instructions request format and source check-ins", () => {
  const inspection = inspectInstructionSpecificity({
    instruction: "automate the usual LP briefing somehow",
  });
  assert.equal(inspection.ready, false);
  assert.ok(inspection.questions.some((entry) => entry.id === "vague-goal" || entry.id === "format-specificity" || entry.id === "source-inputs"));
  const session = createClarificationSession(inspection, {
    resumeAction: "encodeAutomationFromInstruction",
    instruction: "automate the usual LP briefing somehow",
  });
  assert.match(clarificationPromptText(session), /clarification/i);
  let next = answerClarificationSession(session, "LP briefing with firm memo sections");
  while (next.status === "awaiting") {
    next = answerClarificationSession(next, "Capture the current tab");
  }
  assert.equal(next.status, "resolved");
});

test("specific memo instructions with template evidence can proceed", () => {
  const inspection = inspectInstructionSpecificity({
    instruction: "Produce an investment memo for Acme using this Pitchbook paste and include thesis, market, team, traction, risks, and recommendation sections.",
    evidence: [
      { kind: "crm-export", verbatim: "Pitchbook export for Acme..." },
      { kind: "format-template", verbatim: "Must include: thesis, market, team, traction, risks, recommendation" },
    ],
    inputs: { company: "Acme", sourceMaterial: "pitchbook" },
  });
  assert.equal(inspection.ready, true);
  assert.equal(createClarificationSession(inspection), null);
});

test("compiler ambiguity inference surfaces unresolved format gaps", () => {
  const ambiguities = inferAutomationAmbiguities([
    { kind: "instructions", verbatim: "Make a memo for the partner meeting." },
  ]);
  assert.ok(ambiguities.length >= 1);
});

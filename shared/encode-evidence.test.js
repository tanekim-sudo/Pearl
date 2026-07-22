import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildEncodeEvidenceList,
  classifyDroppedText,
  detectEncodeIntent,
  lpBriefingSections,
} from "./encode-evidence.js";
import { compileAutomationPearl } from "./automation-pearl.js";

const root = path.dirname(fileURLToPath(import.meta.url));

const ALLISON_PROMPT = `Draft a briefing for a limited partner meeting. The purpose of the briefing is to prep our venture capital general partners in advance of the meeting.

Limited partner name [Westwood Management]
Date and Time: (to be provided)
Attendees: (to be provided)
Commitments: (to be provided)
Relationship / Meeting Objectives: (to be provided)
Overview: (pull from Pitchbook)
Attendee bios (pull from online / public resources)

There should be a connection to the Drive https://drive.google.com/drive/folders/152k90SmmTQCO-4GP-TxclM0SFxZCCnQH for the prior briefing.
Also attaching a format for the new Briefings.`;

test("classifies email, drive, crm, and prompt material", () => {
  assert.equal(classifyDroppedText("From: a@b.com\nSubject: LP sync\nBody").kind, "email-thread");
  assert.equal(classifyDroppedText("https://drive.google.com/drive/folders/abc").kind, "drive-doc");
  assert.equal(classifyDroppedText("Pitchbook overview for Westwood Management", { crm: true }).kind, "crm-export");
  assert.equal(classifyDroppedText("You are an assistant. Draft a briefing.").kind, "system-prompt");
});

test("LP briefing intent scaffolds sections and firm-internal privacy", () => {
  const intent = detectEncodeIntent(ALLISON_PROMPT);
  assert.equal(intent.lpBriefing, true);
  assert.deepEqual(intent.researchIntents, ["prior-briefing", "firm-overview", "attendee-bio"]);
  assert.ok(intent.driveLinks.length >= 1);
  assert.equal(lpBriefingSections().length, 7);

  const evidence = buildEncodeEvidenceList([
    { kind: "email-thread", content: "From: allison@firm.com\nSubject: LP briefing request\n" + ALLISON_PROMPT },
    { kind: "crm-export", content: "Pitchbook overview: Westwood Management is an LP." },
    { kind: "format-template", content: "Section headers and typography for the briefing." },
    { kind: "drive-doc", content: "https://drive.google.com/drive/folders/152k90SmmTQCO-4GP-TxclM0SFxZCCnQH" },
  ]);
  const pearl = compileAutomationPearl(evidence);
  assert.equal(pearl.encodeIntent.lpBriefing, true);
  assert.ok(pearl.outputSpecs.some((spec) => /briefing/i.test(spec.name)));
  assert.equal(pearl.privacyPolicy.audience, "local-only");
  assert.equal(pearl.privacyPolicy.sensitivity, "firm-internal");
  assert.equal(pearl.privacyPolicy.disclosure.research.allowed, false);
  assert.equal(pearl.researchPlan.blockedUntilApproval, true);
  assert.ok(pearl.briefingSections.length >= 7);
});

test("stress fixtures compile without type errors", () => {
  const fixtures = JSON.parse(readFileSync(path.join(root, "fixtures/encode-stress-cases.json"), "utf8"));
  for (const entry of fixtures.cases) {
    const pearl = compileAutomationPearl(buildEncodeEvidenceList(entry.evidence));
    assert.equal(pearl.kind, "automation-pearl");
    assert.ok(pearl.identity.name);
    assert.equal(pearl.privacyPolicy.audience, "local-only");
  }
});

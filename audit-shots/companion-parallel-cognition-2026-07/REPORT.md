# Companion parallel cognition audit

Date: 2026-07-16
Baseline: `c2ecb8e80e2a4d8a3c43483e147f5d78880734de`

## Reproduction and root causes

The exact visible-chat sequence reproduced locally and on the deployed app. A five-minute “recent destructive request” heuristic interpreted an unrelated Function request as continuation of a Lens clear. Retry text was sent to the planner as a new command, allowing an invented workspace query to reach validation. Common Function and demonstration requests had no deterministic path, so provider/runtime failures—including the reported free-variable failure—were exposed verbatim.

## Repairs

- Confirmation arbitration now accepts only explicit confirmation or denial; unrelated executable input suspends the pending clear and runs normally.
- A persistent command ledger records input, plan, confirmation, status, effects, failure, references, and retry lineage. Retry phrases resolve only a recoverable command snapshot.
- Common Function requests create canonical pipeline Functions with persisted Move steps and output specifications. The supplied two-Function request creates Investment memo and Spielberg film evaluation Functions.
- Vague safe demonstrations perform a reversible local workspace action. Public errors redact schema, query, network, and ReferenceError details.
- GenerationPlan v2 adds stable ordered BranchSpecs with per-branch instruction, model, output override, Lens bindings, diversity, seed/provider options, count/group, and cost budget.
- Candidate blurbs are unique 3–8 word labels derived from branch context. BranchSpecs and labels persist after reload.
- Taste verbs now include keep all, extend selected branches, stop, and retry in addition to yes/no/more-like-this.
- Primitive Moves are Branch, Deepen, Challenge, Merge, and Embody. Legacy meanings migrate through aliases while user overrides remain intact.
- Proximity Merge uses screen-space dwell and hysteresis, preserves sources, and creates a normal undoable branch.
- Web and extension expose matching primitive invocation/order, BranchSpec, and Merge-preview handlers.

## Executed evidence

- Exact five-command local production conversation: 5/5 dispatched with zero page errors and observable persisted effects.
- Deployed baseline reproduction: stale-confirmation failure reproduced in a fresh anonymous browser.
- Parallel branch conversation: optimistic, conservative, and inverted opposition BranchSpecs persisted across reload.
- Capability runtime audit: **174/174 passed** — 146 app director effects and 28 extension effects.
- Feature registry: 18 feature contracts, 17 canonical domain commands, 174 companion capabilities.
- Extension: 18 core tests and 4 release tests passed; Chrome, Firefox, and Safari artifacts generated.
- Full `npm run release:check`: passed, including unit/property suites, production builds, transcript/account/before-after audits, capability effects, directional branch geometry, brush workflow, page/node integration, unified workspace, terminology, generated contracts, and requirements ledger.

## Provider and audio boundaries

The exact repair journeys intentionally used deterministic local command paths and mocked `/api/run` output where generation content was not the behavior under test. Local production had no AI Gateway credential, so no claim is made that local evidence came from a live provider. Gateway selection, explicit direct fallback, streaming/provenance, timeout, and model-compatibility behavior are covered by server tests. Browser voice tests exercise recognition lifecycle, correction, duplicate-final suppression, and command dispatch with simulated browser speech events; no live microphone or paid model call was used in this audit.

Baseline and fixed screenshots, JSON state evidence, the baseline matrix, primitive migration rationale, and screenshot index are in this folder.

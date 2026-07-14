# Companion release audit

Verdict: exact reported failure fixed and browser-verified.

## Exact regression
- Input: `Who are you?\nclear everything let me start fomr scratch`
- First visible confirmation: 18 ms
- Result: 14/14 checks passed

- PASS — exact typo-containing multiline input reaches confirmation: 18ms
- PASS — current workspace means paper and AI: Clear this workspace content? 3 whiteboard items · 2 AI nodes Built-in lens primitives will be kept. Cancel Clear listed content
- PASS — account libraries are outside unqualified clear: Clear this workspace content? 3 whiteboard items · 2 AI nodes Built-in lens primitives will be kept. Cancel Clear listed content
- PASS — mixed identity question does not swallow executable command
- PASS — executable request dispatches exactly once
- PASS — deterministic planning reaches visible action under two seconds: 18ms
- PASS — reported schema error is absent
- PASS — confirmation stages without early mutation
- PASS — confirmation performs real unified state mutation
- PASS — unqualified clear preserves account library
- PASS — cleared workspace survives refresh: items=0, nodes=0, unified=0/0
- PASS — preserved library survives refresh
- PASS — no uncaught browser errors
- PASS — no material console or request errors: {"consoleErrors":["Failed to load resource: the server responded with a status of 404 (Not Found)"],"failedResponses":[]}

## Screenshots
- `01-exact-command-entry.png`
- `02-unified-confirmation.png`
- `03-confirmed-result.png`
- `04-narrow-after-refresh.png`

## Wider execution evidence
- Adaptive companion browser audit: 8/8 (real geometry, linked feedback, reflection artifact, multi-output, plan strip, research fail-before-mutation, narrow layout, no page errors).
- Compose browser audit: 10/10 (mixed onboarding, create two lenses, compose through stable references, apply, AI output, persistence, dedupe, narrow layout).
- Voice browser audit: 10/10 (partial/final transcripts, duplicate suppression, destructive confirmation, unified mutation, follow-up, narrow layout).
- Core/shared suite: 398/398.
- Extension suite: 16/16.
- Production web and extension builds: pass.

## Canonical schema architecture
- `companion-capabilities.js` is the canonical source for verb arguments, risk, confirmation mode, examples, observations, animation metadata, and director-only caption metadata.
- Planner prompt generation, plan validation, and runtime director dispatch consume those definitions.
- `confirmed` is framework action metadata, never a capability argument. Legacy/malformed planner output with `args.confirmed` is normalized before capability validation.
- Handler-confirmed clear verbs stage the application’s counted destructive confirmation and cannot mutate before the user accepts it.
- Schema fuzzing passed minimal valid fixtures and unknown-key rejection for all 108 canonical entries.

## Quality-gate status
The exact production failure is fixed. Canonical schema validation covers 108/108 entries and runtime registration covers 96/96 app verbs plus 12/12 extension entries. This focused repair did **not** re-execute all 108 capabilities through real seeded effects; `capability-execution-matrix.json` marks those entries honestly. Therefore the broader 100% per-capability runtime-effect release gate remains unproven and the earlier manifest-only release claim has been withdrawn.

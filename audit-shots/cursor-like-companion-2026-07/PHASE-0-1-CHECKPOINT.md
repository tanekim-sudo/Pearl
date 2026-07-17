# Phase 0/1 pre-feature checkpoint

Verdict: **GREEN — Phase 2 may begin.**

## Verified

- Full release gate passed with 507 app/shared tests, extension tests/build/package checks, browser audits, 148 app capability effects, and 29 extension effects.
- The visible `CompanionChat` runtime matrix passed 177/177 capabilities with one dispatch per command and no raw error leaks.
- Universal semantic transfer passed 13/13 browser checks and all 21 source kinds × 16 targets = 336 preserving/safeguarded cells.
- The exact complex paper command created a Move with byte-for-byte `sourceInstruction` and `promptTemplate`, preserved its source, supported undo, persisted after reload, and matched the companion `semanticTransfer` result.
- Ask remained read-only. Plan blocked for Accept/Edit/Reject, rejection changed nothing, pending approval survived reload, and accepted work did not replay the completed stable step.
- Verified research was intentionally unavailable and blocked before mutation with a precise setup boundary.
- Origin is `https://github.com/tanekim-sudo/representation.git`; branch is `main`.

## Reconciled defects

- Removed the shadowed fullscreen-editor rule that made the companion unreachable.
- Kept auto-opened guidance behind editors while allowing an explicitly opened companion panel to remain usable without blocking direct editor controls.
- Corrected before/after intent precedence so “learn … from this before and after” opens the real editor instead of starting inference prematurely.
- Added named branch-output targeting so visible phrasing edits the intended Function/Move rather than the most recent unrelated Function.
- Prevented “infer a Function from this Lens” from being misclassified as before/after inference.
- Allowed handler-confirmed destructive commands to stage their real scoped confirmation while retaining executor enforcement.
- Passed explicit approval metadata and idempotency keys through extension external-write runtime audits.
- Replaced the lineage dead-end copy with preserving one-step Function, Move, and Lens alternatives.

## Closed pre-feature blockers

- Debug mode visibly tested three hypotheses, reproduced stale context, instrumented the exact stable object/version, presented one smallest-fix hunk, applied it only after acceptance, ran 3/3 regressions, and removed instrumentation.
- Semantic review visibly exercised hunk rejection, object/branch/hunk migration selection, phase acceptance, per-object transaction/versioning, and full checkpoint restoration.
- Seven controlled development-only faults ran through real `CompanionChat`: false success, unintended deletion, stale state, persistence failure, provider timeout, malformed plan, and animation cancellation. Every observer path caught the fault, chose a typed recovery, preserved/restored workspace state, and leaked no raw error.
- Recurring operation discovery cited five paper objects, created a Move and branched Function, completed ten traceable holdout runs, refined a source-linked Lens, organized the paper, and restored the full run with one checkpoint.
- Impact migration retrieved three pinned dependencies, blocked on exact preview, selectively versioned accepted object/hunk changes, preserved the rejected branch, and restored every version from the full checkpoint.
- Verified research remained intentionally unconfigured and stopped before mutation with a precise setup boundary and no fabricated citation.
- Actual `CompanionChat` exercised adversarial destructive wording, typo-filled multi-turn clearing, scoped confirmation/cancellation, and a synthetic browser speech-recognition event through the real voice dispatch path. Ask remained read-only.

Evidence: 63/63 Cursor-like visible checks, 177/177 capability effects, 336/336 universal semantic transfer cells, and the full release gate.

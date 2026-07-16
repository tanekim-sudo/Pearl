# Overwrite and integration audit

Historical failure snapshot retained for traceability. Every “still blocking” item below was subsequently closed; see `REPORT.md` and `preservation-report.json` for the final passing gate.

## Compared state

- Baseline and remote: `origin/main` at `5f10110`
- Required companion architecture anchors: `1b34246`, `5f10110`
- Current branch: `main`
- Current work: uncommitted
- Remote verified: `https://github.com/tanekim-sudo/representation.git`

## Findings

### Preserved

- Director argument validation and typed result normalization from `1b34246`/`5f10110` remain in `client/lib/director.js`.
- Destructive confirmation continues to use handler/framework metadata rather than trusting arbitrary model arguments.
- Before/after editor, server route, private example stripping, and extension compact flow remain reachable.
- Semantic output contracts remain in execution, AI result nodes, extension queue cards, and bundle paths.
- Public extension modal, platform builds, package generation, checksum/release tests, and import/export code remain present.
- Unified workspace, node center movement, edge branching, pointer-directed placement, page bounds, reading focus, and explicit GO handlers remain present.
- Account snapshot merge/content dedupe code and its prior unit coverage remain present.

### Conflicts/regressions found and repaired during this audit

- Canonical manifest names for Move operations did not match old director handler keys; Move handlers and Primitive Move handlers were wired.
- Extension still created old atomic Function and Generator records; capture now writes explicit Move and Lens records.
- Branch choices carried level metadata but the canvas never initialized level groups; initial fan now contains only the first nonempty canonical level.
- Lens context compiler existed but was dead code; the GO path now compiles bounded/isolated context and records the Lens fingerprint independently on outputs.
- New Chat Lens existed only as a shared factory; the app now seeds a built-in isolated Lens.
- Before/after inference was fixed to return canonical Move/Function classification and populate process children for multi-step evidence.
- Transcript inference route, private draft UI, parser, redaction/exclusion/chunking, extension compact flow, canonical persistence, and companion event path were added.
- User-visible Generator labels in primary app/extension components were replaced.

### Still blocking

- Companion process-era names (`forkLens`, `mergeLenses`, `stackLenses`, and related rack/editor verbs) still expose superseded semantics and require a coordinated manifest/handler/test rename.
- The prior `function-lens-generator-separation-2026-07` audit is explicitly superseded and cannot be used as release proof.
- The broad modified historical screenshot set predates this task and must not be staged.
- The current untracked `scripts/function-lens-generator-audit.mjs` uses superseded naming and must be replaced, not shipped.
- Current browser and runtime-effect evidence has not been regenerated after the latest integration changes.

## Static checks

- `git diff --check`: passed.
- Focused canonical model/parser/primitive/manifest tests: 21/21 passed.
- Production app + extension package build: passed, with existing large-chunk warning.
- Extension test suite: 16/16 passed, but it does not yet assert the new transcript/context split.

This document is an interim failure report. It must be updated after remaining repairs and repeated gates.

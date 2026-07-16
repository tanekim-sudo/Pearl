# No-regression architecture and requirements audit

Verdict: **PASS — zero unresolved local requirements.**

## Requirement counts

- Active implemented: 38
- Superseded with explicit migration: 3
- External boundaries with local contracts: 4
- Unresolved local: 0
- Total atomic groups: 45

The independently regenerated ledger is `requirements-regenerated.json`; its diff from the prior 35-group ledger is `REQUIREMENTS-DIFF.md`.

## Enforced architecture

- Canonical Move/Function/Lens model and idempotent historical migration: `shared/library-objects.js`
- Immutable transaction command contracts: `shared/domain-commands.js`
- Machine-readable capability ownership and reviewed count baselines: `shared/feature-contracts.js`
- Central legacy deprecations: `shared/deprecations.js`
- Overwrite, orphan, terminology, persistence, fixture, export, cycle, and test-focus detection: `scripts/feature-contract-gate.mjs`
- One local/CI release boundary: `scripts/release-check.mjs` and `.github/workflows/release-gate.yml`
- Persistent feature-change safety: `.cursor/rules/no-capability-regressions.mdc`, `ARCHITECTURE.md`, and the PR checklist

The gate’s mutation check removed `createMove` from the observed runtime inventory and correctly failed before the real unmodified check continued.

## Final complete gate

`npm run release:check` passed:

- feature registry: 14 active contracts, 6 shared commands, 146 companion capabilities
- mutation sanity check: expected failure observed
- complete app/shared/server tests
- extension tests, production build, release package, checksum and forbidden-file checks
- production web build
- transcript Move/Function/Lens/all-three desktop/narrow/editor journeys
- before/after Move versus Function journeys
- anonymous adoption/reload idempotency journey
- companion runtime effects: 146/146
- eight-direction branch/drag, dense graph, and keyboard chooser checks
- Lens-context + Move explicit-GO checks with one model call and no Lens mutation
- page/node integration and eight independent Primitive Move drop journeys

## External boundaries

Provider availability/quality, multiple real Supabase accounts, physical microphone permissions, and Chrome Web Store publication remain external. Local provider fixtures, mocked account adoption, microphone contracts, extension builds, package checksums, and install-flow contracts all passed.
# Chat requirements integration audit — July 2026

## Verdict

**BLOCKED. No commit or push is permitted at this checkpoint.**

The forensic gate found real overwrite/integration regressions and repaired several, but 7 active local requirements still lack complete implementation evidence. The exact status is 21 active implemented, 3 superseded, 4 external boundaries, and 7 unresolved.

## Executed checks

- Parent transcript scan: 106 user-role events found.
- Git baseline/history: reviewed `origin/main`, `1b34246`, `5f10110`, current uncommitted diff, and remote URL.
- `git diff --check`: pass.
- Focused canonical integration tests: 21/21 pass.
- Extension tests: 16/16 pass.
- Production app + packaged extension build: pass.
- Existing warning: app main chunk exceeds Vite's 500 kB advisory threshold.

## Evidence policy

Historical audits remain useful for unchanged older capabilities, but the Function/Lens/Generator separation audit is superseded and is not accepted for the current release. No current critical screenshots have been captured, so the screenshot index is intentionally empty rather than claiming stale evidence.

## Required next gate

1. Finish canonical companion capability/handler/intents renaming and regenerate the complete runtime-effect matrix.
2. Add extension tests for Move/Function/Lens capture, Lens context versus actions, and transcript inference/save.
3. Run model-mocked browser journeys for before/after and transcript all-three creation into real editors.
4. Run chained context/action/output/persistence/import/adoption journeys.
5. Capture desktop, narrow, branch-level, editor, context/action, companion, and extension screenshots.
6. Repeat full tests, production builds, package/checksum/forbidden-file checks, browser suites, console/network capture, and ledger counts.

## External boundaries

- Hosted provider output quality
- Live multi-account Supabase behavior
- Physical microphone permissions
- Store publication

These boundaries must be reported precisely but do not excuse unresolved local requirements.

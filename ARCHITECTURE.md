# Architecture and safe feature changes

## Boundaries

- `shared/library-objects.js` — canonical versioned Move/Function/Lens union, migration, validation, execution.
- `shared/output-specifications.js` — output contracts for Moves and Functions.
- `shared/domain-commands.js` — immutable cross-surface mutations, effects, idempotency, persistence/rollback hooks.
- `shared/feature-contracts.js` — active capability ownership and release baseline.
- `shared/lens-context.js` — bounded/isolated Lens context compilation and provenance.
- `shared/transcript-learning.js` and `shared/before-after-examples.js` — private evidence parsing and canonical inference inputs.
- `client/` — gestures and views; director handlers adapt animation to domain commands.
- `server/` — authenticated model boundaries; transcripts/examples remain untrusted data.
- `extension/` — explicit capture and compact adapters using the same schemas/effects.
- `shared/deprecations.js` — old Function/Lens/Generator adapters only; never primary UI vocabulary.

## Safe change procedure

1. Identify the feature contract and characterize current behavior.
2. Change the canonical model/command first, then thin surface adapters.
3. Keep mutations immutable; persist atomically and retain rollback/undo snapshots.
4. Update migration fixtures, contract tests, companion effect fixtures, and extension fallback.
5. Generate the feature matrix, run focused tests, inspect the diff, then run `npm run release:check`.
6. Do not release with missing UI reachability, fake handler effects, stale terminology, weakened counts, or unresolved local ledger items.

`scripts/feature-contract-gate.mjs` cross-checks the registry against handlers, entry points, persistence keys, tests, and baseline counts. `scripts/release-check.mjs` is the reproducible release boundary.

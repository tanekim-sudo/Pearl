# Architecture and safe feature changes

## Boundaries

- `shared/library-objects.js` — canonical versioned Move/Function/Lens union, migration, validation, execution.
- `shared/output-specifications.js` — output contracts for Moves and Functions.
- `shared/domain-commands.js` — immutable cross-surface mutations, effects, idempotency, persistence/rollback hooks.
- `shared/orb-runtime.js` — versioned orb state, utterance ledger, exactly-once dispatch, direct canonical execution, and fresh-effect verification.
- `shared/orb-interactions.js` — Context Orbit, Lens atmosphere, semantic rewind, and preserving gesture equivalence.
- `shared/orb-swarm.js` — bounded worker instances, isolated mutation scopes, typed proposals, parent verification, and fusion.
- `shared/feature-contracts.js` — active capability ownership and release baseline.
- `client/lib/companion-capability-graph.js` — generated, versioned capability nodes, typed composition edges, bounded retrieval, and self-knowledge queries.
- `shared/lens-context.js` — bounded/isolated Lens context compilation and provenance.
- `shared/transcript-learning.js` and `shared/before-after-examples.js` — private evidence parsing and canonical inference inputs.
- `client/lib/unified-workspace.js` — Scene v4 migration, optional Output Frames, unbounded world coordinates, frame-local bounds, and legacy aliases.
- `client/components/OrbUniverseShell.jsx` — extension install/library routing and explicit Stage entry.
- `client/` — gestures and views; director animation consumes semantic anchors and verified effect traces.
- `server/` — authenticated model boundaries; transcripts/examples remain untrusted data.
- `extension/` — explicit capture and compact adapters using the same schemas/effects.
- `shared/deprecations.js` — old Function/Lens/Generator adapters only; never primary UI vocabulary.

## Safe change procedure

1. Identify the feature contract and characterize current behavior.
2. Change the canonical model/command first, then thin surface adapters.
3. Keep mutations immutable; persist atomically and retain rollback/undo snapshots.
4. Update migration fixtures, contract tests, companion effect fixtures, and extension fallback.
5. Generate the feature matrix, capability graph, and orb preservation matrix; run focused tests, inspect the diff, then run `npm run release:check`.
6. Do not release with missing UI reachability, fake handler effects, stale terminology, weakened counts, or unresolved local ledger items.

`scripts/feature-contract-gate.mjs` cross-checks the registry against handlers, entry points, persistence keys, tests, and baseline counts. `scripts/companion-capability-graph-gate.mjs` validates every generated node/edge and rejects stale graph evidence. `scripts/generate-orb-preservation-matrix.mjs --check` rejects any active feature, command, companion capability, extension verb, editor, gesture, voice, keyboard, migration, persistence, or undo path without an orb-native path or typed safe handoff. `scripts/release-check.mjs` is the reproducible release boundary.

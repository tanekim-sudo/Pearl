# Architecture and safe feature changes

## Boundaries

- `shared/library-objects.js` — canonical versioned Move/Function/Lens union, migration, validation, execution.
- `shared/output-specifications.js` — output contracts for Moves and Functions.
- `shared/domain-commands.js` — immutable cross-surface mutations, effects, idempotency, persistence/rollback hooks.
- `shared/orb-runtime.js` — versioned orb state, utterance ledger, exactly-once dispatch, direct canonical execution, and fresh-effect verification.
- `shared/orb-interactions.js` — Context Orbit, Lens atmosphere, semantic rewind, and preserving gesture equivalence.
- `shared/orb-swarm.js` — bounded worker instances, isolated mutation scopes, typed proposals, parent verification, and fusion.
- `shared/semantic-orbs.js` — persistent capsule schema, source-preserving material capture, collision-aware placement, and density clustering.
- `shared/feature-contracts.js` — active capability ownership and release baseline.
- `client/lib/companion-capability-graph.js` — generated, versioned capability nodes, typed composition edges, bounded retrieval, and self-knowledge queries.
- `shared/lens-context.js` — bounded/isolated Lens context compilation and provenance.
- `shared/transcript-learning.js` and `shared/before-after-examples.js` — private evidence parsing and canonical inference inputs.
- `client/lib/unified-workspace.js` — Scene v4 migration, atomic latest-snapshot Scene updates, semantic-orb persistence, optional Output Frames, unbounded world coordinates, frame-local bounds, and legacy aliases.
- `client/components/OrbUniverseShell.jsx` — extension install/library routing, explicit Stage entry, and the visible orb-to-companion runtime bridge.
- `client/components/CompanionOrb.jsx`, `client/components/SemanticOrbLayer.jsx`, `client/orb-visual-tokens.css`, and `client/orb-universe.css` — the singular agent shell, compact persistent capsules, restrained motion tokens, accessible static states, and adaptive repository/Stage surfaces.
- `client/styles.css`, `client/styles-idea.css`, and `extension/src/sidepanel/sidepanel.css` — Pearl’s shared material language: soft depth, subtle iridescence, layered translucent surfaces, quiet luminosity, and reduced decorative chrome across every interactive layer.
- `client/` — gestures and views; director animation consumes semantic anchors and verified effect traces.
- `server/` — authenticated model boundaries; transcripts/examples remain untrusted data.
- `extension/` — explicit capture and compact adapters using the same schemas/effects.
- `shared/deprecations.js` — old Function/Lens/Generator adapters only; never primary UI vocabulary.

## Orb lifecycles

- The **agent shell** is a singleton runtime and input surface. Activating a capsule mounts that capsule’s persisted context and Lens atmosphere into this shell; it does not create another execution engine.
- **Semantic orbs** are user-authored Scene entities in `scene.semanticOrbs[]`. Canonical reversible commands own creation, activation, representation binding, context/Lens edits, hierarchy, merge, composition, split, duplication, archive, and deletion.
- **Worker orbs** have `lifespan: "run"`. They remain isolated in the swarm/runtime ledger, can be cancelled, and return verified proposals. They are never migrated or serialized as semantic capsules automatically.

`updateSceneWorkspace` is the sole pure Scene-snapshot update seam. Both the instrumentation canvas and orb shell rebase writes onto the current `lens.scenes.v4` value before serialization, preventing stale canvas effects from erasing semantic capsules or active working sets.

## Safe change procedure

1. Identify the feature contract and characterize current behavior.
2. Change the canonical model/command first, then thin surface adapters.
3. Keep mutations immutable; persist atomically and retain rollback/undo snapshots.
4. Update migration fixtures, contract tests, companion effect fixtures, and extension fallback.
5. Generate the feature matrix, capability graph, and orb preservation matrix; run focused tests, inspect the diff, then run `npm run release:check`.
6. Do not release with missing UI reachability, fake handler effects, stale terminology, weakened counts, or unresolved local ledger items.

`scripts/feature-contract-gate.mjs` cross-checks the registry against handlers, entry points, persistence keys, tests, and baseline counts. `scripts/companion-capability-graph-gate.mjs` validates every generated node/edge and rejects stale graph evidence. `scripts/generate-orb-preservation-matrix.mjs --check` reads the exact pre-orb baseline (`297478585f636be7620e09b4377df36b9f7e9d5e`) from git and rejects lost feature IDs, commands, companion capabilities, extension handlers, persistence keys, tests, effects, undo declarations, or missing real runtime bridges. `scripts/orb-input-runtime-audit.mjs` exercises the visible Scene orb through the production planner boundary and verifies effect persistence, refresh idempotence, and the orb Undo control. `scripts/release-check.mjs` is the reproducible release boundary.

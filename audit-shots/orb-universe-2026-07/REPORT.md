# Orb-Centered Cognitive Universe release evidence

Generated July 18, 2026.

## Preservation and contracts

- Feature contracts: 30 active features.
- Canonical commands: 24, including orb context, Stage, Output Frame, candidate branch, and worker context mutations.
- Companion capabilities: 206.
- Preservation matrix: 328 rows, 0 missing. It covers every active feature contract, domain command, companion capability, extension verb, synchronized persistence key, editor, critical gesture, keyboard path, voice ledger, and migration.
- Extension verb/manifest parity: exact.

## Scene v4 and rollback

- Canonical key: `lens.scenes.v4`.
- Migration alias retained and dual-written: `lens.unified-workspace.v2`.
- Legacy items and nodes retain IDs, unknown safe fields, lineage, history, camera, and selection/checkpoint fields.
- Legacy Pages receive a legacy-compatible optional Output Frame.
- World objects are unbounded; only Frame-assigned objects use frame-local clamping.
- Repeated migration is idempotent.
- Normal install/library navigation creates no Scene. New Scene, saved Scene, explicit orb command, or typed handoff is required.

## Orb runtime and interaction

- Versioned states: idle, listening, interpreting, planning, researching, executing, branching, approval, blocked, completed, paused, and recovery.
- Raw/normalized utterances, target/context snapshots, and exactly-once dispatch IDs are retained.
- Canonical command completion requires fresh declared-effect verification.
- Animation receives command/effect IDs after mutation and is safe to disable.
- Pointer, keyboard, touch, screen-reader, reduced-motion, stop, undo, placement persistence, Context Orbit, Lens atmosphere, preserving drop targets, semantic rewind, and bounded worker fusion have focused coverage.

## Browser evidence

- `01-install-desktop.png`: first public visit, unknown trusted-extension status, universal install and explicit continue.
- `02-library-laptop.png`: cognitive library/toolbox home; no blank Scene.
- `03-library-narrow.png`: narrow responsive library.
- `04-stage-desktop.png`: explicit full-bleed black Scene with adaptive views and optional Output Frame.
- `05-install-reduced-motion.png`: static orb under reduced motion.
- `06-extension-page-orb.png`: isolated page-edge orb.
- `07-extension-command-360.png`: extension command/context shell at 360 px.
- `08-extension-library-360.png`: extension library shell at 360 px.
- `09-extension-settings-360.png`: extension settings/privacy handoff at 360 px.
- `web-results.json` and `extension-results.json`: browser versions, route states, accessibility snapshots, and check results.

## Automated release checks

- Orb/Scene focused tests: 14 passed.
- Extension tests: 20 passed.
- Extension release tests: 4 passed.
- Web production build: passed.
- Chrome extension MV3 build/package: passed.
- Package forbidden-file, checksum, synchronized-archive, download-header, feature-contract, capability-graph, terminology, and preservation gates: passed.
- `npm run release:check:fast`: passed.
- `npm run release:check`: passed, including 170/170 app and 36/36 extension capability executions with typed results, observed effects, persistence boundaries, and verified animation traces.

## Platform boundary

Web and Chrome extension are implemented in this release. Desktop/mobile native clients remain documented contracts over Scene v4, Material, orb runtime, canonical commands, effect verification, and typed handoffs; no native binary is claimed.

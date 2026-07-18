# Orb parity and visual refinement audit

## Forensic baseline and parity

- Current starting release verified: `9792841a8ca61e80c19ff3052ae9b8fabd862513`.
- Orb implementation: `4c61d73a51d6657181c76bb2e2ab5a3c6628376c`.
- Exact immediate pre-orb baseline: `297478585f636be7620e09b4377df36b9f7e9d5e`.
- The pre-orb companion manifest is byte-identical at the orb release boundary.
- Baseline graph: 25 feature IDs, 19 canonical commands, 206 companion capabilities (170 app and 36 extension), 36 extension runtime verbs, and 27 persistence keys.
- `shared/orb-preservation-matrix.json` version 2 contains 313 baseline-derived rows and zero missing rows. Unlike the previous matrix, rows are not marked preserved by construction: the generator reads the baseline from git and checks current IDs, handlers, effects, tests, persistence, undo, extension applicability, and the real Scene orb runtime bridge.

## Runtime repairs

- The default Scene orb now opens the instrumentation view as an adaptive handoff and dispatches its visible text input through the existing companion planner, director verbs, canonical effects, run ledger, and persistence. It no longer blocks every request except “open Scene.”
- The orb Undo control calls the same workspace undo stack and remains inside the viewport.
- A production-only executor failure (`S is not defined`) mapped to the optional `crypto.randomUUID` default expression. A stable helper removed the minifier-sensitive expression; focused executor tests and the production browser path pass.
- `after/orb-input-runtime.json` proves visible orb input created a stable material ID, survived refresh without duplication, and was removed through the visible orb Undo control.

## Resolved visual critique

- Replaced the regular twelve-ray orange sun with a warm-white core, nine sparse irregular hairline traces, low-chroma aura, and state-specific SVG marks.
- Replaced continuous execution spin with one causal stroke animation. Planning, research, branching, approval, blocked, completion, and recovery each have a distinct restrained state; reduced motion disables all loops.
- Removed the dotted galaxy/grid Stage background and heavy glow. The Stage now uses neutral near-black depth and optional low-opacity non-repeating noise.
- Replaced repeated rounded library cards with an open editorial repository grid and hairline divisions.
- Replaced gold-filled pill navigation with neutral controls, square-small radii, precise focus indicators, and gold only for active context.
- Reworked the extension side panel and Shadow DOM page orb to the same low-chroma state grammar while preserving 360 px layout and touch sizes.

## Browser, performance, and accessibility evidence

- `after/01-install-desktop.png`: 1600×1000 install landing.
- `after/02-library-laptop.png`: 1280×800 repository.
- `after/03-library-narrow.png`: narrow web.
- `after/04-stage-desktop.png`: restrained empty Stage.
- `after/05-install-reduced-motion.png`: static reduced-motion representation.
- `after/06-extension-page-orb.png`: isolated page overlay.
- `after/07-extension-command-360.png`, `08-extension-library-360.png`, `09-extension-settings-360.png`: extension states.
- `after/orb-command-effect.png`: visible orb command effect in the real instrumentation view.
- `after/web-results.json`: accessibility snapshots, overflow checks, active animation counts, navigation timing, transfer sizes, and long-task counts. All five web checks have no horizontal overflow or page errors; reduced motion reports zero active animations.
- `after/extension-results.json`: MV3 worker, page orb, command, library, and settings checks.

## Release evidence

The repository release gate remains the authority for the complete app/shared/extension test suite, 170 app and 36 extension runtime-effect executions, production build, package/checksum/forbidden scans, feature and terminology gates, and preservation matrix freshness. Historical modified audit artifacts outside this directory are intentionally excluded from this change.

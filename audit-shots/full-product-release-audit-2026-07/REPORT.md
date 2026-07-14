# Full product release audit — July 2026

## Verdict

**Conditional no-go.** The production build, extension package, full unit suite, representative human walkthrough, and integrated adversarial browser suite pass. One focused AI text-fragment stress scenario still does not persist an exact word mark after entering reading focus, so the requested “without exception” quality gate is not yet met. Live Supabase, hosted model, browser voice hardware, and store publication also remain external verification boundaries.

## Coverage

- Companion inventory: 108 canonical capabilities (96 app, 12 extension), with 108/108 manifest ↔ runtime parity covered by automated tests.
- Core/shared automated tests: 392/392 passed.
- Extension automated tests: 16/16 passed; release contract tests: 4/4 passed.
- Human browser walkthrough: 60/60 assertions passed.
- Integrated adversarial browser audit: 32/32 assertions passed with no page errors.
- Extension browser audit: 11/11 assertions passed at 360px with 9 screenshots.
- Focused AI stress: density/storage parity passed at 1/10/50/150 nodes, clamp stability passed, 105 rapid gestures created no nodes or orphan UI; exact AI word-fragment persistence remains unresolved.

## Capability traceability matrix

| Capability group | Web direct flow | Companion/director | Extension/fallback | Persistence/sync | Automated/browser evidence |
|---|---|---|---|---|---|
| Paper objects, pages, pen, selection, editing, move, delete, undo/redo, zoom | Unified paper controls and pointer/keyboard tools | Paper verbs including spawn/edit/move/delete/select/page/camera | N/A: extension captures external material; full editing hands off to app | Unified workspace + page snapshots; anonymous reload verified | Unit suites; human paper, drag, reload, three viewport screenshots |
| Cross-domain highlight, brush queue, explicit GO, clear/cancel, node materialization | Highlighter and pending queue UI | 15 highlight/brush verbs share runtime handlers | Persistent external selection, queue, preview, explicit GO | Selection is session state; committed artifacts persist | Unit GO/idempotency tests; final paper fragment audit; extension browser audit |
| AI nodes, branching, operators, pan/zoom, reading focus, dense graphs | Embedded AI world, edge branching, chooser, camera | AI select/move/apply/focus/fit/materialize verbs | External result opens as app artifact; no fake in-panel graph editor | Unified version-3 page-coordinate store | AI layout/runtime tests; 32/32 final audit; 1/10/50/150 density and rapid-gesture probes |
| Functions/lenses, editor, branch, stack, grind, rack, version/fork/merge/output specs | Rail, tree editor, composition/grind/rack surfaces | Full create/edit/output/branch/stack/grind/rack/version verb set | Library import/export/sync and queued use | Stable IDs, versions, dependency closure, idempotent merge | Shared grammar/library/runtime/output tests; generator/final browser evidence |
| Generators and spatial material | Rail + spatial generator workspace | New/attach/graduate/probe/craft-lens verbs | Generator library sync and destination queue | Saved lens/generator store and account snapshot merge | Human create/reload; final move/reload; extension import tests |
| Companion planning, voice/text, confirmation, cancellation/checkpoint | Companion panel | 96 app verbs, bounded plans, destructive confirmation, exact checkpoint | 12 extension verbs with exact handler parity | Account-scoped memory; command state bounded | Intent/plan/executor/voice/parity tests; human onboarding and final destructive flow |
| Account/auth/sync | Anonymous-first auth overlay and merge/adopt/skip logic | Administrative actions expose precise blockers | Local mode or sign-in; idempotent library import | Board snapshot merge/dedupe/account scope | Auth and board-sync unit tests; anonymous/returning browser flow; live credentials unavailable |
| Import/export/share/handoff | Share bundles, extension library export, malformed recovery | Open export/download/path verbs | Signed bundle import, adapters, artifact handoff/fallback | Checksums, stable IDs, conflict metadata, idempotent imports | Bundle/library/security/release tests; malformed share and extension browser audits |
| Distribution/privacy/security | Vercel production output and install UI | Download/export verbs | Chrome/Firefox/Safari artifacts; options/privacy; denylist | Versioned ZIP metadata/checksum | Production build, release tests, forbidden-file/package checks |

N/A means the surface cannot safely provide that editor itself; the implemented fallback is capture/stage/handoff to the web workspace.

## Defects found and repairs

1. **Zoom controls were physically occluded by the fixed companion launcher.** Root cause: both occupied the same bottom-right hit region. The zoom disclosure was moved left and the launcher raised, then the integrated browser audit passed all target viewports.
2. **AI fragment marking could resolve against the wrong/empty selected-node state.** Root cause: the fragment layer dropped the source node ID and the app inferred it from selection, which reading focus/tool changes can clear. The source ID is now propagated explicitly with selection fallback.
3. **A first AI text stroke could be interpreted as a paper transfer in the unified overlaid world.** Root cause: `isPaperDestination={() => true}` made every in-node pointer-up look like a paper drop. Initial strokes now only create marks; transfer remains a separate drag from the locked mark.
4. **Audit harnesses wrote over historical evidence and asserted the removed split AI column.** Output paths are configurable, layout checks now target the unified three-track workspace, and AI density fixtures use the version-3 page-coordinate contract.

## Stress and performance

- Fresh interactive time: 599 ms.
- Companion destructive intent confirmation: 15 ms in deterministic local parsing.
- Dense browser states: 55 nodes in the human walkthrough; 1/10/50/150 render/storage parity in focused stress.
- 105 rapid AI gestures: no accidental nodes, orphan ghosts, or non-finite camera state.
- Unit tests completed in about 0.84 s; production app + extension build completed successfully.
- App build warning: one minified JavaScript chunk is 788 kB (254 kB gzip); this is a performance optimization opportunity, not a functional release blocker.

## Evidence index

- `human/REPORT.md` — 60-assertion human-paced walkthrough and screenshot index.
- `final/REPORT.md` — 32-assertion integrated adversarial audit and 10 screenshots.
- `extension/audit-results.json` — 11 extension browser checks and 9 screenshots.
- `ai-space/` — density, text marking, transfer, compact-target, and rapid-gesture evidence.
- `results.json` — machine-readable release summary.

## External and unresolved limitations

- Supabase credentials and multiple real accounts were unavailable, so live account isolation/adopt/skip/retry could not be proven beyond snapshot/auth boundary tests.
- Hosted model credentials were unavailable; deterministic/local planner and failure boundaries were tested, not live output quality.
- Real microphone hardware/permission and Chrome Web Store publication were not available.
- Focused AI reading-focus word marking remains red in the browser stress audit. Reproduce: seed one version-3 expanded node, fit paper, tap-mark it, clear, double-click into reading focus, select the highlighter, and stroke “controlled release of pressure.” Expected: `goldenFragment` persists and the toolbar reports one node. Actual: no `goldenFragment` and no toolbar.

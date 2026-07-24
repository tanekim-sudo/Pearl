# Pearl Function = ordered Moves — forensics (2026-07-24)

## Verdict (ruthless)

**Not deleted — previously orphaned; now default-wired.** The original Function editor (`LensTreeEditor.jsx` + `function-tree-editor.js` / `shared/function-step-ops.js` `reorderStep`) still exists. Forensics showed Pearl Studio boot skipped App, so the editor felt deleted. **`21a1f73`** bridged it behind “Open original Function editor” (still a secondary click). **Current HEAD** makes that original editor the **default primary** Function interior when a pearl opens in Studio — no hunting, no buried button.

Answer to “did you delete it?”: **No.** It was orphaned, then briefly demoted behind a click, and is now the default Studio Function view again.

## Timeline (pickaxe evidence)

| When | Commit | What happened |
|---|---|---|
| 2026-07-06 | `02f484e` | **Last known good (classic):** “Add programmable lens tree editor with DnD and git-like step ops.” — `LensTreeEditor.jsx` + `reorderStep` in `function-tree-editor.js`. UI copy: “Build a sequence of steps · drag to reorder”. |
| 2026-07-01–07 | `6f37ec8`, `b4b956c`, `c3772d8`, … | Functions as ordered pipelines / Moves in the whiteboard rail; `DraggableStep`, decompose trees, capture move sequences. |
| 2026-07-08 | `9bd89b5` | Rail redesigned to one-line list; **inline step names moved to hover preview** (visibility regression of the rail, editor still intact). Message: “All drag and compose-drop behavior kept.” |
| 2026-07-08 | `f0b1dda` | “dead UI removed” — deleted `AiToolbox` / `CompressionPalette`, **not** LensTreeEditor. |
| 2026-07-18 | `4c61d73` / `776bd25` | Orb universe / Pearl continuation surface begins dominating navigation. |
| 2026-07-21 | `6400d5d` | **Creates** `PearlStudioView.jsx` + `shared/pearl-cognitive-layers.js`. Function graphs scaffolded as bare `step:N` nodes (**name strip bug from day one** of cognition layers). Studio never imported LensTreeEditor. |
| 2026-07-21 | `d4c7e40` | Claims Moves → Functions → Lenses alignment without wiring the original editor. |
| 2026-07-24 | `0e2c869` | Fixes click→Scene theft + cognition name strip; **adds new files** `PearlFunctionMovesStudio.jsx`, `shared/pearl-function-moves.js` (git `create mode` — rebuild, not `git restore`). |
| 2026-07-24 | `21a1f73` | Bridge restore: Studio can mount `LensTreeEditor`, but only after **“Open original Function editor”**. |
| 2026-07-24 | *(this change)* | **Default wiring:** Studio auto-opens original `LensTreeEditor` as primary Function view; `PearlFunctionMovesStudio` thinned to summary; Companion NL reorder uses canonical `reorderStep`. |

## What broke the wiring (diff vs last good)

1. **Studio boot orphans App** — `main.jsx` renders only `PearlStudioView` for `#pearl-studio`, so `App.jsx`’s `<LensTreeEditor …>` never mounts.
2. **Reef click → Scene admin** (pre-`0e2c869`) — single click opened `/scene/…` Rename/Duplicate/Archive form instead of structure explorer.
3. **`definitionFor("function")` stripped Move titles** (introduced `6400d5d`, fixed in `0e2c869`) — graphs stored `{ id: step:N, layerId }` without `name`.
4. **Semantic claim without path** — Studio/Reef talked about Functions/Moves while the load-bearing editor stayed on the classic `opEditor` rail.
5. **`21a1f73` residual** — editor restored but still **hidden behind a secondary click**, so the feature still felt deleted to a clueless user.

## What default wiring does now

- Extracted canonical `reorderStep` / `buildDraftMap` to `shared/function-step-ops.js`; `function-tree-editor.js` re-exports (single algorithm).
- `shared/pearl-function-moves.js` `reorderFunctionMoves` / `mutatePearlFunctionMoves` route through `reorderStep` (destination-index mapping) — Companion domain verbs and Studio persistence share one path.
- `client/lib/pearl-function-tree-bridge.js` — pearl Function ↔ LensTreeEditor draft ops; Studio save/autosave writes back to the pearl entity.
- Pearl Studio: **auto-opens** original `LensTreeEditor` when a Function with Moves exists (primary interior). Thin `PearlFunctionMovesStudio` summary remains for Function switching / labels only — **not** a parallel drag UX.
- Companion NL `reorderPearlFunctionMoves` / `decomposePearlFunctionMove` stay on the same domain handlers (capability purpose cites `reorderStep` / LensTreeEditor).

## Original technical note (back)

> A Function **is** an ordered series of Moves. Edit that order in the programmable lens/function tree editor (`LensTreeEditor`) via DnD (`reorderStep`). Pearl Studio must open that editor by default (bridged to pearl persistence), not bury it behind a reinvented list click.

## Proof (headed, PNG Read)

Harness: `node scripts/pearl-function-editor-forensics-proof.mjs`  
Shots: `audit-shots/pearl-function-moves-forensics-2026-07-24/` (local)

| Frame | Verdict | Seen in PNG (human Read) |
|---|---|---|
| `f01-studio-default-editor.png` | PASS | Original `LensTreeEditor` is the first interior: title “Function”, “5 steps”, flow `Frame the thesis → … → Write recommendation`, cards with **drag grips** and named Moves; no buried “Open original Function editor”. Later steps require horizontal scroll. |
| `f02-after-canonical-reorder.png` | PASS | After canonical last→first: summary and card 1 are **Write recommendation** → Frame the thesis → Assess market…; grips still visible. Output chrome flipped to “risk ledger” (deriveOutputSpec side-effect — residual). |

Unit: `pearl-function-tree-bridge.test.js` + `pearl-function-moves.test.js` + `function-tree-editor.test.js` — pass.

## Residuals (honest)

- AI prose revise/create inside Studio-mounted editor still needs main workspace handlers (“apply with AI” can throw in Studio).
- Horizontal flow clips later Moves until scroll — discoverability friction for clueless users.
- Reorder can retarget derived output label (Recommendation → Risk Ledger) without an explicit user edit.
- HTML5 drag in headed Playwright mouse gestures remains imperfect; NL/domain mutate + PNG Read is the proof used here.
- Live memo credentials; mic/OAuth/extension unchanged.
- Not a production-ready claim.

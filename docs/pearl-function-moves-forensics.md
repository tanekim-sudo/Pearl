# Pearl Function = ordered Moves — forensics (2026-07-24)

## Verdict (ruthless)

**Not deleted.** The original Function editor still exists and was **orphaned** from the Pearl Studio / Reef click path. A later agent (**`0e2c869`**) **reinvented** a parallel Studio list (`PearlFunctionMovesStudio` + `shared/pearl-function-moves.js`) instead of restoring the original modules into Studio.

Answer to “did you delete it?”: **No.** `LensTreeEditor.jsx` + `client/lib/function-tree-editor.js` (`reorderStep`, drag grips, nest/lineage) were never removed. They remain mounted from `App.jsx` when `opEditor` is set. Pearl Studio boots **without App** (`client/main.jsx` early-return on `#pearl-studio`), so the original editor was unreachable from the surface users were testing.

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

## What broke the wiring (diff vs last good)

1. **Studio boot orphans App** — `main.jsx` renders only `PearlStudioView` for `#pearl-studio`, so `App.jsx`’s `<LensTreeEditor …>` never mounts.
2. **Reef click → Scene admin** (pre-`0e2c869`) — single click opened `/scene/…` Rename/Duplicate/Archive form instead of structure explorer.
3. **`definitionFor("function")` stripped Move titles** (introduced `6400d5d`, fixed in `0e2c869`) — graphs stored `{ id: step:N, layerId }` without `name`, so any interior that read graph nodes could not show ordered Move titles.
4. **Semantic claim without path** — Studio/Reef talked about Functions/Moves while the load-bearing editor stayed on the classic `opEditor` rail behind OrbUniverse → App.

`0e2c869` correctly fixed (2) and (3) and restored a usable Studio list. It did **not** revive the original `LensTreeEditor` into Studio.

## What this restore did (beyond `0e2c869`)

- Extracted canonical `reorderStep` / `buildDraftMap` to `shared/function-step-ops.js`; `function-tree-editor.js` re-exports (single algorithm).
- Added `client/lib/pearl-function-tree-bridge.js` — pearl Function ↔ LensTreeEditor draft ops; save writes back to the pearl entity (not the classic operators store).
- Pearl Studio: **“Open original Function editor”** mounts real `LensTreeEditor` with drag-reorder / nest / lineage.
- Kept the clueless Studio numbered list + domain verbs (`reorderPearlFunctionMoves` / `decomposePearlFunctionMove`) for Companion + stress gates; those are adapters on pearl storage, not a replacement claim for the original editor.
- Companion NL reorder WIP (sibling) continues to call the same domain handlers — not a second fake path.

## Original technical note (back)

> A Function **is** an ordered series of Moves. Edit that order in the programmable lens/function tree editor (`LensTreeEditor`) via DnD (`reorderStep`). Pearl Studio must open that editor (bridged to pearl persistence), not only a reinvented list.

## Proof (headed, PNG Read)

Harness: `node scripts/pearl-function-editor-forensics-proof.mjs`  
Shots: `audit-shots/pearl-function-moves-forensics-2026-07-24/` (local)

| Frame | Verdict | Seen in PNG |
|---|---|---|
| `f01-studio-moves.png` | PASS | Pearl Studio; “Functions = ordered Moves”; Investment memo with 5 named Moves (Frame the thesis → … → Write recommendation); Diligence; “Open original Function editor”. |
| `f02-original-lens-tree-editor.png` | PASS | Fullscreen original `LensTreeEditor` (“function”); horizontal flow cards Frame the thesis → Assess market and moat → Evaluate team and traction → Build risk ledger → Write recommendation; grip/drag chrome; Save. |

Unit: `pearl-function-tree-bridge.test.js` + `function-tree-editor.test.js` — 26/26 pass.

Residual: AI prose revise inside Studio-mounted editor needs main workspace handlers; live memo credentials; mic/OAuth/extension unchanged. Not a production-ready claim.

# Final adversarial audit

- Run: 2026-07-14T06:48:07.265Z
- Target: `http://127.0.0.1:5190`
- Browser scenarios: 7
- Assertions: 32/32 passed
- Screenshots: 10
- Page errors: 0

## Results

### layout
- PASS — 1600×1000 has no page overflow (overflow=0px)
- PASS — 1600×1000 keeps the unified three-track workspace
- PASS — 1600×1000 keeps primary controls visible
- PASS — 1440×900 has no page overflow (overflow=0px)
- PASS — 1440×900 keeps the unified three-track workspace
- PASS — 1440×900 keeps primary controls visible
- PASS — 1100×760 has no page overflow (overflow=0px)
- PASS — 1100×760 keeps the unified three-track workspace
- PASS — 1100×760 keeps primary controls visible

### generator
- PASS — workspace affordance reveals on deliberate row hover ({"opacity":1,"pointerEvents":"auto"})
- PASS — mixed spatial material renders without errors
- PASS — arranged item position persists immediately (x=101.8, y=48.6)
- PASS — AI assists remain secondary and collapsed
- PASS — craft-lens action remains primary and visible
- PASS — arrangement survives reload

### ai-space
- PASS — max clamp has no drift at corner 1 (scale=3.200, drift=0.00px)
- PASS — max clamp has no drift at corner 2 (scale=3.200, drift=0.00px)
- PASS — min clamp has no drift (scale=0.050, drift=0.00px)
- PASS — all arrowhead tangents point radially into targets (edges=5, worst=0.00°)
- PASS — tiny jiggle and background pan create no nodes (6→6)

### highlighter
- PASS — wrapped text exposes measurable words
- PASS — word stroke leaves exact golden fragments after release (fragments=1, freehand-strokes=0)
- PASS — fragment selection exposes an actionable toolbar
- PASS — Escape clears marks and session ink

### companion
- PASS — fresh first run opens companion instead of blocking onboarding
- PASS — typo-heavy clear command preempts identity under one second (15ms)
- PASS — confirmation reports counted requested domains (Clear this workspace content?1 whiteboard items · 1 AI nodes · 1 user-created lensesBuilt-in lens primitives will be kept.CancelClear listed content)
- PASS — cancel preserves every domain
- PASS — administrative command is never saved as identity

### sharing
- PASS — malformed payload shows precise failure
- PASS — malformed payload does not open or corrupt a path

### runtime
- PASS — no page errors across audited contexts

## Focused AI-space suite

- Run separately with `AUDIT_URL=<url> node scripts/ai-space-audit.mjs`.
- Last integrated run: 20/20 checks passed across 1, 10, 50, and 150 nodes.
- Exact phrase marking, 0.0px point-to-card landing, 24×24px compact-node targets, additive dot-tier sweeps, and 105 rapid gestures passed.

## AI-space gesture matrix

- Select + background: pan; Shift+background: lasso. Neither creates nodes.
- Select + node core: select/move; node edge: branch strand; double-click: reading focus.
- Highlighter + background: persistent sweep; compact node: additive whole-node mark; readable text: exact phrase mark.
- Highlighter + existing mark: intentional transfer to paper, AI, lens/function, or generator targets.
- Pen is paper-only and does not silently mutate AI space.
- Escape clears living marks/ink/gesture UI; leaving highlighter clears session ink without creating work.
- Dot/short tiers use an invisible screen-space target; transition/read tiers use visible node/text geometry.

## Screenshots

- [layout-1600x1000.png](./layout-1600x1000.png)
- [layout-1440x900.png](./layout-1440x900.png)
- [layout-1100x760.png](./layout-1100x760.png)
- [generator-spatial-workspace.png](./generator-spatial-workspace.png)
- [ai-full-content.png](./ai-full-content.png)
- [ai-dot-constellation.png](./ai-dot-constellation.png)
- [ai-transition.png](./ai-transition.png)
- [highlighter-word-fragments.png](./highlighter-word-fragments.png)
- [companion-counted-confirmation.png](./companion-counted-confirmation.png)
- [share-malformed-safe-failure.png](./share-malformed-safe-failure.png)
- [density-10-dot.png](./ai-space/density-10-dot.png)
- [density-50-dot.png](./ai-space/density-50-dot.png)
- [density-150-dot.png](./ai-space/density-150-dot.png)
- [text-before-word-mark.png](./ai-space/text-before-word-mark.png)
- [text-after-word-mark.png](./ai-space/text-after-word-mark.png)
- [text-fragment-to-paper.png](./ai-space/text-fragment-to-paper.png)
- [dot-node-hit-target-marked.png](./ai-space/dot-node-hit-target-marked.png)
- [after-105-gesture-stress.png](./ai-space/after-105-gesture-stress.png)

## Defects and limitations

- No reproducible functional or visual-geometry defect remained after the final rerun.
- Fixed: an initial AI text stroke incorrectly became a drag-transfer on pointer-up; marking and transfer are now separate gestures.
- Fixed: compact dot-tier nodes had sub-16px practical targets; their invisible target now measures 24×24px.
- Fixed: an immediate retry after cancelling companion clear could be swallowed by duplicate-submit protection.
- Model-generated content was not claimed as live: deterministic API stubs are used by `scripts/debug-lens-branching.mjs`.
- Auth/account merge behavior is covered at the snapshot and user-scope layer because this environment has no configured Supabase credentials.
- Manual screenshot inspection covered dot/transition/content AI zoom, three desktop widths, highlighter marks, generator space, destructive confirmation, and malformed sharing.

## Verdict

The AI interaction model meets the tested simplicity bar: mark first, drag the mark second; background gestures never execute operations; compact nodes remain targetable at minimum zoom. Live model quality and hosted account synchronization remain environment-dependent and are not represented as proven.

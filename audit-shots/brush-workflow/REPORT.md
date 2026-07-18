# Brush workflow audit

## Result

17/17 visible-UI checks passed.

## Semantics exercised

- Lens-first and highlight-first only build one pending state; neither a card click nor stroke executes.
- GO appears only with material plus a valid pending action and is the sole mutation boundary.
- Escape clears pending operations before following the established selection-clear contract.
- Lens context remains immutable; GO requires and executes a Move/Function action with that context.
- Keyboard activation, SVG accessible naming, narrow layout, and runtime page errors are checked.
- GO commits are keyed in the application pipeline, so duplicate delivery is idempotent.
- AI output content/latency remains model-provider dependent and is covered structurally by the repository transform/branch tests.

## Checks

- PASS — brush has accessible name
- PASS — brush uses an SVG icon
- PASS — lens-first queues and switches tools
- PASS — queue alone has no GO
- PASS — queue alone produces no output
- PASS — stroke only updates living selection
- PASS — GO appears with material and pending lens
- PASS — Escape clears pending before marks
- PASS — Lens context remains immutable while queued
- PASS — Lens context alone cannot execute: 0 GO · 1 Evidence garden×
- PASS — Move plus Lens context shows GO: 1 GO · 1 Branch←→× | 2 Evidence garden×
- PASS — GO applies action without mutating Lens context: 0 context mutations
- PASS — contextual action commits exactly once: 0 → 1 model calls
- PASS — successful GO clears pending stack
- PASS — keyboard can queue Lens context
- PASS — pending stack and GO fit narrow viewport
- PASS — no page errors

## Screenshots

- [Lens-first queued](lens-first-queued.png)
- [Selection, stack, and GO](selection-stack-go.png)
- [Highlight-first generator queued](highlight-first-generator-queued.png)
- [Generator after GO](generator-after-go.png)
- [Narrow stack and GO](narrow-stack-go.png)

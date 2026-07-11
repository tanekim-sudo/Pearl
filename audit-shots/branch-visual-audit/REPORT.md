# Branch geometry and visual audit

## Result

75/75 checks passed. The 64-case directional matrix measured a mean angular error of 0.00° and a maximum of 0.00°.

## Root causes and contract

- The legacy commit path used the selected operation fan spoke as the child angle, coupling keyboard/pointer operation selection to placement.
- The legacy fan froze at activation, so curved paths and center crossings retained an early angle.
- Short high-zoom drops could fall back to the graph's default outward sector.
- Placement now follows the release ray from the source center. Distance is clamped in world space, collision adjustment searches no more than 20° and preserves the cursor-facing hemisphere, and the exact resolved point is previewed and committed.
- Arrow/number keys change only the operation. Pointer cancellation commits nothing.
- Lens-editor strand jiggles commit nothing; upward/downward drags insert the constrained branch lane above/below.

## Automated scenarios

- 64 committed UI branches: 8 directions × 8 zoom/camera/page-origin variants.
- Includes short/long drags, curved path, fast flick, keyboard operation changes, all camera quadrants, and min/dot/transition/default/read/max zoom.
- 100 rapid mixed tiny node/background gestures.
- 1440×900, 1600×1000, and 1180×720 visual captures.
- DOM assertions cover preview/commit equality, angular error, orphan previews, drag-class cleanup, accidental outputs, and page errors.

## Visual-system fixes

- Replaced stale dark-theme strand HUD/fan colors in the unified white workspace with graphite/white styling.
- Reduced gold emphasis, line-weight variation, and heavy chooser shadow.
- Added one explicit dashed placement edge and ghost node, distinct from operation choices.
- Added readable label knockouts on white and a complete reduced-motion path.

## Screenshot index

- [Existing pre-fix chooser](before-existing-branch-chooser.png)
- [After commit](after-direction-overlay.png)
- [1600×1000 fan](overview-1600x1000.png)
- [Narrow laptop fan](overview-narrow-laptop.png)
- [Collision-adjusted preview](collision-adjusted-preview.png)
- [Dense 50-node graph](dense-graph-50.png)
- Eight directional fan captures: [east](fan-east.png), [south-east](fan-south-east.png), [south](fan-south.png), [south-west](fan-south-west.png), [west](fan-west.png), [north-west](fan-north-west.png), [north](fan-north.png), [north-east](fan-north-east.png)

## Measurements

- min/east: 0.00° error, 0.000 world-px preview jump, ArrowRight
- min/south-east: 0.00° error, 0.000 world-px preview jump
- min/south: 0.00° error, 0.000 world-px preview jump
- min/south-west: 0.00° error, 0.000 world-px preview jump, ArrowRight
- min/west: 0.00° error, 0.000 world-px preview jump
- min/north-west: 0.00° error, 0.000 world-px preview jump, ArrowUp
- min/north: 0.00° error, 0.000 world-px preview jump, ArrowRight
- min/north-east: 0.00° error, 0.000 world-px preview jump
- dot/east: 0.00° error, 0.000 world-px preview jump, ArrowRight
- dot/south-east: 0.00° error, 0.000 world-px preview jump
- dot/south: 0.00° error, 0.000 world-px preview jump
- dot/south-west: 0.00° error, 0.000 world-px preview jump, ArrowRight
- dot/west: 0.00° error, 0.000 world-px preview jump
- dot/north-west: 0.00° error, 0.000 world-px preview jump, ArrowUp
- dot/north: 0.00° error, 0.000 world-px preview jump, ArrowRight
- dot/north-east: 0.00° error, 0.000 world-px preview jump
- transition/east: 0.00° error, 0.000 world-px preview jump, ArrowRight
- transition/south-east: 0.00° error, 0.000 world-px preview jump
- transition/south: 0.00° error, 0.000 world-px preview jump
- transition/south-west: 0.00° error, 0.000 world-px preview jump, ArrowRight
- transition/west: 0.00° error, 0.000 world-px preview jump
- transition/north-west: 0.00° error, 0.000 world-px preview jump, ArrowUp
- transition/north: 0.00° error, 0.000 world-px preview jump, ArrowRight
- transition/north-east: 0.00° error, 0.000 world-px preview jump
- default/east: 0.00° error, 0.000 world-px preview jump, ArrowRight
- default/south-east: 0.00° error, 0.000 world-px preview jump
- default/south: 0.00° error, 0.000 world-px preview jump
- default/south-west: 0.00° error, 0.000 world-px preview jump, ArrowRight
- default/west: 0.00° error, 0.000 world-px preview jump
- default/north-west: 0.00° error, 0.000 world-px preview jump, ArrowUp
- default/north: 0.00° error, 0.000 world-px preview jump, ArrowRight
- default/north-east: 0.00° error, 0.000 world-px preview jump
- read/east: 0.00° error, 0.000 world-px preview jump, ArrowRight
- read/south-east: 0.00° error, 0.000 world-px preview jump
- read/south: 0.00° error, 0.000 world-px preview jump
- read/south-west: 0.00° error, 0.000 world-px preview jump, ArrowRight
- read/west: 0.00° error, 0.000 world-px preview jump
- read/north-west: 0.00° error, 0.000 world-px preview jump, ArrowUp
- read/north: 0.00° error, 0.000 world-px preview jump, ArrowRight
- read/north-east: 0.00° error, 0.000 world-px preview jump
- max/east: 0.00° error, 0.000 world-px preview jump, ArrowRight
- max/south-east: 0.00° error, 0.000 world-px preview jump
- max/south: 0.00° error, 0.000 world-px preview jump
- max/south-west: 0.00° error, 0.000 world-px preview jump, ArrowRight
- max/west: 0.00° error, 0.000 world-px preview jump
- max/north-west: 0.00° error, 0.000 world-px preview jump, ArrowUp
- max/north: 0.00° error, 0.000 world-px preview jump, ArrowRight
- max/north-east: 0.00° error, 0.000 world-px preview jump
- page-positive/east: 0.00° error, 0.000 world-px preview jump, ArrowRight
- page-positive/south-east: 0.00° error, 0.000 world-px preview jump
- page-positive/south: 0.00° error, 0.000 world-px preview jump
- page-positive/south-west: 0.00° error, 0.000 world-px preview jump, ArrowRight
- page-positive/west: 0.00° error, 0.000 world-px preview jump
- page-positive/north-west: 0.00° error, 0.000 world-px preview jump, ArrowUp
- page-positive/north: 0.00° error, 0.000 world-px preview jump, ArrowRight
- page-positive/north-east: 0.00° error, 0.000 world-px preview jump
- page-negative/east: 0.00° error, 0.000 world-px preview jump, ArrowRight
- page-negative/south-east: 0.00° error, 0.000 world-px preview jump
- page-negative/south: 0.00° error, 0.000 world-px preview jump
- page-negative/south-west: 0.00° error, 0.000 world-px preview jump, ArrowRight
- page-negative/west: 0.00° error, 0.000 world-px preview jump
- page-negative/north-west: 0.00° error, 0.000 world-px preview jump, ArrowUp
- page-negative/north: 0.00° error, 0.000 world-px preview jump, ArrowRight
- page-negative/north-east: 0.00° error, 0.000 world-px preview jump

## Honest limits

- Touch was validated through pointer-event-compatible code paths, but this desktop audit did not emulate a physical touch digit or macOS trackpad firmware.
- The pre-fix image is the prior unified-workspace audit capture; numeric before behavior is documented from the removed fan-spoke/fallback code path rather than replayed against a second historical server.
- Model calls are intercepted with deterministic responses so geometry stress does not depend on credentials or network latency.

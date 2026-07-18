# Unified workspace audit

## Result

18/18 automated visible-UI checks passed.

## Capability parity

| Capability | Paper legacy | AI legacy | Unified |
| --- | --- | --- | --- |
| Text/blocks/images/ink/edit/move/resize | yes | source only | preserved in shared world |
| Node move/read/morph/lineage/paths | no | yes | preserved in shared world |
| Edge strand operation fan + keyboard | no | yes | preserved; expand remains one explicit choice |
| Persistent exact-fragment highlighter | yes | yes | mixed paper/node/ink selection |
| Lenses/generators/spatial outputs | yes | yes | shared coordinates and rail |
| Undo/redo | paper | separate mutations | mixed item/node snapshots |
| Persistence | legacy paper keys | legacy AI key | v2 snapshot plus readable legacy keys |

## Architecture and migration evidence

- One unbounded affine world camera drives paper objects, ink, AI nodes, edges, and overlays.
- The 8.5×11 page remains a visible frame at world origin; content may extend outside it.
- Legacy AI coordinates receive one deterministic offset during the idempotent v2 migration.
- Legacy keys are retained as recovery sources; the v2 snapshot duplicates all records and camera state.

## Interaction measurements

- Node core drag threshold: 8 px.
- Node edge band: at least 10 screen px.
- Strand activation: 4 px; operation fan supports arrow keys and release-to-commit.
- Narrow viewport checked at 1180×720.
- Density checked at 1, 10, 50, and 150 nodes plus 1000 paper items.

## Checks

- PASS — versioned migration created: v3
- PASS — paper records preserved
- PASS — AI records and history preserved
- PASS — migration reload is idempotent
- PASS — single primary canvas replaces paper/AI columns: 3 grid tracks
- PASS — white and graphite visual system
- PASS — paper is a frame inside world
- PASS — node center drag moves without spawning
- PASS — edge drag opens operation chooser
- PASS — ink crosses paper frame into node area
- PASS — mixed highlight can mark AI nodes
- PASS — narrow laptop canvas remains usable: 892×676
- PASS — renders 1 nodes
- PASS — renders 10 nodes
- PASS — renders 50 nodes
- PASS — renders 150 nodes
- PASS — renders 1000 paper items
- PASS — no page errors

## Screenshots

- [Overview](overview.png)
- [Paper frame focus](paper-frame-focus.png)
- [Dense node graph](dense-node-graph.png)
- [Mixed selection](mixed-selection.png)
- [Branch chooser](branch-chooser.png)
- [Narrow view](narrow-view.png)
- [Migration](before-after-migration.png)

## Honest limits

- Media capture still depends on browser microphone/file permissions.
- AI operation completion still depends on configured model credentials and network availability.
- The stress audit validates DOM stability and interaction routing, not GPU frame timing on every device.

# Unified workspace architecture

## Pre-implementation audit

Paper state lives in `lens.board.items.v1`, `lens.board.pages.v1`,
`lens.board.camera.v1`, document metadata, item history, operators, lenses, and
generator stores. Its input surface supports select-as-type, editing, lasso,
move/clone/resize/rotate, links, pen/marker/eraser, persistent highlighter,
image/file drops, voice-linked ink, page tabs, undo/redo, lens drops, generator
capture, and path/history controls.

AI state lives in `lens.ai.nodes.v1` plus node lineage fields (`parentId`,
`sourceNodeIds`, `via`, operation labels, fragments, expanded text). Its
viewport supports node-core move/read, edge strand branching, keyboard
operation selection, radial edges, zoom morphing, highlighted fragments,
cross-node branching, lens operations, path capture/share/walk, and
materialization back to paper.

Companion verbs are defined by `client/lib/companion-capabilities.js` and
registered in `App.jsx`. Existing verbs remain registered; paper/AI transfer
verbs now describe source attachment and materialization in the unified world.

## Scene v4 migration and invariants

1. Keep every legacy key readable and continue mirroring paper and AI records.
2. Write `lens.scenes.v4` as the canonical snapshot while continuing to write
   the rollback-compatible `lens.unified-workspace.v2` alias during the
   migration window.
3. Convert each legacy Page into one Scene with a legacy-compatible optional
   Output Frame. Keep every ID, field, history, lineage, camera, and selection;
   offset old split-space AI coordinates only once.
4. Prefer a valid Scene v4 snapshot on reload, then fall back through legacy
   readers. Migration, account adoption, import, and repeated login remain
   idempotent.
5. Preserve unknown fields verbatim so histories, lineage, pending metadata,
   and future record extensions survive.
6. Do not create or open a Scene on normal web navigation. Scene creation
   requires New Scene, an explicit command, a saved Scene, or a typed handoff.

## Runtime model

The Stage uses one affine world camera (`screen = world × scale +
translation`) and is unbounded. Output Frames are optional bounded regions;
only objects assigned to a Frame are clamped to its local dimensions. World
objects outside Frames keep unrestricted coordinates. AI edges, nodes, blocks,
and ink share the same camera.

The paper input layer owns background gestures. AI node cores and explicit
edge handles sit above it:

- select + node core: select/move/read
- select + node edge: open operation fan; arrows/number keys choose, release
  commits
- select + block: select/move; repeated click or double-click edits
- select + background: click creates text; drag lassos; Alt/middle pans
- pen/marker: draws black ink anywhere in the world
- highlighter: accumulates fragments, blocks, ink, and nodes until explicit
  clear/Escape/tool exit

No background drag invokes an AI operation. Expand is one strand choice among
the registered primitives, functions, and moves.

Undo snapshots contain both `items` and `aiNodes`. The versioned persistence
snapshot is written whenever either domain or the shared camera changes.

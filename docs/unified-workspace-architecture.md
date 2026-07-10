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

## Migration plan and invariants

1. Keep every legacy key readable and continue mirroring paper and AI records.
2. Create `lens.unified-workspace.v2` as a duplicate, versioned recovery-safe
   snapshot containing camera, paper items, and AI nodes.
3. Keep paper coordinates unchanged. Offset legacy AI coordinates once into
   the open area beside the page frame. Stamp migrated nodes with the version.
4. Prefer an existing v2 snapshot on reload. Never reapply the offset.
5. Preserve unknown fields verbatim so histories, lineage, pending metadata,
   and future record extensions survive.

## Runtime model

The workspace uses one affine world camera (`screen = world × scale +
translation`). The paper is a fixed 768×1104 frame at world origin, not a
camera boundary. Blocks and ink may extend outside it. AI edges and nodes use
the same camera and world coordinates, so interleaving does not require
per-render coordinate translation.

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

# Clueless visual defects — from real PNG Reads (2026-07-24)

**Method:** Read tool on `audit-shots/pearl-clueless-stress-2026-07-24/*.png` pixels.  
**Rule:** Invisible / stacked / low-contrast critical UI = P0 fail even if DOM/runtime passed.

| Frame | Seen in image | Severity | Status |
|---|---|---|---|
| `01-welcome.png` | Talk CTA clear; gauntlet label + “Talk · type · GO” low-contrast / abstract at bottom | P1 | Fixing legend contrast + hide hint under welcome |
| `n01-cold-390.png` | Bottom gauntlet text overlaps sockets — looks broken | P0 | Fixing legend/hint separation on narrow |
| `02-after-talk.png` | “Your Reef” / intro nearly invisible; dual Talk CTA competes with open chat | P0 | Hide intro when Companion open; raise intro contrast |
| `03-create-after.png` | Pearl title stacked on giant “Reef” hero; gauntlet text illegible | P0 | Intro only when shelf empty; shelf grid |
| `06b-gauntlet.png` | Worn pearl label truncated “Series A no…”; clutter around mother pearl | P0 | Readable labels; less chrome stack |
| `11-reload.png` | Pearl names under overlapping Reef hero; bottom dock illegible UUID/stack | P0 | Populated shelf layout; hide competing chrome |
| `n03-create-after.png` | Toast overlays chat; GO/input partially occluded; “context pearls” clipped | P0 | Hide gauntlet chrome when chat open on narrow |
| `13b-studio.png` | Sparse Studio; Close is plain text — secondary | P2 | Residual polish |

## Harness lie (prior)

Aesthetic checks were recorded as pass from DOM heuristics without pixel Read. That is invalid under the upgraded standard.

## Product fixes applied this turn

1. Reef intro only when shelf is empty (no hero over pearl names).
2. Populated Reef uses a readable card grid (`.orb-reef-shelf`).
3. Companion open → hide intro + start-hint (desktop + narrow).
4. Semantic orb titles visible under capsules (not sr-only).
5. Gauntlet legend + start-hint higher contrast / less overlap.
6. GO button high-contrast cream fill.
7. Narrow + chat open → hide featured mother/gauntlet entirely (stops clipped “context pearls”).

## Re-Read after fixes (`vfix-*` PNGs)

| Frame | Verdict after fix |
|---|---|
| `vfix-d-02-chat.png` | PASS — no competing Reef Talk CTA; GO readable |
| `vfix-d-04-renamed-shelf.png` | PASS — “Series A notes” card clean, no hero stack |
| `vfix-d-05-reload.png` | PASS — titled pearl findable; no UUID mush |
| `vfix-m-04-renamed-shelf.png` | PASS shelf; residual: gauntlet clip under dock → fix #7 |
| `vfix-m-02-chat.png` | IMPROVED; residual clip addressed by #7 |

Still residual (P2): dense Companion header chips (memory/why/voice); demo suggestion pills; sparse empty Reef.

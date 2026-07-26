# Current capability demo

Hands-off director animation of **where Pearl is today** (vision shell only).

## How to start

1. On Reef, click **Watch what Pearl can do** (chrome or empty-shelf intro), or
2. Welcome: **Watch what Pearl can do**, or
3. Companion Talk → type `watch what pearl can do` / `play demo` → GO

No further clicks. Stop anytime via the ghost-cursor stop control.

## Steps shown

1. Companion opens (status / demonstrating)
2. Create titled disposable pearl on Reef (`Demo · Series A brief`)
3. Wear into gauntlet (director cursor + gauntlet update)
4. Open Studio (popup when allowed; host stays alive for the tour)
5. Reorder Function Moves (same path as Studio LensTreeEditor / NL reorder)
6. Glance Encode anything
7. Glance Install (extension download)
8. Return home; archive disposable Demo · pearls

## Not demoed

Classic Stage rails deleted from Pearl: HighlightToolbar, AiNodeCanvas, BeforeAfter, grammar panels.

Extension page Companion is not required for this web-shell tour; Install glance covers the download affordance.

## Implementation

- Demo script: `client/lib/pearl-capability-demo.js` + `companion-demos.js` id `pearl-capability-tour`
- Companion verb: `playPearlCapabilityDemo`
- Stress: `sf-pearl-capability-demo` in `scripts/pearl-clueless-stress.mjs`

# All-paths ledger — 2026-07-22

Base: http://127.0.0.1:41737

## Paths matrix
- **PASS** `visual.physical-pearl` — checks: unit-arc-reactor-contract, unit-arc-reactor-layers, live-mother-arc-reactor
- **PASS** `companion.pearl-gauntlet` — checks: unit-gauntlet-cap-5, live-empty-gauntlet-sockets
- **FIXED** `scene.semantic-orbs.merge` — checks: unit-merge-preserves-sources, live-merge
- **FIXED** `scene.semantic-orbs.synthesize` — checks: unit-synthesize-mutual, live-synthesize
- **FIXED** `pearl.counter` — checks: unit-counter-pearl, live-counter
- **PASS** `learning.forming-pearls` — checks: unit-forming-pearls
- **PASS** `scene.ingest` — checks: unit-extract-text-file
- **PASS** `encode.automation-anything` — checks: unit-encode-local-compile, encode-panel
- **FIXED** `pearl.organize` — checks: unit-organize-dump, live-organize
- **PASS** `shell.reef-home` — checks: reef-nav, reef-return
- **PASS** `scene.ingest.paste` — checks: paste-to-stage
- **PASS** `scene.ingest.drop` — checks: file-drop-material
- **PASS** `scene.semantic-orbs` — checks: create-pearls
- **FIXED** `companion.pearl-wear` — checks: wear-gauntlet
- **FIXED** `companion.keep-this` — checks: keep-this
- **PASS** `interaction.orb-gesture` — checks: drag-move-not-delete
- **FIXED** `scene.output-frame` — checks: output-frame-on-intent
- **PASS** `scene.semantic-orbs.delete` — checks: delete-pearl
- **PASS** `studio.pearl` — checks: studio-open

## Checks
- **PASS** `unit-arc-reactor-contract` (P0) — valid=true contract=3 renderer=3 elements=20
- **PASS** `unit-arc-reactor-layers` (P0) — core+rings+breath
- **PASS** `unit-gauntlet-cap-5` (P0) — filled=5 cap=5 threw=true
- **PASS** `unit-merge-preserves-sources` (P0) — orbs=3 preserved=audit-1,audit-2
- **PASS** `unit-synthesize-mutual` (P0) — orbs=3 kind=synthesis
- **PASS** `unit-counter-pearl` (P0) — kind=counter orbs=3
- **PASS** `unit-forming-pearls` (P0) — pearls=4
- **PASS** `unit-extract-text-file` (P0) — note.txt
- **PASS** `unit-encode-local-compile` (P0) — LP meeting briefing
- **PASS** `unit-organize-dump` (P0) — Organized into 1 Moves · 0 Functions · 1 Lenses. Preserved 1 evidence unit; removed 4 redundant structure.
- **PASS** `reef-nav` (P0) — home reef
- **PASS** `live-mother-arc-reactor` (P0) — {"ok":true,"version":"3","variant":"primary","hasCore":true,"hasRing":true,"size":"34","emptySockets":5}
- **PASS** `live-empty-gauntlet-sockets` (P1) — empty=5
- **PASS** `paste-to-stage` (P0) — nodes=1
- **PASS** `file-drop-material` (P0) — material present
- **PASS** `create-pearls` (P0) — pearls=3
- **FIXED** `wear-gauntlet` (P0) — {"filled":1,"empty":4,"stones":1,"stored":1}
- **FIXED** `live-merge` (P0) — before=3 after=4
- **FIXED** `live-synthesize` (P0) — before=4 after=5
- **FIXED** `live-counter` (P0) — before=5 after=6
- **FIXED** `keep-this` (P0) — before=6 after=7 dump=true
- **FIXED** `live-organize` (P1) — {"moves":1,"functions":1,"lenses":1,"context":2}
- **PASS** `drag-move-not-delete` (P1) — {"ok":true,"hint":true,"count":7}
- **FIXED** `output-frame-on-intent` (P1) — before=0 after=2
- **PASS** `delete-pearl` (P1) — before=0 after=0
- **PASS** `studio-open` (P2) — hosts=2
- **PASS** `reef-return` (P1) — home
- **PASS** `encode-panel` (P0) — panel=1
- **PASS** `no-fatal-console` (P1) — clean

## Visual before → after
- **Before:** warm nacre / soft pearl disc (renderer v2); empty gauntlet sockets as faint beige rings.
- **After (v3):** mother Pearl is a cool white/cyan arc-reactor stack — bright core, concentric internal energy rings drawn above nacre, breath on core/rings (damped under `prefers-reduced-motion`). Filled gauntlet sockets saturate as charged stones; empty sockets read dark/uncharged.
- Evidence: `18-mother-pearl-closeup.png`, `19-mother-gauntlet-frame.png`, `20-gauntlet-stone-charged.png`, `21-reactor-matrix.png`, `02-mother-pearl-reactor.png`, `06-gauntlet-worn.png`.

## Gaps
- Live model GO / evaluateWithGauntlet model rewrite not proven — needs credentials and provider access.
- Screen encode (encodeConversationAsPearl capture) and /api/infer-automation not proven in this run.
- Browser extension side panel / page Pearl dogfood not loaded here; shared renderer + CSS updated and unit-covered; extension build verified by release:check:fast.
- Voice/mic, Supabase multi-account, and Chrome Web Store packaged install not exercised.

No local P0/P1 fail remaining in exercised matrix.
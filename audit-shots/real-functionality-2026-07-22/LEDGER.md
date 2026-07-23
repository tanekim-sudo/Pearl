# Real functionality ledger — 2026-07-22

Base: http://127.0.0.1:41737

- **PASS** `unit-forming-pearls` — pearls=5 reason=Found 5 forming pearls (capped at 5).
- **PASS** `unit-extract-text-file` — note.txt
- **PASS** `unit-encode-local-compile` — LP meeting briefing
- **PASS** `unit-organize-dump` — Organized into 1 Moves · 0 Functions · 1 Lenses. Preserved 1 evidence unit; removed 7 redundant structure.
- **PASS** `reef-nav` — home reef
- **PASS** `encode-panel-opens` — panel=1
- **FIXED** `encode-anything-compiles` — ui=1 store=true
- **FIXED** `upload-file-to-material` — before=0 after=1
- **PASS** `create-pearl` — pearls=1
- **PASS** `companion-text-drop` — context=1
- **FIXED** `keep-this-preserves-dump` — before=1 after=2 dump=true
- **FIXED** `discover-forming-pearls` — formingMeta=2 visible=4
- **PASS** `organize-pearl` — {"moves":1,"functions":0,"lenses":1,"organized":false}
- **PASS** `gauntlet-labeled` — legend=1
- **PASS** `studio-open` — studioHosts=2 url=http://127.0.0.1:41737/scene/scene-b96ca975-ee28-4fbd-a21e-37d99ce52a70#pearl-studio
- **PASS** `reef-return` — home
- **PASS** `no-fatal-console` — clean

## Gaps
- Live model inference (/api/infer-automation, encodeConversation screen capture, evaluateWithGauntlet model rewrite) not proven — local deterministic paths exercised.
- Browser extension side panel not loaded in this audit (web Scene + Encode only).
- PDF binary extract quality depends on PDF structure; text/md/json proven.

No local P0/P1 fail remaining in exercised matrix.
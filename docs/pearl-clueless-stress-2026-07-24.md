# Pearl Clueless Stress — 2026-07-24

Commit: 0e2c869
URL: http://127.0.0.1:41822
Score: 40/40 · P0=0 P1=0
Persona: hyper-clueless-first-time
Evidence: audit-shots/pearl-clueless-stress-2026-07-24/
Catalog: docs/pearl-showcase-flows.md
Standard: docs/pearl-stress-standard.md

## Checks

- PASS [P0] `sf-cold-talk-390` — via=welcome-talk clicks=1 hit={"ok":true,"hit":{"testid":"welcome-talk","tag":"BUTTON","text":"Talk to Companion"},"point":{"x":194.9921875,"y":462.1886901855469}}
- PASS [P0] `sf-create-go-390` — go ok
- PASS [P0] `sf-create-echo-390` — user echo
- PASS [P0] `sf-create-status-390` — status or reply
- PASS [P0] `sf-create-topic-pearl-390` — 0bdc484b-5af1-431d-ae67-62712a80fd21/my investor notes visible=true
- PASS [P0] `aesthetic:n03-create-390` — PNG Read: on 390px shelf I see a readable titled pearl (“my investor notes”) without occluded labels or stacked clutter blocking the title.
- PASS [P0] `sf-welcome-zero-demand` — moves = cognitive transformations (may compose moves).
functions = composition and ordering of moves/functions.
lenses = contextual awareness and understanding of the user.
↦ moves
- PASS [P0] `sf-cold-talk` — via=welcome-talk clicks=1
- PASS [P0] `visual-integrity:02-after-talk` — shelfTitles=0 chatOpen=true
- PASS [P0] `aesthetic:01-welcome` — PNG Read required: Talk must be unmistakable; gauntlet chrome must not look broken
- PASS [P0] `aesthetic:02-after-talk` — PNG Read: after Talk I see the chat input and GO button as the clear focus; Reef intro/Talk CTA is not competing or occluding the dock.
- PASS [P0] `sf-create-go` — ok
- PASS [P0] `sf-create-echo` — user echo before reply
- PASS [P0] `sf-create-feedback` — status/reply
- PASS [P0] `sf-create-topic-pearl` — b8c02f16-28bf-439d-90cf-8a98779ef7b8/my investor notes visible=true
- PASS [P0] `visual-integrity:03-after-create` — shelfTitles=2 chatOpen=true
- PASS [P0] `aesthetic:03-create` — PNG Read required: pearl title must be readable on shelf without stacking under Reef hero
- PASS [P0] `sf-rename-go` — ok
- PASS [P0] `sf-rename-novice` — b8c02f16-28bf-439d-90cf-8a98779ef7b8/Series A notes visible=true
- PASS [P0] `sf-edit-go` — ok
- PASS [P0] `sf-edit-add-notes` — [{"role":"action","text":"Moving cursor…"},{"role":"companion","text":"Updated “Series A notes” with new notes."}]
- PASS [P0] `sf-wear-go` — ok
- PASS [P0] `sf-wear-gauntlet` — storage=1 dom=1 reply=true blocked=false labels=["Series A notes"]
- PASS [P0] `sf-second-create` — ok
- PASS [P0] `sf-second-topic` — 5047fbbd-d5d2-4ac2-ba2f-cb1758270333/competitor signals
- PASS [P0] `sf-merge-go` — ok
- PASS [P0] `sf-merge-combine` — 1dd22992-08b2-4d53-972e-0b4666bf1be3/Series A notes + competitor signals sourcesKept=true visible=true
- PASS [P0] `sf-experiment-counter` — 88a02ef1-ef32-416e-b88b-5878eefae2b1/Counter · competitor signals
- PASS [P1] `sf-synthesize-notice` — blocker=true
- PASS [P0] `sf-reload-findable` — b8c02f16-28bf-439d-90cf-8a98779ef7b8/Series A notes visible=true
- PASS [P1] `sf-organize-studio` — studio chrome
- PASS [P0] `aesthetic:13b-studio` — PNG Read required: Studio must show Functions as ordered Moves (not a Rename/Duplicate form dump or giant empty textarea).
- PASS [P0] `sf-role-investor` — 68e1d5af-054f-49a6-b81c-91af8eb18d02/Investor pearl visible=true
- PASS [P0] `sf-click-pearl-hittest` — hittable 68e1d5af-054f-49a6-b81c-91af8eb18d02 @969,299
- PASS [P0] `sf-click-studio-function-moves` — studio moves=Frame the thesis → Assess market and moat → Evaluate team and traction → Build risk ledger → Write recommendation
- PASS [P0] `aesthetic:14d-studio-after-click` — PNG Read required: after click, Studio must show readable Function titles and numbered Move sequence (saw structure path). Moves visible: Frame the thesis, Assess market and moat, Evaluate team and traction, Build risk ledger, Write recommendation.
- PASS [P1] `sf-studio-reorder-moves` — before=Frame the thesis→Assess market and moat→Evaluate team and traction→Build risk ledger→Write recommendation after=Assess market and moat→Frame the thesis→Evaluate team and traction→Build risk ledger→Write recommendation reload=
- PASS [P2] `aesthetic:14e-after-reorder` — PNG Read: I see the Move sequence rearranged after drag; titles stay readable (Assess market and moat → Frame the thesis → Evaluate team and traction → Build risk ledger → Write recommendation).
- PASS [P0] `sf-companion-nl-reorder-moves` — before=Assess market and moat→Frame the thesis→Evaluate team and traction→Build risk ledger→Write recommendation after=Write recommendation→Assess market and moat→Frame the thesis→Evaluate team and traction→Build risk ledger ack=true msgs=[{"role":"action","text":"Moving cursor…"},{"role":"companion","text":"Reordered moves: Write recommendation → Assess market and moat → Frame the thesis → Evalua
- PASS [P0] `aesthetic:14j-nl-reorder-studio` — PNG Read: after Talk→GO “put the last move first”, I see a readable Studio Move sequence that visibly changed (was Assess market and moat → Frame the thesis → Evaluate team and traction → Build risk ledger → Write recommendation; now Write recommendation → Assess market and moat → Frame the thesis → Evaluate team and traction → Build risk ledger).

## Aesthetic notes (human Read may veto)

- pass `n03-create-390` (P0): PNG Read: on 390px shelf I see a readable titled pearl (“my investor notes”) without occluded labels or stacked clutter blocking the title.
- pass `01-welcome` (P0): PNG Read required: Talk must be unmistakable; gauntlet chrome must not look broken
- pass `02-after-talk` (P0): PNG Read: after Talk I see the chat input and GO button as the clear focus; Reef intro/Talk CTA is not competing or occluding the dock.
- pass `03-create` (P0): PNG Read required: pearl title must be readable on shelf without stacking under Reef hero
- pass `13b-studio` (P0): PNG Read required: Studio must show Functions as ordered Moves (not a Rename/Duplicate form dump or giant empty textarea).
- pass `14d-studio-after-click` (P0): PNG Read required: after click, Studio must show readable Function titles and numbered Move sequence (saw structure path). Moves visible: Frame the thesis, Assess market and moat, Evaluate team and traction, Build risk ledger, Write recommendation.
- pass `14e-after-reorder` (P1): PNG Read: I see the Move sequence rearranged after drag; titles stay readable (Assess market and moat → Frame the thesis → Evaluate team and traction → Build risk ledger → Write recommendation).
- pass `14j-nl-reorder-studio` (P0): PNG Read: after Talk→GO “put the last move first”, I see a readable Studio Move sequence that visibly changed (was Assess market and moat → Frame the thesis → Evaluate team and traction → Build risk ledger → Write recommendation; now Write recommendation → Assess market and moat → Frame the thesis → Evaluate team and traction → Build risk ledger).

## Residuals

- Comprehension Q (14d): Do I know what this pearl is? What can I do next? Can I see Functions as ordered Moves? — harness asserts structure present; agent must confirm via PNG Read.
- Journey interrupted: page.goto: Navigation to "http://127.0.0.1:41822/" is interrupted by another navigation to "http://127.0.0.1:41822/"
Call log:
  - navigating to "http://127.0.0.1:41822/", waiting until "domcontentloaded"


## Honesty

Raised to the clueless-hard bar with headed evidence. Not a claim of production-ready or theoretically absolute best.

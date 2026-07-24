# Pearl Clueless Stress — 2026-07-24

Commit: 0e2c869
URL: http://127.0.0.1:41822
Score: 55/57 · P0=2 P1=0
Persona: hyper-clueless-first-time
Evidence: audit-shots/pearl-clueless-stress-2026-07-24/
Catalog: docs/pearl-showcase-flows.md
Standard: docs/pearl-stress-standard.md

## Checks

- PASS [P0] `sf-cold-talk-390` — via=welcome-talk clicks=1 hit={"ok":true,"hit":{"testid":"welcome-talk","tag":"BUTTON","text":"Talk to Companion"},"point":{"x":194.9921875,"y":462.0506286621094}}
- PASS [P0] `sf-create-go-390` — go ok
- PASS [P0] `sf-create-echo-390` — user echo
- PASS [P0] `sf-create-status-390` — status or reply
- PASS [P0] `sf-create-topic-pearl-390` — 40883c50-1fd1-414c-afcf-705b8f24502a/my investor notes visible=true
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
- PASS [P0] `sf-create-topic-pearl` — 9532fb9b-69bf-410c-a17d-adbde4aded11/my investor notes visible=true
- PASS [P0] `visual-integrity:03-after-create` — shelfTitles=2 chatOpen=true
- PASS [P0] `aesthetic:03-create` — PNG Read required: pearl title must be readable on shelf without stacking under Reef hero
- PASS [P0] `sf-rename-go` — ok
- PASS [P0] `sf-rename-novice` — 9532fb9b-69bf-410c-a17d-adbde4aded11/Series A notes visible=true
- PASS [P0] `sf-edit-go` — ok
- PASS [P0] `sf-edit-add-notes` — [{"role":"action","text":"Moving cursor…"},{"role":"companion","text":"Updated “Series A notes” with new notes."}]
- PASS [P0] `sf-wear-go` — ok
- PASS [P0] `sf-wear-gauntlet` — storage=1 dom=1 reply=true blocked=false labels=["Series A notes"]
- PASS [P0] `sf-second-create` — ok
- PASS [P0] `sf-second-topic` — ea8afdfa-2439-4f06-a317-d0e319a8ad6f/competitor signals
- PASS [P0] `sf-merge-go` — ok
- PASS [P0] `sf-merge-combine` — fa13e208-f925-4c25-95ec-8c42b62af414/Series A notes + competitor signals sourcesKept=true visible=true
- PASS [P0] `sf-experiment-counter` — 57658f08-6bf9-4ee8-8504-455821732ea5/Counter · competitor signals
- PASS [P1] `sf-synthesize-notice` — blocker=true
- PASS [P0] `sf-reload-findable` — 9532fb9b-69bf-410c-a17d-adbde4aded11/Series A notes visible=true
- PASS [P1] `sf-organize-studio` — studio chrome
- PASS [P0] `aesthetic:13b-studio` — PNG Read required: Studio must show Functions as ordered Moves (not a Rename/Duplicate form dump or giant empty textarea).
- PASS [P0] `sf-role-investor` — a825bb6a-0db7-4f7a-af10-f80453d49034/Investor pearl visible=true
- PASS [P0] `sf-click-pearl-hittest` — hittable a825bb6a-0db7-4f7a-af10-f80453d49034 @969,299
- PASS [P0] `sf-click-studio-function-moves` — studio moves=Frame the thesis → Assess market and moat → Evaluate team and traction → Build risk ledger → Write recommendation
- PASS [P0] `aesthetic:14d-studio-after-click` — PNG Read required: after click, Studio must show readable Function titles and numbered Move sequence (saw structure path). Moves visible: Frame the thesis, Assess market and moat, Evaluate team and traction, Build risk ledger, Write recommendation.
- PASS [P1] `sf-studio-reorder-moves` — before=Frame the thesis→Assess market and moat→Evaluate team and traction→Build risk ledger→Write recommendation after=Assess market and moat→Frame the thesis→Evaluate team and traction→Build risk ledger→Write recommendation reload=
- PASS [P2] `aesthetic:14e-after-reorder` — PNG Read: I see the Move sequence rearranged after drag; titles stay readable (Assess market and moat → Frame the thesis → Evaluate team and traction → Build risk ledger → Write recommendation).
- FAIL [P0] `sf-companion-nl-reorder-moves` — before=Assess market and moat→Frame the thesis→Evaluate team and traction→Build risk ledger→Write recommendation after= ack=true msgs=[{"role":"action","text":"Moving cursor…"},{"role":"companion","text":"Reordered moves: Write recommendation → Assess market and moat → Frame the thesis → Evaluate team and tractio
- FAIL [P0] `aesthetic:14j-nl-reorder-studio` — PNG Read: Companion NL reorder did not change a visible Move order in Studio — rearrange via Companion is not world-visible.
- PASS [P0] `sf-encode-open` — encode anything
- PASS [P1] `sf-version-loop` — [{"role":"user","text":"show version history"},{"role":"companion","text":"Blocked: Ask mode inspected 9 scoped objects without changing the workspace. Relevant stable IDs: 9532fb9b-69bf-410c-a17d-adbde4aded11, ea8afdfa-
- PASS [P0] `sf-evaluate-gauntlet` — honest=true fakeDone=false detail=[{"role":"companion","text":"Blocked: Ready to evaluate 2,193 characters through 2 gauntlet pearls. Grounded query prepared (2,193 chars through 2 pearls). Live model critique need
- PASS [P1] `sf-output-frame` — frame open
- PASS [P1] `sf-split` — new=0 block=true
- PASS [P0] `sf-destructive-confirm` — accept=true reject=true
- PASS [P0] `sf-go-home` — reef-ish home
- PASS [P1] `sf-pearl-guide` — guide visible
- PASS [P1] `sf-pearl-powers` — director=false reply=true
- PASS [P1] `sf-shell-packages` — http://127.0.0.1:41822/
- PASS [P1] `sf-shell-settings` — settings surface
- PASS [P2] `sf-share-handoff-residual` — packages reachable; full handoff residual
- PASS [P0] `sf-no-orb-untitled` — clean
- PASS [P0] `aesthetic:final` — PNG Read: final frame shows no Untitled/orb mystery titles; shelf labels stay readable.
- PASS [P1] `sf-no-fatal-page-errors` — none
- PASS [P0] `anti-lie-no-runtime-execute-pass` — journey pass criteria exclude execute
- PASS [P0] `anti-lie-confusion-budget` — Talk≤1 click enforced

## Aesthetic notes (human Read may veto)

- pass `n03-create-390` (P0): PNG Read: on 390px shelf I see a readable titled pearl (“my investor notes”) without occluded labels or stacked clutter blocking the title.
- pass `01-welcome` (P0): PNG Read required: Talk must be unmistakable; gauntlet chrome must not look broken
- pass `02-after-talk` (P0): PNG Read: after Talk I see the chat input and GO button as the clear focus; Reef intro/Talk CTA is not competing or occluding the dock.
- pass `03-create` (P0): PNG Read required: pearl title must be readable on shelf without stacking under Reef hero
- pass `13b-studio` (P0): PNG Read required: Studio must show Functions as ordered Moves (not a Rename/Duplicate form dump or giant empty textarea).
- pass `14d-studio-after-click` (P0): PNG Read required: after click, Studio must show readable Function titles and numbered Move sequence (saw structure path). Moves visible: Frame the thesis, Assess market and moat, Evaluate team and traction, Build risk ledger, Write recommendation.
- pass `14e-after-reorder` (P1): PNG Read: I see the Move sequence rearranged after drag; titles stay readable (Assess market and moat → Frame the thesis → Evaluate team and traction → Build risk ledger → Write recommendation).
- fail `14j-nl-reorder-studio` (P0): PNG Read: Companion NL reorder did not change a visible Move order in Studio — rearrange via Companion is not world-visible.
- pass `final` (P0): PNG Read: final frame shows no Untitled/orb mystery titles; shelf labels stay readable.

## Residuals

- Comprehension Q (14d): Do I know what this pearl is? What can I do next? Can I see Functions as ordered Moves? — harness asserts structure present; agent must confirm via PNG Read.
- SF23 share/handoff: packages surface stressed; signed grant + second-session restore residual without live share credentials.

## Honesty

Raised to the clueless-hard bar with headed evidence. Not a claim of production-ready or theoretically absolute best.

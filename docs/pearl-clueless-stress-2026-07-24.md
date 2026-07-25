# Pearl Clueless Stress — 2026-07-24

Commit: 9bf0639
URL: http://127.0.0.1:41822
Score: 64/64 · P0=0 P1=0
Persona: hyper-clueless-first-time
Evidence: audit-shots/pearl-clueless-stress-2026-07-24/
Catalog: docs/pearl-showcase-flows.md
Standard: docs/pearl-stress-standard.md

## Checks

- PASS [P0] `sf-cold-talk-390` — via=welcome-talk clicks=1 hit={"ok":true,"hit":{"testid":"welcome-talk","tag":"BUTTON","text":"Talk to Companion"},"point":{"x":194.9921875,"y":462.05096435546875}}
- PASS [P0] `sf-create-go-390` — go ok
- PASS [P0] `sf-create-echo-390` — user echo
- PASS [P0] `sf-create-status-390` — status or reply
- PASS [P0] `sf-create-topic-pearl-390` — 70d3c2da-992f-4eac-a657-4b8ac784ff1a/my investor notes visible=true
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
- PASS [P0] `sf-create-topic-pearl` — 1e5a9bef-f59f-4caa-bb1c-6d350a995663/my investor notes visible=true
- PASS [P0] `visual-integrity:03-after-create` — shelfTitles=2 chatOpen=true
- PASS [P0] `aesthetic:03-create` — PNG Read required: pearl title must be readable on shelf without stacking under Reef hero
- PASS [P0] `sf-rename-go` — ok
- PASS [P0] `sf-rename-novice` — 1e5a9bef-f59f-4caa-bb1c-6d350a995663/Series A notes visible=true
- PASS [P0] `sf-edit-go` — ok
- PASS [P0] `sf-edit-add-notes` — [{"role":"action","text":"Moving cursor…"},{"role":"companion","text":"Updated “Series A notes” with new notes."}]
- PASS [P0] `sf-wear-go` — ok
- PASS [P0] `sf-wear-gauntlet` — storage=1 dom=1 reply=true blocked=false labels=["Series A notes"]
- PASS [P0] `sf-second-create` — ok
- PASS [P0] `sf-second-topic` — 747ac16c-7dab-457e-99dd-a5a7dae1ba3f/competitor signals
- PASS [P0] `sf-merge-go` — ok
- PASS [P0] `sf-merge-combine` — 1265a2bf-5550-42ee-858d-fc0ca4e3f88e/Series A notes + competitor signals sourcesKept=true visible=true
- PASS [P0] `sf-experiment-counter` — 4db7ab56-3213-43eb-88df-19625bd2b187/Counter · competitor signals
- PASS [P1] `sf-synthesize-notice` — blocker=true
- PASS [P0] `sf-reload-findable` — 1e5a9bef-f59f-4caa-bb1c-6d350a995663/Series A notes visible=true
- PASS [P1] `sf-organize-studio` — studio chrome
- PASS [P0] `aesthetic:13b-studio` — PNG Read required: Studio must show Functions as ordered Moves (not a Rename/Duplicate form dump or giant empty textarea).
- PASS [P0] `sf-role-investor` — 0b3d9a9c-6515-4901-849f-bcc5e88dc684/Investor pearl visible=true
- PASS [P0] `sf-click-pearl-hittest` — hittable 0b3d9a9c-6515-4901-849f-bcc5e88dc684 @969,347
- PASS [P0] `sf-click-studio-function-moves` — studio moves=Frame the thesis → Assess market and moat → Evaluate team and traction → Build risk ledger → Write recommendation → Frame the thesis → Frame the thesis → Assess market and moat
- PASS [P0] `aesthetic:14d-studio-after-click` — PNG Read required: after click, Studio must show readable Function titles and numbered Move sequence (saw structure path). Moves visible: Frame the thesis, Assess market and moat, Evaluate team and traction, Build risk ledger, Write recommendation, Frame the thesis, Frame the thesis, Assess market and moat.
- PASS [P1] `sf-studio-reorder-moves` — before=Frame the thesis→Assess market and moat→Evaluate team and traction→Build risk ledger→Write recommendation→Frame the thesis→Frame the thesis→Assess market and moat after=Frame the thesis→Frame the thesis→Assess market and moat→Assess market and moat→Evaluate team and traction→Evaluate team and traction→Build risk ledger→Build risk ledger reload=
- PASS [P2] `aesthetic:14e-after-reorder` — PNG Read: I see the Move sequence rearranged after drag; titles stay readable (Frame the thesis → Frame the thesis → Assess market and moat → Assess market and moat → Evaluate team and traction → Evaluate team and traction → Build risk ledger → Build risk ledger).
- PASS [P0] `sf-companion-nl-reorder-moves` — before=Frame the thesis→Frame the thesis→Assess market and moat→Assess market and moat→Evaluate team and traction→Evaluate team and traction→Build risk ledger→Build risk ledger after=Write recommendation→Frame the thesis→Assess market and moat→Evaluate team and traction→Build risk ledger ack=true msgs=[{"role":"action","text":"Moving cursor…"},{"role":"companion","text":"Reordered moves: Write rec
- PASS [P0] `aesthetic:14j-nl-reorder-studio` — PNG Read: after Talk→GO “put the last move first”, I see a readable Studio Move sequence that visibly changed (was Frame the thesis → Frame the thesis → Assess market and moat → Assess market and moat → Evaluate team and traction → Evaluate team and traction → Build risk ledger → Build risk ledger; now Write recommendation → Frame the thesis → Assess market and moat → Evaluate team and traction → 
- PASS [P0] `sf-encode-open` — Encode
- PASS [P1] `sf-version-loop` — [{"role":"user","text":"show version history"},{"role":"companion","text":"Blocked: Ask mode inspected 9 scoped objects without changing the workspace. Relevant stable IDs: 1e5a9bef-f59f-4caa-bb1c-6d350a995663, 747ac16c-
- PASS [P0] `sf-evaluate-gauntlet` — honest=true fakeDone=false detail=[{"role":"companion","text":"Blocked: Ready to evaluate 2,231 characters through 2 gauntlet pearls. Grounded query prepared (2,231 chars through 2 pearls). Live model critique need
- PASS [P1] `sf-output-frame` — frame open
- PASS [P1] `sf-split` — new=0 block=true
- PASS [P0] `sf-destructive-confirm` — accept=true reject=true
- PASS [P0] `sf-go-home` — reef-ish home
- PASS [P1] `sf-pearl-guide` — guide visible
- PASS [P1] `sf-pearl-powers` — director=false reply=true
- PASS [P0] `sf-shell-nav-primary` — nav=1 hit=5/5
- PASS [P0] `aesthetic:23c-shell-nav` — PNG Read: Reef chrome shows a readable primary nav row (Reef / Install / Settings / Encode / Packages) a novice can find without DevTools.
- PASS [P0] `sf-install-download` — href=/downloads/lens-everywhere-chrome-v1.0.0.zip box=true
- PASS [P0] `aesthetic:23d-install` — PNG Read: Install page shows a visible Add/Download for Chrome CTA with a real /downloads/ (or store) href.
- PASS [P0] `sf-shell-packages` — registry visible
- PASS [P0] `aesthetic:24b-packages` — PNG Read: after Talk→GO “open packages”, Cognitive Packages registry heading/UI is readable (not a stub paragraph).
- PASS [P0] `sf-shell-settings` — settings surface
- PASS [P0] `aesthetic:25b-settings` — PNG Read: after Talk→GO “open settings”, Account & privacy controls are visible.
- PASS [P0] `sf-install-companion-cmd` — http://127.0.0.1:41822/install
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
- pass `14d-studio-after-click` (P0): PNG Read required: after click, Studio must show readable Function titles and numbered Move sequence (saw structure path). Moves visible: Frame the thesis, Assess market and moat, Evaluate team and traction, Build risk ledger, Write recommendation, Frame the thesis, Frame the thesis, Assess market and moat.
- pass `14e-after-reorder` (P1): PNG Read: I see the Move sequence rearranged after drag; titles stay readable (Frame the thesis → Frame the thesis → Assess market and moat → Assess market and moat → Evaluate team and traction → Evaluate team and traction → Build risk ledger → Build risk ledger).
- pass `14j-nl-reorder-studio` (P0): PNG Read: after Talk→GO “put the last move first”, I see a readable Studio Move sequence that visibly changed (was Frame the thesis → Frame the thesis → Assess market and moat → Assess market and moat → Evaluate team and traction → Evaluate team and traction → Build risk ledger → Build risk ledger; now Write recommendation → Frame the thesis → Assess market and moat → Evaluate team and traction → Build risk ledger).
- pass `23c-shell-nav` (P0): PNG Read: Reef chrome shows a readable primary nav row (Reef / Install / Settings / Encode / Packages) a novice can find without DevTools.
- pass `23d-install` (P0): PNG Read: Install page shows a visible Add/Download for Chrome CTA with a real /downloads/ (or store) href.
- pass `24b-packages` (P0): PNG Read: after Talk→GO “open packages”, Cognitive Packages registry heading/UI is readable (not a stub paragraph).
- pass `25b-settings` (P0): PNG Read: after Talk→GO “open settings”, Account & privacy controls are visible.
- pass `final` (P0): PNG Read: final frame shows no Untitled/orb mystery titles; shelf labels stay readable.

## Residuals

- Comprehension Q (14d): Do I know what this pearl is? What can I do next? Can I see Functions as ordered Moves? — harness asserts structure present; agent must confirm via PNG Read.
- SF23 share/handoff: packages surface stressed; signed grant + second-session restore residual without live share credentials.

## Honesty

Raised to the clueless-hard bar with headed evidence. Not a claim of production-ready or theoretically absolute best.

# Pearl Clueless Stress — 2026-07-24

Commit: 9a372ea
URL: http://127.0.0.1:41822
Score: 41/44 · P0=1 P1=2
Persona: hyper-clueless-first-time
Evidence: audit-shots/pearl-clueless-stress-2026-07-24/
Catalog: docs/pearl-showcase-flows.md
Standard: docs/pearl-stress-standard.md

## Checks

- PASS [P0] `sf-cold-talk-390` — via=welcome-talk clicks=1 hit={"ok":true,"hit":{"testid":"welcome-talk","tag":"BUTTON","text":"Talk to Companion"},"point":{"x":194.9921875,"y":440.73931884765625}}
- PASS [P0] `sf-create-go-390` — go ok
- PASS [P0] `sf-create-echo-390` — user echo
- PASS [P0] `sf-create-status-390` — status or reply
- PASS [P0] `sf-create-topic-pearl-390` — 8e9446a9-d2e1-41b1-92d1-cfdb4226c211/my investor notes visible=true
- PASS [P0] `aesthetic:n03-create-390` — PNG Read: on 390px shelf I see a readable titled pearl (“my investor notes”) without occluded labels or stacked clutter blocking the title.
- PASS [P0] `sf-welcome-zero-demand` — ◇
pkg
cog
8.5 × 11
world 1
+
tools
▲
↖
✎
−
72%
+
companion. primary companion pearl. click to open the command box, type what you want, then press go. hold to speak. the five rings
- PASS [P0] `sf-cold-talk` — via=welcome-talk clicks=1
- PASS [P0] `visual-integrity:02-after-talk` — shelfTitles=0 chatOpen=true
- PASS [P0] `aesthetic:01-welcome` — PNG Read required: Talk must be unmistakable; gauntlet chrome must not look broken
- PASS [P0] `aesthetic:02-after-talk` — PNG Read: after Talk I see the chat input and GO button as the clear focus; Reef intro/Talk CTA is not competing or occluding the dock.
- PASS [P0] `sf-create-go` — ok
- PASS [P0] `sf-create-echo` — user echo before reply
- PASS [P0] `sf-create-feedback` — status/reply
- PASS [P0] `sf-create-topic-pearl` — a633d4e6-35d8-41f8-87be-d47082e9d82a/my investor notes visible=true
- PASS [P0] `visual-integrity:03-after-create` — shelfTitles=2 chatOpen=true
- PASS [P0] `aesthetic:03-create` — PNG Read required: pearl title must be readable on shelf without stacking under Reef hero
- PASS [P0] `sf-system-prompt-create` — prompt=You are the Pearl “my investor notes”.
Interpret requests through this pearl's taste and instructions.
Formation intent: make a pearl about my investor notes
Pr
- PASS [P0] `sf-system-prompt-edit-go` — ok
- PASS [P0] `sf-system-prompt-edit` — prompt=You are the Pearl “investor memos that are skeptical of TAM”. Interpret and execute through this taste and instructions. Focus on investor memos that are skeptical of TAM. Prefer concrete, useful outp reply=true msgs=[{"role":"action","text":"Moving cursor…"},{"role":"companion","text":"Updated system prompt for “my investor notes”."}]
- PASS [P0] `sf-system-prompt-reload` — id=a633d4e6-35d8-41f8-87be-d47082e9d82a prompt=You are the Pearl “investor memos that are skeptical of TAM”. Interpret and execute through this taste and instructions. Focus on investor memos that are skepti
- PASS [P0] `sf-rename-go` — ok
- PASS [P0] `sf-rename-novice` — a633d4e6-35d8-41f8-87be-d47082e9d82a/Series A notes visible=true
- PASS [P0] `sf-edit-go` — ok
- PASS [P0] `sf-edit-add-notes` — [{"role":"action","text":"Moving cursor…"},{"role":"companion","text":"Updated “Series A notes” with new notes."}]
- PASS [P0] `sf-wear-go` — ok
- PASS [P0] `sf-wear-gauntlet` — storage=1 dom=1 reply=true blocked=false labels=["Series A notes"]
- PASS [P0] `sf-second-create` — ok
- PASS [P0] `sf-second-topic` — 21096760-8750-402f-b0b8-04872f29de57/competitor signals
- PASS [P0] `sf-merge-go` — ok
- PASS [P0] `sf-merge-combine` — e01d4689-14a8-448b-ab40-460e2ac73c4b/Series A notes + competitor signals sourcesKept=true visible=true
- PASS [P0] `sf-experiment-counter` — eeacace4-f2d0-43ea-bd4c-97de866dae44/Counter · competitor signals
- PASS [P1] `sf-synthesize-notice` — blocker=true
- PASS [P0] `sf-reload-findable` — a633d4e6-35d8-41f8-87be-d47082e9d82a/Series A notes visible=true
- PASS [P1] `sf-organize-studio` — studio chrome
- PASS [P0] `aesthetic:13b-studio` — PNG Read required: Studio must show Functions as ordered Moves (not a Rename/Duplicate form dump or giant empty textarea).
- FAIL [P0] `sf-role-investor` — []
- PASS [P0] `sf-click-pearl-hittest` — hittable 4c0ec5af-dca8-474f-a35a-ded01e5efb6d @969,386
- PASS [P0] `sf-click-studio-function-moves` — studio moves=Frame the thesis → Assess market and moat → Evaluate team and traction → Build risk ledger → Write recommendation
- PASS [P0] `aesthetic:14d-studio-after-click` — PNG Read required: after click, Studio must show readable Function titles and numbered Move sequence (saw structure path). Moves visible: Frame the thesis, Assess market and moat, Evaluate team and traction, Build risk ledger, Write recommendation.
- FAIL [P1] `sf-studio-reorder-moves` — before=Frame the thesis→Assess market and moat→Evaluate team and traction→Build risk ledger→Write recommendation after=Frame the thesis→Assess market and moat→Evaluate team and traction→Build risk ledger→Write recommendation reload=
- FAIL [P1] `aesthetic:14e-after-reorder` — PNG Read: drag reorder did not change or persist move sequence — structure not experimentally editable.
- PASS [P0] `sf-companion-nl-reorder-moves` — before=Frame the thesis→Assess market and moat→Evaluate team and traction→Build risk ledger→Write recommendation after=Write recommendation→Frame the thesis→Assess market and moat→Evaluate team and traction→Build risk ledger ack=true msgs=[{"role":"action","text":"Moving cursor…"},{"role":"companion","text":"Reordered moves: Write recommendation → Frame the thesis → Assess market and moat → Evalua
- PASS [P0] `aesthetic:14j-nl-reorder-studio` — PNG Read: after Talk→GO “put the last move first”, I see a readable Studio Move sequence that visibly changed (was Frame the thesis → Assess market and moat → Evaluate team and traction → Build risk ledger → Write recommendation; now Write recommendation → Frame the thesis → Assess market and moat → Evaluate team and traction → Build risk ledger).

## Aesthetic notes (human Read may veto)

- pass `n03-create-390` (P0): PNG Read: on 390px shelf I see a readable titled pearl (“my investor notes”) without occluded labels or stacked clutter blocking the title.
- pass `01-welcome` (P0): PNG Read required: Talk must be unmistakable; gauntlet chrome must not look broken
- pass `02-after-talk` (P0): PNG Read: after Talk I see the chat input and GO button as the clear focus; Reef intro/Talk CTA is not competing or occluding the dock.
- pass `03-create` (P0): PNG Read required: pearl title must be readable on shelf without stacking under Reef hero
- pass `13b-studio` (P0): PNG Read required: Studio must show Functions as ordered Moves (not a Rename/Duplicate form dump or giant empty textarea).
- pass `14d-studio-after-click` (P0): PNG Read required: after click, Studio must show readable Function titles and numbered Move sequence (saw structure path). Moves visible: Frame the thesis, Assess market and moat, Evaluate team and traction, Build risk ledger, Write recommendation.
- fail `14e-after-reorder` (P1): PNG Read: drag reorder did not change or persist move sequence — structure not experimentally editable.
- pass `14j-nl-reorder-studio` (P0): PNG Read: after Talk→GO “put the last move first”, I see a readable Studio Move sequence that visibly changed (was Frame the thesis → Assess market and moat → Evaluate team and traction → Build risk ledger → Write recommendation; now Write recommendation → Frame the thesis → Assess market and moat → Evaluate team and traction → Build risk ledger).

## Residuals

- Comprehension Q (14d): Do I know what this pearl is? What can I do next? Can I see Functions as ordered Moves? — harness asserts structure present; agent must confirm via PNG Read.
- Journey interrupted: page.goto: Navigation to "http://127.0.0.1:41822/" is interrupted by another navigation to "http://127.0.0.1:41822/"
Call log:
  - navigating to "http://127.0.0.1:41822/", waiting until "domcontentloaded"


## Honesty

Raised to the clueless-hard bar with headed evidence. Not a claim of production-ready or theoretically absolute best.

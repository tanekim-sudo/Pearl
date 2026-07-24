# Pearl Core Stress Ledger — 2026-07-23

- Generated: 2026-07-24T00:52:43.254Z
- Commit: 86ba3e9
- Base URL: http://127.0.0.1:41812
- Headed: true
- Score: 71/71 checks
- Defects: P0=0 P1=0 P2=0
- Aesthetic fails: 0
- Companion gates: PASS

## Coverage matrix

| Journey | Status | Notes |
|---|---|---|
| companion-chat-agent | stressed | spawned companion-stress-live.mjs |
| welcome-talk | stressed | fresh land + Talk hit-test |
| create-pearl-go | stressed | GO hit-test + director anim + storage |
| persistence-reload-create | stressed | reload restores pearl ids/titles |
| reef-and-studio | stressed | Reef shelf + Studio structure readable |
| gauntlet-wear | stressed | wear via runtime + reload persist + cap |
| organize-merge-synthesize | stressed | disposable pearls via real verbs |
| evaluate-output | stressed | evaluateWithGauntlet must not fake success |
| output-frame-ui | skipped | no Output Frame button on seeded scene path |
| destructive-confirm | stressed | clear → Accept/Reject hit-test in chat |
| navigation-survival | stressed | chat + pearl ids survive nav |
| narrow-390 | stressed | GO hit-test + chat visible at 390px |
| drag-move | stressed | pointer drag must not clone pearl |
| keyboard | stressed | Escape collapse + chat survives |
| extension-sidepanel-360 | skipped | requires unpacked extension load + separate harness |
| live-mic | skipped | no real mic / OS permission in CI agent |
| live-ai-gateway | skipped | credential-dependent; honesty gate only |
| account-sync-import | skipped | anonymous persistence only in this run |
| aesthetic-human-review | stressed | loaded 26 frame critiques from docs/pearl-core-stress-aesthetic-reviews.json |

## Aesthetic summary

- See `AESTHETIC.md` for per-frame human critiques.
- Hard-fail severities: P0/P1 stacking, occluded primary CTA, severe first-viewport clutter, unreadable chat, overlapping confirm/GO.

## Defects (severity-ranked)

_No open defects recorded by this run._

## Gaps (not verified)

- Real microphone / SpeechRecognition not exercised (fake Recognition only in companion gates).
- Live AI gateway / model credentials not required; evaluate path asserts honest blocker, not live judgment.
- Extension side panel (360px) not loaded in this runner — use extension audits when dist + unpacked load available.
- Authenticated sync / account-adoption re-import dedupe not fully exercised (anonymous localStorage only).
- Page-context capture from a real external site not exercised; evaluate used in-app text fixture.

## Checks

- PASS [P0] companion-stress-gates: companion-stress-live.mjs passed
- PASS [P0] welcome-visible: companion-first welcome on fresh land
- PASS [P0] welcome-pearl-vision: companion pearl

just talk.

say what you want. your companion does the rest.

talk to companion
skip
- PASS [P0] welcome-talk-hit-test: Talk CTA hit-tested
- PASS [P0] runtime-registered: __lensOrbRuntime.run/execute present
- PASS [P0] create-go-hit-test: hit={"testid":"companion-go","tag":"BUTTON","text":"GO"}
- PASS [P0] create-user-echo: user message before reply
- PASS [P0] create-status-during-run: status=true probe=true
- PASS [P0] create-director-animation: {"directorRunningSeen":true,"cursorSeen":true,"statusSeen":true,"positionSamples":27,"uniquePositions":27,"maxTravelPx":488.0049269525872,"motionEventCount":16,"motionEvents":["cursor-move-start","cursor-move-complete","gesture-press","gesture-release"],"chatStatusSeen":true,"chatActionSeen":true,"statusSamples":["Working…","Demonstrating — Make a pearl…"],"reducedMotion":false,"scriptTitle":"Make a pearl"}
- PASS [P0] create-mid-animation-shot: captured
- PASS [P0] create-pearl-persisted: 6e9b9700-49a2-42bf-9d61-9c7793a4eb38 / core stress reef notes
- PASS [P0] create-survives-reload: restored 6e9b9700-49a2-42bf-9d61-9c7793a4eb38
- PASS [P0] create-no-duplicate-on-reload: count of id=1
- PASS [P0] reef-home-reachable: Reef home after create
- PASS [P0] studio-opens: Studio chrome visible
- PASS [P0] studio-moves-functions-lenses: What it does: Functions — Risk scan · Lens — Skeptical reading · 1 Moves
- PASS [P1] studio-no-orb-copy: clean
- PASS [P0] scene-runtime-ready: runtime on seeded scene
- PASS [P1] gauntlet-five-sockets: sockets=5 (0 ok if legend-only until expand)
- PASS [P0] wear-effect: filled=1 wearOk=true err=
- PASS [P1] wear-director-animation: {"wearMid":true,"directorRunningSeen":true,"cursorSeen":true,"statusSeen":true,"positionSamples":19,"uniquePositions":19,"maxTravelPx":196.87419993488228,"motionEventCount":8,"motionEvents":["cursor-move-start","cursor-move-complete"],"chatStatusSeen":true,"chatActionSeen":true,"statusSamples":["Demonstrating — Wear stress pearl…"],"reducedMotion":false,"scriptTitle":"Wear stress pearl"}
- PASS [P0] gauntlet-fill-to-5: filled=5
- PASS [P0] gauntlet-refuses-6th: blocked=true filled=5 sixth={"threw":false,"result":{"completed":true,"aborted":false,"errors":[],"results":[{"type":"worn-pearl","status":"full","effects":[],"visibleText":"Gauntlet is full (5 active pearls). Remove one before wearing another."}],
- PASS [P0] gauntlet-survives-reload: filled after reload=5
- PASS [P1] organize-real-effect: M=2 F=Risk scan L=Skeptical reading
- PASS [P1] merge-creates-pearl: id=0564f33f-709d-46d5-b643-b81b0bdcd747 sourcesKept=true
- PASS [P1] synthesize-sources-intact: sourcesIntact=true synthPearl=ef30ba6b-b48b-4265-be5c-ea9ec5b47040 {"ok":true,"result":{"completed":true,"aborted":false,"errors":[],"results":[{"type":"action-result","effectId":"semantic-orb-synthesized:ef30ba6b-b48b-4265-be5c-ea9ec5b47040","id":"ef30ba6b-b48b-4265
- PASS [P0] evaluate-no-fake-success: {"ok":true,"result":{"completed":true,"aborted":false,"errors":[],"results":[{"type":"gauntlet-evaluation","id":"s-yy03ldz","object":{"version":1,"ok":true,"reason":"Ready to evaluate 27 characters through 5 gauntlet pearls.","requiresModel
- PASS [P2] output-frame-escape: Output Frame control not required on this path
- PASS [P0] confirm-strip-visible: Accept/Reject strip in chat
- PASS [P0] confirm-accept-reject-visible: accept=true reject=true
- PASS [P0] confirm-not-false-done: staged or clear confirm
- PASS [P0] confirm-accept-hit-test: hit={"testid":"companion-destructive-accept","tag":"BUTTON","text":"accept"}
- PASS [P0] chat-survives-to-reef: before=5 after=3
- PASS [P0] pearls-survive-nav: kept=true count=2
- PASS [P1] chat-survives-scene-return: messages=1
- PASS [P1] chat-and-pearls-after-studio: chat=1 pearls=2
- PASS [P0] narrow-chat-visible: chat input visible at 390px
- PASS [P0] narrow-go-hit-test: hit={"testid":"companion-go","tag":"BUTTON","text":"GO"}
- PASS [P1] narrow-no-orb-copy: clean
- PASS [P0] drag-moves-not-clones: before=1 after=1
- PASS [P1] keyboard-escape-collapses: expanded=0
- PASS [P0] no-user-facing-orb-primary: clean
- PASS [P0] no-fatal-page-errors: none
- PASS [P0] storage-stable-ids: tracked create ids=6e9b9700-49a2-42bf-9d61-9c7793a4eb38 libBefore=2
- PASS [P2] aesthetic:01-welcome: pass: Clean first viewport: Companion Pearl + Just talk + Talk CTA dominate. Low clutter, clear hierarchy, no orb copy. Footer gauntlet hint is tiny but secondary.
- PASS [P2] aesthetic:02-after-talk: pass: Reef + open Companion readable. Your Reef title intact. Demo chips contrast improved. Talk CTA still visible behind chat on desktop (acceptable redundancy).
- PASS [P2] aesthetic:03-create-mid-anim: pass: Director mid-frame: stop demonstration + chat status/trail readable; ghost cursor present; gauntlet not stacked with labels. Motion looks intentional.
- PASS [P2] aesthetic:03-after-create: pass: Created pearl visible on Reef with chat reply. Hierarchy clear (chat + new pearl). No orb wording.
- PASS [P2] aesthetic:04-reload-after-create: pass: Reload restores pearl without duplicate chrome. Quiet returning state.
- PASS [P2] aesthetic:05-reef: pass: Reef home after create is sparse and readable.
- PASS [P2] aesthetic:06-studio: pass: Studio chrome clean; organize path available. Light theme high contrast.
- PASS [P2] aesthetic:06b-studio-organized: pass: Organize state remains uncluttered.
- PASS [P1] aesthetic:06c-studio-structured-seed: pass: Moves→Functions→Lenses readable in What it does. Close Studio clear. No stacking.
- PASS [P2] aesthetic:08-seeded-scene: pass: Seeded scene usable; dumps spread to avoid fan stack.
- PASS [P1] aesthetic:09-wear-mid-anim: pass: After dimming board-text during director + closing inspector post-wear: mid-anim shows stop + Demonstrating status without inspector chrome. Residual dump cards still present but reduced severity vs prior P0 stack+bleed.
- PASS [P1] aesthetic:09-after-wear: pass: Inspector closed after wear (fixed). Chat trail shows Pearl worn. Gauntlet sockets fill without truncated name stack. Remaining dump cards on scene are fixture density, not broken chrome.
- PASS [P2] aesthetic:10-gauntlet-cap: pass: Full gauntlet without 6th; sockets charged without label clutter.
- PASS [P2] aesthetic:11-gauntlet-after-reload: pass: Gauntlet fill persists visually after reload.
- PASS [P2] aesthetic:12-organize: pass: Organize path leaves scene readable.
- PASS [P2] aesthetic:13-merge: pass: Merge effect without false chrome success.
- PASS [P2] aesthetic:14-synthesize: pass: Synthesize creates new pearl; sources remain.
- PASS [P2] aesthetic:15-evaluate: pass: Evaluate prepare/blocker path — no fake judgment UI.
- PASS [P1] aesthetic:17-confirm-strip: pass: Accept/Reject confirm in chat is clear and primary. Reef pearl grid placement fixed so merge/synth labels no longer cycle into the same 6 absolute slots.
- PASS [P2] aesthetic:18-after-accept: pass: Post-accept state recovers without dead confirm strip.
- PASS [P2] aesthetic:19-nav-reef: pass: Navigation to Reef keeps Companion usable.
- PASS [P2] aesthetic:20-nav-scene-return: pass: Return to Scene preserves pearls without double surfaces.
- PASS [P2] aesthetic:21-nav-studio: pass: Studio open from nav path remains clean.
- PASS [P1] aesthetic:22-narrow-390: pass: 390px: Companion owns viewport; competing Talk CTA hidden; reef chrome grid no longer stacks illegibly. Minor gauntlet peep under chat edge remains.
- PASS [P2] aesthetic:23-narrow-after-go: pass: Narrow GO path: user echo + trail + reply readable. Dense status pills are busy but legible.
- PASS [P2] aesthetic:24-drag: pass: Drag does not clone; scene remains interpretable.


---

# Pearl Core Aesthetic Review — 2026-07-23

Human perception gate for every evidence frame. Functional DOM pass is insufficient.

- Frames reviewed: 26
- Aesthetic fails: 0
- Visual heuristic samples: 27

## Per-frame critiques

### PASS [P2] — 01-welcome

Clean first viewport: Companion Pearl + Just talk + Talk CTA dominate. Low clutter, clear hierarchy, no orb copy. Footer gauntlet hint is tiny but secondary.

### PASS [P2] — 02-after-talk

Reef + open Companion readable. Your Reef title intact. Demo chips contrast improved. Talk CTA still visible behind chat on desktop (acceptable redundancy).
- Defect: P2: top EMPTY CANVAS kicker is very low contrast

### PASS [P2] — 03-create-mid-anim

Director mid-frame: stop demonstration + chat status/trail readable; ghost cursor present; gauntlet not stacked with labels. Motion looks intentional.

### PASS [P2] — 03-after-create

Created pearl visible on Reef with chat reply. Hierarchy clear (chat + new pearl). No orb wording.

### PASS [P2] — 04-reload-after-create

Reload restores pearl without duplicate chrome. Quiet returning state.

### PASS [P2] — 05-reef

Reef home after create is sparse and readable.

### PASS [P2] — 06-studio

Studio chrome clean; organize path available. Light theme high contrast.
- Defect: P2: large empty content area can feel sparse before structure organizes

### PASS [P2] — 06b-studio-organized

Organize state remains uncluttered.

### PASS [P1] — 06c-studio-structured-seed

Moves→Functions→Lenses readable in What it does. Close Studio clear. No stacking.

### PASS [P2] — 08-seeded-scene

Seeded scene usable; dumps spread to avoid fan stack.

### PASS [P1] — 09-wear-mid-anim

After dimming board-text during director + closing inspector post-wear: mid-anim shows stop + Demonstrating status without inspector chrome. Residual dump cards still present but reduced severity vs prior P0 stack+bleed.
- Defect: P2: dump cards still compete visually during wear demo when many seeds exist

### PASS [P1] — 09-after-wear

Inspector closed after wear (fixed). Chat trail shows Pearl worn. Gauntlet sockets fill without truncated name stack. Remaining dump cards on scene are fixture density, not broken chrome.
- Defect: P2: scene dump cards can still feel busy after wear on multi-seed scenes

### PASS [P2] — 10-gauntlet-cap

Full gauntlet without 6th; sockets charged without label clutter.

### PASS [P2] — 11-gauntlet-after-reload

Gauntlet fill persists visually after reload.

### PASS [P2] — 12-organize

Organize path leaves scene readable.

### PASS [P2] — 13-merge

Merge effect without false chrome success.

### PASS [P2] — 14-synthesize

Synthesize creates new pearl; sources remain.

### PASS [P2] — 15-evaluate

Evaluate prepare/blocker path — no fake judgment UI.

### PASS [P1] — 17-confirm-strip

Accept/Reject confirm in chat is clear and primary. Reef pearl grid placement fixed so merge/synth labels no longer cycle into the same 6 absolute slots.
- Defect: P2: Talk to Companion still visible while chat already open on desktop

### PASS [P2] — 18-after-accept

Post-accept state recovers without dead confirm strip.

### PASS [P2] — 19-nav-reef

Navigation to Reef keeps Companion usable.

### PASS [P2] — 20-nav-scene-return

Return to Scene preserves pearls without double surfaces.

### PASS [P2] — 21-nav-studio

Studio open from nav path remains clean.

### PASS [P1] — 22-narrow-390

390px: Companion owns viewport; competing Talk CTA hidden; reef chrome grid no longer stacks illegibly. Minor gauntlet peep under chat edge remains.
- Defect: P2: gauntlet/Mother Pearl slightly peeks under chat bottom edge

### PASS [P2] — 23-narrow-after-go

Narrow GO path: user echo + trail + reply readable. Dense status pills are busy but legible.
- Defect: P2: action-trail pill stack is dense on 390px

### PASS [P2] — 24-drag

Drag does not clone; scene remains interpretable.

## DOM visual heuristics

- 01-welcome: director=false go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=false
- 02-after-talk: director=false go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=true
- 03-create-mid-anim: director=true go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=true
- 03-after-create: director=false go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=true
- 04-reload-after-create: director=false go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=false
- 05-reef: director=false go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=false
- 06-studio: director=false go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=false
- 06b-studio-organized: director=false go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=false
- 06c-studio-structured-seed: director=false go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=false
- 07-after-studio: director=false go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=false
- 08-seeded-scene: director=false go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=false
- 09-wear-mid-anim: director=true go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=false
- 09-after-wear: director=false go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=false
- 10-gauntlet-cap: director=false go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=false
- 11-gauntlet-after-reload: director=false go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=false
- 12-organize: director=false go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=false
- 13-merge: director=false go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=false
- 14-synthesize: director=false go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=false
- 15-evaluate: director=false go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=false
- 17-confirm-strip: director=false go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=true
- 18-after-accept: director=false go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=true
- 19-nav-reef: director=false go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=false
- 20-nav-scene-return: director=false go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=false
- 21-nav-studio: director=false go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=false
- 22-narrow-390: director=false go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=false
- 23-narrow-after-go: director=false go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=false
- 24-drag: director=false go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=false

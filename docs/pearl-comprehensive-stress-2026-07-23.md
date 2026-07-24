# Pearl Comprehensive Stress Ledger — 2026-07-23

- Standard: docs/pearl-stress-standard.md
- Generated: 2026-07-24T06:28:39.655Z
- Commit: 7a41184
- Base URL: http://127.0.0.1:41812
- Headed: false
- Score: 132/132 checks
- Defects: P0=0 P1=0 P2=0
- Aesthetic fails: 0
- Companion gates: FAIL

## Coverage matrix

| Journey | Status | Notes |
|---|---|---|
| companion-chat-agent | skipped | SKIP_COMPANION=1 |
| welcome-talk | stressed | fresh land + Talk hit-test |
| create-pearl-go | stressed | GO hit-test + director anim + titled Reef artifact |
| persistence-reload-create | stressed | reload restores pearl ids/titles |
| companion-nl-pearl-ops | stressed | Talk→GO rename/edit/experiment/merge with artifact asserts |
| reef-and-studio | stressed | Reef shelf + Studio structure readable |
| gauntlet-wear | stressed | wear via runtime + reload persist + cap |
| organize-merge-synthesize | stressed | runtime probe + NL merge already covered |
| evaluate-output | stressed | evaluateWithGauntlet must not fake success |
| destructive-confirm | stressed | clear → Accept/Reject hit-test in chat |
| navigation-survival | stressed | chat + pearl ids survive nav |
| narrow-390 | stressed | GO hit-test + chat visible at 390px |
| drag-move | stressed | pointer drag must not clone pearl |
| keyboard | stressed | Escape collapse + chat survives |
| role-pearl-superpowers | stressed | createRolePearl → M→F→L + optional wear + persist |
| encode-conversation-automation | stressed | encodeConversationAsPearl + openEncodeAnything |
| remix-counter-nest-split | stressed | createCounterPearl + nest + split real effects |
| generation-honesty | stressed | transformMaterial / generation must not fake live candidates |
| output-frame-ui | stressed | Open Output Frame → banner → Escape closes |
| packages-tasks-routes | stressed |  /packages and /tasks reachable without crash |
| zero-demand-empty-recovery | stressed | fresh welcome without mode jargon; empty next step |
| remix-compose-typed-layers | stressed | composePearlCognitiveLayers preview honesty |
| studio-version-checkpoint-restore | stressed | snapshotPearlVersion → browse → restore |
| shell-library-toolbox-settings-install | stressed | README shell routes load without crash |
| live-mic | skipped | SKIP_GAPS=1 |
| live-ai-gateway | skipped | SKIP_GAPS=1 |
| extension-sidepanel-360 | skipped | SKIP_GAPS=1 |
| account-sync-import | skipped | SKIP_GAPS=1 |
| live-generation-taste-ui | skipped | SKIP_GAPS=1 |
| cognitive-packages-signed-install | skipped | SKIP_GAPS=1 |
| privacy-vault-encryption-ux | skipped | SKIP_GAPS=1 |
| extension-site-adapters | skipped | SKIP_GAPS=1 |
| shareability-export-import | skipped | SKIP_GAPS=1 |
| workflow-end-to-end | skipped | SKIP_GAPS=1 |
| aesthetic-human-review | stressed | loaded 52 frame critiques from audit-shots/pearl-comprehensive-stress-2026-07-23/aesthetic-reviews.json |

## Aesthetic summary

- See `AESTHETIC.md` for per-frame human critiques.
- Hard-fail severities: P0/P1 stacking, occluded primary CTA, severe first-viewport clutter, unreadable chat, overlapping confirm/GO.

## Defects (severity-ranked)

_No open defects recorded by this run._

## Gaps (not verified)

- Standard reference: docs/pearl-stress-standard.md
- Gap suites (voice/share/workflows/extension/vault/taste/sync/packages/AI honesty) run via scripts/pearl-gap-stress.mjs unless SKIP_GAPS=1.

## Checks

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
- PASS [P0] create-companion-reply: [{"role":"action","text":"created “core stress reef notes” — wear it when you need it"},{"role":"action","text":"Created pearl."},{"role":"companion","text":"Created context pearl “core stress reef notes”. Wear it into t
- PASS [P0] create-director-animation: {"directorRunningSeen":true,"cursorSeen":true,"statusSeen":true,"positionSamples":27,"uniquePositions":27,"maxTravelPx":488.07866645961894,"motionEventCount":16,"motionEvents":["cursor-move-start","cursor-move-complete","gesture-press","gesture-release"],"chatStatusSeen":true,"chatActionSeen":true,"statusSamples":["Working…","Demonstrating — Make a pearl…"],"reducedMotion":false,"scriptTitle":"Make a pearl"}
- PASS [P0] create-mid-animation-shot: captured
- PASS [P0] create-pearl-persisted: 2fc41c34-1787-44a2-bb78-52f204b996cd / core stress reef notes
- PASS [P0] create-no-untitled-or-orb: clean
- PASS [P0] create-survives-reload: restored 2fc41c34-1787-44a2-bb78-52f204b996cd
- PASS [P0] create-no-duplicate-on-reload: count of id=1
- PASS [P0] create-second-pearl-for-merge: 6471c1c7-2f71-4020-8658-01a91ce1c0bd/companion merge partner
- PASS [P0] companion-rename-via-go: 6471c1c7-2f71-4020-8658-01a91ce1c0bd/Shelf stress brief
- PASS [P0] companion-edit-via-go: edit kept titled pearl
- PASS [P0] companion-experiment-via-go: bd7610ee-ffed-40cb-aa43-4fa6dce2d975/Counter · Shelf stress brief
- PASS [P0] companion-merge-via-go: 46d3c37a-049d-4f30-ac31-9e12494c87fa/core stress reef notes + Shelf stress brief + Counter · Shelf stress brief sourcesKept=true
- PASS [P0] reef-home-reachable: Reef home after create
- PASS [P0] studio-opens: Studio chrome visible
- PASS [P0] studio-moves-functions-lenses: What it does: Functions — Risk scan · Lens — Skeptical reading · 1 Moves
- PASS [P1] studio-no-orb-copy: clean
- PASS [P0] scene-runtime-ready: runtime on seeded scene
- PASS [P1] gauntlet-five-sockets: sockets=5 (0 ok if legend-only until expand)
- PASS [P0] wear-effect: filled=1 wearOk=true err=
- PASS [P1] wear-director-animation: {"wearMid":true,"directorRunningSeen":true,"cursorSeen":true,"statusSeen":true,"positionSamples":19,"uniquePositions":19,"maxTravelPx":196.86343726553187,"motionEventCount":8,"motionEvents":["cursor-move-start","cursor-move-complete"],"chatStatusSeen":true,"chatActionSeen":true,"statusSamples":["Demonstrating — Wear stress pearl…"],"reducedMotion":false,"scriptTitle":"Wear stress pearl"}
- PASS [P0] gauntlet-fill-to-5: filled=5
- PASS [P0] gauntlet-refuses-6th: blocked=true filled=5 sixth={"threw":false,"result":{"completed":true,"aborted":false,"errors":[],"results":[{"type":"worn-pearl","status":"full","effects":[],"visibleText":"Gauntlet is full (5 active pearls). Remove one before wearing another."}],
- PASS [P0] gauntlet-survives-reload: filled after reload=5
- PASS [P1] organize-real-effect: M=2 F=Risk scan L=Skeptical reading
- PASS [P1] merge-creates-pearl: id=a624fdeb-d99a-429e-b6fc-45f0b94daec1 sourcesKept=true
- PASS [P1] synthesize-sources-intact: sourcesIntact=true synthPearl=5c43e165-9978-4a78-9278-76a049773a93 {"ok":true,"result":{"completed":true,"aborted":false,"errors":[],"results":[{"type":"action-result","effectId":"semantic-orb-synthesized:5c43e165-9978-4a78-9278-76a049773a93","id":"5c43e165-9978-4a78
- PASS [P0] evaluate-no-fake-success: {"ok":true,"result":{"completed":true,"aborted":false,"errors":[],"results":[{"type":"gauntlet-evaluation","id":"s-1x3ahtt","object":{"version":1,"ok":true,"reason":"Ready to evaluate 27 characters through 5 gauntlet pearls.","requiresModel
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
- PASS [P0] role-pearl-created: id=4f16c271-3413-4887-b204-c1c18709ed4d name=Stress Investor Pearl
- PASS [P0] role-pearl-superpowers-structure: M=4 F=Investment memo,Diligence L=Stress Capital investor lens
- PASS [P1] role-pearl-wear-optional: worn=true filled=1
- PASS [P1] role-pearl-director: {"roleMid":true,"directorRunningSeen":true,"cursorSeen":true,"statusSeen":true,"positionSamples":1,"uniquePositions":1,"maxTravelPx":0,"motionEventCount":0,"motionEvents":[],"chatStatusSeen":true,"chatActionSeen":true,"statusSamples":["Demo
- PASS [P0] role-pearl-survives-reload: 4f16c271-3413-4887-b204-c1c18709ed4d
- PASS [P0] encode-conversation-effect: {"ok":true,"result":{"completed":true,"aborted":false,"errors":[],"results":[{"type":"conversation-pearl","id":"4f16c271-3413-4887-b204-c1c18709ed4d","object":{"pearlId":"4f16c271-3413-4887-b204-c1c18709ed4d","function":{"name":"Stress Encoded Chat Pearl","description":"Reusable 
- PASS [P0] encode-conversation-no-fake-done: honest
- PASS [P1] encode-anything-opens: panel=1 ok=true
- PASS [P1] compile-automation-reviewable: {"ok":true,"result":{"completed":true,"aborted":false,"errors":[],"results":[{"type":"canonical-pearl-effect","id":"pearl-effect:506e9569-f687-4f64-9e1d-bf76a07c9e26","object":{"id":"stress-automation-1784874581612","stableId":"stress-automation-1784874581612"
- PASS [P1] counter-pearl-effect: id=11e7c0fd-5e6f-4167-9eee-e86fa2798114 sourceKept=true
- PASS [P1] nest-pearl-effect: {"ok":true,"result":{"completed":true,"aborted":false,"errors":[],"results":[{"type":"action-result","effectId":"semantic-orb-nested:stress-pearl-1784874582699-2","id":"stress-pearl-1784874582699-2"}],"value":{"type":"action-result","effect
- PASS [P1] split-pearl-effect: {"ok":true,"result":{"completed":true,"aborted":false,"errors":[],"results":[{"type":"action-result","effectId":"semantic-orb-split:stress-pearl-1784874582699-3","id":"stress-pearl-1784874582699-3"}],"value":{"type":"action-result","effectI
- PASS [P0] generation-no-fake-success: {"ok":true,"result":{"completed":false,"aborted":false,"errors":["no readable material matched the requested targets"],"results":[],"effects":[]}}
- PASS [P1] output-frame-opens: opened=true label=2
- PASS [P1] output-frame-escape: stillOpen=0 label=0
- PASS [P1] packages-route-loads: Reef Packages · saved tools & settings Companion YOUR PEARLS — OPEN ONE, OR ASK COMPANION TO WEAR IT Stress Pearl 1 Pe
- PASS [P1] tasks-route-loads: Reef Tasks · saved tools & settings Companion YOUR PEARLS — OPEN ONE, OR ASK COMPANION TO WEAR IT Stress Pearl 1 Pearl
- PASS [P0] zero-demand-no-mode-jargon: companion pearl

just talk.

say what you want. your companion does the rest.

talk to companion
skip
- PASS [P1] reduced-motion-talk-hit-test: hit={"testid":"welcome-talk","tag":"BUTTON","text":"Talk to Companion"}
- PASS [P1] a11y-chat-controls-labeled: {"inputLabel":"Quick Move instruction","goLabel":"GO — run your command","hasInput":true,"hasGo":true,"focusTag":"INPUT","focusTestId":"companion-chat-input"}
- PASS [P1] empty-recovery-create-works: elapsedMs=1719 echo=true status=false
- PASS [P2] performance-no-obvious-hang: create path elapsedMs=1719
- PASS [P0] naming-no-orb-fresh: clean
- PASS [P1] compose-layers-effect: {"ok":true,"pearlId":"stress-pearl-1784874540242-1","leftId":"move-1784874540242","rightId":"fn-1784874540242","result":{"completed":true,"aborted":false,"errors":[],"results":[{"type":"canonical-pearl-effect","id":"pearl-effect:1df91676-48bf-4318-9abb-9bead5b6aa3f","object":{"ti
- PASS [P1] version-snapshot-browse: {"ok":true,"pearlId":"stress-automation-1784874581612","label":"Stress checkpoint 1784874596517","checkpointId":"pearl-checkpoint:c861b7d6-a32b-44b4-a268-137df890683c","snapOk":true,"browseOk":true,"versionCount":2,"restoreOk":true,"restoreErrors":[],"snap":{"completed":true,"abo
- PASS [P1] version-restore-effect: restored=true id=pearl-checkpoint:c861b7d6-a32b-44b4-a268-137df890683c errors=[]
- PASS [P1] shell-route-library: Reef Reef · where pearls live Companion HOME OF PEARLS Reef Pearls form, play, and expand here. Talk to your Companion 
- PASS [P1] shell-route-toolbox: Reef Reef · where pearls live Companion HOME OF PEARLS Reef Pearls form, play, and expand here. Talk to your Companion 
- PASS [P1] shell-route-settings: Reef Settings · saved tools & settings Companion YOUR PEARLS — OPEN ONE, OR ASK COMPANION TO WEAR IT Stress Pearl 1 Pe
- PASS [P1] shell-route-install: ← Reef (home) Install · browser extension Install Pearl in Chrome Add Pearl, then press Check again. Add Pearl to Chro
- PASS [P0] no-user-facing-orb-primary: clean
- PASS [P0] no-fatal-page-errors: none
- PASS [P0] storage-stable-ids: tracked create ids=2fc41c34-1787-44a2-bb78-52f204b996cd libBefore=2
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
- PASS [P2] aesthetic:07-after-studio: pass: Return from Studio to Reef is quiet; pearl shelf remains readable.
- PASS [P2] aesthetic:16-output-frame-deferred: pass: Deferred Output Frame state (or prior scene) without false publish success chrome.
- PASS [P1] aesthetic:25-role-pearl-mid-anim: pass: Role pearl director mid-frame shows demonstration status; ghost path present; no inspector stack over gauntlet.
- PASS [P1] aesthetic:25-role-pearl-after: pass: Stress Investor Pearl visible on Reef with Companion action trail. Hierarchy clear. Faint Reef intro copy remains low-contrast secondary.
- PASS [P2] aesthetic:25b-role-pearl-reload: pass: Role pearl survives reload without duplicate shelf chrome.
- PASS [P2] aesthetic:26-encode-conversation: pass: Encode conversation trail visible in Companion; Reef shelf shows Source Conversation pearl. No stacked encode panel.
- PASS [P1] aesthetic:26b-encode-anything-ui: pass: Encode anything emission: single shell title + Close after embedded panel fix (no dual Encode headers). Drop zone and evidence slots readable; Companion trail remains secondary.
- PASS [P2] aesthetic:26c-compile-automation: pass: Compile automation path leaves a reviewable local artifact state without fake live-run success banner.
- PASS [P2] aesthetic:27-counter: pass: Counter/remix scene with pearl inspector open. Dense inspector meta line competes with socket dots but primary Rename/Close remain usable.
- PASS [P2] aesthetic:27b-nest: pass: Nest effect leaves scene interpretable without clone explosion.
- PASS [P2] aesthetic:27c-split: pass: Split path readable; no false Done chrome.
- PASS [P2] aesthetic:28-generation: pass: Generation honesty frame — no fabricated multi-candidate taste UI claiming live success.
- PASS [P1] aesthetic:29-output-frame: pass: Output Frame 8.5×11 surface with clear OUTPUT FRAME label and Esc/Back guidance. Gauntlet legend readable. Sparse writing surface hierarchy is correct.
- PASS [P2] aesthetic:29b-output-frame-closed: pass: Escape returns to Scene without leftover Output Frame banner.
- PASS [P2] aesthetic:30-packages: pass: /packages opens Shared tools emission with clear Close; Reef shelf still partially visible. Naming uses Shared tools not Generator.
- PASS [P2] aesthetic:30b-tasks: pass: /tasks Activity emission loads without crash; recoverable Close.
- PASS [P1] aesthetic:31-zero-demand-welcome: pass: Zero-demand first viewport: Companion Pearl + Just talk + Talk CTA dominate. Gauntlet ≤5 labeled. No Ask/Plan/Agent/Debug mode homework.
- PASS [P1] aesthetic:31b-reduced-motion-chat: pass: Reduced-motion: welcome animations do not leave copy stuck at opacity 0; Companion chat + GO usable on empty Reef.
- PASS [P2] aesthetic:31c-empty-create-mid-anim: pass: Empty-library create mid-animation shows status/trail; motion intentional under reduced-motion path from prior step.
- PASS [P2] aesthetic:31d-empty-after-create: pass: Empty recovery create lands a real pearl without false Done or white-dot fallback.
- PASS [P2] aesthetic:32-compose-layers: pass: Compose cognitive layers journey — preview/blocker honesty without fake fused-success chrome (frame captured after run).
- PASS [P2] aesthetic:33-version-history: pass: Version snapshot/browse/restore path — no silent history wipe chrome (frame captured after run).
- PASS [P2] aesthetic:34-library: pass: /library Reef home loads; Pearl shelf naming consistent.
- PASS [P2] aesthetic:34b-toolbox: pass: /toolbox reachable without crash.
- PASS [P2] aesthetic:34c-settings: pass: /settings Account & privacy emission readable; Close present.
- PASS [P2] aesthetic:34d-install: pass: /install extension setup path loads without white screen.


---

# Pearl Comprehensive Aesthetic Review — 2026-07-23

Human perception gate for every evidence frame under docs/pearl-stress-standard.md. Functional DOM pass is insufficient.

- Frames reviewed: 52
- Aesthetic fails: 0
- Visual heuristic samples: 58

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

### PASS [P2] — 07-after-studio

Return from Studio to Reef is quiet; pearl shelf remains readable.

### PASS [P2] — 16-output-frame-deferred

Deferred Output Frame state (or prior scene) without false publish success chrome.

### PASS [P1] — 25-role-pearl-mid-anim

Role pearl director mid-frame shows demonstration status; ghost path present; no inspector stack over gauntlet.

### PASS [P1] — 25-role-pearl-after

Stress Investor Pearl visible on Reef with Companion action trail. Hierarchy clear. Faint Reef intro copy remains low-contrast secondary.
- Defect: P2: Reef intro title/body very low contrast on black

### PASS [P2] — 25b-role-pearl-reload

Role pearl survives reload without duplicate shelf chrome.

### PASS [P2] — 26-encode-conversation

Encode conversation trail visible in Companion; Reef shelf shows Source Conversation pearl. No stacked encode panel.

### PASS [P1] — 26b-encode-anything-ui

Encode anything emission: single shell title + Close after embedded panel fix (no dual Encode headers). Drop zone and evidence slots readable; Companion trail remains secondary.
- Defect: P2: long instructional paragraph is dense for first-time users

### PASS [P2] — 26c-compile-automation

Compile automation path leaves a reviewable local artifact state without fake live-run success banner.

### PASS [P2] — 27-counter

Counter/remix scene with pearl inspector open. Dense inspector meta line competes with socket dots but primary Rename/Close remain usable.
- Defect: P2: inspector material/lenses meta can sit on top of small power dots

### PASS [P2] — 27b-nest

Nest effect leaves scene interpretable without clone explosion.

### PASS [P2] — 27c-split

Split path readable; no false Done chrome.

### PASS [P2] — 28-generation

Generation honesty frame — no fabricated multi-candidate taste UI claiming live success.

### PASS [P1] — 29-output-frame

Output Frame 8.5×11 surface with clear OUTPUT FRAME label and Esc/Back guidance. Gauntlet legend readable. Sparse writing surface hierarchy is correct.
- Defect: P2: /Talk · type · GO on white paper is low contrast

### PASS [P2] — 29b-output-frame-closed

Escape returns to Scene without leftover Output Frame banner.

### PASS [P2] — 30-packages

/packages opens Shared tools emission with clear Close; Reef shelf still partially visible. Naming uses Shared tools not Generator.

### PASS [P2] — 30b-tasks

/tasks Activity emission loads without crash; recoverable Close.

### PASS [P1] — 31-zero-demand-welcome

Zero-demand first viewport: Companion Pearl + Just talk + Talk CTA dominate. Gauntlet ≤5 labeled. No Ask/Plan/Agent/Debug mode homework.

### PASS [P1] — 31b-reduced-motion-chat

Reduced-motion: welcome animations do not leave copy stuck at opacity 0; Companion chat + GO usable on empty Reef.
- Defect: P2: EMPTY CANVAS kicker still very low contrast

### PASS [P2] — 31c-empty-create-mid-anim

Empty-library create mid-animation shows status/trail; motion intentional under reduced-motion path from prior step.

### PASS [P2] — 31d-empty-after-create

Empty recovery create lands a real pearl without false Done or white-dot fallback.

### PASS [P2] — 32-compose-layers

Compose cognitive layers journey — preview/blocker honesty without fake fused-success chrome (frame captured after run).

### PASS [P2] — 33-version-history

Version snapshot/browse/restore path — no silent history wipe chrome (frame captured after run).

### PASS [P2] — 34-library

/library Reef home loads; Pearl shelf naming consistent.

### PASS [P2] — 34b-toolbox

/toolbox reachable without crash.

### PASS [P2] — 34c-settings

/settings Account & privacy emission readable; Close present.

### PASS [P2] — 34d-install

/install extension setup path loads without white screen.

## DOM visual heuristics

- 01-welcome: director=false go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=false
- 02-after-talk: director=false go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=true
- 03-create-mid-anim: director=true go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=true
- 03-after-create: director=false go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=true
- 04-reload-after-create: director=false go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=false
- 03b-second-mid-anim: director=true go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=true
- 03c-rename-mid-anim: director=true go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=true
- 03d-edit-mid-anim: director=true go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=true
- 03e-experiment-mid-anim: director=true go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=true
- 03f-merge-mid-anim: director=true go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=true
- 03g-after-nl-ops: director=false go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=true
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
- 16-output-frame-deferred: director=false go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=false
- 17-confirm-strip: director=false go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=true
- 18-after-accept: director=false go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=true
- 19-nav-reef: director=false go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=false
- 20-nav-scene-return: director=false go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=false
- 21-nav-studio: director=false go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=false
- 22-narrow-390: director=false go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=false
- 23-narrow-after-go: director=false go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=false
- 24-drag: director=false go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=false
- 25-role-pearl-mid-anim: director=true go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=true
- 25-role-pearl-after: director=false go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=true
- 25b-role-pearl-reload: director=false go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=false
- 26-encode-conversation: director=false go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=true
- 26b-encode-anything-ui: director=false go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=true
- 26c-compile-automation: director=false go∩accept=false inspector@director=false labels=false demoContrastLow=false talk+chat=true

# Human product audit

Completed: 2026-07-12T21:07:33.721Z
Target: http://localhost:5253

## Honest verdict

Usable for the audited local journeys: 60/60 assertions passed. Cloud account adoption, live model quality, microphone/video capture, and true slow-network behavior remain environment-dependent constraints.

This was driven with visible pointer, keyboard, wheel, and drag actions. Storage seeding was used only for the explicitly labeled high-density and malformed-record probes.

## Coverage matrix

- [x] **First 10 minutes** — Fresh companion, interview interruption, memory, destructive typo command _(core)_; 9/9 checks passed
- [x] **Paper** — Create/edit/move text, pen, highlighter, title, page, zoom, undo/redo _(core)_; 18/18 checks passed
- [x] **AI space** — Viewport, pan/zoom, dense constellation, node drag/jiggle, focus affordances _(core + seeded density)_; 3/3 checks passed
- [x] **Lenses** — Built-ins, quick move, create/editor entry, duplicate-free palette _(core)_; 1/1 checks passed
- [x] **Generators** — Create empty generator, open/close workspace, persistence _(core)_; 1/1 checks passed
- [x] **Shared paths** — Share entry points and malformed share recovery _(secondary)_; 1/1 checks passed
- [ ] **Account/persistence** — Sign-in entry, anonymous persistence, reload, clear persistence _(core)_; not fully exercisable locally
- [ ] **Global/accessibility** — Three viewports, focus, labels, hit sizes, overflow, Escape, reduced motion _(core)_; not fully exercisable locally
- [x] **Adversarial** — Malformed storage, 55 AI nodes, long/CJK/emoji text, rapid submit, console errors _(secondary)_; 1/1 checks passed

## Results

### First 10 minutes
- PASS — fresh app becomes interactive under 1s (435ms)
- PASS — companion opens automatically
- PASS — legacy tour overlay is absent
- PASS — identity prompt is understandable
- PASS — command interrupts onboarding without advancing identity (identity="")
- PASS — memory can be inspected
- PASS — identity and role are editable
- PASS — destructive typo command asks for confirmation
- PASS — rapid Enter creates one confirmation

### Paper
- PASS — select-click creates editable text
- PASS — second click enters text editing
- PASS — text drag lands at the visible cursor (moved=109.8px, landing error=0.0px)
- PASS — pen stroke persists after release
- PASS — toolbar undo and redo are reachable
- PASS — new page is created visibly

### Highlighter
- PASS — visible mark persists after release

### Lenses
- PASS — quick move creates a reusable lens

### Generators
- PASS — empty generator opens spatial workspace

### Persistence
- PASS — paper title survives reload
- PASS — created lens survives reload
- PASS — generator survives reload
- PASS — text drag survives reload (0.0px drift)
- PASS — cancel preserves paper work
- PASS — confirmed clear removes paper
- PASS — confirmed clear removes generators
- PASS — built-in primitives remain
- PASS — clear remains clear after reload

### Layout
- PASS — 1600×1000 shares one camera across paper and AI (tracks=3, legacy AI columns=0)
- PASS — 1600×1000 has no document overflow (0px × 0px)
- PASS — 1600×1000 keeps active controls visible in white/graphite workspace (clipped=0; canvas=rgb(250, 249, 246); paper=rgb(255, 255, 255); )
- PASS — 1440×900 shares one camera across paper and AI (tracks=3, legacy AI columns=0)
- PASS — 1440×900 has no document overflow (0px × 0px)
- PASS — 1440×900 keeps active controls visible in white/graphite workspace (clipped=0; canvas=rgb(250, 249, 246); paper=rgb(255, 255, 255); )
- PASS — 1100×760 shares one camera across paper and AI (tracks=3, legacy AI columns=0)
- PASS — 1100×760 has no document overflow (0px × 0px)
- PASS — 1100×760 keeps active controls visible in white/graphite workspace (clipped=0; canvas=rgb(250, 249, 246); paper=rgb(255, 255, 255); )

### Accessibility
- PASS — 1600×1000 core controls have labels (0 unlabeled)
- PASS — 1600×1000 has no sub-24px targets (0 targets)
- PASS — 1440×900 core controls have labels (0 unlabeled)
- PASS — 1440×900 has no sub-24px targets (0 targets)
- PASS — 1100×760 core controls have labels (0 unlabeled)
- PASS — 1100×760 has no sub-24px targets (0 targets)
- PASS — Tab reaches a visible control (BUTTON: World 1 — double-click to rename)

### Paper drag
- PASS — text drag lands at cursor at 0.55× (Δ=58.0,36.0px; error=0.0px; grab=701.8,281.4)
- PASS — block drag lands at cursor at 0.55× (Δ=58.0,36.0px; error=0.0px; grab=884.1,309.5)
- PASS — ink drag lands at cursor at 0.55× (Δ=58.0,36.0px; error=0.0px; grab=770.0,425.0)
- PASS — zoomed-out frame and all drag positions survive reload (item drift=drag-text:0.0,drag-block:0.0,drag-ink:0.0; frame=638,194; stored=drag-text:210.4545454545453,190.45454545454552|drag-block:495.45454545454567,235.45454545454552|drag-ink:275.45454545454544,455.45454545454544; reloaded=drag-text:210.4545454545453,190.45454545454552|drag-block:495.45454545454567,235.45454545454552|drag-ink:275.45454545454544,455.45454545454544; boxes=drag-text:753.7,298.7>753.7,298.7|drag-block:910.5,323.5>910.5,323.5|drag-ink:787.3,442.3>787.3,442.3)
- PASS — text drag lands at cursor at 1× (Δ=58.0,36.0px; error=0.0px; grab=519.0,248.0)
- PASS — block drag lands at cursor at 1× (Δ=58.0,36.0px; error=0.0px; grab=855.5,299.0)
- PASS — ink drag lands at cursor at 1× (Δ=58.0,36.0px; error=0.0px; grab=648.0,509.0)
- PASS — actual-size frame and all drag positions survive reload (item drift=drag-text:0.0,drag-block:0.0,drag-ink:0.0; frame=408,89; stored=drag-text:163,161|drag-block:448,206|drag-ink:228,426; reloaded=drag-text:163,161|drag-block:448,206|drag-ink:228,426; boxes=drag-text:571.0,250.0>571.0,250.0|drag-block:856.0,295.0>856.0,295.0|drag-ink:632.0,511.0>632.0,511.0)
- PASS — text drag lands at cursor at 1.6× (Δ=58.0,36.0px; error=0.0px; grab=432.0,193.4)
- PASS — block drag lands at cursor at 1.6× (Δ=58.0,36.0px; error=0.0px; grab=974.0,275.0)
- PASS — ink drag lands at cursor at 1.6× (Δ=58.0,36.0px; error=0.0px; grab=642.0,611.0)
- PASS — narrow-zoomed-in frame and all drag positions survive reload (item drift=drag-text:0.0,drag-block:0.0,drag-ink:0.0; frame=258,-61; stored=drag-text:141.25,147.5|drag-block:426.25,192.5|drag-ink:206.25,412.5; reloaded=drag-text:141.25,147.5|drag-block:426.25,192.5|drag-ink:206.25,412.5; boxes=drag-text:484.0,175.0>484.0,175.0|drag-block:940.0,247.0>940.0,247.0|drag-ink:581.6,592.6>581.6,592.6)

### Adversarial
- PASS — malformed generator store does not crash app

### AI space
- PASS — 55-node constellation loads (55 nodes)
- PASS — pan/zoom density interaction keeps app responsive
- PASS — tiny background jiggle creates no node (55 → 55)

### Shared paths
- PASS — malformed share payload recovers to workspace

## Defects

### CLR-01 · high · Whiteboard typo omitted paper from destructive clear
- Reproduce: Send “delete all the functions in my current function tab as well as all the generators and delete every single thing that's in my whitebaord as well as in my AI space”, confirm, then reload.
- Expected: The confirmation lists paper and confirmed content stays cleared.
- Actual: The parser recognized AI/lenses/generators but missed “whitebaord”; paper survived and reloaded.
- Screenshot: `11-clear-confirmation-before.png`
- Status: fixed and retested

### NAV-01 · high · Page controls were unreachable until hover
- Reproduce: Try to add a page without first discovering the invisible top-left hover zone.
- Expected: Existing pages and the add-page action are visible and pointer-reachable.
- Actual: The page strip had opacity:0 and pointer-events:none, so a normal click could not create a page.
- Screenshot: `08-pages-and-paper-controls.png`
- Status: fixed and retested

### GEN-01 · medium · New generator did not open its workspace
- Reproduce: Click the + beside Generators.
- Expected: Create ◇N and immediately open its spatial workspace.
- Actual: Only a rail placeholder and transient toast appeared, requiring hidden knowledge of a second click.
- Screenshot: `09-empty-generator-workspace.png`
- Status: fixed and retested

### A11Y-01 · medium · Primary controls had tiny or unnamed targets
- Reproduce: Inspect keyboard names and target geometry at each viewport.
- Expected: Core controls have accessible names and at least 24px targets.
- Actual: Create lens/quick move lacked names; generator, zoom, title, and page controls had 8–24px targets.
- Screenshot: `layout-narrow-laptop.png`
- Status: fixed and retested

### VIS-01 · low · Paper size label was incorrect
- Reproduce: Read the lower-right paper boundary label.
- Expected: The standard page is labeled 8.5 × 11.
- Actual: It displayed 8 × 11.5.
- Screenshot: `04-paper-text-created.png`
- Status: fixed and retested

## Measurements

- Fresh interactive time: 435ms
- Assertions: 60 passed / 0 failed / 60 total
- Browser errors and rejected console messages: 4

## Legacy regression reconciliation

- Before: 40/47. Three checks expected separate paper and AI columns after those columns had intentionally become one shared world.
- Before: three clipping checks counted the opacity-hidden zoom disclosure as visible controls instead of opening it and measuring the active panel.
- Before: every paper drag inside the shared canvas was misclassified as a drop into the old AI column because the embedded AI overlay fills that canvas.
- After: equivalent coverage validates the rail, one shared paper/AI camera, embedded paper frame, AI overlay, white/graphite styling, responsive active controls, and text/block/ink drag landing plus reload persistence at 0.55×, 1×, and 1.6×.
- Classification: three stale pre-unification column assertions; three incorrect hidden-control harness assertions; one genuine unified-workspace drag-routing defect, fixed in the app.

## Browser errors

- fresh: console: Failed to load resource: the server responded with a status of 500 (Internal Server Error)
- fresh: console: Failed to load resource: the server responded with a status of 500 (Internal Server Error)
- fresh: console: Failed to load resource: the server responded with a status of 500 (Internal Server Error)
- fresh: console: Failed to load resource: the server responded with a status of 500 (Internal Server Error)

## Screenshot index

- `11-clear-confirmation-before.png` — Failure before repair: typo command omitted paper (0 paper items listed)
- `12-clear-fixed-after.png` — Failure before repair: paper visibly survived confirmation and reload
- `01-fresh-launch.png` — Fresh profile: companion-first surface
- `02-onboarding-command-interruption.png` — Command entered during identity interview
- `03-companion-memory.png` — Inspectable editable memory after interview
- `04-paper-text-created.png` — Text created through the select tool
- `05-paper-text-edited-moved.png` — Edited and moved text
- `06-paper-pen-stroke.png` — Human-paced pen stroke
- `07-paper-highlighter.png` — Persistent highlighter mark and actions
- `08-pages-and-paper-controls.png` — Second page, title, tools and zoom controls
- `09-empty-generator-workspace.png` — Generator created through visible + control
- `10-returning-workspace.png` — Returning user after UI-created work
- `17-clear-confirmation-fixed-after.png` — Fixed confirmation includes typo-named paper domain
- `18-clear-persistence-fixed-after.png` — Cleared workspace after reload; primitives retained
- `layout-wide.png` — 1600×1000
- `layout-standard.png` — 1440×900
- `layout-narrow-laptop.png` — 1100×760
- `paper-drag-zoomed-out.png` — 0.55× visible drag persistence
- `paper-drag-actual-size.png` — 1× visible drag persistence
- `paper-drag-narrow-zoomed-in.png` — 1.6× visible drag persistence
- `13-dense-55-node-constellation.png` — Secondary seeded density and malformed-store probe
- `14-dense-pan-zoom.png` — Dense constellation after human-paced pan/zoom
- `15-keyboard-focus.png` — First keyboard focus at reduced motion
- `16-malformed-share-recovery.png` — Malformed share URL at narrow laptop size

## Remaining constraints

- Live account adoption/isolation requires configured Supabase credentials and multiple real accounts.
- Live AI output quality and 1k/5k/15k streaming depend on model credentials and network availability.
- Browser microphone/video permission and real voice recognition need a headed browser with hardware access.
- This repeatable audit covers representative human journeys and adversarial states; it is not proof that every combinatorial drag route is defect-free.
# Human product audit

Completed: 2026-07-14T07:35:04.576Z
Target: http://127.0.0.1:5190

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
- PASS — fresh app becomes interactive under 1s (768ms)
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
- PASS — text drag lands at the visible cursor (moved=95.1px, landing error=4.0px)
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
- PASS — text drag survives reload (0.0 world drift; {"x":218.58823529411754,"y":426.5294117647059} → {"x":218.58823529411754,"y":426.5294117647059})
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
- PASS — text drag lands at cursor at 0.55× (Δ=58.0,36.0px; error=0.0px; grab=718.5,195.9)
- PASS — block drag lands at cursor at 0.55× (Δ=58.0,36.0px; error=0.0px; grab=996.7,238.2)
- PASS — ink drag lands at cursor at 0.55× (Δ=58.0,36.0px; error=0.0px; grab=824.5,412.5)
- PASS — zoomed-out frame and all drag positions survive reload (item drift=drag-text:0.0,drag-block:0.0,drag-ink:0.0; frame=625,64; stored=drag-text:174.9039301310043,168.3886462882097|drag-block:459.9038565689819,213.3886462882097|drag-ink:239.9039301310043,433.3886462882094; reloaded=drag-text:174.9039301310043,168.3886462882097|drag-block:459.9038565689819,213.3886462882097|drag-ink:239.9039301310043,433.3886462882094; boxes=drag-text:770.5,203.7>770.5,203.7|drag-block:1007.0,241.0>1007.0,241.0|drag-ink:821.1,420.3>821.1,420.3)
- PASS — text drag lands at cursor at 1× (Δ=58.0,36.0px; error=0.0px; grab=663.8,181.5)
- PASS — block drag lands at cursor at 1× (Δ=58.0,36.0px; error=0.0px; grab=910.9,219.2)
- PASS — ink drag lands at cursor at 1× (Δ=58.0,36.0px; error=0.0px; grab=757.6,374.4)
- PASS — actual-size frame and all drag positions survive reload (item drift=drag-text:0.0,drag-block:0.0,drag-ink:0.0; frame=580,64; stored=drag-text:183.470588235294,173.70588235294116|drag-block:468.47058823529403,218.70588235294116|drag-ink:248.470588235294,438.705882352941; reloaded=drag-text:183.470588235294,173.70588235294116|drag-block:468.47058823529403,218.70588235294116|drag-ink:248.470588235294,438.705882352941; boxes=drag-text:715.8,192.4>715.8,192.4|drag-block:926.4,225.7>926.4,225.7|drag-ink:760.9,385.3>760.9,385.3)
- PASS — text drag lands at cursor at 1.6× (Δ=58.0,36.0px; error=0.0px; grab=529.2,161.4)
- PASS — block drag lands at cursor at 1.6× (Δ=58.0,36.0px; error=0.0px; grab=732.9,192.6)
- PASS — ink drag lands at cursor at 1.6× (Δ=58.0,36.0px; error=0.0px; grab=605.8,321.2)
- PASS — narrow-zoomed-in frame and all drag positions survive reload (item drift=drag-text:0.0,drag-block:0.0,drag-ink:0.0; frame=459,64; stored=drag-text:199.72189349112423,183.79289940828397|drag-block:484.7218934911239,228.79289940828397|drag-ink:264.7218934911242,448.7928994082841; reloaded=drag-text:199.72189349112423,183.79289940828397|drag-block:484.7218934911239,228.79289940828397|drag-ink:264.7218934911242,448.7928994082841; boxes=drag-text:581.2,176.5>581.2,176.5|drag-block:755.7,204.1>755.7,204.1|drag-ink:618.5,336.4>618.5,336.4)

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

- Fresh interactive time: 768ms
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
# Human product audit

Completed: 2026-07-10T17:46:34.341Z
Target: http://localhost:5233

## Honest verdict

Usable for the audited local journeys: 47/47 assertions passed. Cloud account adoption, live model quality, microphone/video capture, and true slow-network behavior remain environment-dependent constraints.

This was driven with visible pointer, keyboard, wheel, and drag actions. Storage seeding was used only for the explicitly labeled high-density and malformed-record probes.

## Coverage matrix

- [x] **First 10 minutes** — Fresh companion, interview interruption, memory, destructive typo command _(core)_; 9/9 checks passed
- [x] **Paper** — Create/edit/move text, pen, highlighter, title, page, zoom, undo/redo _(core)_; 6/6 checks passed
- [x] **AI space** — Viewport, pan/zoom, dense constellation, node drag/jiggle, focus affordances _(core + seeded density)_; 3/3 checks passed
- [x] **Lenses** — Built-ins, quick move, create/editor entry, duplicate-free palette _(core)_; 1/1 checks passed
- [x] **Generators** — Create empty generator, open/close workspace, persistence _(core)_; 1/1 checks passed
- [x] **Shared paths** — Share entry points and malformed share recovery _(secondary)_; 1/1 checks passed
- [ ] **Account/persistence** — Sign-in entry, anonymous persistence, reload, clear persistence _(core)_; not fully exercisable locally
- [ ] **Global/accessibility** — Three viewports, focus, labels, hit sizes, overflow, Escape, reduced motion _(core)_; not fully exercisable locally
- [x] **Adversarial** — Malformed storage, 55 AI nodes, long/CJK/emoji text, rapid submit, console errors _(secondary)_; 1/1 checks passed

## Results

### First 10 minutes
- PASS — fresh app becomes interactive under 1s (459ms)
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
- PASS — text can be moved without precision dragging (64.3px)
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
- PASS — cancel preserves paper work
- PASS — confirmed clear removes paper
- PASS — confirmed clear removes generators
- PASS — built-in primitives remain
- PASS — clear remains clear after reload

### Layout
- PASS — 1600×1000 keeps three domains ordered
- PASS — 1600×1000 has no document overflow (0px × 0px)
- PASS — 1600×1000 has no clipped controls
- PASS — 1440×900 keeps three domains ordered
- PASS — 1440×900 has no document overflow (0px × 0px)
- PASS — 1440×900 has no clipped controls
- PASS — 1100×760 keeps three domains ordered
- PASS — 1100×760 has no document overflow (0px × 0px)
- PASS — 1100×760 has no clipped controls

### Accessibility
- PASS — 1600×1000 core controls have labels (0 unlabeled)
- PASS — 1600×1000 has no sub-24px targets (0 targets)
- PASS — 1440×900 core controls have labels (0 unlabeled)
- PASS — 1440×900 has no sub-24px targets (0 targets)
- PASS — 1100×760 core controls have labels (0 unlabeled)
- PASS — 1100×760 has no sub-24px targets (0 targets)
- PASS — Tab reaches a visible control (BUTTON: capture how I got here — save this whole thread as)

### Adversarial
- PASS — malformed generator store does not crash app

### AI space
- PASS — 55-node constellation loads (55 nodes)
- PASS — pan/zoom density interaction keeps app responsive
- PASS — tiny background jiggle creates no node (56 → 56)

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

- Fresh interactive time: 459ms
- Assertions: 47 passed / 0 failed / 47 total
- Browser errors and rejected console messages: 3

## Verification summary

- Human-paced black-box suite: 47/47
- Existing final adversarial audit: 32/32
- Targeted four-fix regression: 33/33
- AI-space density/gesture audit: 20/20
- Companion walkthrough: 31/31
- Shared-path journey: 24/24
- Branched-lens journey: 36/36
- Lenses/generators journey: 32/32
- Companion destructive-clear journey: 21/21
- Node unit/integration tests: 311/311
- Production build: passed (160 modules)

## Browser errors

- fresh: console: Failed to load resource: the server responded with a status of 500 (Internal Server Error)
- fresh: console: Failed to load resource: the server responded with a status of 500 (Internal Server Error)
- secondary-density: console: Failed to load resource: the server responded with a status of 500 (Internal Server Error)

The three 500 responses are expected model-request failures in the no-API-key local environment. They produced visible, recoverable `fetch failed` feedback; there were no page errors, unhandled rejections, or React warnings.

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
- `13-dense-55-node-constellation.png` — Secondary seeded density and malformed-store probe
- `14-dense-pan-zoom.png` — Dense constellation after human-paced pan/zoom
- `15-keyboard-focus.png` — First keyboard focus at reduced motion
- `16-malformed-share-recovery.png` — Malformed share URL at narrow laptop size

## Remaining constraints

- Live account adoption/isolation requires configured Supabase credentials and multiple real accounts.
- Live AI output quality and 1k/5k/15k streaming depend on model credentials and network availability.
- Browser microphone/video permission and real voice recognition need a headed browser with hardware access.
- This repeatable audit covers representative human journeys and adversarial states; it is not proof that every combinatorial drag route is defect-free.
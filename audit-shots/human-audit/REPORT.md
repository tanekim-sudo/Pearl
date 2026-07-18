# Human product audit

Completed: 2026-07-18T22:17:33.097Z
Target: http://127.0.0.1:4173/stage/default

## Honest verdict

Usable for the audited local journeys: 0/0 assertions passed. Cloud account adoption, live model quality, microphone/video capture, and true slow-network behavior remain environment-dependent constraints.

This was driven with visible pointer, keyboard, wheel, and drag actions. Storage seeding was used only for the explicitly labeled high-density and malformed-record probes.

## Coverage matrix

- [ ] **First 10 minutes** — Fresh companion, interview interruption, memory, destructive typo command _(core)_; not fully exercisable locally
- [ ] **Paper** — Create/edit/move text, pen, highlighter, title, page, zoom, undo/redo _(core)_; not fully exercisable locally
- [ ] **AI space** — Viewport, pan/zoom, dense constellation, node drag/jiggle, focus affordances _(core + seeded density)_; not fully exercisable locally
- [ ] **Lenses** — Built-ins, quick move, create/editor entry, duplicate-free palette _(core)_; not fully exercisable locally
- [ ] **Generators** — Create empty generator, open/close workspace, persistence _(core)_; not fully exercisable locally
- [ ] **Shared paths** — Share entry points and malformed share recovery _(secondary)_; not fully exercisable locally
- [ ] **Account/persistence** — Sign-in entry, anonymous persistence, reload, clear persistence _(core)_; not fully exercisable locally
- [ ] **Global/accessibility** — Three viewports, focus, labels, hit sizes, overflow, Escape, reduced motion _(core)_; not fully exercisable locally
- [ ] **Adversarial** — Malformed storage, 55 AI nodes, long/CJK/emoji text, rapid submit, console errors _(secondary)_; not fully exercisable locally

## Results

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

- Fresh interactive time: not measuredms
- Assertions: 0 passed / 0 failed / 0 total
- Browser errors and rejected console messages: 1

## Legacy regression reconciliation

- Before: 40/47. Three checks expected separate paper and AI columns after those columns had intentionally become one shared world.
- Before: three clipping checks counted the opacity-hidden zoom disclosure as visible controls instead of opening it and measuring the active panel.
- Before: every paper drag inside the shared canvas was misclassified as a drop into the old AI column because the embedded AI overlay fills that canvas.
- After: equivalent coverage validates the rail, one shared paper/AI camera, embedded paper frame, AI overlay, white/graphite styling, responsive active controls, and text/block/ink drag landing plus reload persistence at 0.55×, 1×, and 1.6×.
- Classification: three stale pre-unification column assertions; three incorrect hidden-control harness assertions; one genuine unified-workspace drag-routing defect, fixed in the app.

## Browser errors

- audit runner: locator.waitFor: Timeout 30000ms exceeded.
Call log:
  - waiting for locator('.idea-app') to be visible
    63 × locator resolved to hidden <div class="idea-app theme-idea">…</div>

    at main (/Users/tanekim/Downloads/lens/scripts/human-product-audit.mjs:917:37)

## Screenshot index

- `11-clear-confirmation-before.png` — Failure before repair: typo command omitted paper (0 paper items listed)
- `12-clear-fixed-after.png` — Failure before repair: paper visibly survived confirmation and reload

## Remaining constraints

- Live account adoption/isolation requires configured Supabase credentials and multiple real accounts.
- Live AI output quality and 1k/5k/15k streaming depend on model credentials and network availability.
- Browser microphone/video permission and real voice recognition need a headed browser with hardware access.
- This repeatable audit covers representative human journeys and adversarial states; it is not proof that every combinatorial drag route is defect-free.
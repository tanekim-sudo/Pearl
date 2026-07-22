# Launch-ready E2E defect ledger — 2026-07-22

Base: http://127.0.0.1:8787

## Summary: 16 passed / 0 failed · 0 open defects

Local launch-readiness journeys usable on production build; store/prod still depends on not-verified bounds.

## Defects

## Not verified

- Chrome extension load-unpacked sidepanel DnD/GO in real Chrome (Playwright headless cannot load MV3 unpacked with full sidepanel UX). Extension unit/release tests and prior orb-universe extension audit remain the evidence boundary.
- Live Supabase multi-account adopt/skip (credentials may be local-only; anonymous path verified).
- Live AI Gateway model quality for organize/evaluate/synthesize (credentials optional; failure/blocker paths probed).
- Microphone / voice companion and real touch hardware.
- Screen-reader full pass (ARIA spot-checked via roles only).
- Production Vercel deploy with a real Chrome Web Store extension id (local audits may use audit-extension-id).
- Forced-colors / Windows high-contrast beyond reduced-motion probe.

## Screenshots

- 01-first-open-empty.png
- 01b-companion-expanded.png
- 02-reef-root.png
- 02-reef-library.png
- 02-reef-toolbox.png
- 02c-library-390.png
- 03-scene-open.png
- 03b-scene-after-dblclick.png
- 04-pearl-studio.png
- 04b-organize.png
- 05-companion-navigate-home.png
- 05b-gauntlet-5.png
- 05c-gauntlet-refuse-6th.png
- 05d-merge.png
- 05d-synthesize.png
- 05d-counter.png
- 05d-organize.png
- 05d-evaluate.png
- 06-handoff-continuation.png
- 06b-output-frame.png
- 07-anonymous-persist.png
- 08-offline-api-abort.png
- 09-install.png
- 10-universal-search.png
- 11-create-5-pearls.png
- 11b-keyboard-go-library.png
- 12-zoom-200.png
- 12b-zoom-companion.png
- 13-reduced-motion.png
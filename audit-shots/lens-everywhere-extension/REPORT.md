# Lens Everywhere extension implementation report

Date: July 13, 2026

## Architecture

- `shared/lens-runtime.js` is the platform-neutral material, provenance, pending-stack, execution, result, and insertion-plan runtime. The web app now delegates brush snapshots, material checks, and ordered stack composition to it.
- `extension/` is an isolated Vite package. Chrome uses an MV3 service worker, side panel, isolated-world content bridge, options page, session storage, optional site permissions, and a bundled IIFE content script.
- Browser APIs are isolated behind `BrowserPlatform`; domain modules do not depend on `chrome.*`. Builds emit Chrome, Firefox sidebar, and Safari WebExtension payloads.
- `server/extension-api.js` exposes authenticated library, execution, artifact, and generator operations without returning raw board snapshots.

## Plan completion

1. Shared runtime extracted and App refactored without changing the explicit-GO behavior.
2. Chrome MV3 package, worker, bridge, side panel, options, build, ZIP, and cross-browser manifest generation implemented.
3. Immutable `MaterialFragment` capture includes quote context, offsets, formatting, URL/title/origin/frame, timestamp, fingerprint, confidence, and persistent Shadow DOM overlays. Protected fields and sensitive origins are blocked.
4. Side panel implements searchable rack, ordered/reorderable stack, generator destination, exact disclosure, confirmation thresholds, explicit GO, cancellation, and preview-first result cards.
5. Narrow production-authenticated APIs, allowlisted CORS, lower limits, user-scoped rate/idempotency controls, audit metadata, short-lived artifacts, and Supabase RLS tables added. Local unconfigured development remains available.
6. Verified field/contenteditable insertion with conflict fingerprints and undo snapshots is implemented. Gmail targets the compose textbox, Notion is current-block plain text, Outlook Web is conservative plain text, and Google Docs explicitly falls back to Copy/Workspace add-on.
7. Eleven extension companion capabilities are in the canonical manifest with schema/domain/risk/purpose/observation/test/intent metadata. Runtime verbs execute through the same worker/adapters and use a visible director cursor path.
8. Lens cards emit plain text, sanitized HTML, URI, and structured closure payloads. `.lens.json`/drag-back imports preview duplicates and conflicts with keep/replace/skip choices. Generator exports exclude source by default and can be imported.
9. Strict message validation, sender checks, session-only credentials/material, no remote MV3 code/eval, bundled HTML sanitization, SSRF protocol/private-host checks, denylist, disabled incognito, deletion controls, privacy policy, permission justifications, Limited Use disclosure, and reviewer instructions are present.
10. Google Workspace add-on and Outlook Office Add-in scaffolds use supported public insertion APIs. Firefox and Safari build payloads are generated; vendor signing, Safari native container entitlements, and live account canaries remain external release operations and are not claimed as repository-verifiable.

## Verification

- Full Node suite: 384 passed, 0 failed.
- Extension unit/security suite: 8 passed, 0 failed.
- Lens grammar browser regression: 11 passed, 0 failed.
- Brush/explicit-GO browser regression: 15 passed, 0 failed.
- Persistent-context extension audit: 4 passed, 0 failed.
- Production app build: passed (171 modules).
- Chrome/Firefox/Safari extension build: passed.
- Chrome package validation: Manifest V3, bundled code only, no source maps/secrets.

Evidence:

- `01-persistent-page-highlight.png`
- `02-queued-explicit-go.png`
- `03-preview-before-insert.png`
- `04-verified-field-insertion.png`
- `audit-results.json`

## Platform limitations

Cross-origin frames, closed shadow roots, protected browser pages, and browser-denied origins cannot be captured. Notion cross-block replacement is refused. Gmail/Notion/Outlook live canaries require maintained vendor accounts. Google Docs private editor internals are never scraped. Firefox AMO signing and Safari Xcode conversion/signing require vendor credentials outside this repository.

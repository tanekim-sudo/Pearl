# Extension Triple-Space repro — 2026-07-28

## Verdict

Space×3 cursor toggle works after widening the recognizer window. Hold-to-talk and content_scripts cold-mount remain wired (orb-audit 25/25). Real mic residual OK.

## Exact failure (before fix)

| Case | Result |
|------|--------|
| Cold mount with host permission | PASS |
| Fast Space×3 (audit pace) | PASS |
| Human-paced Space×3 (~350ms gaps) | **FAIL** — first→third ≈700ms exceeded 650ms sliding window |
| Pearl host focused | PASS (shadow retarget) |
| Editable / page button | correctly excluded |

Root cause: `createTripleSpaceRecognizer({ intervalMs: 650 })` rejected normal human Space×3. Listener was bound; not a host-permission or mount orphan for the headed fixture.

## Fix

- `ORB_CURSOR_TRIPLE_SPACE_MS = 1100` in `shared/orb-cursor.js` (extension bridge + web shell).
- Also accept `event.code === "Space"`.
- Skip `pageOrb.destroy()` on bfcache `pagehide` (`event.persisted`) so back/forward does not orphan Companion.
- orb-audit gates human-paced Space×3; chrome binary prefers repo `.pw-browsers`.

## How to reload / test

1. Chrome → `chrome://extensions` → Load unpacked → `extension/dist/chrome` (or unzip `extension/release/lens-everywhere-chrome-v1.0.0.zip`).
2. Allow site access (action click or side panel “Allow Pearl on web pages”).
3. Open an http(s) page → Mother Pearl mid-right.
4. Click blank page (not a text field) → press Space three times at a normal pace → Pearl becomes the page cursor; Space×3 again restores native cursor.
5. Hold Pearl to speak (real mic may prompt OS permission).

## Evidence

- `audit-shots/extension-triple-space-repro-2026-07-28/` (before/after matrix)
- `audit-shots/orb-universe-2026-07/` orb-audit 25 checks

# Extension Companion restore — 2026-07-25

## Verdict

Page Companion mount, Triple-Space cursor toggle, and hold→Listening→intent handoff are restored on the unpacked MV3 build with host access. Real OS microphone permission UI remains residual (FakeSpeech proves wiring only).

## Root cause

1. **No `content_scripts` in manifest** — Mother Pearl only injected via on-demand `ensureBridge` / `executeScript`, so cold page loads showed no Companion.
2. **Optional host permissions never requested** — `BrowserPlatform.permissions.request` existed but was unused; without site access, inject/`tabs.url` fail for real users.
3. **Hold-to-talk was a visual stub** — set `listening` then reset on release; no `SpeechRecognition` / shared `createCompanionVoiceSession`.
4. **Page intent storage mismatch** — SW wrote `pendingPearlIntent` to **local**; sidepanel read **session**.

## Fixes

- Declare `content_scripts` for http(s) → `assets/content.js`.
- Request optional hosts on action click; sidepanel “Allow Pearl on web pages”; reinject on `permissions.onAdded` / `tabs.onUpdated`.
- Wire hold-to-talk through `createCompanionVoiceSession` → `open-side-panel` intent.
- Write `pendingPearlIntent` to session storage.
- Stress: `orb-audit` cold-mount + isolated-world FakeSpeech hold + Triple-Space.

## PNG Read

- `01-cold-load-no-click.png` (pre-fix shipped-like): no Pearl — confirms orphan inject.
- `06-cold-page-companion.png`: Mother Pearl visible mid-right after host+content_scripts (readable, not occluded).
- `06h-extension-hold-listening.png`: Pearl present during hold path; FakeSpeech + session intent handoff asserted in harness (phase text may settle after release).
- `06g-extension-orb-cursor.png`: after Space×3, Pearl tracks as cursor near the insertion target; native cursor hidden asserted in DOM.

## Residual

- Real Chrome mic / getUserMedia permission chrome not exercised in Playwright.
- Store-signed install path still residual.

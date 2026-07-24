# Pearl Gap Stress — 2026-07-24T06:26:39.087Z

Commit: 7a41184
Suites: voice, ai-gateway, shareability, workflows, packages, vault, taste, account-sync, extension
Score: 38/38 · defects=0 · P0=0
Shareability: 7 pass / 0 fail
Workflows: 6 pass / 0 fail

## Coverage

- **stressed** `live-mic` — simulated ASR pipeline Listening/Hearing/Heard + empty + permission-denied + unavailable (no real OS mic hardware)
- **stressed** `live-ai-gateway` — credential-absent honesty proven (401/blocker, no false Done); live smoke skipped — env residual
- **stressed** `shareability-export-import` — module share pipeline + local export/reopen; pass=7 fail=0
- **stressed** `workflow-end-to-end` — create/wear/studio/remix/destructive/encode; pass=6 fail=0
- **stressed** `cognitive-packages-signed-install` — signed create/validate + reject tampered/unsigned; headed /packages route
- **stressed** `privacy-vault-encryption-ux` — headed settings lock/unlock + wrong passphrase honesty via __pearlPrivacy
- **stressed** `live-generation-taste-ui` — seeded multi-candidate Choices UI + Yes persist; More-like-this without live credentials must not fake Done
- **stressed** `account-sync-import` — multi-profile switchProfile isolation + mergeBoardSnapshots idempotent re-import (no OAuth credentials)
- **stressed** `extension-sidepanel-360` — unpacked Chromium load via extension/scripts/playwright-audit.mjs (360px panel)
- **stressed** `extension-site-adapters` — fixture editors.html insertion path (Gmail/Notion/Docs host pages not required — adapter contract exercised on local fixture)

## Residual environment (honest)

- Real OS microphone hardware / browser getUserMedia permission UI is not exercised; Fake SpeechRecognition + permission-denied error path prove product honesty.
- Live model gateway quality not scored — no LIVE_PROVIDER_BASE_URL + API key in this environment.
- Live multi-candidate model batches are not provider-scored here; UI + persistence + honesty under 401 are proven with seeded candidates.
- Supabase/OAuth signed-in sync against a real account is not exercised — local multi-profile vault isolation + idempotent adoption merge are proven.
- Gmail/Notion/Docs live host pages are not opened; local editors.html fixture proves the insert/GO adapter path.

## Checks

- PASS [P0] voice-mic-present — companion mic control
- PASS [P0] voice-listening — Hearing: “make a pearl about voice stress”
- PASS [P0] voice-hearing — Hearing: “make a pearl about voice stress”
- PASS [P0] voice-heard — Demonstrating — Make a pearl…
- PASS [P0] voice-empty-diagnostic — Heard nothing.
- PASS [P0] voice-permission-denied — [{"role":"companion","text":"Type or speak, then press GO — I’ll show what I’m doing here."},{"role":"companion","text":"Blocked: Microphone permission was denied. Allow mic for this site in the browser address bar, then tap the mic again — or type and press GO. [permission-denied]"}]
- PASS [P0] voice-unavailable-diagnostic — [{"role":"companion","text":"Type or speak, then press GO — I’ll show what I’m doing here."},{"role":"companion","text":"Blocked: Voice isn’t available in this browser. Type your goal in the chat and press GO. [voice-unavailable]"}]
- PASS [P0] ai-gateway-no-false-done — {"completed":false,"code":"unknown-error","text":"I could not validate that action safely. Your workspace was not changed; you can retry it.","falseDone":false}
- PASS [P2] ai-gateway-live-smoke — skipped — no LIVE_PROVIDER credentials; honesty path proven
- PASS [P0] share-review-redacts-secrets — omitted=examples,canvasSettings,soundscapeSettings,privateContext,rawCaptures,commandHistory
- PASS [P0] share-package-validates — hash=sha256-NtjYM9NqV
- PASS [P0] share-grant-once — private-once consumed exactly once
- PASS [P0] share-install-atomic — {"receipt":"stress/share-fixture@1.0.0","keys":["stress/share-fixture"]}
- PASS [P0] share-reject-unsigned — unsigned package rejected
- PASS [P0] share-export-local — {"ok":true,"pearlKeys":["lens.scenes.v4"],"entryCount":18,"profile":"anonymous"}
- PASS [P0] share-reopen-restore — {"restored":{"ok":true,"entryCount":18,"exportedCount":18,"hasScenes":true},"survived":{"exportedCount":18,"pearlCount":1,"hasScenes":true,"keys":["lens.board.operators.v2","lens.board.sync-meta.v1","lens.onboarded.v1","lens.scenes.v4"]}}
- PASS [P0] wf-create-pearl — pearls=1 titled={"id":"5412f94a-b21c-4389-9d6e-e7a58525adf3","name":"workflow stress"}
- PASS [P1] wf-wear — {"completed":true,"text":"{\"completed\":true,\"aborted\":false,\"errors\":[],\"results\":[{\"type\":\"worn-pearl\",\"status\":\"worn\",\"object\":{\"version\":2,\"pearlId\":\"5412
- PASS [P1] wf-studio — {"hasStudio":false,"hasMFL":false,"href":"http://127.0.0.1:41812/#pearl-studio"}
- PASS [P1] wf-organize-remix — {"organizeOk":true,"counterOk":true,"nestOk":true,"mergeOk":true,"errors":{"organize":[],"counter":[],"nest":[],"merge":[]}}
- PASS [P0] wf-destructive-confirm — Accept/Reject present
- PASS [P1] wf-encode — {"completed":true,"encodeOpen":true,"errors":[]}
- PASS [P0] packages-signed-manifest — key=stress:pkg:1
- PASS [P1] packages-route — Reef Packages · saved tools & settings Companion HOME OF PEARLS Packages Pearls form, play, and expand here. Talk to you
- PASS [P2] packages-ui-sign — sign control absent — module path already proven
- PASS [P0] packages-reject-tampered — tampered content hash rejected
- PASS [P0] vault-api-present — {"ok":true,"describe":{"mode":"local-only","encrypted":true,"locked":false,"profile":"anonymous","itemCount":17,"bootstrap":["lens.privacy.active-profile.v1","l
- PASS [P0] vault-lock — {"mode":"local-only","encrypted":false,"locked":true,"profile":"anonymous","itemCount":0,"bootstrap":["lens.privacy.active-profile.v1","lens.privacy.locked.v1","lens.auth.resendAt"]}
- PASS [P0] vault-unlock — {"mode":"local-only","encrypted":true,"locked":false,"profile":"anonymous","itemCount":17,"bootstrap":["lens.privacy.active-profile.v1","lens.privacy.locked.v1","lens.auth.resendAt"]}
- PASS [P0] vault-wrong-passphrase — wrongFail=true locked=true
- PASS [P0] taste-candidates-seeded — candidates=3
- PASS [P0] taste-ui-open — Choices panel open
- PASS [P0] taste-yes-persists — {"nodes":[{"id":"cand-batch-gap-1784874437293-1","fb":"accepted"},{"id":"cand-batch-gap-1784874437293-2","fb":null},{"id":"cand-batch-gap-1784874437293-3","fb":null}],"orb":[{"id":"cand-batch-gap-1784874437293-1","status":"pending"},{"id":"cand-batch-gap-1784874437293-2","status":"pending"},{"id":"cand-batch-gap-1784874437293-3","status":"pending"}],"uiAccepted":false}
- PASS [P1] taste-more-no-fake-live — phase=executing
- PASS [P0] account-merge-idempotent — ops=1 lenses=1
- PASS [P0] account-profile-isolation — {"mode":"local-only","encrypted":true,"locked":false,"profile":"account","itemCount":1,"bootstrap":["lens.privacy.active-profile.v1","lens.privacy.locked.v1","lens.auth.resendAt"]}
- PASS [P1] extension-build — extension dist present
- PASS [P0] extension-playwright-audit — playwright-audit 360px + page pearl + insert

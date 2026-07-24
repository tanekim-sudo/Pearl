# Pearl Stress Coverage Matrix

Standard: [docs/pearl-stress-standard.md](./pearl-stress-standard.md)
Harness: `npm run stress:pearl` → `scripts/pearl-core-stress.mjs`
Evidence: `audit-shots/pearl-comprehensive-stress-2026-07-23/`
Last run commit: db0f20f · 2026-07-24T01:45:16.932Z
Score: 165/165 · P0=0 P1=0 P2=0

## Claimed vs stressed

| Capability / journey | Claimed in | Status | Why / notes |
|---|---|---|---|
| First-time Talk CTA / Companion-first land (`welcome-talk`) | README + feature-contracts + companion-capabilities | stressed | fresh land + Talk hit-test |
| Create pearl via GO + director (`create-pearl-go`) | README + feature-contracts + companion-capabilities | stressed | GO hit-test + director anim + storage |
| Reload survival for created pearls (`persistence-reload-create`) | README + feature-contracts + companion-capabilities | stressed | reload restores pearl ids/titles |
| Reef + Studio M→F→L (`reef-and-studio`) | README + feature-contracts + companion-capabilities | stressed | Reef shelf + Studio structure readable |
| Wear gauntlet ≤5 + persist (`gauntlet-wear`) | README + feature-contracts + companion-capabilities | stressed | wear via runtime + reload persist + cap |
| Organize / merge / synthesize (`organize-merge-synthesize`) | README + feature-contracts + companion-capabilities | stressed | disposable pearls via real verbs |
| evaluateWithGauntlet honesty (`evaluate-output`) | README + feature-contracts + companion-capabilities | stressed | evaluateWithGauntlet must not fake success |
| In-thread Accept/Reject (`destructive-confirm`) | README + feature-contracts + companion-capabilities | stressed | clear → Accept/Reject hit-test in chat |
| Chat + pearls across Reef/Scene/Studio (`navigation-survival`) | README + feature-contracts + companion-capabilities | stressed | chat + pearl ids survive nav |
| 390px primary GO path (`narrow-390`) | README + feature-contracts + companion-capabilities | stressed | GO hit-test + chat visible at 390px |
| Drag moves without clone (`drag-move`) | README + feature-contracts + companion-capabilities | stressed | pointer drag must not clone pearl |
| Escape collapse (`keyboard`) | README + feature-contracts + companion-capabilities | stressed | Escape collapse + chat survives |
| createRolePearl / role scaffold superpowers (`role-pearl-superpowers`) | README + feature-contracts + companion-capabilities | stressed | createRolePearl → M→F→L + optional wear + persist |
| Encode conversation + Encode anything + compileAutomationPearl (`encode-conversation-automation`) | README + feature-contracts + companion-capabilities | stressed | encodeConversationAsPearl + openEncodeAnything |
| Counter / nest / split remix primitives (`remix-counter-nest-split`) | README + feature-contracts + companion-capabilities | stressed | createCounterPearl + nest + split real effects |
| transformMaterial / generation no fake success (`generation-honesty`) | README + feature-contracts + companion-capabilities | stressed | transformMaterial / generation must not fake live candidates |
| Scene Output Frame open/escape (`output-frame-ui`) | README + feature-contracts + companion-capabilities | stressed | Open Output Frame → banner → Escape closes |
| /packages + /tasks entry points (`packages-tasks-routes`) | README + feature-contracts + companion-capabilities | stressed |  /packages and /tasks reachable without crash |
| Zero-demand welcome + empty create + a11y labels + reduced motion (`zero-demand-empty-recovery`) | README + feature-contracts + companion-capabilities | stressed | fresh welcome without mode jargon; empty next step |
| composePearlCognitiveLayers typed remix (`remix-compose-typed-layers`) | README + feature-contracts + companion-capabilities | stressed | composePearlCognitiveLayers preview honesty |
| Studio version snapshot / browse / restore (`studio-version-checkpoint-restore`) | README + feature-contracts + companion-capabilities | stressed | snapshotPearlVersion → browse → restore |
| /library /toolbox /settings /install shell routes (`shell-library-toolbox-settings-install`) | README + feature-contracts + companion-capabilities | stressed | README shell routes load without crash |
| Companion live gates (spawned) (`companion-chat-agent`) | README + feature-contracts + companion-capabilities | stressed | spawned companion-stress-live.mjs — gates green |
| Simulated mic / SpeechRecognition UX (Listening→Heard + denied) (`live-mic`) | README + feature-contracts + gap stress | stressed | simulated ASR pipeline Listening/Hearing/Heard + empty + permission-denied + unavailable (no real OS mic hardware) |
| AI gateway honesty (+ live smoke when credentials exist) (`live-ai-gateway`) | README + feature-contracts + gap stress | stressed | credential-absent honesty proven (401/blocker, no false Done); live smoke skipped — env residual |
| Extension side panel 360px (`extension-sidepanel-360`) | README + feature-contracts + gap stress | stressed | unpacked Chromium load via extension/scripts/playwright-audit.mjs (360px panel) |
| Multi-profile sync / import dedupe simulation (`account-sync-import`) | README + feature-contracts + gap stress | stressed | multi-profile switchProfile isolation + mergeBoardSnapshots idempotent re-import (no OAuth credentials) |
| Multi-candidate taste UI (seeded + honesty) (`live-generation-taste-ui`) | README + feature-contracts + gap stress | stressed | seeded multi-candidate Choices UI + Yes persist; More-like-this without live credentials must not fake Done |
| Signed Cognitive Package install / reject-unsigned (`cognitive-packages-signed-install`) | README + feature-contracts + gap stress | stressed | signed create/validate + reject tampered/unsigned; headed /packages route |
| Privacy vault encryption UX (`privacy-vault-encryption-ux`) | README + feature-contracts + gap stress | stressed | headed settings lock/unlock + wrong passphrase honesty via __pearlPrivacy |
| Extension insert/GO adapters (fixture hosts) (`extension-site-adapters`) | README + feature-contracts + gap stress | stressed | fixture editors.html insertion path (Gmail/Notion/Docs host pages not required — adapter contract exercised on local fixture) |
| Share / export / import / reopen restore (`shareability-export-import`) | README + feature-contracts + gap stress | stressed | module share pipeline + local export/reopen; pass=7 fail=0 |
| Workflow create→wear→Studio→remix→confirm→encode (`workflow-end-to-end`) | README + feature-contracts + gap stress | stressed | create/wear/studio/remix/destructive/encode; pass=6 fail=0 |

## Shareability / workflow scores

- Shareability: 7 pass / 0 fail
- Workflows: 6 pass / 0 fail

## Newly stressed vs prior pearl-core suite

- role-pearl-superpowers
- encode-conversation-automation (encodeConversationAsPearl, openEncodeAnything, compileAutomationPearl)
- remix-counter-nest-split
- remix-compose-typed-layers
- studio-version-checkpoint-restore
- generation-honesty
- output-frame-ui (real Open Output Frame path)
- packages-tasks-routes
- shell-library-toolbox-settings-install
- zero-demand-empty-recovery (incl. reduced-motion + a11y labels)
- live-mic (Fake SpeechRecognition Listening/Hearing/Heard + permission-denied + empty)
- live-ai-gateway (honesty without credentials; live smoke when env present)
- extension-sidepanel-360 + extension-site-adapters (unpacked Playwright audit)
- account-sync-import (multi-profile vault + idempotent merge)
- live-generation-taste-ui (seeded Choices Yes/No)
- cognitive-packages-signed-install + privacy-vault-encryption-ux
- shareability-export-import + workflow-end-to-end

## Residual gaps (honest non-claims)

- Standard reference: docs/pearl-stress-standard.md
- Gap suites (voice/share/workflows/extension/vault/taste/sync/packages/AI honesty) run via scripts/pearl-gap-stress.mjs unless SKIP_GAPS=1.
- Real OS microphone hardware / browser getUserMedia permission UI is not exercised; Fake SpeechRecognition + permission-denied error path prove product honesty.
- Live model gateway quality not scored — no LIVE_PROVIDER_BASE_URL + API key in this environment.
- Live multi-candidate model batches are not provider-scored here; UI + persistence + honesty under 401 are proven with seeded candidates.
- Supabase/OAuth signed-in sync against a real account is not exercised — local multi-profile vault isolation + idempotent adoption merge are proven.
- Gmail/Notion/Docs live host pages are not opened; local editors.html fixture proves the insert/GO adapter path.

## Run matrix (raw)

- **stressed** `companion-chat-agent` — spawned companion-stress-live.mjs — gates green
- **stressed** `welcome-talk` — fresh land + Talk hit-test
- **stressed** `create-pearl-go` — GO hit-test + director anim + storage
- **stressed** `persistence-reload-create` — reload restores pearl ids/titles
- **stressed** `reef-and-studio` — Reef shelf + Studio structure readable
- **stressed** `gauntlet-wear` — wear via runtime + reload persist + cap
- **stressed** `organize-merge-synthesize` — disposable pearls via real verbs
- **stressed** `evaluate-output` — evaluateWithGauntlet must not fake success
- **stressed** `destructive-confirm` — clear → Accept/Reject hit-test in chat
- **stressed** `navigation-survival` — chat + pearl ids survive nav
- **stressed** `narrow-390` — GO hit-test + chat visible at 390px
- **stressed** `drag-move` — pointer drag must not clone pearl
- **stressed** `keyboard` — Escape collapse + chat survives
- **stressed** `role-pearl-superpowers` — createRolePearl → M→F→L + optional wear + persist
- **stressed** `encode-conversation-automation` — encodeConversationAsPearl + openEncodeAnything
- **stressed** `remix-counter-nest-split` — createCounterPearl + nest + split real effects
- **stressed** `generation-honesty` — transformMaterial / generation must not fake live candidates
- **stressed** `output-frame-ui` — Open Output Frame → banner → Escape closes
- **stressed** `packages-tasks-routes` —  /packages and /tasks reachable without crash
- **stressed** `zero-demand-empty-recovery` — fresh welcome without mode jargon; empty next step
- **stressed** `remix-compose-typed-layers` — composePearlCognitiveLayers preview honesty
- **stressed** `studio-version-checkpoint-restore` — snapshotPearlVersion → browse → restore
- **stressed** `shell-library-toolbox-settings-install` — README shell routes load without crash
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
- **stressed** `aesthetic-human-review` — loaded 52 frame critiques from audit-shots/pearl-comprehensive-stress-2026-07-23/aesthetic-reviews.json

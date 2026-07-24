# Pearl Stress Coverage Matrix

Standard: [docs/pearl-stress-standard.md](./pearl-stress-standard.md)
Harness: `npm run stress:pearl` → `scripts/pearl-core-stress.mjs`
Evidence: `audit-shots/pearl-comprehensive-stress-2026-07-23/`
Last run commit: 92e3331 · 2026-07-24T01:25:23.618Z
Score: 126/126 · P0=0 P1=0 P2=0

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
| Real microphone (`live-mic`) | README / contracts (residual) | skipped | no real mic / OS permission in CI agent |
| Live model gateway judgments (`live-ai-gateway`) | README / contracts (residual) | skipped | credential-dependent; honesty gate only |
| Extension side panel 360px (`extension-sidepanel-360`) | README / contracts (residual) | skipped | requires unpacked extension load + separate harness |
| Authenticated sync / import dedupe (`account-sync-import`) | README / contracts (residual) | skipped | anonymous persistence only in this run |
| Live multi-candidate taste UI (`live-generation-taste-ui`) | README / contracts (residual) | skipped | provider credentials required for real multi-candidate batches |
| Signed Cognitive Package install (`cognitive-packages-signed-install`) | README / contracts (residual) | skipped | signed package + trust UX needs fixture package + separate flow |
| Privacy vault encryption UX (`privacy-vault-encryption-ux`) | README / contracts (residual) | skipped | vault UX not headed in this runner |
| Gmail/Notion/Docs insertion adapters (`extension-site-adapters`) | README / contracts (residual) | skipped | Gmail/Notion/Docs insertion needs real host pages |

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

## Residual gaps (honest non-claims)

- Real microphone / SpeechRecognition not exercised (fake Recognition only in companion gates).
- Live AI gateway / model credentials not required; evaluate + generation paths assert honest blocker or local materialization, not live judgment batches.
- Extension side panel (360px) / in-page Pearl / site adapters not loaded in this runner — use extension audits when dist + unpacked load available.
- Authenticated sync / account-adoption re-import dedupe not fully exercised (anonymous localStorage only).
- Page-context capture from a real external site not exercised; evaluate used in-app text fixture.
- Full multi-candidate live generation with taste accept/reject UI not verified without provider credentials.
- Cognitive Packages signed install, privacy vault encryption UX, and Cognitive Pull Request batch merge UI not headed-stressed in this suite.
- Standard reference: docs/pearl-stress-standard.md

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
- **skipped** `extension-sidepanel-360` — requires unpacked extension load + separate harness
- **skipped** `live-mic` — no real mic / OS permission in CI agent
- **skipped** `live-ai-gateway` — credential-dependent; honesty gate only
- **skipped** `account-sync-import` — anonymous persistence only in this run
- **skipped** `live-generation-taste-ui` — provider credentials required for real multi-candidate batches
- **skipped** `cognitive-packages-signed-install` — signed package + trust UX needs fixture package + separate flow
- **skipped** `privacy-vault-encryption-ux` — vault UX not headed in this runner
- **skipped** `extension-site-adapters` — Gmail/Notion/Docs insertion needs real host pages
- **stressed** `aesthetic-human-review` — loaded 52 frame critiques from audit-shots/pearl-comprehensive-stress-2026-07-23/aesthetic-reviews.json

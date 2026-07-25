# Pearl Stress Coverage Matrix

Standard: [docs/pearl-stress-standard.md](./pearl-stress-standard.md)
Showcase: [docs/pearl-showcase-flows.md](./pearl-showcase-flows.md)
Gap audit: [docs/pearl-stress-clueless-gap-audit.md](./pearl-stress-clueless-gap-audit.md)
Master harness: `npm run stress:clueless` → `scripts/pearl-clueless-stress.mjs`
Evidence: `audit-shots/pearl-clueless-stress-2026-07-24/`
Last clueless run: 9bf0639 · 2026-07-25T08:27:47.295Z
Clueless score: 64/64 · P0=0 P1=0 (skips not counted as passes)

## Showcase flows

| Stress id | Status | Why |
|---|---|---|
| `sf-narrow-390-create` | stressed | 390px cold Talk→GO→visible titled pearl |
| `sf-cold-talk` | stressed | Talk≤1 click opens input+GO |
| `sf-create-topic-pearl` | stressed | naive create → visible intent title |
| `sf-continuity-marathon` | stressed | create→rename→edit→wear→merge one session |
| `sf-rename-novice` | stressed | change the name to Series A notes |
| `sf-edit-add-notes` | stressed | edit it to add budget concerns |
| `sf-wear-gauntlet` | stressed | wear it via Talk→GO |
| `sf-merge-combine` | stressed | second pearl + combine these pearls |
| `sf-experiment-counter` | stressed | try something with this pearl |
| `sf-synthesize-notice` | stressed | what do these pearls notice |
| `sf-reload-findable` | stressed | reload keeps titled pearl findable |
| `sf-organize-studio` | stressed | organize + open studio |
| `sf-role-investor` | stressed | make me an investor pearl |
| `sf-click-studio-function-moves` | stressed | real hit-test click pearl → Studio function-as-moves |
| `sf-studio-reorder-moves` | stressed | drag reorder move sequence persists |
| `sf-companion-nl-reorder-moves` | stressed | Talk→GO natural language reorder Function moves |
| `sf-encode-open` | stressed | encode anything |
| `sf-version-loop` | stressed | snapshot → history → restore |
| `sf-evaluate-gauntlet` | stressed | evaluate honesty |
| `sf-output-frame` | stressed | open the output frame |
| `sf-split` | stressed | split this pearl |
| `sf-destructive-confirm` | stressed | clear with Accept/Reject |
| `sf-go-home` | stressed | go home |
| `sf-pearl-guide` | stressed | how does pearl work |
| `sf-pearl-powers` | stressed | show me pearl powers |
| `sf-shell-nav-primary` | stressed | visible primary shell nav |
| `sf-install-download` | stressed | install download CTA |
| `sf-shell-packages-settings` | stressed | open packages + settings |
| `sf-share-handoff` | residual | unsigned/live OAuth handoff needs credentials/extension |
| `sf-aesthetic-veto` | stressed | primary frames logged for human Read |
| `sf-extension-cold-mount` | stressed | unpacked MV3 + host access: content_scripts mounts Mother Pearl without privileged toggle (`extension/scripts/orb-audit.mjs`) |
| `sf-extension-hold-speak` | stressed | hold→Listening→FakeSpeech→session intent / Companion handoff; real OS mic residual |
| `sf-extension-space-triple` | stressed | Space×3 toggles Pearl cursor vs native; ignored in editable fields |

## Stressed: 32 · Residual/skipped: 1

## Residuals (honest)

- Comprehension Q (14d): Do I know what this pearl is? What can I do next? Can I see Functions as ordered Moves? — harness asserts structure present; agent must confirm via PNG Read.
- SF23 share/handoff: packages surface stressed; signed grant + second-session restore residual without live share credentials.
- Extension real Chrome microphone / getUserMedia permission UI: Fake SpeechRecognition proves hold-speak wiring in `orb-audit`; live mic remains residual.

## Anti-lie

- noRuntimeExecutePass: true
- intentBoundTitles: true
- worldVisibleArtifacts: true
- confusionBudget: true

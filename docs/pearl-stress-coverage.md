# Pearl Stress Coverage Matrix

Standard: [docs/pearl-stress-standard.md](./pearl-stress-standard.md)
Showcase: [docs/pearl-showcase-flows.md](./pearl-showcase-flows.md)
Gap audit: [docs/pearl-stress-clueless-gap-audit.md](./pearl-stress-clueless-gap-audit.md)
Master harness: `npm run stress:clueless` → `scripts/pearl-clueless-stress.mjs`
Evidence: `audit-shots/pearl-clueless-stress-2026-07-24/`
Last clueless run: 9a372ea · 2026-08-02T00:29:46.144Z
Clueless score: 41/44 · P0=1 P1=2 (skips not counted as passes)

## Showcase flows

| Stress id | Status | Why |
|---|---|---|
| `sf-narrow-390-create` | stressed | 390px cold Talk→GO→visible titled pearl |
| `sf-cold-talk` | stressed | Talk≤1 click opens input+GO |
| `sf-create-topic-pearl` | stressed | naive create → visible intent title |
| `sf-continuity-marathon` | stressed | create→rename→edit→wear→merge one session |
| `sf-system-prompt-create` | stressed | create seeds systemPrompt from intent |
| `sf-system-prompt-edit` | stressed | Companion edits system prompt |
| `sf-system-prompt-reload` | stressed | reload persists systemPrompt |
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

## Stressed: 19 · Residual/skipped: 0

## Residuals (honest)

- Comprehension Q (14d): Do I know what this pearl is? What can I do next? Can I see Functions as ordered Moves? — harness asserts structure present; agent must confirm via PNG Read.
- Journey interrupted: page.goto: Navigation to "http://127.0.0.1:41822/" is interrupted by another navigation to "http://127.0.0.1:41822/"
Call log:
  - navigating to "http://127.0.0.1:41822/", waiting until "domcontentloaded"


## Anti-lie

- noRuntimeExecutePass: true
- intentBoundTitles: true
- worldVisibleArtifacts: true
- confusionBudget: true

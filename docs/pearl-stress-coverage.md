# Pearl Stress Coverage Matrix

Standard: [docs/pearl-stress-standard.md](./pearl-stress-standard.md)  
Showcase: [docs/pearl-showcase-flows.md](./pearl-showcase-flows.md)  
Gap audit: [docs/pearl-stress-clueless-gap-audit.md](./pearl-stress-clueless-gap-audit.md)  
Visual defects (PNG Reads): [docs/pearl-clueless-visual-defects-2026-07-24.md](./pearl-clueless-visual-defects-2026-07-24.md)

Master harness: `npm run stress:clueless` → `scripts/pearl-clueless-stress.mjs`  
Visual smoke: `node scripts/pearl-visual-smoke.mjs`  
Evidence: `audit-shots/pearl-clueless-stress-2026-07-24/` (incl. `vfix-*`)

**Visual-first:** Functional green without PNG Read = harness lie. **Invisible = Fail. Bot-only reachable = Fail.**

## Visual smoke (after cleanliness fixes)

- Desktop shelf + reload: titled **Series A notes** card readable; no Reef-hero stack (PNG Read of `vfix-d-04`, `vfix-d-05`).
- After Talk: no competing Talk CTA (`vfix-d-02`).
- Narrow chat: GO high-contrast; gauntlet hide under dock tightened (`body:has(.companion-panel.shell-dock)`).

## Showcase flows (catalog SF01–SF25)

| Stress id | Status | Why |
|---|---|---|
| `sf-cold-talk` / `sf-narrow-390-create` | stressed | Talk≤1 click; 390 primary |
| `sf-create-topic-pearl` | stressed | Talk→GO → visible intent title |
| `sf-rename-novice` / `sf-edit-add-notes` / `sf-wear-gauntlet` | stressed | Novice NL + world-visible |
| `sf-merge-combine` / `sf-experiment-counter` | stressed | combine / try something |
| `sf-reload-findable` | stressed | Reload findable titled pearl |
| `sf-organize-studio` / `sf-role-investor` / `sf-encode-open` | stressed | Studio / investor / encode |
| `sf-version-loop` / `sf-evaluate-gauntlet` | partial | Version Ask-mode blocker; evaluate honesty residual |
| `sf-share-handoff` / live mic / OAuth / extension 360 | residual | Credentials / platform |

## Residuals (honest)

- Live mic OS UI, live model quality without keys, extension 360 / site adapters, real OAuth sync.
- Full `stress:clueless` marathon still needs a clean end-to-end pass after visual gate (prior run crashed mid-suite / evaluate fakeDone).
- P2: Companion header chip density; demo suggestion pills; empty Reef sparseness.

## Anti-lie

- Journey pass criteria exclude `__lensOrbRuntime.execute`
- Intent-bound titles (no generic `New pearl ·` for topic create)
- World-visible shelf cards
- Confusion budget ≤1
- Aesthetic requires human PNG Read

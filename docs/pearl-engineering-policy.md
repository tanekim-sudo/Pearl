# Pearl Engineering Policy

Permanent, non-negotiable rules for anyone editing or stress-testing Pearl (humans and agents).

## Companion rules (always apply)

| Rule | Path |
|---|---|
| No delete / no reinvent | `.cursor/rules/no-delete-no-reinvent.mdc` |
| No orphan capabilities | `.cursor/rules/no-orphan-capabilities.mdc` |
| No capability regressions | `.cursor/rules/no-capability-regressions.mdc` |
| Companion capability parity | `.cursor/rules/companion-capability-parity.mdc` |
| Cross-surface release parity | `.cursor/rules/cross-surface-release-parity.mdc` |
| Pearl product stress standard | `.cursor/rules/pearl-product-stress-standard.mdc` |
| Audit truth standard | `.cursor/rules/audit-truth-standard.mdc` |

## Stress harnesses (travel with the repo)

| Command | Script | Doc |
|---|---|---|
| `npm run stress:clueless` | `scripts/pearl-clueless-stress.mjs` | `docs/pearl-stress-standard.md` (master, hard-fail) |
| `npm run stress:pearl` | `scripts/pearl-core-stress.mjs` | same integrity rules |
| Coverage ledger | — | `docs/pearl-stress-coverage.md` |
| Showcase catalog | — | `docs/pearl-showcase-flows.md` |

Clueless / visual-first / harness-integrity gates apply to **any** stress or audit by anyone.

## LensTreeEditor orphan lesson

Forensics: `docs/pearl-function-moves-forensics.md`.

The original Function editor (`LensTreeEditor` + `reorderStep`) was never deleted — Studio boot orphaned App, then a reinvented Moves list demoted the original behind a secondary click. **Correct fix:** restore the original as the default wired path; share one algorithm via `shared/function-step-ops.js`; do not rebuild a parallel DnD UX.

## Inventory source of truth

Primary clueless-reachable screens: `client/lib/pearl-primary-screens.js`.

Feature contracts: `shared/feature-contracts.js`.  
Companion verbs: `client/lib/companion-capabilities.js`.  
Shell routing: `client/components/OrbUniverseShell.jsx` + `client/lib/shell-navigation.js`.  
Orphan ledger: `docs/pearl-orphan-audit.md` (rewire originals; never invent a third path).

## Anti-orphan checklist

- [ ] Capability still exists (not deleted)
- [ ] Original module searched/restored before reinventing
- [ ] Mounted in OrbUniverse / Companion shell (or honest platform residual)
- [ ] Visible nav **or** Companion Talk→GO + world-visible result
- [ ] Extension download CTA hit-testable when relevant
- [ ] Stress gate covers the path (or residual with cause)
- [ ] No production-ready claim without evidence

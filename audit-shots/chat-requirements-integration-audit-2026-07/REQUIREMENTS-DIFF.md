# Independently regenerated requirements diff

The prior forensic ledger contained 35 groups: 28 active, 3 superseded, and 4 external. The regenerated ledger rescanned the same parent transcript after the no-regression architecture request and contains 45 groups.

Changes:

- R-001–R-035 are retained; none were removed.
- R-022–R-028 moved from unresolved to implemented only after current source, test, and browser/runtime evidence was added.
- R-036–R-045 are new atomic requirements from the explicit architecture request: canonical version safety, command contracts, feature registry, module ownership, transactional persistence, deprecations, release CI, change rules, overwrite detection, and independent ledger regeneration.
- R-029–R-031 remain deliberately superseded by the Move → Function → Lens taxonomy.
- R-032–R-035 remain genuinely external. Local mocks/contracts are complete; provider credentials, multiple real accounts, physical microphone access, and store publication remain outside the repository.

Current count: 38 active implemented, 3 superseded, 4 external, 0 unresolved local.

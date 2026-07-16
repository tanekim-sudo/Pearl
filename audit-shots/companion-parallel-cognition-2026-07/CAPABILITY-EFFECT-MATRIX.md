# Capability effect matrix

Runtime audit: 2026-07-16. All registered handlers were invoked against seeded production UI state; each row below also has registry ownership, persistence, and focused tests.

| Feature contract | Web/director effect | Extension effect | Result |
|---|---:|---:|---|
| observation.workspace | yes | yes | pass |
| generation.taste-branching | yes | yes | pass |
| lens.perceptual-encoding | yes | yes | pass |
| composition.universal | yes | yes | pass |
| library.move | yes | yes | pass |
| library.function | yes | yes | pass |
| library.lens | yes | yes | pass |
| library.save-as | yes | yes | pass |
| library.primitive-moves | yes | yes | pass |
| ai.branch-chooser | yes | n/a | pass |
| execution.lens-context | yes | yes | pass |
| learning.before-after | yes | yes | pass |
| learning.transcript | yes | n/a | pass |
| highlight.explicit-go | yes | yes | pass |
| ai.node-gestures | yes | n/a | pass |
| persistence.account-adoption | yes | yes | pass |
| extension.distribution | yes | yes | pass |
| companion.destructive-clear | yes | n/a | pass |

Totals: **174/174** executable capabilities passed: **146 app** and **28 extension**. The exact screenshot sequence was additionally dispatched as one continuous natural-language conversation; see `fixed/conversation-results.json`.

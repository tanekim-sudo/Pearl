# README coverage audit

Maps every `shared/feature-contracts.js` ID to the README section that describes it in prose.  
Mechanical proof at last refresh: **59 active + 6 removed = 65/65 contract IDs** present in this table; each active ID has README prose anchors; all 9 primary screens + 17 Companion novice families + extension surface rows checked — **0 gaps**.

Companion verbs (411) and extension capabilities (123) are folded into family sections — not listed verb-by-verb.

**How to re-check:** inventory contracts + `pearl-primary-screens.js` + extension manifest; keyword/prose-diff against `README.md`; update this table when contracts change.

| Contract ID | Status | README section / note |
| --- | --- | --- |
| `observation.workspace` | active | Companion → Observe |
| `generation.taste-branching` | active | Encode… → Taste & generation |
| `lens.perceptual-encoding` | active | Core model (Lens) + Taste & generation (taste teach / evaluate) |
| `library.move` | active | Core model · Studio · Library emission “Actions” |
| `library.function` | active | Core model · Studio · Library emission “Processes” |
| `library.lens` | active | Core model · Studio · Library emission “Context” |
| `library.save-as` | active | Encode… → Save-as · Companion Save & learn |
| `library.primitive-moves` | active | Core model (Primitive Moves) · Studio |
| `learning.transcript` | active | Encode… → Learn from chat · Companion Save & learn |
| `learning.forming-pearls` | active | Encode… → Learn from chat / forming pearls |
| `companion.pearl-wear` | active | Vision · Wear / gauntlet · Pearl operations |
| `companion.mother-orbit` | active | Vision (Mother Pearl) · Companion |
| `companion.pearl-gauntlet` | active | Vision (Gauntlet ≤5) · Wear / gauntlet |
| `pearl.organize` | active | Companion Organize · Studio · Pearl operations |
| `pearl.role-scaffold` | active | Companion Organize & role · Pearl operations |
| `pearl.counter` | active | Companion Compose · Pearl operations |
| `pearl.gauntlet-evaluation` | active | Companion Evaluate |
| `persistence.account-adoption` | active | Settings / Account & privacy |
| `extension.distribution` | active | Surfaces Install · Extension Install artifact · Dev commands |
| `companion.destructive-clear` | active | Companion Honesty · Limitations (SF16 pattern) |
| `companion.effect-trace` | active | Companion Honesty & diagnostics (ghost-cursor effect status) |
| `interaction.semantic-transfer` | active | Pearl operations (semantic transfer / drop-intent) |
| `companion.transaction-harness` | active | Companion Honesty (cancellable plans / checkpoints) — harness internals omitted |
| `registry.cognitive-packages` | active | Packages · Surfaces Packages |
| `artifacts.higher-order` | active | Companion Deep Cognitive Workflow Studio |
| `companion.personal-vocabulary` | active | Deep Cognitive Workflow Studio · Library “Phrases” |
| `extraction.cognitive-pull-request` | active | Deep Cognitive Workflow Studio |
| `scene.v4` | active | Scene & Output Frame · Surfaces Scene |
| `companion.orb-runtime` | active | Companion (director / Mother Pearl runtime) |
| `scene.semantic-orbs` | active | Pearl operations · Core model |
| `interaction.orb-gesture` | active | Pearl operations (wear / drag-to-socket) |
| `companion.orb-swarm` | active | Companion Power FX |
| `shell.extension-first` | active | Extension · Install |
| `shell.pearl-progressive` | active | Vision (zero-demand / confusion budget) · Power-user search demoted |
| `privacy.local-profile-vault` | active | Settings / Account & privacy · Privacy by construction |
| `extension.pearl-page-canvas` | active | Extension → Page canvas |
| `privacy.bounded-page-observation` | active | Privacy by construction · Extension Capture |
| `semantic-pearl.soundscape` | active | Extension → Soundscape |
| `output.result-pearl` | active | Extension → Result pearls · Output routing |
| `runtime.unified-pearl` | active | Pearl operations → Unified Pearl entity |
| `runtime.pearl-action-animation` | active | Companion Honesty (director / ghost-cursor) · Demo |
| `runtime.pearl-power-fx` | active | Companion Power FX |
| `privacy.pearl-policy` | active | Encode… → Per-pearl privacy policy · Companion Privacy |
| `sharing.pearl-package` | active | Share · Packages |
| `automation.pearl-compiler` | active | Encode / automation · Encode anything |
| `companion.clarification-checkin` | active | Companion honesty · Encode clarification |
| `companion.execution-diagnostics` | active | Companion Honesty & diagnostics |
| `output.two-stage-routing` | active | Companion Output routing · Extension Result pearls |
| `studio.pearl` | active | Pearl Studio · Surfaces Studio |
| `shell.reef-home` | active | Surfaces Reef · Vision Reef |
| `pearl.version-history` | active | Companion Versions · Studio |
| `companion.critique-edits` | active | Companion Critique · Extension Side panel |
| `sharing.organization-trust` | active | Share (org trust envelopes) |
| `visual.physical-pearl` | active | Pearl operations · Extension Side panel |
| `visual.pearl-aesthetic` | active | Companion Appearance |
| `cognition.typed-layers` | active | Pearl Studio (typed cognitive layers) |
| `interface.pearl-guide` | active | Companion Demo / guide · How Pearl works |
| `shell.pearl-navigability` | active | Surfaces table · Companion Navigate |
| `encode.automation-anything` | active | Encode anything · Surfaces Encode |
| `composition.universal` | removed | Removed from Pearl shell |
| `ai.branch-chooser` | removed | Removed from Pearl shell |
| `execution.lens-context` | removed | Removed from Pearl shell |
| `learning.before-after` | removed | Removed from Pearl shell |
| `highlight.explicit-go` | removed | Removed from Pearl shell |
| `ai.node-gestures` | removed | Removed from Pearl shell |

## Correctly omitted from README marketing

| Item | Why |
| --- | --- |
| Full 411 Companion verb dump | Folded into families; graph gate owns parity |
| Classic App Stage rails / HighlightToolbar GO chrome | Removed; successor paths documented |
| Internal harness / ledger persistence keys | Not user-facing product copy |
| Bot-only `__lensOrbRuntime` journeys | Stress anti-pattern; not a product surface |
| Exhaustive `/api/*` SDK docs | Brief inventory only — not a public API promise |
| Generator object name | Migrated away; explicitly retired in Core model |

## Primary screens ↔ README

| Screen ID | README |
| --- | --- |
| `reef` / `library` / `toolbox` | Surfaces table |
| `scene` | Surfaces + Scene & Output Frame |
| `studio` | Surfaces + Pearl Studio |
| `install` | Surfaces + Extension |
| `settings` | Surfaces + Settings |
| `encode` | Surfaces + Encode |
| `packages` | Surfaces + Packages |

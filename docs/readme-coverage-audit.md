# README coverage audit

Maps every `shared/feature-contracts.js` ID to the README section that describes it in prose.  
Mechanical proof at last refresh (HEAD ~`3e71229` + README/docs sync): **59 active + 6 removed = 65/65 contract IDs** present in this table; each active ID has README prose anchors; all 9 primary screens + Companion novice families (incl. Prompt & layers / Weights / **Operate · compare**) + Cursor-for-pearls harness modules + extension surface rows checked — **0 gaps**.

Companion verbs (~418 capability rows; ~295 app + ~123 extension) are folded into family sections — not listed verb-by-verb. **Weights / prompt-harness / operate / cursor harness verbs** are mapped explicitly below.

**How to re-check:** inventory contracts + `pearl-primary-screens.js` + Cursor-for-pearls modules (`companion-pearl-job.js`, `pearl-app-snapshot.js`, `pearl-cursor-harness.js`, `pearl-operate-harness.js`, `pearl-prompt-harness.js`, `pearl-layer-templates.js`) + Weights/operate verbs in `companion-capabilities.js` + extension manifest; keyword/prose-diff against `README.md`; update this table when contracts change.

| Contract ID | Status | README section / note |
| --- | --- | --- |
| `observation.workspace` | active | Companion → Observe |
| `generation.taste-branching` | active | Encode… → Taste & generation |
| `lens.perceptual-encoding` | active | Core model (Lens) + Taste & generation (taste teach / evaluate) |
| `library.move` | active | Core model · Studio · Library emission “Actions” |
| `library.function` | active | Core model (Function storage = ordered Moves) · Studio · Library “Processes” |
| `library.lens` | active | Core model · Studio · Library emission “Context” |
| `library.save-as` | active | Encode… → Save-as · Companion Save & learn |
| `library.primitive-moves` | active | Core model (Primitive Moves) · Studio |
| `learning.transcript` | active | Encode… → Learn from chat · Companion Save & learn |
| `learning.forming-pearls` | active | Encode… → Learn from chat / forming pearls |
| `companion.pearl-wear` | active | Vision · Wear / gauntlet · Pearl operations · Extension wear/PhysicalPearl |
| `companion.mother-orbit` | active | Vision (Mother Pearl) · Companion |
| `companion.pearl-gauntlet` | active | Vision (Gauntlet ≤5) · Wear / gauntlet |
| `pearl.organize` | active | Companion Organize · Prompt & layers · Studio (Moves · Weights · Lenses) |
| `pearl.role-scaffold` | active | Companion Organize & role · Pearl operations |
| `pearl.counter` | active | Companion Compose · Pearl operations |
| `pearl.gauntlet-evaluation` | active | Companion Evaluate |
| `persistence.account-adoption` | active | Settings / Account & privacy · Sign-in gate honesty |
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
| `scene.semantic-orbs` | active | Pearl operations · Core model · Vision (create parsers / style-taste) |
| `interaction.orb-gesture` | active | Pearl operations (wear / drag-to-socket) · Extension hold-speak / Space×3 |
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
| `companion.execution-diagnostics` | active | Companion Honesty & diagnostics (`needs-credentials` called out) |
| `output.two-stage-routing` | active | Companion Output routing · Extension Result pearls |
| `studio.pearl` | active | Pearl Studio · Surfaces Studio · Vision (Moves · Weights · Lenses) · Cursor-for-pearls / Operate · compare (owner: `pearl-cursor-harness.js`) |
| `shell.reef-home` | active | Surfaces Reef · Vision Reef |
| `pearl.version-history` | active | Companion Versions · Studio |
| `companion.critique-edits` | active | Companion Critique · Extension Side panel |
| `sharing.organization-trust` | active | Share (org trust envelopes) |
| `visual.physical-pearl` | active | Pearl operations · Extension Side panel / wear · PhysicalPearl |
| `visual.pearl-aesthetic` | active | Companion Appearance |
| `cognition.typed-layers` | active | Pearl Studio (typed cognitive layers) · Core model Weights |
| `interface.pearl-guide` | active | Companion Demo / guide · How Pearl works |
| `shell.pearl-navigability` | active | Surfaces table · Companion Navigate |
| `encode.automation-anything` | active | Encode anything · Surfaces Encode |
| `composition.universal` | removed | Removed from Pearl shell |
| `ai.branch-chooser` | removed | Removed from Pearl shell |
| `execution.lens-context` | removed | Removed from Pearl shell |
| `learning.before-after` | removed | Removed from Pearl shell |
| `highlight.explicit-go` | removed | Removed from Pearl shell |
| `ai.node-gestures` | removed | Removed from Pearl shell |

## Weights + prompt / operate / cursor harness verbs ↔ README

No separate feature-contract IDs yet for Weights or Cursor-for-pearls; they ship under `studio.pearl` / organize / semantic-orb surfaces. Map companion verbs → README prose:

| Verb | README section / note |
| --- | --- |
| `interpretPearlPrompt` | Vision Cursor-for-pearls · Companion mutate harness (Observe→Interpret→Propose→Apply→Reveal) · Prompt & layers |
| `editPearlSystemPrompt` | Vision (systemPrompt projection; never operate-append) · Companion Prompt & layers · offline vs AI rewrite |
| `setPearlSystemPrompt` | Companion Prompt & layers · Core model System prompt |
| `getPearlSystemPrompt` | Companion Prompt & layers |
| `getPearlWeights` | Core model Weight · Companion Prompt & layers · Studio Weights |
| `setPearlWeights` | Core model Weight · Companion Prompt & layers |
| `editPearlWeights` | Core model Weight · Companion Prompt & layers (care/prefer/weight-over) |
| `comparePearls` | Vision operate class · Companion Operate / compare · never mutates systemPrompt |
| `operatePearl` | Vision operate class · Companion Operate / compare (summarize / ask-about / handoff) |
| `createSemanticOrb` | Vision create parsers / style-taste · Companion Create & cultivate · layer templates |
| `organizePearl` | Companion Organize & role · Pearl operations (Moves · Weights · Lenses) |
| `reorderPearlFunctionMoves` / `decomposePearlFunctionMove` | Studio ops · Function storage presented as Moves |
| `inspectPearlMetadata` | Vision (full context internal; metadata hidden from users) |

## Correctly omitted from README marketing

| Item | Why |
| --- | --- |
| Full ~418 Companion verb dump | Folded into families; graph gate owns parity |
| Classic App Stage rails / HighlightToolbar GO chrome | Removed; successor paths documented |
| Internal harness / ledger persistence keys | Not user-facing product copy |
| Bot-only `__lensOrbRuntime` journeys | Stress anti-pattern; not a product surface |
| Exhaustive `/api/*` SDK docs | Brief inventory only — not a public API promise |
| Generator object name | Migrated away; explicitly retired in Core model |
| “Functions” as middle brain layer | Superseded by Weights; Function remains ordered-Moves storage only |
| SOTA / production-ready claims | Inventory + honesty only — never claimed |

## Primary screens ↔ README

| Screen ID | README |
| --- | --- |
| `reef` / `library` / `toolbox` | Surfaces table (Toolbox = Moves / Weights / Lenses framing) |
| `scene` | Surfaces + Scene & Output Frame |
| `studio` | Surfaces + Pearl Studio (Moves → Weights → Lenses) |
| `install` | Surfaces + Extension |
| `settings` | Surfaces + Settings / Account & privacy (`needs-credentials`) |
| `encode` | Surfaces + Encode |
| `packages` | Surfaces + Packages |

## Pearl brain / Cursor-for-pearls modules ↔ README

| Module | README |
| --- | --- |
| `shared/companion-pearl-job.js` | Vision Cursor-for-pearls job pack · Where to look |
| `shared/pearl-app-snapshot.js` | Vision per-turn app snapshot · Where to look (re-export) |
| `shared/pearl-cursor-harness.js` | Vision turn loop Observe→Classify→Propose→Apply→Reveal · Companion Cursor-for-pearls harness · Where to look |
| `shared/pearl-operate-harness.js` | Vision operate vs mutate · Companion Operate / compare · Where to look |
| `shared/pearl-prompt-harness.js` | Companion mutate harness · offline / AI rewrite · Where to look |
| `shared/pearl-layer-templates.js` | Vision style-taste / Buffett offline creates · Where to look |
| `shared/pearl-compare.js` | Operate compare/PDF helpers · Where to look |
| `shared/pearl-layer-instructions.js` | Vision Pearl brain · Core model · Where to look |
| `shared/pearl-weights.js` | Core model Weight · Companion Prompt & layers |
| `shared/pearl-system-prompt.js` | Vision systemPrompt projection · Core model |
| `shared/pearl-companion-context.js` | Vision full context internal / metadata hidden |
| `client/lib/companion-intent.js` | Vision create parsers / style-taste |
| `client/lib/account-setup.js` + `server/api-guard.js` | Sign-in gate honesty · Account & privacy |

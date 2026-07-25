# Pearl orphan audit — 2026-07-25

Inventory of user-facing capabilities vs current Pearl shell (OrbUniverse / Companion / extension).  
Policy: rewire originals; never delete; never reinvent a third path.

**HEAD baseline for this pass:** ~`2f89412` plus this rewire commit.

## Method

1. `shared/feature-contracts.js` (65 features) × `client/lib/companion-capabilities.js` × `pearl-primary-screens.js`
2. Mounts: `OrbUniverseShell`, hidden `orb-runtime-host` App, Scene `pearlShell` App, extension sidepanel / content
3. Git forensics: LensTreeEditor lesson; gauntlet shelf DnD (`de9e5fd`); dead-UI era (`f0b1dda`)

## Status legend

| Status | Meaning |
|---|---|
| **wired** | Visible nav and/or Companion Talk→GO + world-visible effect on current shell |
| **rewired** | Was orphaned; restored in this pass by remounting the original |
| **orphaned** | Exists in codebase but not clueless-reachable on current shell |
| **residual** | Platform/env limit (credentials, OS mic, Playwright HTML5 DnD, etc.) |
| **deleted?** | Not found as deleted — usually orphaned/unmounted (do not delete) |

---

## Critical rewires (this pass)

| Item | Was | Evidence | Action |
|---|---|---|---|
| Extension shelf pearls as **blocks** | orphaned aesthetic | `sidepanel.css` list-row tray; tiny `i` dots | **rewired** → capsule shelf + `physicalPearlMarkup`; idle dock when pearls exist |
| Extension pearl → gauntlet DnD | handlers present, shelf hidden on idle | `main.jsx` DnD + `.orb-panel{display:none}` on idle | **rewired** → idle shelf dock + Wear button (pointer fallback) + socket/Mother drop (original `wearPearlIdInGauntlet`) |
| Web Reef pearls as **blocks** | orphaned aesthetic | `.reef-pearl` cards + 10px dots; not draggable | **rewired** → `PhysicalPearl` capsules + HTML5 `application/x-lens-pearl` + Wear control |
| CompanionOrb drop wear | orphaned | `drop()` only added context; ignored pearl MIME | **rewired** → socket/Mother drop → `wearPearl` via `__lensOrbRuntime.execute` / shared gauntlet |
| LearnFromChat / Save-as / CognitiveWorkflowStudio / App package registry on Reef | orphaned | rendered inside 2px `.orb-runtime-host` (`pointer-events:none`) | **rewired** → `shellVisible()` `createPortal` to `document.body` (same pattern as CompanionChat) |
| Cognitive workflow open verb | orphaned | clicked `.page-title-cognitive-studio` (classic chrome) | **rewired** → open studio state directly |

---

## Feature-contract ledger (condensed)

### Wired / already OK

| ID | Surface | Notes |
|---|---|---|
| `shell.reef-home` | Reef | Primary home |
| `shell.pearl-navigability` | nav + settings | Install / Settings / Encode / Packages |
| `companion.orb-runtime` | CompanionOrb | Talk→GO |
| `companion.pearl-wear` / `companion.pearl-gauntlet` / `companion.mother-orbit` | web + extension | Wear paths restored above |
| `studio.pearl` | PearlStudio + LensTreeEditor | Default Function editor (prior rewire) |
| `encode.automation-anything` | Encode panel | Shell nav |
| `registry.cognitive-packages` | Shell packages + portaled App registry | |
| `interface.pearl-guide` | Guide panel + extension ? | |
| `extension.distribution` | Install CTA | |
| `scene.v4` / `scene.semantic-orbs` | Scene stage | When Scene open |
| `visual.physical-pearl` / `visual.pearl-aesthetic` | PhysicalPearl | Extension + Reef now use |
| `learning.transcript` | LearnFromChat | Portaled on Reef |
| `library.save-as` | Save-as chooser | Portaled on Reef |
| `artifacts.higher-order` / vocabulary / PR | CognitiveWorkflowStudio | Portaled on Reef |
| `extension.pearl-page-canvas` / hold-speak / Space×3 | content script | Prior restore `2f89412` |

### Residual / Scene-bound (honest)

| ID | Status | Why |
|---|---|---|
| `learning.before-after` | residual | Editor lives in App rails (`openCreateLens`); needs Scene/Output Frame chrome — not reinvented as a third modal |
| `execution.lens-context` / `highlight.explicit-go` | residual on Reef | `HighlightToolbar` mounts in App Stage; Scene/Output Frame |
| `ai.node-gestures` / `ai.branch-chooser` | residual on Reef | `AiNodeCanvas` in Scene workspace |
| `composition.universal` / `LensGrammarPanels` | residual on Reef | Classic rail composition |
| `library.move` / `library.primitive-moves` TopToolbar lists | residual | TopToolbar unmounted under `pearlShell`; Companion verbs + Studio still mutate |
| `sharing.pearl-package` / org trust | residual | Needs live credentials / signed grants |
| Extension HTML5 DnD in Playwright | residual | Use Wear button + storage asserts; real Chrome drag remains manual/headed |
| Live OS mic | residual | FakeSpeech in orb-audit only |

### Not deleted

Nothing in this audit was deleted. LensTreeEditor / gauntlet / LearnFromChat / shelf DnD handlers were **orphaned or demoted**, not removed.

---

## Reachability checklist (post-rewire)

- [x] Extension pearls look like pearls (capsule + PhysicalPearl SVG)
- [x] Extension drag MIME + Mother/socket drop (original shared gauntlet)
- [x] Extension Wear pointer path when drag awkward (360px)
- [x] Idle shelf dock so drag source is visible without hunting
- [x] Web Reef drag + Wear → same `wearPearl` verb
- [x] Reef modals portaled out of runtime host
- [ ] BeforeAfter / Highlight / AI canvas on Reef without Scene — residual (use Scene)
- [ ] Live share/OAuth — residual

---

## Evidence

- `audit-shots/extension-pearl-dnd-2026-07-25/`
- Stress: extension wear script + `release:check:fast`
- Coverage matrix: `docs/pearl-stress-coverage.md`

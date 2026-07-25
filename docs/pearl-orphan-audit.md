# Pearl orphan audit — 2026-07-25

Inventory of user-facing capabilities vs current Pearl shell (OrbUniverse / Companion / extension).  
Policy: rewire vision originals; **delete** off-vision classic App Stage surfaces (explicit user approval 2026-07-25).

**HEAD baseline:** ~`65ae6ec` plus this purity pass.

## Product vision (keep)

- Mother Pearl = Companion (chat, GO, voice, director)
- Reef pearl home — PhysicalPearl, drag/wear to gauntlet
- Gauntlet ≤5, auto-update
- Studio: LensTreeEditor / Functions as ordered Moves
- Extension: page Companion, hold-speak, Space×3, pearl wear
- Encode / role pearls / organize / merge / synthesize / output destinations
- Install/download, settings/privacy
- Vision-aligned shell modals already portaled (LearnFromChat, Save-as, CognitiveWorkflowStudio, packages)

## Method

1. `shared/feature-contracts.js` × companion-capabilities × `pearl-primary-screens.js`
2. Mounts: OrbUniverseShell, hidden `orb-runtime-host` App, Scene stage, extension
3. User correction: do **not** resurrect classic Stage rails into Scene

## Status legend

| Status | Meaning |
|---|---|
| **wired** | Visible nav and/or Companion Talk→GO + world-visible effect |
| **rewired** | Was orphaned; restored by remounting the original vision path |
| **deleted** | Off-vision; user-approved removal from Pearl shell entry points (`status: "removed"` in contracts) |
| **residual** | Platform/env limit (credentials, OS mic, Playwright DnD) |

---

## Deleted (off-vision) — user-approved 2026-07-25

| ID / surface | Why deleted | Successor |
|---|---|---|
| `learning.before-after` / BeforeAfter rails | Classic Scene clutter; not Pearl vision | `studio.pearl` (LensTreeEditor) |
| `execution.lens-context` / HighlightToolbar | Canvas highlight chrome off vision | `extension.pearl-page-canvas` (page GO) |
| `highlight.explicit-go` (web HighlightToolbar) | Same | extension pressExternalGo |
| `ai.node-gestures` / AiNodeCanvas | Classic AI canvas off vision | `studio.pearl` |
| `ai.branch-chooser` | Strand HUD on AiNodeCanvas | `studio.pearl` |
| `composition.universal` / LensGrammarPanels rails | Classic rail dump | Studio Functions + `composeCanonicalObjects` |
| TopToolbar library lists under `pearlShell` | Old App chrome | Studio + Companion verbs |
| Scene “Tools” / `tools-emitted` App rails | Would reintroduce deleted chrome | Spatial Scene only |

**Evidence of deletion from Pearl shell:** `!pearlShell &&` mounts in `App.jsx`; CSS hard-hides functions/ai columns in pearl hosts; Scene chrome has no Tools button; companion Before→after refuses on Pearl shell.

Component files may remain for classic/non-shell paths and unit tests — **no Pearl user-facing entry**.

---

## Rewired (vision) — keep

| Item | Evidence |
|---|---|
| Extension shelf as PhysicalPearl capsules + Wear + DnD MIME | `65ae6ec` |
| Web Reef PhysicalPearl + Wear → `wearPearl` | `65ae6ec` |
| CompanionOrb socket/Mother drop wear | `65ae6ec` |
| LearnFromChat / Save-as / CognitiveWorkflowStudio / packages portaled out of 2px host | `65ae6ec` |
| Scene in Reef primary nav + Companion `open scene` | spatial Scene only (no classic rails) |
| Studio LensTreeEditor default Function editor | prior `9bf0639` |
| Extension page Companion, hold-speak, Space×3 | `2f89412` |

---

## Residual (env / credentials)

| Item | Why |
|---|---|
| Live share / OAuth / signed grants | Needs live credentials |
| Extension HTML5 DnD in Playwright | Wear button + storage asserts; real Chrome drag manual |
| Live OS mic | FakeSpeech in orb-audit only |

---

## Reachability checklist

- [x] Extension pearls look like pearls + wear path
- [x] Web Reef drag/Wear → gauntlet
- [x] Vision modals portaled on Reef
- [x] Scene nav / Companion open-scene → spatial Scene **without** classic Stage chrome
- [x] Off-vision Highlight / AiNode / BeforeAfter / Grammar / TopToolbar **not** mounted on Pearl shell
- [ ] Live share/OAuth — residual
- [ ] Live OS mic — residual

---

## Evidence

- Contracts: `status: "removed"` + `removedReason` / `successor` in `shared/feature-contracts.js`
- Stress: clueless `sf-companion-open-scene` asserts no classic clutter
- Coverage: `docs/pearl-stress-coverage.md`

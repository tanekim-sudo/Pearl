# Zero-demand dogfood ledger — 2026-07-23

## Verdict
**Pass for exercised web surfaces** — a total novice sees one action (Talk to Companion); modes are automatic; Reef reads as pearl home; no Untitled orb / mode picker found. Make pearl, wear, and open Scene work through Companion chat GO.

## Product model under test
- Mother Pearl = Companion (only primary interface)
- Gauntlet = ≤5 context add-ons
- Reef = canvas where pearls live / form / play

## Screens (honest)
| Screen | Status | Note |
|---|---|---|
| Welcome | **pass** | “Just talk.” + one CTA |
| Companion chat | **pass** | type + GO; no mode picker |
| Reef | **pass** | where pearls live; Talk CTA |
| After make pearl | **pass** | Friday standup on Reef |
| Gauntlet wear | **pass** | charged socket |
| Scene | **pass** | Talk to Companion primary |
| 390px | **pass** | Talk CTA survives |

## Interactions
| Interaction | Status |
|---|---|
| Open Companion | pass |
| No mode picker | pass |
| Auto mode internal | pass |
| GO visible | pass |
| Make pearl (no block) | pass |
| No Untitled orb | pass |
| Wear gauntlet | pass |
| Open Scene | pass |
| No crash | pass |

## Fixed in this pass
- Removed Ask/Plan/Agent/Debug mode picker — auto-select via `recommendCompanionMode`
- Welcome reduced to one action: Talk to Companion
- Reef reframed as pearl canvas (not shelf instruction wall / mode center)
- Scene empty + chrome: one Talk CTA; Output Frame buried in overflow
- Killed first-use `?` guide button and CompanionOrb quick-action / howto walls
- Interview quiz off by default (no “Who are you?”)
- Companion chat auto-open disabled
- `createSemanticOrb` schema: optional `sceneId` + `activate` so Reef create works
- Wear parser accepts “wear Friday standup” without requiring the word “pearl”
- Deterministic “open a new scene” from Companion chat via `lens:shell-open-scene`

## Gaps (honest)
- Extension page Pearl / side panel not exercised in this web session
- Live model / credentials not required for these deterministic paths
- Ghost-cursor visual proof needs headed browser
- Studio “what it does” not always opened by dblclick in headless

## Defects
- none for exercised paths

Evidence: `audit-shots/zero-demand-2026-07-23/`
`release:check:fast` passed after orb matrix regen.

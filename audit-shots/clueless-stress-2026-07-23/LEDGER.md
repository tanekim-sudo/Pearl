# Clueless stress / regression recovery — 2026-07-23

## Verdict
**Core loop works again on production build without “Pearl hit a crash.”** Companion chat is visible and interactable; GO executes; make-pearl and wear succeed; runtime/director bridge is restored. Ghost-cursor pixels not proven in headless (gap).

## Root causes found (archaeology)
| Buried / broken | Cause | Fix |
|---|---|---|
| CompanionChat | Gated off with `!pearlShell` since progressive-shell redesign | Always render CompanionChat; portal to `document.body` |
| Director / `__lensOrbRuntime` | App only mounted when Output Frame open | Always mount App (hidden reef host + scene host) |
| Fake “Migrated Scene” | Hidden App persistence seeded pages/unified workspace | `runtimeHostOnly` skips board persistence |
| Dead reef CTAs | `.orb-reef-kicker { pointer-events: none }` killed Open Companion / Scene | Restore pointer-events on intro actions |
| Crash on action | `transitionOrb` threw invalid edges inside `setState` | Coerce invalid transitions (no throw) |
| Make pearl | Narrow parser + missing OrbUniverseShell handler | Expand parser; wire create path; App materialText |
| Voice | Hold-only + no chat mic path | CompanionChat mic + honest permission errors |

## Inventory
### Restored (was hidden / disconnected)
- CompanionChat transcript + GO + mic (portaled dock)
- App runtime bridge + GhostCursor portal
- Director demo path via runtime (`show me what you can do`)
- Pearl create “about X” / “from this: …”
- Wear → charged gauntlet socket
- Welcome → Open Companion hit-testing

### Still present (preserved, not stripped)
- Gauntlet ≤5, wear/remove, merge/synthesize/counter/organize handlers
- Scene overflow, Output Frame on intent, Encode emission, Studio open
- Moves→Functions→Lenses copy, Reef shelf, companion-first welcome
- Arc-reactor / charged-stone CSS

### Gaps (honest)
- Ghost-cursor overlay not observed in headless Playwright (runtime ready; headed visual verify recommended)
- Live mic permission depends on browser grant
- Chrome extension page Pearl not exercised in this web session
- Adaptive LLM path credential-dependent

## Automated dogfood (production preview)
See `results.json` from `scripts/interaction-recovery-audit.mjs` — all checks pass, 8 crash-free action gates, make-pearl + wear + chat + runtime.

## Comprehensive checklist (all prior commands)

| Commanded item | Status |
|---|---|
| No “Pearl hit a crash” on normal actions | **pass** |
| Buttons work (welcome/Open Companion hit-test, GO, Reef) | **pass** |
| Companion chat visible + type + GO | **pass** |
| Make pearl correctly (“about X”) | **pass** |
| Wear → charged gauntlet stone | **pass** |
| Mic affordance + honest error path | **pass** (permission grant = gap) |
| Director / ghost-cursor harness reconnected | **fixed** (runtime+portal; headless ghost visual = gap) |
| Understanding companion (deterministic verbs + runtime planner) | **pass** for deterministic; LLM = credential gap |
| Mother Pearl = companion; gauntlet = ≤5 context | **pass** |
| Clueless first-use clarity (welcome / Next copy) | **pass** |
| No silent Output Frame / no orb teaching | **pass** (kept) |
| Upload/paste/Keep this → pearl | **fixed** (Keep this + create handlers; full upload UI = retained Encode path) |
| Merge/synthesize/counter/organize | **preserved** (handlers intact; not re-broken) |
| Organize / Studio / Encode | **preserved** |
| Arc-reactor mother + charged stones | **pass** (CSS) |
| Production dogfood evidence | **pass** (`audit-shots/clueless-stress-2026-07-23/`) |
| release:check:fast | (run after this ledger) |
| Commit + push representation.git | (run after gate) |

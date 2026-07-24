# Pearl Product Stress Standard

Permanent project bar for anyone editing Pearl. Not a one-off audit script.

- **Cursor rule:** `.cursor/rules/pearl-product-stress-standard.mdc` (always apply)
- **Harness:** `npm run stress:pearl` → `scripts/pearl-core-stress.mjs` (spawns companion gates, then core + comprehensive journeys)
- **Coverage ledger:** `docs/pearl-stress-coverage.md`
- **Related:** `.cursor/rules/audit-truth-standard.mdc`, companion-capability-parity, cross-surface-release-parity, no-capability-regressions

This standard applies to **any** evaluation of new or existing features and flows — web Reef/Studio/Scene, Companion/director, and extension when loadable.

---

## Honesty constraint

Never claim the app is “100% production ready,” “perfect,” “fully working,” or “state of the art” unless direct evidence supports that exact claim. Aim for the bar; when mic, credentials, gateway, extension load, or auth sync cannot be verified, list them as **explicit remaining gaps** — do not invent pass criteria.

---

## Evaluation lenses (all required)

### 1. First-time / clueless user
Assume zero prior knowledge. Can a new user land, see Companion as the mother Pearl, and act without reading docs?

### 2. Zero demand
The app must not require the user to figure out Ask/Plan/Agent/Debug modes, tours, or jargon. Primary path: talk → GO. Modes may exist under the hood; they must not gate first success.

### 3. Aesthetics
Human review of **real screenshots** (agent uses the Read tool on PNGs). Fail on clutter, stacking, illegibility, broken hierarchy, cramped or wasted spacing, competing CTAs, truncated gauntlet labels, orb wording. DOM heuristics help; they do not replace perception.

### 4. Usability
Discoverability of the primary action, adequate hit targets, keyboard (Escape, Enter/GO path), narrow viewports (390px web; 360px side panel when extension loads), 200% zoom sanity when relevant.

### 5. Functionality
Prove **real effects**, not DOM existence. Prefer **hit-test** (`elementFromPoint`) over force-click. Trace claimed capabilities to runtime handlers. Mocked model responses prove wiring only — never present them as live AI evidence.

### 6. Persistence
Reload and navigation survival. Stable IDs. No silent data loss or duplicates on reload, import, or handoff. Prefer account-neutral IDs and idempotent sync semantics.

### 7. Companion / director honesty
Director animation must demonstrate the manual path when the verb claims demonstration. No silent mutation while claiming success. No fake evaluation/judgment when credentials are unavailable.

### 8. Communication
User chat echo before reply; status during work; action trail; blockers with precise codes/reasons — never a bare false “Done.”

### 9. Vision alignment
- Mother Pearl = Companion (not a second product)
- Reef = cultivated home / shelf
- Gauntlet ≤ 5 active worn pearls; sixth must refuse clearly
- Studio reading order: Moves → Functions → Lenses
- No user-facing “orb” copy

### 10. Accessibility
Focus order, visible focus, control labels/names, contrast sanity, reduced-motion path that remains understandable (director may simplify; it must not leave the UI stuck).

### 11. Error / empty / recovery
Empty Reef/library, failed GO, rejected confirm, missing credentials, offline-ish recovery. User must see a recoverable next step, not a dead end.

### 12. Performance feel
During headed runs, note obvious jank, multi-second hangs without status, or frozen chat. Not a synthetic benchmark — human-paced observation.

### 13. Trust
No false “Done.” Exact failure codes. Destructive actions require in-thread Accept/Reject (not backdrop-dismiss-only). Undo / checkpoint language when mutations happen.

### 14. Cross-surface
When the change is meaningful outside the web app, verify web + extension (or state the precise load/permission blocker). Direct manipulation and companion execution must produce equivalent persisted results where both exist.

### 15. Naming / copy consistency
Companion, Pearl, Reef, Gauntlet, Studio, Scene, Output Frame — consistent in UI. No resurrected “Generator” or user-facing “orb.”

### 16. Undo / confirm for destructive work
Clear / delete / wipe paths stage confirmation in chat with Accept and Reject hit-testable controls.

---

## Harness Integrity (what makes a check invalid)

A green check that a **clueless human cannot reproduce via Talk → type → GO** is a **false green**. Treat the following as invalid evidence of Companion UX:

| Invalid pattern | Why it lies |
|---|---|
| Calling `__lensOrbRuntime.run` / `.execute` (or injecting `localStorage` pearls) **instead of** hit-testing GO | Privileged path bypasses chat, parsers, hit targets, and director UX the user depends on |
| Asserting chat text / “Created…” **without** a Reef/storage pearl with **stable id + human title matching intent** | Companion can narrate success while the artifact is missing, Untitled, or an unrelated `pearls[0]` |
| Falling back to `library.pearls[0]` when the intent title is absent | Any pre-existing pearl makes create “pass” |
| Accepting titles matching `/untitled\|\borb\b/i` (or empty) after create | Vision violation: mystery objects / user-facing orb |
| “No orb” scan that only checks the word `orb` and ignores **Untitled** labels / aria / titles | Misses untitled mystery pearls |
| Merge / edit / experiment / wear marked stressed while only exercised via `execute([...])` on seeded IDs | Claims Companion can do the op; only proves domain handlers exist |
| Seed-on-failure that still records the create check as pass | Gap suites used to seed disposable pearls and count that as `wf-create-pearl` |
| `force: true` clicks, `networkidle` as success, or mocked model replies presented as live AI | Masks hit-test and honesty failures |

### Valid Companion pearl op check (minimum)

1. Fresh land → Talk hit-test → type intent → **GO hit-test** (`elementFromPoint`).
2. User echo before reply; status/action during work.
3. Companion reply present.
4. **DOM/state pearl** with non-empty human title matching intent (not Untitled / Orb / untitled orb).
5. Reload persistence of that **same id + title**.
6. For merge / edit / experiment: repeat Talk→GO and assert **artifact effects** (new titled pearl, renamed title, sources kept, etc.). Runtime.execute may exist as a **wiring probe** but must not be the sole pass for Companion UX.

Hard fail the suite when these integrity rules are violated, even if chat text looks green.

---

## Harness expectations

`npm run stress:pearl` must:

1. Prefer a **production preview** build (or document the exact working build URL).
2. Spawn companion live gates first (unless `SKIP_COMPANION=1`).
3. Exercise core journeys with hit-tests, persistence, director probes, and screenshot evidence — under **Harness Integrity** above.
4. Expand coverage toward claimed capabilities in README + `shared/feature-contracts.js` + companion manifest — especially role/superpower pearls, encode/automation, remix primitives, generation honesty, Output Frame, packages/tasks entry points, **shareability** (review → signed package → grant → consume → install / export → reopen), and **workflow** journeys (create → wear → Studio → remix → destructive confirm → encode).
5. Write evidence under `audit-shots/` and update tracked ledgers / coverage matrix.
6. Exit non-zero when P0/P1 defects remain open (including aesthetic hard fails and integrity violations).
7. Spawn residual gap suites (`npm run stress:gaps` / `scripts/pearl-gap-stress.mjs`) unless `SKIP_GAPS=1` — voice simulation, AI gateway honesty, extension 360, account multi-profile, taste UI, packages, vault.

### Shareability dimension
Prove: privacy review redacts secrets → signed `.pearl` package validates → grant consume is once-safe → install is atomic → unsigned/tampered rejects → local export reopen restores ids without silent dupes/loss.

### Workflow dimension
Prove headed: first-time Talk → create pearl → wear → Studio (M→F→L when structure exists) → organize/remix → in-thread Accept/Reject for destructive clear → encode entry. Persistence across reload where claimed.

Environmental limits (real OS mic hardware UI, live provider quality without keys, Gmail/Notion live hosts, real OAuth account) must appear once as **residual environment**, not as forever-skipped closable simulations.

---

## Severity

| Severity | Meaning |
|---|---|
| P0 | Release-blocking: traps, fake success, data loss, inaccessible primary action, vision break |
| P1 | Serious usability / honesty / persistence / aesthetics that block confident use |
| P2 | Polish; fix before calling a surface “clean,” but may not fail the whole suite alone unless piled up |

---

## What “done” means for a change

A user-facing change is not done until relevant stress lenses above are green (or explicitly gapped with cause), claimed companion verbs are honest, contracts/manifest stay in sync, and `npm run release:check:fast` (or full `release:check` when shipping) is green.

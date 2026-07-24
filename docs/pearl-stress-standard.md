# Pearl Product Stress Standard

Permanent project bar for anyone editing Pearl. Not a one-off audit script.

- **Cursor rule:** `.cursor/rules/pearl-product-stress-standard.mdc` (always apply)
- **Master harness:** `npm run stress:clueless` → `scripts/pearl-clueless-stress.mjs` (**hard-fail**, hyper-clueless + showcase catalog)
- **Core harness:** `npm run stress:pearl` → `scripts/pearl-core-stress.mjs` (must obey the same integrity rules)
- **Showcase catalog:** `docs/pearl-showcase-flows.md`
- **Gap audit:** `docs/pearl-stress-clueless-gap-audit.md`
- **Coverage ledger:** `docs/pearl-stress-coverage.md`
- **Related:** `.cursor/rules/audit-truth-standard.mdc`, companion-capability-parity, cross-surface-release-parity, no-capability-regressions

This standard applies to **any** evaluation of new or existing features and flows — web Reef/Studio/Scene, Companion/director, and extension when loadable.

---

## Honesty constraint

Never claim the app is “100% production ready,” “perfect,” “fully working,” “best possible,” or “state of the art” unless direct evidence supports that exact claim. Prefer: **raised to the clueless-hard bar** with evidence. When mic, credentials, gateway, extension load, or auth sync cannot be verified, list them as **explicit remaining gaps**.

---

## Clueless First-Time Persona (only acceptable UX evaluator)

The only valid evaluator for UX journey checks is a **hyper-clueless first-time user**:

- Zero product jargon; does not know verb names (`mergeSemanticOrbs`, etc.).
- Will not open DevTools, read source, or dispatch CustomEvents.
- Finds Talk without hunting; confusion budget: **≤1 unexplained click** to reveal usable input + GO.
- Types naive phrases (“make a pearl about my investor notes”, “change the name to…”, “combine these pearls”, “wear it”, “try something with this pearl”).
- Believes only what they can **see** on screen after GO.
- 390px phone-first is a primary journey, not a trailing check.
- Multi-step continuity without reset: create → rename → edit → wear → merge.

If a check requires expert phrasing, privileged APIs, or seeded pearls, it is **not** a Companion UX pass.

---

## World-state visibility

Every successful mutation must be findable on screen by a title/label a human can read in a screenshot (Reef capsule/aria, gauntlet socket, Studio chrome, Encode/settings surface). Chat narration + `localStorage` alone are insufficient.

---

## Intent binding

Create “about X” must yield a pearl whose **visible title clearly relates to X**.

- Fail: empty, `Untitled`, user-facing `orb`, generic `New pearl · <timestamp>` when the user named a topic.
- Pass: title contains topic tokens after stripping stopwords (`make`, `pearl`, `about`, `my`, `the`, `a`, `an`, `this`, `that`, …).

---

## Evaluation lenses (all required)

### 1. Clueless first-time / zero demand
No required Ask/Plan/Agent/Debug modes, tours, or jargon. Primary path: talk → GO.

### 2. Visual-first aesthetics (equal weight to function)
For every meaningful state: screenshot → **Read the PNG pixels** → written critique → pass/fail.

- **Invisible = Fail** — primary controls (Talk, input, GO, mic, pearl titles, gauntlet, Studio, confirms) must be obviously visible.
- **Bot-only reachable = Fail** — if a human cannot see/find the next action in &lt;3 seconds, the check fails even when DOM/runtime passed.
- Fail on clutter, stacking, illegibility, low contrast, white-dot Pearl, orb wording, buried chat, competing CTAs, truncated pearl names that look broken.
- Document critiques that cite what was **seen** in the image. Boilerplate “pass” without Read = harness lie.

### 3. Usability
Discoverability, hit targets, keyboard, **390px primary**, 360px side panel when extension loads.

### 4. Functionality
Real effects + hit-test. Trace claims to handlers. Mocked model responses = wiring only.

### 5. Persistence
Reload findability of the **same id + visible title**. No silent loss/dupes.

### 6. Companion / director honesty
Director demonstrates the manual path when the verb claims demonstration. No teleport mutation as UX proof.

### 7. Communication
User echo → visible Working/Listening/Blocked → reply or **exact** next-phrase blocker. Never dead air. Never bare false “Done.”

### 8. Vision alignment
Mother Pearl = Companion; Reef = shelf; gauntlet ≤5; Studio M→F→L; no user-facing “orb.”

### 9. Accessibility
Focus, labels, contrast sanity, reduced-motion still understandable.

### 10. Error / empty / recovery
Recoverable next step for empty Reef, failed GO, denied mic, offline-ish, nonsense utterance.

### 11. Performance feel
Human-paced waits; no multi-second hang without status.

### 12. Trust / undo / confirm
In-thread Accept/Reject for destructive work; undo/checkpoint language when mutating.

### 13. Cross-surface
Web + extension when meaningful, or precise load/permission residual.

### 14. Naming consistency
Companion, Pearl, Reef, Gauntlet, Studio, Scene, Output Frame — no Generator / orb resurrection.

### 15. Showcase completeness
Every flow in `docs/pearl-showcase-flows.md` stressed under this standard (or precise residual). Major inventory clusters mapped; README-claimed novice paths must not silently miss.

---

## Harness Integrity (what makes a check invalid)

| Lying pattern | Why it lies |
|---|---|
| `__lensOrbRuntime.run` / `.execute` or `localStorage` seed **as journey pass** | Privileged path bypasses chat/parsers/hit targets/director |
| Chat text without **visible** titled Reef/gauntlet artifact | Narration ≠ world change |
| `library.pearls[0]` fallback for create identity | Unrelated pearl makes create “pass” |
| Accepting `Untitled` / `orb` / topic-create as `New pearl · …` | Mystery object / weak intent binding |
| “No orb” scan that ignores Untitled / aria / canvas labels | Incomplete vision check |
| Merge/edit/experiment/wear greened only via `execute` on seeds | Proves domain handlers, not Companion UX |
| Seed-on-failure flipping create green | Gap-suite lie |
| `force: true`, `networkidle` as success, mocked model as live AI | Masks hit-test and honesty failures |
| Privileged `lens:companion-expand` as sole entry proof | Skips Talk CTA |
| Instant DOM assert before paint | False green before human could see change |
| Counting SKIP_* rows in pass totals | Inflates confidence |

### Valid Companion pearl op check (minimum)

1. Fresh land → Talk hit-test → type naive intent → **GO hit-test** (`elementFromPoint`). No force-click. No expand CustomEvent as sole path.
2. User echo before reply; status/action during work.
3. Companion reply **or** exact blocker.
4. **Visible** pearl title matching intent (not Untitled / Orb / generic New pearl stamp for topic creates).
5. Reload: same id + title **findable on screen**.
6. Continuity ops (rename/edit/wear/merge/experiment) via Talk→GO only; assert world-visible effects.
7. `runtime.execute` allowed only in isolated unit tests — never as the sole pass for Companion UX.

Hard fail the suite when integrity rules are violated.

---

## Anti-lie checklist (every PR / stress run)

- [ ] No runtime.execute/run as journey pass
- [ ] No force:true on primary controls
- [ ] No seed-as-pass / pearls[0] fallback for create identity
- [ ] No Untitled / user-facing orb / topic-create as generic New pearl
- [ ] Visible Reef/gauntlet title for every successful mutation
- [ ] Talk→GO only for Companion UX; confusion budget ≤1
- [ ] Continuity without harness reset for marathon flow
- [ ] Human Read veto recorded for primary PNGs
- [ ] Skipped env rows never counted in pass totals
- [ ] Exact blocker when vague — never dead air
- [ ] Showcase catalog SF01–SF25 addressed (pass, fail, or honest residual)

---

## Harness expectations

`npm run stress:clueless` must:

1. Prefer a **production preview** build.
2. Run **390px cold land** as a first-class journey.
3. Exercise showcase flows SF01–SF25 under Harness Integrity.
4. Write evidence under `audit-shots/pearl-clueless-stress-2026-07-24/` and update coverage.
5. Exit non-zero on any P0/P1 (including aesthetic veto and integrity violations).
6. Never count skipped credential/mic/extension rows as passes.

`npm run stress:pearl` must obey the same integrity rules for any Companion UX row; residual gap suites remain under `stress:gaps`.

Environmental limits (OS mic UI, live provider without keys, Gmail/Notion live hosts, real OAuth) appear once as **residual environment**.

---

## Severity

| Severity | Meaning |
|---|---|
| P0 | Release-blocking: traps, fake success, data loss, inaccessible primary action, vision break, integrity lie |
| P1 | Serious usability / honesty / persistence / aesthetics that block confident use |
| P2 | Polish; fix before calling a surface “clean” |

---

## What “done” means for a change

A user-facing change is not done until relevant stress lenses and showcase flows are green (or explicitly gapped with cause), claimed companion verbs are honest, contracts/manifest stay in sync, and `npm run release:check:fast` (or full `release:check` when shipping) is green.

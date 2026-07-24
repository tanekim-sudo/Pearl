# Pearl Stress — Clueless First-Time Gap Audit

**Date:** 2026-07-24  
**Against:** HEAD ~`beb0e20` + `docs/pearl-stress-standard.md` / `scripts/pearl-core-stress.mjs` / `scripts/pearl-gap-stress.mjs`  
**Evaluator persona:** Hyper-clueless first-time user — no jargon, no verb vocabulary, no source code, no knowledge that `__lensOrbRuntime` exists. If they cannot see and do it on screen, it did not happen.

**Verdict:** Prior stress could still go green while a human is stuck. Integrity patches at `beb0e20` closed several lie vectors; enough remain that a 132/132 matrix is not evidence of usable Companion UX.

---

## How to read this ledger

Each gap: **false-green mechanism → required assertion → severity**.

| Sev | Meaning |
|---|---|
| P0 | Suite must FAIL; human primary path broken or lied about |
| P1 | Serious; blocks confident use / continuity |
| P2 | Polish / secondary; still fix before claiming the surface clean |

---

## Entry

| Gap | False-green mechanism | Required assertion | Sev |
|---|---|---|---|
| Talk not the only path into chat | `expandCompanion()` dispatches privileged `lens:companion-expand` / clicks `.companion-orb` when Talk is skipped or chat missing — suite proceeds without proving the CTA a human would use | After cold land, **only** visible Talk (or equally labeled primary CTA) hit-test opens chat; input+GO must be visible ≤1 unexplained click (**confusion budget**) | P0 |
| Portal / race: GO exists in DOM but not hittable | Hit-test fail still falls through to `go.click()` “for recovery evidence” while later checks may still pass on storage | GO fail ⇒ journey FAIL; no recovery click that mutates state before recording failure | P0 |
| Chat buried under intro / portal z-index | Visual heuristics note `talkVisibleWithChat` but do not hard-fail entry if input is covered | `elementFromPoint` on input center + GO center must resolve those controls; screenshot Read confirms chat not buried | P0 |
| Welcome Talk optional fallback | `if (!talkHit.ok && talk.count) await talk.click()` — force-adjacent bypass of hit-test | Talk hit-test failure is hard fail; no silent non-hit click | P0 |
| 1280px primary, 390px afterthought | Core journeys run desktop first; narrow is a late bolt-on after many mutations | **390px cold land is a primary matrix row**, not a trailing check after seeding | P0 |

---

## Affordance

| Gap | False-green mechanism | Required assertion | Sev |
|---|---|---|---|
| No proof a novice knows what to type | Suite types expert phrases (“rename this pearl Shelf stress brief”, “edit this pearl: …”) that pass parsers; never tries “combine these pearls”, “edit it to add …”, “change the name to …” as continuity | Continuity journey uses **only** naive natural language a first-timer would invent; expert verbs allowed only as secondary synonym probes | P0 |
| Contradictory / dead CTAs | Heuristics detect GO/Accept overlap and Talk competing with open chat; often P2 or non-blocking | Overlap or dual primary CTAs on entry = P0 hard fail | P1 |
| Zero prompt copy for first GO | Welcome may say Talk without one short line of what happens next | At most one short instructional line; if absent, first naive utterance must still succeed (zero demand) | P1 |
| Modes/jargon leakage | Welcome scan blocks Ask/Plan/Agent/Debug **words**; does not prove UI chrome lacks mode pickers that gate success | Fresh path must complete create without opening any mode control | P0 |

---

## Perception (aesthetic Read)

| Gap | False-green mechanism | Required assertion | Sev |
|---|---|---|---|
| DOM heuristics ≠ human Read | Suite records aesthetic frames; agent may never **Read** PNGs; auto-pass possible | Every primary frame PNG must be human-Read; documented critique can veto suite (P0/P1) | P0 |
| Mystery white-dot / illegible labels | “No orb” text walker; canvas/WebGL / low-contrast capsule labels ignored | Visible pearl title readable in screenshot (contrast + not truncated into mush); white-dot-only Pearl = hard fail | P0 |
| `New pearl · …` treated as success | `isMysteryPearlTitle` **explicitly allows** `/^New pearl · /`; `titleMatchesIntent` can match token `pearl` inside that stamp | Intent-bound topic title required; generic stamp titles FAIL create when user said “about X” | P0 |
| Stacking / clutter ignored if DOM ok | `filledLabelClutter` etc. soft | Clutter/stacking that hides title or GO fails aesthetic veto | P1 |
| User-facing “orb” only English body text | CSS classes `.orb-*`, aria, titles partially scanned; WebGL glyphs not | Any visible user-facing “orb” / Untitled label fails | P0 |

---

## Action completeness

| Gap | False-green mechanism | Required assertion | Sev |
|---|---|---|---|
| Storage-only success | `readLibrary()` from `localStorage` proves create; **no** assert that Reef shows the title on screen | After GO: visible DOM/aria label (or screenshot-readable text) equals the titled pearl; storage alone insufficient | P0 |
| Weak intent binding | `titleMatchesIntent` = any intent token length>2 appears in title → “about” / “make” / “pearl” / “notes” match `New pearl · …` or unrelated “notes” | Require **topic tokens** (strip stopwords); title must clearly relate to X (e.g. investor / Series A) | P0 |
| Chat narration without world change | Companion reply regex `/Created|pearl/` can pass while Reef empty or wrong pearl | Named Reef artifact + visible title required; chat optional garnish | P0 |
| `pearls[0]` still used downstream | Studio path: `pearlId = created?.id \|\| library.pearls[0]?.id` | Never fall back to unrelated pearl for “created” journey | P0 |
| Merge “sources kept” without visible merge result | New id in storage counted; user may never see merge pearl on Reef | Visible new titled merge result + sources still findable | P0 |

---

## Continuation

| Gap | False-green mechanism | Required assertion | Sev |
|---|---|---|---|
| Wear / organize / remix via `execute` | Matrix marks `gauntlet-wear`, `organize-merge-synthesize`, remix, encode as stressed while body uses `__lensOrbRuntime.execute` on seeded IDs | Journey matrix rows for Companion UX may **only** Talk→type→GO (or visible drag). `execute` = unit/wiring only, never journey pass | P0 |
| Expert NL only | “merge these pearls” stressed; “combine these pearls” not parsed (null) | Novice synonyms must work or return exact blocker with a valid next phrase | P0 |
| “edit it to add …” dead air | Naive edit phrase returns null → planner/credentials path or silent noop | Deterministic parse → mutation **or** exact blocker (never dead air) | P0 |
| Vague “try something” / “experiment” alone | Bare “experiment” maps to counter pearl; “try something with this pearl” null | Vague ops: work with visible effect **or** exact next-phrase blocker | P1 |
| Reset between ops | Create journey then `goto /` and re-expand; not one continuous novice session | Multi-step continuity without harness reset: create → rename → edit → wear → merge | P0 |
| Studio M→F→L seed fallback | If structure missing, `seedDisposablePearls` + reopen Studio still greens the check | Studio structure claim must come from user-reachable organize path on the **same** pearl, or FAIL honestly | P0 |

---

## Feedback

| Gap | False-green mechanism | Required assertion | Sev |
|---|---|---|---|
| Status optional in practice | Status check exists for create; later ops often `expectAnim: false` / weak status | Every GO: user echo → visible Working/Listening/Blocked → reply or exact blocker | P0 |
| Silent no-ops | Missing parse → empty companion or fake Done possible depending on planner | No-op with no blocker text = P0 | P0 |
| Fake Done | Destructive / evaluate paths probe honesty; freeform NL less so | Any “Done” without world-state change = P0 | P0 |

---

## Recovery

| Gap | False-green mechanism | Required assertion | Sev |
|---|---|---|---|
| Empty / denied mic simulated in gaps only | Core suite can SKIP_GAPS; matrix still looks green | If gaps skipped, coverage must say **not verified** — never “stressed” | P0 |
| Offline / wrong turn | Little headed recovery for “I typed nonsense” | Nonsense utterance → exact recoverable next step (one short line max) | P1 |
| Permission denied | Gap suite only | Residual ledger must list mic OS UI / OAuth as environment — not pretend covered by core | P1 |

---

## Persistence

| Gap | False-green mechanism | Required assertion | Sev |
|---|---|---|---|
| Reload checks storage id/title | Does not require pearl **findable on Reef UI** after reload | After reload: same id + title **and** visible label a human can spot | P0 |
| Mid-flow reload | Only post-create reload; not mid rename/edit | At least one mid-continuity reload with findability | P1 |

---

## Cheat vectors (remaining)

| Gap | False-green mechanism | Required assertion | Sev |
|---|---|---|---|
| Privileged runtime in “stressed” journeys | Widespread `__lensOrbRuntime.execute` / `.run` after create block; gap workflow wear/studio/remix | Ban in `stress:clueless` / journey sections; allow only isolated unit tests | P0 |
| `force: true` clicks | Gap package/sign paths | No force clicks in clueless journeys | P0 |
| Seed-on-failure | Gap comment says create must not seed-as-pass; Studio/taste/workflow still seed | Seed never flips a Companion-UX check green | P0 |
| `networkidle` as readiness | Other audits; core uses `domcontentloaded` + short sleeps — still racey | Wait for **visible** text/controls; human-paced (≥ paint of chat/status) | P1 |
| English “orb” only | Classnames/CSS ignored for user visibility | Visible text + aria + title; canvas labels if any | P1 |
| Accepting generic `New pearl ·` for topic create | See Perception | Intent binding fails generic stamp | P0 |
| Animation probe without teaching path | Director seen for create; wear/merge later teleport via execute | Demonstrable ops must show director that teaches manual path | P0 |
| Coverage ledger “132/132” with SKIP_* | Skipped rows still inflate confidence | Skipped ≠ stressed; score must exclude skips | P0 |

---

## Time / pace

| Gap | False-green mechanism | Required assertion | Sev |
|---|---|---|---|
| Instant DOM asserts | Many `waitForTimeout(400–600)` then assert storage | Wait until visible title/status/reply; minimum human beat after GO before world-state assert | P0 |
| Mid-anim shot optional failure mode | Mid-anim recorded but later ops skip anim | Continuity ops that claim demonstration require mid-anim evidence | P1 |

---

## Viewport

| Gap | False-green mechanism | Required assertion | Sev |
|---|---|---|---|
| Desktop-first narrative | Welcome→create at 1280; 390 later with different library state | Cold 390px: Talk→GO→visible titled pearl as **first-class** journey | P0 |
| Side panel 360 skipped often | SKIP_GAPS | Extension 360 residual must be honest | P1 |

---

## Director

| Gap | False-green mechanism | Required assertion | Sev |
|---|---|---|---|
| Teleport mutation counted as Companion UX | execute wear/merge/organize with no ghost-cursor teaching | If verb claims demonstration, animation must run via GO path; teleport = wiring test only | P0 |
| Reduced-motion escape hatch | Softened animation pass may hide missing director wiring | Reduced-motion still requires understandable status + world change | P1 |

---

## Top 5 reasons prior stress was worthless (summary)

1. **Privileged `execute` / seed paths** still green whole capability rows (wear, organize, remix, Studio structure).
2. **`New pearl · stamp` + weak token match** can satisfy “titled pearl matching intent.”
3. **Storage without on-screen Reef title** — humans look at pixels, not `localStorage`.
4. **Expert NL + CustomEvent expand** — not the confused human’s path.
5. **Aesthetic / 390px / SKIP_GAPS** allowed a perfect score while entry, perception, and continuity stayed unproven for the persona.

---

## Anti-lie checklist (must hold every PR / stress run)

- [ ] No `__lensOrbRuntime.run|execute` in journey pass criteria
- [ ] No `force: true` for primary controls
- [ ] No seed-as-pass / `pearls[0]` fallback for create identity
- [ ] No `Untitled` / user-facing `orb` / topic-create accepted as generic `New pearl ·`
- [ ] Visible Reef (or gauntlet) title readable in screenshot for every successful mutation
- [ ] Talk→GO only for Companion UX rows; confusion budget ≤1 unexplained click
- [ ] Continuity without harness reset for create→rename→edit→wear→merge
- [ ] Human Read veto recorded for primary PNGs
- [ ] Skipped env rows never counted in pass totals
- [ ] Exact blocker text when vague/unparseable — never dead air

---

## Mapping to remediation

| Workstream | Addresses |
|---|---|
| Upgrade standard + Cursor rule | Persona, world-state, anti-lie, screenshot veto |
| `npm run stress:clueless` master runner | Hard-fail journeys under this audit |
| Product: intent synonyms, titles, Reef visibility, blockers | Novice phrases + findability |
| Coverage matrix rewrite | Honest stressed vs residual |

# Clueless visual defects — from real PNG Reads (2026-07-24)

**Method:** Read tool on `audit-shots/pearl-clueless-stress-2026-07-24/*.png` pixels.  
**Rule:** Invisible / stacked / low-contrast critical UI = P0 fail even if DOM/runtime passed.  
**Latest harness:** 49/49 · P0=0 P1=0 (headed Playwright Chromium, production preview).

## Re-Read after evaluate-honesty + marathon green

| Frame | Seen in image | Verdict |
|---|---|---|
| `17-eval-after.png` | Companion shows **Blocked … Live model critique needs credentials — this step did not invent AI output. [needs-credentials]** after “evaluate this page with my pearls”; no bare “Done.” Reef shelf titles readable (Series A notes, competitor signals, merge, counter). | **PASS** evaluate honesty |
| `03-create-after.png` | “my investor notes” shelf card readable; GO cream/high-contrast; no Reef hero stacked over title; director action trail visible. | **PASS** |
| `n03-create-after.png` | 390px: titled pearl peek behind Companion; GO reachable; chat owns attention. | **PASS** |
| `18b-frame.png` | Output-frame path leaves context/plan Accept·Reject chrome; harness rejects to continue (not a fake success). | **PASS** with residual clutter note |

## Earlier defects (status)

| Frame | Seen in image | Severity | Status |
|---|---|---|---|
| `01-welcome.png` | Talk CTA clear; gauntlet legend improved | P1 | Mitigated |
| `n01-cold-390.png` | Gauntlet/hint overlap reduced | P0 | Mitigated |
| `02-after-talk.png` | Competing Reef Talk CTA hidden when chat open | P0 | Mitigated |
| `03-create-after.png` / `11-reload.png` | Shelf grid; no hero over titles | P0 | Mitigated |
| `06b-gauntlet.png` | Worn labels more readable | P0 | Mitigated |
| `n03-create-after.png` | Narrow chat no longer buried under gauntlet chrome | P0 | Mitigated |

## Product fixes this turn (evaluate honesty + marathon)

1. Remix path surfaces `visibleText` — evaluate no longer collapses to bare “Done.”
2. `requiresModel` evaluate replies return **blocked / needs-credentials** with grounded prep copy.
3. Clipboard `readText` during evaluate is raced with a short timeout (permission prompts were hanging headed Chromium).
4. Harness: wait only for companion replies after the current user utterance; dismiss Accept/Reject; Playwright Chromium (not system Chrome); click timeouts.
5. Demo chips: only on empty chat, max 2 (clutter cut).

## Residuals (honest — not production-ready claim)

- Companion header chips (memory / why? / voice) still dense.
- Version-history Ask-mode reply is a precise blocker but coded `[unknown-error]` — copy honesty residual.
- Live mic OS permission, live model quality, extension 360, OAuth sync, signed share handoff not verified.
- `/api/models` and packages proxy ECONNREFUSED in preview-only runs (expected without API server).

## Harness integrity

- No `__lensOrbRuntime.execute/run` as journey pass.
- No `force:true` on primary controls.
- Visual PNG Read remains a hard veto equal to DOM asserts.

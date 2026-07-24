# Pearl Studio restore — 2026-07-24

Evidence PNGs (local, gitignored): `audit-shots/pearl-studio-restore-2026-07-24/`

## Root cause of plot loss

1. **Click-to-open routed to Scene admin form** — Reef single-click went to `/scene/…`; `SemanticOrbLayer` showed Rename / Duplicate / Split / Archive. Studio required double-click / Companion / popup.
2. **Function step names were stripped** — `definitionFor("function")` mapped `{ name, description }` steps to bare `step:N` nodes, dropping Move titles. Interior could not show Function = ordered Moves.
3. **Studio UI was a form dump** — giant textarea + aesthetic grid primary; structure behind “Inspect structure.”

## Restored

- Reef **single click → same-window Studio**.
- Studio primary: **Functions = ordered Moves** (numbered list, drag reorder, Decompose; Lenses secondary).
- Step-name fidelity via cognition fix + `shared/pearl-function-moves.js`.
- Scene pearl click opens Studio; inspector “Explore structure” + preview.

## PNG frames Read

| Frame | Verdict | Notes |
|---|---|---|
| `r02-after-investor.png` | PASS | Auto Studio after investor create; 5 named memo Moves. |
| `r04-reef.png` | PASS | Investor pearl / Open to explore hittable. |
| `r05-after-click.png` | PASS | Click → Studio; Functions=ordered Moves; not junk form. |
| `r06-after-reorder.png` | PASS | Drag swapped thesis ↔ market; status visible. |
| `05-after-pearl-click.png` (pre-fix) | FAIL historic | Scene inspector form — refused as explorer. |

## Comprehension (r05)

- Know what pearl is? Yes — Investor pearl / memo + diligence.
- What next? Drag, Decompose, Organize/Notes/Appearance/History.
- See Functions as move sequences? Yes — numbered 1–5 with titles.

## Residuals

- Live AI **produce memo document** to PDF/tab needs credentials — not claimed green.
- Companion NL reorder verb still residual (gesture works).
- Mic / OAuth / extension residuals unchanged.
- Not a production-ready claim.

## Harness

- Aesthetic pass requires pixel-grounded critique or hard-fail.
- Gates: `sf-click-studio-function-moves`, `sf-studio-reorder-moves`, `sf-click-pearl-hittest`.
- Showcase SF10b / SF10c.

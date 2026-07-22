# New-user E2E audit — 2026-07-22

## Verdict

**New-user local journeys are usable on the production build** after fixing blank-SPA CORS, companion aria-label drift, Scene “go home” determinism, and trusted-handoff build/extension wiring. Not a claim of perfect/complete product readiness — see Not verified.

Base: `http://127.0.0.1:8787` (production `dist` + `npm start`).

## Summary

| Check | Result |
| --- | --- |
| New-user Playwright journeys | **13/13 passed**, 0 open defects |
| Unit tests (`npm test`) | **706/706 passed** |
| `release:check:fast` | See commit notes / CI output |

## Journeys exercised

1. First open / empty Reef + companion expand/Escape  
2. Reef routes `/`, `/library`, `/toolbox` + 390px library  
3. Scene open + persistence across reload  
4. Pearl Studio open path + organize  
5. Companion/director: navigate home, wear ≤5, refuse 6th, merge/synthesize/counter/organize/evaluate  
6. Trusted handoff → continuation / Output Frame  
7. Anonymous local persistence  
8. Offline API abort keeps UI alive  
9. `/install` guidance  
10. Cmd/Ctrl+K universal search  

## Defects found and fixed

| ID | Sev | Title | Root cause | Fix |
| --- | --- | --- | --- | --- |
| CORS-01 | P0 | Production SPA blank on `127.0.0.1` | CORS allowlist had `localhost` only; module/CSS assets with Origin `http://127.0.0.1:8787` returned **500** | Allow both hosts in non-production; deny origins with `callback(null, false)` instead of throw |
| A11Y-01 | P1 | Companion command box unreachable to audits/AT expecting Pearl label | Aria-label drifted to “Tell the companion your goal” | Restored `Tell Pearl your goal` (matches extension + contracts) |
| NAV-01 | P1 | “go home” from Scene did not navigate without planner | App companion lacked Reef’s deterministic shell phrases | Shared `matchShellNavigationIntent` used by App + OrbUniverseShell |
| HANDOFF-01 | P1 | Handoff always “No working set arrived” on local builds | `VITE_LENS_EXTENSION_ID` unset → trusted messaging skipped | Document env; clearer missing-id copy; rebuild/audit with id; chrome mock overwrite for system Chrome |

## Evidence

Folder: `audit-shots/new-user-e2e-2026-07-22/`

- `audit-results.json` — machine-readable results  
- `DEFECT-LEDGER.md` — severity ledger from the harness  
- Screenshots `01-…` through `10-…` plus companion/gauntlet/handoff frames  

## Not verified

- Real Chrome load-unpacked extension sidepanel DnD / page Pearl GO (Playwright headless + no MV3 sidepanel host)  
- Live Supabase multi-account adopt/skip/retry  
- Live AI Gateway model quality for organize/evaluate/synthesize (failure/prepare paths exercised; credentials optional)  
- Microphone / voice companion and real touch hardware  
- Full screen-reader pass (roles spot-checked only)  
- 200% zoom and forced-colors stress beyond reduced-motion contexts used in the harness  
- Production Vercel deploy with a real Chrome Web Store extension id (local audits use `audit-extension-id`)  

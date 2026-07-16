# Chat requirements ledger

Historical pre-hardening snapshot. This 35-group ledger is retained for forensic diffing and is superseded by `requirements-regenerated.json`, `REQUIREMENTS-DIFF.md`, and `REPORT.md`.

Verdict at the original checkpoint: **BLOCKED.** Final verdict: **PASS — zero unresolved local requirements.**

The parent transcript contains 106 user-role events. Duplicate plan echoes, “keep going”/status messages, and subagent notification instructions were de-duplicated; the current atomic ledger contains 35 requirement groups. Current semantics override the July 14 5:21 PM Function/Lens/Generator wording:

- Move = one action.
- Function = a process.
- Lens = a way of seeing/context.

Counts at this checkpoint:

- Active and implemented: 21
- Superseded: 3
- External boundaries: 4
- Active unresolved: 7

The machine-readable record and per-item evidence are in `requirements.json`. “Implemented” requires a runtime/data path and test or retained browser evidence; a manifest-only capability is not accepted.

## Release blockers

1. Transcript learning has source and unit coverage but no current real-browser all-three → real editors → save/apply/persist evidence.
2. The companion manifest/runtime still exposes some process-era Lens naming; canonical capability renaming is incomplete.
3. Extension transcript/context-action changes build but need direct tests and browser evidence.
4. Before/after canonical Move-versus-Function classification lacks a current taxonomy browser audit.
5. The expanded companion runtime-effect matrix has not been regenerated; the 121/121 artifact only proves the pre-rebase inventory.
6. New migration/account/extension chained dedupe has no current browser evidence.
7. Required current-taxonomy screenshots do not exist yet.

No “all prompts implemented” claim is authorized while any item above remains open.

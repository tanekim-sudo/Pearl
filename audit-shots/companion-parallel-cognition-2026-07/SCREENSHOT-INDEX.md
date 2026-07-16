# Screenshot index

## Baseline

- `baseline/01-conversation.png` — destructive clear confirmation.
- `baseline/02-conversation.png` — unrelated Function request swallowed.
- `baseline/03-conversation.png` — literal retry request reaches planner.
- `baseline/04-conversation.png` — Function request exposes provider failure.
- `baseline/05-conversation.png` — vague request exposes provider failure.
- `baseline/deployed-1-conversation.png` — deployed clear confirmation.
- `baseline/deployed-2-conversation.png` — deployed stale-confirmation reproduction.

## Fixed local production build

- `fixed/01-conversation.png` — destructive confirmation staged.
- `fixed/02-conversation.png` — unrelated command executes two canonical Functions.
- `fixed/03-conversation.png` — retry resolves recoverable ledger entry without schema leakage.
- `fixed/04-conversation.png` — canonical investment memo Function persists.
- `fixed/05-conversation.png` — reversible local capability demonstration.
- `fixed/parallel-branchspecs-editor.png` — three per-branch perspectives in Function editor.

Machine-readable browser evidence is in `baseline/conversation-results.json`, `baseline/deployed-results.json`, `fixed/conversation-results.json`, and `fixed/parallel-branchspecs-results.json`.

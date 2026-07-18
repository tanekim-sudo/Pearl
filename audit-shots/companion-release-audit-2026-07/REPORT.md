# Companion release audit

Verdict: not release-ready.

## Exact regression
- Input: `Who are you?\nclear everything let me start fomr scratch`
- First visible confirmation: 54 ms
- Result: 13/14 checks passed

- PASS — exact typo-containing multiline input reaches confirmation: 54ms
- PASS — current workspace means paper and AI: Clear this workspace content? 3 whiteboard items · 2 AI nodes Built-in lens primitives will be kept. Cancel Clear listed content
- PASS — account libraries are outside unqualified clear: Clear this workspace content? 3 whiteboard items · 2 AI nodes Built-in lens primitives will be kept. Cancel Clear listed content
- PASS — mixed identity question does not swallow executable command
- PASS — executable request dispatches exactly once
- PASS — deterministic planning reaches visible action under two seconds: 54ms
- PASS — reported schema error is absent
- PASS — confirmation stages without early mutation
- PASS — confirmation performs real unified state mutation
- PASS — unqualified clear preserves account library
- PASS — cleared workspace survives refresh: items=0, nodes=0, unified=0/0
- PASS — preserved library survives refresh
- PASS — no uncaught browser errors
- FAIL — no material console or request errors: {"consoleErrors":["Failed to load resource: the server responded with a status of 500 (Internal Server Error)","Failed to load resource: the server responded with a status of 404 (Not Found)","Failed to load resource: the server responded with a status of 500 (Internal Server Error)"],"failedResponses":[{"status":500,"url":"http://127.0.0.1:5190/api/models"},{"status":500,"url":"http://127.0.0.1:5190/api/models"}]}

## Screenshots
- `01-exact-command-entry.png`
- `02-unified-confirmation.png`
- `03-confirmed-result.png`
- `04-narrow-after-refresh.png`

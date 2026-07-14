# Companion release audit

Verdict: **local companion runtime-effect release gate passed**.

## Complete capability gate
- Inventory at final verification: 121 canonical capabilities — 106 app/director and 15 extension.
- Controlled execution-effect matrix: 121 passed, 0 failed, 0 skipped.
- Every row validates canonical arguments, parses a canonical adaptive plan from a representative natural-language utterance, invokes the registered real handler, returns a typed result, and records a state/artifact/model-boundary effect or a specific read-only result.
- Shared-path capabilities run from a real generated share URL. Before/after capabilities run through the private editor event boundary and mocked inference endpoint. Extension capabilities execute the actual extension verb registry with controlled adapters.
- Matrix: `capability-execution-matrix.json`; concise index: `capability-execution-matrix.md`.

## Exact reported regression
- Input: `Who are you?\nclear everything let me start fomr scratch`
- First visible confirmation: 26 ms.
- Result: 14/14 browser checks passed.
- The command dispatches once, stages confirmation without mutation, clears paper + AI after confirmation, preserves account libraries, and survives refresh.

## Red cases repaired during execution audit
- Director results could be `undefined`, `null`, or untyped objects. The runtime boundary now normalizes every successful handler result to a canonical typed envelope.
- Single-literal schemas such as `mode: "source?"` were rejected because validation only recognized primitives and unions. Literal validation now uses exact value matching.
- Grinding examples relied on a React state-updater side effect to synchronously return the next draft. Draft creation is now eager and remove/reorder resolve real IDs (including `last`) or fail precisely.
- Ghost-cursor clicks are visual demonstrations, not DOM activation. GO and learned-lens save handlers now invoke the real action after animation; they no longer return success without dispatching/saving.

## Representative browser evidence
- Exact destructive command: 14/14.
- Adaptive plan/artifact journey: 8/8.
- Create/reference/compose journey: 10/10.
- Voice duplicate suppression and destructive follow-up: 10/10.
- Screenshots: `01-exact-command-entry.png`, `02-unified-confirmation.png`, `03-confirmed-result.png`, `04-narrow-after-refresh.png`.

## External boundaries
- Hosted model quality, real microphone hardware/permissions, live multi-account sync, and store publication remain external. Controlled model responses prove local planner/handler/effect behavior without claiming live-provider quality.

# Audit-first baseline matrix

Baseline: `c2ecb8e80e2a4d8a3c43483e147f5d78880734de` (`main`, `origin/main`) on 2026-07-16.

| Area | Source existed | Reachable effect before repair | Baseline finding |
|---|---:|---:|---|
| Vercel AI Gateway + explicit fallback | yes | partial | Gateway profiles, provenance, streaming, and explicit direct-fallback policy had tests. Local production had no configured provider; raw `fetch failed` reached chat. |
| Continuous voice/correction | yes | tested | Continuous recognition and duplicate-final guard existed. No sequential command ledger connected voice finals to retry recovery. |
| Reversible critique | yes | tested | Session checkpoints and linked annotations existed across web/extension. |
| Capability manifest | 166 claimed / 174 current | partial | Manifest/runtime parity tests existed, but isolated fixtures did not prove natural-language dispatch. Screenshot sequence failed before a planner or handler could act. |
| 3×3 composition + Material bridges | yes | tested | Canonical composition and extension bridge tests passed. |
| Move capture + InstructionEvents | yes | tested | Canonical capture and idempotent journal existed. |
| Perceptual Lens encoding | yes | reachable | Editable model, bounded context, and extension capture paths existed. |
| GenerationPlan/taste | v1 | partial | Count, model assignment, candidate batches, yes/no/more-like-this existed. No explicit branch-specific instruction/model object. |
| Streamed candidate branches | partial | partial | Independent candidate runner existed; branch semantics were homogeneous slots. |
| Semantic viewport/paper + visual capture | yes | guarded | Bounded queries and explicit visible-tab authorization existed. Planner could still invent an unsupported query and leak its validator path. |
| Companion destructive confirmation | yes | broken | A five-minute “recent clear” heuristic treated any later mention of Functions/Lenses as a destructive follow-up. |
| Last-command recovery | no | broken | Retry phrases were replanned from their literal text instead of a stable failed-command snapshot. |
| Canonical Function creation | partial | broken in conversation | Real tree persistence existed, but common requests depended on remote planning and returned the wrong director result type (`lens`). |
| Primitive Moves | 8 primitives | redundant | Expand/Explore, Invert/Challenge-like semantics, and legacy aliases were not reconciled into the requested five-card set. |
| Proximity Merge | no | missing | AI nodes could move and branch, but had no dwell/hysteresis Merge affordance. |

Evidence:
- `baseline/conversation-results.json`: local production sequential transcript, persisted state, API responses, and console errors.
- `baseline/deployed-results.json`: read-only fresh-browser deployed reproduction.
- `baseline/01-conversation.png` through `05-conversation.png`.
- `baseline/deployed-1-conversation.png`, `deployed-2-conversation.png`.

The deployed reproduction matched the supplied screenshot: cancelling the first clear left stale context, and the unrelated two-Function command staged another clear instead of creating Functions.

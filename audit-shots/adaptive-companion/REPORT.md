# Adaptive companion audit

## Architecture

The companion now observes a bounded snapshot, validates a versioned control-flow plan, and executes only canonical capabilities. The DSL supports sequence, safe parallel reads, foreach, conditionals, finite retry, queries, evaluation, research, checkpoints, and artifact placement. Execution keeps a journal/checkpoint and exposes cancellation.

## Reusable capabilities

- Geometry-aware align, distribute, stack, grid, cluster, relative move, overlap avoidance, grouping, and linking.
- Generic synthesize, compare, critique, reflect, alternatives, counterexamples, revise, and semantic-cluster transforms.
- Linked feedback artifacts with source/provenance metadata.
- User-scoped autonomy: act immediately, preview complex plans (default), or always preview.

## Provenance and research

Created artifacts carry source IDs and operation metadata. Research results are required to contain sources before execution may continue. The current backend does not expose verifiable live browsing, so research plans fail before mutation with an explicit blocker rather than fabricating citations.

## Reliability

- 40-step, 100-iteration, 3-research-call, 3-retry defaults.
- Unsupported capabilities and malformed arguments fail before mutation.
- Cancellation aborts director/model work.
- Partial failure reports an exact checkpoint and retains completed work for retry/undo.

## Automated evidence

- PASS — arrangement mutates real geometry
- PASS — feedback creates linked artifact
- PASS — reflection materializes output
- PASS — multi-output preserves originals
- PASS — complex plan exposes visual strip
- PASS — unverifiable research blocks before mutation
- PASS — narrow companion remains in viewport
- PASS — no page errors

## Screenshots

- [Plan strip](plan-strip.png)
- [Rearrangement](rearrangement.png)
- [Critique annotations](critique-annotations.png)
- [Research provenance blocker](research-provenance.png)
- [Reflection](reflection.png)
- [Generator organization](generator-organization.png)
- [Multi-output result](multi-output-result.png)
- [Narrow viewport](narrow-viewport.png)

## Limitations

- Live external research is intentionally blocked until the server provides a source-returning browse/search tool.
- This audit uses deterministic model responses. Credentialed model quality and external-source ranking require environment-specific evaluation.
- Permanent lens capture still uses the existing explicit user crafting/confirmation flow.

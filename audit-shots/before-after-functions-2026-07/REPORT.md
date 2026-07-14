# Before → After Lens Creation Audit

Date: 2026-07-14

## Result

PASS. “Learn from before & after” is reachable from the normal Create/Edit lens editor, produces a normal editable prompt operator with output specification v1, and saves through the existing rack/history/sync/runtime path.

## Verified flows

- Empty symmetric pair: `01-empty.png`
- Text → text: `02-text-pair.png`
- Image → image with bounded raster previews: `03-image-pair.png`
- Editable pressure-aware drawing plus mixed input: `04-drawing-mixed-pair.png`
- Structured inference preview, confidence, ambiguity, and alternatives: `05-inference-alternatives.png`
- Normal lens prompt/output-spec editor after “Use this”: `06-editable-output-spec.png`
- Saved learned lens in the existing product: `07-saved-function-rack.png`
- Responsive 390×844 layout: `08-narrow.png`
- Precise retryable model error with draft retained: `09-retryable-error.png`
- Extension’s explicit two-slot capture/infer/handoff workflow: `10-extension.png`
- Companion deterministic command executing the real editor-opening capability: `11-companion.png`

## Architecture and privacy

- Shared schema v1 bounds examples, text, raster MIME, dimensions, pixels, strokes, points, nesting, per-file size, and total request size.
- PNG/JPEG/WebP are decoded and rerasterized client-side, which strips metadata and rejects SVG/HTML/scriptable content.
- Model inference is server-only through the existing authenticated/anonymous AI guard and Qwen/Hugging Face vision infrastructure. Multiple visuals are supplied as ordered vision message parts.
- Learned examples remain private provenance on the operator. Public lens packs, share bundles, and library exports strip bodies by default while retaining “learned from N private examples.”
- Anonymous drafts use bounded data URLs. The repository has no existing private object-storage upload contract, so signed-in examples currently use the same bounded operator/account-sync representation.

## Automated verification

- Shared before/after schema, parsing, output-spec integration, user override priority, export privacy, and idempotent import tests: 6 passed.
- Full app/shared suite: 399 passed.
- Companion deterministic intent plus canonical manifest/runtime parity: 23 passed in focused run.
- Extension suite: 16 passed.
- Production web build: passed.
- Extension production build, package, and archive validation: passed.

The visual audit stubs the inference HTTP response for repeatability; request normalization, server endpoint integration, and structured response parsing are covered by code/unit tests. A live inference still depends on a configured `HF_TOKEN`, network availability, and the configured model provider.

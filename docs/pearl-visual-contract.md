# Unified Pearl visual contract

Version 1 applies to every primary, semantic, Result, worker, candidate, cursor, recipient, and canvas-anchor Pearl on web and extension surfaces.

## Required optical stack

Pearl is one shared SVG renderer with a warm translucent body, off-center nucleus, far and near subsurface volumes at different focus depths, an internal caustic, restrained depth gradient, rose/celadon/pale-gold nacre, reflected-environment band, internal reflection, curved edge, fixed-light specular, pinlight, and contact shadow. The optical stack is clipped to the sphere except for its contact shadow. No external effect may provide the illusion of depth.

The idle body is 28–36 CSS pixels; the precision cursor is 16–20 CSS pixels. The Result variant is quietly celadon. Surrounding modes are `auto`, `light`, `dark`, `colored`, and `text-heavy`. Surrounding adaptation changes neutral edge and reflection contrast, never the semantic state or sampled page content.

Only the internal nucleus, nacre, caustic, and reflected environment may parallax. Specular light remains fixed. Idle motion is a slow ±2% breath. Command effects use the shared semantic animation vocabulary and one settling overshoot. Reduced motion removes all motion while retaining the complete static optical stack.

## Forbidden conditions

- plain white circle or white-dot collapse
- outer glow, aura, halo, bloom, rays, neon, or saturated interference color
- heavy drop shadow or blurred surrounding chrome
- spinning, pulsing, bouncing, or ornamental activity
- a surface competing through gradient, rounded-card chrome, color, density, or scale
- renderer forks or decorative Pearl approximations
- hidden keyboard focus, status, failure, or screen-reader semantics

The executable static contract is `shared/pearl-visual-contract.js`. Its budgets limit each Pearl to 40 SVG drawing elements, one internal blur filter, and 12 KB of markup. The release gate validates the contract and captures 2× device-pixel evidence.

## Manual evidence review — 2026-07-20

Evidence:

- `audit-shots/unified-pearl-visual/matrix-no-preference.png`
- `audit-shots/unified-pearl-visual/matrix-reduce.png`
- `audit-shots/unified-pearl-visual/closeup-no-preference.png`
- `audit-shots/unified-pearl-visual/closeup-reduce.png`
- `audit-shots/unified-pearl-visual/results.json`

The first capture exposed a cursor that collapsed to a white dot and insufficient distinction between primary and Result Pearls. The renderer was revised with a higher-contrast subsurface cursor nucleus, exact internal crosshair, stronger curved edge, and restrained deeper celadon in the Result nucleus/nacre. A second capture was inspected at actual 18/34 px and close-up scale.

Final review:

- Flatness: absent; nucleus, two focus depths, caustic, nacre, reflected lower environment, fixed specular, and curved edge remain separable.
- White-dot collapse: absent after the cursor revision; the 18 px cursor retains its dark exact center and edge.
- Muddiness: absent at 34 px; colors remain low-chroma and depth edges remain legible on all four surroundings.
- Glow/tackiness: absent; no external light effect, saturated accent, heavy shadow, or ornamental motion is present.
- Competing UI: absent in the evidence fields; surrounding text is neutral, low contrast, still legible, and motionless.
- Optical edge: consistent and environment-aware on light, dark, colored, and text-heavy fields.
- Material consistency: all eight variants and seven states use renderer version 2.
- Reduced motion: the static optical stack is unchanged and no Pearl animation is running.

Any later capture that fails one item blocks release until the renderer and evidence are regenerated and reviewed.

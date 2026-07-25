# Visual Read — extension pearl DnD / wear (2026-07-25)

Persona: clueless first-time user. PNGs inspected with image Read (pixels), not DOM alone.

## 01-before-wear.png — PASS

- Mother Pearl is a round glossy sphere centered; five empty socket rings readable.
- Shelf dock shows a **capsule** with a real PhysicalPearl sphere (not a list-row block).
- Title truncated but recognizable (“Series A brie…”); “Drag to wear” + **WEAR** affordance clear in &lt;3s.
- No user-facing “orb” label.

## 02-after-wear.png — PASS

- Gauntlet sockets fill with small pearl spheres (world-visible wear).
- Shelf card status flips to “On gauntlet” / **WORN**.
- Instruction copy still teaches drag onto Companion / sockets ≤5.
- Detail chrome is denser after open+wear (panel view) but primary outcome remains visible.

## 03-after-reload.png — PASS

- Idle composition returns: Mother Pearl + filled socket pearls persist.
- Dock still shows worn status — findable without re-hunting.

## Residual

- Playwright did not exercise HTML5 drag gesture; Wear uses the same `wearPearlIdInGauntlet` path as socket/Mother drop.
- Manual Chrome drag remains the headed DnD residual.

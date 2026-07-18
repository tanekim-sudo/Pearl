# Lens grammar audit

Run: 2026-07-14T02:09:38.458Z

- PASS — 1000-lens rack uses bounded rendering (120 cards in DOM)
- PASS — rack search finds component/name
- PASS — queueing lenses causes zero execution
- PASS — queueing does not save compound
- PASS — pending stack shows numbered order
- PASS — card/companion stack opens explicit order preview
- PASS — saved stack is a reproducible compound
- PASS — saved output algebra predicts N×M (count=6)
- PASS — grinding tray retains full transformation pairs
- PASS — narrow viewport has no horizontal document overflow
- PASS — no page errors

## Measured contracts
- Rack rendering is capped at 120 records per selector page.
- Drag/companion stacking invariant is dragged/first A → target/second B.
- Pending brush queue does not execute or save before GO.
- Compound snapshots preserve component ids, versions, hashes, order, and N×M output count.
- Grind examples persist input, output, note, polarity, domain, source and provenance; private examples are excluded from packs by default.
# Page + node integration audit

- Checks: 12/12 passed
- Page: 768 × 1104 world units; persistent margin: 24
- Compact AI radii: 16, 18 world units
- Maximum measured visual overflow: 0.00 px
- Page errors: 0

## Results
- PASS — legacy AI migration clamps every full circle (50 nodes)
- PASS — legacy default node radii migrate to 14–18 (18, 16)
- PASS — rendered persistent footprints stay inside page (max overflow 0.00px · "none")
- PASS — compact node keeps 24px screen hit target (26.6×26.6)
- PASS — all 8 primitives identify the exact node ([{"index":0,"name":"◦\nBranch","identified":true,"didBranch":true},{"index":1,"name":"◦\nMerge","identified":true,"didBranch":true},{"index":2,"name":"◦\nDeepen","identified":true,"didBranch":true},{"index":3,"name":"◦\nChallenge","identified":true,"didBranch":true},{"index":4,"name":"◦\nEmbody","identified":true,"didBranch":true},{"index":5,"name":"⠿\ncompress\n+P\n✎\n↗","identified":true,"didBranch":true},{"index":6,"name":"⠿\nresearch\n+P\n✎\n↗","identified":true,"didBranch":true},{"index":7,"name":"⠿\nreframe\n+P\n✎\n↗","identified":true,"didBranch":true}])
- PASS — all 8 primitives branch the targeted node (8/8 · [{"index":0,"name":"◦\nBranch","identified":true,"didBranch":true},{"index":1,"name":"◦\nMerge","identified":true,"didBranch":true},{"index":2,"name":"◦\nDeepen","identified":true,"didBranch":true},{"index":3,"name":"◦\nChallenge","identified":true,"didBranch":true},{"index":4,"name":"◦\nEmbody","identified":true,"didBranch":true},{"index":5,"name":"⠿\ncompress\n+P\n✎\n↗","identified":true,"didBranch":true},{"index":6,"name":"⠿\nresearch\n+P\n✎\n↗","identified":true,"didBranch":true},{"index":7,"name":"⠿\nreframe\n+P\n✎\n↗","identified":true,"didBranch":true}])
- PASS — mixed material produces persistent highlight (3 marked)
- PASS — make node creates exactly one source
- PASS — source retains structured provenance (2 paper · 1 AI)
- PASS — successful conversion clears highlight
- PASS — 100 rapid pointer passes leave no stuck ghosts
- PASS — visible audit has no page errors

## Screenshots
- [Bounded dense page](01-bounded-50-node-page.png)
- [Exact operator target](02-operator-node-drop-target.png)
- [Mixed source node](03-mixed-source-node.png)
- [Final contract](04-final-page-contract.png)

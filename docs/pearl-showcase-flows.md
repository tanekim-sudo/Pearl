# Pearl Showcase Flows — Clueless First-Time Catalog

**Persona:** Hyper-clueless first-time user. Natural language + obvious UI only. Zero mode picker. Zero tour walls. Zero verb vocabulary from source code.

**Standard:** [pearl-stress-standard.md](./pearl-stress-standard.md) · Gap audit: [pearl-stress-clueless-gap-audit.md](./pearl-stress-clueless-gap-audit.md)  
**Harness:** `npm run stress:clueless` → `scripts/pearl-clueless-stress.mjs`  
**Inventory basis:** README + 65 feature contracts + 404 companion verbs + 132 domain commands (see gap audit appendix / explore inventory).

Every flow below must prove **world-state visibility**: a human can find the titled artifact on Reef/gauntlet/Studio/settings in a screenshot — not chat text alone, not `localStorage` alone, not `__lensOrbRuntime.execute`.

---

## Inventory summary (what exists)

| Layer | Count | Novice-reachable core |
|---|---|---|
| Feature contracts | 65 | Reef, gauntlet, Studio, encode, share, privacy, generation, remix |
| Companion verbs (app) | 283 | Talk→GO subset below; deep Studio/grind/taste often partial |
| Companion verbs (extension) | 121 | Residual unless extension loaded |
| Domain commands | 132 | Shared mutations behind verbs |

If README claims a capability works and the novice path cannot reach it, the stress run **fails** unless coverage documents a precise platform/credential limitation.

---

## Showcase flow catalog

### SF01 — Cold land → Talk → chat
| | |
|---|---|
| **Intent phrases** | (UI) visible **Talk** |
| **Surfaces** | Welcome / Reef |
| **Success world-state** | Chat input + GO hit-testable ≤1 unexplained click; no mode jargon |
| **Stress id** | `sf-cold-talk` |

### SF02 — Mother conversation → titled pearl on Reef
| | |
|---|---|
| **Intent phrases** | `make a pearl about my investor notes` |
| **Surfaces** | Companion → Reef shelf |
| **Success world-state** | Visible pearl title clearly related to investor notes (not `New pearl · …`, not Untitled/orb); director animation |
| **Stress id** | `sf-create-topic-pearl` |

### SF03 — Rename in novice speak
| | |
|---|---|
| **Intent phrases** | `change the name to Series A notes` |
| **Surfaces** | Companion → Reef label |
| **Success world-state** | Same pearl id; visible title **Series A notes** |
| **Stress id** | `sf-rename-novice` |

### SF04 — Edit / add notes
| | |
|---|---|
| **Intent phrases** | `edit it to add budget concerns` · `add budget concerns to this pearl` |
| **Surfaces** | Companion → pearl context / Studio |
| **Success world-state** | Pearl remains titled; context or output includes budget concerns (or exact blocker) |
| **Stress id** | `sf-edit-add-notes` |

### SF05 — Wear into Infinity-stone gauntlet
| | |
|---|---|
| **Intent phrases** | `wear it` · `wear this pearl` |
| **Surfaces** | Reef → gauntlet sockets |
| **Success world-state** | Socket filled ≤5; worn pearl name visible; director teaches path |
| **Stress id** | `sf-wear-gauntlet` |

### SF06 — Second pearl → merge / combine
| | |
|---|---|
| **Intent phrases** | `make a pearl about competitor signals` then `combine these pearls` / `merge them` |
| **Surfaces** | Reef |
| **Success world-state** | New titled merge pearl visible; source pearls still findable |
| **Stress id** | `sf-merge-combine` |

### SF07 — Experiment / counter / try something
| | |
|---|---|
| **Intent phrases** | `experiment with this pearl` · `try something with this pearl` |
| **Surfaces** | Reef |
| **Success world-state** | New titled counter/experiment pearl **or** exact next-phrase blocker |
| **Stress id** | `sf-experiment-counter` |

### SF08 — Synthesize / notice each other
| | |
|---|---|
| **Intent phrases** | `what do these pearls notice about each other` |
| **Surfaces** | Reef |
| **Success world-state** | New synthesis/observation pearl visible; sources intact |
| **Stress id** | `sf-synthesize-notice` |

### SF09 — Organize → Studio Moves→Functions→Lenses
| | |
|---|---|
| **Intent phrases** | `organize this pearl` then `open studio for this pearl` |
| **Surfaces** | Companion → Pearl Studio |
| **Success world-state** | Studio chrome; reading order Moves → Functions → Lenses when structure exists |
| **Stress id** | `sf-organize-studio` |

### SF10 — Role / investor superpower pearl
| | |
|---|---|
| **Intent phrases** | `make me an investor pearl` · longer S32 memo+diligence utterance |
| **Surfaces** | Reef + optional Studio + gauntlet |
| **Success world-state** | Titled investor pearl with memo/diligence structure; findable on Reef |
| **Stress id** | `sf-role-investor` |
| **Note** | One example among many — not the sole acceptance criterion |

### SF10b — Click pearl → Studio Function=ordered Moves
| | |
|---|---|
| **Intent phrases** | (UI) click reef pearl after create/role |
| **Surfaces** | Reef → Pearl Studio |
| **Success world-state** | Studio shows Functions as numbered ordered Moves; not Scene Rename/Duplicate form; drag reorder available |
| **Stress id** | `sf-click-studio-function-moves` |
| **Visual gate** | PNG Read must answer: Do I know what this pearl is? What can I do next? Can I see Functions as move sequences? |

### SF10c — Drag reorder Moves persists
| | |
|---|---|
| **Intent phrases** | (gesture) drag a Move above/below another |
| **Surfaces** | Pearl Studio |
| **Success world-state** | Order changes and survives reload |
| **Stress id** | `sf-studio-reorder-moves` |

### SF11 — Encode anything
| | |
|---|---|
| **Intent phrases** | `encode anything` · `open encode anything` |
| **Surfaces** | Encode emission |
| **Success world-state** | Encode surface visible (not dead air) |
| **Stress id** | `sf-encode-open` |

### SF12 — Version snapshot → browse → restore
| | |
|---|---|
| **Intent phrases** | `name this version Review ready` → `show version history` → `restore the Review ready version` |
| **Surfaces** | Companion + Studio/history |
| **Success world-state** | Named checkpoint listed; restore either applies with confirm or exact blocker |
| **Stress id** | `sf-version-loop` |

### SF13 — Evaluate with worn lenses
| | |
|---|---|
| **Intent phrases** | After wear: `evaluate this page with my pearls` |
| **Surfaces** | Companion / Result |
| **Success world-state** | Honest evaluation effect **or** exact credential/blocker (never fake Done) |
| **Stress id** | `sf-evaluate-gauntlet` |

### SF14 — Output Frame
| | |
|---|---|
| **Intent phrases** | `open the output frame` · UI **Open Output Frame** |
| **Surfaces** | Scene Output Frame |
| **Success world-state** | Frame open banner/chrome; Escape closes |
| **Stress id** | `sf-output-frame` |

### SF15 — Split pearl
| | |
|---|---|
| **Intent phrases** | `split this pearl` |
| **Surfaces** | Reef |
| **Success world-state** | Additional titled pearls from split **or** exact blocker |
| **Stress id** | `sf-split` |

### SF16 — Destructive clear with in-chat confirm
| | |
|---|---|
| **Intent phrases** | `clear all functions, drawings, and AI stuff` then Accept/Reject |
| **Surfaces** | Companion chat |
| **Success world-state** | Accept + Reject hit-testable; no mutation before Accept |
| **Stress id** | `sf-destructive-confirm` |

### SF17 — Go home / Reef escape
| | |
|---|---|
| **Intent phrases** | `go home` · `open the reef` |
| **Surfaces** | Any → Reef |
| **Success world-state** | Reef home visible; pearls still findable |
| **Stress id** | `sf-go-home` |

### SF18 — How Pearl works (one-line / guide)
| | |
|---|---|
| **Intent phrases** | `how does pearl work` · `show me how pearl works` |
| **Surfaces** | Guide emission |
| **Success world-state** | Guide opens; ≤ one short instructional wall |
| **Stress id** | `sf-pearl-guide` |

### SF19 — Demonstrate pearl powers (director teaching)
| | |
|---|---|
| **Intent phrases** | `show me pearl powers` · `demonstrate pearl powers` |
| **Surfaces** | Scene + director |
| **Success world-state** | Director/ghost-cursor activity; not silent teleport |
| **Stress id** | `sf-pearl-powers` |

### SF19b — Current capability demo (hands-off vision tour)
| | |
|---|---|
| **Intent phrases** | `watch what pearl can do` · `play demo` · Reef **Watch what Pearl can do** |
| **Surfaces** | Reef + Companion director (no classic Stage) |
| **Success world-state** | Ghost-cursor tour: Companion → titled Demo pearl → wear/gauntlet → Studio moves reorder → Encode glance → Install glance; disposable Demo · pearls cleaned up |
| **Stress id** | `sf-pearl-capability-demo` |
| **Docs** | Current capability demo — animation teaches where Pearl is today |

### SF20 — Packages / settings entry
| | |
|---|---|
| **Intent phrases** | `open packages` · `open settings` |
| **Surfaces** | `/packages`, Account & privacy |
| **Success world-state** | Surface loads without crash; no mode gate |
| **Stress id** | `sf-shell-packages-settings` |

### SF21 — Phone-first Companion loop (390px)
| | |
|---|---|
| **Intent phrases** | Same as SF01→SF02 at 390×844 |
| **Surfaces** | Narrow web |
| **Success world-state** | Talk→GO→visible titled pearl; chat not buried |
| **Stress id** | `sf-narrow-390-create` |

### SF22 — Reload findability
| | |
|---|---|
| **Intent phrases** | (reload after SF02/SF03) |
| **Surfaces** | Reef after reload |
| **Success world-state** | Same id + title **visible** on screen |
| **Stress id** | `sf-reload-findable` |

### SF23 — Share / handoff (honest residual if unsigned)
| | |
|---|---|
| **Intent phrases** | Export/share package path via UI or `open packages` |
| **Surfaces** | Packages / share review |
| **Success world-state** | Privacy review reachable; install of unsigned must reject; second-session restore when export works |
| **Stress id** | `sf-share-handoff` |

### SF24 — Continuity marathon (no harness reset)
| | |
|---|---|
| **Intent phrases** | create → rename → edit → wear → merge in one session |
| **Surfaces** | Companion + Reef + gauntlet |
| **Success world-state** | Each step world-visible; no privileged expand/seed between steps |
| **Stress id** | `sf-continuity-marathon` |

### SF25 — Aesthetic veto pass
| | |
|---|---|
| **Intent phrases** | (Read PNGs from SF01–SF24) |
| **Surfaces** | All |
| **Success world-state** | No untitled/orb; no illegible stack; GO/chat readable; critiques logged |
| **Stress id** | `sf-aesthetic-veto` |

---

## Creative vision flows (unique to Pearl)

These are the *kind* of product moments Pearl should showcase — stressed via the SF ids above:

1. **Mother Pearl as home** — conversation cultivates working memory pearls on the Reef (SF02).
2. **Infinity-stone gauntlet** — wear up to five ways of seeing; sixth refuses clearly (SF05).
3. **Director teaching-by-doing** — ghost cursor shows wear/merge/create instead of teleport (SF02, SF05, SF19).
4. **Composable understanding** — merge/synthesize keep individuals (SF06, SF08).
5. **Role instrument** — investor pearl as executable underwriting pack (SF10).
6. **Formation over generation** — encode/organize into M→F→L (SF09, SF11).
7. **Perception instruments** — evaluate page through worn lenses with honesty (SF13).
8. **Portable handoff** — share/package with privacy review (SF23).

---

## Capability → stress mapping (major clusters)

| Cluster | Showcase / stress | If unreachable |
|---|---|---|
| Create/edit/rename/wear/merge | SF02–SF07, SF24 | Fail |
| Synthesize/counter/split/organize/Studio | SF07–SF09, SF15 | Fail or exact blocker |
| Role pearl | SF10 | Fail |
| Encode / automation open | SF11 | Fail open; live compile may residual credentials |
| Version history | SF12 | Fail |
| Evaluate / Output Frame | SF13–SF14 | Honest blocker OK for live model |
| Destructive confirm | SF16 | Fail |
| Shell nav / guide / powers / packages / settings | SF17–SF20 | Fail |
| Narrow + reload + aesthetic | SF21–SF22, SF25 | Fail |
| Share/handoff / extension 360 / live mic / OAuth | SF23 + gap suites | Residual with cause |
| Deep Studio grind / taste / soundscape / page-canvas / CPR | Inventory residual | Document limitation; fail only if README claims novice-ready |

---

## Anti-lie (every SF row)

- Talk→type→**GO hit-test** (or obvious labeled UI)
- No `__lensOrbRuntime.execute` as pass
- No seed-as-pass / `pearls[0]` identity
- Intent-bound titles (topic tokens, not generic stamp)
- Visible on-screen artifact
- Screenshot Read may veto

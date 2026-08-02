# Pearl

A New Primitive for Intelligence

Every era of computing has been defined by a new primitive. The graphical user interface gave us the Window. The spreadsheet gave us the Cell. The web gave us the Hyperlink. Git gave us the Commit. Artificial intelligence has transformed what computers can do; it has not yet transformed how humans think with them. Pearl is an attempt to do that: not another chatbot, but the notation layer for ways of seeing on the AI metamedium — native operations on perception the way Git gave code branch, fork, merge, and diff.

This README is both the pitch and a **complete product inventory** of what ships today (docs inventory — not a runtime “production-ready app” claim). Philosophy explains why. Everything after **What ships today** is verified against:

- `shared/feature-contracts.js` (65 contracts: 59 active, 6 removed from Pearl shell)
- `client/lib/companion-capabilities.js` (Companion director verbs on web + extension; families below, not a 411-verb dump)
- `client/lib/pearl-primary-screens.js` (clueless-reachable shell screens)
- OrbUniverse / Companion / Reef / Studio / extension mounts

Contract ID → section map: [`docs/readme-coverage-audit.md`](docs/readme-coverage-audit.md). App readiness is separate from this inventory.

---

## What Pearl is (current vision)

**Mother Pearl = Companion.** Talk → type (or hold-to-speak) → **GO**. No mode picker. No tour wall. No user-facing “orb.” Confusion budget: ≤1 unexplained click to usable Talk + GO.

**A Pearl stores a system prompt** — the taste, instructions, and capability it carries. Companion **interprets** that prompt when the pearl is worn, and can **edit** it from natural language (“make this pearl about…”, “more like Plath”, “add skepticism about TAM”). Creating a pearl seeds an initial `systemPrompt` from the user’s intent (not an empty Untitled shell).

**Pearl brain harness** (`shared/pearl-prompt-harness.js`): Companion treats `systemPrompt` as the pearl’s brain. Any create/edit instruction goes through Observe → Interpret → Propose → Apply → Reveal (a Cursor-like trail in chat: Working → Interpreting → Proposed change → Applied / Blocked). Offline, edits merge locally so the path never dies as unknown-error; with model credentials, the same pipeline can rewrite the full prompt via structured JSON. Deterministic phrase parsers are optional fast-path hints — not a whitelist.

**Companion sees full pearl context** (internal): system prompt, title, purpose, Functions/Moves summary, lenses/taste, gauntlet slot, scene, privacy summary, lineage/version hints, and wear state — built by `shared/pearl-companion-context.js` and injected into planner/runtime. **Users see the prompt, not the metadata** — Studio, Reef inspector, chat, and the extension shelf hide ids, hashes, raw JSON, contract ids, storage keys, and machine privacy blobs (optional “show id” power path). Storage is unchanged.

**Reef** is home — all your pearls, spread out as physical capsules you can see, drag, wear, and open.

**Gauntlet ≤5** — up to five worn pearls as active working memory (Infinity-stone sockets). A sixth drop refuses clearly; it never silently bumps another out.

**Studio** — open a pearl to read and edit its **system prompt** as the hero field. Moves → Functions → Lenses remain available as secondary/advanced structure when present.

**Extension** — Pearl Everywhere is the page Companion: in-page Pearl, side panel, hold-to-speak, Space×3 cursor toggle, wear/DnD to gauntlet, staged stack + explicit GO, install download under `/downloads/`.

**Zero-demand.** Primary path is natural language a novice would invent (“make a pearl about my investor notes”, “wear it”, “combine these pearls”). Every successful mutation must leave a **world-visible titled artifact** on Reef, gauntlet, Studio, Encode, or Install — chat narration alone is not success.

---

## Core model

### Pearl

A Pearl is a persistent unit whose **primary field is `systemPrompt`** — the instructions Companion uses when wearing it. Around that prompt it can also carry context, optional Moves→Functions→Lenses structure, and provenance. Companion receives that full internal context; the UI surfaces title + system prompt + actions.

| Property | Meaning |
| --- | --- |
| **System prompt** | Primary: taste / instructions / capability the pearl carries (user-editable; Companion-interpreted) |
| **Memory** | Cumulative formation: conversations, sources, refinements |
| **Perspective** | Compiled way of seeing — judgment, not raw dump |
| **Capability** | Emergent ability to act (critique, underwrite, rewrite…) |
| **Provenance** | Kept in storage for Companion / recovery — not shown as a metadata form in Studio |

Pearls are formed, not merely generated. They live on the **Reef**, load into the **Gauntlet**, and open in **Studio**.

### Move · Function · Lens · Material

| Object | Role |
| --- | --- |
| **Material** | Universal envelope for text, tables, images, links, drawings, JSON — with deterministic bridges and explicit model steps when conversion needs AI |
| **Move** | One atomic action (input → output). Never contains its own step graph. Five editable **Primitive Moves** ship as a starter shelf: Branch, Merge, Deepen, Challenge, Embody |
| **Function** | Ordered (possibly branching) graph of Moves / Functions — **Functions = ordered Moves**. Checkpoint after each completed step; versions keep outputs linked to the exact Function version |
| **Lens** | Bounded way of seeing (context, priorities, perceptual model). Applied to Moves/Functions or layered; empty Lens resets prior context |

Composition algebra (preview before save): Move×Move → Function; Move/Function×Lens → Function with bound context; Lens×Lens → layered Lens. Composition stages; **GO** runs.

> Older “Generator” objects are gone. Behavior lives in Lens material, encoding, and application. Old data migrates; the name does not resurface in UI.

### Gauntlet & Reef

- **Gauntlet** — temporary active cognitive field (≤5 worn pearls). Compose perspectives for the current task.
- **Reef** — living shelf of every pearl you’ve cultivated. Attraction over folder hierarchy. Home path `/` (Library `/library` and Toolbox `/toolbox` are Reef aliases).

---

## What ships today

### Surfaces (shell navigation)

Primary screens from `pearl-primary-screens.js`. Visible Reef chrome (hit-testable): **Reef · Scene · Install · Settings · Encode · Packages**. Studio opens via pearl click or Companion.

| Screen | Path / entry | What you get |
| --- | --- | --- |
| **Reef** | `/` | Pearl home, Talk, Watch what Pearl can do, wear/drag, create |
| **Library** | `/library` | Reef alias — saved pearls & material |
| **Toolbox** | `/toolbox` | Reef alias — Moves / Functions / Lenses framing |
| **Scene** | Companion / nav | Spatial Scene (“Playing with pearls”); Output Frame optional |
| **Studio** | Click pearl / `open studio` | Single-pearl interior: M→F→L, LensTreeEditor, version history |
| **Install** | `/install` | Extension download CTA → `/downloads/lens-everywhere-chrome…` |
| **Settings** | `/settings` (emit) | Account & privacy, sign-in, sync, lock local |
| **Encode** | nav emit | Encode anything → Automation Pearl |
| **Packages** | `/packages` | Cognitive Package registry / shared tools |

Also reachable via Companion phrases such as `go home`, `open settings`, `encode anything`, `open packages`, `install the extension`, `open a new scene`, `open studio`.

### Companion (Mother Pearl)

Text and voice share one planner/director. High-confidence intents run with ghost-cursor demonstration. Ambiguous or destructive work gets an exact check-in / Accept·Reject — never fake Done. Executable commands are action-first: no praise narration as the product.

**Novice verb families** (Talk → GO; world-visible results):

| Family | Examples |
| --- | --- |
| **Navigate** | go home / open Reef, Library, Toolbox, Settings, Encode, Packages, Scene, Output Frame, Studio, Install, auth |
| **Create & cultivate** | create pearl (intent-bound title), rename, edit / add notes, duplicate, archive, delete (confirmed) |
| **Wear / gauntlet** | wear, remove worn, list/inspect gauntlet, rearrange sockets (≤5; full gauntlet refuses) |
| **Compose** | merge, compose (ordered), synthesize (“what do these notice about each other”), nest/unnest, split, counter/experiment |
| **Organize & role** | organize → M→F→L; role pearls (e.g. investor memo + diligence + lens); discover ≤5 forming pearls from chats/docs |
| **Save & learn** | `save this as…` → Move / Function / Lens chooser; `open Learn from a chat` → extract reusable artifacts; discover forming pearls |
| **Observe** | bounded workspace / screen observation (“what is visible”); interpret selection through a worn Lens — never silent scrape |
| **Evaluate** | evaluate page/deck through worn gauntlet lenses (live model needs credentials — honest blocker if missing) |
| **Critique** | start critique session → ingest spoken/typed critique → apply edits → stop; revise pearl from feedback |
| **Studio ops** | open Studio; reorder / decompose Function Moves (same `reorderStep` as LensTreeEditor) |
| **Versions** | name checkpoint, browse history, restore (Docs-style) |
| **Encode / automation** | open Encode; compile / revise / run Automation Pearl; clarification when vague |
| **Output routing** | choose destination (new tab, download, text box, cursor point, chat, Studio, keep); confirm placement once |
| **Demo / guide** | `watch what pearl can do` / `play demo`; How Pearl works; demonstrate pearl powers |
| **Privacy / share** | inspect/lock/unlock local vault; per-pearl privacy policy inspect/propose/apply; prepare/share/install Pearl packages; Cognitive Packages |
| **Appearance** | aesthetic presets / sample from screen (classic, celadon, rose, gold, ink, moonlight, coral, jade…) |
| **Power FX** | sub-agent fission/fuse, find-on-screen filaments, seek — with specificity check-ins when vague |

**Power-user search:** ⌘K / Ctrl+K opens Universal Pearl command search inside Companion (intent → verb), demoted from the cold-land path.

**Deep Cognitive Workflow Studio** (Companion: `open Cognitive Workflow Studio` / vocabulary / pull-request phrases — not a first-run CTA): higher-order patches (propose/apply), personal command vocabulary (teach / disable / forget phrases), Cognitive Pull Request extract→review→merge, Function test bench, grind drafts. Prefer Companion or Studio entry; do not assume every deep verb is on Reef chrome.

**Honesty & diagnostics:** director demonstrates the manual path when it claims to (ghost-cursor **effect status** while acting); destructive clears need in-chat Accept/Reject; plans stay cancellable with checkpoints; research must fail closed when verified browsing is unavailable. Companion exposes an **execution diagnostics** strip for blocked/failed runs this session (exact stage/code — never fake Done).

### Pearl operations (Reef / Scene / gauntlet)

- **Unified Pearl entity** — one canonical Pearl across web, Companion, and extension (`observeUnifiedPearl` / `executeUnifiedPearlAction`); sections state precise inaccessible boundaries when locked or unauthorized
- Create titled capsules (topic tokens in the visible title — not Untitled, not “orb”, not generic `New pearl · timestamp` for named topics)
- Wear via button, drag-to-socket, or Companion
- Merge / synthesize keep source individuals findable
- Counter / experiment breeds opposition with lineage
- Organize multimodal dumps into Moves → Functions → Lenses without flattening richness
- Role scaffold (investor and similar) materializes real Move/Function/Lens packs
- Semantic transfer / drop-intent: selection or drag resolves to Move, Function, or Lens without inventing a parallel editor
- Encode conversation → replayable Function inside a pearl
- Aesthetic customization on Mother Pearl and shelf pearls
- PhysicalPearl rendering across Reef, Companion, extension shelf, and result pearls
- Working **context inspector** (priority of attached material) and **library emission** areas: Actions (Moves), Processes (Functions), Context (Lenses), Shared tools, Saved spaces, Activity, Phrases (personal vocabulary), Connections, Account & privacy

### Pearl Studio

- Opens on pearl click or Companion (`open studio` / `organize this pearl`)
- Fixed reading order: **Moves → Functions → Lenses** when structure exists
- **Default Function editor = original `LensTreeEditor`**: numbered ordered Moves, drag grips, reorder persists (Companion NL reorder shares `shared/function-step-ops.js`)
- Freeform dump + Organize into structure
- Version history: name → browse → restore
- Typed cognitive layers (inspect / propose / apply / compose) when present
- Play / step / cancel Function playback with Result Pearls and checkpoints

### Scene & Output Frame

- Unbounded spatial Scene for arranging pearls (Companion + gauntlet; Studio via pearl — not classic Stage tool rails)
- Scene layout modes (Companion / scene controls): **Space · Grid · Connections · Details · Timeline**
- Optional **Output Frame** (bounded publish/print surface, e.g. 8.5×11"); Escape closes
- Paper / drawing layers, material Actions palette (save-as, learn-from-chat, export/share, organize…), and companion parity for spatial work remain on the Scene path — material actions require a continued Scene (Reef alone blocks with an exact boundary)
- Classic Stage chrome (HighlightToolbar, AiNodeCanvas branch HUD, BeforeAfter rails, LensGrammarPanels) is **not** mounted on the Pearl shell — see [Removed from Pearl shell](#removed-from-pearl-shell)

### Extension — Pearl Everywhere

Primary “intelligence travels to the page” surface:

| Capability | Behavior |
| --- | --- |
| **Page Companion** | In-page Pearl + emission (Tell Pearl your goal → GO) |
| **Hold-to-speak** | Hold Pearl to talk (site access required) |
| **Space×3** | Triple Space toggles Pearl-as-cursor on supported pages |
| **Highlighter shortcut** | `Alt+Shift+L` toggles the page highlighter; right-click selection → **Capture selection in Lens** |
| **Side panel** | Shelf as PhysicalPearl capsules, Wear, library, learning, critique sessions, packages, per-pearl privacy |
| **Gauntlet** | Same ≤5 sockets; drag MIME + Wear; full gauntlet refuses |
| **Staged stack** | Queue Moves/Functions/Lenses; **GO** is the only execution boundary |
| **Capture** | Selection, visible-tab (authorized), save as Move / Function / Lens / Save-as chooser |
| **Page canvas** | Local overlay canvas modes; bind context; undo; PDF export of chosen scope |
| **Result pearls** | Margin results: expand/collapse, redirect, accept/archive, two-stage placement |
| **Adapters** | Gmail, Notion, Outlook, Google Docs insertion where verified; else copy |
| **Soundscape** | Optional lawful audio search/upload/control (autoplay-policy aware; Archive.org / Jamendo host permissions) |
| **Options page** | Domain denylist, selection retention (session / navigation), model-data scope, API origin (dev), library import (`.lens-library.json`), delete-all extension data |
| **Web handoff** | `externally_connectable` to the Vercel app + local Vite; library import / continuation without duplicating pearls |
| **Install artifact** | `/downloads/lens-everywhere-chrome-v*.zip` and `…-latest.zip` |

Chrome first; platform-neutral core targets Firefox/Safari follow-on. Browser-protected pages, cross-origin iframes, and closed shadow roots remain hard limits. Incognito is not allowed.

### Encode, packages, settings, share

**Encode anything** — prompts, emails, links, PDFs, Drive-ish material, screen evidence → reviewable **Automation Pearl** (verbatim source mapping) before live run. Clarification when instructions are vague. Research patches are bounded, privacy-guarded, and approval-gated.

**Packages** — Cognitive Packages: signed manifest, permissions, test evidence, install/rollback/deprecate. Unsigned install must fail closed. Registry UI + `/api/cognitive-packages` publish/deprecate path.

**Settings / Account & privacy** — optional Supabase accounts (`VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY`). Without those keys the panel shows an honest blocker with exact next steps; Pearl still works locally. With keys: sign-in / sign-up / reset, anonymous local work adopts on sign-in, sync only after sign-in, passphrase lock, vault, delete-local with confirmation. Password-recovery overlay when Supabase recovery links land.

**Share** — prepare redaction/uncertainty/provenance review → scoped grant (`/api/pearl-shares`) → install verified package; revoke. Organization trust envelopes + key rotation on the server path.

**Learn from chat / forming pearls** — Companion or Learn-from-chat workspace: paste transcripts; extract Moves/Functions/Lenses; discover ≤5 already-forming pearls from recurring questions and ops; redact/exclude messages before save.

**Save-as** — selection → chooser (Move / Function / Lens, always that order). Companion `save this as…` or Scene Actions palette; extension `openExternalSaveAs`.

**Taste & generation** (Studio / extension candidates) — multi-candidate batches with distinctions (not fake quality scores), accept/reject/undecided, more-like-this, stop/retry; Taste Lenses and perceptual encoding remain inspectable (teach / evaluate-through-taste).

**Per-pearl privacy policy** — versioned policy on each Pearl (inspect / propose patch / apply); inherits on derived pearls; distinct from the account vault lock.

**Privacy by construction** — local until sign-in / export / share / disclosed GO; password & payment fields never captured by default; page text treated as untrusted data (cannot override user intent); bounded page observation on the extension.

### Demo — Watch what Pearl can do

Hands-off director tour of the **current** vision shell:

1. Reef / Welcome button **Watch what Pearl can do**, or Companion `watch what pearl can do` / `play demo` → GO  
2. Companion opens → titled disposable Demo pearl → wear → Studio Move reorder → Encode glance → Install glance → home; Demo · pearls cleaned up  
3. Stop anytime via ghost-cursor stop  

Not demoed: deleted classic Stage rails. Extension page Companion is not required for the web tour (Install glance covers download). See `docs/pearl-capability-demo.md`.

---

## Removed from Pearl shell

User-approved deletion from Pearl entry points (2026-07-25). Contract IDs kept for lineage (`status: "removed"`); **not** marketed as current product UI:

| Removed surface | Successor |
| --- | --- |
| HighlightToolbar / web highlight GO chrome | Extension page GO / page canvas |
| AiNodeCanvas + branch-chooser HUD | Studio + Companion Function branching |
| BeforeAfter learning rails | Studio LensTreeEditor / Function editing |
| LensGrammarPanels composition rails | Studio Functions + shared compose |
| Classic TopToolbar library lists under pearl shell | Studio + Companion |
| Scene “Tools” reintroducing Stage rails | Spatial Scene only |

Component files may remain for tests or non-shell hosts — **no Pearl user-facing entry**. Companion `openBeforeAfterCreation` refuses on Pearl shell and directs to Studio.

---

## Dev, stress, and release commands

```bash
npm install
cp .env.example .env
npm run dev                 # web :5173 + API :8787
npm run dev:extension
npm run build:extension
npm run package:extension   # zip → client/public/downloads/
```

Load `extension/dist/chrome` unpacked for local extension testing.

| Command | Purpose |
| --- | --- |
| `npm run stress:clueless` | Master hard-fail clueless + showcase catalog (`docs/pearl-stress-standard.md`) |
| `npm run stress:pearl` | Core Pearl stress (same integrity rules) |
| `npm run stress:gaps` | Residual gap suites |
| `npm run stress:voice` / `stress:shareability` / `stress:workflows` | Focused gap suites |
| `npm run contracts:check` | Feature-contract gate |
| `npm run graph:check` | Companion capability graph |
| `npm run release:check:fast` | Minimum ship gate |
| `npm run release:check` | Full release gate |
| `npm test` | Unit / shared / client / server tests |
| `npm run test:extension-release` | Extension package + download artifact |
| `npm run orb:matrix:check` | Preservation matrix |

Showcase flows SF01–SF25: `docs/pearl-showcase-flows.md`. Engineering policy: `docs/pearl-engineering-policy.md`. Orphan / deletion ledger: `docs/pearl-orphan-audit.md`. Function=Moves forensics: `docs/pearl-function-moves-forensics.md`.

Making a change: own feature contract → characterization test → shared command first → surface adapters → update companion manifest/graph → focused stress → `release:check`. Never delete or rename a capability without explicit approval, migration, and preservation tests.

---

## Launch ops (env)

| Variable | Required for | Notes |
| --- | --- | --- |
| `AI_GATEWAY_API_KEY` | Live organize / evaluate / synthesize / planning | Without a key, mutations must surface a precise blocker — never fake success. Vercel may use OIDC instead. |
| `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` | Optional accounts | Unset = anonymous-local + clear Account blocker; set both to enable Sign in |
| `SUPABASE_URL` + `SUPABASE_SECRET_KEY` | Server JWT / plans / extension OAuth exchange | Never in `VITE_*` |
| `VITE_LENS_EXTENSION_ID` | Web↔extension handoff | 32-char id; local `release:check` may default a placeholder |
| `VITE_CHROME_WEB_STORE_URL` | Store install CTA | Until set, `/install` shows Download + load-unpacked |

```bash
npm run build && npm start    # dist + API on :8787
npm run release:check:fast
```

---

## Limitations (honest residuals)

- Live model quality and organize/evaluate/synthesize need Gateway (or OIDC) credentials
- Live OS microphone / voice — platform permission UI; harnesses may use FakeSpeech
- Live sign-in / OAuth / multi-account adopt / signed share grants — need a real Supabase project (`VITE_SUPABASE_*` + server `SUPABASE_*`); without keys the UI blocks clearly and stays local-only
- Chrome Web Store listing URL and production extension id in the Vercel build
- Extension HTML5 DnD under Playwright is imperfect; Wear + storage asserts cover CI; real Chrome drag is manual
- Browser-protected pages, cross-origin iframes, closed shadow roots
- Serverless hobby-tier function limits
- Deep Studio AI revise inside Studio-mounted editor can residual on host handlers
- Classic Stage features listed under [Removed](#removed-from-pearl-shell) are not Pearl product paths

---

## Where to look in the code

| Concern | Owner |
| --- | --- |
| Feature ownership / release baseline | `shared/feature-contracts.js` |
| Companion manifest | `client/lib/companion-capabilities.js` |
| Primary screens | `client/lib/pearl-primary-screens.js` |
| Domain mutations / undo | `shared/domain-commands.js` |
| Move / Function / Lens model | `shared/library-objects.js` |
| Function step reorder (single algorithm) | `shared/function-step-ops.js` + `LensTreeEditor.jsx` |
| Gauntlet / wear / organize / counter / eval | `shared/companion-pearl-gauntlet.js`, `pearl-organize.js`, `pearl-counter.js`, `pearl-gauntlet-eval.js` |
| Web shell, Reef, demo | `client/components/OrbUniverseShell.jsx`, `client/lib/reef-home.js`, `pearl-capability-demo.js` |
| Studio | `PearlStudioView.jsx`, `LensTreeEditor.jsx` |
| Extension | `extension/` (content bridge, sidepanel, page-canvas, package scripts) |
| Encode / automation | `EncodeAnythingPanel.jsx`, `shared/automation-pearl.js`, `encode-evidence.js` |
| Packages / privacy / share | `cognitive-package.js`, `local-privacy-vault.js`, `pearl-sharing.js` |
| Accounts | `supabase/`, `client/lib/board-sync.js` |

Infrastructure briefly: model calls via Vercel AI Gateway (or gated fallback); accounts optional via Supabase. User-facing REST used by web + extension (not a public SDK promise): `/api/run`, `/api/generate-batch`, `/api/plan`, `/api/phase`, `/api/execute`, `/api/pipeline`, `/api/research`, `/api/lens-encode`, `/api/infer-transformation` (+ transcript/automation rewrites), `/api/share`, `/api/pearl-shares`, `/api/cognitive-packages`, `/api/extension/*` (library, auth exchange, execute, artifacts), `/api/health`, `/api/models`.

Coverage checklist (contract ID → README section): [`docs/readme-coverage-audit.md`](docs/readme-coverage-audit.md).

---

## Part I — Why this medium (philosophy)

### Medium determines thought

We think in the languages and media we inherit. McLuhan: a new medium externalizes a faculty and makes it operable. Notations — numerals, algebra’s *x*, staff lines — externalized cognitive *operations*. The computer was supposed to be Kay’s metamedium; mostly we built faster paper. Code escaped via Git’s branch, fork, merge, and diff. Writing-at-large and thought never got that — until a notation layer where ways of seeing are first-class.

### What AI actually externalizes

Not merely faster essays — the **transformation**: compress, expand, invert, translate, ground, find structure. Chat is the horseless carriage. Without operable, persistent, composable moves, every prompt rebuilds scaffolding by hand. Intelligence became cheap; structure is the bottleneck.

### Three layers should separate

**Reality** (docs, code, sites) · **Tools** (portable ways of seeing — Moves, Functions, Lenses) · **Understanding** (the Pearl). Reality stays where it belongs; tools become portable; understanding becomes persistent, composable, and executable across surfaces.

### Design principles

Reality first · Understanding over information · Cultivation over generation · Structure over fluent void · Transparency over automation · Unforcedness · Quality over quantity · Portable understanding · Composability · Reversibility.

### Long-term direction (not a ship promise)

Compare Lenses side by side; meaning-aware undo; Function test benches with fixtures; shared review of candidate branches; local-model routing for sensitive work; IDE and calendar bridges; federated registries; E2E encrypted vaults with user-held keys; marketplace of cultivated understanding. None of that changes the core contract above until it is wired and stress-proven.

---

## Epilogue

Great interfaces disappear. People stop thinking about windows and hyperlinks and start thinking through them. Pearl’s ambition is the same: users stop “using AI” and simply feel more capable of seeing, understanding, and creating — because cultivated ways of seeing finally have a native computational form.

The world is your oyster. Make pearls.

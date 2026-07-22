# Pearl

An extension-first environment for reusable cognition.

Pearl lives where your work already happens. A small in-page presence — the Pearl — watches only what you explicitly show it, does bounded, well-defined things with it, and stays put on the page instead of pulling you into a separate app. The website exists only as an overflow space: a place to go when a piece of work genuinely needs more room than a browser tab can give it.

This document is both the pitch and the contract. The first half explains why this exists and why it matters. The second half is the precise, engineering-grade specification of how it works. Nothing in the roadmap section is a promise — everything above it is.

## The pitch
### The problem: software throws your understanding away

Every tool you use bundles three different things into one product:

The content — your documents, code, messages, music, notes.
The tools — edit, summarize, translate, search, generate.
The understanding — the context, taste, and judgment you rebuild, from scratch, every single session.

The first two are solved problems. Google Docs owns documents. GitHub owns code. Spotify owns music. Every major AI product today is really just a faster way to apply the second category to the first.

Nobody has solved the third. Your understanding of a project — what you're trying to say, how you like things written, what "good" means to you in this specific context — evaporates the moment you close the tab. You re-explain yourself to every new chat, every new tool, every new day. This is the real tax on using AI today, and it's invisible because everyone pays it.

### The unbundling

Pearl's premise is that understanding shouldn't live inside any one tool. It should be its own object — one you can hold, inspect, carry, and hand to any surface that needs it.

Reality stays where it is. Pearl doesn't compete with Google Docs, GitHub, or Spotify. It doesn't try to own your content.
The companion carries the instruments. Moves, Functions, and Lenses — the atomic actions, reusable processes, and ways of seeing you build over time — travel with you across every page you visit.
Pearls carry cultivated understanding. A Pearl is a persistent, portable, composable unit of taste, memory, and technique. It's not a chat thread. It's not a prompt. It's an object you actually own.

That's a bigger ambition than "AI workspace." It's a proposal that understanding itself can become a modular, portable, composable primitive — the same way windows made computation composable, hyperlinks made knowledge composable, and Git commits made software history composable. Each of those inventions didn't add a feature; it changed what the unit of work was. Pearl is a bet that "a persistent, self-contained way of thinking" deserves to be that kind of unit.

### What a Pearl actually is, stripped of metaphor

A Pearl is a sovereign, self-contained, growing envelope that holds four things no single object in software has ever held together:

Memory — its accumulated rings of source material and history.
Perspective — a compiled way of seeing: what to notice, question, relate, preserve, or challenge.
Capability — distilled, reusable ways of acting, built from your own real instructions.
Provenance — the complete, signed history of exactly how it came to be.

Nothing else on your computer holds all four at once. A file has memory but no perspective. A prompt has intent but no persistence. A macro has capability but no judgment. A Pearl is the first object designed to hold all four together, and to keep growing as you use it.

Even the visual design takes this literally: a Pearl on screen is a small (28–36px), softly translucent object that gathers light rather than emitting it, breathes almost imperceptibly at rest, and warms subtly when it notices something worth attending to — precious by virtue of being small, never decorated for its own sake.

### Why this is the moment to build it

If Pearl is right that understanding is the missing primitive, then the interesting question isn't "what can this tool do" — it's "what does having a portable unit of cultivated understanding let a person do that they simply couldn't do before." That's a much bigger design space than another AI feature, and it's the one we intend to occupy. Every capability in this document — capture, compose, branch, remix, encode, evaluate — is a first answer to that question, not the last one.

A short list of commitments holds all of it together: work starts as material, not a mandatory chat; nothing executes without an explicit GO; sources are never silently overwritten; context is bounded and inspectable, not accumulating in the dark; and every path — pointer, keyboard, touch, voice — reaches the same outcome.

## Current surface (what's shipped today)

Verify against shared/feature-contracts.js and the generated capability graph — this is a snapshot, not the source of truth.

Web — the Reef. /, /library, and /toolbox form the pearl dashboard: mix, match, and merge Pearls without needing one "worn." Account areas live at /packages, /tasks, /settings. Overflow spatial work opens at /scene/:id; first-time setup lives at /install.

Pearl Studio. A focused single-Pearl view. Moves, then Functions, then Lenses — that's the fixed reading order. A freeform surface accepts raw multimodal material; Organize turns it into structure without flattening it. Version history is Docs-style: name a checkpoint, restore it later.

Scene + Output Frame. An unbounded canvas for spatial work, with optional bounded "Frame" regions (a fixed 8.5×11" page, for anything meant to be published or printed) for finished output. Paper, drawing/highlighter ink, AI nodes, and relationship arrows all coexist as distinct, independently-routed layers; nodes morph continuously between a compact dot and a full readable card as you zoom in. Full companion/director parity with the rest of the product.

Companion / director. A text-or-voice planner that runs on the same shared commands as everything else. It checks in when a request is genuinely ambiguous, and only ever shows a verified action — it doesn't fake one.

Extension — the primary surface. In-page Pearl plus side panel: capture, queue, preview, library, learning, critique, and a semantic-orb tray — small, persistent capsules that hold a piece of material, a selection, or a whole grouped context, and that you can rename, nest, or archive without losing their history. The 5-slot gauntlet — one mother Pearl plus up to five worn Pearls — is the companion's working memory; drag a shelf Pearl into an open socket to activate it, and a full gauntlet simply refuses a silent drop rather than bumping something out. GO is the one and only trigger for execution — staged stacks never run themselves. Triple-tap turns the Pearl itself into your literal cursor on supported pages, and heavier read/research work can spin off into an isolated, cancellable "worker" that reports back only a verified result. Staged results insert back into the page through adapters tuned per site — Gmail, Notion, Outlook, Google Docs each get their own safe insertion behavior, and anything unsupported falls back to a plain copy.

Remix and learning. Paste a chat, doc, or draft and Pearl organizes it into up to five shelf Pearls. Nine remix primitives — nest, merge, compose, synthesize, counter, organize, wear, split, encode — cover the space of things you'd want to do with two or more Pearls. "Encode Anything" turns prompts, emails, links, or before/after pairs into a reviewable Automation Pearl before it ever runs live.

Trust. A local, encrypted privacy vault; disclosure receipts for anything sensitive; bounded observation that refuses to look at password or payment fields; signature-verified Cognitive Packages for anything you share.

Known, honest limits: serverless function limits on the hobby tier, browser-protected pages, cross-origin frames, closed shadow roots, and anything that needs live model credentials.

## The core objects

Four ideas carry the entire product. Everything else is built out of them.

### Material — the universal envelope

Everything that flows in or out of a Move, Function, or Lens — text, tables, images, links, drawings, JSON — is wrapped in one common Material format, with deterministic bridges converting between compatible kinds (rich text to plain text, a table to JSON) and an explicit, never-invisible step whenever a conversion needs a model instead.

### Move — one atomic action

A single, reusable instruction: what it takes in, what it puts out, and (optionally) how it should be run. A Move can be written directly, captured from something you actually typed, inferred from examples, or promoted from ordinary use. It never contains steps of its own — for that, you want a Function. Five built-in Primitive Moves — Branch, Merge, Deepen, Challenge, Embody — ship as an editable, reorderable starter shelf you can override without losing the originals.

### Function — a reusable process

An ordered (and possibly branching) graph of Moves and other Functions, with a defined output and a checkpoint after every completed step. A Function can return more than one typed output at once, and every edit creates a new version — old outputs stay linked to the exact version that made them. Given a role like "investor" or "researcher," the companion can also propose a deep, editable Function tree as a starting point — never a hidden, identity-based shortcut.

### Lens — a way of seeing

Bounded context: source material, priorities, what to notice or ignore, and a compiled perceptual model of how to interpret things. A Lens doesn't do anything by itself — you apply it to a Move or Function, or layer it with another Lens. An empty Lens is a clean slate — the same one "new chat" uses to reset prior context — and a rich one can carry evidence, judgment, and composed layers all at once. A Lens can also be authored spatially, by arranging notes, images, and even a hand-drawn glyph and asking Pearl to name the pattern.

### Pearl — the growing envelope

The object described in the pitch above: memory, perspective, capability, and provenance, held together and growing over time. Everything else in this document exists to give Pearls somewhere to form, combine, and be used.

A note on vocabulary: an older object called "Generator" no longer exists in the product — what it used to do now lives across Lens material, Lens encoding, and Lens application. Old data migrates automatically; old names never resurface in the UI.

## The gauntlet: composing Pearls together

Every pair of these objects composes through one consistent rule set:

| Combine | Result |
| --- | --- |
| Move × Move | Function |
| Move × Function | Function |
| Function × Function | Function |
| Move/Function × Lens | Function, with the Lens bound as context |
| Lens × Lens | one layered Lens |

You always see a preview before anything is saved. Combining actions produces a clean process graph; combining Lenses merges perspective, budget, and priorities — conflicting values stay visible instead of silently blending. A later empty Lens resets whatever came before it.

The remix primitives extend this into a full vocabulary for working with two or more Pearls at once — nesting one inside another, merging them into shared context, composing them in order, breeding a deliberate counter-perspective, or splitting one back into its lineage-linked parts. None of this ever executes a model on its own. Composition only stages; GO is what runs it.

Dragging one item near a compatible other reveals a live, non-destructive Merge preview — it only arms after a short deliberate dwell and disarms if you pull away, so proximity alone never triggers anything by accident. And every drop, send, or paste anywhere in the product — onto a Move, a Function, a Lens, or plain paper — resolves through the same underlying transfer grammar, so the result is always predictable and never a silent, unexplained rejection.

A Move, Function, or Lens can also be marked portable — its domain-invariant pattern separated from the specific examples that taught it — so a workflow learned in one context (say, editing essays) can be deliberately re-applied to a different one (say, editing code) with its underlying structure intact.

## Capture and taste

Learning from ordinary use. Every instruction you give can quietly become a private event — and, with one click, a saved Move. Repeated instructions get suggested as reusable Moves automatically.

Before → after. Show Pearl one or more examples of a transformation — text, images, drawings, even counterexamples — and it infers the reusable operation behind them, with a clear confidence level and room to add more examples if the first guess is off.

Transcripts. Paste a conversation, choose what to extract — Moves, Functions, Lenses, or all three — and Pearl pulls out the repeated instructions, the workflows, and the durable context, without ever treating your private material as fair game for passive scraping.

Taste. Accept, reject, or leave a candidate output undecided, with a private reason if you want to add one. "More like this" can branch from several accepted candidates at once, carrying forward what you liked and what you didn't. Nothing about your taste becomes a hidden score — every Lens that captures it stays inspectable and editable.

Voice and drawing. Speak and sketch together in one session; strokes and speech line up automatically into one multimodal record you can turn into Lens evidence or learning material later. Nothing is retained unless you say so.

What a Lens is made of. Underneath, a Lens's "way of seeing" is a structured set of facets — what to notice, what to question, what evidence standard to hold things to, what counterexamples would disprove it — each one individually editable, priced against a context budget, and protected from being silently overwritten once you've hand-edited it.

## Generation you can actually compare

Every Move and Function can generate several candidate outputs at once, each with:

a short, honest note on how it differs from its siblings (not a quality score — a real distinction);
the model it asked for and the model it actually got;
cost and latency, when available;
your private accept/reject decision.

You can keep everything, extend just the ones you liked, stop a batch early without losing what already finished, or retry a single failed candidate without disturbing the rest. This is deliberately not a black box — every batch is a bounded, inspectable, cancellable thing that happened, not a stream you have to trust blindly.

## The companion: one voice, every surface

Text and voice go through the same planner. Simple, high-confidence requests just run. Anything more complex compiles into a visible, editable plan before a single thing changes — and every mutating step gets a checkpoint, so a bad outcome is always one step from being undone.

Four modes, chosen automatically but always overridable:

Ask — look and explain, never change anything.
Plan — build an editable plan; nothing runs until you accept it.
Agent — execute approved, low-risk, reversible steps within a stated budget.
Debug — reproduce, instrument, diagnose, fix the smallest thing that fixes it, verify, clean up.

Destructive or costly actions always get an explicit, real confirmation — never a backdrop click you can miss by accident. Every command leaves a durable trail: what was asked, what was planned, what actually happened, and exactly how to undo it.

You can also teach the companion your own shorthand — a phrase that reliably maps to a specific command — with a preview and confirmation before anything persistent is saved. And for anything that should sweep across a whole body of material rather than one item at a time, a Cognitive Pull Request runs a bounded, evidence-grounded search and returns a reviewable batch of proposed Moves, Functions, or Lenses — nothing merges until you accept it, piece by piece if you want.

## Library, versions, and sharing

Every Move, Function, and Lens lives in a searchable, filterable library — pin, archive, fork, or inspect what depends on what — and every save is a real version: branchable, forkable, mergeable, with a plain-language diff and full history intact. Bigger, cross-cutting edits can travel as a higher-order patch across several objects at once, reviewable hunk by hunk rather than as one all-or-nothing change.

Objects, Functions, and whole workflows travel through checksummed, size-bounded export bundles that exclude private examples and credentials by default. A Cognitive Package bundles a set of them together with a signed manifest — required permissions, test evidence, author signature — so anything you install or share has been verified before it runs, never just trusted on your say-so.

Day to day, everything you make also shows up in a simple chronological feed, taggable into your own "worlds" (life, startup, writing, whatever you want) — a lightweight way to find things again without a second storage system to maintain.

## Privacy, by construction

Local work stays local until you sign in, export, share, or press GO with something explicitly disclosed. Password, payment, and similar fields are never captured, by default and without asking. Anything sensitive gets a local, encrypted vault and a disclosure receipt. Nothing captured is ever sold, advertised against, or reused outside the task you asked for. Text pulled from a page or a transcript is always treated as untrusted data — instructions hidden inside it can't override what you actually told the companion to do.

## Where to look in the code

| Concern | Owner |
| --- | --- |
| Move / Function / Lens model | shared/library-objects.js |
| Cross-surface mutations, undo | shared/domain-commands.js |
| Composition rules | shared/composition-algebra.js |
| Generation, candidates, taste | shared/generation-plan.js |
| Lens perception and context | shared/lens-perceptual-model.js, shared/lens-context.js |
| Feature ownership / release baseline | shared/feature-contracts.js |
| Gauntlet, remix, evaluation | shared/pearl-gauntlet-eval.js, shared/pearl-organize.js, shared/pearl-counter.js |
| Web shell, Reef, handoff | client/components/OrbUniverseShell.jsx, client/lib/reef-home.js |
| Companion manifest | client/lib/companion-capabilities.js |
| Extension (capture, panel, gauntlet) | extension/ |
| Accounts, plans, policy | supabase/ |

Making a change: find the owning feature contract → add a characterization test before touching a shared seam → change the shared schema/command first, thin surface adapters second → preserve stable IDs and history → update the capability registry and generated graph → run the full release gate (npm run contracts:check, npm test, npm run build:extension, npm run test:extension-release, npm run release:check).

Infrastructure, briefly. All model calls route through the Vercel AI Gateway (or a narrowly-gated direct fallback) so client code never touches provider credentials; every response carries back which model was requested, which one actually ran, and at what cost. Accounts are optional and handled by Supabase — sign in later and your anonymous local work merges in rather than getting discarded. Chrome ships first, Firefox and Safari follow the same platform-neutral core. A full REST surface (/api/run, /api/generate-batch, /api/plan, /api/share, and their extension counterparts) backs both the web app and the extension identically. Nothing ships without passing accessibility, keyboard, reduced-motion, and reversible-demo checks alongside the functional ones.

## Quick start

```bash
npm install
cp .env.example .env
npm run dev
```

Web opens at localhost:5173; the API runs at localhost:8787. For the extension:

```bash
npm run dev:extension
npm run build:extension
npm run package:extension
```

Load extension/dist/chrome unpacked in Chrome for local testing.

## What's next, honestly labeled

Everything above this line is real and load-bearing. Everything below is a direction, not a promise — grouped by how close it is and what it depends on.

Building now: a tool to compare two Lenses side by side; user-facing controls over remembered taste; undo that understands meaning, not just steps; a real test bench for Functions with fixtures and regression checks.

Next up: shared review of candidate branches before merging; a Lens that notices when it should evolve; routing sensitive work to a locally-hosted model; an IDE adapter that treats code and diffs as first-class material; a calendar/meeting bridge.

Further out: federated discovery across trusted Pearl registries; forking an entire workspace to test a different approach and compare outcomes; end-to-end encrypted vaults with keys only you hold; a marketplace that pays the people who build the Pearls everyone else relies on.

None of these change the core contract above. They're what the primitive makes possible once it's real.

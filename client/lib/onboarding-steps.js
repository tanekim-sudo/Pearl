/** @typedef {'manual'|'tool'|'event'|'state'} TourVerifyKind */

/**
 * @typedef {object} TourStep
 * @property {string} id
 * @property {string} phase
 * @property {string} title
 * @property {string} instruction
 * @property {string} [hint]
 * @property {string} [target] CSS selector for spotlight
 * @property {string} [demo] demo animation key
 * @property {TourVerifyKind} verifyKind
 * @property {(ctx: TourContext, state: TourState) => boolean} [verify]
 * @property {(ctx: TourContext, state: TourState) => void} [onEnter]
 * @property {boolean} [allowSkip]
 */

/** @typedef {{ events: Set<string>, baseline: Record<string, number>, enteredAt: number }} TourContext */

/** @typedef {Record<string, unknown>} TourState */

export const TOUR_STORAGE_KEY = "lens.tour.v1";

export const TOUR_PHASES = [
  "Welcome",
  "Paper",
  "Navigate",
  "Select & transfer",
  "AI void",
  "Functions",
  "Lenses",
  "Share & worlds",
  "Extras",
];

/** @param {TourContext} ctx @param {string} name */
export function tourEvent(ctx, name) {
  ctx.events.add(name);
}

/** @returns {TourContext} */
export function createTourContext() {
  return { events: new Set(), baseline: {}, enteredAt: Date.now() };
}

/** @param {unknown[]} items */
function countInkStrokes(items) {
  return items.filter(
    (i) => /** @type {{type?: string, highlight?: boolean}} */ (i).type === "stroke" && !/** @type {{highlight?: boolean}} */ (i).highlight
  ).length;
}

/** @param {TourContext} ctx @param {TourState} state */
export function snapshotTourBaseline(ctx, state) {
  const items = /** @type {unknown[]} */ (state.items || []);
  ctx.baseline = {
    itemCount: items.length,
    strokeCount: countInkStrokes(items),
    aiNodeCount: /** @type {unknown[]} */ (state.aiNodes || []).length,
    cameraX: /** @type {{x?: number}} */ (state.camera || {}).x ?? 0,
    cameraY: /** @type {{y?: number}} */ (state.camera || {}).y ?? 0,
    cameraScale: /** @type {{scale?: number}} */ (state.camera || {}).scale ?? 1,
    aiScale: /** @type {{scale?: number}} */ (state.aiCamera || {}).scale ?? 1,
    undoCount: /** @type {number} */ (state.undoCount ?? 0),
    lensCount: /** @type {unknown[]} */ (state.lenses || []).length,
    transformationCount: /** @type {unknown[]} */ (state.operators || []).length,
  };
  ctx.enteredAt = Date.now();
  ctx.events.clear();
}

/** @param {TourStep} step @param {TourContext} ctx @param {TourState} state */
export function isStepComplete(step, ctx, state) {
  if (step.verifyKind === "manual") return true;
  if (!step.verify) return false;
  return step.verify(ctx, state);
}

/** @type {TourStep[]} */
export const TOUR_STEPS = [
  {
    id: "welcome",
    phase: "Welcome",
    title: "Two spaces, one thought",
    instruction:
      "Left is ambiguous paper — sketch, highlight, and capture ideas with no structure. Right is AI spacetime — a living web of brain cells you operate on.",
    demo: "split-pulse",
    verifyKind: "manual",
    allowSkip: true,
  },
  {
    id: "tools-bar",
    phase: "Paper",
    title: "Drawing tools",
    instruction: "Expand **Tools** at the top of the paper column. Three utensils: **↖ Select** (which also types), **✎ Pen** (with eraser), and **▬ Highlighter**.",
    target: '[data-tour="canvas-tools"]',
    demo: "pulse",
    verifyKind: "event",
    verify: (ctx) => ctx.events.has("tools-expanded"),
    onEnter: (_ctx, state) => {
      state.expandCanvasTools?.();
    },
  },
  {
    id: "pen-draw",
    phase: "Paper",
    title: "Draw freely",
    instruction: "Tap **✎ Pen** and draw a stroke anywhere on the page. One 8.5×11 sheet — zoom in for detail, the page always stays with you.",
    target: '[data-tour="tool-pen"]',
    demo: "draw-hint",
    verifyKind: "state",
    verify: (ctx, state) => {
      const count = countInkStrokes(/** @type {unknown[]} */ (state.items || []));
      return count > (ctx.baseline.strokeCount || 0);
    },
    onEnter: (_ctx, state) => {
      state.setTool?.("pen");
      state.expandCanvasTools?.();
    },
  },
  {
    id: "marker",
    phase: "Paper",
    title: "Pen ⇄ eraser",
    instruction: "Click **✎ Pen** again to flip it into the **⌫ Eraser** — one utensil, two sides. Click once more to get the pen back.",
    target: '[data-tour="canvas-tools"]',
    verifyKind: "event",
    verify: (ctx) => ctx.events.has("tool-eraser") || ctx.events.has("tool-marker"),
    allowSkip: true,
  },
  {
    id: "highlight-select",
    phase: "Paper",
    title: "Precision highlighter",
    instruction:
      "Switch to **▬ Highlight**. Every stroke adds to one living selection — loop ink, sweep across text, even mark AI nodes. **Esc** clears it.",
    hint: "Re-hover the golden glow — cursor becomes a grab hand — to drag the whole selection.",
    target: '[data-tour="tool-highlight"]',
    demo: "loop-hint",
    verifyKind: "state",
    verify: (_ctx, state) => (/** @type {unknown[]} */ (state.highlightSelection || []).length > 0),
    onEnter: (_ctx, state) => {
      state.setTool?.("highlight");
      state.expandCanvasTools?.();
    },
  },
  {
    id: "highlight-delete",
    phase: "Paper",
    title: "Delete or transfer",
    instruction:
      "With a highlight selection active, press **Delete** or **Backspace** to remove those fragments — or **drag** the golden selection across the boundary into AI.",
    verifyKind: "event",
    verify: (ctx) =>
      ctx.events.has("highlight-delete") ||
      ctx.events.has("highlight-transfer") ||
      ctx.events.has("highlight-drag"),
    allowSkip: true,
  },
  {
    id: "highlight-to-ai",
    phase: "Paper",
    title: "Highlight → AI node",
    instruction:
      "Re-hover the **golden selection** and drag across the center boundary. A preview frame follows your cursor through the glow — release on the black void to spawn **one brain cell**.",
    target: '[data-tour="interpret-boundary"]',
    demo: "highlight-drag-hint",
    verifyKind: "event",
    verify: (ctx) =>
      ctx.events.has("highlight-transfer") ||
      ctx.events.has("highlight-drag") ||
      ctx.events.has("transfer") ||
      ctx.events.has("expand-ai"),
    onEnter: (_ctx, state) => {
      state.setTool?.("highlight");
    },
    allowSkip: true,
  },
  {
    id: "space-cycle-tools",
    phase: "Paper",
    title: "Cycle utensils",
    instruction: "Press **Space** to cycle **↖ Select** → **✎ Pen** → **▬ Highlight**. Select is the default — drag objects, marquee on empty, click empty paper to type.",
    verifyKind: "event",
    verify: (ctx) => ctx.events.has("space-toggle-tool"),
    allowSkip: true,
  },
  {
    id: "text-sticky",
    phase: "Paper",
    title: "Click to type",
    instruction:
      "With **↖ Select**, click any empty spot on the page and start typing — the select cursor is the text cursor, like Google Slides. Sticky notes live in the **···** menu.",
    target: '[data-tour="tool-select"]',
    verifyKind: "event",
    verify: (ctx) => ctx.events.has("insert-text") || ctx.events.has("insert-sticky"),
    allowSkip: true,
  },
  {
    id: "image-tool",
    phase: "Paper",
    title: "Images",
    instruction: "Paste an image (**⌘V**) or drag a file from your desktop onto the page.",
    target: '[data-semantic-anchor="scene-stage"]',
    verifyKind: "event",
    verify: (ctx) => ctx.events.has("insert-image") || ctx.events.has("tool-image"),
    allowSkip: true,
  },
  {
    id: "voice-record",
    phase: "Paper",
    title: "Voice + draw",
    instruction: "Tap the **record dot** in Tools (or bottom-left). Talk while you draw — strokes link to your speech. Stop, then transfer to AI.",
    target: '[data-tour="voice-record"]',
    demo: "pulse",
    verifyKind: "event",
    verify: (ctx) => ctx.events.has("voice-started") || ctx.events.has("voice-stopped"),
    allowSkip: true,
  },
  {
    id: "pan-zoom",
    phase: "Navigate",
    title: "Move through space",
    instruction:
      "Drag **empty paper** to pan. Pinch or **⌘+scroll** to zoom. Two-finger scroll also pans. Double-click empty paper to reset zoom.",
    target: '[data-semantic-anchor="scene-stage"]',
    demo: "pan-zoom-hint",
    verifyKind: "state",
    verify: (ctx, state) => {
      const cam = /** @type {{x?: number, y?: number, scale?: number}} */ (state.camera || {});
      const b = ctx.baseline;
      return (
        ctx.events.has("paper-pan") ||
        Math.abs((cam.x ?? 0) - (b.cameraX ?? 0)) > 12 ||
        Math.abs((cam.y ?? 0) - (b.cameraY ?? 0)) > 12 ||
        Math.abs((cam.scale ?? 1) - (b.cameraScale ?? 1)) > 0.04
      );
    },
  },
  {
    id: "zoom-controls",
    phase: "Navigate",
    title: "Zoom dot",
    instruction: "Hover the **bottom-right dot** on paper for zoom − / + controls and a percentage readout.",
    target: '[data-tour="paper-zoom"]',
    verifyKind: "event",
    verify: (ctx) => ctx.events.has("zoom-control") || ctx.events.has("paper-pan"),
    allowSkip: true,
  },
  {
    id: "select-clone",
    phase: "Select & transfer",
    title: "Select and move",
    instruction:
      "With **↖ Select**, click a shape to select it and **drag from anywhere** on it to move. **Double-click** text to edit. Hold **Alt** while dragging to duplicate.",
    target: '[data-tour="tool-select"]',
    demo: "clone-hint",
    verifyKind: "event",
    verify: (ctx) => ctx.events.has("tool-select") || ctx.events.has("clone-drag"),
    onEnter: (_ctx, state) => {
      state.setTool?.("select");
      state.expandCanvasTools?.();
    },
    allowSkip: true,
  },
  {
    id: "shift-transfer",
    phase: "Select & transfer",
    title: "Shift + drag (Select tool)",
    instruction:
      "With **↖ Select** active, hold **Shift** and drag a selection toward the other column. Highlight has its own drag — no Shift needed.",
    target: '[data-tour="interpret-boundary"]',
    demo: "transfer-hint",
    verifyKind: "event",
    verify: (ctx) => ctx.events.has("transfer") || ctx.events.has("expand-ai"),
    allowSkip: true,
  },
  {
    id: "capture-chip",
    phase: "Select & transfer",
    title: "→ AI chip",
    instruction: "When something is selected, a **→ AI** chip appears above it. Drag that chip to send material across — the golden streak animates the transfer.",
    target: '[data-tour="capture-chip"]',
    verifyKind: "event",
    verify: (ctx) => ctx.events.has("transfer") || ctx.events.has("expand-ai"),
    allowSkip: true,
  },
  {
    id: "undo-redo",
    phase: "Select & transfer",
    title: "Undo & redo",
    instruction: "Hover the title bar for **↩ Undo** and **↪ Redo**. Or use **⌘Z** / **⌘⇧Z**.",
    target: '[data-tour="toolbar-actions"]',
    verifyKind: "event",
    verify: (ctx) => ctx.events.has("undo") || ctx.events.has("redo"),
    allowSkip: true,
  },
  {
    id: "ai-constellation",
    phase: "AI void",
    title: "Brain-cell constellation",
    instruction:
      "The right side is AI spacetime at rest: glowing **brain cells** connected by a universal web. This is the default view — zoom out to return here.",
    target: '[data-tour="ai-spacetime"]',
    demo: "constellation-glow",
    verifyKind: "manual",
  },
  {
    id: "strand-drag",
    phase: "AI void",
    title: "Expand outward",
    instruction:
      "When brain cells are visible, **drag outward from a cell** to branch deeper — expand, research, explore. Release on a strand to grow that thread. Moves, Functions, and Lenses live in the left column; AI only explores what you send across.",
    hint: "Tap without dragging to select. Double-click to explore.",
    target: '[data-tour="ai-spacetime"]',
    demo: "strand-fan",
    verifyKind: "event",
    verify: (ctx) => ctx.events.has("strand-drag") || ctx.events.has("strand-select") || ctx.events.has("expand-ai"),
    allowSkip: true,
  },
  {
    id: "strand-hover",
    phase: "AI void",
    title: "Web connections",
    instruction: "Hover the luminous **threads** between cells to see operation and method names on existing connections.",
    target: '[data-tour="ai-spacetime"]',
    verifyKind: "event",
    verify: (ctx) => ctx.events.has("edge-hover"),
    allowSkip: true,
  },
  {
    id: "explore-node",
    phase: "AI void",
    title: "Explore a thought",
    instruction: "**Double-click** a brain cell (or tap when zoomed in) to explore — text appears in the dark field overlay.",
    target: '[data-tour="ai-spacetime"]',
    verifyKind: "event",
    verify: (ctx) => ctx.events.has("explore-node") || ctx.events.has("ai-zoom-in"),
    allowSkip: true,
  },
  {
    id: "highlight-from-ai",
    phase: "AI void",
    title: "Drag back to paper",
    instruction:
      "Keep **▬ Highlight** on. Tap a brain cell to select it, then drag across the boundary to paper — the golden preview crosses both sides. Works the same in reverse as paper → AI.",
    target: '[data-tour="interpret-boundary"]',
    demo: "highlight-drag-hint",
    verifyKind: "event",
    verify: (ctx) =>
      ctx.events.has("transfer-to-paper") ||
      ctx.events.has("fragment-paper") ||
      ctx.events.has("highlight-drag") ||
      ctx.events.has("transfer"),
    onEnter: (_ctx, state) => {
      state.setTool?.("highlight");
    },
    allowSkip: true,
  },
  {
    id: "fragment-highlight",
    phase: "AI void",
    title: "Fragment highlight",
    instruction:
      "With Highlight active and a node explored, draw over AI text. Default release **replaces** a golden fragment in place. **Shift+release** or drag across the boundary **spawns** it on paper.",
    target: '[data-tour="ai-spacetime"]',
    verifyKind: "event",
    verify: (ctx) => ctx.events.has("fragment-highlight") || ctx.events.has("fragment-paper"),
    allowSkip: true,
  },
  {
    id: "return-constellation",
    phase: "AI void",
    title: "Return to constellation",
    instruction: "Zoom **out** past the threshold, or use the **return** control when exploring, to see the full brain-web again.",
    target: '[data-tour="ai-spacetime"]',
    verifyKind: "event",
    verify: (ctx) => ctx.events.has("return-constellation") || ctx.events.has("ai-pan"),
    allowSkip: true,
  },
  {
    id: "ai-pan-zoom",
    phase: "AI void",
    title: "Navigate the void",
    instruction: "Drag **empty starfield** to pan AI space. Same pinch / ⌘+scroll zoom as paper. Zoom out past the threshold to return to constellation.",
    target: '[data-tour="ai-spacetime"]',
    verifyKind: "state",
    verify: (ctx, state) => {
      const cam = /** @type {{scale?: number}} */ (state.aiCamera || {});
      return ctx.events.has("ai-pan") || Math.abs((cam.scale ?? 1) - (ctx.baseline.aiScale ?? 1)) > 0.04;
    },
    allowSkip: true,
  },
  {
    id: "transformations-rail",
    phase: "Functions",
    title: "Functions",
    instruction: "The upper rail holds **Functions** — reusable processes composed from Moves and other Functions. Drag any card onto paper to transform, or into AI to explore.",
    target: '[data-semantic-anchor="library-functions"]',
    demo: "pulse",
    verifyKind: "event",
    verify: (ctx) => ctx.events.has("toolbox-expanded") || ctx.events.has("lens-evolve"),
    onEnter: (_ctx, state) => {
      state.expandAiToolbox?.();
      state.setToolboxTab?.("transformations");
    },
  },
  {
    id: "create-function",
    phase: "Functions",
    title: "Create a Function",
    instruction: "Tap **+** to describe a new Function. **Click any card** to edit it; drag ⠿ onto paper to apply.",
    target: '[data-tour="create-function"]',
    verifyKind: "event",
    verify: (ctx) => ctx.events.has("open-function-editor") || ctx.events.has("create-move"),
    allowSkip: true,
  },
  {
    id: "drag-function",
    phase: "Functions",
    title: "Drag Functions",
    instruction: "Drag any **Function** from the rail onto paper (transform selection) or into AI spacetime (expand a node).",
    target: '[data-semantic-anchor="library-functions"]',
    verifyKind: "event",
    verify: (ctx) => ctx.events.has("drag-function") || ctx.events.has("expand-ai"),
    allowSkip: true,
  },
  {
    id: "edit-function",
    phase: "Functions",
    title: "Program the Function",
    instruction: "In the editor: **drag** blocks to reorder or nest steps, **⌘C/⌘V** to copy/paste subtrees, **⌘D** to fork, **⌘⇧M** to merge with the next step.",
    verifyKind: "event",
    verify: (ctx) => ctx.events.has("open-function-editor"),
    allowSkip: true,
  },
  {
    id: "lenses",
    phase: "Functions",
    title: "Versioned Functions",
    instruction: "Functions support **cognition git** — branch experiments, commit evolves, diff and merge pipelines. Fork and merge from any card's ⋯ menu.",
    target: '[data-tour="cognition-git"]',
    verifyKind: "event",
    verify: (ctx) => ctx.events.has("lens-use") || ctx.events.has("lens-evolve"),
    allowSkip: true,
  },
  {
    id: "pattern-lenses",
    phase: "Lenses",
    title: "Lenses",
    instruction: "The lower rail holds **Lenses** — bounded contexts for collecting and arranging material. Drag highlighted material there and select what should inform later actions.",
    target: '[data-semantic-anchor="library-lenses"]',
    verifyKind: "event",
    verify: (ctx) => ctx.events.has("lenses-tab") || ctx.events.has("save-structure"),
    allowSkip: true,
  },
  {
    id: "page-tabs",
    phase: "Share & worlds",
    title: "Worlds",
    instruction: "**World tabs** at the top switch between pages — each keeps its own camera and content. **+** adds a world; double-click a tab to rename.",
    target: '[data-semantic-anchor="scene-stage"]',
    verifyKind: "event",
    verify: (ctx) => ctx.events.has("page-switch") || ctx.events.has("page-add"),
    allowSkip: true,
  },
  {
    id: "share-export",
    phase: "Share & worlds",
    title: "Share & export",
    instruction: "Use **↗ Share** in the title bar, or **Menu ···** for export as text/markdown, import paths, and theme toggle.",
    target: '[data-tour="toolbar-menu"]',
    verifyKind: "event",
    verify: (ctx) => ctx.events.has("share") || ctx.events.has("export"),
    allowSkip: true,
  },
  {
    id: "history-replay",
    phase: "Extras",
    title: "Operator stages",
    instruction: "Select any object and tap **◷** to see which Moves and Functions were applied — no motion, just the thread.",
    verifyKind: "event",
    verify: (ctx) => ctx.events.has("history-replay"),
    allowSkip: true,
  },
  {
    id: "gestures-ref",
    phase: "Extras",
    title: "Hidden gestures",
    instruction:
      "**Space** = cycle Pen / Highlight / Select · **Highlight drag** = bidirectional boundary transfer (grab golden selection) · **Shift+drag** = Select-tool transfer · **Shift+lasso** = area select · **Alt+drag** = pan · **⌘V** = paste",
    verifyKind: "event",
    verify: (ctx) => ctx.events.has("space-toggle-tool"),
    allowSkip: true,
  },
  {
    id: "complete",
    phase: "Extras",
    title: "You're ready",
    instruction: "Every feature is wired — nothing hidden, only gestural. Reopen this tour anytime from **Menu → Feature tour**.",
    demo: "complete-glow",
    verifyKind: "manual",
  },
];

export function getPhaseIndex(phase) {
  return TOUR_PHASES.indexOf(phase);
}

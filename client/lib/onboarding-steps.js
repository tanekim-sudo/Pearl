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
  "Scene",
  "Navigate",
  "Capture & arrange",
  "Output Frame",
  "Functions",
  "Lenses",
  "Share & Scenes",
  "Reference",
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
    title: "Begin with something you noticed.",
    instruction:
      "Select or add material in the Scene, tell Pearl what you want, and review the result in the Output Frame before choosing where it goes.",
    demo: "split-pulse",
    verifyKind: "manual",
    allowSkip: true,
  },
  {
    id: "tools-bar",
    phase: "Scene",
    title: "Drawing tools",
    instruction: "Expand **Tools** at the top of the Scene. Three utensils: **↖ Select** (which also types), **✎ Pen** (with eraser), and **▬ Highlighter**.",
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
    phase: "Scene",
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
    phase: "Scene",
    title: "Pen ⇄ eraser",
    instruction: "Click **✎ Pen** again to flip it into the **⌫ Eraser** — one utensil, two sides. Click once more to get the pen back.",
    target: '[data-tour="canvas-tools"]',
    verifyKind: "event",
    verify: (ctx) => ctx.events.has("tool-eraser") || ctx.events.has("tool-marker"),
    allowSkip: true,
  },
  {
    id: "highlight-select",
    phase: "Scene",
    title: "Precision highlighter",
    instruction:
      "Switch to **▬ Highlight**. Every stroke adds to one living selection — loop ink, sweep across text, even mark Output Frame results. **Esc** clears it.",
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
    phase: "Scene",
    title: "Delete or transfer",
    instruction:
      "With a highlight selection active, press **Delete** or **Backspace** to remove those fragments — or **drag** the golden selection into the Output Frame.",
    verifyKind: "event",
    verify: (ctx) =>
      ctx.events.has("highlight-delete") ||
      ctx.events.has("highlight-transfer") ||
      ctx.events.has("highlight-drag"),
    allowSkip: true,
  },
  {
    id: "highlight-to-ai",
    phase: "Scene",
    title: "Highlight → Output Frame",
    instruction:
      "Drag the **golden selection** across the visible boundary. A preview follows the pointer; release in the Output Frame to create one source-linked candidate node.",
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
    phase: "Scene",
    title: "Cycle utensils",
    instruction: "Press **Space** to cycle **↖ Select** → **✎ Pen** → **▬ Highlight**. Select is the default — drag objects, marquee on empty, click the Scene to type.",
    verifyKind: "event",
    verify: (ctx) => ctx.events.has("space-toggle-tool"),
    allowSkip: true,
  },
  {
    id: "text-sticky",
    phase: "Scene",
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
    phase: "Scene",
    title: "Images",
    instruction: "Paste an image (**⌘V**) or drag a file from your desktop onto the page.",
    target: '[data-semantic-anchor="scene-stage"]',
    verifyKind: "event",
    verify: (ctx) => ctx.events.has("insert-image") || ctx.events.has("tool-image"),
    allowSkip: true,
  },
  {
    id: "voice-record",
    phase: "Scene",
    title: "Voice + draw",
    instruction: "Tap the **record dot** in Tools (or bottom-left). Talk while you draw — strokes link to your speech. Stop, then transfer to the Output Frame.",
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
      "Drag an **empty part of the Scene** to pan. Pinch or **⌘+scroll** to zoom. Two-finger scroll also pans. Double-click empty space to reset zoom.",
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
    instruction: "Use the **bottom-right Scene control** for zoom − / + and a percentage readout.",
    target: '[data-tour="paper-zoom"]',
    verifyKind: "event",
    verify: (ctx) => ctx.events.has("zoom-control") || ctx.events.has("paper-pan"),
    allowSkip: true,
  },
  {
    id: "select-clone",
    phase: "Capture & arrange",
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
    phase: "Capture & arrange",
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
    phase: "Capture & arrange",
    title: "Make a pearl",
    instruction: "With material highlighted, choose the visible pearl action to preserve it as a source-linked semantic capsule. Creation comes before optional shaping or generation.",
    verifyKind: "event",
    verify: (ctx) => ctx.events.has("transfer") || ctx.events.has("expand-ai"),
    allowSkip: true,
  },
  {
    id: "undo-redo",
    phase: "Capture & arrange",
    title: "Undo & redo",
    instruction: "Hover the title bar for **↩ Undo** and **↪ Redo**. Or use **⌘Z** / **⌘⇧Z**.",
    target: '[data-tour="toolbar-actions"]',
    verifyKind: "event",
    verify: (ctx) => ctx.events.has("undo") || ctx.events.has("redo"),
    allowSkip: true,
  },
  {
    id: "ai-constellation",
    phase: "Output Frame",
    title: "Candidate constellation",
    instruction:
      "The Output Frame shows generated candidates and their source-linked relationships. Nothing is inserted until you choose a result action.",
    target: '[data-tour="ai-spacetime"]',
    demo: "constellation-glow",
    verifyKind: "manual",
  },
  {
    id: "strand-drag",
    phase: "Output Frame",
    title: "Expand outward",
    instruction:
      "When candidate nodes are visible, **drag outward from a node** to branch deeper. Moves and Functions act on explicit material; Lenses provide bounded context.",
    hint: "Tap without dragging to select. Double-click to explore.",
    target: '[data-tour="ai-spacetime"]',
    demo: "strand-fan",
    verifyKind: "event",
    verify: (ctx) => ctx.events.has("strand-drag") || ctx.events.has("strand-select") || ctx.events.has("expand-ai"),
    allowSkip: true,
  },
  {
    id: "strand-hover",
    phase: "Output Frame",
    title: "Web connections",
    instruction: "Hover the luminous **threads** between cells to see operation and method names on existing connections.",
    target: '[data-tour="ai-spacetime"]',
    verifyKind: "event",
    verify: (ctx) => ctx.events.has("edge-hover"),
    allowSkip: true,
  },
  {
    id: "explore-node",
    phase: "Output Frame",
    title: "Explore a thought",
    instruction: "**Double-click** a candidate node (or tap when zoomed in) to inspect its text and provenance in the Output Frame.",
    target: '[data-tour="ai-spacetime"]',
    verifyKind: "event",
    verify: (ctx) => ctx.events.has("explore-node") || ctx.events.has("ai-zoom-in"),
    allowSkip: true,
  },
  {
    id: "highlight-from-ai",
    phase: "Output Frame",
    title: "Place back in the Scene",
    instruction:
      "Keep **▬ Highlight** on. Select a candidate node, then use the visible transfer control to materialize it in the Scene. The preview preserves its source link.",
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
    phase: "Output Frame",
    title: "Fragment highlight",
    instruction:
      "With Highlight active and a result explored, draw over its text. Default release **replaces** a golden fragment in place. **Shift+release** or drag across the boundary places it in the Scene.",
    target: '[data-tour="ai-spacetime"]',
    verifyKind: "event",
    verify: (ctx) => ctx.events.has("fragment-highlight") || ctx.events.has("fragment-paper"),
    allowSkip: true,
  },
  {
    id: "return-constellation",
    phase: "Output Frame",
    title: "Return to constellation",
    instruction: "Zoom **out** past the threshold, or use the **return** control when exploring, to see the full brain-web again.",
    target: '[data-tour="ai-spacetime"]',
    verifyKind: "event",
    verify: (ctx) => ctx.events.has("return-constellation") || ctx.events.has("ai-pan"),
    allowSkip: true,
  },
  {
    id: "ai-pan-zoom",
    phase: "Output Frame",
    title: "Navigate the Output Frame",
    instruction: "Drag **empty Output Frame space** to pan. Use the same pinch / ⌘+scroll zoom as the Scene. Zoom out past the threshold to return to the constellation.",
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
    instruction: "The upper rail holds **Functions** — reusable processes composed from Moves and other Functions. Drag a card onto Scene material to transform it, or into the Output Frame to explore.",
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
    instruction: "Tap **+** to describe a new Function. **Click any card** to edit it; drag ⠿ onto Scene material to apply.",
    target: '[data-tour="create-function"]',
    verifyKind: "event",
    verify: (ctx) => ctx.events.has("open-function-editor") || ctx.events.has("create-move"),
    allowSkip: true,
  },
  {
    id: "drag-function",
    phase: "Functions",
    title: "Drag Functions",
    instruction: "Drag any **Function** from the rail onto selected Scene material to transform it, or into the Output Frame to expand a candidate node.",
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
    phase: "Share & Scenes",
    title: "Scenes",
    instruction: "**Scene tabs** switch between durable workspaces — each keeps its own camera, material, candidates, and Output Frames. **+** adds a Scene; double-click a tab to rename.",
    target: '[data-semantic-anchor="scene-stage"]',
    verifyKind: "event",
    verify: (ctx) => ctx.events.has("page-switch") || ctx.events.has("page-add"),
    allowSkip: true,
  },
  {
    id: "share-export",
    phase: "Share & Scenes",
    title: "Share & export",
    instruction: "Use **↗ Share** in the title bar, or **Menu ···** for export as text/markdown, import paths, and theme toggle.",
    target: '[data-tour="toolbar-menu"]',
    verifyKind: "event",
    verify: (ctx) => ctx.events.has("share") || ctx.events.has("export"),
    allowSkip: true,
  },
  {
    id: "history-replay",
    phase: "Reference",
    title: "Operator stages",
    instruction: "Select any object and tap **◷** to see which Moves and Functions were applied — no motion, just the thread.",
    verifyKind: "event",
    verify: (ctx) => ctx.events.has("history-replay"),
    allowSkip: true,
  },
  {
    id: "gestures-ref",
    phase: "Reference",
    title: "Optional shortcuts",
    instruction:
      "Every primary action has a visible control. Optional shortcuts: **Space** cycles tools · **Shift+drag** transfers with Select · **Alt+drag** pans · **⌘V** pastes.",
    verifyKind: "event",
    verify: (ctx) => ctx.events.has("space-toggle-tool"),
    allowSkip: true,
  },
  {
    id: "complete",
    phase: "Reference",
    title: "You're ready",
    instruction: "Primary actions remain visible and keyboard reachable. Reopen this tour anytime from **Menu → Feature tour**.",
    demo: "complete-glow",
    verifyKind: "manual",
  },
];

export function getPhaseIndex(phase) {
  return TOUR_PHASES.indexOf(phase);
}

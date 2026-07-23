/**
 * Canonical "How Pearl works" guide content shared by the web app and the
 * extension side panel. Every entry teaches a real, reachable capability and
 * names the exact gesture or command that performs it, so discoverability
 * never drifts from the runtime.
 */
export const PEARL_GUIDE_VERSION = 1;
export const PEARL_GUIDE_STORAGE_KEY = "lens.pearl.guide.v1";
export const PEARL_WELCOME_STORAGE_KEY = "lens.pearl.welcome.v1";

export const PEARL_GUIDE_SECTIONS = Object.freeze([
  Object.freeze({
    id: "begin",
    title: "Begin with the pearl",
    summary: "Pearl is one small companion. Everything starts by talking to it — or by importing what you already have.",
    platforms: Object.freeze(["app", "extension"]),
    items: Object.freeze([
      Object.freeze({ id: "ask", label: "Ask for anything", detail: "Click the pearl and type a goal in plain language.", gesture: "Click the pearl", command: null }),
      Object.freeze({ id: "speak", label: "Speak instead", detail: "Press and hold the pearl to talk. Release to send.", gesture: "Hold the pearl", command: null }),
      Object.freeze({ id: "encode", label: "Import or encode material", detail: "Paste a chat, email, PDF, Drive link, or Pitchbook/Affinity export. Pearl compiles a reviewable Automation Pearl.", gesture: "Pearl → Encode anything", command: "encode anything" }),
      Object.freeze({ id: "search", label: "Find every action", detail: "Search all Pearl actions by intent, from anywhere.", gesture: "Press ⌘K or Ctrl+K", command: null }),
      Object.freeze({ id: "drop", label: "Give it material", detail: "Drag text, notes, or a Lens onto the pearl to add bounded context.", gesture: "Drop onto the pearl", command: null }),
      Object.freeze({ id: "account", label: "Sign in and privacy", detail: "Open Account & privacy from the pearl halo. Pearls stay local unless you enable sync.", gesture: "Pearl → Account & privacy", command: "open account and privacy" }),
    ]),
  }),
  Object.freeze({
    id: "scenes",
    title: "Scenes hold your work",
    summary: "A Scene is a spatial working set. Nothing is created until you choose it.",
    platforms: Object.freeze(["app"]),
    items: Object.freeze([
      Object.freeze({ id: "new-scene", label: "Start a Scene", detail: "Ask the pearl for a new space to work in.", gesture: null, command: "open a new scene" }),
      Object.freeze({ id: "make-pearl", label: "Place a pearl", detail: "Double-click empty stage to create a semantic pearl there.", gesture: "Double-click the stage", command: null }),
      Object.freeze({ id: "views", label: "Change the view", detail: "See the same material as space, grid, connections, details, or sequence.", gesture: null, command: "show me the scene controls" }),
      Object.freeze({ id: "undo", label: "Undo and redo", detail: "Every pearl effect keeps a checkpoint you can step back through.", gesture: "Undo from the pearl ledger", command: null }),
    ]),
  }),
  Object.freeze({
    id: "studio",
    title: "Pearl Studio",
    summary: "Triple-click opens a focused single-pearl view ordered Moves → Functions → Lenses.",
    platforms: Object.freeze(["app"]),
    items: Object.freeze([
      Object.freeze({ id: "open-studio", label: "Open Studio", detail: "Triple-click the pearl, or focus it and press Shift+Enter. Studio shows Moves (transformations), then Functions (compositions), then Lenses (context and understanding).", gesture: "Triple-click the pearl", command: null }),
    ]),
  }),
  Object.freeze({
    id: "reef",
    title: "Reef — home dashboard",
    summary: "The Reef is home: every pearl spread out so you can mix, match, and merge.",
    platforms: Object.freeze(["app"]),
    items: Object.freeze([
      Object.freeze({ id: "open-reef", label: "Go to the Reef", detail: "Ask Pearl to go home or open the Reef. Touch pearls to open their Scene, or ask the companion to merge and rearrange.", gesture: null, command: "open the reef" }),
      Object.freeze({ id: "save-as", label: "Save a selection", detail: "Keep any selection as a Move, Function, or Lens — always in that order.", gesture: null, command: "save this as…" }),
    ]),
  }),
  Object.freeze({
    id: "everywhere",
    title: "Pearl on every page",
    summary: "The browser extension carries the same companion onto any website.",
    platforms: Object.freeze(["app"]),
    items: Object.freeze([
      Object.freeze({ id: "install", label: "Get the extension", detail: "Install Pearl for Chrome, then select material on any page.", gesture: null, command: "install the extension" }),
    ]),
  }),
  Object.freeze({
    id: "capture",
    title: "Notice page material",
    summary: "Pearl only works with material you explicitly select.",
    platforms: Object.freeze(["extension"]),
    items: Object.freeze([
      Object.freeze({ id: "capture-selection", label: "Capture a selection", detail: "Select text on the page, then ask Pearl to capture it.", gesture: null, command: "capture the selection" }),
      Object.freeze({ id: "make-pearl", label: "Keep it as a pearl", detail: "Preserve captured material with its source link.", gesture: null, command: "make a pearl from this" }),
    ]),
  }),
  Object.freeze({
    id: "go",
    title: "Stage, then GO",
    summary: "Capture the command (seeded actions + gauntlet pearls), then fire once. Nothing high-impact runs until GO.",
    platforms: Object.freeze(["extension"]),
    items: Object.freeze([
      Object.freeze({ id: "preview", label: "Preview first", detail: "See what the pending stack will produce before it runs.", gesture: null, command: "preview the stack" }),
      Object.freeze({ id: "press-go", label: "Press GO →", detail: "Fire with the GO button, Enter, or voice “go”. Execution uses the current gauntlet working-memory stack.", gesture: "Enter", command: "go" }),
      Object.freeze({ id: "gauntlet", label: "Gauntlet stack", detail: "Pearls rest on the shelf. Drag up to five into sockets around the companion; drag out to unload. Full sockets refuse a sixth.", gesture: "Drag pearl ↔ socket", command: "load the research pearl into the gauntlet" }),
      Object.freeze({ id: "insert", label: "Place a result", detail: "The page never changes automatically; you choose insert, replace, or copy.", gesture: null, command: "insert the latest result" }),
    ]),
  }),
  Object.freeze({
    id: "import-pearls",
    title: "Import anything → ≤5 pearls",
    summary: "Paste chats, docs, or drafts. Pearl finds recurring questions, prompts, ops, and frames — at most five organized pearls.",
    platforms: Object.freeze(["extension", "app"]),
    items: Object.freeze([
      Object.freeze({ id: "discover", label: "Discover forming pearls", detail: "Each pearl is organized Moves → Functions → Lenses so the encoding advantage is obvious.", gesture: null, command: "import this chat and find the pearls that were already forming" }),
    ]),
  }),
  Object.freeze({
    id: "privacy",
    title: "Privacy stays explicit",
    summary: "Work is local-first. Nothing syncs or leaves without your say.",
    platforms: Object.freeze(["app", "extension"]),
    items: Object.freeze([
      Object.freeze({ id: "inspect", label: "See what is stored", detail: "Ask what Pearl keeps on this device at any time.", gesture: null, command: "what is stored here?" }),
    ]),
  }),
]);

export function guideSectionsFor(platform = "app") {
  return PEARL_GUIDE_SECTIONS.filter((section) => section.platforms.includes(platform));
}

export function normalizePearlGuideRecord(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  return {
    version: PEARL_GUIDE_VERSION,
    opens: Number.isFinite(value.opens) && value.opens >= 0 ? Math.floor(value.opens) : 0,
    lastOpenedAt: typeof value.lastOpenedAt === "string" ? value.lastOpenedAt : null,
  };
}

export function recordPearlGuideOpen(raw, at = new Date().toISOString()) {
  const current = normalizePearlGuideRecord(raw);
  return { ...current, opens: current.opens + 1, lastOpenedAt: at };
}

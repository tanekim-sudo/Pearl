/**
 * Canonical "How Pearl works" guide content shared by the web app and the
 * extension side panel. Every entry teaches a real, reachable capability and
 * names the exact gesture or command that performs it, so discoverability
 * never drifts from the runtime.
 *
 * Product model: Companion Pearl (mother) is the only interface you talk to.
 * Other pearls are context add-ons that load into the gauntlet (≤5 sockets).
 */
export const PEARL_GUIDE_VERSION = 1;
export const PEARL_GUIDE_STORAGE_KEY = "lens.pearl.guide.v1";
export const PEARL_WELCOME_STORAGE_KEY = "lens.pearl.welcome.v1";

export const PEARL_GUIDE_SECTIONS = Object.freeze([
  Object.freeze({
    id: "begin",
    title: "Begin with the Companion",
    summary: "The Companion Pearl is your interface. Click it, type what you want, press GO — it can navigate, create, organize, wear, merge, and more.",
    platforms: Object.freeze(["app", "extension"]),
    items: Object.freeze([
      Object.freeze({ id: "ask", label: "Ask for anything", detail: "Click the Companion, type a goal in plain language, then press GO.", gesture: "Click Companion → type → GO", command: null }),
      Object.freeze({ id: "speak", label: "Speak instead", detail: "Press and hold the Companion to talk. Release to send.", gesture: "Hold the Companion", command: null }),
      Object.freeze({ id: "gauntlet", label: "Load context pearls", detail: "Up to five context pearls fit in the gauntlet around the Companion — active working memory, not rival companions.", gesture: "Drag pearl ↔ socket", command: "load the research pearl into the gauntlet" }),
      Object.freeze({ id: "encode", label: "Import or encode material", detail: "Paste a chat, email, PDF, Drive link, or Pitchbook/Affinity export. The Companion compiles a reviewable Automation Pearl.", gesture: "Companion → Encode anything", command: "encode anything" }),
      Object.freeze({ id: "search", label: "Find every action", detail: "Search all Companion actions by intent, from anywhere.", gesture: "Press ⌘K or Ctrl+K", command: null }),
      Object.freeze({ id: "drop", label: "Give it material", detail: "Drag text, notes, or a Lens onto the Companion to add bounded context.", gesture: "Drop onto the Companion", command: null }),
      Object.freeze({ id: "account", label: "Sign in and privacy", detail: "Open Account & privacy from the Companion halo. Pearls stay local unless you enable sync.", gesture: "Companion → Account & privacy", command: "open account and privacy" }),
    ]),
  }),
  Object.freeze({
    id: "scenes",
    title: "Scene — overflow workspace",
    summary: "A Scene is an optional canvas for arranging pearls and material. Start from the Companion; open a Scene only when you need space.",
    platforms: Object.freeze(["app"]),
    items: Object.freeze([
      Object.freeze({ id: "new-scene", label: "Open a workspace", detail: "Ask the Companion for a new Scene when you need a canvas.", gesture: null, command: "open a new scene" }),
      Object.freeze({ id: "make-pearl", label: "Place a context pearl", detail: "Double-click empty stage to create a context pearl there — then wear it into the gauntlet when you need it.", gesture: "Double-click the stage", command: null }),
      Object.freeze({ id: "views", label: "Change the view", detail: "See the same material as space, grid, connections, details, or sequence.", gesture: null, command: "show me the scene controls" }),
      Object.freeze({ id: "undo", label: "Undo and redo", detail: "Every pearl effect keeps a checkpoint you can step back through.", gesture: "Undo from the Companion ledger", command: null }),
    ]),
  }),
  Object.freeze({
    id: "studio",
    title: "Pearl Studio — overflow tools",
    summary: "Triple-click opens overflow editing for one context pearl (Moves → Functions → Lenses). Studio is a detail tool, not home.",
    platforms: Object.freeze(["app"]),
    items: Object.freeze([
      Object.freeze({ id: "open-studio", label: "Open Studio", detail: "Triple-click the Companion, or focus it and press Shift+Enter. Studio shows Moves, then Functions, then Lenses for the active pearl.", gesture: "Triple-click the Companion", command: null }),
    ]),
  }),
  Object.freeze({
    id: "reef",
    title: "Reef — shelf of context pearls",
    summary: "The Reef is your library shelf: saved context pearls you can equip into the Companion’s gauntlet. It is not a second control center.",
    platforms: Object.freeze(["app"]),
    items: Object.freeze([
      Object.freeze({ id: "open-reef", label: "Go to the Reef", detail: "Ask the Companion to go home. Open a pearl card to its Scene, or ask the Companion to wear, merge, or rearrange.", gesture: null, command: "open the reef" }),
      Object.freeze({ id: "save-as", label: "Save a selection", detail: "Keep any selection as a Move, Function, or Lens — always in that order.", gesture: null, command: "save this as…" }),
    ]),
  }),
  Object.freeze({
    id: "everywhere",
    title: "Companion on every page",
    summary: "The browser extension carries the same Companion Pearl onto any website.",
    platforms: Object.freeze(["app"]),
    items: Object.freeze([
      Object.freeze({ id: "install", label: "Get the extension", detail: "Install Pearl for Chrome, then select material on any page.", gesture: null, command: "install the extension" }),
    ]),
  }),
  Object.freeze({
    id: "capture",
    title: "Notice page material",
    summary: "The Companion only works with material you explicitly select.",
    platforms: Object.freeze(["extension"]),
    items: Object.freeze([
      Object.freeze({ id: "capture-selection", label: "Capture a selection", detail: "Select text on the page, then ask the Companion to capture it.", gesture: null, command: "capture the selection" }),
      Object.freeze({ id: "make-pearl", label: "Keep it as a context pearl", detail: "Preserve captured material with its source link, then drag it into a gauntlet socket when you need it.", gesture: null, command: "make a pearl from this" }),
    ]),
  }),
  Object.freeze({
    id: "go",
    title: "Stage, then GO",
    summary: "Capture the command (seeded actions + gauntlet context pearls), then fire once. Nothing high-impact runs until GO.",
    platforms: Object.freeze(["extension"]),
    items: Object.freeze([
      Object.freeze({ id: "preview", label: "Preview first", detail: "See what the pending stack will produce before it runs.", gesture: null, command: "preview the stack" }),
      Object.freeze({ id: "press-go", label: "Press GO →", detail: "Fire with the GO button, Enter, or voice “go”. Execution uses the current gauntlet working-memory stack.", gesture: "Enter", command: "go" }),
      Object.freeze({ id: "gauntlet", label: "Gauntlet stack", detail: "Context pearls rest on the shelf. Drag up to five into sockets around the Companion; drag out to unload. Full sockets refuse a sixth.", gesture: "Drag pearl ↔ socket", command: "load the research pearl into the gauntlet" }),
      Object.freeze({ id: "insert", label: "Place a result", detail: "The page never changes automatically; you choose insert, replace, or copy.", gesture: null, command: "insert the latest result" }),
    ]),
  }),
  Object.freeze({
    id: "import-pearls",
    title: "Import anything → ≤5 context pearls",
    summary: "Paste chats, docs, or drafts. The Companion finds recurring questions, prompts, ops, and frames — at most five organized context pearls for the shelf.",
    platforms: Object.freeze(["extension", "app"]),
    items: Object.freeze([
      Object.freeze({ id: "discover", label: "Discover forming pearls", detail: "Each context pearl is organized Moves → Functions → Lenses so the encoding advantage is obvious. Equip any into the gauntlet when you need it.", gesture: null, command: "import this chat and find the pearls that were already forming" }),
    ]),
  }),
  Object.freeze({
    id: "privacy",
    title: "Privacy stays explicit",
    summary: "Work is local-first. Nothing syncs or leaves without your say.",
    platforms: Object.freeze(["app", "extension"]),
    items: Object.freeze([
      Object.freeze({ id: "inspect", label: "See what is stored", detail: "Ask what the Companion keeps on this device at any time.", gesture: null, command: "what is stored here?" }),
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

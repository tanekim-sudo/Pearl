/**
 * Companion demo library — hand-encoded director scripts that demonstrate
 * every layer and feature combination. The companion plays these for
 * "how do I…" questions and for first-run onboarding.
 */

export const COMPANION_DEMOS = [
  {
    id: "three-layers",
    title: "The three layers",
    blurb: "functions rail, paper page, AI space — what each is for",
    keywords: ["layer", "layout", "column", "space", "overview", "start", "what is", "tour"],
    steps: [
      { verb: "caption", args: { text: "lens has three layers. the middle is your paper — one page, like a real sheet.", ms: 2600 } },
      { verb: "fitPaper", args: {} },
      { verb: "caption", args: { text: "the left rail holds your functions — reusable ways of transforming ideas.", ms: 2400 } },
      { verb: "showLenses", args: { caption: "below them, lenses: symbols and saved ways of seeing." } },
      { verb: "caption", args: { text: "the right side is the AI space — every transformation blooms there first, and you drag back what you want to keep.", ms: 3000 } },
    ],
  },
  {
    id: "first-idea",
    title: "Put down an idea and transform it",
    blurb: "spawn a thought on paper and apply a built-in move",
    keywords: ["idea", "first", "begin", "transform", "apply", "invert", "text", "write"],
    steps: [
      { verb: "caption", args: { text: "click anywhere on the page and type — that's a thought.", ms: 2000 } },
      { verb: "spawnText", args: { text: "Forgiveness is the controlled release of pressure", saveAs: "idea" } },
      { verb: "caption", args: { text: "now drag a move from the rail onto it.", ms: 1800 } },
      { verb: "applyFunction", args: { op: "invert", target: "idea" } },
      { verb: "focusAiResult", args: {} },
      { verb: "caption", args: { text: "nothing touched your paper — results live in the AI space until you pull them across.", ms: 2600 } },
    ],
  },
  {
    id: "create-function",
    title: "Create a function of your own",
    blurb: "compose named steps into one reusable transformation",
    keywords: ["create", "function", "make", "steps", "compose", "custom", "build", "new function"],
    steps: [
      { verb: "caption", args: { text: "a function is a recipe of cognitive steps you can reuse forever.", ms: 2200 } },
      {
        verb: "createFunction",
        args: {
          name: "hidden structure",
          description: "find the deep structure beneath any idea",
          steps: [
            { name: "strip particulars", description: "remove domain-specific details, keep only relations" },
            { name: "name the pattern", description: "give the underlying structure a precise name" },
            { name: "find twin domains", description: "list three other domains where the same structure operates" },
          ],
          saveAs: "fn",
        },
      },
      { verb: "spawnText", args: { text: "A city's traffic grid under rush hour load", saveAs: "subject" } },
      { verb: "applyFunction", args: { op: "fn", target: "subject" } },
      { verb: "focusAiResult", args: {} },
      { verb: "caption", args: { text: "one drag ran all three steps. your functions are your style of seeing.", ms: 2600 } },
    ],
  },
  {
    id: "cross-layer-drag",
    title: "Drag ideas between layers",
    blurb: "move a thought into the AI space and bring results back",
    keywords: ["drag", "move", "cross", "boundary", "ai space", "transfer", "between"],
    steps: [
      { verb: "spawnText", args: { text: "Ant colonies allocate labor without any manager", saveAs: "ants" } },
      { verb: "caption", args: { text: "drag any object across the golden boundary into the AI space.", ms: 2000 } },
      { verb: "dragItemToAi", args: { target: "ants" } },
      { verb: "focusAiResult", args: {} },
      { verb: "caption", args: { text: "and drag results back onto paper when they earn a place on the page.", ms: 2000 } },
      { verb: "dragAiResultToPaper", args: {} },
    ],
  },
  {
    id: "ai-branching",
    title: "Branch thinking in the AI space",
    blurb: "apply functions directly to AI nodes to grow a tree of takes",
    keywords: ["branch", "node", "strand", "tree", "grow", "fork thought", "ai node"],
    steps: [
      { verb: "spawnText", args: { text: "Markets are conversations", saveAs: "seed" } },
      { verb: "dragItemToAi", args: { target: "seed" } },
      { verb: "caption", args: { text: "drop another function on a node and it branches — the original stays put.", ms: 2200 } },
      { verb: "applyFunctionToAiNode", args: { op: "reframe" } },
      { verb: "focusAiResult", args: {} },
      { verb: "caption", args: { text: "you can also pull a strand straight out of a node with your cursor and pick an operation mid-drag.", ms: 2800 } },
    ],
  },
  {
    id: "highlighter",
    title: "The highlighter",
    blurb: "sweep strokes across many ideas — one living selection",
    keywords: ["highlight", "highlighter", "select", "sweep", "marker", "multiple"],
    steps: [
      { verb: "spawnText", args: { text: "The father runs to the prodigal son", saveAs: "h1" } },
      { verb: "spawnText", args: { text: "Immune tolerance ignores what it could attack", saveAs: "h2" } },
      { verb: "caption", args: { text: "the highlighter is additive — every stroke joins one living selection, across objects and layers.", ms: 2600 } },
      { verb: "highlight", args: { targets: ["h1", "h2"] } },
      { verb: "caption", args: { text: "it survives letting go. operate on all of it at once, or save it as lens material.", ms: 2600 } },
    ],
  },
  {
    id: "capture-thread",
    title: "Capture a thread as a function",
    blurb: "turn the path that produced an object into a reusable move",
    keywords: ["capture", "thread", "history", "path", "record", "sequence", "save steps"],
    steps: [
      { verb: "spawnText", args: { text: "Grace is unearned favor", saveAs: "g" } },
      { verb: "applyFunction", args: { op: "expand", target: "g" } },
      { verb: "dragAiResultToPaper", args: {} },
      { verb: "caption", args: { text: "every object remembers the exact steps that produced it.", ms: 2200 } },
      { verb: "captureThread", args: { target: "last" } },
      { verb: "caption", args: { text: "that whole path is now one function on your rail — replay it on anything.", ms: 2600 } },
    ],
  },
  {
    id: "lenses",
    title: "Lenses and symbols",
    blurb: "compress recurring structure into symbols you can apply anywhere",
    keywords: ["lens", "symbol", "glyph", "draw", "structure", "save page", "way of seeing"],
    steps: [
      { verb: "showLenses", args: { caption: "lenses are compressions — a symbol that stands for a recurring structure you keep noticing." } },
      { verb: "caption", args: { text: "highlight material and drag it here, or save a whole page as a lens.", ms: 2400 } },
      { verb: "caption", args: { text: "draw a glyph for it, and lens reads your drawing to understand what it means to you.", ms: 2600 } },
      { verb: "caption", args: { text: "then apply the lens to anything — it sees the new material through your structure.", ms: 2400 } },
    ],
  },
  {
    id: "investment-memo",
    title: "Build an investment memo function",
    blurb: "the full loop: create a multi-step function and run it on a company",
    keywords: ["investment", "memo", "company", "diligence", "analyze", "full", "example", "workflow"],
    steps: [
      { verb: "caption", args: { text: "let's build a real workflow: an investment memo, as one reusable function.", ms: 2400 } },
      {
        verb: "createFunction",
        args: {
          name: "investment memo",
          description: "produce a sharp investment memo for any company",
          steps: [
            { name: "market map", description: "size the market and name the forces reshaping it" },
            { name: "edge analysis", description: "identify the company's unfair advantage and its decay rate" },
            { name: "risk ledger", description: "list the three risks that actually kill companies like this" },
            { name: "verdict", description: "write a two-sentence invest / pass verdict with conviction level" },
          ],
          saveAs: "memoFn",
        },
      },
      { verb: "spawnText", args: { text: "Gimlet Labs", saveAs: "company" } },
      { verb: "caption", args: { text: "now drag the function onto the company — all four steps run in sequence.", ms: 2200 } },
      { verb: "applyFunction", args: { op: "memoFn", target: "company" } },
      { verb: "focusAiResult", args: {} },
      { verb: "caption", args: { text: "drag the memo to paper if you want to keep it — and the function stays on your rail for the next company.", ms: 3000 } },
    ],
  },
];

export function findDemo(id) {
  return COMPANION_DEMOS.find((d) => d.id === id) || null;
}

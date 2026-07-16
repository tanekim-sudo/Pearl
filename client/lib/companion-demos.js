/**
 * Companion demo library — hand-encoded director scripts that demonstrate
 * every layer and feature combination. The companion plays these for
 * "how do I…" questions and for first-run onboarding.
 */

export const COMPANION_DEMOS = [
  {
    id: "safe-capability-sample",
    title: "A reversible capability sample",
    blurb: "create and organize a local thought without a model call",
    keywords: ["anything", "what can you do", "show me"],
    steps: [
      { verb: "spawnText", args: { text: "A thought can become branches, a synthesis, deeper principles, a challenge, or a concrete example.", saveAs: "sample" } },
      { verb: "zoomToItem", args: { target: "sample" } },
    ],
  },
  {
    id: "three-layers",
    title: "The three layers",
    blurb: "lenses rail, paper page, AI space — what each is for",
    keywords: ["layer", "layout", "column", "space", "overview", "start", "what is", "tour"],
    steps: [
      { verb: "caption", args: { text: "lens has three layers. the middle is your paper — one page, like a real sheet.", ms: 2600 } },
      { verb: "fitPaper", args: {} },
      { verb: "caption", args: { text: "the left rail holds your lenses — reusable ways of transforming ideas.", ms: 2400 } },
      { verb: "showLenses", args: { caption: "below them, generators: open workspaces for collecting and shaping material." } },
      { verb: "caption", args: { text: "the right side is the AI space — every transformation blooms there first, and you drag back what you want to keep.", ms: 3000 } },
    ],
  },
  {
    id: "first-idea",
    title: "Put down an idea and transform it",
    blurb: "spawn a thought on paper and apply a built-in move",
    keywords: ["idea", "first", "begin", "transform", "apply", "challenge", "text", "write"],
    steps: [
      { verb: "caption", args: { text: "click anywhere on the page and type — that's a thought.", ms: 2000 } },
      { verb: "spawnText", args: { text: "Forgiveness is the controlled release of pressure", saveAs: "idea" } },
      { verb: "caption", args: { text: "now drag a move from the rail onto it.", ms: 1800 } },
      { verb: "applyFunction", args: { op: "Challenge", target: "idea" } },
      { verb: "focusAiResult", args: {} },
      { verb: "caption", args: { text: "nothing touched your paper — results live in the AI space until you pull them across.", ms: 2600 } },
    ],
  },
  {
    id: "create-function",
    title: "Create a lens of your own",
    blurb: "compose named steps into one reusable lens",
    keywords: ["create", "function", "lens", "make", "steps", "compose", "custom", "build", "new function", "new lens"],
    steps: [
      {
        verb: "createFunction",
        args: {
          name: "hidden pattern",
          description: "find a shared pattern, then branch into two useful views",
          steps: [
            { name: "strip particulars", description: "remove domain details and retain relationships" },
          ],
          saveAs: "fn",
        },
      },
      { verb: "openFunctionEditor", args: { op: "fn" } },
      {
        verb: "addFunctionBranch",
        args: {
          op: "fn",
          from: "strip particulars",
          name: "name the pattern",
          prompt: "Give the shared relational pattern a precise name.",
        },
      },
      {
        verb: "addFunctionBranch",
        args: {
          op: "fn",
          from: "strip particulars",
          name: "find twin domains",
          prompt: "Find three other domains where this same relationship operates.",
        },
      },
      {
        verb: "setFunctionStep",
        args: {
          op: "fn",
          step: "strip particulars",
          prompt: "Remove domain-specific details. Preserve actors, forces, and relationships.",
        },
      },
      { verb: "saveFunction", args: { op: "fn", message: "build branched hidden-pattern lens" } },
      { verb: "spawnText", args: { text: "A city's traffic grid under rush hour load", saveAs: "subject" } },
      { verb: "applyFunction", args: { op: "fn", target: "subject", wait: false } },
      { verb: "focusAiResult", args: {} },
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
      { verb: "caption", args: { text: "drop another lens on a node and it branches — the original stays put.", ms: 2200 } },
      { verb: "applyFunctionToAiNode", args: { op: "Branch" } },
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
      { verb: "caption", args: { text: "it survives letting go. operate on all of it at once, or save it into a generator.", ms: 2600 } },
    ],
  },
  {
    id: "capture-thread",
    title: "Capture a thread as a lens",
    blurb: "turn the path that produced an object into a reusable move",
    keywords: ["capture", "thread", "history", "path", "record", "sequence", "save steps"],
    steps: [
      { verb: "spawnText", args: { text: "Grace is unearned favor", saveAs: "g" } },
      { verb: "applyFunction", args: { op: "Deepen", target: "g" } },
      { verb: "dragAiResultToPaper", args: {} },
      { verb: "caption", args: { text: "every object remembers the exact steps that produced it.", ms: 2200 } },
      { verb: "captureThreadAsFunction", args: { target: "last" } },
      { verb: "caption", args: { text: "that whole path is now one Function on your rail — replay it on anything.", ms: 2600 } },
    ],
  },
  {
    id: "lenses",
    title: "Build with generators",
    blurb: "collect and arrange material in an open generator workspace",
    keywords: ["generator", "collect", "arrange", "save page", "workspace", "material", "diamond"],
    steps: [
      { verb: "showLenses", args: { caption: "generators collect material in an open spatial workspace" } },
      { verb: "caption", args: { text: "attach observations, arrange them, select material, and craft a lens", ms: 520 } },
    ],
  },
  {
    id: "investment-memo",
    title: "Build an investment memo lens",
    blurb: "the full loop: create a multi-step lens and run it on a company",
    keywords: ["investment", "memo", "company", "diligence", "analyze", "full", "example", "workflow"],
    steps: [
      { verb: "caption", args: { text: "let's build a real workflow: an investment memo, as one reusable lens.", ms: 2400 } },
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
      { verb: "caption", args: { text: "now drag the lens onto the company — all four steps run in sequence.", ms: 2200 } },
      { verb: "applyFunction", args: { op: "memoFn", target: "company" } },
      { verb: "focusAiResult", args: {} },
      { verb: "caption", args: { text: "drag the memo to paper if you want to keep it — and the lens stays on your rail for the next company.", ms: 3000 } },
    ],
  },
];

export function findDemo(id) {
  return COMPANION_DEMOS.find((d) => d.id === id) || null;
}

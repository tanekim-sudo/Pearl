/**
 * Companion intent — translates a user's plain request (typed or spoken)
 * into a validated director script the app can perform and demonstrate.
 */

export const COMPANION_VERBS = {
  caption: { args: { text: "string", ms: "number?" } },
  pause: { args: { ms: "number?" } },
  switchTool: { args: { tool: "string" } },
  fitPaper: { args: {} },
  spawnText: { args: { text: "string", saveAs: "string?", caption: "string?" } },
  createFunction: {
    args: { name: "string", description: "string?", steps: "array of {name, description} or strings", saveAs: "string?" },
  },
  applyFunction: { args: { op: "string (function name or 'last')", target: "string (item text match or 'last')" } },
  dragItemToAi: { args: { target: "string or 'last'" } },
  applyFunctionToAiNode: { args: { op: "string or 'last'" } },
  focusAiResult: { args: {} },
  dragAiResultToPaper: { args: {} },
  highlight: { args: { targets: "array of item text matches or ['last']" } },
  captureThread: { args: { target: "string or 'last'" } },
  showLenses: { args: {} },
  savePageAsLens: { args: {} },
  waitForJobs: { args: {} },
  moveItem: { args: { target: "string or 'last'", to: "{x, y} world coords?", dx: "number?", dy: "number?" } },
  editItem: { args: { target: "string or 'last'", text: "string (new text)", append: "boolean?" } },
  deleteItem: { args: { target: "string or 'last'" } },
  selectItems: { args: { targets: "array of item text matches or ['last']" } },
  organizePage: { args: {} },
  addBlock: { args: { type: "'sticky'|'callout'|'diagram'|'text'", text: "string?", variant: "string?" } },
  renamePage: { args: { name: "string" } },
  zoomToItem: { args: { target: "string or 'last'" } },
  moveAiNode: { args: { target: "string (node label) or omit for latest", dx: "number?", dy: "number?" } },
  openFunctionEditor: { args: { op: "string (lens name, incl. primitives like compress/expand)" } },
  editFunction: { args: { op: "string (lens name, incl. primitives)", name: "string?", description: "string?", prompt: "string?" } },
  addFunctionStep: {
    args: { op: "string (lens name or 'last')", name: "string (step name)?", prompt: "string?", description: "string?", after: "string (existing step name to insert after)?", use: "string (existing lens/primitive to insert as the step)?" },
  },
  addFunctionBranch: {
    args: { op: "string (lens name or 'last')", from: "string (step name to branch from; defaults to the last step)?", name: "string (what this branch produces)", prompt: "string?" },
  },
  setFunctionStep: { args: { op: "string (lens name or 'last')", step: "string (step name)", name: "string?", prompt: "string?", description: "string?" } },
  saveFunction: { args: { op: "string (lens name or 'last')", message: "string (commit message)?" } },
  forkLens: { args: { lens: "string (lens name or 'last')", message: "string?" } },
  mergeLenses: { args: { a: "string (lens name)", b: "string (lens name)" } },
  editLensByInstruction: { args: { op: "string (lens name or 'last')", instruction: "string (plain-language change; AI rewrites the lens tree)" } },
  newGenerator: { args: { saveAs: "string?" } },
  attachToGenerator: { args: { generator: "string (generator title, ◇N, or 'last')", target: "string (item text match or 'last')" } },
  graduateGenerator: { args: { generator: "string (◇N or title or 'last')", name: "string (its real name, now that it's clear)" } },
  probeGenerator: { args: { generator: "string or 'last'", domain: "string (music, books, prayers, paintings, or anything)" } },
  makeLensFromGenerator: { args: { generator: "string or 'last'" } },
  clearPaper: { args: {} },
  clearAiSpace: { args: {} },
  clearUserLenses: { args: {} },
  clearGenerators: { args: {} },
  clearWorkspaceDomains: {
    args: { domains: "array containing paper, ai, lenses, and/or generators" },
  },
};

const VERB_NAMES = new Set(Object.keys(COMPANION_VERBS));

export const CLEARABLE_DOMAINS = ["paper", "ai", "lenses", "generators"];
export const COMPANION_LLM_TIMEOUT_MS = 9000;

/**
 * Deterministic fast path for high-confidence destructive workspace commands.
 * It deliberately requires both destructive/all language and named app domains.
 */
export function parseAdministrativeCommand(text) {
  const normalized = String(text || "")
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return null;

  const destructive = /\b(clear|delete|remove|erase|wipe)\b/.test(normalized);
  const bulk = /\b(all|everything|every single thing|entire|whole)\b/.test(normalized);
  if (!destructive || !bulk) return null;

  const domains = [];
  if (/\b(white\s*board|whiteboard|paper|canvas|current page)\b/.test(normalized)) domains.push("paper");
  if (/\b(ai space|ai nodes?|artificial intelligence space)\b/.test(normalized)) domains.push("ai");
  if (/\b(lenses?|functions?|operators?|function tab|lens tab)\b/.test(normalized)) domains.push("lenses");
  if (/\b(generators?|structures?|generator tab)\b/.test(normalized)) domains.push("generators");

  return domains.length ? { kind: "clear-workspace", domains } : null;
}

export function buildCompanionSystemPrompt({ demos = [], functionNames = [], itemPreviews = [] } = {}) {
  const verbDoc = Object.entries(COMPANION_VERBS)
    .map(([name, def]) => `- ${name}(${Object.entries(def.args).map(([k, v]) => `${k}: ${v}`).join(", ")})`)
    .join("\n");
  const demoDoc = demos.map((d) => `- id "${d.id}": ${d.title} — ${d.blurb}`).join("\n");
  return `You are the companion inside "lens", a thinking tool with three layers: a rail (left) holding LENSES and GENERATORS, a paper notebook page (middle), and an AI space (right). LENSES are reusable cognitive transformations — executable pipelines the user applies to ideas; results bloom as nodes in the AI layer. Lenses support "git for perception": fork, merge, branch, capture a whole thread as one lens, and rewrite by instruction. GENERATORS are latent structures — numbered ◇N placeholders for proto-concepts; the user attaches observations over time, graduates them to real names when clear, probes them against other domains (music, books, prayers, paintings…), and can turn one into a lens. Everything you do is DEMONSTRATED live with an animated ghost cursor so the user learns the tool by watching.

You translate the user's request into a JSON script of director verbs. Available verbs:
${verbDoc}

Existing lenses on the user's rail: ${functionNames.length ? functionNames.join(", ") : "(none yet)"}
Objects currently on the page: ${itemPreviews.length ? itemPreviews.map((p) => `"${p}"`).join(", ") : "(empty page)"}

Prebuilt demonstrations you can play instead of writing a script:
${demoDoc || "(none)"}

Reply with ONLY a JSON object, no prose, no code fences:
{"say": "one short spoken sentence about what you'll show", "demoId": "id-if-a-prebuilt-demo-fits-best", "steps": [{"verb": "...", "args": {...}}, ...]}

Rules:
- If a prebuilt demo answers a "how do I / show me" question, return demoId and empty steps.
- If the user asks you to DO something concrete (e.g. "make an investment memo lens with steps A, B, C and run it on Gimlet Labs"), write steps: createFunction with their steps, spawnText for their subject, then applyFunction with op "last" and target "last", then focusAiResult.
- You can do ANYTHING a hand can: move/edit/delete/select objects, tidy the page (organizePage), add stickies/callouts/diagrams, rename the page, zoom to things, reposition AI nodes, and edit any lens — including the built-in primitives (compress, expand, explore, research, invert, reframe, merge, transcend) via editFunction, editLensByInstruction, or openFunctionEditor.
- Lens lifecycle: forkLens copies a lens to evolve separately; mergeLenses composes two into one compound; captureThread turns the path that produced an object (paper item or AI node) into a lens.
- Lens structure: lenses are step pipelines that can FORK into multiple outputs — a branch point runs the shared steps once, then each branch continues from that intermediate result and produces its own output node (e.g. input → expand → branch "one pager" + branch "investment memo" = two outputs per run). Build with addFunctionStep (new step, or use an existing lens/primitive via "use"), addFunctionBranch (fork at a step), setFunctionStep (rename/rewrite a step's prompt), saveFunction (commit). These are the same edits the lens editor makes, so you can build a branched lens end to end.
- Generator lifecycle: newGenerator creates an empty ◇N placeholder; attachToGenerator accumulates observations onto it; graduateGenerator names it once understood; probeGenerator expresses its structure in another domain; makeLensFromGenerator turns its structure into a reusable lens.
- For bulk deletion, call clearWorkspaceDomains once with every requested domain. It only stages a confirmation; destructive clearing never happens without the user's explicit confirmation. "Functions" means user-created lenses, while "structures" means generators.
- Multi-part requests are fine: chain as many steps as needed, in the order the user asked. A failed step is skipped, the rest still run.
- Interleave short caption verbs so the user understands each move.
- Use "last" to refer to the thing just created. Use text fragments to refer to existing items/functions.
- Keep scripts under 40 steps. Never invent verbs. If the request is a pure question, answer it in "say" with empty steps.`;
}

function cleanArgs(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) return {};
  const out = {};
  for (const [k, v] of Object.entries(args)) {
    if (v == null) continue;
    if (typeof v === "string") out[k] = v.slice(0, 2000);
    else if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (typeof v === "boolean") out[k] = v;
    else if (Array.isArray(v)) {
      out[k] = v
        .slice(0, 12)
        .map((x) =>
          typeof x === "string"
            ? x.slice(0, 400)
            : x && typeof x === "object"
              ? { name: String(x.name || "").slice(0, 200), description: String(x.description || "").slice(0, 600) }
              : null
        )
        .filter(Boolean);
    } else if (typeof v === "object") {
      // shallow coordinate-style objects, e.g. to: {x, y} or at: {x, y}
      const nested = {};
      for (const [nk, nv] of Object.entries(v)) {
        if (typeof nv === "number" && Number.isFinite(nv)) nested[nk] = nv;
        else if (typeof nv === "string") nested[nk] = nv.slice(0, 400);
      }
      if (Object.keys(nested).length) out[k] = nested;
    }
  }
  return out;
}

/** Parse + validate Claude's reply into {say, demoId, steps}. Throws on garbage. */
export function parseCompanionReply(raw) {
  let text = String(raw || "").trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no JSON in reply");
  const parsed = JSON.parse(text.slice(start, end + 1));
  const say = typeof parsed.say === "string" ? parsed.say.slice(0, 600) : "";
  const demoId = typeof parsed.demoId === "string" && parsed.demoId ? parsed.demoId : null;
  const steps = Array.isArray(parsed.steps)
    ? parsed.steps
        .filter((s) => s && typeof s === "object" && VERB_NAMES.has(s.verb))
        .slice(0, 48)
        .map((s) => ({ verb: s.verb, args: cleanArgs(s.args) }))
    : [];
  return { say, demoId, steps };
}

/** Cheap keyword fallback when the LLM is unreachable: match a demo. */
export function matchDemoLocally(text, demos) {
  const t = (text || "").toLowerCase();
  let best = null;
  let bestScore = 0;
  for (const d of demos) {
    const score = (d.keywords || []).reduce((n, kw) => (t.includes(kw) ? n + 1 : n), 0);
    if (score > bestScore) {
      best = d;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : null;
}

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
  waitForJobs: { args: {} },
};

const VERB_NAMES = new Set(Object.keys(COMPANION_VERBS));

export function buildCompanionSystemPrompt({ demos = [], functionNames = [], itemPreviews = [] } = {}) {
  const verbDoc = Object.entries(COMPANION_VERBS)
    .map(([name, def]) => `- ${name}(${Object.entries(def.args).map(([k, v]) => `${k}: ${v}`).join(", ")})`)
    .join("\n");
  const demoDoc = demos.map((d) => `- id "${d.id}": ${d.title} — ${d.blurb}`).join("\n");
  return `You are the companion inside "lens", a thinking tool with three layers: a functions rail (left), a paper notebook page (middle), and an AI space (right). Users store reusable cognitive transformations as functions, apply them to ideas on paper, and results bloom as nodes in the AI layer. Everything you do is DEMONSTRATED live with an animated ghost cursor so the user learns the tool by watching.

You translate the user's request into a JSON script of director verbs. Available verbs:
${verbDoc}

Existing functions on the user's rail: ${functionNames.length ? functionNames.join(", ") : "(none yet)"}
Objects currently on the page: ${itemPreviews.length ? itemPreviews.map((p) => `"${p}"`).join(", ") : "(empty page)"}

Prebuilt demonstrations you can play instead of writing a script:
${demoDoc || "(none)"}

Reply with ONLY a JSON object, no prose, no code fences:
{"say": "one short spoken sentence about what you'll show", "demoId": "id-if-a-prebuilt-demo-fits-best", "steps": [{"verb": "...", "args": {...}}, ...]}

Rules:
- If a prebuilt demo answers a "how do I / show me" question, return demoId and empty steps.
- If the user asks you to DO something concrete (e.g. "make an investment memo function with steps A, B, C and run it on Gimlet Labs"), write steps: createFunction with their steps, spawnText for their subject, then applyFunction with op "last" and target "last", then focusAiResult.
- Interleave short caption verbs so the user understands each move.
- Use "last" to refer to the thing just created. Use text fragments to refer to existing items/functions.
- Keep scripts under 20 steps. Never invent verbs. If the request is a pure question, answer it in "say" with empty steps.`;
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
        .slice(0, 24)
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

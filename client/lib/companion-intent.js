/**
 * Companion intent — translates a user's plain request (typed or spoken)
 * into a validated director script the app can perform and demonstrate.
 */

import { capabilityPrompt, COMPANION_VERBS } from "./companion-capabilities.js";
import { parseCompanionPlan } from "./companion-plan.js";
export { COMPANION_VERBS } from "./companion-capabilities.js";
export { parseCompanionPlan } from "./companion-plan.js";

const VERB_NAMES = new Set(Object.keys(COMPANION_VERBS));

export const CLEARABLE_DOMAINS = ["paper", "ai", "lenses", "generators"];

function clearDomainsFromText(normalized) {
  const domains = new Set();
  const unifiedCanvas =
    /\b(white\s*board|whiteboard|whitebaord|canvas|everything here|workspace|start (?:completely )?over)\b/.test(normalized);
  if (
    unifiedCanvas ||
    /\b(paper|current page|drawings?|sketch(?:es)?|notes?|blocks?|links?|highlights?|marks?)\b/.test(normalized)
  ) domains.add("paper");
  if (
    unifiedCanvas ||
    /\b(ai space|ai nodes?|nodes?|ai stuff|artificial intelligence space|edges?)\b/.test(normalized)
  ) domains.add("ai");
  if (/\b(lenses?|functions?|operators?|function tab|lens tab)\b/.test(normalized)) domains.add("lenses");
  if (/\b(generators?|structures?|generator tab)\b/.test(normalized)) domains.add("generators");
  if (/\bnot (?:the )?(?:lenses?|functions?|operators?)\b/.test(normalized)) domains.delete("lenses");
  if (/\bnot (?:the )?(?:generators?|structures?)\b/.test(normalized)) domains.delete("generators");
  if (/\bnot (?:the )?(?:ai|nodes?|ai stuff)\b/.test(normalized)) domains.delete("ai");
  if (/\bnot (?:the )?(?:paper|notes?|drawings?)\b/.test(normalized)) domains.delete("paper");
  return [...domains];
}

/**
 * Deterministic fast path for high-confidence destructive workspace commands.
 * It deliberately requires both destructive/all language and named app domains.
 */
export function parseAdministrativeCommand(text, { previousDomains = [], pending = false } = {}) {
  const normalized = String(text || "")
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return null;

  if (/^(?:yes|confirm|do it|go ahead|clear it)$/i.test(normalized) && pending) {
    return { kind: "confirm-clear", domains: [...previousDomains] };
  }
  if (/^(?:no|cancel|stop|never mind|nevermind)$/i.test(normalized) && pending) {
    return { kind: "cancel-clear", domains: [...previousDomains] };
  }
  const destructive = /\b(clear|delete|remove|erase|wipe)\b/.test(normalized) || /\bget rid (?:of|fo)\b/.test(normalized);
  const bulk = /\b(all|everything|every single thing|entire|whole)\b/.test(normalized);
  const followup = pending && (
    /\b(also|including?|plus|and the|do the rest|nodes?|notes?|lenses?|functions?|generators?)\b/.test(normalized)
  );
  if ((!destructive || !bulk) && !followup) return null;
  let domains = clearDomainsFromText(normalized);
  if (followup) {
    if (/\bdo the rest\b/.test(normalized)) {
      domains = CLEARABLE_DOMAINS.filter((domain) => !previousDomains.includes(domain));
    } else {
      domains = [...new Set([...previousDomains, ...domains])];
      if (/\bnot (?:the )?(?:lenses?|functions?|operators?)\b/.test(normalized)) domains = domains.filter((d) => d !== "lenses");
      if (/\bnot (?:the )?(?:generators?|structures?)\b/.test(normalized)) domains = domains.filter((d) => d !== "generators");
    }
  }
  return domains.length ? { kind: "clear-workspace", domains } : null;
}

const COMMAND_LEAD =
  /^(?:please\s+)?(?:add|apply|attach|branch|build|capture|change|clear|close|create|delete|do|draw|edit|erase|fit|focus|fork|get rid|graduate|highlight|make|merge|move|open|organize|pan|probe|remove|rename|research|run|save|select|share|show|start|switch|turn|walk|wipe|zoom)\b/i;

/**
 * Interview answers are deliberately narrow. Everything else gets a chance
 * to route through deterministic intent detection / the planner first.
 */
export function looksLikeProfileAnswer(text, field) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  if (!value || /[?;]|\n/.test(value)) return false;
  const words = value.split(" ");
  if (parseAdministrativeCommand(value) || parseSaveChainCommand(value)) return false;
  if (
    field === "identity" &&
    /\b(?:add|apply|clear|create|delete|draw|edit|erase|include|make|move|remove|run|wipe)\b/i.test(value)
  ) return false;
  if (field === "identity") {
    if (words.length > 7 || value.length > 80 || COMMAND_LEAD.test(value)) return false;
    return /^[\p{L}\p{M}][\p{L}\p{M} .,'’-]*$/u.test(value);
  }
  if (field === "role") {
    if (words.length > 18 || value.length > 160) return false;
    return /^(?:i\s+(?:am|work|run|lead|write|research|design|build|teach|invest|found)|my\s+(?:work|role)|a[n]?\s+|[\p{L}\p{M}][\p{L}\p{M} /&'-]{1,60}$)/iu.test(value);
  }
  // A first goal may be a noun phrase. Imperative requests should execute now.
  return words.length <= 18 && value.length <= 180 && !COMMAND_LEAD.test(value);
}

export function classifyInterviewInput(text, field) {
  const administrative = parseAdministrativeCommand(text);
  if (administrative) return { kind: "command", intent: administrative };
  const chain = parseSaveChainCommand(text);
  if (chain) return { kind: "command", intent: chain };
  if (looksLikeProfileAnswer(text, field)) return { kind: "profile" };
  return { kind: "command", intent: null };
}

/** Local fast path for the high-confidence lineage-capture command. */
export function parseSaveChainCommand(text) {
  const normalized = String(text || "").replace(/[’']/g, "'").replace(/\s+/g, " ").trim();
  if (!/\b(save|capture|turn)\b/i.test(normalized) || !/\b(chain|thread|how i got here|lineage|path)\b/i.test(normalized)) {
    return null;
  }
  const named = normalized.match(/\b(?:as|called|named)\s+(?:a\s+lens\s+)?["“]?(.+?)["”]?\s*$/i);
  let name = named?.[1]?.trim() || "";
  name = name.replace(/\s+as\s+a\s+lens$/i, "").trim();
  if (/^(?:a\s+)?lens$/i.test(name)) name = "";
  return { kind: "save-chain", name: name || null };
}

export function buildCompanionSystemPrompt({ demos = [], functionNames = [], itemPreviews = [] } = {}) {
  const verbDoc = capabilityPrompt();
  const demoDoc = demos.map((d) => `- id "${d.id}": ${d.title} — ${d.blurb}`).join("\n");
  return `You are the companion inside "lens", a thinking tool with three layers: a rail (left) holding LENSES and GENERATORS, a paper notebook page (middle), and an AI space (right). LENSES are reusable cognitive transformations — executable pipelines the user applies to ideas; results bloom as nodes in the AI layer. Lenses support "git for perception": fork, merge, branch, capture a whole thread as one lens, and rewrite by instruction. GENERATORS are open spatial workspaces: the user collects and arranges material, selects subsets, runs lenses, probes other domains, and crafts a reusable lens from the result. Everything you do is DEMONSTRATED live with an animated ghost cursor so the user learns the tool by watching.

You translate the user's request into a JSON script of director verbs. Available verbs:
${verbDoc}

Existing lenses on the user's rail: ${functionNames.length ? functionNames.join(", ") : "(none yet)"}
Objects currently on the page: ${itemPreviews.length ? itemPreviews.map((p) => `"${p}"`).join(", ") : "(empty page)"}

Prebuilt demonstrations you can play instead of writing a script:
${demoDoc || "(none)"}

Reply with ONLY a JSON object, no prose, no code fences:
{"say": "empty for executable actions; only a required choice, answer, or precise blocker", "demoId": "id-if-a-prebuilt-demo-fits-best", "steps": [{"verb": "...", "args": {...}}, ...]}

Rules:
- Action-first: for every executable request, set "say" to "" and emit the steps immediately. Do not acknowledge, praise, summarize, or announce what you will do.
- Use captions only as terse operation/target labels when the visual action would otherwise be ambiguous. Never narrate or explain routine steps.
- If a prebuilt demo answers a "how do I / show me" question, return demoId and empty steps.
- If the user asks you to DO something concrete (e.g. "make an investment memo lens with steps A, B, C and run it on Gimlet Labs"), write steps: createFunction with their steps, spawnText for their subject, then applyFunction with op "last" and target "last", then focusAiResult.
- Never promise unsupported actions. Only claim an action was done when a listed verb executes it. For a missing capability, say exactly which action is unavailable and return no steps.
- Lens lifecycle: forkLens copies a lens to evolve separately; mergeLenses composes two into one compound; captureThread turns the path that produced an object (paper item or AI node) into a lens.
- Lens structure: lenses are step pipelines that can FORK into multiple outputs — a branch point runs the shared steps once, then each branch continues from that intermediate result and produces its own output node (e.g. input → expand → branch "one pager" + branch "investment memo" = two outputs per run). Build with addFunctionStep (new step, or use an existing lens/primitive via "use"), addFunctionBranch (fork at a step), setFunctionStep (rename/rewrite a step's prompt), saveFunction (commit). These are the same edits the lens editor makes, so you can build a branched lens end to end.
- Generator lifecycle: newGenerator creates an open workspace; attachToGenerator collects observations; graduateGenerator names it; probeGenerator tests its material in another domain; makeLensFromGenerator crafts a reusable lens.
- For bulk deletion, call clearWorkspaceDomains once with every requested domain. It only stages a confirmation; destructive clearing never happens without the user's explicit confirmation. "Functions" means user-created lenses.
- Multi-part and hard requests are plans: compose as many available verbs as needed in dependency order (for example create material → create/apply a lens → focus or transfer the AI result). Prefer a valid sequence over claiming no single verb exists. A failed nonfatal step is skipped and the rest continue.
- Selection is cross-domain: the persistent highlighter can include paper material, AI nodes, lenses, functions, generators, and exact text fragments. Lenses are executable transformation trees (including branch outputs); generators are spatial collections for arranging material and crafting lenses. Shared paths can be walked, annotated, branched, returned to, or materialized by the direct UI; do not claim those path operations unless a matching registered capability is listed.
- Do not add conversational caption steps. The animation itself is the response.
- Use "last" to refer to the thing just created. Use text fragments to refer to existing items/functions.
- Keep scripts under 40 steps. Never invent verbs. If the request is a pure question, answer it in "say" with empty steps.`;
}

export function buildAdaptiveCompanionPrompt({ workspaceContext = "{}", autonomy = "preview-complex" } = {}) {
  return `You are the action planner inside lens. Plan against the actual bounded workspace snapshot and canonical capabilities below. Never invent IDs, capabilities, sources, or completed actions.

WORKSPACE:
${workspaceContext}

CAPABILITIES:
${capabilityPrompt()}

Return ONLY one versioned JSON plan:
{"version":1,"title":"short visual label","root":{"kind":"sequence","steps":[]}}

Step DSL:
- {"kind":"query","query":"objects|selection|graph|clusters|history|library|viewport","filter":{},"saveAs":"name"}
- {"kind":"action","capability":"manifestName","args":{},"saveAs":"optional"}
- {"kind":"sequence","steps":[]}
- {"kind":"parallel","steps":[]} (read/evaluate/research only)
- {"kind":"foreach","in":"savedArray","limit":10,"step":{}}, using "$item.id" for stable action targets
- {"kind":"conditional","if":{"ref":"$name","exists":true},"then":{},"else":{}}
- {"kind":"retry","limit":2,"step":{}}
- {"kind":"evaluate","target":"$savedOrStableId","criteria":["criterion"],"saveAs":"evaluation"}
- {"kind":"research","question":"...","scope":"web","recency":"...","maxSources":5,"saveAs":"research"}
- {"kind":"checkpoint","mode":"save|confirm","label":"..."}
- {"kind":"artifact","from":"savedResult","placement":"paper|ai|generator|beside-target","target":"stable-id"}

Rules:
- Action-first and silent. The plan itself is the response; do not add conversational text.
- Observe before acting when references are ambiguous. Use stable IDs from the snapshot.
- Compose generic transformMaterial, arrangeItems, groupItems, linkItems, and annotateFeedback capabilities instead of prompt-specific tricks.
- Evaluation/reflection must end in an artifact or a real revision. Research must end in a cited visible artifact and may only be used when requested or materially authorized.
- Destructive capabilities require a prior confirm checkpoint and "confirmed":true on the action.
- Preserve originals before broad revisions. Use finite loops/retries. Do not exceed 40 total steps, 100 iterations, or 3 research calls.
- Current autonomy preference is "${autonomy}".`;
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
  const rawSteps = Array.isArray(parsed.steps) ? parsed.steps.slice(0, 48) : [];
  const unsupported = rawSteps.find((step) => !step || typeof step !== "object" || !VERB_NAMES.has(step.verb));
  if (unsupported) throw new Error(`unsupported companion verb "${unsupported?.verb || "(missing)"}"`);
  const steps = rawSteps.map((s) => ({ verb: s.verb, args: cleanArgs(s.args) }));
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

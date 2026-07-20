/**
 * Companion intent — translates a user's plain request (typed or spoken)
 * into a validated director script the app can perform and demonstrate.
 */

import {
  capabilityPrompt,
  companionActionMetadataPrompt,
  COMPANION_VERBS,
} from "./companion-capabilities.js";
import { capabilityContextPrompt } from "./companion-capability-graph.js";
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
  if (/\b(moves?|functions?|operators?|move tab|function tab)\b/.test(normalized)) domains.add("lenses");
  if (/\b(lenses?|context structures?|lens tab)\b/.test(normalized)) domains.add("generators");
  if (/\bnot (?:the )?(?:moves?|functions?|operators?)\b/.test(normalized)) domains.delete("lenses");
  if (/\bnot (?:the )?(?:lenses?|context structures?)\b/.test(normalized)) domains.delete("generators");
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
    /^(?:also|including?|plus|and (?:the )?|do the rest)\b/.test(normalized)
  );
  if ((!destructive || !bulk) && !followup) return null;
  let domains = clearDomainsFromText(normalized);
  if (!domains.length && destructive && bulk) {
    // Unqualified "clear everything / start from scratch" means the current
    // workspace, not the account library.
    domains = ["paper", "ai"];
  }
  if (followup) {
    if (/\bdo the rest\b/.test(normalized)) {
      domains = CLEARABLE_DOMAINS.filter((domain) => !previousDomains.includes(domain));
    } else {
      domains = [...new Set([...previousDomains, ...domains])];
      if (/\bnot (?:the )?(?:moves?|functions?|operators?)\b/.test(normalized)) domains = domains.filter((d) => d !== "lenses");
      if (/\bnot (?:the )?(?:lenses?|context structures?)\b/.test(normalized)) domains = domains.filter((d) => d !== "generators");
    }
  }
  return domains.length ? { kind: "clear-workspace", domains } : null;
}

export function parseLibraryObjectCommand(text) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  if (!value) return null;
  if (/^(?:open )?(?:the )?save as(?: chooser)?$/i.test(value) || /^save this as(?:…|\.\.\.)?$/i.test(value)) {
    return { verb: "openSaveAsChooser", args: {} };
  }
  if (/^(?:save|make|use) (?:this|the selected|selected) (?:text|content|selection)? ?as (?:a )?move$/i.test(value)) {
    return { verb: "saveCurrentAsMove", args: {} };
  }
  if (/^(?:save|capture) (?:how i got here|how (?:this|it) was made|this (?:result'?s )?lineage) as (?:a )?function$/i.test(value)) {
    return { verb: "captureLineageAsFunction", args: {} };
  }
  if (/^(?:collect|save) (?:these|this|the selected|selected) (?:items|material|content)? ?(?:in|as) (?:a )?lens$/i.test(value)) {
    return { verb: "openSaveAsChooser", args: {}, followup: { verb: "chooseSaveAsKind", args: { kind: "lens" } } };
  }
  return null;
}

export function parseSemanticTransferCommand(text) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  if (!value) return null;
  if (
    /\bturn (?:this )?whole command into a move(?: exactly as written)?\b/i.test(value) ||
    /\b(?:save|turn) (?:this|the selected text) as a move exactly as written\b/i.test(value)
  ) {
    return { verb: "semanticTransfer", args: { destination: "moves" } };
  }
  if (
    /\bdrop (?:this|these|the selection) into functions?(?: and decompose (?:it|them))?\b/i.test(value) ||
    /\bdecompose (?:this|these|the selected material) into (?:a )?functions?\b/i.test(value)
  ) {
    return { verb: "semanticTransfer", args: { destination: "functions" } };
  }
  if (
    /\bput (?:this|these|the selection) into a lens(?: even though .+)?\b/i.test(value) ||
    /\bdrop (?:this|these|the selection) into lenses?\b/i.test(value)
  ) {
    return { verb: "semanticTransfer", args: { destination: "lenses" } };
  }
  if (/\bcombine whatever i selected\b/i.test(value)) {
    return { verb: "semanticTransfer", args: { destination: "functions" } };
  }
  return null;
}

export function parsePearlCreationCommand(text) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  const match = value.match(/^(?:make|create|save) (?:a |this )?pearl(?: from (?:this|the selection|these notes))?(?: called (.+))?$/i);
  if (!match) return null;
  return {
    verb: "createSemanticOrb",
    args: { sceneId: "", ...(match[1] ? { name: match[1].trim() } : {}) },
  };
}

export function parseCognitiveWorkflowCommand(text) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  const teach = value.match(/^(?:from now on,?\s*)?when i say [“"'‘]?(.+?)[”"'’]?,?\s*(?:do|run|mean)\s+(.+?)(?:\.\s*)?(?:only remember this in (?:this )?(session|workspace|account|team))?$/i);
  if (teach) {
    return {
      title: "Teach personal command",
      steps: [{ verb: "teachPersonalCommand", args: { trigger: teach[1], command: teach[2].trim(), scope: teach[3] || "workspace" }, confirmed: true }],
    };
  }
  const disable = value.match(/\b(?:disable|forget)\s+(?:the\s+)?(?:command|alias)\s+[“"'‘]?(.+?)[”"'’]?\s*$/i);
  if (disable) return { title: "Update personal command", steps: [{ verb: /^forget/i.test(value) ? "forgetPersonalCommand" : "disablePersonalCommand", args: { trigger: disable[1] } }] };
  if (/\b(?:open|show)\b.*\b(?:cognitive workflow|vocabulary|higher-order|pull request)\b/i.test(value)) {
    const tab = /\bvocabulary\b/i.test(value) ? "vocabulary" : /\bpull request\b/i.test(value) ? "pull-request" : /\bhigher-order\b/i.test(value) ? "higher-order" : "integrate";
    return { title: "Open Cognitive Workflow Studio", steps: [{ verb: "openCognitiveWorkflowStudio", args: { tab } }] };
  }
  const extract = value.match(/\bextract\b.*\b(?:move|function|lens|all three|all)\b.*\bfrom\s+(?:this\s+)?(.+)$/i);
  if (extract) return { title: "Open grounded extraction proposal", steps: [{ verb: "openCognitivePullRequest", args: { source: extract[1], kinds: ["move", "function", "lens"] } }] };
  const packageOpen = /\b(?:open|browse|show)\b.*\bpackages?\b/i.test(value);
  if (packageOpen) return { title: "Open Cognitive Packages", steps: [{ verb: "openPackageRegistry", args: {} }] };
  return null;
}

export function parseFunctionCreationCommand(text) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  if (!/\b(?:create|make|build)\b/i.test(value) || !/\bfunction\b/i.test(value)) return null;
  const investment = /\binvestment memo\b/i.test(value);
  const spielberg = /\b(?:movie|film)\b/i.test(value) && /\bsteven spielberg\b/i.test(value);
  if (!investment && !spielberg) return null;
  const steps = [];
  if (investment) {
    steps.push({
      verb: "createFunction",
      args: {
        name: "Investment memo",
        description: "Produce an evidence-grounded investment memo with an explicit recommendation.",
        steps: [
          { name: "Frame the thesis", description: "State the opportunity, timing, and key underwriting question." },
          { name: "Assess market and moat", description: "Evaluate market structure, differentiation, and durability." },
          { name: "Evaluate team and traction", description: "Assess execution capability and evidence of demand." },
          { name: "Build risk ledger", description: "Name disconfirming evidence, failure modes, and mitigations." },
          { name: "Write recommendation", description: "Synthesize an invest or pass memo with confidence and open questions." },
        ],
      },
    });
  }
  if (spielberg) {
    steps.push({
      verb: "createFunction",
      args: {
        name: "Spielberg film evaluation",
        description: "Analyze a film using observable criteria associated with Steven Spielberg's body of work, without claiming his private judgment.",
        steps: [
          { name: "Audience identification", description: "Evaluate emotional access, wonder, fear, and point of view." },
          { name: "Visual storytelling", description: "Assess staging, blocking, suspense, and information revealed through images." },
          { name: "Character and moral tension", description: "Examine relationships, ethical stakes, and earned sentiment." },
          { name: "Set-piece construction", description: "Evaluate escalation, clarity, rhythm, and consequence." },
          { name: "Synthesize evaluation", description: "Summarize strengths, weaknesses, and the most useful revision." },
        ],
      },
    });
  }
  return { title: steps.length > 1 ? "Create two Functions" : `Create ${steps[0].args.name}`, steps };
}

export function parseParallelBranchCommand(text) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  if (!/\bbranch\s*a\b/i.test(value) || !/\bbranch\s*b\b/i.test(value) || !/\bbranch\s*c\b/i.test(value)) return null;
  const branch = (letter, fallback) => value.match(new RegExp(`branch\\s*${letter}\\s*[:—-]\\s*([^;,.]+)`, "i"))?.[1]?.trim() || fallback;
  return {
    verb: "setGenerationPlan",
    args: {
      artifact: "last",
      branchSpecs: [
        { id: "branch-a", name: "Optimistic growth perspective", instruction: branch("a", "optimistic"), requestedModel: "auto" },
        { id: "branch-b", name: "Conservative downside perspective", instruction: branch("b", "conservative"), requestedModel: "auto" },
        { id: "branch-c", name: "Opposition inverted perspective", instruction: branch("c", "inverted opposition perspective"), requestedModel: "auto" },
      ],
    },
  };
}

export function parseSafeDemonstrationCommand(text, empty = false) {
  const value = String(text || "").trim();
  if (!/\b(?:show me what you can do|do anything|give me anything)\b/i.test(value)) return null;
  return empty
    ? { demoId: "safe-capability-sample", chooser: false }
    : { demoId: "three-layers", chooser: false };
}

export function parseTasteNavigationCommand(text) {
  const value = String(text || "").trim().toLowerCase();
  if (/^(?:yes|keep this|accept this)$/.test(value)) return { verb: "tasteCandidate", args: { decision: "yes" } };
  if (/^(?:no|reject this|not this one)$/.test(value)) return { verb: "tasteCandidate", args: { decision: "no" } };
  if (/^(?:more like this|make more like this)$/.test(value)) return { verb: "moreLikeThis", args: {} };
  if (/^(?:keep all|accept all)$/.test(value)) return { verb: "keepAllCandidates", args: {} };
  if (/^(?:extend these|extend selected|more from these)$/.test(value)) return { verb: "extendSelectedCandidates", args: {} };
  if (/^(?:stop|stop generation)$/.test(value)) return { verb: "stopGenerationBatch", args: {} };
  return null;
}

export function parseTranscriptLearningCommand(text) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  if (!value || !/\b(chat|conversation|transcript)\b/i.test(value)) return null;
  if (/\b(?:open|show|start)\b/i.test(value) && /\b(?:learn|extract|turn|make)\b/i.test(value)) {
    return { verb: "openTranscriptLearning", args: {} };
  }
  const all = /\b(?:all three|move,? function,? and lens|everything)\b/i.test(value);
  const kind = all ? "all" : /\blens\b/i.test(value) ? "lens" : /\bfunction\b/i.test(value) ? "function" : /\bmove\b/i.test(value) ? "move" : null;
  if (kind && /\b(?:turn|extract|make|generate|learn)\b/i.test(value)) {
    return { verb: "chooseTranscriptArtifacts", args: { kind }, followup: { verb: "generateTranscriptArtifacts", args: {} } };
  }
  return null;
}

const COMMAND_LEAD =
  /^(?:please\s+)?(?:add|apply|attach|branch|build|capture|change|clear|close|create|delete|do|draw|edit|erase|fit|focus|fork|get rid|graduate|highlight|make|merge|move|open|organize|pan|probe|remove|rename|research|run|save|select|share|show|start|switch|turn|walk|wipe|zoom)\b/i;

export function parseMixedProfileCommand(text, field = "identity") {
  if (!["identity", "role"].includes(field)) return null;
  const value = String(text || "").replace(/[’]/g, "'").replace(/\s+/g, " ").trim();
  if (!value) return null;

  const commandLead = new RegExp(`\\b${COMMAND_LEAD.source.replace(/^\^/, "").replace(/\\b\/i?$/, "")}`, "i");
  const desire = value.match(/\s+(?:and\s+)?i\s+(?:want|need|would like)\s+(?:you\s+to\s+)?/i);
  const punctuated = value.match(/[.!?—–-]\s*(?=(?:please\s+)?(?:add|apply|attach|branch|build|create|edit|make|merge|run|share|show)\b)/i);
  const lead = value.match(commandLead);
  const split =
    desire && desire.index > 0
      ? { index: desire.index, commandIndex: desire.index + desire[0].length }
      : punctuated && punctuated.index > 0
        ? { index: punctuated.index, commandIndex: punctuated.index + punctuated[0].length }
        : lead && lead.index > 0
          ? { index: lead.index, commandIndex: lead.index }
          : null;
  if (!split) return null;

  const profileText = value.slice(0, split.index).replace(/[,\s—–-]+$/g, "").trim();
  const command = value.slice(split.commandIndex).trim();
  if (!profileText || !command) return null;

  const profile = {};
  const namedRole = profileText.match(
    /^(?:i[' ]?m|i am)\s+([^,]+?),?\s+(?:a|an)\s+(.+)$/i
  );
  const roleOnly = profileText.match(/^(?:i[' ]?m|i am)\s+(?:a|an)\s+(.+)$/i);
  const invests = profileText.match(/^i\s+invest\s+in\s+(.+)$/i);
  if (namedRole) {
    profile.identity = namedRole[1].trim();
    profile.role = namedRole[2].trim();
  } else if (roleOnly) {
    profile.role = roleOnly[1].trim();
  } else if (invests) {
    profile.role = `investor in ${invests[1].trim()}`;
  } else {
    return null;
  }
  return { kind: "mixed", profile, command };
}

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
  const mixed = parseMixedProfileCommand(text, field);
  if (mixed) return mixed;
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

/** Local fast path for the public extension download surface. */
export function parseExtensionDownloadCommand(text) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (
    /\b(?:download|get|install|export|send|transfer)\b/i.test(normalized) &&
    /\b(?:pearl everywhere|lens everywhere|chrome extension|browser extension|library)\b/i.test(normalized)
  ) {
    return { kind: "open-extension-download" };
  }
  return null;
}

/** Deterministic path for common, high-confidence output-contract edits. */
export function parseFunctionOutputCommand(text) {
  const value = String(text || "").replace(/[’]/g, "'").replace(/\s+/g, " ").trim();
  if (!value || !/\b(output|branch|suggested output|output contract)\b/i.test(value)) return null;
  const op = value.match(/\b(?:function|lens)\s+(?:called|named)\s+["“]?([^"”]+?)["”]?(?:\s+(?:output|to|from)|$)/i)?.[1]?.trim() || "last";
  if (/\b(?:show|inspect|what does|what is)\b/i.test(value) && /\boutput/i.test(value)) {
    return { verb: "inspectFunctionOutput", args: { op } };
  }
  if (/\breset\b/i.test(value) && /\b(?:suggested|default)\s+output/i.test(value)) {
    return { verb: "resetFunctionOutput", args: { op } };
  }
  if (/\bderive\b/i.test(value) && /\b(?:branch|child|step)/i.test(value)) {
    return { verb: "setFunctionOutputMode", args: { op, mode: "derived" } };
  }
  if (/\b(?:override|explicit)\b/i.test(value) && /\boutput/i.test(value)) {
    return { verb: "setFunctionOutputMode", args: { op, mode: "override" } };
  }
  const namedBranch = value.match(
    /\b(?:change|make|set|edit)\s+(?:the\s+)?(first|second|third|\d+(?:st|nd|rd|th)?)\s+(?:output\s+)?branch(?:\s+output)?\s+(?:of|on)\s+(?:(?:function|move)\s+)?(?:called|named)?\s*["“]?(.+?)["”]?\s+(?:to|as)\s+(?:a|an)?\s*([^,.;]+)$/i
  );
  if (namedBranch) {
    const positions = { first: 1, second: 2, third: 3 };
    const branchNumber = positions[namedBranch[1].toLowerCase()] || Number.parseInt(namedBranch[1], 10);
    const label = namedBranch[3].trim();
    const machineKind = /\btable\b/i.test(label) ? "table"
      : /\blist\b/i.test(label) ? "list"
        : /\bimage\b/i.test(label) ? "image"
          : /\blink\b/i.test(label) ? "link"
            : undefined;
    return {
      verb: "editFunctionBranchOutput",
      args: { op: namedBranch[2].trim(), branch: branchNumber, label, ...(machineKind ? { machineKind } : {}) },
    };
  }
  const branch = value.match(/\b(?:change|make|set|edit)\s+(?:the\s+)?(first|second|third|\d+(?:st|nd|rd|th)?)\s+(?:output\s+)?branch(?:\s+output)?\s+(?:to|as)\s+(?:a|an)?\s*([^,.;]+)$/i);
  if (branch) {
    const positions = { first: 1, second: 2, third: 3 };
    const branchNumber = positions[branch[1].toLowerCase()] || Number.parseInt(branch[1], 10);
    const label = branch[2].trim();
    const machineKind = /\btable\b/i.test(label) ? "table"
      : /\blist\b/i.test(label) ? "list"
        : /\bimage\b/i.test(label) ? "image"
          : /\blink\b/i.test(label) ? "link"
            : undefined;
    return { verb: "editFunctionBranchOutput", args: { op, branch: branchNumber, label, ...(machineKind ? { machineKind } : {}) } };
  }
  const output = value.match(/\b(?:make|set|change|edit)\b.+?\boutput(?:s|\s+type)?\s+(?:to|as)?\s*(.+)$/i);
  if (output) {
    const labels = output[1]
      .split(/\s+(?:and|AND)\s+|,\s*/)
      .map((entry) => entry.replace(/^(?:an?|the)\s+/i, "").trim())
      .filter(Boolean)
      .slice(0, 12);
    if (labels.length > 1) return { verb: "editFunctionOutput", args: { op, outputs: labels } };
    if (labels.length === 1) return { verb: "editFunctionOutput", args: { op, semanticType: labels[0] } };
  }
  return null;
}

/** Deterministic path for common before/after lens-authoring requests. */
export function parseBeforeAfterCommand(text) {
  const value = String(text || "").replace(/[’]/g, "'").replace(/\s+/g, " ").trim();
  if (!value) return null;
  if (/\b(?:add|give|show)\s+(?:me\s+)?another\s+(?:before\s*(?:\/|and)\s*after\s+)?example\b/i.test(value)) {
    return { verb: "addBeforeAfterExample", args: {} };
  }
  if (
    /\b(?:make|create|build|learn)\b/i.test(value) &&
    /\b(?:lens|function|transformation|move)\b/i.test(value) &&
    /\bbefore\s*(?:\/|and|&)?\s*after\b/i.test(value)
  ) {
    return { verb: "openBeforeAfterCreation", args: {} };
  }
  if (
    /\b(?:infer|re-infer|learn|figure out)\b/i.test(value) &&
    (/\b(?:transformation|operation)\b/i.test(value) || /\bbefore\b/i.test(value) || /\bafter\b/i.test(value))
  ) {
    return { verb: "inferBeforeAfterTransformation", args: {} };
  }
  const set = value.match(/\b(?:set|make|use)\s+(?:the\s+)?(before|after)(?:\s+text)?\s+(?:to|as)\s+(.+)$/i);
  if (set) return { verb: "setBeforeAfterText", args: { side: set[1].toLowerCase(), text: set[2].trim() } };
  if (/\bthis\s+(?:image|drawing|text|selection)\s+became\s+that\s+(?:image|drawing|text|selection)\b/i.test(value)) {
    return { verb: "openBeforeAfterCreation", args: {} };
  }
  return null;
}

export function buildCompanionSystemPrompt({ demos = [], functionNames = [], itemPreviews = [] } = {}) {
  const verbDoc = capabilityPrompt();
  const demoDoc = demos.map((d) => `- id "${d.id}": ${d.title} — ${d.blurb}`).join("\n");
  return `You are the companion inside "lens", a thinking tool with a library rail, paper workspace, and AI space. The canonical library order and meaning are: MOVES are one atomic action and exactly one model call; FUNCTIONS are reusable ordered or branched processes made from Moves or Functions; LENSES are bounded contextual worldviews and emerging material structures that scope how Moves and Functions interpret work. Primitive Moves appear first in branch selection; Lenses are context and never branch actions. Everything executable is demonstrated live with an animated ghost cursor so the user learns by watching.

You translate the user's request into a JSON script of director verbs. Available verbs:
${verbDoc}

Existing Moves and Functions on the user's rail: ${functionNames.length ? functionNames.join(", ") : "(none yet)"}
Objects currently on the page: ${itemPreviews.length ? itemPreviews.map((p) => `"${p}"`).join(", ") : "(empty page)"}

Prebuilt demonstrations you can play instead of writing a script:
${demoDoc || "(none)"}

Reply with ONLY a JSON object, no prose, no code fences:
{"say": "empty for executable actions; only a required choice, answer, or precise blocker", "demoId": "id-if-a-prebuilt-demo-fits-best", "steps": [{"verb": "...", "args": {...}}, ...]}

Rules:
- Action-first: for every executable request, set "say" to "" and emit the steps immediately. Do not acknowledge, praise, summarize, or announce what you will do.
- Use captions only as terse operation/target labels when the visual action would otherwise be ambiguous. Never narrate or explain routine steps.
- If a prebuilt demo answers a "how do I / show me" question, return demoId and empty steps.
- Move means one atomic instruction and exactly one model call. Use createMove/applyMove. Function means an ordered, branched, or nested process. Use createFunction/applyFunction for multi-step work. Lens means bounded context/a way of seeing; it is not an action.
- Never promise unsupported actions. Only claim an action was done when a listed verb executes it. For a missing capability, say exactly which action is unavailable and return no steps.
- Function structure can FORK into multiple typed outputs — a branch point runs shared steps once, then each branch continues from that intermediate result. Build with createFunction/addFunctionStep/addFunctionBranch/setFunctionStep/saveFunction.
- Lens lifecycle: createLens creates an empty or emerging context workspace; addLensMaterial collects contextual evidence; nameLens names it; probeLens tests its perspective in another domain; inferFunctionFromLens may derive a process while preserving the Lens.
- For bulk deletion, call clearWorkspaceDomains once with every requested domain. It only stages a confirmation; destructive clearing never happens without the user's explicit confirmation. "Functions" means user-created lenses.
- Multi-part and hard requests are plans: compose as many available verbs as needed in dependency order (for example create material → create/apply a lens → focus or transfer the AI result). Prefer a valid sequence over claiming no single verb exists. A failed nonfatal step is skipped and the rest continue.
- Selection is cross-domain: the persistent highlighter can include paper material, AI nodes, Moves, Functions, Lenses, and exact text fragments. Moves and Functions are executable actions; Lenses are spatial bounded context and never branch actions.
- Do not add conversational caption steps. The animation itself is the response.
- Use "last" to refer to the thing just created. Use text fragments to refer to existing items/functions.
- Keep scripts under 40 steps. Never invent verbs. If the request is a pure question, answer it in "say" with empty steps.`;
}

export function buildAdaptiveCompanionPrompt({
  workspaceContext = "{}",
  autonomy = "preview-complex",
  mode = "agent",
  goal = null,
} = {}) {
  const retrievalQuery = [
    goal?.rawWording,
    ...(goal?.outcomes || []),
    ...(goal?.constraints || []),
    ...(goal?.references || []),
  ].filter(Boolean).join(" ");
  const retrievedCapabilities = capabilityContextPrompt(retrievalQuery, { platform: "app", limit: 24 });
  return `You are the action planner inside lens. Plan against the live authorized workspace index and canonical capabilities below. Never invent IDs, capabilities, sources, or completed actions.

MODE (enforced by executor): ${mode}
GOAL ENVELOPE:
${JSON.stringify(goal || {}, null, 2)}

WORKSPACE:
${workspaceContext}

RETRIEVED CAPABILITIES (versioned subset selected from the canonical graph):
${retrievedCapabilities}

Return ONLY one versioned JSON plan:
{"version":1,"title":"short visual label","root":{"kind":"sequence","steps":[]}}

Step DSL:
- {"kind":"query","id":"observe-1","query":"objects|selection|graph|clusters|history|library|viewport|material|dependencies|versions|spatial|temporal","filter":{},"saveAs":"name"}. Query names are an exact enum; never emit any other value.
- {"kind":"action","id":"unique-step-id","capability":"manifestName","args":{},"saveAs":"optionalResultBinding"}
- A result reference is {"$ref":"binding"}. It resolves from the live result environment to the actual stable saved ID. Never put saveAs inside args; saveAs is a property of the step.
- {"kind":"sequence","steps":[]}
- {"kind":"parallel","steps":[]} (read/evaluate/research only)
- {"kind":"foreach","in":"savedArray","limit":10,"step":{}}, using "$item.id" for stable action targets
- {"kind":"conditional","if":{"ref":"$name","exists":true},"then":{},"else":{}}
- {"kind":"retry","limit":2,"step":{}}
- {"kind":"evaluate","target":"$savedOrStableId","criteria":["criterion"],"saveAs":"evaluation"}
- {"kind":"research","question":"...","scope":"web","recency":"...","maxSources":5,"saveAs":"research"}
- {"kind":"checkpoint","mode":"save|confirm","label":"..."}
- {"kind":"artifact","from":"savedResult","placement":"paper|ai|lens|beside-target","target":"stable-id"}
- {"kind":"phase|todo","id":"...","steps":[]}
- {"kind":"transaction","id":"...","steps":[],"postconditions":[],"compensation":"restore-checkpoint"}
- {"kind":"migration","id":"...","affectedIds":["stable-id"],"steps":[]}
- {"kind":"approval","id":"...","scope":"phase|object|branch|migration|external-write|publish","affectedIds":[]}
- {"kind":"assert","id":"...","condition":{"ref":"$name","exists":true},"message":"..."}
- {"kind":"worker","id":"...","worker":"explore|research|evaluator|visual-auditor|migration-analyst|privacy-reviewer","saveAs":"proposal"}. Mutating workers additionally require candidateSnapshotId.

Framework action metadata (never place these keys inside args):
${companionActionMetadataPrompt()}

Rules:
- Action-first and silent. The plan itself is the response; do not add conversational text.
- Every executable leaf step must have a unique id. If an action creates a Move, Function, Lens, block, node, path, or other resource used later, give it a saveAs binding and use {"$ref":"binding"} in dependent arguments.
- Never treat Move, Function, and Lens as synonyms. “Save this text as a Move” means saveCurrentAsMove and preserves text verbatim. “Save how I got here as a Function” means captureLineageAsFunction and uses only contributing lineage. “Collect these in a Lens” means bounded context material.
- A Taste Lens is the canonical Lens with purpose "taste/judgment", never a separate object or an action. For “save this to my taste Lens for writing,” resolveTasteLens first, preview the interpretation, then use saveTasteTeaching only when explicitSave is true. Ordinary yes/no remains session-private.
- “Looks AI generated” is never an authorship detector claim. Translate it into editable observable anti-pattern proposals and retain uncertainty. Applying taste uses evaluateThroughTasteLens followed by an explicit preserve-original revision Move/Function; a run-specific preserve constraint does not mutate the saved Lens.
- Historical/persona creativity must research first, keep sourced facts separate from inferred operations, and pass verified sources plus distinct synthesized patterns to createCreativeResearchProposal. If verified research is unavailable, block factual attribution or offer only an explicitly speculative exercise.
- Dependency steps must be sequential. A create/use/compose plan may not put mutations in parallel.
- Observe before acting when references are ambiguous. Use stable IDs from the snapshot.
- The retrieved list is the only executable tool subset for this planning pass. If it lacks a prerequisite, return a precise blocker so the host can retrieve again; never invent a verb.
- Compose generic transformMaterial, arrangeItems, groupItems, linkItems, and annotateFeedback capabilities instead of prompt-specific tricks.
- Evaluation/reflection must end in an artifact or a real revision. Research must end in a cited visible artifact and may only be used when requested or materially authorized.
- Follow each capability's generated confirmation annotation. Handler-confirmed actions stage the app's normal counted confirmation and MUST omit confirmed. Framework-confirmed actions use top-level action.confirmed only after explicit approval. Never place confirmed inside args.
- Preserve originals before broad revisions. Use finite loops/retries. Do not exceed 40 total steps, 100 iterations, or 3 research calls.
- Current autonomy preference is "${autonomy}".
- Ask mode contains no action, artifact, or mutation. Plan mode remains blocked until accepted. Debug mode starts with multiple explicit hypotheses and evidence-producing observation before the smallest fix and regression assertions.

Dependency examples:
Create A + B + combine + demonstrate:
{"version":1,"title":"Build team investment workflow","root":{"kind":"sequence","steps":[
  {"kind":"action","id":"create-memo","capability":"createFunction","args":{"name":"Investment memo workflow","description":"Automate an evidence-grounded investment memo","steps":[{"name":"Collect thesis and evidence"},{"name":"Assess risks"},{"name":"Draft memo"}]},"saveAs":"memoFunction"},
  {"kind":"action","id":"create-evaluation","capability":"createFunction","args":{"name":"Company evaluation workflow","description":"Evaluate a company consistently","steps":[{"name":"Market"},{"name":"Team"},{"name":"Traction"},{"name":"Risks"}]},"saveAs":"evaluationFunction"},
  {"kind":"action","id":"combine","capability":"mergeFunctions","args":{"a":{"$ref":"memoFunction"},"b":{"$ref":"evaluationFunction"},"name":"Investment workflow for teams"},"saveAs":"teamFunction"},
  {"kind":"action","id":"sample","capability":"spawnText","args":{"text":"Demo input — Northstar Analytics, a sample B2B analytics company with early revenue and limited retention data."},"saveAs":"sampleCompany"},
  {"kind":"action","id":"run","capability":"applyFunction","args":{"op":{"$ref":"teamFunction"},"target":{"$ref":"sampleCompany"}}},
  {"kind":"action","id":"focus","capability":"focusAiResult","args":{}}
]}}

Create Lens + attach + infer:
{"version":1,"title":"Build contextual Lens","root":{"kind":"sequence","steps":[
  {"kind":"action","id":"lens","capability":"createLens","args":{"contextPolicy":"bounded"},"saveAs":"lens"},
  {"kind":"action","id":"material","capability":"spawnText","args":{"text":"New observation"},"saveAs":"material"},
  {"kind":"action","id":"attach","capability":"addLensMaterial","args":{"lens":{"$ref":"lens"},"target":{"$ref":"material"}}},
  {"kind":"action","id":"craft","capability":"inferFunctionFromLens","args":{"lens":{"$ref":"lens"}},"saveAs":"craftedFunction"}
]}}

Create blocks + operate:
{"version":1,"title":"Compare new blocks","root":{"kind":"sequence","steps":[
  {"kind":"action","id":"block-a","capability":"addBlock","args":{"type":"text","text":"Option A"},"saveAs":"blockA"},
  {"kind":"action","id":"block-b","capability":"addBlock","args":{"type":"text","text":"Option B"},"saveAs":"blockB"},
  {"kind":"action","id":"compare","capability":"transformMaterial","args":{"mode":"compare","targets":[{"$ref":"blockA"},{"$ref":"blockB"}]}}
]}}`;
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

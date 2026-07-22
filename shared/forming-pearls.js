/**
 * Discover ≤5 “already forming” pearls from imported chats, docs, or drafts.
 * Surfaces re-asked questions, redone prompts, recurring cognitive ops, and frames.
 * Deterministic clustering — no model required for the structural proposal.
 */

import { parseTranscript } from "./transcript-learning.js";
import { PEARL_STUDIO_COGNITIVE_SECTION_ORDER } from "./pearl-studio.js";

export const FORMING_PEARLS_VERSION = 1;
export const MAX_FORMING_PEARLS = 5;

const OP_PATTERNS = Object.freeze([
  { id: "summarize", label: "Summarize", re: /\b(?:summariz|tldr|tl;dr|digest|condense)\w*\b/i },
  { id: "rewrite", label: "Rewrite", re: /\b(?:rewrit|rephras|edit|polish|tighten)\w*\b/i },
  { id: "critique", label: "Critique", re: /\b(?:critiqu|review|feedback|evaluate|assess)\w*\b/i },
  { id: "compare", label: "Compare", re: /\b(?:compar|contrast|versus|vs\.?)\b/i },
  { id: "plan", label: "Plan", re: /\b(?:plan|roadmap|outline|steps?|checklist)\b/i },
  { id: "research", label: "Research", re: /\b(?:research|sources?|cite|evidence|look up)\b/i },
  { id: "brainstorm", label: "Brainstorm", re: /\b(?:brainstorm|ideat|options?|alternatives?)\b/i },
  { id: "explain", label: "Explain", re: /\b(?:explain|teach|eli5|walk me through)\b/i },
  { id: "code", label: "Code", re: /\b(?:code|implement|debug|refactor|typescript|python|api)\b/i },
  { id: "theology", label: "Theology", re: /\b(?:god|theology|scripture|prayer|faith|liturg)\w*\b/i },
  { id: "creativity", label: "Creativity", re: /\b(?:creativ|poem|story|metaphor|imagina)\w*\b/i },
]);

const FRAME_PATTERNS = Object.freeze([
  { id: "as-role", label: "Role frame", re: /\bas (?:a|an|the) ([a-z][a-z0-9 -]{2,40})\b/i },
  { id: "from-angle", label: "Angle frame", re: /\bfrom (?:a |the )?([a-z][a-z0-9 -]{2,40}) (?:perspective|angle|lens|view)\b/i },
  { id: "in-style", label: "Style frame", re: /\bin the style of ([a-z][a-z0-9 -]{2,40})\b/i },
]);

const bounded = (value, limit = 280) => String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);

function tokenize(value) {
  return bounded(value, 8_000)
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length > 2);
}

function jaccard(a, b) {
  const left = new Set(a);
  const right = new Set(b);
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const token of left) if (right.has(token)) overlap += 1;
  return overlap / (left.size + right.size - overlap);
}

function normalizeQuestion(text) {
  return bounded(text, 400)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s?]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function materialUnits(input) {
  if (input?.messages) {
    return input.messages
      .filter((message) => message.included !== false && message.role === "user")
      .map((message, index) => ({
        id: message.id || `turn-${index + 1}`,
        kind: /\?/.test(message.content) ? "question" : "prompt",
        text: bounded(message.content, 1_200),
        tokens: tokenize(message.content),
      }));
  }
  const raw = String(input?.text || input || "").trim();
  if (!raw) return [];
  return raw
    .split(/\n{2,}|(?<=[.!?])\s+(?=[A-Z])/u)
    .map((chunk) => bounded(chunk, 1_200))
    .filter((chunk) => chunk.length > 24)
    .slice(0, 120)
    .map((text, index) => ({
      id: `chunk-${index + 1}`,
      kind: /\?/.test(text) ? "question" : "prompt",
      text,
      tokens: tokenize(text),
    }));
}

function detectOps(text) {
  return OP_PATTERNS.filter((entry) => entry.re.test(text)).map((entry) => ({
    id: entry.id,
    name: entry.label,
    kind: "move",
  }));
}

function detectFrames(text) {
  const frames = [];
  for (const pattern of FRAME_PATTERNS) {
    const match = text.match(pattern.re);
    if (match) {
      frames.push({
        id: `${pattern.id}:${bounded(match[1] || pattern.id, 40).toLowerCase().replace(/\s+/g, "-")}`,
        name: bounded(match[1] || pattern.label, 64),
        kind: "lens",
        frame: pattern.id,
      });
    }
  }
  return frames;
}

function clusterUnits(units) {
  const clusters = [];
  for (const unit of units) {
    let best = null;
    let bestScore = 0;
    for (const cluster of clusters) {
      const score = jaccard(unit.tokens, cluster.tokens);
      if (score > bestScore) {
        bestScore = score;
        best = cluster;
      }
    }
    if (best && bestScore >= 0.22 && best.members.length < 24) {
      best.members.push(unit);
      best.tokens = [...new Set([...best.tokens, ...unit.tokens])].slice(0, 48);
      continue;
    }
    clusters.push({
      id: `cluster-${clusters.length + 1}`,
      members: [unit],
      tokens: [...unit.tokens].slice(0, 48),
    });
  }
  return clusters;
}

function scoreCluster(cluster) {
  const texts = cluster.members.map((entry) => entry.text);
  const ops = new Map();
  const frames = new Map();
  let questionRepeats = 0;
  const seenQuestions = [];
  for (const member of cluster.members) {
    for (const op of detectOps(member.text)) ops.set(op.id, op);
    for (const frame of detectFrames(member.text)) frames.set(frame.id, frame);
    if (member.kind === "question") {
      const normalized = normalizeQuestion(member.text);
      if (seenQuestions.some((prior) => jaccard(tokenize(prior), tokenize(normalized)) >= 0.55)) questionRepeats += 1;
      else seenQuestions.push(normalized);
    }
  }
  const promptRepeats = Math.max(0, cluster.members.length - new Set(texts.map(normalizeQuestion)).size);
  const score = cluster.members.length * 2
    + ops.size * 3
    + frames.size * 3
    + questionRepeats * 4
    + promptRepeats * 3;
  return {
    ...cluster,
    ops: [...ops.values()],
    frames: [...frames.values()],
    questionRepeats,
    promptRepeats,
    score,
  };
}

function pearlName(cluster) {
  if (cluster.frames[0]?.name) return bounded(`${cluster.frames[0].name} pearl`, 64);
  if (cluster.ops[0]?.name) return bounded(`${cluster.ops[0].name} thread`, 64);
  const seed = cluster.members[0]?.text || "Forming pearl";
  return bounded(seed.replace(/^(please\s+)?/i, "").replace(/[.?!].*$/, "").slice(0, 48) || "Forming pearl", 64);
}

function organizePearl(cluster, index) {
  const name = pearlName(cluster);
  const evidence = cluster.members.slice(0, 8).map((member) => ({
    id: member.id,
    kind: member.kind,
    label: bounded(member.text.split(/[.?\n]/)[0] || member.kind, 80),
    text: member.text,
  }));
  const moves = cluster.ops.length
    ? cluster.ops.map((op) => ({
      id: `move:${op.id}`,
      name: op.name,
      description: bounded(`Recurring cognitive operation: ${op.name}`, 160),
      kind: "move",
    }))
    : [{
      id: "move:revisit",
      name: "Revisit pattern",
      description: "Return to this recurring question or prompt with fresh material.",
      kind: "move",
    }];
  const functions = cluster.members.length >= 2 || cluster.ops.length >= 2
    ? [{
      id: `function:${cluster.id}`,
      name: bounded(`${name} process`, 72),
      description: bounded(
        `Replay the recurring ${cluster.ops.map((op) => op.name).join(" → ") || "prompt"} pattern evidenced ${cluster.members.length} times.`,
        220,
      ),
      steps: cluster.members.slice(0, 6).map((member, stepIndex) => ({
        name: bounded(member.text.split(/[.?\n]/)[0] || `Step ${stepIndex + 1}`, 72),
        prompt: member.text,
        evidenceRefs: [member.id],
      })),
      kind: "function",
    }]
    : [];
  const lenses = cluster.frames.length
    ? cluster.frames.map((frame) => ({
      id: frame.id,
      name: frame.name,
      description: bounded(`Recurring angle/frame: ${frame.name}`, 160),
      kind: "lens",
      strength: 0.7,
    }))
    : [{
      id: `lens:${cluster.id}`,
      name: bounded(`${name} awareness`, 64),
      description: "How this thread sees the user and the problem space.",
      kind: "lens",
      strength: 0.65,
    }];
  return {
    provisionalId: `forming:${index + 1}:${cluster.id}`,
    name,
    discovery: {
      score: cluster.score,
      memberCount: cluster.members.length,
      questionRepeats: cluster.questionRepeats,
      promptRepeats: cluster.promptRepeats,
      signals: [
        cluster.questionRepeats ? "re-asked questions" : null,
        cluster.promptRepeats ? "redone prompts" : null,
        cluster.ops.length ? "repeating cognitive ops" : null,
        cluster.frames.length ? "recurring angles/frames" : null,
      ].filter(Boolean),
    },
    organization: {
      order: [...PEARL_STUDIO_COGNITIVE_SECTION_ORDER],
      moves,
      functions,
      lenses,
    },
    pearl: {
      name,
      representation: {
        kind: functions.length ? "function" : "grouped-context",
        label: name,
        discovery: "forming-pearls",
      },
      workingSet: {
        context: evidence,
        lenses: lenses.map((lens) => ({ id: lens.id, name: lens.name, strength: lens.strength })),
      },
      moves,
      functions,
      lenses,
      provenance: {
        formingPearls: {
          version: FORMING_PEARLS_VERSION,
          clusterId: cluster.id,
          signals: [
            cluster.questionRepeats ? "re-asked-questions" : null,
            cluster.promptRepeats ? "redone-prompts" : null,
            cluster.ops.length ? "recurring-ops" : null,
            cluster.frames.length ? "recurring-frames" : null,
          ].filter(Boolean),
        },
      },
    },
  };
}

/**
 * @param {string|object} input Transcript object, pasted chat, or freeform docs/drafts
 * @param {{ maxPearls?: number, source?: string }} [options]
 */
export function discoverFormingPearls(input, options = {}) {
  const maxPearls = Math.min(
    MAX_FORMING_PEARLS,
    Math.max(1, Number.isInteger(options.maxPearls) ? options.maxPearls : MAX_FORMING_PEARLS),
  );
  let units = [];
  let source = options.source || "import";
  try {
    if (typeof input === "string" || input?.messages || input?.mapping || input?.chat_messages) {
      const transcript = typeof input === "string" || !input?.messages
        ? parseTranscript(input, { source })
        : input;
      units = materialUnits(transcript);
      source = transcript.source || source;
    } else if (input?.text) {
      units = materialUnits(input);
    }
  } catch {
    units = materialUnits({ text: String(input?.text || input || "") });
  }
  if (!units.length) {
    return {
      version: FORMING_PEARLS_VERSION,
      source,
      maxPearls,
      pearls: [],
      reason: "No reusable questions, prompts, or drafts were found in the import.",
    };
  }
  const scored = clusterUnits(units)
    .map(scoreCluster)
    .sort((a, b) => b.score - a.score || b.members.length - a.members.length);
  const selected = scored.slice(0, maxPearls);
  // Prefer denser clusters; if only one sparse cluster, still return one pearl.
  const pearls = selected
    .filter((cluster, index) => index === 0 || cluster.score >= 4 || cluster.members.length >= 2)
    .slice(0, maxPearls)
    .map((cluster, index) => organizePearl(cluster, index));
  return {
    version: FORMING_PEARLS_VERSION,
    source,
    maxPearls,
    pearls,
    discardedClusterCount: Math.max(0, scored.length - pearls.length),
    reason: pearls.length
      ? `Found ${pearls.length} forming pearl${pearls.length === 1 ? "" : "s"} (capped at ${maxPearls}).`
      : "Import did not yield a stable recurring pattern yet.",
    organizationOrder: [...PEARL_STUDIO_COGNITIVE_SECTION_ORDER],
  };
}

/** Compact metadata harness view for companion editing of a forming or semantic pearl. */
export function pearlMetadataHarness(pearl = {}) {
  const organization = pearl.organization || {
    order: [...PEARL_STUDIO_COGNITIVE_SECTION_ORDER],
    moves: pearl.moves || [],
    functions: pearl.functions || [],
    lenses: pearl.lenses || pearl.workingSet?.lenses || [],
  };
  return {
    version: FORMING_PEARLS_VERSION,
    pearlId: pearl.id || pearl.provisionalId || null,
    name: pearl.name || pearl.pearl?.name || "Untitled pearl",
    identity: {
      name: pearl.name || pearl.pearl?.name || "Untitled pearl",
      description: pearl.description || pearl.pearl?.description || "",
      representationKind: pearl.representation?.kind || pearl.pearl?.representation?.kind || "empty",
    },
    organization: {
      order: organization.order || [...PEARL_STUDIO_COGNITIVE_SECTION_ORDER],
      moves: organization.moves || [],
      functions: organization.functions || [],
      lenses: organization.lenses || [],
    },
    workingSet: {
      contextCount: (pearl.workingSet?.context || pearl.pearl?.workingSet?.context || []).length,
      lensCount: (pearl.workingSet?.lenses || pearl.pearl?.workingSet?.lenses || []).length,
    },
    provenance: pearl.provenance || pearl.pearl?.provenance || {},
    editablePaths: [
      "identity.name",
      "identity.description",
      "organization.moves",
      "organization.functions",
      "organization.lenses",
      "workingSet.context",
      "provenance.notes",
    ],
    bounds: {
      modelRequiredForOpenRewrite: true,
      deterministicOps: ["rename", "rearrange", "merge", "synthesize", "wear", "encode"],
      note: "Companion edits metadata through validated verbs; freeform rewrite needs credentials/model and must not fake mutation.",
    },
  };
}

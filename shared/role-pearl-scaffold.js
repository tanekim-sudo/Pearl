/**
 * Deterministic role → pearl scaffolds.
 * Prefer live research/model when credentials exist; always materialize a real
 * Moves → Functions → Lenses pearl that Studio can inspect — never an empty "Done".
 */

import { PEARL_STUDIO_COGNITIVE_SECTION_ORDER } from "./pearl-studio.js";
import { seedWeightsFromIntent } from "./pearl-weights.js";

export const ROLE_PEARL_SCAFFOLD_VERSION = 1;

const bounded = (value, limit = 280) => String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);

const MEMO_STEPS = Object.freeze([
  { name: "Frame the thesis", description: "State the opportunity, timing, and key underwriting question." },
  { name: "Assess market and moat", description: "Evaluate market structure, differentiation, and durability." },
  { name: "Evaluate team and traction", description: "Assess execution capability and evidence of demand." },
  { name: "Build risk ledger", description: "Name disconfirming evidence, failure modes, and mitigations." },
  { name: "Write recommendation", description: "Synthesize an invest or pass memo with confidence and open questions." },
]);

const DILIGENCE_STEPS = Object.freeze([
  { name: "Scope the diligence map", description: "List must-prove claims across product, market, team, and finance." },
  { name: "Collect primary evidence", description: "Capture customer, technical, and financial signals with provenance." },
  { name: "Stress-test assumptions", description: "Probe what would falsify the investment case." },
  { name: "Check competitive dynamics", description: "Map substitutes, switching costs, and defensibility over time." },
  { name: "Issue diligence findings", description: "Rank open items, blockers, and recommended next asks." },
]);

const INVESTOR_MOVES = Object.freeze([
  { id: "move:thesis", name: "Frame thesis", description: "State the underwriting question in one sentence.", kind: "move" },
  { id: "move:risks", name: "Surface risks", description: "List disconfirming evidence before advocacy.", kind: "move" },
  { id: "move:ask", name: "Craft next ask", description: "Convert uncertainty into a precise diligence question.", kind: "move" },
  { id: "move:memo-close", name: "Close the memo", description: "Recommend invest/pass with confidence and open questions.", kind: "move" },
]);

/**
 * Extract firm / fund signal from natural language (e.g. S32, Sequoia).
 */
export function extractInvestorFirm(text) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  if (!value) return null;
  const atFirm = value.match(/\b(?:investor|partner|associate|principal|gp)\s+at\s+([A-Za-z0-9][A-Za-z0-9.&'’/\-]{1,40})\b/i)
    || value.match(/\bat\s+([A-Za-z0-9][A-Za-z0-9.&'’/\-]{1,40})\b.+\binvestor\b/i)
    || value.match(/\b(?:firm|fund|vehicle)\s+(?:is|called|named)\s+([A-Za-z0-9][A-Za-z0-9.&'’/\-]{1,40})\b/i);
  if (atFirm?.[1]) {
    const firm = atFirm[1].replace(/[.,;:!?]+$/, "").trim();
    if (!/^(?:a|an|the|my|our|this|that)$/i.test(firm)) return firm;
  }
  return null;
}

/**
 * True when the utterance asks for an investor/role pearl with memo + diligence (or clear investor pearl research).
 */
export function looksLikeInvestorRolePearl(text) {
  const value = String(text || "").replace(/[’']/g, "'").replace(/\s+/g, " ").trim();
  if (!value) return false;
  // Style/taste/lens persona creates (Buffett, Plath, …) are prompt-harness seeds —
  // not the memo+diligence investor role scaffold.
  if (
    /\breflects?\b.+\b(?:style|taste|voice|thought\s+process)\b/i.test(value)
    || /\b(?:like|in the style of|inspired by)\b.+/i.test(value)
    || /\bstyle\b.+\btaste\b.+\blens\b/i.test(value)
  ) {
    return false;
  }
  const investor = /\binvestor\b/i.test(value) || /\binvest(?:ing|ment)?\b/i.test(value);
  const pearl = /\bpearl\b/i.test(value) || /\bresearch\b/i.test(value);
  const memo = /\binvestment\s+memo\b/i.test(value) || /\bmemo\s+function\b/i.test(value) || /\bmemo\b/i.test(value);
  const diligence = /\bdiligence\b/i.test(value);
  const lens = /\blens\b/i.test(value) || /\bas an investor\b/i.test(value);
  if (investor && pearl && memo && diligence) return true;
  if (investor && pearl && (memo || diligence) && lens) return true;
  if (investor && /\b(?:make|create|build|research)\b/i.test(value) && memo && diligence) return true;
  // Novice role ask — not "make a pearl about my investor notes" (topic create).
  if (
    /\binvestor pearl\b/i.test(value)
    && /\b(?:make|create|build|want|need|give)\b/i.test(value)
    && !/\babout\b/i.test(value)
  ) {
    return true;
  }
  if (
    /\b(?:make|create|build|give)\s+me\b/i.test(value)
    && investor
    && pearl
    && !/\babout\b/i.test(value)
  ) {
    return true;
  }
  return false;
}

/**
 * Build a deterministic S32 / investor pearl scaffold with Moves → Functions → Lenses.
 */
export function buildInvestorRolePearlScaffold(options = {}) {
  const utterance = bounded(options.utterance || options.text || "", 2_000);
  const firm = bounded(options.firm || extractInvestorFirm(utterance) || "investor", 64);
  const role = bounded(options.role || (firm === "investor" ? "investor" : `investor at ${firm}`), 120);
  const pearlName = bounded(
    options.name || (firm === "investor" ? "Investor pearl" : `${firm} investor pearl`),
    80,
  );
  const now = options.now || Date.now();
  const idPrefix = options.idPrefix || `role-pearl:${firm.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  const lens = {
    id: `${idPrefix}:lens`,
    name: bounded(firm === "investor" ? "Investor lens" : `${firm} investor lens`, 72),
    description: bounded(
      `Judgment frame of ${role}: underwrite with evidence, prioritize asymmetric upside, track disconfirming risk, and stay honest about conviction vs. open diligence.`,
      400,
    ),
    kind: "lens",
    strength: 0.9,
    judgment: {
      role,
      firm: firm === "investor" ? null : firm,
      caresAbout: ["team", "market structure", "moat", "traction evidence", "downside risk", "timing"],
      attractions: ["clear insight", "founder clarity", "durable differentiation"],
      concerns: ["hand-wavy TAM", "unfalsifiable claims", "missing customer proof"],
    },
  };

  const memoFunction = {
    id: `${idPrefix}:function:memo`,
    name: "Investment memo",
    description: "Produce an evidence-grounded investment memo with an explicit recommendation.",
    kind: "function",
    steps: MEMO_STEPS.map((step) => ({ ...step })),
  };

  const diligenceFunction = {
    id: `${idPrefix}:function:diligence`,
    name: "Diligence",
    description: "Run structured diligence that understands an investor lens and ranks open asks.",
    kind: "function",
    steps: DILIGENCE_STEPS.map((step) => ({ ...step })),
  };

  const moves = INVESTOR_MOVES.map((move) => ({
    ...move,
    id: `${idPrefix}:${move.id}`,
  }));

  const functions = [memoFunction, diligenceFunction];
  const lenses = [lens];

  const context = [
    {
      id: `${idPrefix}:context:role`,
      kind: "role",
      label: role,
      text: bounded(
        `Role: ${role}. Firm/fund: ${firm === "investor" ? "unspecified" : firm}. `
        + "This pearl encodes investor judgment for memo and diligence work. "
        + (utterance ? `Source request: ${utterance}` : ""),
        1_200,
      ),
      pinned: true,
      priority: 1,
    },
    {
      id: `${idPrefix}:context:scaffold`,
      kind: "scaffold",
      label: "Deterministic investor scaffold",
      text: "Scaffolded without inventing live company research. Wear this pearl and evaluate page/deck material to apply memo + diligence through the investor lens. Live model critique still needs credentials.",
      pinned: true,
      priority: 2,
    },
  ];

  return {
    version: ROLE_PEARL_SCAFFOLD_VERSION,
    mode: "deterministic-scaffold",
    role,
    firm: firm === "investor" ? null : firm,
    requiresLiveResearch: false,
    libraryFunctions: [
      {
        name: memoFunction.name,
        description: memoFunction.description,
        steps: memoFunction.steps,
        saveAs: "investmentMemoFunction",
      },
      {
        name: diligenceFunction.name,
        description: diligenceFunction.description,
        steps: diligenceFunction.steps,
        saveAs: "diligenceFunction",
      },
    ],
    libraryLens: {
      name: lens.name,
      description: lens.description,
      domain: "venture",
      role,
      firm: firm === "investor" ? null : firm,
    },
    organization: {
      order: [...PEARL_STUDIO_COGNITIVE_SECTION_ORDER],
      moves,
      weights: seedWeightsFromIntent(
        `${utterance || ""}\ninvestor memo diligence risk evidence over narrative`,
      ),
      lenses,
      functions,
    },
    pearl: {
      name: pearlName,
      description: bounded(
        `${pearlName}: investment memo + diligence Functions under ${lens.name}.`,
        280,
      ),
      purpose: "Investor underwriting: memo writing and diligence through a firm-aware lens.",
      systemPrompt: [
        `You are the Pearl “${pearlName}”.`,
        `Role: ${role}. Firm/fund: ${firm === "investor" ? "unspecified" : firm}.`,
        "Write investment memos and run diligence with an investor lens.",
        "Be skeptical of hand-wavy TAM, unfalsifiable claims, and missing customer proof.",
        "Always surface risks, open questions, and a clear invest/pass recommendation.",
        utterance ? `Source request: ${utterance}` : "",
      ].filter(Boolean).join("\n"),
      representation: {
        kind: "function",
        label: pearlName,
        discovery: "role-pearl-scaffold",
        snapshot: {
          role,
          firm: firm === "investor" ? null : firm,
          scaffoldVersion: ROLE_PEARL_SCAFFOLD_VERSION,
        },
      },
      workingSet: {
        context,
        lenses: [{ id: lens.id, name: lens.name, strength: lens.strength, judgment: lens.judgment }],
      },
      moves,
      functions,
      weights: seedWeightsFromIntent(
        `${utterance || ""}\ninvestor memo diligence risk evidence over narrative`,
      ),
      lenses,
      provenance: {
        rolePearlScaffold: {
          version: ROLE_PEARL_SCAFFOLD_VERSION,
          role,
          firm: firm === "investor" ? null : firm,
          mode: "deterministic-scaffold",
          utterance: utterance || null,
          createdAt: new Date(now).toISOString(),
        },
      },
    },
  };
}

/**
 * Parse high-confidence investor / role-pearl creation from natural language.
 * Returns null when the utterance is not this workflow.
 */
export function parseRolePearlCommand(text) {
  const value = String(text || "").replace(/[’']/g, "'").replace(/\s+/g, " ").trim();
  if (!looksLikeInvestorRolePearl(value)) return null;
  const firm = extractInvestorFirm(value);
  const scaffold = buildInvestorRolePearlScaffold({ utterance: value, firm });
  return {
    title: `Create ${scaffold.pearl.name}`,
    verb: "createRolePearl",
    args: {
      role: scaffold.role,
      firm: scaffold.firm,
      name: scaffold.pearl.name,
      utterance: value,
      openStudio: true,
      wear: true,
      materializeLibrary: true,
    },
    scaffold,
  };
}

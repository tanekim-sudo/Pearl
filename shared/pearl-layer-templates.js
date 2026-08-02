/**
 * Offline high-fidelity layer templates for well-known tastes / investing styles.
 * Used by seedPearlLayersFromIntent — AI may refine later when signed in.
 */

/** @typedef {{ name: string, description: string }} LayerMove */
/** @typedef {{ name: string, priority: number, note: string }} LayerWeight */
/** @typedef {{ name: string, description: string, strength?: number }} LayerLens */

/**
 * Extract a referenced person/style and topic domain from novice create phrasing.
 * Covers: like X, in the style of X, reflects X's style and taste, taste and lens of Y.
 */
export function extractStyleAndDomain(utterance = "") {
  const text = String(utterance || "").replace(/\s+/g, " ").trim();
  if (!text) return { style: "", domain: "", personaKey: null };

  const style =
    text.match(
      /\b(?:like|in the style of|inspired by|as if(?:\s+by)?)\s+(.+?)(?:\s+and\s+(?:taste|lens|voice)|[.!?]|$)/i,
    )?.[1]?.trim()
    || text.match(
      /\breflects?\s+(.+?)(?:['’]s)?\s+(?:style|taste|voice|thought\s+process|lens)\b/i,
    )?.[1]?.trim()
    || text.match(
      /\b(.+?)(?:['’]s)\s+(?:style|taste|voice|thought\s+process)\b/i,
    )?.[1]?.trim()
    || "";

  const domain =
    text.match(
      /\b(?:style|taste|voice)\s+and\s+lens\s+of\s+(.+?)(?:[.!?]|$)/i,
    )?.[1]?.trim()
    || text.match(/\blens\s+of\s+(.+?)(?:[.!?]|$)/i)?.[1]?.trim()
    || text.match(/\bof\s+(investing|poetry|writing|diligence|research)\b/i)?.[1]?.trim()
    || "";

  const blob = `${style} ${domain} ${text}`.toLowerCase();
  let personaKey = null;
  if (/\bbuffett\b|\bwarren\b.*\binvest|\bvalue\s+invest/.test(blob)) personaKey = "buffett";
  else if (/\bplath\b|\bsylvia\b/.test(blob)) personaKey = "plath";
  else if (/\boliver\b|\bmary\s+oliver\b/.test(blob)) personaKey = "oliver";
  else if (/\bdickinson\b|\bemily\b/.test(blob)) personaKey = "dickinson";
  else if (/\bwoolf\b|\bvirginia\b/.test(blob)) personaKey = "woolf";
  else if (/\b(?:invest(?:ing|or|ment)|diligence|underwrit|margin of safety|moat)\b/.test(blob)) {
    personaKey = "investor";
  } else if (/\b(?:poetry|poem|haiku|verse)\b/.test(blob)) {
    personaKey = "poetry";
  }

  return {
    style: String(style || "").replace(/\s+/g, " ").trim().slice(0, 120),
    domain: String(domain || "").replace(/\s+/g, " ").trim().slice(0, 80),
    personaKey,
  };
}

/** Intent-bound Reef title — never the full purpose clause. */
export function titleFromStyleAndDomain(utterance = "", options = {}) {
  const { style, domain, personaKey } = extractStyleAndDomain(utterance);
  const hint = String(options.name || options.titleHint || "").replace(/\s+/g, " ").trim();
  if (personaKey === "buffett") {
    return domain && !/invest/i.test(domain)
      ? `Buffett · ${domain}`.slice(0, 80)
      : "Buffett · investing";
  }
  if (personaKey === "plath") return "Poetry · Sylvia Plath";
  if (personaKey === "oliver") return "Poetry · Mary Oliver";
  if (personaKey === "dickinson") return "Poetry · Emily Dickinson";
  if (personaKey === "woolf") return "Writing · Virginia Woolf";
  if (personaKey === "investor") {
    const lead = style.split(/\s+/).slice(0, 3).join(" ");
    return (lead ? `${lead} · investing` : "Investor lens").slice(0, 80);
  }
  if (style) {
    const lead = style
      .replace(/(?:['’]?s)?\s*(?:thought\s+process|style|taste|voice|manner|way).*$/i, "")
      .trim()
      || style.split(/\s+/).slice(0, 3).join(" ");
    if (domain) return `${lead} · ${domain}`.slice(0, 80);
    if (personaKey === "poetry") return `Poetry · ${lead}`.slice(0, 80);
    return lead.slice(0, 80);
  }
  if (hint && hint.length <= 48 && !/^reflects?\b/i.test(hint)) return hint.slice(0, 80);
  if (domain) return domain.slice(0, 80);
  return "";
}

/** @returns {{ moves: LayerMove[], weights: LayerWeight[], lenses: LayerLens[], voice: string } | null} */
export function resolvePearlLayerTemplate(utterance = "", options = {}) {
  const extracted = extractStyleAndDomain(utterance);
  const key = options.personaKey || extracted.personaKey;
  const style = options.style || extracted.style;
  const domain = options.domain || extracted.domain;

  if (key === "buffett" || (key === "investor" && /\bbuffett\b/i.test(`${style} ${utterance}`))) {
    return {
      id: "buffett",
      voice: "Warren Buffett — owner-oriented value investor",
      moves: [
        { name: "Read the filings", description: "Start with 10-K/10-Q, footnotes, and cash-flow reality before the story." },
        { name: "Circle of competence", description: "Ask whether this business is understandable end-to-end; pass if not." },
        { name: "Assess the moat", description: "Identify durable advantage: brand, switching costs, network, cost, regulation — and whether it is widening." },
        { name: "Judge management", description: "Weigh integrity, capital allocation honesty, and owner-like behavior over charisma." },
        { name: "Margin of safety", description: "Estimate intrinsic value conservatively; require a cushion versus price." },
        { name: "Long-horizon hold", description: "Prefer businesses you would happily own for a decade if the market closed tomorrow." },
      ],
      weights: [
        { name: "Moat durability", priority: 0.92, note: "Prefer widening economic moats over narratives" },
        { name: "Management integrity", priority: 0.9, note: "Capital allocation honesty over polish" },
        { name: "Margin of safety", priority: 0.88, note: "Price versus conservative intrinsic value" },
        { name: "Owner mindset", priority: 0.85, note: "Think like a business owner, not a trader" },
        { name: "Long time horizon", priority: 0.84, note: "Years and decades over quarters" },
        { name: "Circle of competence", priority: 0.82, note: "Understandable businesses only" },
        { name: "Cash reality over story", priority: 0.8, note: "Free cash flow and balance sheet over adjectives" },
      ],
      lenses: [
        { name: "Owner mindset", description: "See the company as a whole business you might own forever.", strength: 0.9 },
        { name: "Circle of competence", description: "Frame every idea by what is truly knowable versus outside the circle.", strength: 0.85 },
        { name: "Mr. Market", description: "Treat price swings as a moody partner offering deals — not as the truth.", strength: 0.8 },
        { name: "Margin of safety", description: "Judge opportunities by downside protection first.", strength: 0.85 },
      ],
    };
  }

  if (key === "investor") {
    return {
      id: "investor",
      voice: style || "skeptical investor",
      moves: [
        { name: "Frame the ask", description: "State what decision this memo supports and the capital at risk." },
        { name: "Evidence pass", description: "List claims with sources; flag gaps and hand-wavy market sizing." },
        { name: "Unit economics", description: "Trace how money is made; distrust vanity metrics." },
        { name: "Risks & upside", description: "Weight downside clarity before narrative upside." },
        { name: "Decision memo", description: "Write a clear invest / pass / watch with conditions." },
      ],
      weights: [
        { name: "Evidence over narrative", priority: 0.9, note: "Skeptical underwriting" },
        { name: "Risk clarity", priority: 0.85, note: "Surface downside early" },
        { name: "Traction specificity", priority: 0.78, note: "Numbers over adjectives" },
        { name: "Team integrity", priority: 0.75, note: "Honest operators over polished decks" },
      ],
      lenses: [
        { name: "Investor awareness", description: `Underwrite through ${style || "a skeptical investor"} lens.`, strength: 0.8 },
        { name: "Downside first", description: "See what can go permanently wrong before upside.", strength: 0.75 },
      ],
    };
  }

  if (key === "plath" || key === "oliver" || key === "dickinson" || key === "woolf" || key === "poetry") {
    const voice = style
      || (key === "plath" ? "Sylvia Plath"
        : key === "oliver" ? "Mary Oliver"
          : key === "dickinson" ? "Emily Dickinson"
            : key === "woolf" ? "Virginia Woolf"
              : "a precise poet");
    return {
      id: key,
      voice,
      moves: [
        { name: "Notice", description: "Attend to concrete sensory detail before interpreting." },
        { name: "Compress", description: "Cut to the charged image or line; drop filler." },
        { name: "Voice check", description: `Re-read in the thought process of ${voice}.` },
        { name: "Charge", description: "Keep emotional honesty; refuse neat empty polish." },
      ],
      weights: [
        { name: `Voice fidelity · ${String(voice).slice(0, 40)}`, priority: 0.88, note: "Honor the referenced thought process" },
        { name: "Concrete imagery over polish", priority: 0.82, note: "Prefer lived specificity" },
        { name: "Emotional honesty", priority: 0.8, note: "Honesty over neatness" },
        { name: "Compression", priority: 0.72, note: "Fewer words, sharper edge" },
      ],
      lenses: [
        {
          name: `${String(voice).split(/\s+/).slice(0, 2).join(" ")} awareness`.slice(0, 64),
          description: `See through the thought process and taste of ${voice}.`,
          strength: 0.8,
        },
        { name: "Poetic awareness", description: "Favor charged image and atmosphere over explanation.", strength: 0.7 },
      ],
    };
  }

  if (style) {
    return {
      id: "style",
      voice: style,
      moves: [
        { name: "Gather", description: `Collect material relevant to ${domain || style}.` },
        { name: "Shape", description: `Draft in the taste of ${style}.` },
        { name: "Voice check", description: `Re-read as if through ${style}'s lens.` },
        { name: "Refine", description: "Tighten against this pearl's weights and lenses." },
      ],
      weights: [
        { name: `Voice fidelity · ${style.slice(0, 48)}`, priority: 0.85, note: "Honor the referenced thought process" },
        { name: "Concrete over generic", priority: 0.75, note: "Specificity beats platitudes" },
        { name: "Taste consistency", priority: 0.7, note: "Stay in character across replies" },
      ],
      lenses: [
        {
          name: `${style.split(/\s+/).slice(0, 3).join(" ")} awareness`.slice(0, 64),
          description: `See through the thought process and taste of ${style}.`,
          strength: 0.78,
        },
      ],
    };
  }

  return null;
}

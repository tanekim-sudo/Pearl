/** Standards for function trees — deep architect path for canvas thinking. */

export const CANVAS_VISION = `LENS is a thinking canvas. Users place sparse notes (a word, a company name, a fragment) on a whiteboard and drag FUNCTIONS onto them to produce professional deliverables. Functions are NOT generic ChatGPT prompts — they are compositions of perceptual/cognitive transformation moves, organized as deep trees the user can see and navigate.`;

export const FUNCTION_NAMING_RULES = `NAMING: 3–7 words, action-oriented, name a real phase of thinking (e.g. "Build Investment Thesis", "Frame the Opportunity"). Composites group sub-moves; leaves are atomic perceptual instructions.`;

export const FUNCTION_DESCRIPTION_RULES = `DESCRIPTION: one sentence — sparse input → exact deliverable shape (sections, format, decision output). Write from the user's perspective (investor, founder, researcher, writer).`;

export const LEAF_PROMPT_RULES = `LEAF PROMPT: one precise perceptual instruction producing ONE clear output shape. Use labeled sections (GOAL, OUTPUT FORMAT) when helpful. Leaves must NOT output ENTITY/SEARCH_TERMS metadata — those are internal resolve steps, never user-facing deliverables. Final deliverable leaves always output polished markdown sections.`;

export const DEEP_TREE_RULES = `DEPTH: Deep trees are GOOD — organize complexity into named thinking phases. No artificial cap on nesting depth.
STRUCTURE: Composites {"name","description","steps":[...]} — no prompt on composites. Leaves {"name","description","prompt":"..."}.
RESEARCH: Exactly ONE leaf per function tree may have "research":true — for factual grounding via web search. Place it after framing, before analysis/synthesis.
PIPELINE: Frame/context → ONE research leaf (when facts needed) → analyze/explore (often nested composites) → synthesize/deliver (polished markdown).
MINIMUM: Complex deliverables (thesis, memo, strategy) require ≥3 tree levels. Simple transforms may be shallower.
RESOLVE: NEVER create user-facing "identify subject", "extract entity", or SEARCH_TERMS-only steps — runtime handles sparse input internally.`;

export const GOOD_VS_BAD_EXAMPLES = `GOOD composite names: "Frame the Opportunity", "Analyze Dimensions", "Synthesize Verdict", "Map Competitive Landscape"
BAD composite names: "Step 1", "Process Data", "Use AI to analyze", "Main Analysis"
GOOD leaf names: "Draft thesis with recommendation", "Research subject and comps", "Identify sector and stage"
BAD leaf names: "Analyze", "Research", "Generate output", "Extract entity"
GOOD leaf prompt: "Write ## Market Structure — TAM/SAM, growth drivers, competitive dynamics. Use research facts; be specific."
BAD leaf prompt: "Analyze the market using AI and provide insights."`;

export const PERSPECTIVE_RULES = `PERSPECTIVE: You are designing tools for someone who thinks ON a canvas by dragging transformations. Each sub-function names a move they would mentally perform. The tree is the visible architecture of their workflow — make every node meaningful.`;

export const FUNCTION_JSON_SHAPE = `JSON: Return ONLY valid JSON. Root: {"name","description","steps":[...]}. Nested composites have steps arrays; leaves have prompt strings. Optional "research":true on exactly one leaf.`;

export const RECOMMENDED_PIPELINE = `RECOMMENDED FLOW: 1) Frame/context composites 2) ONE research leaf (research:true) when facts ground the deliverable 3) Nested analysis composites 4) Final deliverable leaf with explicit markdown sections.`;

export const DEEP_FUNCTION_ARCHITECT_STANDARDS = `${CANVAS_VISION}

${FUNCTION_NAMING_RULES}
${FUNCTION_DESCRIPTION_RULES}
${LEAF_PROMPT_RULES}
${DEEP_TREE_RULES}
${GOOD_VS_BAD_EXAMPLES}
${PERSPECTIVE_RULES}
${FUNCTION_JSON_SHAPE}
${RECOMMENDED_PIPELINE}`;

/** @deprecated Use DEEP_FUNCTION_ARCHITECT_STANDARDS */
export const FUNCTION_ARCHITECT_STANDARDS = DEEP_FUNCTION_ARCHITECT_STANDARDS;

/** @deprecated Use DEEP_FUNCTION_ARCHITECT_STANDARDS */
export const FAST_FUNCTION_ARCHITECT_STANDARDS = DEEP_FUNCTION_ARCHITECT_STANDARDS;

export const DECOMPOSE_PROMPT_HEADER = `Decompose this function into a DEEP tree of sub-functions — named thinking phases ending in precise leaf prompts. Complex deliverables need ≥3 levels. No max depth — recurse as far as complexity warrants.`;

export const CREATE_FROM_PROSE_HEADER = `Create a function tree for the Lens thinking canvas from the user's description. Build a deep pipeline of perceptual moves — not a flat 2-step shortcut unless the task is trivial.`;

export const EDIT_FROM_PROSE_HEADER = `Edit this function tree. Preserve structure not asked to change. When expanding, decompose into meaningful nested phases — not lazy flat lists.`;

export const GENERATE_LIST_HEADER = `Design the 8 most valuable FUNCTIONS for this person's Lens whiteboard — workflows they would drag onto sparse notes to get full professional deliverables. These are canvas thinking tools, not generic "use AI to..." prompts.`;

/** Detect resolve/parse leaves after descriptive renaming. */
export function isResolveLeaf(leaf) {
  if (!leaf) return false;
  const name = (leaf.name || "").toLowerCase();
  const prompt = (leaf.prompt || "").toLowerCase();
  if (/^(parse|identify subject|identify entity|resolve subject|extract subject|extract entity)\b/.test(name)) return true;
  if (/\bidentify (the )?(subject|entity)\b/.test(name)) return true;
  if (/\bentity:\s*|\bsearch_terms:\s*/.test(prompt)) return true;
  if (/\bextract (the )?(subject|entity)\b/.test(prompt)) return true;
  if (/return exactly:\s*\nentity:/i.test(prompt)) return true;
  return false;
}

/** Walk all nodes in a JSON function tree. */
export function walkFunctionTree(node, visit) {
  if (!node) return;
  visit(node);
  if (Array.isArray(node.steps)) {
    for (const child of node.steps) walkFunctionTree(child, visit);
  }
}

export function treeDepth(node) {
  if (!node?.steps?.length) return 1;
  return 1 + Math.max(...node.steps.map(treeDepth));
}

export function countResearchLeaves(node) {
  let n = 0;
  walkFunctionTree(node, (nd) => {
    if (!nd.steps?.length && nd.research) n += 1;
  });
  return n;
}

export function countDeliverLeaves(node) {
  let n = 0;
  walkFunctionTree(node, (nd) => {
    if (!nd.steps?.length && !nd.research && nd.prompt) n += 1;
  });
  return n;
}

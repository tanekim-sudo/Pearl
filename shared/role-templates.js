/**
 * Curated deep function trees for common roles — no resolve-only junk on the canvas.
 * Each function: nested thinking phases, ONE research leaf, deliverable leaves with real sections.
 */

import { treeDepth, countResearchLeaves, countDeliverLeaves } from "./function-standards.js";

function thesisTree() {
  return {
    name: "Build Investment Thesis",
    description: "Company name or sparse note → full thesis ending in a clear recommendation.",
    steps: [
      {
        name: "Frame the Opportunity",
        description: "Establish sector context and core investment bet.",
        steps: [
          {
            name: "Identify Sector and Stage",
            description: "Place the subject in market context.",
            prompt:
              "From the input, name the sector, stage, and category. Output ## Sector, ## Stage, ## Category — one focused paragraph each.",
          },
          {
            name: "State the Core Bet",
            description: "Articulate what must be true for this to be a great investment.",
            prompt:
              "Write ## Core Bet — 2–3 sentences on the single thesis an investor would underwrite. Decisive, not hedged.",
          },
        ],
      },
      {
        name: "Gather Verified Company Facts",
        description: "Web research for factual grounding.",
        research: true,
        prompt:
          "Research the subject entity thoroughly. Return concise bullets: overview, product, market, funding, team, traction, key risks, recent news.",
      },
      {
        name: "Analyze Dimensions",
        description: "Structured multi-axis investment analysis.",
        steps: [
          {
            name: "Market Structure",
            description: "TAM, dynamics, tailwinds.",
            prompt:
              "Using research, write ## Market Structure — TAM/SAM, growth drivers, competitive dynamics, timing. Specific facts, not generics.",
          },
          {
            name: "Product Differentiation",
            description: "Moat and product-market fit signals.",
            prompt:
              "Write ## Product — what they build, differentiation, moat, PMF evidence from research.",
          },
          {
            name: "Traction Signals",
            description: "Evidence of momentum.",
            prompt:
              "Write ## Traction — metrics, customers, growth signals, milestones. Cite specifics from research.",
          },
          {
            name: "Team Capability",
            description: "Founders and execution capacity.",
            prompt:
              "Write ## Team — founders, relevant experience, hiring signals, capability gaps.",
          },
        ],
      },
      {
        name: "Synthesize Verdict",
        description: "Final polished thesis deliverable.",
        steps: [
          {
            name: "Draft Thesis with Recommendation",
            description: "Complete investment thesis document.",
            prompt:
              "Write a complete investment thesis. Sections: ## Thesis, ## Market, ## Product, ## Traction, ## Team, ## Key Risks, ## Upside Scenario, ## Recommendation. Specific, decisive, evidence-backed.",
          },
        ],
      },
    ],
  };
}

export const INVESTOR_FUNCTION_TREES = [
  thesisTree(),
  {
    name: "Map Comparable Companies",
    description: "Subject → comp landscape with positioning, metrics, and takeaways.",
    steps: [
      {
        name: "Define Comp Universe",
        description: "Criteria for who counts as a comparable.",
        steps: [
          {
            name: "Set Sector and Stage Filters",
            description: "Bound the comp search.",
            prompt:
              "From the input, define ## Comp Criteria — sector, stage, business model, geography. 3–5 bullet filters an analyst would use.",
          },
        ],
      },
      {
        name: "Research Subject and Comps",
        description: "Find entity and 5–8 comparable companies.",
        research: true,
        prompt:
          "Research the subject and comparable companies matching the criteria. Bullet facts per company: name, positioning, stage, metrics where available, recent moves.",
      },
      {
        name: "Structure Comp Analysis",
        description: "Organize findings into a usable map.",
        steps: [
          {
            name: "Build Comp Table",
            description: "Side-by-side comparison.",
            prompt:
              "Output ## Comparable Companies — markdown table: company, positioning, stage, key metrics, notes. Include the subject for contrast.",
          },
          {
            name: "Extract Positioning Insights",
            description: "What the comp map reveals.",
            prompt:
              "Output ## Key Takeaways — where the subject sits vs comps, whitespace, valuation context, strategic implications.",
          },
        ],
      },
    ],
  },
  {
    name: "Write IC Investment Memo",
    description: "Sparse input → investment committee memo with recommendation.",
    steps: [
      {
        name: "Frame the Deal",
        description: "Deal type, check size context, why now.",
        steps: [
          {
            name: "Summarize Deal Snapshot",
            description: "One-screen deal facts.",
            prompt:
              "Output ## Deal Snapshot — company, round, ask, sector, stage, lead dynamics. Bullet form, investor-ready.",
          },
        ],
      },
      {
        name: "Research Deal and Market",
        description: "Gather facts for the memo.",
        research: true,
        prompt:
          "Research the subject for an IC memo: business model, market size, traction, team, funding history, competitive landscape, risks.",
      },
      {
        name: "Build Memo Sections",
        description: "Structured IC narrative.",
        steps: [
          {
            name: "Draft Investment Highlights",
            description: "Why this could be a great investment.",
            prompt:
              "Write ## Investment Highlights — 4–6 bullets on thesis, market, product edge, traction proof points.",
          },
          {
            name: "Draft Risks and Open Questions",
            description: "Honest downside and diligence gaps.",
            prompt:
              "Write ## Risks and ## Open Questions — specific, not boilerplate. What could kill the deal?",
          },
        ],
      },
      {
        name: "Deliver IC Memo",
        description: "Complete memo with recommendation.",
        steps: [
          {
            name: "Assemble Full Memo",
            description: "Executive memo deliverable.",
            prompt:
              "Write a complete IC memo: ## Executive Summary, ## Investment Highlights, ## Business Overview, ## Market, ## Risks, ## Open Questions, ## Recommendation (Invest / Pass / More Diligence with rationale).",
          },
        ],
      },
    ],
  },
  {
    name: "Screen Deal Flow Item",
    description: "Quick screen: fit, risks, and pass/invest/learn more.",
    steps: [
      {
        name: "Parse Opportunity Context",
        description: "What we know from sparse input.",
        steps: [
          {
            name: "Extract Screen Hypothesis",
            description: "Initial read on the opportunity.",
            prompt:
              "From the input, write ## Initial Read — what they appear to do, stage guess, why it landed in the funnel.",
          },
        ],
      },
      {
        name: "Research Opportunity",
        description: "Fast factual scan.",
        research: true,
        prompt:
          "Quick research: what they do, stage, traction signals, team, funding, red flags, recent news.",
      },
      {
        name: "Deliver Screen Verdict",
        description: "One-page screen output.",
        steps: [
          {
            name: "Write Screen Summary",
            description: "Decisive pass/pursue output.",
            prompt:
              "Output ## Snapshot, ## Why It Could Work, ## Key Risks, ## Open Questions, ## Verdict (Pass / Learn More / Pursue) with one-line rationale each.",
          },
        ],
      },
    ],
  },
  {
    name: "Stress Test an Investment Case",
    description: "Challenge assumptions and surface failure modes.",
    steps: [
      {
        name: "Articulate the Bull Case",
        description: "State what believers are betting on.",
        steps: [
          {
            name: "Draft Core Thesis",
            description: "The optimistic narrative.",
            prompt:
              "Write ## Bull Case — the investment thesis as a believer would state it. 3–5 load-bearing claims.",
          },
        ],
      },
      {
        name: "Research Assumptions",
        description: "Ground the stress test in facts.",
        research: true,
        prompt:
          "Research the subject. List load-bearing assumptions an investor would make and facts that support or undermine each.",
      },
      {
        name: "Run Downside Analysis",
        description: "Structured failure-mode exploration.",
        steps: [
          {
            name: "Identify Failure Modes",
            description: "What breaks first.",
            prompt:
              "Output ## Load-Bearing Assumptions, ## What Breaks First, ## Downside Scenario — specific, sequenced failure paths.",
          },
          {
            name: "Surface Mitigants and Gaps",
            description: "What would change the verdict.",
            prompt:
              "Output ## Mitigants, ## Missing Data — what diligence would resolve uncertainty; what cannot be mitigated.",
          },
        ],
      },
    ],
  },
  {
    name: "Model Return Scenarios",
    description: "Subject → base/bull/bear return narrative with key drivers.",
    steps: [
      {
        name: "Frame Return Drivers",
        description: "Variables that move the outcome.",
        steps: [
          {
            name: "List Value Creation Levers",
            description: "How this investment makes money.",
            prompt:
              "Output ## Value Creation Levers — revenue growth, margin expansion, multiple expansion, M&A. Rank by importance.",
          },
        ],
      },
      {
        name: "Research Financial Context",
        description: "Ground scenarios in available data.",
        research: true,
        prompt:
          "Research the subject: revenue/ARR if available, growth rate, burn, runway, comparable exit multiples, funding history.",
      },
      {
        name: "Deliver Scenario Analysis",
        description: "Structured return scenarios.",
        steps: [
          {
            name: "Write Base Bull Bear Cases",
            description: "Three-scenario return narrative.",
            prompt:
              "Output ## Base Case, ## Bull Case, ## Bear Case — each with key assumptions, timeline, implied return profile, probability weight (qualitative). End with ## Key Sensitivities.",
          },
        ],
      },
    ],
  },
  {
    name: "Prepare Partner Meeting Brief",
    description: "Subject → concise brief for a partner discussion.",
    steps: [
      {
        name: "Define Meeting Objective",
        description: "What decision this meeting should produce.",
        steps: [
          {
            name: "State Decision Ask",
            description: "Clear ask for the partner.",
            prompt:
              "Output ## Meeting Objective and ## Decision Ask — what the partner needs to decide or approve in one paragraph.",
          },
        ],
      },
      {
        name: "Research Talking Points",
        description: "Facts to anchor the conversation.",
        research: true,
        prompt:
          "Research the subject. Bullet: company overview, why now, traction highlights, key risks, comparable context, open diligence items.",
      },
      {
        name: "Deliver Partner Brief",
        description: "One-page meeting-ready brief.",
        steps: [
          {
            name: "Assemble Brief",
            description: "Scannable partner prep doc.",
            prompt:
              "Output ## Headline, ## Why Now, ## Thesis in 3 Bullets, ## Traction Proof, ## Key Risks, ## Recommended Next Steps, ## Anticipated Partner Questions. Tight, scannable.",
          },
        ],
      },
    ],
  },
  {
    name: "Analyze Market Entry Strategy",
    description: "Subject → market entry assessment with go/no-go implications.",
    steps: [
      {
        name: "Define Entry Context",
        description: "Market, geography, segment focus.",
        steps: [
          {
            name: "Scope the Entry Question",
            description: "What market entry decision is being evaluated.",
            prompt:
              "Output ## Entry Question, ## Target Segment, ## Success Criteria — define the strategic choice clearly.",
          },
        ],
      },
      {
        name: "Research Market Landscape",
        description: "Competitive and regulatory context.",
        research: true,
        prompt:
          "Research the subject's target market: incumbents, regulatory barriers, customer segments, recent entrants, pricing dynamics.",
      },
      {
        name: "Synthesize Entry Assessment",
        description: "Structured strategy deliverable.",
        steps: [
          {
            name: "Assess Entry Viability",
            description: "Go/no-go with rationale.",
            prompt:
              "Output ## Market Attractiveness, ## Competitive Position, ## Entry Barriers, ## Recommended Entry Path, ## Key Risks, ## Go/No-Go Assessment with rationale.",
          },
        ],
      },
    ],
  },
];

export const FOUNDER_FUNCTION_TREES = [
  {
    name: "Refine Product Vision",
    description: "Sparse idea → crisp product vision with positioning and north star.",
    steps: [
      {
        name: "Extract Core Insight",
        description: "What problem and for whom.",
        steps: [
          {
            name: "Name the Problem and User",
            description: "Anchor the vision in a real pain point.",
            prompt:
              "Output ## Problem, ## Target User, ## Current Workaround — specific, not generic. Ground in the input.",
          },
          {
            name: "Articulate the Insight",
            description: "Why now, why this approach.",
            prompt:
              "Write ## Core Insight — the non-obvious belief that makes this product inevitable. 2–3 sentences.",
          },
        ],
      },
      {
        name: "Research Market Context",
        description: "Ground vision in market reality.",
        research: true,
        prompt:
          "Research the problem space: existing solutions, market size signals, recent trends, analogous products, user behavior shifts.",
      },
      {
        name: "Synthesize Product Vision",
        description: "Polished vision document.",
        steps: [
          {
            name: "Draft Vision Document",
            description: "Founder-ready vision artifact.",
            prompt:
              "Write ## Vision Statement, ## Problem, ## Solution, ## Target User, ## Differentiation, ## North Star Metric, ## 3-Year Ambition. Inspiring but concrete.",
          },
        ],
      },
    ],
  },
  {
    name: "Write Investor Pitch Narrative",
    description: "Company/idea → compelling pitch story with slide-ready sections.",
    steps: [
      {
        name: "Frame the Narrative Arc",
        description: "Story spine for the pitch.",
        steps: [
          {
            name: "Define Hook and Tension",
            description: "Opening that captures attention.",
            prompt:
              "Output ## Hook, ## Tension, ## Resolution — the narrative arc in 3 tight paragraphs. Investor audience.",
          },
        ],
      },
      {
        name: "Research Proof Points",
        description: "Facts that make the story credible.",
        research: true,
        prompt:
          "Research the subject: traction metrics, team credentials, market data, customer logos, competitive differentiation, funding context.",
      },
      {
        name: "Build Pitch Sections",
        description: "Slide-ready content blocks.",
        steps: [
          {
            name: "Draft Problem and Solution",
            description: "Core pitch pillars.",
            prompt:
              "Write ## Problem (3 bullets), ## Solution (3 bullets), ## Why Now — slide-ready, no fluff.",
          },
          {
            name: "Draft Traction and Ask",
            description: "Proof and the close.",
            prompt:
              "Write ## Traction, ## Business Model, ## Team, ## The Ask — specific numbers where available.",
          },
        ],
      },
      {
        name: "Deliver Pitch Narrative",
        description: "Complete pitch document.",
        steps: [
          {
            name: "Assemble Full Narrative",
            description: "Polished pitch ready to rehearse.",
            prompt:
              "Write a complete investor pitch narrative: ## Opening Hook, ## Problem, ## Solution, ## Market, ## Traction, ## Business Model, ## Team, ## Vision, ## The Ask. Slide-header style sections.",
          },
        ],
      },
    ],
  },
  {
    name: "Map Competitive Landscape",
    description: "Subject → competitive map with positioning and whitespace.",
    steps: [
      {
        name: "Define Competitive Frame",
        description: "Who counts as competition.",
        steps: [
          {
            name: "Set Category Boundaries",
            description: "Direct vs indirect competitors.",
            prompt:
              "Output ## Category Definition, ## Direct Competitors (criteria), ## Indirect Alternatives — how a founder would frame the field.",
          },
        ],
      },
      {
        name: "Research Competitors",
        description: "Factual comp landscape.",
        research: true,
        prompt:
          "Research 5–10 competitors and alternatives: positioning, pricing, strengths, weaknesses, funding, recent moves.",
      },
      {
        name: "Deliver Competitive Map",
        description: "Structured landscape analysis.",
        steps: [
          {
            name: "Write Landscape Analysis",
            description: "Founder-ready competitive doc.",
            prompt:
              "Output ## Landscape Overview, ## Competitor Profiles (table), ## Positioning Map (describe axes), ## Whitespace, ## Strategic Implications.",
          },
        ],
      },
    ],
  },
  {
    name: "Define Go-to-Market Strategy",
    description: "Product/idea → GTM plan with channels, ICP, and milestones.",
    steps: [
      {
        name: "Identify Ideal Customer",
        description: "Who buys first and why.",
        steps: [
          {
            name: "Profile ICP and Buyer",
            description: "Beachhead customer definition.",
            prompt:
              "Output ## ICP Profile, ## Buyer Persona, ## Purchase Trigger, ## Objections — specific enough to sell against.",
          },
        ],
      },
      {
        name: "Research GTM Precedents",
        description: "How similar products went to market.",
        research: true,
        prompt:
          "Research GTM patterns in this category: successful launches, channel mix, pricing models, sales motion (PLG vs enterprise), time-to-traction benchmarks.",
      },
      {
        name: "Deliver GTM Plan",
        description: "Actionable go-to-market document.",
        steps: [
          {
            name: "Write GTM Strategy",
            description: "Complete GTM deliverable.",
            prompt:
              "Output ## ICP, ## Positioning, ## Channel Strategy, ## Pricing Approach, ## First 90 Days Milestones, ## Key Metrics, ## Risks. Actionable, founder-ready.",
          },
        ],
      },
    ],
  },
  {
    name: "Draft Founder Memo",
    description: "Topic → internal founder memo aligning team on strategy.",
    steps: [
      {
        name: "Frame the Decision",
        description: "What this memo resolves.",
        steps: [
          {
            name: "State the Strategic Question",
            description: "Clear decision frame.",
            prompt:
              "Output ## Context, ## Decision Required, ## Options on the Table — from the input material.",
          },
        ],
      },
      {
        name: "Research Supporting Facts",
        description: "Evidence for the recommendation.",
        research: true,
        prompt:
          "Research facts relevant to the strategic question: market data, competitor moves, internal metrics if inferable, industry benchmarks.",
      },
      {
        name: "Deliver Founder Memo",
        description: "Polished internal strategy memo.",
        steps: [
          {
            name: "Write Recommendation Memo",
            description: "Team-alignment document.",
            prompt:
              "Write a founder memo: ## Context, ## Analysis, ## Recommendation, ## Rationale, ## Tradeoffs, ## Next Steps. Direct, decisive tone.",
          },
        ],
      },
    ],
  },
  {
    name: "Prioritize Product Roadmap",
    description: "Ideas/constraints → prioritized roadmap with rationale.",
    steps: [
      {
        name: "Inventory Initiatives",
        description: "Capture what could be built.",
        steps: [
          {
            name: "List Candidate Initiatives",
            description: "Everything on the table.",
            prompt:
              "Output ## Candidate Initiatives — table: initiative, user value, effort (S/M/L), dependency. From input.",
          },
        ],
      },
      {
        name: "Research User and Market Signals",
        description: "External input for prioritization.",
        research: true,
        prompt:
          "Research user needs, competitor feature sets, and market trends relevant to the product category. Bullet key signals.",
      },
      {
        name: "Deliver Prioritized Roadmap",
        description: "Ranked roadmap with reasoning.",
        steps: [
          {
            name: "Write Roadmap",
            description: "Quarter-by-quarter priorities.",
            prompt:
              "Output ## Prioritization Framework, ## Now (this quarter), ## Next, ## Later, ## Explicitly Not Doing, ## Rationale. Decisive ranking.",
          },
        ],
      },
    ],
  },
  {
    name: "Craft Hiring Plan",
    description: "Stage/needs → hiring plan with roles, sequence, and profile.",
    steps: [
      {
        name: "Assess Team Gaps",
        description: "What's missing for the next phase.",
        steps: [
          {
            name: "Map Capability Gaps",
            description: "Critical hires vs nice-to-have.",
            prompt:
              "Output ## Current State, ## Critical Gaps, ## Next Phase Requirements — from the input context.",
          },
        ],
      },
      {
        name: "Research Role Benchmarks",
        description: "Market context for hiring.",
        research: true,
        prompt:
          "Research typical early-stage hiring sequences, role profiles, and comp benchmarks for the company's stage and sector.",
      },
      {
        name: "Deliver Hiring Plan",
        description: "Structured hiring roadmap.",
        steps: [
          {
            name: "Write Hiring Roadmap",
            description: "Sequenced hire plan.",
            prompt:
              "Output ## Hiring Philosophy, ## Priority Roles (table: role, timing, profile, why now), ## 6-Month Sequence, ## Sourcing Strategy.",
          },
        ],
      },
    ],
  },
  {
    name: "Build Customer Discovery Synthesis",
    description: "Notes/interviews → synthesized insights with actionable implications.",
    steps: [
      {
        name: "Organize Raw Input",
        description: "Structure discovery material.",
        steps: [
          {
            name: "Extract Key Quotes and Signals",
            description: "Pull evidence from messy input.",
            prompt:
              "Output ## Key Quotes, ## Recurring Themes, ## Surprises — organized from the input material.",
          },
        ],
      },
      {
        name: "Research Category Context",
        description: "External validation of patterns.",
        research: true,
        prompt:
          "Research how others in this space describe the same problems. Validate or challenge themes from the discovery input.",
      },
      {
        name: "Deliver Discovery Synthesis",
        description: "Actionable insight document.",
        steps: [
          {
            name: "Write Synthesis Report",
            description: "Founder-ready discovery output.",
            prompt:
              "Output ## Executive Summary, ## Top 5 Insights, ## Jobs to Be Done, ## Implications for Product, ## Recommended Next Conversations. Evidence-backed.",
          },
        ],
      },
    ],
  },
];

export const RESEARCHER_FUNCTION_TREES = [
  {
    name: "Synthesize Literature Review",
    description: "Topic/papers → structured literature review with gaps and themes.",
    steps: [
      {
        name: "Frame the Review Question",
        description: "Scope and inclusion criteria.",
        steps: [
          {
            name: "Define Research Scope",
            description: "Boundaries for the review.",
            prompt:
              "Output ## Research Question, ## Scope, ## Inclusion Criteria, ## Key Terms — precise academic framing.",
          },
        ],
      },
      {
        name: "Gather Source Material",
        description: "Find and summarize key sources.",
        research: true,
        prompt:
          "Research the topic: find 8–15 key papers, reports, or authoritative sources. For each: citation, main finding, methodology, relevance.",
      },
      {
        name: "Analyze and Synthesize",
        description: "Thematic synthesis across sources.",
        steps: [
          {
            name: "Identify Themes and Contradictions",
            description: "Cross-source patterns.",
            prompt:
              "Output ## Major Themes (with supporting sources), ## Contradictions, ## Methodological Patterns.",
          },
          {
            name: "Map Research Gaps",
            description: "What's missing in the literature.",
            prompt:
              "Output ## Research Gaps, ## Understudied Questions, ## Suggested Future Work.",
          },
        ],
      },
      {
        name: "Deliver Literature Review",
        description: "Polished review document.",
        steps: [
          {
            name: "Write Full Review",
            description: "Publication-ready synthesis.",
            prompt:
              "Write a literature review: ## Introduction, ## Methods, ## Thematic Findings, ## Discussion, ## Gaps and Future Directions, ## Conclusion. Academic tone.",
          },
        ],
      },
    ],
  },
  {
    name: "Frame Research Question",
    description: "Broad topic → precise, testable research question with rationale.",
    steps: [
      {
        name: "Explore the Problem Space",
        description: "Background and motivation.",
        steps: [
          {
            name: "Map the Problem Landscape",
            description: "What is known and unknown.",
            prompt:
              "Output ## Background, ## Known Findings, ## Open Problems — from the input topic.",
          },
        ],
      },
      {
        name: "Research Prior Work",
        description: "Ground the question in existing literature.",
        research: true,
        prompt:
          "Research prior work on this topic: key studies, established theories, recent advances, unresolved debates.",
      },
      {
        name: "Deliver Research Question",
        description: "Precise question with justification.",
        steps: [
          {
            name: "Formulate Question",
            description: "Testable research question artifact.",
            prompt:
              "Output ## Primary Research Question, ## Sub-Questions, ## Hypotheses, ## Rationale, ## Significance, ## Feasibility Considerations.",
          },
        ],
      },
    ],
  },
  {
    name: "Design Study Protocol",
    description: "Research question → study design with methods and analysis plan.",
    steps: [
      {
        name: "Translate Question to Design",
        description: "Methodological approach selection.",
        steps: [
          {
            name: "Select Study Design",
            description: "Appropriate methodology.",
            prompt:
              "Output ## Study Type, ## Design Rationale, ## Variables (IV/DV/confounds), ## Population — matched to the research question.",
          },
        ],
      },
      {
        name: "Research Methodological Precedents",
        description: "How similar studies were conducted.",
        research: true,
        prompt:
          "Research methodological precedents for this type of study: standard protocols, validated instruments, sample size norms, known pitfalls.",
      },
      {
        name: "Deliver Study Protocol",
        description: "Complete protocol document.",
        steps: [
          {
            name: "Write Protocol",
            description: "IRB-ready study design.",
            prompt:
              "Output ## Objectives, ## Design, ## Participants/Sample, ## Materials, ## Procedure, ## Analysis Plan, ## Ethical Considerations, ## Timeline.",
          },
        ],
      },
    ],
  },
  {
    name: "Extract Key Findings",
    description: "Data/results → structured findings with evidence and confidence.",
    steps: [
      {
        name: "Organize Raw Results",
        description: "Structure the evidence base.",
        steps: [
          {
            name: "Catalog Results",
            description: "Systematic result inventory.",
            prompt:
              "Output ## Data Summary, ## Key Observations, ## Anomalies — from the input results/material.",
          },
        ],
      },
      {
        name: "Research Contextual Benchmarks",
        description: "Compare findings to field norms.",
        research: true,
        prompt:
          "Research expected effect sizes, benchmarks, and comparable findings in this domain to contextualize results.",
      },
      {
        name: "Deliver Findings Report",
        description: "Structured findings document.",
        steps: [
          {
            name: "Write Findings",
            description: "Evidence-backed findings artifact.",
            prompt:
              "Output ## Summary of Findings, ## Primary Results, ## Secondary Results, ## Statistical/Qualitative Evidence, ## Confidence Assessment, ## Limitations.",
          },
        ],
      },
    ],
  },
  {
    name: "Identify Research Gaps",
    description: "Field/topic → systematic gap analysis with opportunity ranking.",
    steps: [
      {
        name: "Map the Field",
        description: "Current state of knowledge.",
        steps: [
          {
            name: "Summarize Established Knowledge",
            description: "What the field agrees on.",
            prompt:
              "Output ## Established Findings, ## Active Debates, ## Dominant Methods — for the input field/topic.",
          },
        ],
      },
      {
        name: "Research Frontier Work",
        description: "Latest and edge of the field.",
        research: true,
        prompt:
          "Research the research frontier: recent papers, preprints, conference themes, funding priorities, emerging methods in this field.",
      },
      {
        name: "Deliver Gap Analysis",
        description: "Ranked research opportunities.",
        steps: [
          {
            name: "Write Gap Analysis",
            description: "Actionable research agenda.",
            prompt:
              "Output ## Knowledge Gaps (ranked), ## Methodological Gaps, ## Translation Gaps, ## Recommended Research Agenda, ## Priority Ranking with Rationale.",
          },
        ],
      },
    ],
  },
  {
    name: "Write Abstract and Conclusion",
    description: "Full paper/notes → polished abstract and conclusion.",
    steps: [
      {
        name: "Distill Core Contribution",
        description: "What this work adds.",
        steps: [
          {
            name: "Extract Contribution Claims",
            description: "Novelty and significance.",
            prompt:
              "Output ## Core Contribution, ## Novelty Claim, ## Key Result — distilled from the input material.",
          },
        ],
      },
      {
        name: "Research Comparable Abstracts",
        description: "Style and structure precedents.",
        research: true,
        prompt:
          "Research abstract and conclusion patterns from top papers in this field: structure, length, common phrases to avoid, emphasis patterns.",
      },
      {
        name: "Deliver Abstract and Conclusion",
        description: "Publication-ready bookends.",
        steps: [
          {
            name: "Write Abstract",
            description: "Structured abstract.",
            prompt:
              "Write ## Abstract — Background, Methods, Results, Conclusions. ≤250 words. Precise, no hype.",
          },
          {
            name: "Write Conclusion",
            description: "Strong closing section.",
            prompt:
              "Write ## Conclusion — summary of contributions, implications, limitations, future work. Academic tone.",
          },
        ],
      },
    ],
  },
  {
    name: "Map Theoretical Framework",
    description: "Phenomenon → theoretical framework with constructs and relationships.",
    steps: [
      {
        name: "Identify Phenomenon",
        description: "What needs explaining.",
        steps: [
          {
            name: "Define the Phenomenon",
            description: "Clear phenomenon boundary.",
            prompt:
              "Output ## Phenomenon Definition, ## Key Observations, ## Explanatory Need — from input.",
          },
        ],
      },
      {
        name: "Research Existing Theories",
        description: "Theoretical landscape.",
        research: true,
        prompt:
          "Research established theories relevant to this phenomenon: core constructs, propositions, empirical support, limitations.",
      },
      {
        name: "Deliver Framework",
        description: "Integrated theoretical model.",
        steps: [
          {
            name: "Write Theoretical Framework",
            description: "Structured theory document.",
            prompt:
              "Output ## Theoretical Foundation, ## Core Constructs (defined), ## Propositions/Hypotheses, ## Conceptual Model (describe relationships), ## Implications for Empirical Testing.",
          },
        ],
      },
    ],
  },
  {
    name: "Prepare Peer Review Response",
    description: "Reviews + paper → structured rebuttal with revision plan.",
    steps: [
      {
        name: "Categorize Reviewer Feedback",
        description: "Organize comments by type and severity.",
        steps: [
          {
            name: "Sort and Prioritize Comments",
            description: "Structured comment inventory.",
            prompt:
              "Output ## Comment Inventory (table: reviewer, comment, category, severity), ## Common Themes — from the input reviews.",
          },
        ],
      },
      {
        name: "Research Supporting Evidence",
        description: "Citations and data for rebuttal.",
        research: true,
        prompt:
          "Research evidence, citations, and methodological precedents to address reviewer concerns raised in the input.",
      },
      {
        name: "Deliver Review Response",
        description: "Professional rebuttal letter.",
        steps: [
          {
            name: "Write Response Letter",
            description: "Point-by-point rebuttal.",
            prompt:
              "Write a peer review response: ## Summary of Changes, ## Point-by-Point Response (quote reviewer → response → change made), ## Additional Analyses, ## Revised Conclusions if applicable. Respectful, evidence-backed tone.",
          },
        ],
      },
    ],
  },
];

export const WRITER_FUNCTION_TREES = [
  {
    name: "Develop Article Outline",
    description: "Topic/notes → structured outline with section purposes and flow.",
    steps: [
      {
        name: "Find the Angle",
        description: "What makes this piece worth reading.",
        steps: [
          {
            name: "Identify Thesis and Audience",
            description: "Core argument and reader.",
            prompt:
              "Output ## Thesis, ## Target Reader, ## Why Now, ## Unique Angle — from the input topic/notes.",
          },
        ],
      },
      {
        name: "Research Supporting Material",
        description: "Facts, examples, and sources.",
        research: true,
        prompt:
          "Research the topic: key facts, compelling examples, expert quotes, data points, counterarguments, recent developments.",
      },
      {
        name: "Build Outline Structure",
        description: "Section-by-section architecture.",
        steps: [
          {
            name: "Draft Section Architecture",
            description: "Detailed outline with purpose per section.",
            prompt:
              "Output ## Working Title, ## Outline — for each section: heading, purpose (1 sentence), key points (bullets), estimated length. Logical flow.",
          },
        ],
      },
    ],
  },
  {
    name: "Write Longform Draft",
    description: "Outline/notes → complete longform draft with sections.",
    steps: [
      {
        name: "Establish Voice and Frame",
        description: "Opening that sets tone and stakes.",
        steps: [
          {
            name: "Write Opening Frame",
            description: "Hook and setup.",
            prompt:
              "Write ## Opening — hook, context, thesis statement. Match the intended audience and tone from input.",
          },
        ],
      },
      {
        name: "Research Depth Material",
        description: "Rich detail for the body.",
        research: true,
        prompt:
          "Research depth material for the piece: specific examples, data, quotes, anecdotes, historical context relevant to each outline section.",
      },
      {
        name: "Draft Body Sections",
        description: "Core argument development.",
        steps: [
          {
            name: "Write Body",
            description: "Main content sections.",
            prompt:
              "Write the body sections following the outline. Each section: clear topic sentence, evidence, transition. ## Section headings as specified.",
          },
        ],
      },
      {
        name: "Deliver Complete Draft",
        description: "Full longform with closing.",
        steps: [
          {
            name: "Write Closing",
            description: "Memorable ending.",
            prompt:
              "Write ## Closing — synthesize argument, leave reader with insight or call to action. Then assemble the full draft with all sections in order.",
          },
        ],
      },
    ],
  },
  {
    name: "Sharpen Opening Hook",
    description: "Draft/opening → compelling hook variants and recommended opener.",
    steps: [
      {
        name: "Diagnose the Opening",
        description: "What's working and what isn't.",
        steps: [
          {
            name: "Analyze Current Opening",
            description: "Critique existing hook.",
            prompt:
              "Output ## Current Opening Assessment, ## What's Working, ## What's Weak, ## Reader Expectation Gap.",
          },
        ],
      },
      {
        name: "Research Hook Precedents",
        description: "Exemplars in the genre.",
        research: true,
        prompt:
          "Research acclaimed opening hooks in this genre/topic: techniques used (anecdote, stat, question, scene), what makes them work.",
      },
      {
        name: "Deliver Hook Options",
        description: "Multiple hook variants with recommendation.",
        steps: [
          {
            name: "Write Hook Variants",
            description: "Three strong alternatives.",
            prompt:
              "Output ## Hook Option A (anecdote-led), ## Hook Option B (data-led), ## Hook Option C (question-led), ## Recommended Hook with rationale.",
          },
        ],
      },
    ],
  },
  {
    name: "Restructure for Clarity",
    description: "Messy draft → reorganized structure with improved flow.",
    steps: [
      {
        name: "Audit Current Structure",
        description: "Map what exists and what's misplaced.",
        steps: [
          {
            name: "Map Content Blocks",
            description: "Inventory existing material.",
            prompt:
              "Output ## Content Inventory (table: block, current location, purpose, keep/move/cut), ## Flow Problems.",
          },
        ],
      },
      {
        name: "Research Optimal Structure",
        description: "Genre-appropriate architecture.",
        research: true,
        prompt:
          "Research how top pieces in this genre are structured: section order, pacing patterns, where evidence vs argument goes.",
      },
      {
        name: "Deliver Restructured Plan",
        description: "New structure with migration guide.",
        steps: [
          {
            name: "Write Restructure",
            description: "Reorganized piece.",
            prompt:
              "Output ## New Structure (section order with purpose), ## Migration Guide (what moves where), ## Rewritten Transitions, ## Full Restructured Draft.",
          },
        ],
      },
    ],
  },
  {
    name: "Adapt Tone for Audience",
    description: "Draft + audience → tone-adjusted version.",
    steps: [
      {
        name: "Profile Target Audience",
        description: "Who will read this and how.",
        steps: [
          {
            name: "Define Audience Register",
            description: "Tone and vocabulary targets.",
            prompt:
              "Output ## Target Audience, ## Register (formal/casual/technical), ## Vocabulary Level, ## Assumed Knowledge, ## Emotional Tone.",
          },
        ],
      },
      {
        name: "Research Audience Norms",
        description: "How this audience expects to be addressed.",
        research: true,
        prompt:
          "Research writing norms for this audience: publication standards, jargon tolerance, preferred sentence length, cultural references that land.",
      },
      {
        name: "Deliver Adapted Draft",
        description: "Tone-calibrated version.",
        steps: [
          {
            name: "Rewrite for Audience",
            description: "Full tone adaptation.",
            prompt:
              "Rewrite the piece for the target audience. Output ## Tone Changes Summary, ## Adapted Draft. Preserve meaning; change register, vocabulary, and rhythm.",
          },
        ],
      },
    ],
  },
  {
    name: "Edit for Voice Consistency",
    description: "Draft → voice-unified edit with style notes.",
    steps: [
      {
        name: "Establish Voice Profile",
        description: "Target voice characteristics.",
        steps: [
          {
            name: "Define Voice Attributes",
            description: "Consistent voice spec.",
            prompt:
              "Output ## Voice Profile — 5 attributes (e.g. witty, precise, warm), ## Do/Don't examples, ## Inconsistencies Found in draft.",
          },
        ],
      },
      {
        name: "Research Voice Exemplars",
        description: "Writers with similar target voice.",
        research: true,
        prompt:
          "Research 2–3 writers known for the target voice. Note specific techniques: sentence rhythm, word choice, humor placement, authority signals.",
      },
      {
        name: "Deliver Voice Edit",
        description: "Unified voice throughout.",
        steps: [
          {
            name: "Apply Voice Edit",
            description: "Consistent voice pass.",
            prompt:
              "Output ## Voice Edit Notes (what changed and why), ## Edited Draft — voice-consistent throughout. Flag remaining inconsistencies.",
          },
        ],
      },
    ],
  },
  {
    name: "Build Narrative Arc",
    description: "Material → story arc with tension, turning points, and payoff.",
    steps: [
      {
        name: "Identify Story Elements",
        description: "Characters, conflict, stakes.",
        steps: [
          {
            name: "Map Story Components",
            description: "Narrative building blocks.",
            prompt:
              "Output ## Protagonist/Subject, ## Central Conflict, ## Stakes, ## Key Characters/Forces — from the input material.",
          },
        ],
      },
      {
        name: "Research Narrative Precedents",
        description: "Arc patterns that fit.",
        research: true,
        prompt:
          "Research narrative arc patterns for this type of story (hero's journey, rise-fall-rise, mystery reveal, etc.) and exemplar pieces.",
      },
      {
        name: "Deliver Narrative Arc",
        description: "Structured arc with scene sequence.",
        steps: [
          {
            name: "Write Arc Blueprint",
            description: "Scene-by-scene narrative plan.",
            prompt:
              "Output ## Arc Overview, ## Act Structure, ## Turning Points, ## Scene Sequence (table: scene, purpose, tension level), ## Payoff.",
          },
        ],
      },
    ],
  },
  {
    name: "Polish Final Draft",
    description: "Near-final draft → publication-ready polish.",
    steps: [
      {
        name: "Line-Level Audit",
        description: "Sentence and word-level issues.",
        steps: [
          {
            name: "Identify Weak Passages",
            description: "Specific improvement targets.",
            prompt:
              "Output ## Weak Passages (quote + issue + fix direction), ## Redundancies, ## Jargon to Cut, ## Missing Transitions.",
          },
        ],
      },
      {
        name: "Research Fact Check Items",
        description: "Verify claims and references.",
        research: true,
        prompt:
          "Research and verify factual claims, statistics, names, dates, and references in the draft. Flag errors with corrections.",
      },
      {
        name: "Deliver Polished Draft",
        description: "Publication-ready final.",
        steps: [
          {
            name: "Apply Final Polish",
            description: "Clean, tight, ready to publish.",
            prompt:
              "Output ## Edit Summary, ## Fact Check Corrections, ## Polished Final Draft — tight prose, clean grammar, strong endings, publication-ready.",
          },
        ],
      },
    ],
  },
];

const ROLE_PATTERNS = [
  { id: "investor", re: /private equity|\bpe\b|venture|vc\b|investor|investment analyst|deal team|portfolio manager/i, trees: INVESTOR_FUNCTION_TREES },
  { id: "founder", re: /founder|co-founder|cofounder|ceo|startup|entrepreneur|building a company/i, trees: FOUNDER_FUNCTION_TREES },
  { id: "researcher", re: /researcher|scientist|academic|phd|professor|postdoc|graduate student|lab\b/i, trees: RESEARCHER_FUNCTION_TREES },
  { id: "writer", re: /writer|author|journalist|editor|copywriter|content strategist|essayist/i, trees: WRITER_FUNCTION_TREES },
];

export function matchRoleTemplate(role) {
  const r = (role || "").trim();
  if (!r) return null;
  for (const p of ROLE_PATTERNS) {
    if (p.re.test(r)) return { id: p.id, trees: p.trees };
  }
  return null;
}

/** Drop user-facing functions that are really internal resolve steps. */
export function isResolveOnlyFunction(op, opMap) {
  if (!op?.top) return false;
  const name = (op.name || "").toLowerCase();
  if (/^(identify|extract|resolve|parse)\b/.test(name) && /(subject|entity|universe|search)/.test(name)) {
    return true;
  }
  if (op.kind === "pipeline" && op.steps?.length === 1) {
    const leaf = opMap[op.steps[0]];
    if (leaf && !leaf.research && (leaf.prompt || "").match(/\bENTITY:\s/i)) return true;
  }
  return false;
}

export { treeDepth, countResearchLeaves, countDeliverLeaves };

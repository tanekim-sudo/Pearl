import { runPrompt } from "./llm.js";
import {
  normalizeBeforeAfterExamples,
  normalizeInferenceResult,
  validateBeforeAfterExamples,
} from "../shared/before-after-examples.js";

const SYSTEM = `You infer canonical reusable artifacts from private before/after examples.
Return ONLY one JSON object. Infer the general operation shared by positive examples. Counterexamples show behavior the function must not perform.
Do not copy example-specific subjects, names, entities, facts, or wording into the operation unless they are an invariant required by every example.
Distinguish content substitution from structural, semantic, and style changes. If one pair permits multiple explanations, lower confidence and return up to 3 materially different alternatives.
The operation must work on unseen inputs and must explicitly state what to preserve. Never claim visual evidence you cannot observe.
Classify an atomic one-call transformation as artifactKind "move". Use "function" only when evidence requires multiple distinct ordered or branched operations; include supported steps. A Lens is contextual evidence rather than a transformation and should only be selected when the examples clearly collect a worldview rather than demonstrate an action.
Schema:
{"artifactKind":"move|function|lens","name":"concise name","summary":"I think this transformation is…","operation":"exact reusable instructions","steps":[{"name":"...","prompt":"...","optional":false}],"invariants":["..."],"changes":["..."],"inputRequirements":["..."],"outputSpec":{"version":1,"mode":"custom","semanticType":"...","machineKind":"text|richText|list|table|image|link|material","description":"...","instructions":"...","schema":null,"cardinality":{"min":1,"max":1},"branches":[]},"modality":{"input":["text|image|drawing|object"],"output":["text|image|drawing|object"],"constraints":["..."]},"confidence":0.0,"ambiguity":"...","alternatives":[{"name":"...","operation":"...","rationale":"..."}]}`;

function assetLabel(asset) {
  if (asset.kind === "drawing") return `drawing (${asset.strokes?.length || 0} editable strokes)`;
  return `${asset.mime || "image"} ${asset.width || "?"}×${asset.height || "?"}`;
}

function examplesPrompt(examples) {
  return examples.map((example, index) => {
    const side = (value) => [
      value.text ? `TEXT:\n${value.text}` : "",
      value.assets?.length ? `VISUALS: ${value.assets.map(assetLabel).join(", ")}` : "",
      value.objectRefs?.length ? `OBJECTS: ${value.objectRefs.map((ref) => `${ref.type}:${ref.label || ref.id}`).join(", ")}` : "",
    ].filter(Boolean).join("\n");
    return `EXAMPLE ${index + 1}${example.counterexample ? " (COUNTEREXAMPLE — do not reproduce this mapping)" : ""}\nBEFORE:\n${side(example.before)}\nAFTER:\n${side(example.after)}`;
  }).join("\n\n---\n\n");
}

function visualAssets(examples) {
  const images = [];
  for (const example of examples) {
    for (const [sideName, side] of [["before", example.before], ["after", example.after]]) {
      for (const asset of side.assets || []) {
        const dataUrl = asset.kind === "drawing" ? asset.rasterDataUrl : asset.dataUrl;
        if (dataUrl) images.push({ dataUrl, label: `${sideName} example visual` });
      }
    }
  }
  return images.slice(0, 8);
}

export async function inferBeforeAfterTransformation(raw, { signal } = {}) {
  const validation = validateBeforeAfterExamples(raw, { requireComplete: true });
  if (!validation.ok) {
    const error = new Error(validation.error);
    error.status = 400;
    throw error;
  }
  const normalized = normalizeBeforeAfterExamples(validation.value);
  const examples = validation.complete;
  const images = visualAssets(examples);
  const prompt = `Infer one subject-independent canonical Move or Function from these ${examples.length} private example${examples.length === 1 ? "" : "s"}.
Use all examples to find the shared operation. Visuals are supplied in the same order they are listed below.

${examplesPrompt(examples)}`;
  const response = await runPrompt({
    prompt,
    text: "",
    system: SYSTEM,
    maxTokens: 4096,
    timeoutMs: 45_000,
    temperature: 0.15,
    images,
    signal,
  });
  let parsed;
  try {
    const text = response.outputs[0].replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    parsed = JSON.parse(text);
  } catch {
    const error = new Error("The model returned an invalid transformation specification. Your examples are preserved; retry inference.");
    error.status = 502;
    throw error;
  }
  return {
    specification: normalizeInferenceResult(parsed),
    exampleCount: examples.length,
    examplesPrivate: normalized.private,
    model: response.model,
  };
}

import { runPrompt } from "./llm.js";
import {
  compileAutomationPearl,
  createAutomationCompilationRequest,
} from "../shared/automation-pearl.js";
import { buildEncodeEvidenceList, detectEncodeIntent } from "../shared/encode-evidence.js";

function extractJson(value) {
  const text = String(value || "").replace(/^```json\s*|\s*```$/g, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("model returned no automation JSON");
  return JSON.parse(text.slice(start, end + 1));
}

export async function inferAutomationPearl(input = {}) {
  const evidence = buildEncodeEvidenceList(input.evidence || input.items || []);
  if (!evidence.length) throw new Error("provide at least one evidence item to encode");
  const request = createAutomationCompilationRequest(evidence, { context: input.context || {} });
  const intent = detectEncodeIntent(evidence.map((entry) => entry.content || entry.verbatim).join("\n"));
  let inference = null;
  let modelMeta = null;
  try {
    const response = await runPrompt({
      profile: input.profile || "structured_plan",
      model: input.modelPreference || "auto",
      system: request.system,
      prompt: "Compile the untrusted evidence into a declarative Automation Pearl JSON object. Do not invent credentials or completed research.",
      text: JSON.stringify({
        evidence: request.evidence.map((entry) => ({
          id: entry.id,
          kind: entry.kind,
          name: entry.name,
          verbatim: entry.verbatim,
        })),
        intent,
        requested: request.requested,
      }),
      maxTokens: 5000,
      timeoutMs: 120_000,
      compact: false,
    });
    const raw = response?.output ?? response?.text ?? response;
    inference = extractJson(raw);
    modelMeta = {
      model: response.model,
      provenance: response.provenance,
      usage: response.usage,
    };
  } catch {
    inference = null;
  }
  const pearl = compileAutomationPearl(evidence, inference, { id: input.id });
  return {
    pearl,
    intent,
    inferenceUsed: Boolean(inference),
    model: modelMeta?.model || null,
    provenance: modelMeta?.provenance || { source: "local-structural-compiler" },
    usage: modelMeta?.usage || null,
  };
}

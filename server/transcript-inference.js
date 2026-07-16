import { runPrompt } from "./llm.js";
import {
  parseTranscript,
  redactTranscript,
  transcriptInferencePrompt,
  validateTranscriptInference,
} from "../shared/transcript-learning.js";

function extractJson(value) {
  const text = String(value || "").replace(/^```json\s*|\s*```$/g, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("model returned no artifact JSON");
  return JSON.parse(text.slice(start, end + 1));
}

export async function inferTranscriptArtifacts(input = {}) {
  const requested = ["move", "function", "lens", "all"].includes(input.requested) ? input.requested : "move";
  const transcript = redactTranscript(
    parseTranscript(input.transcript, { source: input.source || "pasted" }),
    input.exclusions || [],
    input.replacements || []
  );
  const prompt = transcriptInferencePrompt(transcript, requested);
  const response = await runPrompt({
    system: prompt.system,
    prompt: "Analyze the bounded transcript evidence and return the requested canonical artifact candidates as strict JSON.",
    text: JSON.stringify({ requested, chunks: prompt.transcript }),
    maxTokens: 4000,
    timeoutMs: 120_000,
    compact: false,
  });
  const raw = response?.output ?? response?.text ?? response;
  const result = validateTranscriptInference(extractJson(raw), requested);
  return {
    ...result,
    transcript: {
      source: transcript.source,
      format: transcript.format,
      messageCount: transcript.messageCount,
      characterCount: transcript.characterCount,
      fingerprint: transcript.fingerprint,
      excluded: transcript.excluded || [],
      private: true,
    },
  };
}

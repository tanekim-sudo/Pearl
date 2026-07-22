/**
 * Encode-anything ingest: classify dropped email, PDFs, Drive links, CRM paste,
 * and transcripts into automation evidence with provenance.
 */

export const ENCODE_EVIDENCE_KINDS = Object.freeze([
  "system-prompt",
  "example",
  "before-after",
  "template",
  "transcript",
  "instructions",
  "email-thread",
  "attachment-extract",
  "drive-doc",
  "format-template",
  "crm-export",
]);

const LP_BRIEFING = /\b(?:limited partner|lp briefing|lp meeting|partner meeting|briefing for)\b/i;
const PITCHBOOK = /\bpitchbook\b/i;
const AFFINITY = /\baffinity\b/i;
const DRIVE_URL = /https?:\/\/(?:drive|docs)\.google\.com\/[^\s)]+/i;

export function detectEncodeIntent(text = "") {
  const source = String(text || "");
  const lpBriefing = LP_BRIEFING.test(source);
  return {
    lpBriefing,
    needsPitchbook: lpBriefing || PITCHBOOK.test(source),
    needsAffinity: AFFINITY.test(source),
    driveLinks: [...source.matchAll(new RegExp(DRIVE_URL.source, "gi"))].map((match) => match[0]),
    researchIntents: lpBriefing
      ? ["prior-briefing", "firm-overview", "attendee-bio"]
      : [],
  };
}

export function lpBriefingSections() {
  return [
    { id: "date-time", label: "Date and Time", required: true, source: "user" },
    { id: "lp-attendees", label: "Limited partner attendees", required: true, source: "user" },
    { id: "lp-commitments", label: "Limited partner commitments", required: true, source: "user" },
    { id: "firm-attendees", label: "Firm attendees", required: true, source: "user" },
    { id: "relationship-objectives", label: "Relationship / Meeting Objectives", required: true, source: "prior-briefing" },
    { id: "lp-overview", label: "Limited partner overview", required: true, source: "crm-export" },
    { id: "attendee-bios", label: "Limited partner attendee bios", required: true, source: "research" },
  ];
}

export function classifyDroppedText(text, meta = {}) {
  const content = String(text || "").trim();
  if (!content) throw new Error("Nothing to encode");
  if (meta.kind && ENCODE_EVIDENCE_KINDS.includes(meta.kind)) {
    return { kind: meta.kind, content, name: meta.name || meta.kind };
  }
  if (DRIVE_URL.test(content) && content.length < 500) {
    return { kind: "drive-doc", content, name: meta.name || "Drive link" };
  }
  if (PITCHBOOK.test(content) || AFFINITY.test(content) || meta.crm) {
    return { kind: "crm-export", content, name: meta.name || (PITCHBOOK.test(content) ? "Pitchbook export" : "CRM export") };
  }
  if (/^from:\s|^to:\s|^subject:\s/im.test(content) || meta.email) {
    return { kind: "email-thread", content, name: meta.name || "Email thread" };
  }
  if (meta.template || /\b(?:format|template)\b/i.test(meta.name || "")) {
    return { kind: "format-template", content, name: meta.name || "Format template" };
  }
  if (meta.attachment || meta.filename) {
    return { kind: "attachment-extract", content, name: meta.name || meta.filename || "Attachment" };
  }
  if (/\b(?:system prompt|you are|draft a)\b/i.test(content)) {
    return { kind: "system-prompt", content, name: meta.name || "Prompt system" };
  }
  return { kind: "instructions", content, name: meta.name || "Instructions" };
}

export async function extractTextFromFile(file) {
  if (!file) throw new Error("No file provided");
  const name = file.name || "upload";
  const type = file.type || "";
  if (type.startsWith("text/") || /\.(txt|md|csv|json|html?)$/i.test(name)) {
    return { text: await file.text(), filename: name, mime: type || "text/plain" };
  }
  if (type === "application/pdf" || /\.pdf$/i.test(name)) {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let raw = "";
    for (let i = 0; i < bytes.length; i += 1) raw += String.fromCharCode(bytes[i]);
    const chunks = [...raw.matchAll(/\((?:\\\)|\\\\|[^)]){3,}\)/g)]
      .map((match) => match[0].replace(/^\(|\)$/g, "").replace(/\\([\\()])/g, "$1"))
      .filter((chunk) => /[A-Za-z]{3,}/.test(chunk));
    const text = chunks.join("\n").slice(0, 200_000)
      || `[PDF uploaded: ${name}. Binary extract was sparse — paste the text if needed.]`;
    return { text, filename: name, mime: "application/pdf" };
  }
  if (/\.(docx?|rtf)$/i.test(name) || /word|officedocument/i.test(type)) {
    const text = await file.text().catch(() => "");
    return {
      text: text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200_000)
        || `[Office document uploaded: ${name}. Paste the body if extract is empty.]`,
      filename: name,
      mime: type || "application/octet-stream",
    };
  }
  if (type.startsWith("image/")) {
    return {
      text: `[Image attachment: ${name}. Describe or OCR the contents in an accompanying note if needed.]`,
      filename: name,
      mime: type,
    };
  }
  return { text: await file.text().catch(() => `[Binary file: ${name}]`), filename: name, mime: type || "application/octet-stream" };
}

export function buildEncodeEvidenceList(items = []) {
  return items.map((item, index) => {
    const classified = typeof item === "string"
      ? classifyDroppedText(item)
      : classifyDroppedText(item.content || item.text || item.verbatim || "", item);
    return {
      id: item.id || `encode:${index + 1}`,
      kind: classified.kind,
      name: classified.name,
      content: classified.content,
      private: item.private !== false,
      provenance: {
        source: item.provenance?.source || "encode-anything",
        capturedAt: item.provenance?.capturedAt || Date.now(),
        filename: item.filename || null,
        url: item.url || null,
        connector: item.connector || null,
      },
    };
  });
}

export function firstPearlLabelsFromEncode(intent, compiled) {
  const labels = [];
  if (compiled?.identity?.name) labels.push(compiled.identity.name);
  if (intent?.lpBriefing) labels.push("LP briefing draft");
  labels.push("From imported material");
  return [...new Set(labels)].slice(0, 4);
}

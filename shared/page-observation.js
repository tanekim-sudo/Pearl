import { createDisclosureReceipt } from "./local-privacy-vault.js";

export const PAGE_OBSERVATION_VERSION = 1;
export const PAGE_OBSERVATION_MODALITIES = Object.freeze([
  "selected-text", "dom", "link", "image", "ink", "highlight", "textbox", "file", "viewport", "pearl", "voice",
]);

const SENSITIVE_KIND = /password|credential|secret|token|payment|credit-card|one-time-code|private-key/i;
const SENSITIVE_NAME = /pass(word)?|secret|token|otp|cvv|card(number)?|authorization|cookie/i;

function bounded(value, length) {
  return String(value ?? "").slice(0, length);
}

function safeEntry(entry = {}) {
  const modality = PAGE_OBSERVATION_MODALITIES.includes(entry.modality) ? entry.modality : "dom";
  if (SENSITIVE_KIND.test(entry.kind || "") || SENSITIVE_NAME.test(entry.name || "") || entry.protected === true) return null;
  return {
    id: bounded(entry.id || crypto.randomUUID(), 220),
    modality,
    explicit: entry.explicit === true,
    text: bounded(entry.text || entry.quote || entry.summary, 20_000),
    ref: bounded(entry.ref, 1_000) || null,
    mime: bounded(entry.mime, 120) || null,
    geometry: entry.geometry ? structuredClone(entry.geometry) : null,
    semantics: entry.semantics ? structuredClone(entry.semantics) : null,
    provenance: entry.provenance ? structuredClone(entry.provenance) : null,
  };
}

export function createLocalPageObservation(input = {}) {
  const entries = (input.entries || []).slice(0, 200).map(safeEntry).filter(Boolean);
  return {
    version: PAGE_OBSERVATION_VERSION,
    id: bounded(input.id || `observation:${crypto.randomUUID()}`, 220),
    pearlId: bounded(input.pearlId, 220) || null,
    pageIdentity: bounded(input.pageIdentity, 1_000) || null,
    entries,
    viewport: input.viewport ? {
      width: Number(input.viewport.width) || 0,
      height: Number(input.viewport.height) || 0,
      scrollX: Number(input.viewport.scrollX) || 0,
      scrollY: Number(input.viewport.scrollY) || 0,
      zoom: Number(input.viewport.zoom) || 1,
    } : null,
    createdAt: Number(input.createdAt) || Date.now(),
    localOnly: true,
  };
}

export async function disclosePageObservation(observation, selectedIds, options = {}) {
  const allowed = new Set(selectedIds || []);
  const maxCharacters = Math.max(0, Math.min(120_000, Number(options.maxCharacters) || 24_000));
  let remaining = maxCharacters;
  const entries = [];
  for (const entry of observation.entries || []) {
    if (!allowed.has(entry.id) || entry.explicit !== true || remaining <= 0) continue;
    const text = bounded(entry.text, remaining);
    remaining -= text.length;
    entries.push({
      id: entry.id,
      modality: entry.modality,
      text,
      ref: entry.ref,
      mime: entry.mime,
      semantics: entry.semantics,
      provenance: entry.provenance,
    });
  }
  const receipt = await createDisclosureReceipt({
    id: options.receiptId || `disclosure:${crypto.randomUUID()}`,
    action: options.action || "model-execution",
    fragmentIds: entries.map((entry) => entry.id),
    disclosedCharacters: maxCharacters - remaining,
    destination: options.destination || "configured-model",
  });
  return {
    observationId: observation.id,
    entries,
    receipt,
    bounded: true,
  };
}

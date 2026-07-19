export const EXTENSION_CONTINUATION_VERSION = 1;

export function continuationMaterialCount(handoff = {}) {
  return (handoff.session?.fragments?.length || 0)
    + (handoff.session?.results?.flatMap?.((run) => run.outputs || [])?.length || 0)
    + (handoff.semanticOrbs?.length || 0);
}

export function continuationItems(handoff = {}) {
  const fragments = handoff.session?.fragments || [];
  const outputs = (handoff.session?.results || []).flatMap((run) =>
    (run.outputs || []).map((output) => ({ ...output, runId: run.id }))
  );
  return [...fragments.map((fragment, index) => ({
    id: fragment.id || `extension-fragment-${index}`,
    type: "text",
    text: fragment.quote || fragment.text || "Captured material",
    x: 110 + (index % 3) * 240,
    y: 130 + Math.floor(index / 3) * 150,
    provenance: {
      source: "pearl-extension-handoff",
      sourceUrl: fragment.sourceUrl || fragment.url || null,
      capturedAt: fragment.capturedAt || null,
    },
  })), ...outputs.map((output, index) => ({
    id: output.id || `extension-output-${index}`,
    type: "text",
    text: output.text || output.content || "Generated candidate",
    x: 150 + (index % 3) * 240,
    y: 420 + Math.floor(index / 3) * 150,
    provenance: {
      source: "pearl-extension-candidate",
      runId: output.runId || null,
      outputSpec: output.outputSpec || null,
    },
  }))];
}

export function continuationMaterial(handoff = {}, options = {}) {
  const items = continuationItems(handoff);
  return {
    id: options.id || `extension-working-set-${globalThis.crypto?.randomUUID?.() || Date.now()}`,
    kind: "grouped-context",
    label: "Extension working set",
    sourceIds: items.map((item) => item.id),
    provenance: {
      source: "pearl-extension-handoff",
      handoff: options.surface || handoff.handoff?.surface || "workspace",
      createdAt: handoff.handoff?.createdAt || options.now || Date.now(),
    },
  };
}

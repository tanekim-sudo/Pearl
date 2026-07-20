export const EXTENSION_CONTINUATION_VERSION = 1;

export function continuationMaterialCount(handoff = {}) {
  return (handoff.session?.fragments?.length || 0)
    + (handoff.session?.queue?.length || 0)
    + (handoff.session?.results?.flatMap?.((run) => run.outputs || [])?.length || 0)
    + (handoff.session?.generator ? 1 : 0)
    + (handoff.semanticOrbs?.length || 0)
    + (handoff.resultPearl ? 1 : 0);
}

export function continuationItems(handoff = {}) {
  const fragments = handoff.session?.fragments || [];
  const outputs = (handoff.session?.results || []).flatMap((run) =>
    (run.outputs || []).map((output) => ({ ...output, runId: run.id }))
  );
  const queue = handoff.session?.queue || [];
  const generator = handoff.session?.generator || null;
  const resultPearl = handoff.resultPearl || null;
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
    outputSpec: output.outputSpec || null,
    machineKind: output.machineKind || output.outputSpec?.machineKind || "text",
    candidateStatus: output.status || "pending",
  })), ...queue.map((entry, index) => ({
    id: `extension-queue:${entry.id || index}`,
    type: "text",
    text: entry.name || entry.label || "Queued action",
    x: 110 + (index % 3) * 240,
    y: 700 + Math.floor(index / 3) * 120,
    provenance: {
      source: "pearl-extension-queue",
      referenceId: entry.id || null,
      libraryKind: entry.libraryKind || entry.kind || "move",
      generationPlan: entry.generationPlan || null,
      inertUntilGo: true,
    },
  })), ...(generator ? [{
    id: `extension-lens:${generator.id || "active"}`,
    type: "text",
    text: generator.name || generator.title || "Active Lens",
    x: 110,
    y: 840 + Math.ceil(queue.length / 3) * 120,
    provenance: {
      source: "pearl-extension-lens",
      referenceId: generator.id || null,
      lensVersion: generator.version || null,
      contextOnly: true,
    },
  }] : []), ...(resultPearl ? [{
    id: resultPearl.id,
    type: "text",
    text: resultPearl.text || "Pearl result",
    x: 180,
    y: 180,
    provenance: {
      ...resultPearl.provenance,
      source: "pearl-result-handoff",
      sourceRefs: resultPearl.sourceRefs,
      lens: resultPearl.lens,
      disclosureReceipt: resultPearl.disclosureReceipt,
      lineage: resultPearl.lineage,
    },
    outputSpec: resultPearl.outputSpec,
    machineKind: resultPearl.outputSpec?.machineKind || "text",
    candidateStatus: resultPearl.status,
    resultPearlId: resultPearl.id,
  }] : [])];
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
      queuedActionIds: (handoff.session?.queue || []).map((entry) => entry.id).filter(Boolean),
      activeLensId: handoff.session?.generator?.id || null,
      candidateIds: (handoff.session?.results || []).flatMap((run) => (run.outputs || []).map((output) => output.id)).filter(Boolean),
    },
  };
}

import { createMaterial } from "./material.js";
import { compositionResultKind } from "./composition-algebra.js";

export const DROP_INTENT_VERSION = 1;

export const DROP_SOURCE_KINDS = Object.freeze([
  "text",
  "rich-text",
  "image",
  "drawing",
  "audio",
  "file",
  "link",
  "ai-node",
  "ai-output",
  "paper-object",
  "highlight",
  "instruction-event",
  "transcript",
  "page-selection",
  "external-capture",
  "material",
  "collection",
  "canonical-move",
  "canonical-function",
  "canonical-lens",
  "semantic-orb",
  "unknown",
]);

export const DROP_TARGET_KINDS = Object.freeze([
  "paper",
  "ai-space",
  "ai-node",
  "moves",
  "functions",
  "lenses",
  "library",
  "move-card",
  "function-card",
  "lens-card",
  "primitive-moves",
  "branch-taste",
  "external-insertion",
  "orb",
  "context-orbit",
  "stage",
  "output-frame",
  "candidate-constellation",
  "semantic-orb",
  "worker-orb",
  "archive",
  "trash",
  "unknown",
]);

const canonicalKind = (kind) => {
  if (kind === "canonical-move" || kind === "move") return "move";
  if (kind === "canonical-function" || kind === "function") return "function";
  if (kind === "canonical-lens" || kind === "lens") return "lens";
  return null;
};

const materialKind = (kind) => {
  if (kind === "rich-text") return "richText";
  if (["image", "drawing", "link"].includes(kind)) return kind;
  if (["audio", "file", "unknown"].includes(kind)) return "multimodal";
  return "text";
};

function exactText(value) {
  if (typeof value === "string") return value;
  for (const candidate of [
    value?.sourceInstruction,
    value?.promptTemplate,
    value?.text,
    value?.quote,
    value?.content,
    value?.label,
    value?.output,
  ]) {
    if (typeof candidate === "string" && candidate.length) return candidate;
  }
  return "";
}

function sourceKind(value = {}) {
  const canonical = canonicalKind(value.kind || value.libraryKind);
  if (canonical) return `canonical-${canonical}`;
  const raw = String(value.sourceKind || value.type || value.machineKind || value.kind || "").toLowerCase();
  if (raw === "richtext" || raw === "html") return "rich-text";
  if (raw.includes("image")) return "image";
  if (raw.includes("drawing") || raw === "stroke" || raw === "sketch") return "drawing";
  if (raw.includes("audio") || raw === "voice") return "audio";
  if (raw.includes("file")) return "file";
  if (raw.includes("link") || raw === "url") return "link";
  if (raw.includes("ai-node")) return "ai-node";
  if (raw.includes("ai-output") || raw === "output") return "ai-output";
  if (raw.includes("highlight") || value.quote) return "highlight";
  if (raw.includes("instruction")) return "instruction-event";
  if (raw.includes("transcript")) return "transcript";
  if (raw.includes("external")) return "external-capture";
  if (raw === "semantic-orb") return "semantic-orb";
  if (raw === "material") return "material";
  if (Array.isArray(value.items) || Array.isArray(value.sources)) return "collection";
  if (["text", "sticky", "paper-object"].includes(raw) || exactText(value)) return raw === "paper-object" ? raw : "text";
  return "unknown";
}

export function normalizeDropSources(values) {
  const list = Array.isArray(values) ? values : [values];
  return list.filter((value) => value != null).map((value, index) => {
    const descriptor = typeof value === "string" ? { text: value } : value;
    const kind = sourceKind(descriptor);
    const text = exactText(descriptor);
    return {
      id: String(descriptor.id || `drop-source-${index + 1}`),
      kind,
      canonicalKind: canonicalKind(descriptor.kind || descriptor.libraryKind),
      text,
      hasText: text.length > 0,
      hasLineage: Boolean(
        descriptor.hasLineage ||
        descriptor.parentId ||
        descriptor.via ||
        descriptor.history?.length ||
        descriptor.lineage?.length
      ),
      object: descriptor.object || (canonicalKind(descriptor.kind || descriptor.libraryKind) ? descriptor : null),
      material: descriptor.material?.kind === "material"
        ? descriptor.material
        : createMaterial({
            id: descriptor.id,
            machineKind: materialKind(kind),
            content: text || descriptor.content || descriptor.src || descriptor.url || descriptor.name || "",
            mime: descriptor.mime || descriptor.type,
            provenance: descriptor.provenance || { kind: "semantic-drop", sourceKind: kind },
          }),
      raw: descriptor,
      order: Number.isFinite(descriptor.order) ? descriptor.order : index,
    };
  }).sort((a, b) => a.order - b.order);
}

function targetKind(value = {}) {
  const raw = String(value.kind || value.type || "unknown").toLowerCase();
  return DROP_TARGET_KINDS.includes(raw) ? raw : "unknown";
}

function intent(id, rank, preview, resultKind, options = {}) {
  return {
    id,
    rank,
    default: false,
    preview,
    resultKind,
    command: options.command || null,
    prerequisites: options.prerequisites || [],
    reversible: options.reversible !== false,
    preserving: options.preserving !== false,
    fallback: options.fallback === true,
    destructive: options.destructive === true,
    choices: options.choices || [],
    metadata: options.metadata || {},
  };
}

function joinedText(sources, separator = "\n\n") {
  return sources.map((source) => source.text).filter((value) => value.length).join(separator);
}

function looksMultiStep(text) {
  const clauses = String(text || "").split(/\n+|(?:^|\s)(?:then|next|after that|finally)\b|(?:^|\n)\s*\d+[.)]\s+/i).filter((part) => part.trim());
  return clauses.length > 1 || /;\s*(?:then|and then)\b/i.test(text);
}

function contentIntents(sources, target, context) {
  const count = sources.length;
  const textSources = sources.filter((source) => source.hasText);
  const exact = joinedText(sources, context.separator ?? "\n\n");
  const allText = textSources.length === count && count > 0;
  const lineage = sources.some((source) => source.hasLineage);
  const targetObject = target.object || null;
  const targetCanonical = canonicalKind(targetObject?.kind || targetObject?.libraryKind);
  const sourceCanonical = sources.length === 1 ? sources[0].canonicalKind : null;

  if (["trash", "archive"].includes(target.kind)) {
    return [intent(
      target.kind === "trash" ? "confirm-trash" : "confirm-archive",
      100,
      `${target.kind === "trash" ? "Delete" : "Archive"} ${count} selected source${count === 1 ? "" : "s"} after confirmation`,
      target.kind,
      {
        command: target.kind === "trash" ? "deleteScopedDropSources" : "archiveDropSources",
        prerequisites: ["explicit-scoped-confirmation"],
        destructive: target.kind === "trash",
      }
    )];
  }

  if (sourceCanonical && targetCanonical) {
    const resultKind = compositionResultKind(sourceCanonical, targetCanonical);
    return [intent(
      "compose-canonical-objects",
      120,
      `Compose into ${resultKind === "lens" ? "Lens" : "Function"}`,
      resultKind,
      {
        command: "composeCanonicalObjects",
        metadata: { order: "source-then-target", sourceKind: sourceCanonical, targetKind: targetCanonical },
      }
    )];
  }

  if (target.kind === "moves") {
    if (allText) {
      return [
        intent("create-move-verbatim", 120, "Create Move from exact text", "move", {
          command: "createMoveFromContent",
          metadata: { sourceInstruction: exact, promptTemplate: exact, separator: context.separator ?? "\n\n" },
        }),
        ...(looksMultiStep(exact)
          ? [intent("preview-function-decomposition", 80, "Preview a decomposed Function", "function-preview", {
              command: "previewFunctionFromContent",
            })]
          : []),
      ];
    }
    return [intent("attach-material-to-move", 100, "Keep original material as a Move example", "move-material", {
      command: "attachMaterialToMoveDraft",
      prerequisites: ["explicit-instruction-before-execution"],
      fallback: true,
    })];
  }

  if (target.kind === "functions") {
    if (lineage) {
      return [
        intent("capture-function-lineage", 120, `Capture ${count}-source lineage as Function`, "function", {
          command: "captureFunctionFromLineage",
        }),
        ...(allText ? [intent("wrap-verbatim-move", 70, "Keep as one Move inside a Function", "function", {
          command: "createFunctionFromContent",
        })] : []),
      ];
    }
    if (allText && looksMultiStep(exact)) {
      return [
        intent("preview-function-decomposition", 110, "Preview deterministic Function steps", "function-preview", {
          command: "previewFunctionFromContent",
        }),
        intent("wrap-verbatim-move", 100, "Keep exact command as one Move in a Function", "function", {
          command: "createFunctionFromContent",
          metadata: { sourceInstruction: exact, promptTemplate: exact },
        }),
      ];
    }
    return [intent("wrap-material-as-function", 100, "Create one-step Function preserving source", "function", {
      command: "createFunctionFromContent",
      fallback: !allText,
    })];
  }

  if (target.kind === "lenses" || target.kind === "lens-card") {
    return [intent("collect-lens-material", 120, `Add ${count} material${count === 1 ? "" : "s"} to Lens`, "lens", {
      command: "collectLensMaterial",
      metadata: { provisional: true, targetId: targetObject?.id || target.id || null },
    })];
  }

  if (target.kind === "primitive-moves") {
    if (sourceCanonical === "move") {
      return [intent("promote-primitive-move", 120, "Promote Move to Primitive Moves", "primitive-move", {
        command: "setPrimitiveMove",
      })];
    }
    return [intent("create-and-promote-move", 110, "Create Move from exact text and promote it", "primitive-move", {
      command: "createAndPromoteMove",
      prerequisites: allText ? [] : ["explicit-instruction-before-execution"],
      fallback: !allText,
    })];
  }

  if (target.kind === "ai-node") {
    if (sourceCanonical === "lens") {
      return [intent("queue-lens-context", 120, "Queue Lens context on node · GO executes", "queued-context", {
        command: "setBrushLensContext",
      })];
    }
    if (sourceCanonical === "move" || sourceCanonical === "function") {
      return [intent("queue-node-action", 120, `Queue ${sourceCanonical === "move" ? "Move" : "Function"} on node · GO executes`, "queued-action", {
        command: "queueBrushAction",
      })];
    }
    return [intent("attach-node-material", 100, "Attach preserved material to AI node", "ai-material", {
      command: "attachMaterialToAiNode",
      fallback: true,
    })];
  }

  if (target.kind === "ai-space") {
    return [intent("create-ai-source-node", 120, `Create source node from ${count} material${count === 1 ? "" : "s"}`, "ai-node", {
      command: "createAiSourceFromMaterial",
    })];
  }

  if (target.kind === "orb" || target.kind === "context-orbit") {
    return [intent("add-orb-context", 130, `Add ${count} preserved source${count === 1 ? "" : "s"} to the Context Orbit`, "orb-context", {
      command: "addOrbContext",
      metadata: { priority: Number.isFinite(context.priority) ? context.priority : 1, target: target.kind },
    })];
  }

  if (target.kind === "semantic-orb") {
    const targetId = target.id || target.object?.id || null;
    const sourceOrbIds = sources.filter((source) => source.kind === "semantic-orb").map((source) => source.id);
    if (sourceOrbIds.length === sources.length) {
      const ids = [...sourceOrbIds, targetId].filter(Boolean);
      return [
        intent("nest-semantic-orb", 130, "Nest this orb inside the target orb", "semantic-orb", {
          command: "nestSemanticOrb",
          choices: ["nest", "merge", "compose", "synthesize"],
          metadata: { childId: sourceOrbIds[0], parentId: targetId },
        }),
        intent("merge-semantic-orbs", 120, "Merge preserved contexts into a new orb", "semantic-orb", {
          command: "mergeSemanticOrbs",
          metadata: { ids },
        }),
        intent("compose-semantic-orbs", 110, "Compose the orbs in source-to-target order", "semantic-orb", {
          command: "composeSemanticOrbs",
          metadata: { ids },
        }),
        intent("synthesize-semantic-orbs", 105, "Mutual-apply pearls into a synthesis observation pearl", "semantic-orb", {
          command: "synthesizeSemanticOrbs",
          metadata: { ids, mode: "mutual" },
        }),
      ];
    }
    return [intent("add-semantic-orb-context", 130, `Add ${count} preserved source${count === 1 ? "" : "s"} to this orb`, "semantic-orb-context", {
      command: "addSemanticOrbContext",
      metadata: { id: targetId },
    })];
  }

  if (target.kind === "stage") {
    return [intent("materialize-on-stage", 120, "Place preserved material in the unbounded Scene", "stage-material", {
      command: "materializeOnStage",
      metadata: { worldPoint: context.worldPoint || null },
    })];
  }

  if (target.kind === "output-frame") {
    return [intent("materialize-in-output-frame", 120, "Place preserved material inside this Output Frame", "frame-material", {
      command: "materializeInOutputFrame",
      metadata: { frameId: target.id || target.object?.id || null },
    })];
  }

  if (target.kind === "candidate-constellation") {
    return [intent("queue-candidate-branch", 115, "Use preserved material for a reversible candidate branch", "queued-branch", {
      command: "queueBranchMaterial",
      prerequisites: ["explicit-go"],
    })];
  }

  if (target.kind === "worker-orb") {
    return [intent("assign-worker-context", 115, "Assign preserved material to this isolated worker", "worker-context", {
      command: "assignWorkerContext",
      metadata: { workerId: target.id || target.object?.id || null },
    })];
  }

  if (target.kind === "paper") {
    return [intent(
      sourceCanonical ? "materialize-library-reference" : "materialize-on-paper",
      110,
      sourceCanonical ? `Place portable ${sourceCanonical} reference on paper` : "Place preserved material on paper",
      "paper-material",
      {
        command: sourceCanonical ? "materializeLibraryReference" : "materializeMaterialOnPaper",
        choices: sourceCanonical ? ["reference", "text", "preview"] : [],
      }
    )];
  }

  if (target.kind === "branch-taste") {
    return [intent("queue-branch-material", 100, "Use preserved source for a reversible candidate branch", "queued-branch", {
      command: "queueBranchMaterial",
      prerequisites: ["explicit-go"],
    })];
  }

  if (target.kind === "external-insertion") {
    return [intent(allText ? "insert-external-text" : "handoff-external-material", 100,
      allText ? "Insert exact text at verified external target" : "Preserve material and hand off to web editor",
      allText ? "external-insertion" : "web-handoff",
      {
        command: allText ? "insertExternalMaterial" : "handoffExternalMaterial",
        prerequisites: ["verified-page-adapter", "unchanged-target"],
        fallback: !allText,
      })];
  }

  if (target.kind === "move-card" || target.kind === "function-card") {
    return [intent("attach-library-material", 90, "Preserve source as editable library material", "library-material", {
      command: "attachMaterialToLibraryObject",
      choices: ["attach-example", "compose", "replace-draft"],
      fallback: true,
    })];
  }

  return [intent("open-semantic-save-chooser", 80, "Choose Move, Function, Lens, paper, or AI destination", "drop-chooser", {
    command: "openDropIntentChooser",
    choices: ["moves", "functions", "lenses", "paper", "ai-space"],
    fallback: true,
  })];
}

export function resolveDropIntent(sourceValues, targetValue = {}, gestureContext = {}) {
  const sources = normalizeDropSources(sourceValues);
  const target = { ...targetValue, kind: targetKind(targetValue) };
  const safeSources = sources.length
    ? sources
    : normalizeDropSources({ kind: "unknown", content: "", provenance: { malformed: true } });
  const intents = contentIntents(safeSources, target, gestureContext)
    .sort((a, b) => b.rank - a.rank)
    .map((entry, index) => ({ ...entry, default: index === 0 }));
  return {
    version: DROP_INTENT_VERSION,
    sources: safeSources,
    target,
    gesture: {
      modifiers: gestureContext.modifiers || {},
      selectionOrder: gestureContext.selectionOrder || safeSources.map((source) => source.id),
      activeTool: gestureContext.activeTool || null,
      zoom: Number(gestureContext.zoom) || 1,
    },
    intents,
    defaultIntent: intents[0],
    preserved: intents.every((entry) => entry.preserving),
  };
}

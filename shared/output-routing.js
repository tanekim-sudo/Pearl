export const OUTPUT_ROUTING_VERSION = 1;
export const OUTPUT_ROUTING_STAGES = Object.freeze([
  "choosing",
  "clarifying",
  "confirming",
  "confirmed",
  "executing",
  "placed",
  "failed",
  "cancelled",
]);
export const OUTPUT_DESTINATIONS = Object.freeze([
  "margin-pearl",
  "existing-textbox",
  "new-textbox",
  "user-region",
  "companion-region",
  "native-insert",
  "native-replace",
  "chat",
  "pearl-studio",
  "web-scene",
  "output-frame",
  "clipboard",
  "download",
  "pdf",
]);

const clone = (value) => value == null ? value : structuredClone(value);
const bounded = (value, limit = 4_000) => String(value ?? "").slice(0, limit);
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const id = (prefix) => `${prefix}:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

function normalizeAnchor(value = {}) {
  return {
    type: bounded(value.type || "none", 80),
    targetId: value.targetId ? bounded(value.targetId, 220) : null,
    selector: value.selector ? bounded(value.selector, 1_000) : null,
    quote: value.quote ? bounded(value.quote, 240) : null,
    offset: Number.isFinite(Number(value.offset)) ? Number(value.offset) : null,
    geometry: value.geometry ? {
      x: finite(value.geometry.x),
      y: finite(value.geometry.y),
      width: Math.max(0, finite(value.geometry.width)),
      height: Math.max(0, finite(value.geometry.height)),
      coordinateSpace: value.geometry.coordinateSpace === "viewport" ? "viewport" : "document",
    } : null,
  };
}

export function normalizeOutputDestination(value = {}) {
  const type = OUTPUT_DESTINATIONS.includes(value.type) ? value.type : "margin-pearl";
  return {
    version: OUTPUT_ROUTING_VERSION,
    type,
    surface: bounded(value.surface || (["web-scene", "output-frame"].includes(type) ? "web" : "extension"), 40),
    tabId: Number.isInteger(value.tabId) ? value.tabId : null,
    frameId: Number.isInteger(value.frameId) ? value.frameId : null,
    targetId: value.targetId ? bounded(value.targetId, 220) : null,
    anchor: normalizeAnchor(value.anchor),
    representation: bounded(value.representation || (type === "pearl-studio" ? "studio" : "text"), 80),
    formatting: clone(value.formatting || { mode: "preserve-output-spec" }),
    scroll: clone(value.scroll || { behavior: "nearest", container: type.includes("textbox") || type.includes("region") ? "auto" : "none" }),
    file: type === "download" || type === "pdf" ? {
      type: bounded(value.file?.type || (type === "pdf" ? "application/pdf" : "text/plain"), 120),
      name: bounded(value.file?.name || (type === "pdf" ? "pearl-output.pdf" : "pearl-output.txt"), 180),
    } : null,
    provenancePolicy: bounded(value.provenancePolicy || "preserve-linked", 80),
  };
}

export function normalizePlacementPlan(value = {}) {
  if (!value.resultId) throw new Error("PlacementPlan result identity is required");
  return {
    version: OUTPUT_ROUTING_VERSION,
    id: bounded(value.id || id("placement-plan"), 220),
    resultId: bounded(value.resultId, 220),
    operation: bounded(value.operation || "place", 80),
    destination: normalizeOutputDestination(value.destination),
    branchScope: {
      mode: ["all", "selected", "single"].includes(value.branchScope?.mode) ? value.branchScope.mode : "single",
      branchIds: (value.branchScope?.branchIds || []).slice(0, 24).map((entry) => bounded(entry, 220)),
    },
    targetRevision: value.targetRevision == null ? null : Math.max(0, finite(value.targetRevision)),
    approvalScope: bounded(value.approvalScope || "single-placement", 80),
    confidence: Math.max(0, Math.min(1, finite(value.confidence, 1))),
    ambiguity: (value.ambiguity || []).slice(0, 8).map((entry) => bounded(entry, 240)),
    idempotencyKey: bounded(value.idempotencyKey || id("placement"), 220),
    summary: bounded(value.summary, 500),
    consequence: value.consequence ? bounded(value.consequence, 500) : null,
    confirmed: value.confirmed === true,
    confirmedAt: value.confirmedAt || null,
    createdAt: value.createdAt || new Date().toISOString(),
  };
}

export function createOutputRoutingRequest(result, options = {}) {
  if (!result?.id) throw new Error("staged Result Pearl is required");
  const branches = options.branches || (result.branch ? [result.branch] : []);
  return {
    version: OUTPUT_ROUTING_VERSION,
    id: options.id || id("output-routing"),
    resultId: result.id,
    resultRevision: Math.max(0, finite(result.studio?.revision ?? result.revision ?? result.updatedAt)),
    stage: "choosing",
    question: branches.length > 1
      ? "Where should these outputs go—together or selected branches?"
      : "Where should this output go?",
    plan: null,
    clarification: null,
    checkpoint: clone(options.checkpoint || result.checkpoint || null),
    branches: clone(branches),
    executedKeys: [...new Set(options.executedKeys || [])],
    failure: null,
    createdAt: options.createdAt || Date.now(),
    updatedAt: options.updatedAt || Date.now(),
  };
}

function observedAnchor(observation = {}, preference = "selection") {
  const selectedRegion = observation.selectedCanvasArtifact || observation.userRegion;
  if (preference === "textbox" && selectedRegion) {
    return normalizeAnchor({
      type: "canvas-artifact",
      targetId: selectedRegion.id,
      geometry: selectedRegion.box,
      quote: selectedRegion.text || selectedRegion.label,
    });
  }
  if (observation.selection) {
    return normalizeAnchor({
      type: observation.selection.editable ? "editable-selection" : "dom-selection",
      targetId: observation.selection.targetId,
      selector: observation.selection.selector,
      quote: observation.selection.quote,
      offset: observation.selection.offset,
      geometry: observation.selection.geometry,
    });
  }
  if (observation.nearestBlock) {
    return normalizeAnchor({
      type: "dom-block",
      targetId: observation.nearestBlock.id,
      selector: observation.nearestBlock.selector,
      quote: observation.nearestBlock.quote || observation.nearestBlock.text,
      geometry: observation.nearestBlock.geometry,
    });
  }
  return normalizeAnchor();
}

function placementSummary(destination, anchor, consequence = null) {
  const quote = anchor.quote ? ` “${bounded(anchor.quote, 64)}${anchor.quote.length > 64 ? "…" : ""}”` : "";
  const summaries = {
    "margin-pearl": "Keep this in its staged margin Result Pearl?",
    "existing-textbox": `Place this in the selected text box${quote}?`,
    "new-textbox": `Place this in a new scrollable text box${quote ? ` below${quote}` : ""}?`,
    "user-region": "Place this in the region you drew?",
    "companion-region": `Create a scrollable region${quote ? ` below${quote}` : ""} and place this there?`,
    "native-insert": `Insert this at the selected caret${quote}?`,
    "native-replace": `Replace the selected page text${quote}?`,
    chat: "Present this same Result Pearl in chat?",
    "pearl-studio": "Open this same Result Pearl in an editable Pearl Studio tab?",
    "web-scene": "Place this same Result Pearl in a web Scene?",
    "output-frame": "Place this same Result Pearl in the current Output Frame?",
    clipboard: "Copy this output to the clipboard?",
    download: "Download this output as a file?",
    pdf: "Export this output as PDF?",
  };
  const summary = summaries[destination.type] || "Place this output here?";
  return consequence ? `${summary} ${consequence} Confirm?` : summary;
}

export function interpretPlacementAnswer(answer, request, observation = {}, options = {}) {
  const text = bounded(answer, 1_000).trim();
  if (!text) return { request: { ...request, stage: "clarifying", clarification: "Where should this output go?" }, plan: null };
  const lower = text.toLowerCase();
  const anchor = observedAnchor(observation, /\bbox\b/.test(lower) ? "textbox" : "selection");
  let type = null;
  let confidence = .96;
  const ambiguity = [];
  if (/\b(?:keep it here|leave it here|margin pearl|this pearl)\b/.test(lower)) type = "margin-pearl";
  else if (/\b(?:pearl studio|editable (?:new )?tab|studio tab)\b/.test(lower)) type = "pearl-studio";
  else if (/\bnew tab\b/.test(lower)) type = "pearl-studio";
  else if (/\b(?:chat|conversation)\b/.test(lower)) type = "chat";
  else if (/\b(?:pdf)\b/.test(lower)) type = "pdf";
  else if (/\b(?:download|save (?:a )?file)\b/.test(lower)) type = "download";
  else if (/\b(?:copy|clipboard)\b/.test(lower)) type = "clipboard";
  else if (/\b(?:output frame|frame)\b/.test(lower)) type = "output-frame";
  else if (/\b(?:web scene|scene)\b/.test(lower)) type = "web-scene";
  else if (/\breplace\b/.test(lower)) type = "native-replace";
  else if (/\b(?:caret|insert|type it here)\b/.test(lower)) type = "native-insert";
  else if (/\b(?:box i (?:made|drew)|existing (?:text )?box|this box)\b/.test(lower)) type = "existing-textbox";
  else if (/\b(?:drawn|drew|my region)\b/.test(lower)) type = "user-region";
  else if (/\b(?:new|make|create).*(?:text ?box|scrollable (?:box|region))\b/.test(lower)) type = "companion-region";
  else if (/\b(?:text ?box|box|under this|below this|put it here|place it here|there)\b/.test(lower)) type = "new-textbox";
  if (!type) {
    confidence = .25;
    ambiguity.push("destination");
  }
  const needsAnchor = ["existing-textbox", "new-textbox", "user-region", "companion-region", "native-insert", "native-replace"].includes(type);
  if (needsAnchor && anchor.type === "none") {
    confidence = Math.min(confidence, .45);
    ambiguity.push("target");
  }
  const multi = request.branches?.length > 1;
  let branchMode = multi ? null : "single";
  if (multi && /\b(?:all|together|every)\b/.test(lower)) branchMode = "all";
  if (multi && /\b(?:selected|only|first|second|third)\b/.test(lower)) branchMode = "selected";
  if (multi && !branchMode) {
    confidence = Math.min(confidence, .55);
    ambiguity.push("branch-scope");
  }
  if (confidence < (options.minimumConfidence || .7)) {
    const clarification = ambiguity.includes("branch-scope")
      ? "Place all branches together, or only selected branches?"
      : ambiguity.includes("target")
        ? "Which box, selection, or page area should receive it?"
        : "Choose a destination: keep it here, a text box, caret, chat, Studio, Scene, copy, download, or PDF.";
    return {
      request: { ...request, stage: "clarifying", clarification, plan: null, updatedAt: Date.now() },
      plan: null,
    };
  }
  const destination = normalizeOutputDestination({
    type,
    surface: ["web-scene", "output-frame"].includes(type) ? "web" : "extension",
    tabId: Number.isInteger(observation.tabId) ? observation.tabId : null,
    frameId: Number.isInteger(observation.frameId) ? observation.frameId : null,
    targetId: anchor.targetId,
    anchor,
    representation: type === "pearl-studio" ? "studio" : request.branches?.length > 1 ? "branch-comparison" : "text",
    file: type === "pdf" ? { type: "application/pdf", name: "pearl-output.pdf" }
      : type === "download" ? { type: "text/plain", name: "pearl-output.txt" } : null,
  });
  const consequence = type === "native-replace"
    ? "This will replace the current selection; undo remains available."
    : type === "native-insert"
      ? "This will write into the page at the current caret; undo remains available."
      : null;
  const plan = normalizePlacementPlan({
    resultId: request.resultId,
    destination,
    branchScope: { mode: branchMode, branchIds: clone(options.branchIds || []) },
    targetRevision: observation.targetRevision ?? null,
    confidence,
    ambiguity,
    consequence,
    summary: placementSummary(destination, anchor, consequence),
    idempotencyKey: options.idempotencyKey,
  });
  return {
    plan,
    request: { ...request, stage: "confirming", plan, clarification: null, updatedAt: Date.now() },
  };
}

export function revisePlacementRequest(request, answer, observation, options) {
  return interpretPlacementAnswer(answer, { ...request, stage: "choosing", plan: null }, observation, options);
}

export function confirmPlacementRequest(request, currentTargetRevision = null) {
  if (request.stage !== "confirming" || !request.plan) throw new Error("PlacementPlan is not awaiting confirmation");
  if (request.plan.targetRevision != null && currentTargetRevision != null && request.plan.targetRevision !== currentTargetRevision) {
    return {
      ...request,
      stage: "confirming",
      plan: { ...request.plan, confirmed: false },
      clarification: "The destination changed. Review and confirm the updated placement.",
      updatedAt: Date.now(),
    };
  }
  return {
    ...request,
    stage: "confirmed",
    plan: { ...request.plan, confirmed: true, confirmedAt: new Date().toISOString() },
    updatedAt: Date.now(),
  };
}

export function beginPlacementExecution(request) {
  if (request.stage !== "confirmed" || !request.plan?.confirmed) throw new Error("PlacementPlan confirmation is required");
  if (request.executedKeys?.includes(request.plan.idempotencyKey)) {
    return { request: { ...request, stage: "placed" }, duplicate: true };
  }
  return { request: { ...request, stage: "executing", updatedAt: Date.now() }, duplicate: false };
}

export function completePlacementExecution(request, effect = {}) {
  return {
    ...request,
    stage: "placed",
    executedKeys: [...new Set([...(request.executedKeys || []), request.plan.idempotencyKey])],
    effect: clone(effect),
    failure: null,
    updatedAt: Date.now(),
  };
}

export function failPlacementExecution(request, error) {
  return {
    ...request,
    stage: "failed",
    failure: { code: bounded(error?.code || "PLACEMENT_FAILED", 100), recoverable: true },
    updatedAt: Date.now(),
  };
}

export function cancelPlacementRequest(request) {
  return { ...request, stage: "cancelled", plan: null, clarification: null, updatedAt: Date.now() };
}

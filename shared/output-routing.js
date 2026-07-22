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
  "cursor-indicate",
  "chat",
  "pearl-studio",
  "new-tab",
  "web-scene",
  "output-frame",
  "clipboard",
  "download",
  "pdf",
]);

/** Formats the companion can download without a clarifying ask. */
export const DOWNLOAD_FORMATS = Object.freeze({
  txt: { mime: "text/plain", ext: "txt", label: "plain text" },
  md: { mime: "text/markdown", ext: "md", label: "Markdown" },
  markdown: { mime: "text/markdown", ext: "md", label: "Markdown" },
  html: { mime: "text/html", ext: "html", label: "HTML" },
  json: { mime: "application/json", ext: "json", label: "JSON" },
  csv: { mime: "text/csv", ext: "csv", label: "CSV" },
  pdf: { mime: "application/pdf", ext: "pdf", label: "PDF" },
});

const DESTINATION_ALIASES = Object.freeze({
  "studio-tab": "pearl-studio",
  studio: "pearl-studio",
  "editable-tab": "pearl-studio",
  "open-tab": "new-tab",
  tab: "new-tab",
  "canvas-textbox": "new-textbox",
  textbox: "new-textbox",
  "drag-box": "new-textbox",
  "cursor-place": "cursor-indicate",
  "point-here": "cursor-indicate",
  "mother-cursor": "cursor-indicate",
  caret: "native-insert",
});

export function resolveDestinationType(value) {
  const raw = String(value || "").trim();
  if (OUTPUT_DESTINATIONS.includes(raw)) return raw;
  return DESTINATION_ALIASES[raw] || null;
}

export function inferDownloadFormat(text = "", options = {}) {
  const lower = String(text || "").toLowerCase();
  const forced = options.format || options.ext;
  if (forced && DOWNLOAD_FORMATS[String(forced).toLowerCase()]) {
    const format = DOWNLOAD_FORMATS[String(forced).toLowerCase()];
    return { ...format, key: String(forced).toLowerCase() === "markdown" ? "md" : String(forced).toLowerCase() };
  }
  if (/\bpdf\b/.test(lower)) return { ...DOWNLOAD_FORMATS.pdf, key: "pdf" };
  if (/\b(?:markdown|\.md)\b/.test(lower)) return { ...DOWNLOAD_FORMATS.md, key: "md" };
  if (/\bhtml?\b/.test(lower)) return { ...DOWNLOAD_FORMATS.html, key: "html" };
  if (/\bjson\b/.test(lower)) return { ...DOWNLOAD_FORMATS.json, key: "json" };
  if (/\bcsv\b/.test(lower)) return { ...DOWNLOAD_FORMATS.csv, key: "csv" };
  if (/\b(?:docx|word|doc)\b/.test(lower)) {
    return { unsupported: true, requested: "docx", clarification: "Word (.docx) download isn’t available yet. Download as Markdown, HTML, PDF, or plain text?" };
  }
  if (/\b(?:xlsx|excel|spreadsheet)\b/.test(lower)) {
    return { unsupported: true, requested: "xlsx", clarification: "Spreadsheet download isn’t available yet. Download as CSV, JSON, or plain text?" };
  }
  return { ...DOWNLOAD_FORMATS.txt, key: "txt" };
}

export function formatOutputForDownload(text, formatKey = "txt") {
  const key = formatKey === "markdown" ? "md" : formatKey;
  const body = String(text ?? "");
  if (key === "json") {
    try {
      JSON.parse(body);
      return body;
    } catch {
      return JSON.stringify({ text: body }, null, 2);
    }
  }
  if (key === "html") {
    if (/<[a-z][\s\S]*>/i.test(body)) return body;
    const escaped = body
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return `<!doctype html><html><head><meta charset="utf-8"><title>Pearl output</title></head><body><pre style="white-space:pre-wrap;font:15px/1.55 ui-sans-serif,system-ui,sans-serif">${escaped}</pre></body></html>`;
  }
  if (key === "md" || key === "csv" || key === "txt" || key === "pdf") return body;
  return body;
}

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
  const resolved = resolveDestinationType(value.type) || (OUTPUT_DESTINATIONS.includes(value.type) ? value.type : null);
  const type = resolved || "margin-pearl";
  const downloadFormat = type === "download" || type === "pdf"
    ? inferDownloadFormat("", { format: value.file?.format || value.format || (type === "pdf" ? "pdf" : "txt") })
    : null;
  const format = downloadFormat && !downloadFormat.unsupported ? downloadFormat : null;
  return {
    version: OUTPUT_ROUTING_VERSION,
    type,
    surface: bounded(value.surface || (
      ["web-scene", "output-frame", "new-tab", "pearl-studio"].includes(type) ? "web"
        : type === "cursor-indicate" ? "either"
          : "extension"
    ), 40),
    tabId: Number.isInteger(value.tabId) ? value.tabId : null,
    frameId: Number.isInteger(value.frameId) ? value.frameId : null,
    targetId: value.targetId ? bounded(value.targetId, 220) : null,
    anchor: normalizeAnchor(value.anchor),
    representation: bounded(value.representation || (
      type === "pearl-studio" || type === "new-tab" ? "studio" : "text"
    ), 80),
    formatting: clone(value.formatting || {
      mode: "preserve-output-spec",
      pretty: value.formatting?.pretty !== false,
    }),
    scroll: clone(value.scroll || { behavior: "nearest", container: type.includes("textbox") || type.includes("region") ? "auto" : "none" }),
    file: type === "download" || type === "pdf" ? {
      type: bounded(value.file?.type || format?.mime || (type === "pdf" ? "application/pdf" : "text/plain"), 120),
      name: bounded(value.file?.name || `pearl-output.${format?.ext || (type === "pdf" ? "pdf" : "txt")}`, 180),
      format: bounded(value.file?.format || format?.key || (type === "pdf" ? "pdf" : "txt"), 40),
    } : null,
    cursorMode: type === "cursor-indicate" ? true : value.cursorMode === true,
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
    "cursor-indicate": "Use the mother pearl as the cursor and place the output where you point?",
    chat: "Present this same Result Pearl in chat?",
    "pearl-studio": "Open this same Result Pearl in an editable Pearl Studio tab?",
    "new-tab": "Open this output in a new tab?",
    "web-scene": "Place this same Result Pearl in a web Scene?",
    "output-frame": "Place this same Result Pearl in the current Output Frame?",
    clipboard: "Copy this output to the clipboard?",
    download: destination.file?.format
      ? `Download this output as ${destination.file.format.toUpperCase()} (${destination.file.name})?`
      : "Download this output as a file?",
    pdf: "Export this output as PDF?",
  };
  const summary = summaries[destination.type] || "Place this output here?";
  return consequence ? `${summary} ${consequence} Confirm?` : summary;
}

export function interpretPlacementAnswer(answer, request, observation = {}, options = {}) {
  const text = bounded(answer, 1_000).trim();
  if (!text) return { request: { ...request, stage: "clarifying", clarification: "Where should this output go?" }, plan: null };
  const lower = text.toLowerCase();
  const wantsBox = /\b(?:text\s?box|drag(?:\s+a)?\s+box|draw(?:\s+a)?\s+box|box)\b/.test(lower);
  const anchor = observedAnchor(
    observation,
    wantsBox ? "textbox" : /\bcursor|point|here\b/.test(lower) ? "selection" : "selection",
  );
  let type = null;
  let confidence = .96;
  const ambiguity = [];
  const downloadFormat = inferDownloadFormat(lower, { format: options.format });
  if (downloadFormat.unsupported) {
    return {
      request: {
        ...request,
        stage: "clarifying",
        clarification: downloadFormat.clarification,
        plan: null,
        updatedAt: Date.now(),
      },
      plan: null,
    };
  }
  if (/\b(?:keep it here|leave it here|margin pearl|this pearl)\b/.test(lower)) type = "margin-pearl";
  else if (/\b(?:pearl studio|editable (?:new )?tab|studio tab)\b/.test(lower)) type = "pearl-studio";
  else if (/\b(?:new tab|open (?:it )?in (?:a )?tab|open (?:as|in) (?:a )?new (?:browser )?tab)\b/.test(lower)) type = "new-tab";
  else if (/\b(?:chat|conversation)\b/.test(lower)) type = "chat";
  else if (/\bpdf\b/.test(lower) && !/\bdownload\b/.test(lower)) type = "pdf";
  else if (/\b(?:download|save (?:as|a )?file|export (?:as|to))\b/.test(lower) || downloadFormat.key !== "txt" && /\b(?:markdown|html|json|csv|\.md)\b/.test(lower) && /\b(?:save|export|file|download)\b/.test(lower)) {
    type = downloadFormat.key === "pdf" ? "pdf" : "download";
  } else if (/\b(?:copy|clipboard)\b/.test(lower)) type = "clipboard";
  else if (/\b(?:output frame|frame)\b/.test(lower)) type = "output-frame";
  else if (/\b(?:web scene|scene)\b/.test(lower)) type = "web-scene";
  else if (/\b(?:cursor|point(?:\s+with)?(?:\s+the)?(?:\s+pearl)?|mother pearl|indicate(?:\s+with)?(?:\s+(?:my|the))? cursor|where i point)\b/.test(lower)) {
    type = "cursor-indicate";
  } else if (/\breplace\b/.test(lower)) type = "native-replace";
  else if (/\b(?:caret|insert(?:\s+at)?(?:\s+the)?(?:\s+caret)?|type it here)\b/.test(lower)) type = "native-insert";
  else if (/\b(?:box i (?:made|drew)|existing (?:text )?box|this box)\b/.test(lower)) type = "existing-textbox";
  else if (/\b(?:drawn|drew|my region)\b/.test(lower)) type = "user-region";
  else if (/\b(?:drag|draw).*(?:text ?box|box)\b/.test(lower) || /\b(?:new|make|create).*(?:text ?box|scrollable (?:box|region))\b/.test(lower)) {
    type = "companion-region";
  }   else if (/\b(?:text ?box|under this|below this|put it here|place it here)\b/.test(lower)) type = "new-textbox";
  else if (/\b(?:put it there|place it there)\b/.test(lower)) {
    type = null;
    confidence = .25;
    ambiguity.push("destination");
    ambiguity.push("target");
  }
  if (!type) {
    confidence = .25;
    ambiguity.push("destination");
  }
  const needsAnchor = ["existing-textbox", "new-textbox", "user-region", "companion-region", "native-insert", "native-replace", "cursor-indicate"].includes(type);
  if (needsAnchor && type !== "cursor-indicate" && type !== "companion-region" && type !== "new-textbox" && anchor.type === "none") {
    confidence = Math.min(confidence, .45);
    ambiguity.push("target");
  }
  if (type === "cursor-indicate" && !observation.cursorPoint && !observation.selection && anchor.type === "none") {
    confidence = Math.min(confidence, .55);
    ambiguity.push("cursor-point");
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
      : ambiguity.includes("cursor-point")
        ? "Turn on the pearl cursor and point where the output should go, or drag a text box."
        : ambiguity.includes("target")
          ? "Which box, selection, or page area should receive it?"
          : "Choose a destination: new tab, download (txt/md/html/json/csv/pdf), text box, point with the pearl cursor, caret, chat, Studio, Scene, copy, or keep it here.";
    return {
      request: { ...request, stage: "clarifying", clarification, plan: null, updatedAt: Date.now() },
      plan: null,
    };
  }
  const cursorPoint = observation.cursorPoint || observation.pointer || null;
  const destination = normalizeOutputDestination({
    type,
    surface: ["web-scene", "output-frame", "new-tab", "pearl-studio"].includes(type) ? "web" : "extension",
    tabId: Number.isInteger(observation.tabId) ? observation.tabId : null,
    frameId: Number.isInteger(observation.frameId) ? observation.frameId : null,
    targetId: anchor.targetId,
    anchor: cursorPoint && type === "cursor-indicate"
      ? normalizeAnchor({
        type: "cursor-point",
        geometry: { x: cursorPoint.x, y: cursorPoint.y, width: 0, height: 0, coordinateSpace: "viewport" },
      })
      : anchor,
    representation: type === "pearl-studio" || type === "new-tab" ? "studio" : request.branches?.length > 1 ? "branch-comparison" : "text",
    format: type === "download" || type === "pdf" ? downloadFormat.key : undefined,
    file: type === "pdf" || (type === "download" && downloadFormat.key === "pdf")
      ? { type: "application/pdf", name: "pearl-output.pdf", format: "pdf" }
      : type === "download"
        ? { type: downloadFormat.mime, name: `pearl-output.${downloadFormat.ext}`, format: downloadFormat.key }
        : null,
    cursorMode: type === "cursor-indicate",
  });
  const consequence = type === "native-replace"
    ? "This will replace the current selection; undo remains available."
    : type === "native-insert"
      ? "This will write into the page at the current caret; undo remains available."
      : type === "cursor-indicate"
        ? "The mother pearl becomes the cursor; click or confirm the point to place a formatted text box."
        : type === "companion-region" || type === "new-textbox"
          ? "A scrollable text box will be created and the output formatted into it."
          : null;
  const plan = normalizePlacementPlan({
    resultId: request.resultId,
    destination,
    branchScope: { mode: branchMode, branchIds: clone(options.branchIds || []) },
    targetRevision: observation.targetRevision ?? null,
    confidence,
    ambiguity,
    consequence,
    summary: placementSummary(destination, destination.anchor, consequence),
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

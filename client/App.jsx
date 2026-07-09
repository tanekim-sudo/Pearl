import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { jsonrepair } from "jsonrepair";
import {
  TRANSFORM_PRIMITIVES,
  migrateOperatorStore,
  isTransformPrimitive,
  estimatePrimitiveMs,
} from "../shared/transform-primitives.js";
import {
  isCompressionOperator,
  isExpansionOperator,
} from "../shared/operator-direction.js";
import {
  viaFromOp,
  abstractStepFromVia,
  buildCaptureMetadata,
  hydrateOperatorMap,
  opToAbstractTree,
} from "../shared/operator-capture.js";
import {
  abstractOperatorToTransfer,
  abstractSymbolToTransfer,
  abstractJourneyToTransfer,
  portableExportTree,
  extractCognitiveMeta,
  buildFidelityPipelineFallback,
  inferDomainFromMaterial,
  needsCognitiveInstantiation,
  resolveTransferContext,
} from "../shared/cognitive-transfer.js";
import { enrichTransferWithLLM, instantiateTransfer } from "./lib/cognitive-transfer-runtime.js";
import {
  isPortableOperator,
  matchingOperatorsForMaterial,
  recognitionHint,
} from "../shared/cognitive-recognition.js";
import {
  ACTIVE_TRANSFORMATION_KEY,
  loadActiveTransformationId,
  loadPatternLenses,
  loadTransformationRepos,
  PATTERN_LENSES_KEY,
  RAIL_LENSES,
  RAIL_TRANSFORMATIONS,
  TRANSFORMATION_REPOS_KEY,
} from "../shared/object-types.js";
import { interpretSymbolWithLLM } from "./lib/symbol-runtime.js";
import { normalizeSymbolRecord, stampSymbolStruct, viewingLensTreeFromSymbol } from "../shared/symbol-lens.js";
import { scaleEta, ETA } from "../shared/eta.js";
import { pipelineClientAbortMs, CLIENT_ABORT_MS, PHASE_TIMEOUT } from "../shared/phase-timeouts.js";
import { compileExecutionPlan } from "../server/plan.js";
import { matchRoleTemplate, isResolveOnlyFunction } from "../shared/role-templates.js";
import {
  isInternalMetadataOutput,
  deliverableRewritePrompt,
} from "../shared/deliverable-quality.js";
import { sanitizePrimitiveOutput, isPrimitiveMetaOutput } from "../shared/primitive-output.js";
import {
  DEEP_FUNCTION_ARCHITECT_STANDARDS,
  DECOMPOSE_PROMPT_HEADER,
  CREATE_FROM_PROSE_HEADER,
  EDIT_FROM_PROSE_HEADER,
  GENERATE_LIST_HEADER,
} from "../shared/function-standards.js";
import {
  createOperatorBundle,
  createLensShareBundle,
  createSymbolBundle,
  createJourneyBundle,
  createPathBundle,
  buildShareUrl,
  decodeShareToken,
  parseShareFromLocation,
  clearShareFromLocation,
  shareDestinationLabel,
} from "../shared/share-bundle.js";
import ShareWelcomeOverlay from "./ShareWelcomeOverlay.jsx";
import InteractiveTour from "./components/InteractiveTour.jsx";
import TopToolbar from "./components/TopToolbar.jsx";
import AuthOverlay from "./components/AuthOverlay.jsx";
import PlansOverlay from "./components/PlansOverlay.jsx";
import { useSupabaseSession } from "./lib/auth-session.js";
import { isSupabaseConfigured, getSupabase } from "./lib/supabase.js";
import { planBadgeLabel } from "./lib/plans.js";
import { useUserPlan } from "./lib/use-user-plan.js";
import { useBoardCloudSync } from "./lib/board-sync.js";
import { setApiAccessTokenGetter, apiAuthHeaders } from "./lib/api-auth.js";
import CanvasColumn from "./components/CanvasColumn.jsx";
import AiColumn, { THOUGHT_MIME, AI_OUTPUT_MIME } from "./components/AiColumn.jsx";
import LensTreeEditor from "./components/LensTreeEditor.jsx";
import CognitionGitHeader from "./components/CognitionGitHeader.jsx";
import LensHistoryPanel from "./components/LensHistoryPanel.jsx";
import ItemStagesPanel from "./components/ItemStagesPanel.jsx";
import TransferExplorePanel from "./components/TransferExplorePanel.jsx";
import LensCommitDialog from "./components/LensCommitDialog.jsx";
import {
  appendCommit,
  collectPipelineStepNames,
  diffStepSequences,
  formatGitTime,
  gitRefLabel,
  groupLensesByRepo,
  lineageBreadcrumb,
  makeCommit,
  commitCount,
} from "./lib/cognition-git.js";
import FunctionsColumn from "./components/FunctionsColumn.jsx";
import {
  makeAiNode,
  nextAiNodePosition,
  childNodePosition,
  nodePositionAt,
  truncateLabel,
  layoutAfterAppend,
  collectStrandChoices,
  AI_SPAWN_MIN_DIST,
} from "./lib/ai-nodes.js";
import {
  CONSTELLATION_ZOOM_THRESHOLD,
  DEFAULT_CONSTELLATION_SCALE,
  EXPLORE_ZOOM_SCALE,
  centerAiCamera,
  findNearestSourceNode,
  fitAiConstellation,
  focusAiNodeRead,
  focusAiNode,
  computeNodesBBox,
  nodeTextLayout,
  screenToWorld,
  viewportCenterWorld as aiViewportCenterWorld,
  worldToScreen,
} from "./lib/ai-space.js";
import InterpretBoundary, { PAPER_SESSION_MIME } from "./components/InterpretBoundary.jsx";
import GhostCursor from "./components/GhostCursor.jsx";
import CompanionChat from "./components/CompanionChat.jsx";
import HighlightToolbar from "./components/HighlightToolbar.jsx";
import LensSettingsDialog from "./components/LensSettingsDialog.jsx";
import { registerDirectorVerbs, runDirectorScript } from "./lib/director.js";
import { buildCompanionSystemPrompt, parseCompanionReply, matchDemoLocally } from "./lib/companion-intent.js";
import { COMPANION_DEMOS, findDemo } from "./lib/companion-demos.js";
import {
  SKETCH_BUNDLE_MIME,
  recordingItemTags,
  registerRecordingItem,
  buildItemSessionPatch,
  gatherSketchBundle,
  bundleAsSession,
  bundleLabel,
  buildSketchBundlePrompt,
} from "../shared/sketch-bundle.js";
import BoardBlockItem from "./components/BoardBlockItem.jsx";
import { DEFAULT_PAGE_ID } from "./lib/worlds.js";
import {
  blockWidth,
  blockHeight,
  blockOriginAtPointer,
  blockOriginAtViewportCenter,
  defaultBlockContent,
  defaultBlockMeta,
  isTransformableBlock,
  TEXT_BOX_MIN_W,
  TEXT_BOX_MAX_W,
  fitTextBoxWidth,
  fitTextItemWidth,
} from "./lib/board-item-utils.js";
import { focusEditableAtPoint } from "./lib/place-caret.js";
import {
  PAPER_WIDTH,
  PAPER_HEIGHT,
  PAPER_MARGIN,
  PAPER_INK,
  MIN_SCALE,
  ZOOM_STEP,
  clampScale,
  zoomAtPoint,
  centerPaperCamera,
  clampToPaper,
  clampItemToPaper,
  clampTextWidth,
  bboxClampOffset,
  fitPaperInView,
  clampPaperCamera,
  maxTextWidth,
} from "./lib/paper.js";
import { attachCanvasWheel } from "./lib/canvas-navigation.js";
import {
  animateCameraState,
  compensateCameraForViewportResize,
  easeInOutCubic,
} from "./lib/camera-motion.js";
import {
  loadColumnLayout,
  saveColumnLayout,
  clampColumnLayout,
  layoutAfterResizeDrag,
  DEFAULT_COLUMN_LAYOUT,
} from "./lib/column-layout.js";
import { createTourContext, tourEvent, TOUR_STORAGE_KEY } from "./lib/onboarding-steps.js";
import { cyclePrimaryUtensil, UTENSIL_LABELS } from "./lib/primary-utensils.js";
import {
  HIGHLIGHT_INK,
  HIGHLIGHT_W,
  highlightWorldWidth,
  highlightBrushHits as inkHighlightBrushHits,
  itemsFromHighlightGesture,
} from "./lib/highlight-ink.js";
import {
  appendItemHistory,
  buildOperatorStages,
  buildPerceptualCaptureFromItem,
  createHistoryEvent,
  isReplayableItem,
  itemSnapshot,
  loadItemHistoryLog,
  saveItemHistoryLog,
  shouldRecordHistory,
  snapshotWorldBBox,
  truncatePreview,
} from "./lib/item-history.js";
import SymbolDrawOverlay, { SymbolGlyph } from "./components/SymbolDrawOverlay.jsx";
import { PaperRecordSession, buildPaperInterpretPrompt } from "./paper-session.js";

function uid() {
  return "s-" + Math.random().toString(36).slice(2, 9);
}

const ITEMS_KEY = "lens.board.items.v1";
const PAGES_KEY = "lens.board.pages.v1";
const DOC_TITLE_KEY = "lens.doc.title.v1";
const DOC_STAR_KEY = "lens.doc.star.v1";
const THEME_KEY = "lens.theme.v1";
const CAMERA_KEY = "lens.board.camera.v1";
const OPERATORS_KEY = "lens.board.operators.v2";
const LEGACY_OPERATORS_KEY = "lens.board.operators.v1";
const STRUCTSEQ_KEY = "lens.structseq.v1";
const OLD_NODES_KEY = "lens.savednodes.v1";
const ARTIFACT_KEY = "lens.artifact.v1";
const OLD_SEEDS_KEY = "lens.seeds.v2";
const OP_MIME = "application/lens-op";
const STRUCT_MIME = "application/lens-structure";
const SEL_MIME = "application/lens-selection";
const LENS_MIME = "application/lens-lens";
const COMBINE_THRESHOLD = 14; // px moved before drop-on-item triggers combine
const DROP_TARGET_PAD = 96; // px — generous snap when dragging functions onto ideas
const BOUNDARY_MAGNET_PX = 48; // px — magnetic snap when dragging toward AI or toolbox columns
const MOVE_DRAG_THRESHOLD = 8; // px before pointer-down becomes a move / transfer
const TRANSFER_DRAG_THRESHOLD = 4; // px before boundary transfer activates
const TOOLBOX_DRAG_THRESHOLD = 3; // px before rail-to-canvas apply counts as a drop

const INK = PAPER_INK;
const PEN_W = 2.4; // world units
const MARKER_W = 16;
const HIGHLIGHT_OPACITY = 0.88;
const MARKER_OPACITY = 0.72;

/** Branch / link directions — include east for clean left→right transform arrows. */
const EXPAND_DIRS = [
  { id: "e", label: "→", angle: 0 },
  { id: "w", label: "←", angle: Math.PI },
  { id: "n", label: "↑", angle: -Math.PI / 2 },
  { id: "ne", label: "↗", angle: -Math.PI / 6 },
  { id: "se", label: "↘", angle: Math.PI / 6 },
  { id: "s", label: "↓", angle: Math.PI / 2 },
  { id: "sw", label: "↙", angle: 5 * Math.PI / 6 },
  { id: "nw", label: "↖", angle: -5 * Math.PI / 6 },
];

/**
 * Every node carries its path implicitly: bornFrom lineage plus drawn
 * connections. Nothing is recorded — the journey is reconstructed from
 * history whenever someone walks or sends a node.
 */

function isNoteItem(it) {
  return it && isTransformableBlock(it);
}

function migratePageName(name, index) {
  if (!name) return `World ${index + 1}`;
  const m = name.match(/^Page (\d+)$/);
  if (m) return `World ${m[1]}`;
  return name;
}

function isPaperSideItem(it) {
  return it && it.side !== "ai";
}

function itemVisibleOnPage(it, pageId, worldFilter) {
  if (!it || it.type === "link") return false;
  if (!isPaperSideItem(it)) return false;
  if ((it.pageId || DEFAULT_PAGE_ID) !== pageId) return false;
  if (worldFilter && it.world && it.world !== worldFilter) return false;
  return true;
}

function noteCenter(it) {
  if (!isNoteItem(it)) return null;
  const bb = itemWorldBBox(it);
  if (!bb) return { x: it.x || 0, y: it.y || 0 };
  return { x: (bb.minx + bb.maxx) / 2, y: (bb.miny + bb.maxy) / 2 };
}

function branchAnchor(it, dirId) {
  const c = noteCenter(it);
  if (!c) return { x: 0, y: 0 };
  const bb = itemWorldBBox(it);
  const dir = EXPAND_DIRS.find((d) => d.id === dirId) || EXPAND_DIRS[0];
  const hw = bb ? (bb.maxx - bb.minx) / 2 : 40;
  const hh = bb ? (bb.maxy - bb.miny) / 2 : 24;
  const pad = 8;
  return {
    x: c.x + Math.cos(dir.angle) * (hw + pad),
    y: c.y + Math.sin(dir.angle) * (hh + pad),
  };
}

function linkEndpoint(it, toward) {
  const c = noteCenter(it);
  if (!c || !toward) return c || { x: 0, y: 0 };
  const bb = itemWorldBBox(it);
  if (!bb) return c;
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  if (!dx && !dy) return c;
  const angle = Math.atan2(dy, dx);
  const hw = Math.max(20, (bb.maxx - bb.minx) / 2);
  const hh = Math.max(16, (bb.maxy - bb.miny) / 2);
  const denom = Math.sqrt((Math.cos(angle) / hw) ** 2 + (Math.sin(angle) / hh) ** 2) || 1;
  const dist = 1 / denom + 2;
  return { x: c.x + Math.cos(angle) * dist, y: c.y + Math.sin(angle) * dist };
}

function inferLinkDir(from, to) {
  const a = noteCenter(from);
  const b = noteCenter(to);
  if (!a || !b) return EXPAND_DIRS[1].id;
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  let best = EXPAND_DIRS[0];
  let bestDiff = Infinity;
  for (const d of EXPAND_DIRS) {
    const diff = Math.abs(Math.atan2(Math.sin(angle - d.angle), Math.cos(angle - d.angle)));
    if (diff < bestDiff) {
      bestDiff = diff;
      best = d;
    }
  }
  return best.id;
}

function linkCurvePath(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy) || 1;
  if (Math.abs(dx) > Math.abs(dy) * 1.2) {
    const mx = (from.x + to.x) / 2;
    return `M ${from.x} ${from.y} C ${mx} ${from.y}, ${mx} ${to.y}, ${to.x} ${to.y}`;
  }
  const bend = Math.min(28, dist * 0.15);
  const cx = (from.x + to.x) / 2 + (-dy / dist) * bend;
  const cy = (from.y + to.y) / 2 + (dx / dist) * bend;
  return `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;
}

const TOOL_GROUPS = [
  { id: "think", label: "think" },
  { id: "canvas", label: "canvas" },
  { id: "input", label: "input" },
  { id: "draw", label: "draw" },
  { id: "edit", label: "edit" },
];

const CANVAS_TOOLS = {
  highlight: {
    id: "highlight",
    group: "think",
    label: "Highlighter",
    icon: "▬",
    swatch: HIGHLIGHT_INK,
  },
  select: {
    id: "select",
    group: "canvas",
    label: "Select",
    icon: "↖",
  },
  image: {
    id: "image",
    group: "input",
    label: "Image",
    icon: "▢",
  },
  pen: {
    id: "pen",
    group: "draw",
    label: "Pen",
    icon: "✎",
    swatch: INK,
  },
  marker: {
    id: "marker",
    group: "draw",
    label: "Marker",
    icon: "▔",
    swatch: INK,
    swatchOpacity: 0.35,
  },
  eraser: {
    id: "eraser",
    group: "edit",
    label: "Eraser",
    icon: "⌫",
  },
};

const RESEARCH_STEP_PROMPT =
  "Quick web search: find the entity name, product, funding, and team. Use 1–2 searches max. Then continue to analyze and draft the final deliverable in the same response.";

function migrateOperators(ops) {
  if (!Array.isArray(ops)) return ops;
  const map = Object.fromEntries(ops.map((o) => [o.id, o]));
  const mapped = ops.map((o) => {
    if (o.name === "research" && (o.kind === "prompt" || !o.kind || o.kind === "pipeline")) {
      const prompt = o.prompt?.toLowerCase().includes("web_search") || o.prompt?.toLowerCase().includes("web search")
        ? o.prompt
        : RESEARCH_STEP_PROMPT;
      return { ...o, research: true, prompt };
    }
    return o;
  });
  return mapped.filter((o) => !isResolveOnlyFunction(o, Object.fromEntries(mapped.map((x) => [x.id, x]))));
}

const ONBOARDED_KEY = "lens.onboarded.v1";
const COMPANION_SEEN_KEY = "lens.companion.seen.v1";

/** @type {{ current: ((name: string) => void) | null }} */
const tourEmitRef = { current: null };

/** @type {{ current: ((e: PointerEvent, payload: object) => void) | null }} */
const toolboxApplyDragRef = { current: null };

/** @type {{ current: boolean }} */
const toolboxDidDragRef = { current: false };

const LENS_STORAGE_KEYS = [
  ITEMS_KEY,
  CAMERA_KEY,
  OPERATORS_KEY,
  LEGACY_OPERATORS_KEY,
  PATTERN_LENSES_KEY,
  STRUCTSEQ_KEY,
  OLD_NODES_KEY,
  ARTIFACT_KEY,
  OLD_SEEDS_KEY,
  TRANSFORMATION_REPOS_KEY,
  ACTIVE_TRANSFORMATION_KEY,
  ONBOARDED_KEY,
  TOUR_STORAGE_KEY,
];

function freshOperators() {
  return migrateOperators(migrateOperatorStore(null));
}

const ROLES = [
  "investor",
  "founder",
  "tutor",
  "artist",
  "researcher",
  "writer",
  "designer",
  "therapist",
  "student",
  "strategist",
];

function isEmptyDraftBlock(it) {
  if (!it) return false;
  if (it.type !== "text" && it.type !== "sticky") return false;
  return !(it.text || "").replace(/\u00a0/g, " ").trim();
}

function purgeEmptyDraftBlocks(arr, keepId = null) {
  return arr.filter((it) => !isEmptyDraftBlock(it) || it.id === keepId);
}

function lensRootOpId(lens) {
  if (!lens) return null;
  return lens.opId || lens.moveIds?.[0] || null;
}

function lensStepNames(lens, opMap) {
  const rootId = lensRootOpId(lens);
  const root = rootId ? opMap[rootId] : null;
  if (!root) return (lens.moveIds || []).map((id) => opMap[id]?.name).filter(Boolean);
  if (root.kind === "pipeline" && root.steps?.length) {
    return root.steps.map((id) => opMap[id]?.name).filter(Boolean);
  }
  return [root.name];
}

/** Normalize persisted lenses toward git-for-perception metadata. */
function normalizeLens(l) {
  if (!l || typeof l !== "object" || !l.id) return null;
  const createdAt = l.createdAt || l.evolvedAt || Date.now();
  return {
    ...l,
    version: l.commits?.length || l.version || (l.evolvedAt ? 2 : 1),
    commits: Array.isArray(l.commits) ? l.commits : [],
    createdAt,
    updatedAt: l.updatedAt || l.evolvedAt || createdAt,
    uploaded: !!(l.uploaded || l.inherited),
  };
}

function lensMetaLines(lens, lenses) {
  const nameOf = (id) => transformationRepos.find((x) => x.id === id)?.name || lens.parentName || lens.forkedFromName || "unknown";
  const lines = [];
  if ((lens.version || 1) > 1) lines.push(`v${lens.version}`);
  if (lens.parentId) {
    const p = transformationRepos.find((x) => x.id === lens.parentId);
    lines.push(`branched from “${p?.name || lens.parentName || "unknown"}”`);
  } else if (lens.parentName) {
    lines.push(`branched from “${lens.parentName}”`);
  }
  if (lens.forkedFrom) {
    const f = transformationRepos.find((x) => x.id === lens.forkedFrom);
    lines.push(`forked from “${f?.name || lens.forkedFromName || "unknown"}”`);
  } else if (lens.forkedFromName) {
    lines.push(`forked from “${lens.forkedFromName}”`);
  }
  if (lens.mergedFrom?.length === 2) {
    lines.push(`⚭ merged “${nameOf(lens.mergedFrom[0])}” + “${nameOf(lens.mergedFrom[1])}”`);
  } else if (lens.mergedFromNames?.length === 2) {
    lines.push(`⚭ merged “${lens.mergedFromNames[0]}” + “${lens.mergedFromNames[1]}”`);
  }
  if (lens.uploaded) lines.push("uploaded");
  return lines;
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function extractBalancedJSON(s, open, close) {
  const start = s.indexOf(open);
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (inStr) {
      if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

function normalizeJSONText(s) {
  return s
    .replace(/^\uFEFF/, "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/,\s*([}\]])/g, "$1");
}

function tryParseJSONCandidate(candidate) {
  const c = normalizeJSONText(candidate.trim());
  if (!c) return null;
  try {
    return JSON.parse(c);
  } catch {
    try {
      return JSON.parse(jsonrepair(c));
    } catch {
      return null;
    }
  }
}

function parseJSON(raw) {
  const text = (raw || "").trim();
  if (!text) throw new Error("Empty AI response. Try again.");

  const candidates = [];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) candidates.push(fenced[1].trim());
  const obj = extractBalancedJSON(text, "{", "}");
  if (obj) candidates.push(obj);
  const arr = extractBalancedJSON(text, "[", "]");
  if (arr) candidates.push(arr);
  candidates.push(text);

  const seen = new Set();
  for (const candidate of candidates) {
    const key = candidate.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const parsed = tryParseJSONCandidate(key);
    if (parsed != null) return parsed;
  }

  throw new Error("AI returned invalid JSON. Tap ↻ to rebuild, or try again.");
}

// Teaches Claude how to architect deep function trees for the thinking canvas.
const LENS_SYSTEM = `You architect functions for Lens — a thinking canvas where users drag symbolic transformation pipelines onto sparse notes.

RUNTIME: plans compile to phases — resolve (internal, sparse input only) → research (one leaf max with research:true) → synthesize (all perceptual moves merged). Resolve/research are NEVER user-facing deliverables.

Design deep trees of perceptual moves — each composite names a real thinking phase; each leaf is one precise cognitive transformation producing one clear output shape.

${DEEP_FUNCTION_ARCHITECT_STANDARDS}

Return ONLY valid JSON.`;

// summarize the user's personal library so Claude can tailor every prompt
function summarizeLibrary(operators, opMap, { compact = false } = {}) {
  if (!operators?.length) return "";
  const tops = operators.filter((o) => o.top);
  const lines = [];

  if (tops.length) {
    lines.push(compact ? "Functions:" : "Top-level functions:");
    for (const t of tops.slice(0, compact ? 10 : 20)) {
      let line = `• ${t.name}${t.description ? ` — ${t.description}` : ""}`;
      if (!compact && t.kind === "pipeline" && t.steps?.length) {
        const subs = t.steps.map((id) => opMap[id]?.name).filter(Boolean);
        if (subs.length) line += `\n  steps: ${subs.join(" → ")}`;
      }
      lines.push(line);
    }
  }

  const leaves = operators.filter((o) => (o.kind === "prompt" || !o.kind) && o.prompt);
  if (leaves.length && !compact) {
    lines.push("\nPrimitive transformation patterns:");
    for (const p of leaves.slice(0, 30)) {
      const snippet = p.prompt.slice(0, 110);
      lines.push(`• "${p.name}": ${snippet}${p.prompt.length > 110 ? "…" : ""}`);
    }
  } else if (leaves.length && compact) {
    lines.push(`Primitives: ${leaves.map((p) => p.name).slice(0, 24).join(", ")}`);
  }

  return lines.join("\n");
}

function librarySystem(operators, opMap) {
  const summary = summarizeLibrary(operators, opMap);
  if (!summary) return LENS_SYSTEM;
  return `${LENS_SYSTEM}

---
THE USER'S PERSONAL LIBRARY — tailor every function, decomposition, and leaf prompt to this library.
• Reuse its vocabulary, tone, and level of specificity.
• Complement what already exists — do not duplicate names or purposes.
• New primitives should feel like they belong alongside the patterns below.
• When editing, preserve consistency with the rest of the library.

${summary}`;
}

function executionSystem(operators, opMap, activeOp, originalMaterial = "", researching = false) {
  const compact = summarizeLibrary(operators, opMap, { compact: true });
  let sys = `You execute a professional workflow on the user's thinking whiteboard. Return ONLY the deliverable — no preamble or meta-commentary.

CRITICAL RULES:
1. ORIGINAL SUBJECT — the user dragged this function onto specific board material. Stay locked to that subject in every sentence.
2. NEVER write about insufficient documentation, information gaps, evaluation process, or meta-risks in deal assessment. Always produce substantive content ABOUT the subject.
3. If input is a company name or short phrase (e.g. "efference ai startup"), treat it as the entity to analyze — use web search to research it and deliver a complete professional output.
4. Follow the OUTPUT FORMAT in the workflow exactly — include every required section with specific, evidence-backed content.
5. Match the function description's deliverable shape precisely — this is the quality bar.`;

  if (researching) {
    sys += `\n\nWEB SEARCH ENABLED: Research the subject thoroughly using current web sources before writing your deliverable. Cite key facts you find.`;
  }
  if (activeOp?.name) {
    sys += `\n\nActive function: "${activeOp.name}"`;
    if (activeOp.description) sys += `\nDeliverable contract: ${activeOp.description}`;
  }
  if (originalMaterial?.trim()) {
    sys += `\n\nORIGINAL BOARD MATERIAL (this is the subject — transform THIS):\n"""${originalMaterial.slice(0, 1500)}${originalMaterial.length > 1500 ? "…" : ""}"""`;
  }
  if (compact) {
    sys += `\n\nUser's function library:\n${compact}`;
  }
  return sys;
}

function boardSystem(operators, opMap) {
  const compact = summarizeLibrary(operators, opMap, { compact: true });
  let sys =
    "You operate on selected material from the user's thinking whiteboard. Return ONLY the requested result. Work with whatever is given — fragments, keywords, rough notes. NEVER refuse, NEVER say insufficient data, NEVER ask for more information.";
  if (compact) {
    sys += `\n\nThis user's personal library of functions and transformations — align your output with their established patterns:\n${compact}`;
  }
  return sys;
}

async function polishDeliverable(out, op, material) {
  const text = (out || "").trim();
  if (!text || !isInternalMetadataOutput(text)) return text;
  const prompt = deliverableRewritePrompt(op?.name || "function", op?.description || "");
  const fixed = await runClaude(prompt, `Subject:\n${(material || "").trim()}\n\nDraft:\n${text}`, {
    maxTokens: 4096,
    timeoutMs: PHASE_TIMEOUT.synthesizeComposite,
  });
  const cleaned = (fixed || "").trim();
  return cleaned && !isInternalMetadataOutput(cleaned) ? cleaned : text;
}

// role/profession -> the most valuable cognitive functions to automate
async function generateFunctionList(role, operators, opMap) {
  const hasLib = operators?.length > 0;
  const prompt = `The user is a: ${role}.

${GENERATE_LIST_HEADER}

Each function is dragged onto a sparse whiteboard note (a word, company name, fragment) and produces a FULL professional deliverable. Functions are visible transformation pipelines — not hidden prompts.

NEVER suggest: "identify subject", "extract entity", or metadata-only steps as standalone functions.

${hasLib ? "Complement the user's existing library — no duplicate names or purposes.\n" : ""}
Think from THIS person's daily work: what deliverables do they repeatedly need? What thinking moves would they perform mentally — now made visible as draggable functions?

For each function:
- "name": 3–7 words — names a real workflow (e.g. "Build Investment Thesis", "Refine Product Vision", "Synthesize Literature Review")
- "description": one sentence — sparse canvas input → exact deliverable shape (sections, format, decision output)

Return ONLY JSON: {"functions":[{"name":"...","description":"..."}]} — exactly 8, ordered by daily frequency. No markdown, no commentary.`;
  const out = await runClaude(prompt, "", { system: librarySystem(operators, opMap), maxTokens: 4096 });
  const j = parseJSON(out);
  if (Array.isArray(j.functions) && j.functions.length) return j.functions.slice(0, 8);
  if (Array.isArray(j) && j.length) return j.slice(0, 8);
  return [];
}

// decompose one function into a deep tree of sub-functions ending in primitives
async function decomposeFunction(role, fn, operators, opMap) {
  const prompt = `Role: ${role}.

${DECOMPOSE_PROMPT_HEADER}

NEVER create "identify subject", "extract entity", or SEARCH_TERMS-only steps — runtime handles sparse input internally.

FUNCTION: ${fn.name}
${fn.description ? `Description: ${fn.description}` : ""}

Requirements:
- Complex deliverables: ≥3 tree levels with named thinking phases (Frame → Research → Analyze → Synthesize)
- No depth cap — nest composites as deep as complexity warrants
- Exactly ONE leaf with "research":true when facts ground the deliverable
- Final deliverable leaf outputs polished markdown sections, never ENTITY/SEARCH metadata
- Each composite groups real cognitive phases; each leaf is one precise perceptual move

JSON only — complete nested tree:
{"name":"...","description":"...","steps":[{"name":"...","description":"...","steps":[...]},{"name":"...","research":true,"prompt":"..."},{"name":"...","prompt":"..."}]}`;
  const out = await runClaude(prompt, "", { system: librarySystem(operators, opMap), maxTokens: 8192 });
  try {
    return parseJSON(out);
  } catch {
    const retry = await runClaude(
      `${prompt}\n\nInvalid JSON. Return ONLY one minified JSON object with the full nested tree.`,
      "",
      { system: librarySystem(operators, opMap), maxTokens: 8192 }
    );
    return parseJSON(retry);
  }
}

function buildDefaultLeafPrompt(name, description) {
  const desc = (description || "").trim() || name;
  return `${desc}. Return ONLY the step output.`;
}

// flatten a decomposition tree into flat operators; returns the root id
function materializeTree(node, role, top, out, opts = {}) {
  const { captured = false, captureMeta = null } = opts;
  const id = uid();
  const name = (node.name || "function").trim();
  const description = (node.description || "").trim();
  if (Array.isArray(node.steps) && node.steps.length) {
    const steps = node.steps.map((s) => materializeTree(s, role, false, out, opts));
    const pipeline = { id, name, description, kind: "pipeline", steps, role, top };
    if (captured) pipeline.captured = true;
    if (captureMeta && top) pipeline.captureMeta = captureMeta;
    out.push(pipeline);
  } else if (node.moveRef && !(node.prompt || "").trim()) {
    out.push({
      id,
      name,
      description,
      kind: "prompt",
      moveRef: node.moveRef,
      role,
      top,
      captured,
      research: !!node.research,
    });
  } else {
    const prompt = (node.prompt || "").trim() || buildDefaultLeafPrompt(name, description);
    const research = !!node.research;
    const leaf = { id, name, description, kind: "prompt", prompt, role, top, research };
    if (node.moveRef) leaf.moveRef = node.moveRef;
    if (captured) leaf.captured = true;
    out.push(leaf);
  }
  return id;
}

function opTreeNeedsResearch(op, opMap) {
  if (!op) return false;
  if (op.research) return true;
  if (op.kind === "pipeline" && op.steps?.length) {
    return op.steps.some((sid) => opTreeNeedsResearch(opMap[sid], opMap));
  }
  return false;
}

function shouldEnableResearch(op, opMap, originalMaterial) {
  if (isTransformPrimitive(op)) return false; // plan compiler handles primitive research
  if (opTreeNeedsResearch(op, opMap)) return true;
  const sparse = (originalMaterial || "").trim().length < 500;
  const named = /\b(startup|ai|inc|corp|llc|labs|tech|company|platform|app)\b/i.test(originalMaterial || "");
  if (sparse && (op?.role || named)) return true;
  return false;
}

function formatPipelineInput(originalMaterial, currentMaterial) {
  const orig = (originalMaterial || "").trim();
  const cur = (currentMaterial || "").trim();
  if (!orig || orig === cur) return cur;
  return `ORIGINAL SUBJECT (never lose track of this — all work is about THIS):\n"""\n${orig}\n"""\n\nPRIOR STEP OUTPUT:\n"""\n${cur}\n"""`;
}

// human-readable tree for Claude context when editing in prose
function serializeTree(node, opMap, depth = 0) {
  if (!node) return "";
  const pad = "  ".repeat(depth);
  let line = `${pad}• ${node.name}`;
  if (node.description) line += ` — ${node.description}`;
  if (node.kind === "prompt" && node.prompt) {
    line += `\n${pad}  prompt: ${node.prompt.slice(0, 220)}${node.prompt.length > 220 ? "…" : ""}`;
  }
  const lines = [line];
  if (node.kind === "pipeline" && node.steps?.length) {
    for (const sid of node.steps) lines.push(serializeTree(opMap[sid], opMap, depth + 1));
  }
  return lines.filter(Boolean).join("\n");
}

function opToJsonTree(op, opMap) {
  if (!op) return null;
  const base = { name: op.name || "function", description: op.description || "" };
  if (op.kind === "pipeline" && op.steps?.length) {
    return {
      ...base,
      steps: op.steps.map((id) => opToJsonTree(opMap[id], opMap)).filter(Boolean),
    };
  }
  return { ...base, prompt: op.prompt || "" };
}

function collectDraftOps(rootOp, opMap) {
  if (!rootOp) return [];
  const ids = collectSubtreeIds(rootOp.id, opMap);
  return [...ids].map((id) => ({ ...opMap[id] }));
}

function collectSubtreeIds(rootId, opMap) {
  const ids = new Set();
  function walk(id) {
    if (!id || ids.has(id)) return;
    ids.add(id);
    const op = opMap[id];
    if (op?.kind === "pipeline" && op.steps) op.steps.forEach(walk);
  }
  walk(rootId);
  return ids;
}

/** Flat pipeline of perceptual moves — run one LLM step per move, not one bundled synth. */
function isFlatMoveSequence(op, opMap) {
  if (!op || op.kind !== "pipeline" || !op.steps?.length) return false;
  for (const sid of op.steps) {
    const s = opMap[sid];
    if (!s || s.kind === "pipeline" || s.research) return false;
  }
  return op.captured || op.steps.every((sid) => {
    const s = opMap[sid];
    return s.moveRef || s.primitive || s.move;
  });
}

async function runMoveSequenceStep(stepOp, map, material, image, onProgress, operators) {
  const plan = compileExecutionPlan(stepOp, map, material);
  if (plan.phases.length === 1 && plan.phases[0].id === "synthesize") {
    const phase = plan.phases[0];
    onProgress?.(phase.label);
    return runClaude(phase.prompt, material.trim(), {
      system: phase.system,
      maxTokens: phase.maxTokens,
      timeoutMs: phase.timeoutMs,
      image,
      compact: plan.fastPath,
    });
  }
  return runExecutionOnServer({
    op: stepOp,
    opMap: map,
    operators,
    material,
    image,
    onProgress,
    plan,
  });
}

async function runMoveSequence(op, map, material, image, onProgress, operators, onStepOutput) {
  let current = material;
  for (let i = 0; i < op.steps.length; i++) {
    const sid = op.steps[i];
    const stepOp = map[sid];
    if (!stepOp) continue;
    onProgress?.(`${stepOp.name} (${i + 1}/${op.steps.length})`);
    const out = await runMoveSequenceStep(stepOp, map, current, i === 0 ? image : null, onProgress, operators);
    if (!out?.trim()) throw new Error(`empty output at ${stepOp.name}`);
    current = out.trim();
    if (onStepOutput) {
      await onStepOutput({ out: current, stepOp, stepIndex: i, totalSteps: op.steps.length });
    }
  }
  return current;
}

// create a full function from the user's plain-English description
async function createFunctionFromProse(description, operators, opMap) {
  const prompt = `${CREATE_FROM_PROSE_HEADER}

User description:
"""
${description}
"""

Build a deep tree: named thinking phases as composites, precise leaves as perceptual moves. Complex tasks need ≥3 levels. ONE research leaf max. Final leaf outputs polished markdown sections.

Match the user's library style and vocabulary.

JSON only — complete nested tree:
{"name":"...","description":"...","steps":[{"name":"...","description":"...","steps":[...]},{"name":"...","research":true,"prompt":"..."},{"name":"...","prompt":"..."}]}`;
  const out = await runClaude(prompt, "", { system: librarySystem(operators, opMap), maxTokens: 8192 });
  try {
    return parseJSON(out);
  } catch {
    const retry = await runClaude(
      `${prompt}\n\nInvalid JSON before. Return ONLY one minified JSON object with the full nested tree.`,
      "",
      { system: librarySystem(operators, opMap), maxTokens: 8192 }
    );
    return parseJSON(retry);
  }
}

// edit an existing function tree from the user's prose instruction
async function editFunctionWithProse(op, opMap, instruction, operators) {
  const current = serializeTree(op, opMap);
  const prompt = `${EDIT_FROM_PROSE_HEADER}

CURRENT:
${current}

CHANGES:
"""
${instruction}
"""

When adding steps, decompose into meaningful nested phases — not flat lazy lists. ONE research leaf max. Final deliverable leaf outputs polished markdown.

JSON only — complete updated nested tree:
{"name":"...","description":"...","steps":[{"name":"...","description":"...","steps":[...]},{"name":"...","prompt":"..."}]}`;
  const out = await runClaude(prompt, "", { system: librarySystem(operators, opMap), maxTokens: 8192 });
  try {
    return parseJSON(out);
  } catch {
    const retry = await runClaude(
      `${prompt}\n\nInvalid JSON. Return ONLY one minified JSON object with the full nested tree.`,
      "",
      { system: librarySystem(operators, opMap), maxTokens: 8192 }
    );
    return parseJSON(retry);
  }
}

// turn a Claude JSON node into flat operators; returns root id
function treeToOperators(node, opts = {}) {
  const { role = null, top = false, captured = false, captureMeta = null } = opts;
  const out = [];
  const rootId = materializeTree(node, role, top, out, { captured, captureMeta });
  return { rootId, ops: out };
}

function loadArray(key, fallback = []) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : fallback;
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function spawnPositionForBox(x, y, boxW, boxH) {
  const anchorX = x - boxW / 2;
  const anchorY = y - Math.min(boxH * 0.2, 28);
  const { dx, dy } = bboxClampOffset({
    minx: anchorX,
    miny: anchorY,
    maxx: anchorX + boxW,
    maxy: anchorY + boxH,
  });
  return { x: anchorX + dx, y: anchorY + dy };
}

function stripMd(s) {
  return (s || "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/[*_`>]/g, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .trim();
}

function normalizeItem(it) {
  if (!it) return it;
  if (it.type === "link") {
    return { id: it.id, type: "link", fromId: it.fromId, toId: it.toId, fromDir: it.fromDir || null };
  }
  // Ephemeral highlight scribbles should never persist — drop orphans from saved boards.
  if (it.type === "stroke" && it.highlight) return null;
  const base = { rotation: 0, scale: 1, pageId: DEFAULT_PAGE_ID, side: "paper", ...it };
  if (!base.bornAt) base.bornAt = Date.now();
  if (base.type === "text") {
    base.w = base.text?.trim()
      ? fitTextBoxWidth(base.text, { maxW: maxTextWidth() })
      : clampTextWidth(base.w || TEXT_BOX_MIN_W);
  }
  if (base.type === "sticky" || base.type === "callout" || base.type === "code" || base.type === "math") {
    if (base.text?.trim()) base.w = fitTextItemWidth(base);
  }
  if (base.type === "image" && !base.h && base.w) base.h = Math.round(base.w * 0.75);
  if (base.type === "sticky" && !base.color) base.color = "yellow";
  if (base.type === "callout" && !base.variant) base.variant = "observation";
  if (base.type === "diagram" && !base.nodes) {
    base.nodes = defaultBlockMeta("diagram").nodes;
    base.title = base.title || "Ideas";
  }
  if (base.type === "table" && !base.rows) base.rows = defaultBlockMeta("table").rows;
  if (base.type === "voice" && !base.waveform) base.waveform = defaultBlockMeta("voice").waveform;
  if (base.type === "stroke" && !base.highlight) base.color = PAPER_INK;
  return clampItemToPaper(base, itemWorldBBox);
}

function migrateFromArtifact() {
  const art = load(ARTIFACT_KEY, null);
  if (!art) return [];
  const items = [];
  let y = 0;
  if (art.text?.trim()) {
    items.push({ id: uid(), type: "text", x: 0, y, text: art.text.trim(), w: 420, rotation: 0, scale: 1 });
    y += 120;
  }
  for (const obj of art.objects || []) {
    if (obj.kind === "text" && obj.content?.trim()) {
      items.push({ id: uid(), type: "text", x: 0, y, text: obj.content.trim(), w: 360, rotation: 0, scale: 1 });
      y += 80;
    } else if (obj.kind === "image" && obj.src) {
      items.push({ id: uid(), type: "image", x: 0, y, w: obj.w || 220, h: Math.round((obj.w || 220) * 0.75), src: obj.src, rotation: 0, scale: 1 });
      y += (obj.w || 220) + 40;
    }
  }
  return items;
}

function itemWorldBBox(it) {
  if (it.type === "stroke") {
    if (!it.points?.length) return null;
    const xs = it.points.map((p) => p.x);
    const ys = it.points.map((p) => p.y);
    return { minx: Math.min(...xs), miny: Math.min(...ys), maxx: Math.max(...xs), maxy: Math.max(...ys) };
  }
  if (it.type === "image") {
    const w = it.w || 200;
    const h = it.h || Math.round(w * 0.75);
    return { minx: it.x, miny: it.y, maxx: it.x + w, maxy: it.y + h };
  }
  if (it.type === "text" || it.type === "sticky" || it.type === "callout" || it.type === "code" || it.type === "math") {
    const w = blockWidth(it) || it.w || 360;
    const h = itemHeight(it);
    return { minx: it.x, miny: it.y, maxx: it.x + w, maxy: it.y + h };
  }
  if (it.type === "voice") {
    const w = it.w || 260;
    return { minx: it.x, miny: it.y, maxx: it.x + w, maxy: it.y + 56 };
  }
  if (it.type === "diagram") {
    const w = it.w || 320;
    const h = it.h || 160;
    return { minx: it.x, miny: it.y, maxx: it.x + w, maxy: it.y + h };
  }
  if (it.type === "table") {
    const w = it.w || 320;
    const h = itemHeight(it);
    return { minx: it.x, miny: it.y, maxx: it.x + w, maxy: it.y + h };
  }
  if (it.type === "video") {
    const w = it.w || 280;
    const h = it.h || 158;
    return { minx: it.x, miny: it.y, maxx: it.x + w, maxy: it.y + h };
  }
  return null;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// rasterize strokes + images in a selection for Claude vision
async function compositeItemsToImage(items) {
  const visuals = items.filter((it) => it.type === "stroke" || it.type === "image");
  if (!visuals.length) return null;

  const boxes = visuals.map(itemWorldBBox).filter(Boolean);
  if (!boxes.length) return null;

  const pad = 24;
  const minx = Math.min(...boxes.map((b) => b.minx)) - pad;
  const miny = Math.min(...boxes.map((b) => b.miny)) - pad;
  const maxx = Math.max(...boxes.map((b) => b.maxx)) + pad;
  const maxy = Math.max(...boxes.map((b) => b.maxy)) + pad;
  const w = Math.max(64, Math.ceil(maxx - minx));
  const h = Math.max(64, Math.ceil(maxy - miny));

  const canvas = document.createElement("canvas");
  canvas.width = Math.min(w * 2, 2048);
  canvas.height = Math.min(h * 2, 2048);
  const scale = canvas.width / w;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#111111";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);
  ctx.translate(-minx, -miny);

  for (const it of visuals) {
    if (it.type === "stroke" && it.points?.length > 1) {
      ctx.beginPath();
      ctx.moveTo(it.points[0].x, it.points[0].y);
      for (let i = 1; i < it.points.length; i++) ctx.lineTo(it.points[i].x, it.points[i].y);
      ctx.strokeStyle = it.highlight ? HIGHLIGHT_INK : it.color || INK;
      ctx.lineWidth = it.width || PEN_W;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalAlpha = it.highlight ? 0.72 : it.marker ? 0.35 : 0.95;
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (it.type === "image" && it.src) {
      try {
        const img = await loadImage(it.src);
        ctx.drawImage(img, it.x, it.y, it.w || img.width, it.h || img.height);
      } catch {
        /* skip broken image */
      }
    }
  }

  return canvas.toDataURL("image/jpeg", 0.88);
}

// gather all material from board items (text + vision for images/drawings)
async function gatherMaterialFromItems(itemList) {
  const texts = itemList
    .filter((it) => it.type === "text" && it.text?.trim())
    .map((it) => it.text.trim());
  const text = texts.length > 1 ? texts.map((t, i) => `[part ${i + 1}]\n${t}`).join("\n\n———\n\n") : texts.join("\n\n———\n\n");

  const images = itemList.filter((it) => it.type === "image" && it.src);
  const strokes = itemList.filter((it) => it.type === "stroke");
  let image = null;

  if (images.length === 1 && !strokes.length) {
    image = images[0].src;
  } else if (images.length || strokes.length) {
    image = await compositeItemsToImage(itemList);
  }

  if (!text && image && strokes.length && !images.length) {
    return { text: "[hand-drawn sketch on the whiteboard — interpret the attached image]", image, preview: "sketch" };
  }
  if (!text && image) {
    return { text: "[image on the whiteboard — interpret the attached image]", image, preview: "image" };
  }

  const preview = text.slice(0, 1200) || (image ? "visual material" : "");
  const voiceInstructions = itemList
    .filter((it) => it.instructionText)
    .map((it) => it.instructionText)
    .join(" · ");
  const mergedText = voiceInstructions
    ? [text, `Voice instructions for drawings: ${voiceInstructions}`].filter(Boolean).join("\n\n")
    : text;
  return {
    text: mergedText,
    image,
    preview: preview || voiceInstructions?.slice(0, 120) || "",
  };
}

function itemWidth(it) {
  const w = blockWidth(it);
  if (w) return w;
  return 0;
}

const TEXT_PAD_X = 30;
const TEXT_PAD_Y = 18;
const TEXT_LINE_HEIGHT = 24;
const SPAWN_GAP = 40;
const SPAWN_PAD = 12;

/** Estimate rendered height for wrapped board text (matches .board-text CSS). */
function measureTextHeight(w, text) {
  const boxW = w || 360;
  const contentW = Math.max(64, boxW - TEXT_PAD_X);
  const charW = 8.6;
  const lines = (text || "").split("\n");
  let rowCount = 0;
  for (const line of lines) {
    if (!line.length) rowCount += 1;
    else rowCount += Math.max(1, Math.ceil((line.length * charW) / contentW));
  }
  return Math.max(28, rowCount * TEXT_LINE_HEIGHT + TEXT_PAD_Y);
}

function itemHeight(it) {
  const h = blockHeight(it, measureTextHeight);
  if (h) return h;
  return 0;
}

function itemStyle(it) {
  const style = {
    left: it.x,
    top: it.y,
  };
  if (it.type === "text" || it.type === "sticky" || it.type === "callout" || it.type === "code" || it.type === "math" || it.type === "table" || it.type === "diagram" || it.type === "voice" || it.type === "video") {
    const w = blockWidth(it) || it.w;
    style.width = w;
  }
  const rot = it.rotation || 0;
  const sc = it.scale ?? 1;
  if (rot || sc !== 1) {
    const w = itemWidth(it);
    const h = itemHeight(it);
    style.transform = `rotate(${rot}deg) scale(${sc})`;
    style.transformOrigin = `${w / 2}px ${h / 2}px`;
  }
  return style;
}

function cornerWorld(it, corner) {
  const w = itemWidth(it) * (it.scale ?? 1);
  const h = itemHeight(it) * (it.scale ?? 1);
  const cx = it.x + w / 2;
  const cy = it.y + h / 2;
  const rad = ((it.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const lx = corner.includes("w") ? -w / 2 : w / 2;
  const ly = corner.includes("n") ? -h / 2 : h / 2;
  return { x: cx + lx * cos - ly * sin, y: cy + lx * sin + ly * cos };
}

// one-time migration: bring ideas from the old node canvas onto the new board
function migrateOldSeeds() {
  const seeds = load(OLD_SEEDS_KEY, null);
  if (!Array.isArray(seeds) || !seeds.length) return [];
  return seeds
    .map((s) => {
      if (s.type === "image" && s.image) {
        return { id: uid(), type: "image", x: s.x || 0, y: s.y || 0, w: 220, src: s.image };
      }
      const text = stripMd(s.title || s.text || "");
      if (!text) return null;
      return { id: uid(), type: "text", x: (s.x || 0) - 90, y: (s.y || 0) - 14, text };
    })
    .filter(Boolean);
}

function migrateOldSavedNodes() {
  const old = load(OLD_NODES_KEY, null);
  if (!Array.isArray(old) || !old.length) return [];
  return old
    .map((n) => {
      const items = [];
      if (n.type === "image" && n.image) {
        items.push(normalizeItem({ type: "image", x: 0, y: 0, w: 220, h: 165, src: n.image }));
      } else if (n.text?.trim()) {
        items.push(normalizeItem({ type: "text", x: 0, y: 0, text: n.text.trim(), w: 360 }));
      }
      for (const s of n.strokes || []) {
        if (s.points?.length) items.push(normalizeItem({ type: "stroke", ...s }));
      }
      if (!items.length) return null;
      return {
        id: n.id || uid(),
        title: n.title || n.text?.trim().split("\n")[0].slice(0, 48) || "untitled",
        kind: n.kind || "idea",
        structNum: n.struct || null,
        items,
        savedAt: n.savedAt || Date.now(),
      };
    })
    .filter(Boolean);
}

function nextStructNumber() {
  const cur = parseInt(localStorage.getItem(STRUCTSEQ_KEY) || "283", 10) || 283;
  const n = cur + 1;
  localStorage.setItem(STRUCTSEQ_KEY, String(n));
  return n;
}

function samenessPrompt(labels) {
  const body = labels.map((t, i) => `(${i + 1}) ${t}`).join("\n");
  return `Find the HIDDEN SAMENESS — the deep structural isomorphism shared by these ${labels.length} things. Ignore surface similarity.

${body}

Return EXACTLY:
NAME: <2-4 word name for the structure>
STRUCTURE: <1-2 sentences stating the shared deep pattern>
WHY: <one sentence on what this unlocks>`;
}

function parseSameness(out) {
  const name = (out.match(/NAME:\s*(.+)/i) || [])[1]?.trim() || "pattern";
  const structure = (out.match(/STRUCTURE:\s*([\s\S]+?)(?:\nWHY:|$)/i) || [])[1]?.trim() || out.trim();
  return { name, body: structure };
}

function lensPreview(struct) {
  if (struct.kind === "document" && struct.content?.trim()) {
    return struct.content.trim().split("\n")[0].slice(0, 60);
  }
  const texts = (struct.items || []).filter((it) => it.type === "text" && it.text?.trim()).map((it) => it.text.trim());
  if (texts.length) return texts[0].split("\n")[0].slice(0, 60);
  const imgs = (struct.items || []).filter((it) => it.type === "image").length;
  const strokes = (struct.items || []).filter((it) => it.type === "stroke").length;
  const parts = [];
  if (texts.length) parts.push(`${texts.length} text`);
  if (imgs) parts.push(`${imgs} image`);
  if (strokes) parts.push(`${strokes} stroke`);
  return parts.join(" · ") || struct.title || "empty";
}

function parseApiResponse(res, raw) {
  if (res.status === 504 || /FUNCTION_INVOCATION_TIMEOUT|timed out/i.test(raw)) {
    throw new Error("Phase timed out on the server — continuing if possible.");
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    const snippet = raw.trim().slice(0, 80);
    if (snippet.startsWith("<!") || snippet.toLowerCase().startsWith("<html")) {
      throw new Error("Could not reach the API server. Refresh and try again.");
    }
    try {
      data = JSON.parse(jsonrepair(raw));
    } catch {
      throw new Error("Server returned invalid JSON. The request may have timed out — try again.");
    }
  }
  if (!res.ok) throw new Error(data.error || "Request failed.");
  return data;
}

function estimatePlanMs(plan) {
  if (!plan?.phases?.length) return ETA.default;
  const phaseMs = { resolve: 8000, research: 28000, synthesize: 14000 };
  const raw = plan.phases.reduce((sum, p) => sum + (phaseMs[p.id] || 14000), 3000);
  return scaleEta(raw);
}

function parseHighlightPortals(out) {
  const blocks = out
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter((b) => b.length > 8);
  const portals = blocks.map((block) => {
    const tagged = block.match(/^\[([^\]]+)\]\s*\n([\s\S]+)$/);
    if (tagged) return { domain: tagged[1].trim(), body: tagged[2].trim() };
    const inline = block.match(/^\[([^\]]+)\]\s*(.+)$/s);
    if (inline) return { domain: inline[1].trim(), body: inline[2].trim() };
    return {
      domain: null,
      body: block.replace(/^\s*(?:\[[^\]]+\]|[-*•]|\d+[.)])\s*/m, "").trim(),
    };
  });
  return portals.filter((p) => p.body.length > 8);
}

function portalDisplayText(portal) {
  if (portal.domain) return `[${portal.domain}]\n${portal.body}`;
  return portal.body;
}

function pointNearRect(px, py, rect, pad = 6) {
  return (
    px >= rect.left - pad &&
    px <= rect.right + pad &&
    py >= rect.top - pad &&
    py <= rect.bottom + pad
  );
}

function strokeWorldBBox(points, pad = 0) {
  if (!points?.length) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return {
    minx: Math.min(...xs) - pad,
    miny: Math.min(...ys) - pad,
    maxx: Math.max(...xs) + pad,
    maxy: Math.max(...ys) + pad,
  };
}

function bboxesOverlap(a, b) {
  if (!a || !b) return false;
  return a.minx <= b.maxx && a.maxx >= b.minx && a.miny <= b.maxy && a.maxy >= b.miny;
}

function unionBBoxes(boxes) {
  if (!boxes?.length) return null;
  return {
    minx: Math.min(...boxes.map((b) => b.minx)),
    miny: Math.min(...boxes.map((b) => b.miny)),
    maxx: Math.max(...boxes.map((b) => b.maxx)),
    maxy: Math.max(...boxes.map((b) => b.maxy)),
  };
}

function textSpawnBBox(x, y, w, text) {
  const boxW = w || 360;
  const h = measureTextHeight(boxW, text);
  return {
    minx: x - SPAWN_PAD,
    miny: y - SPAWN_PAD,
    maxx: x + boxW + SPAWN_PAD,
    maxy: y + h + SPAWN_PAD,
  };
}

function bboxOverlapsItems(bb, items) {
  for (const it of items) {
    if (it.type === "link") continue;
    const ob = itemWorldBBox(it);
    if (!ob) continue;
    const padded = {
      minx: ob.minx - SPAWN_PAD,
      miny: ob.miny - SPAWN_PAD,
      maxx: ob.maxx + SPAWN_PAD,
      maxy: ob.maxy + SPAWN_PAD,
    };
    if (bboxesOverlap(bb, padded)) return true;
  }
  return false;
}

function fallbackSpawnBox(fallbackWorld, viewportCenter) {
  if (fallbackWorld) {
    return {
      minx: fallbackWorld.x,
      miny: fallbackWorld.y,
      maxx: fallbackWorld.x + 280,
      maxy: fallbackWorld.y + 80,
    };
  }
  const c = viewportCenter();
  return { minx: c.x - 140, miny: c.y - 40, maxx: c.x + 140, maxy: c.y + 40 };
}

/** Union of parent nodes plus any existing outputs born from them. */
function spawnAnchorBox(parentIds, items, fallbackWorld, viewportCenter) {
  const idSet = new Set(parentIds || []);
  const boxes = [];
  for (const it of items) {
    if (it.type === "link") continue;
    if (idSet.has(it.id)) {
      const bb = itemWorldBBox(it);
      if (bb) boxes.push(bb);
    } else if (it.type === "text" && (it.bornFrom || []).some((pid) => idSet.has(pid))) {
      const bb = itemWorldBBox(it);
      if (bb) boxes.push(bb);
    }
  }
  if (boxes.length) return unionBBoxes(boxes);
  return fallbackSpawnBox(fallbackWorld, viewportCenter);
}

function estimateSpawnWidth(text) {
  return fitTextBoxWidth(text, { maxW: 560 });
}

/** Preferred right, then below; row-scan outward until bbox is clear. */
function findClearSpawnPosition(anchorBox, w, text, items, placedSoFar = []) {
  const occupancy = [...items, ...placedSoFar];
  const h = measureTextHeight(w, text);
  const seeds = [
    { x: anchorBox.maxx + SPAWN_GAP, y: anchorBox.miny + (anchorBox.maxy - anchorBox.miny) / 2 - h / 2, fromDir: "e" },
    { x: anchorBox.maxx + SPAWN_GAP, y: anchorBox.miny, fromDir: "e" },
    { x: anchorBox.minx, y: anchorBox.maxy + SPAWN_GAP, fromDir: "s" },
    { x: anchorBox.maxx + SPAWN_GAP, y: anchorBox.maxy + SPAWN_GAP, fromDir: "se" },
    { x: anchorBox.minx - w - SPAWN_GAP, y: anchorBox.miny, fromDir: "w" },
    { x: anchorBox.minx, y: anchorBox.miny - h - SPAWN_GAP, fromDir: "n" },
  ];
  for (let ring = 0; ring < 32; ring++) {
    for (const seed of seeds) {
      const x = seed.x + (ring % 6) * SPAWN_GAP;
      const y = seed.y + Math.floor(ring / 6) * SPAWN_GAP;
      const bb = textSpawnBBox(x, y, w, text);
      if (!bboxOverlapsItems(bb, occupancy)) {
        return { x, y, fromDir: seed.fromDir };
      }
    }
  }
  return {
    x: anchorBox.maxx + SPAWN_GAP * 4,
    y: anchorBox.miny + SPAWN_GAP * 4,
    fromDir: "se",
  };
}

function sampleStrokePoints(points) {
  const samples = [];
  for (let i = 0; i < points.length; i++) {
    samples.push(points[i]);
    if (i + 1 < points.length) {
      const a = points[i];
      const b = points[i + 1];
      const steps = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 6));
      for (let s = 1; s < steps; s++) {
        samples.push({
          x: a.x + ((b.x - a.x) * s) / steps,
          y: a.y + ((b.y - a.y) * s) / steps,
        });
      }
    }
  }
  return samples;
}

function strokePathLength(points) {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return len;
}

function isClosedHighlightLoop(points, scale = 1) {
  if (points.length < 10) return false;
  const first = points[0];
  const last = points[points.length - 1];
  const closeDist = Math.hypot(last.x - first.x, last.y - first.y);
  const pathLen = strokePathLength(points);
  if (closeDist > Math.max(36, pathLen * 0.2)) return false;
  const bb = strokeWorldBBox(points, highlightWorldWidth(scale) * 0.5);
  if (!bb) return false;
  return bb.maxx - bb.minx > 48 && bb.maxy - bb.miny > 48;
}

function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const denom = yj - yi || 1e-9;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / denom + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function clientBoundsForItem(it, worldToClient) {
  if (it.type === "stroke") {
    if (!it.points?.length) return null;
    const xs = it.points.map((p) => worldToClient(p.x, p.y).x);
    const ys = it.points.map((p) => worldToClient(p.x, p.y).y);
    return {
      left: Math.min(...xs),
      top: Math.min(...ys),
      right: Math.max(...xs),
      bottom: Math.max(...ys),
    };
  }
  const scale = it.scale ?? 1;
  const tl = worldToClient(it.x, it.y);
  if (it.type === "image") {
    const w = (it.w || 200) * scale;
    const h = (it.h || Math.round((it.w || 200) * 0.75)) * scale;
    return { left: tl.x, top: tl.y, right: tl.x + w, bottom: tl.y + h };
  }
  if (it.type === "text" || it.type === "sticky" || it.type === "callout" || it.type === "code" || it.type === "math" || it.type === "table" || it.type === "diagram" || it.type === "voice" || it.type === "video") {
    const w = (blockWidth(it) || it.w || 360) * scale;
    const h = itemHeight(it) * scale;
    return { left: tl.x, top: tl.y, right: tl.x + w, bottom: tl.y + h };
  }
  return null;
}

function brushHitsItem(it, cx, cy, lastCx, lastCy, brush, worldToClient) {
  if (it.type === "text") return false;
  if (it.type === "stroke") {
    for (let k = 1; k < it.points.length; k++) {
      const a = worldToClient(it.points[k - 1].x, it.points[k - 1].y);
      const b = worldToClient(it.points[k].x, it.points[k].y);
      if (Math.hypot(cx - a.x, cy - a.y) <= brush || Math.hypot(cx - b.x, cy - b.y) <= brush) return true;
      if (distToSeg(cx, cy, a.x, a.y, b.x, b.y) <= brush) return true;
      if (lastCx != null && distToSeg(lastCx, lastCy, a.x, a.y, b.x, b.y) <= brush) return true;
    }
    return false;
  }
  const bb = clientBoundsForItem(it, worldToClient);
  if (!bb) return false;
  const pad = brush;
  const inRect = (x, y) =>
    x >= bb.left - pad && x <= bb.right + pad && y >= bb.top - pad && y <= bb.bottom + pad;
  if (inRect(cx, cy)) return true;
  if (lastCx != null) {
    for (let t = 0; t <= 1; t += 0.25) {
      const x = lastCx + (cx - lastCx) * t;
      const y = lastCy + (cy - lastCy) * t;
      if (inRect(x, y)) return true;
    }
  }
  return false;
}

function highlightErasureHits(items, cx, cy, lastCx, lastCy, scale, worldToClient, skipIds) {
  return inkHighlightBrushHits(
    items,
    cx,
    cy,
    lastCx,
    lastCy,
    scale,
    worldToClient,
    skipIds,
    blockWidth,
    itemHeight
  );
}

function highlightBrushHits(items, cx, cy, lastCx, lastCy, scale, worldToClient, skipIds) {
  return highlightErasureHits(items, cx, cy, lastCx, lastCy, scale, worldToClient, skipIds);
}

function ideasFromHighlightGesture(points, scale, itemList, worldToClient, tapItemId = null) {
  return itemsFromHighlightGesture(points, scale, itemList, worldToClient, blockWidth, itemHeight, {
    isTransformableBlock,
    tapItemId,
  });
}

function itemsInsideHighlightLoop(points, itemList) {
  if (points.length < 3) return [];
  const ids = [];
  for (const it of itemList) {
    const bb = itemWorldBBox(it);
    if (!bb) continue;
    const cx = (bb.minx + bb.maxx) / 2;
    const cy = (bb.miny + bb.maxy) / 2;
    const corners = [
      { x: bb.minx, y: bb.miny },
      { x: bb.maxx, y: bb.miny },
      { x: bb.maxx, y: bb.maxy },
      { x: bb.minx, y: bb.maxy },
    ];
    if (pointInPolygon(cx, cy, points) || corners.some((c) => pointInPolygon(c.x, c.y, points))) {
      ids.push(it.id);
    }
  }
  return [...new Set(ids)];
}


function extractTextFromLoopSelection(itemIds, itemList) {
  const texts = itemList.filter((it) => itemIds.includes(it.id) && it.type === "text" && it.text?.trim());
  if (!texts.length) return null;
  const item = texts[0];
  const el = document.querySelector(`[data-item="${item.id}"].board-text`);
  const quote = (texts.length === 1 ? item.text : texts.map((t) => t.text.trim()).join("\n\n")).trim();
  const short = quote.length > 400 ? `${quote.slice(0, 400)}…` : quote;
  let rect = { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
  if (el) {
    const r = el.getBoundingClientRect();
    rect = { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
  }
  return { itemId: item.id, quote: short, context: quote, rect };
}

function extractTextFromHighlightStroke(points, strokeWidth, itemList, worldToClient) {
  const bb = strokeWorldBBox(points, strokeWidth * 0.65);
  const textItems = itemList.filter(
    (it) => it.type === "text" && it.text?.trim() && bboxesOverlap(itemWorldBBox(it), bb)
  );
  if (!textItems.length) return null;

  const samples = sampleStrokePoints(points).map((p) => worldToClient(p.x, p.y));
  const pad = Math.max(10, strokeWidth * 0.55);

  for (const item of textItems) {
    const el = document.querySelector(`[data-item="${item.id}"].board-text`);
    if (!el) continue;
    const full = el.innerText || item.text;
    const textNode = el.firstChild;
    const charHits = new Set();

    if (textNode?.nodeType === Node.TEXT_NODE) {
      for (let i = 0; i < full.length; i++) {
        try {
          const range = document.createRange();
          range.setStart(textNode, i);
          range.setEnd(textNode, Math.min(i + 1, textNode.length));
          const cr = range.getBoundingClientRect();
          if (!cr.width && !cr.height) continue;
          if (samples.some((s) => pointNearRect(s.x, s.y, cr, pad))) charHits.add(i);
        } catch {
          /* skip bad range */
        }
      }
    }

    if (!charHits.size) {
      const er = el.getBoundingClientRect();
      if (samples.some((s) => pointNearRect(s.x, s.y, er, pad))) {
        for (let i = 0; i < full.length; i++) charHits.add(i);
      } else {
        continue;
      }
    }

    const hitOffsets = [...charHits].sort((a, b) => a - b);
    let start = hitOffsets[0];
    let end = hitOffsets[hitOffsets.length - 1] + 1;
    while (start > 0 && /\S/.test(full[start - 1])) start--;
    while (end < full.length && /\S/.test(full[end])) end++;
    const quote = full.slice(start, end).trim();
    if (quote.length < 2) continue;

    let rect;
    try {
      const textNode = el.firstChild;
      if (textNode?.nodeType === Node.TEXT_NODE) {
        const tr = document.createRange();
        tr.setStart(textNode, Math.min(start, textNode.length));
        tr.setEnd(textNode, Math.min(end, textNode.length));
        const r = tr.getBoundingClientRect();
        if (r.width || r.height) {
          rect = {
            left: r.left,
            top: r.top,
            bottom: r.bottom,
            right: r.right,
            width: r.width,
            height: r.height,
          };
        }
      }
    } catch {
      /* fall through */
    }
    if (!rect) {
      const r = el.getBoundingClientRect();
      rect = { left: r.left, top: r.top, bottom: r.bottom, right: r.right, width: r.width, height: r.height };
    }

    return { itemId: item.id, quote, context: item.text, rect };
  }

  return null;
}

function formatJobEta(ms) {
  if (ms <= 0) return "finishing…";
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `~${s}s remaining`;
  return `~${Math.ceil(s / 60)}m remaining`;
}

async function runExecutionOnServer({ op, opMap, operators, material, image, onProgress, plan }) {
  const executionPlan = plan || compileExecutionPlan(op, opMap, material);
  const ids = collectSubtreeIds(op.id, opMap);
  const subset = {};
  for (const id of ids) subset[id] = opMap[id];

  const phases = executionPlan.phases || [];
  if (phases.length === 1 && phases[0].id === "synthesize") {
    const phase = phases[0];
    onProgress?.(phase.label);
    return runClaude(phase.prompt, material.trim(), {
      system: phase.system,
      maxTokens: phase.maxTokens,
      timeoutMs: phase.timeoutMs,
      image,
      compact: executionPlan.fastPath,
    });
  }

  onProgress?.(phases[0]?.label || op.name);
  const abortMs = pipelineClientAbortMs(phases);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), abortMs);
  try {
    const res = await fetch("/api/execute", {
      method: "POST",
      headers: apiAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        op,
        opMap: subset,
        operators,
        material,
        image,
      }),
      signal: controller.signal,
    });
    const data = parseApiResponse(res, await res.text());
    for (let i = 0; i < (data.phasesRun || phases).length; i++) {
      const pid = (data.phasesRun || phases)[i];
      const phase = phases.find((p) => p.id === pid);
      if (phase) onProgress?.(`${phase.label} (${i + 1}/${phases.length})`);
    }
    return data.output || "";
  } catch (err) {
    if (err.name === "AbortError") throw new Error("Request timed out — try again.");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function runClaude(prompt, text, opts = {}) {
  const {
    image = null,
    system = null,
    maxTokens = null,
    research = false,
    timeoutMs = null,
    compact = false,
  } = opts;
  const controller = new AbortController();
  const serverTimeoutMs = timeoutMs || PHASE_TIMEOUT.synthesizeComposite;
  const timer = setTimeout(() => controller.abort(), CLIENT_ABORT_MS);
  try {
    const res = await fetch("/api/run", {
      method: "POST",
      headers: apiAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        prompt,
        text,
        count: 1,
        image,
        system,
        maxTokens,
        research,
        timeoutMs: serverTimeoutMs,
        compact,
      }),
      signal: controller.signal,
    });
    const raw = await res.text();
    const data = parseApiResponse(res, raw);
    return (data.outputs || [])[0] || "";
  } catch (err) {
    if (err.name === "AbortError") throw new Error("Request timed out — try again.");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function fileToImage(file, max = 1100) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        const type = file.type === "image/png" ? "image/png" : "image/jpeg";
        resolve({ src: canvas.toDataURL(type, 0.86), w, h });
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// distance from point to a segment (screen space)
function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = clamp(t, 0, 1);
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

export default function App() {
  const [items, setItems] = useState(() => {
    const saved = load(ITEMS_KEY, null);
    if (Array.isArray(saved) && saved.length) return saved.map(normalizeItem).filter(Boolean);
    const fromArtifact = migrateFromArtifact();
    if (fromArtifact.length) return fromArtifact;
    return migrateOldSeeds().map(normalizeItem);
  });
  const [camera, setCameraRaw] = useState(() => {
    const saved = load(CAMERA_KEY, null);
    if (saved && typeof saved.scale === "number") return saved;
    return { x: 0, y: 0, scale: 1 };
  });
  // Single-page model: every camera update keeps the sheet locked in view.
  const setCamera = useCallback((next) => {
    setCameraRaw((prev) => {
      const value = typeof next === "function" ? next(prev) : next;
      const r = viewportRef.current?.getBoundingClientRect();
      if (!r || r.width < 60 || r.height < 60) return value;
      return clampPaperCamera(value, r.width, r.height);
    });
  }, []);
  const [operators, setOperators] = useState(() => {
    try {
      const saved = load(OPERATORS_KEY, null) || load(LEGACY_OPERATORS_KEY, null);
      const store = migrateOperatorStore(saved);
      const ops = migrateOperators(store);
      return Array.isArray(ops) ? ops.filter((o) => o && o.id) : [];
    } catch (err) {
      console.warn("[lens] Could not load operators:", err);
      return [];
    }
  });
  const [lenses, setLenses] = useState(() => {
    try {
      const list = loadPatternLenses(load, migrateOldSavedNodes);
      
      return list
        .filter((s) => s && typeof s === "object")
        .map((s) => normalizeSymbolRecord(s))
        .filter(Boolean);
    } catch (err) {
      console.warn("[lens] Could not load lenses:", err);
      return [];
    }
  });
  // walking: { nodeId, title, steps: [...], stepIndex } — derived from a node's history on demand
  const [walking, setWalking] = useState(null);
  const [itemHistoryLog, setItemHistoryLog] = useState(() => loadItemHistoryLog());
  const [stagesItemId, setStagesItemId] = useState(null);
  const [transferExploreOpId, setTransferExploreOpId] = useState(null);
  const [transferTestingDomain, setTransferTestingDomain] = useState(null);
  const [enrichingTransferIds, setEnrichingTransferIds] = useState(() => new Set());
  // transformationRepos: versioned transformation pipelines
  const [transformationRepos, setTransformationRepos] = useState(() => {
    try {
      return loadTransformationRepos(loadArray)
        .filter((l) => l && typeof l === "object")
        .map(normalizeLens)
        .filter((l) => l?.id);
    } catch (err) {
      console.warn("[lens] Could not load transformation repos:", err);
      return [];
    }
  });
  const [activeTransformationId, setActiveTransformationId] = useState(() => loadActiveTransformationId(load));
  const [lensCompare, setLensCompare] = useState(null); // { aId, bId? }
  const [lensHistoryId, setLensHistoryId] = useState(null);
  const [pendingBranch, setPendingBranch] = useState(null); // { kind: 'branch'|'fork', sourceId }

  const [tool, setTool] = useState("select"); // select | highlight | pen | marker | eraser | image | text | sticky
  const [panning, setPanning] = useState(false);
  const [moveDraft, setMoveDraft] = useState("");
  const [selection, setSelection] = useState([]);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState(null);
  const [lasso, setLasso] = useState(null);
  const [jobs, setJobs] = useState([]); // background operations
  const [toast, setToast] = useState(null);
  const [opEditor, setOpEditor] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [dropReady, setDropReady] = useState(false);
  const [dropTargetId, setDropTargetId] = useState(null);
  const [highlight, setHighlight] = useState(null); // { itemId, quote, context, rect, strokeId? }
  const [gesturing, setGesturing] = useState(false);
  const [imageArmed, setImageArmed] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const functionsSectionRef = useRef(null);
  const pendingGoldBornRef = useRef(new Set());
  const lensesSectionRef = useRef(null);
  const [symbolDrawPrompt, setSymbolDrawPrompt] = useState(null); // { structId, title }
  const [symbolInterpretingId, setSymbolInterpretingId] = useState(null);
  const [lensSettingsId, setLensSettingsId] = useState(null);
  const symbolDrawPromptRef = useRef(null);
  const [symbolDropTargetId, setSymbolDropTargetId] = useState(null);
  const [railDropOver, setRailDropOver] = useState(false);
  const [captureNameOverride, setCaptureNameOverride] = useState(null);
  const captureSelRef = useRef(null);
  const [onboard, setOnboard] = useState(() => (localStorage.getItem(ONBOARDED_KEY) ? null : { step: "role" }));
  const [companionAutoOpen, setCompanionAutoOpen] = useState(() => !localStorage.getItem(COMPANION_SEEN_KEY));
  const [columnLayout, setColumnLayout] = useState(loadColumnLayout);
  const [columnResizing, setColumnResizing] = useState(null);
  const [colGridWidth, setColGridWidth] = useState(0);
  const columnLayoutRef = useRef(columnLayout);
  const threeColumnGridRef = useRef(null);
  columnLayoutRef.current = columnLayout;
  const tourContextRef = useRef(createTourContext());
  const [tourActive, setTourActive] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const [expandToolsSignal, setExpandToolsSignal] = useState(0);
  const [freshConfirm, setFreshConfirm] = useState(false);
  const [pendingShareBundle, setPendingShareBundle] = useState(null);
  const supaAuth = useSupabaseSession();
  const [authOpen, setAuthOpen] = useState(
    () => isSupabaseConfigured() && Boolean(supaAuth.bootAuthError)
  );
  const [plansOpen, setPlansOpen] = useState(false);
  const userPlan = useUserPlan({
    session: supaAuth.session,
    sessionResolved: supaAuth.sessionResolved,
  });
  const prevSessionRef = useRef("unresolved");
  const [railPulse, setRailPulse] = useState(false);
  const [docTitle, setDocTitle] = useState(() => load(DOC_TITLE_KEY, "Untitled Idea"));
  const [docStarred, setDocStarred] = useState(() => !!load(DOC_STAR_KEY, false));
  const [pages, setPages] = useState(() => {
    const saved = load(PAGES_KEY, null);
    const base = Array.isArray(saved) && saved.length
      ? saved.map((p, i) => ({
          ...p,
          name: migratePageName(p.name, i),
          sessions: p.sessions || [],
        }))
      : [{ id: DEFAULT_PAGE_ID, name: "World 1", camera: { x: 0, y: 0, scale: 1 }, sessions: [] }];
    return base;
  });
  const [activePageId, setActivePageId] = useState(() => load(PAGES_KEY, [{ id: DEFAULT_PAGE_ID }])[0]?.id || DEFAULT_PAGE_ID);
  const [worldFilter, setWorldFilter] = useState(null);
  const [theme, setTheme] = useState(() => load(THEME_KEY, "idea"));
  const [savedIndicator, setSavedIndicator] = useState(true);
  const [aiPanel, setAiPanel] = useState(null);
  const [aiNodes, setAiNodes] = useState([]);
  const [selectedAiNodeIds, setSelectedAiNodeIds] = useState([]);
  const [highlightTouchIds, setHighlightTouchIds] = useState([]);
  const [highlightSelectionIds, setHighlightSelectionIds] = useState([]);
  const [highlightAiNodeIds, setHighlightAiNodeIds] = useState([]); // AI nodes in the cross-layer highlight selection
  const [highlightTransferringIds, setHighlightTransferringIds] = useState([]);
  const [aiLandingNodeIds, setAiLandingNodeIds] = useState(() => new Set());
  const [spaceTransferGhost, setSpaceTransferGhost] = useState(null);
  const [cloneGhost, setCloneGhost] = useState(null);
  const [toolboxApplyGhost, setToolboxApplyGhost] = useState(null);
  const [growingAiEdgeIds, setGrowingAiEdgeIds] = useState(() => new Set());
  const [ideaOrbFlight, setIdeaOrbFlight] = useState(null);
  const [highlightGrabHover, setHighlightGrabHover] = useState(false);
  const [paperRecording, setPaperRecording] = useState(false);
  const [paperRecordLevel, setPaperRecordLevel] = useState(0);
  const [paperRecordMs, setPaperRecordMs] = useState(0);
  const [strokeTooltip, setStrokeTooltip] = useState(null);
  const [aiDropOver, setAiDropOver] = useState(false);
  const [aiCanvasDropOver, setAiCanvasDropOver] = useState(false);
  const [aiCamera, setAiCamera] = useState(() =>
    centerAiCamera(400, 300, DEFAULT_CONSTELLATION_SCALE)
  );
  const [aiFocusedNodeId, setAiFocusedNodeId] = useState(null);
  const [boundaryDropOver, setBoundaryDropOver] = useState(false);
  const [boundaryMagnetActive, setBoundaryMagnetActive] = useState(false);
  const [transferDragActive, setTransferDragActive] = useState(false);
  const [canvasDropOver, setCanvasDropOver] = useState(false);
  const [goldBornIds, setGoldBornIds] = useState(() => new Set());

  const viewportRef = useRef(null);
  const paperSessionRef = useRef(null);
  const paperStrokeIdRef = useRef(null);
  const paperRecordTickRef = useRef(null);
  const railRef = useRef(null);
  const inputLayerRef = useRef(null);
  const gesture = useRef(null);
  const camRef = useRef(camera);
  const itemsRef = useRef(items);
  const lensesRef = useRef(lenses);
  const toolRef = useRef(tool);
  const selectedAiNodeIdsRef = useRef([]);
  const selRef = useRef(selection);
  const highlightSelectionRef = useRef(highlightSelectionIds);
  const editingRef = useRef(editing);
  const symbolViewLensSaveRef = useRef(null);
  const combineRef = useRef(null);
  const showToastRef = useRef(() => {});
  const pendingImageRef = useRef(null);
  const lastPointerRef = useRef(null);
  const editClickRef = useRef(null);
  const eraseAtPointerRef = useRef(() => false);
  const itemAtPointRef = useRef(() => null);
  const historyRef = useRef({ past: [], future: [] });
  const pushHistoryRef = useRef(() => {});
  camRef.current = camera;
  itemsRef.current = items;
  lensesRef.current = lenses;
  symbolDrawPromptRef.current = symbolDrawPrompt;
  toolRef.current = tool;
  selectedAiNodeIdsRef.current = selectedAiNodeIds;
  selRef.current = selection;
  highlightSelectionRef.current = highlightSelectionIds;
  editingRef.current = editing;

  const expandInAiRef = useRef(() => {});
  const paperHighlightTransferRef = useRef(() => {});
  const transferFragmentToPaperRef = useRef(() => {});
  const transferFragmentReplaceRef = useRef(() => {});
  const spaceTransferCompleteRef = useRef(() => {});
  const toolboxApplyCompleteRef = useRef(() => {});
  const toolboxDragEnvRef = useRef({});
  const aiNodesRef = useRef([]);
  const aiCamRef = useRef(aiCamera);
  const aiViewportRef = useRef(null);
  const functionsColumnRef = useRef(null);
  const aiCamAnimCancelRef = useRef(null);
  const prevAiNodeCountRef = useRef(0);
  const aiStableCameraUntilRef = useRef(0);
  aiCamRef.current = aiCamera;
  const pageFilterRef = useRef({ pageId: DEFAULT_PAGE_ID, world: null });
  pageFilterRef.current = { pageId: activePageId, world: worldFilter };
  aiNodesRef.current = aiNodes;

  useEffect(() => localStorage.setItem(ITEMS_KEY, JSON.stringify(items)), [items]);
  useEffect(() => {
    localStorage.setItem(PAGES_KEY, JSON.stringify(pages));
    setSavedIndicator(true);
  }, [pages]);
  useEffect(() => {
    localStorage.setItem(DOC_TITLE_KEY, JSON.stringify(docTitle));
    setSavedIndicator(true);
  }, [docTitle]);
  useEffect(() => localStorage.setItem(DOC_STAR_KEY, JSON.stringify(docStarred)), [docStarred]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, JSON.stringify(theme));
  }, [theme]);
  useEffect(() => {
    function onResize() {
      const gridW = threeColumnGridRef.current?.clientWidth;
      if (!gridW) return;
      setColumnLayout((prev) => clampColumnLayout(prev, gridW));
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  useEffect(() => {
    setSavedIndicator(false);
    const t = setTimeout(() => setSavedIndicator(true), 400);
    return () => clearTimeout(t);
  }, [items]);
  useEffect(() => localStorage.setItem(CAMERA_KEY, JSON.stringify(camera)), [camera]);

  const paperCenteredRef = useRef(false);
  useEffect(() => {
    if (paperCenteredRef.current || !viewportRef.current) return;
    const r = viewportRef.current.getBoundingClientRect();
    if (r.width < 40 || r.height < 40) return;
    paperCenteredRef.current = true;
    setCamera(fitPaperInView(r.width, r.height));
  });

  const aiCenteredRef = useRef(false);
  useEffect(() => {
    if (aiCenteredRef.current || !aiViewportRef.current) return;
    const w = aiViewportRef.current.clientWidth;
    const h = aiViewportRef.current.clientHeight;
    if (w < 40 || h < 40) return;
    aiCenteredRef.current = true;
    setAiCamera(fitAiConstellation(aiNodesRef.current, w, h));
  });

  useEffect(() => {
    const count = aiNodes.length;
    const prev = prevAiNodeCountRef.current;
    prevAiNodeCountRef.current = count;
    if (count === 0) return;
    if (aiStableCameraUntilRef.current > Date.now()) return;
    const el = aiViewportRef.current;
    if (!el) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (w < 40 || h < 40) return;

    if (prev === 0 && count >= 1) {
      setAiCamera(fitAiConstellation(aiNodes, w, h));
      return;
    }

    if (count - prev >= 3 && aiCamRef.current.scale <= CONSTELLATION_ZOOM_THRESHOLD) {
      animateAiCameraTo(fitAiConstellation(aiNodes, w, h), 520);
    }
  }, [aiNodes]);

  useEffect(() => {
    if (!paperRecording) {
      if (paperRecordTickRef.current) clearInterval(paperRecordTickRef.current);
      return undefined;
    }
    const start = Date.now();
    paperRecordTickRef.current = setInterval(() => {
      setPaperRecordMs(Date.now() - start);
    }, 200);
    return () => clearInterval(paperRecordTickRef.current);
  }, [paperRecording]);
  useEffect(() => localStorage.setItem(OPERATORS_KEY, JSON.stringify(operators)), [operators]);
  useEffect(() => localStorage.setItem(PATTERN_LENSES_KEY, JSON.stringify(lenses)), [lenses]);

  useEffect(() => {
    cleanupEmptyDrafts();
  }, [selection, editing]);
  useEffect(() => localStorage.setItem(TRANSFORMATION_REPOS_KEY, JSON.stringify(transformationRepos)), [transformationRepos]);

  const shareImportedRef = useRef(false);
  useEffect(() => {
    if (!supaAuth.sessionResolved) return;
    if (shareImportedRef.current) return;
    const parsed = parseShareFromLocation(window.location);
    if (!parsed) return;
    shareImportedRef.current = true;
    const decoded = decodeShareToken(parsed.token);
    if (!decoded.ok) {
      showToast("could not read share link");
      return;
    }
    const clean = clearShareFromLocation(window.location);
    window.history.replaceState({}, "", clean);
    setTimeout(() => setPendingShareBundle(decoded.bundle), 80);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supaAuth.sessionResolved]);
  useEffect(() => localStorage.setItem(ACTIVE_TRANSFORMATION_KEY, JSON.stringify(activeTransformationId)), [activeTransformationId]);

  useEffect(() => {
    if (!["select", "highlight"].includes(tool)) setHighlight(null);
    // Leaving the text/sticky utensil should exit edit so select can drag again.
    if (tool !== "text" && tool !== "sticky" && editingRef.current) {
      finishEditing();
    }
  }, [tool]);

  useEffect(() => {
    const id = selection.length === 1 ? selection[0] : null;
    if (id !== captureSelRef.current) {
      captureSelRef.current = id;
      setCaptureNameOverride(null);
    }
  }, [selection]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 3200);
  }
  showToastRef.current = showToast;

  const [authBootError, setAuthBootError] = useState(supaAuth.bootAuthError);

  useEffect(() => {
    setApiAccessTokenGetter(() => supaAuth.session?.access_token || null);
  }, [supaAuth.session]);

  const hydrateBoardFromCloud = useCallback((parsed) => {
    if (Array.isArray(parsed.items)) {
      setItems(parsed.items.map(normalizeItem).filter(Boolean));
    }
    if (Array.isArray(parsed.pages) && parsed.pages.length) {
      setPages(
        parsed.pages.map((p, i) => ({
          ...p,
          name: migratePageName(p.name, i),
          sessions: p.sessions || [],
        }))
      );
      setActivePageId(parsed.pages[0]?.id || DEFAULT_PAGE_ID);
    }
    if (parsed.docTitle != null) setDocTitle(parsed.docTitle);
    setDocStarred(!!parsed.docStarred);
    if (parsed.theme) setTheme(parsed.theme);
    if (parsed.camera) setCamera(parsed.camera);
    if (parsed.operators) {
      const store = migrateOperatorStore(parsed.operators);
      setOperators(migrateOperators(store).filter((o) => o && o.id));
    }
    if (Array.isArray(parsed.lenses)) {
      setLenses(parsed.lenses.map((s) => normalizeSymbolRecord(s)).filter(Boolean));
    }
    if (Array.isArray(parsed.transformationRepos)) {
      setTransformationRepos(
        parsed.transformationRepos.map(normalizeLens).filter((l) => l?.id)
      );
    }
    setActiveTransformationId(parsed.activeTransformationId || null);
    historyRef.current = { past: [], future: [] };
    setCanUndo(false);
    setCanRedo(false);
    showToastRef.current?.("board synced from cloud");
  }, []);

  useBoardCloudSync({
    session: supaAuth.session,
    sessionResolved: supaAuth.sessionResolved,
    onHydrate: hydrateBoardFromCloud,
    onSynced: () => setSavedIndicator(true),
    dirtyToken: [
      items,
      pages,
      docTitle,
      docStarred,
      theme,
      camera,
      operators,
      lenses,
      transformationRepos,
      activeTransformationId,
    ],
  });

  useEffect(() => {
    if (!supaAuth.sessionResolved) return;
    if (prevSessionRef.current === "unresolved") {
      prevSessionRef.current = supaAuth.session;
      return;
    }
    const prev = prevSessionRef.current;
    prevSessionRef.current = supaAuth.session;
    if (!prev && supaAuth.session) {
      // Any SIGNED_IN closes the auth overlay regardless of its internal view
      // (covers cross-tab confirmation).
      setAuthOpen(false);
      if (!supaAuth.passwordRecovery) {
        showToast("signed in as " + (supaAuth.session.user?.email || "your account"));
      }
    } else if (prev && !supaAuth.session) {
      // Passive UI swap only — cross-tab sign-out and refresh failures must
      // never unmount the canvas or interrupt drafts, jobs, or recordings.
      showToast("signed out");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supaAuth.session, supaAuth.sessionResolved]);

  function handleAccountAction(action) {
    if (action === "sign-in") setAuthOpen(true);
    if (action === "plans") setPlansOpen(true);
    if (action === "sign-out") {
      // Local scope: signing out here leaves the user's other devices alone.
      getSupabase()?.auth.signOut({ scope: "local" }).catch(() => {});
    }
  }

  function pushHistory() {
    const snap = JSON.stringify(itemsRef.current);
    const { past } = historyRef.current;
    if (past.length && past[past.length - 1] === snap) return;
    past.push(snap);
    if (past.length > 50) past.shift();
    historyRef.current.future = [];
    setCanRedo(false);
    setCanUndo(true);
  }
  pushHistoryRef.current = pushHistory;

  function undo() {
    const { past, future } = historyRef.current;
    if (!past.length) return;
    emitTourEvent("undo");
    future.push(JSON.stringify(itemsRef.current));
    setItems(JSON.parse(past.pop()));
    setCanUndo(past.length > 0);
    setCanRedo(future.length > 0);
    setHighlight(null);
    setSelection([]);
    setEditing(null);
    showToast("undone");
  }

  function redo() {
    const { past, future } = historyRef.current;
    if (!future.length) return;
    emitTourEvent("redo");
    past.push(JSON.stringify(itemsRef.current));
    setItems(JSON.parse(future.pop()));
    setCanUndo(true);
    setCanRedo(future.length > 0);
    setHighlight(null);
    setSelection([]);
    setEditing(null);
    showToast("redone");
  }

  function removeHighlightStroke(strokeId) {
    if (!strokeId) return;
    setItems((arr) => arr.filter((it) => it.id !== strokeId));
  }

  function pushJob(job) {
    const id = job.id || uid();
    setJobs((arr) => [{ ...job, id }, ...arr].slice(0, 12));
    return id;
  }
  function patchJob(id, patch) {
    setJobs((arr) => arr.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  }
  function finishJob(id, status, message) {
    patchJob(id, { status, step: message, progress: status === "done" ? 1 : undefined });
    setTimeout(() => setJobs((arr) => arr.filter((j) => j.id !== id)), status === "error" ? 8000 : 4000);
  }

  // ---- camera math: all world coords are relative to the viewport (not the window) ----
  function vpRect() {
    return viewportRef.current?.getBoundingClientRect() || { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
  }

  function vpLocal(clientX, clientY) {
    const r = vpRect();
    return { x: clientX - r.left, y: clientY - r.top };
  }

  function clientToWorld(clientX, clientY) {
    const l = vpLocal(clientX, clientY);
    const c = camRef.current;
    const raw = { x: (l.x - c.x) / c.scale, y: (l.y - c.y) / c.scale };
    return clampToPaper(raw.x, raw.y);
  }

  function worldToLocal(wx, wy) {
    const c = camRef.current;
    return { x: wx * c.scale + c.x, y: wy * c.scale + c.y };
  }

  function worldToClient(wx, wy) {
    const l = worldToLocal(wx, wy);
    const r = vpRect();
    return { x: l.x + r.left, y: l.y + r.top };
  }

  function paperViewportCenterWorld() {
    const r = vpRect();
    return clientToWorld(r.left + r.width / 2, r.top + r.height / 2);
  }

  function isNearTransferBoundary(clientX) {
    const r = vpRect();
    return clientX >= r.right - BOUNDARY_MAGNET_PX;
  }

  function isNearLeftTransferBoundary(clientX) {
    const r = vpRect();
    return clientX <= r.left + BOUNDARY_MAGNET_PX;
  }

  function isNearAiTransferBoundary(clientX) {
    const el = aiViewportRef.current?.closest?.(".ai-column") || aiViewportRef.current;
    const r = el?.getBoundingClientRect();
    return !!(r && clientX <= r.left + BOUNDARY_MAGNET_PX);
  }

  function computeTransferPreviewBox(origin, ids) {
    if (origin === "paper" && ids?.length) {
      const bb = selectionWorldBBoxForIds(ids);
      if (!bb) return null;
      const tl = worldToClient(bb.minx, bb.miny);
      const br = worldToClient(bb.maxx, bb.maxy);
      const pad = 10;
      return {
        width: Math.max(48, br.x - tl.x + pad * 2),
        height: Math.max(36, br.y - tl.y + pad * 2),
      };
    }
    if (origin === "ai") return { width: 72, height: 52 };
    return null;
  }

  function isOverPaperColumn(clientX, clientY) {
    const el = viewportRef.current?.closest?.(".canvas-column") || viewportRef.current;
    const r = el?.getBoundingClientRect();
    return !!(r && clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom);
  }

  function isOverFunctionsColumn(clientX, clientY) {
    const el = functionsColumnRef.current;
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return !!(r && clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom);
  }

  function isOverAiColumn(clientX, clientY) {
    const el = aiViewportRef.current?.closest?.(".ai-column") || aiViewportRef.current;
    const r = el?.getBoundingClientRect();
    return !!(r && clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom);
  }

  function focusRailPane(pane) {
    const el = pane === RAIL_LENSES ? lensesSectionRef.current : functionsSectionRef.current;
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    if (pane === RAIL_LENSES) emitTourEvent("lenses-tab");
  }

  function startColumnBoundaryResize(e, edge) {
    const gridW = threeColumnGridRef.current?.clientWidth || window.innerWidth;
    const startLayout = { ...columnLayoutRef.current };
    const startX = e.clientX;
    // A moving boundary must never leave editing chrome floating over
    // whatever it covers — commit any open text editor before resizing.
    finishEditing();
    setStagesItemId(null);
    setColumnResizing(edge);
    document.body.classList.add("column-boundary-resizing");

    function onMove(ev) {
      const raw = layoutAfterResizeDrag(edge, startX, ev.clientX, startLayout);
      const width = threeColumnGridRef.current?.clientWidth || gridW;
      setColumnLayout(clampColumnLayout(raw, width));
    }

    function onUp() {
      setColumnResizing(null);
      document.body.classList.remove("column-boundary-resizing");
      saveColumnLayout(columnLayoutRef.current);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  function resolveLeftColumnDropTarget(clientX, clientY) {
    const symbolsEl = lensesSectionRef.current;
    if (symbolsEl) {
      const r = symbolsEl.getBoundingClientRect();
      if (
        clientY >= r.top &&
        clientY <= r.bottom &&
        clientX >= r.left &&
        clientX <= r.right
      ) {
        return RAIL_LENSES;
      }
    }
    return RAIL_TRANSFORMATIONS;
  }

  function guessToolboxTarget(clientX, clientY) {
    if (isOverFunctionsColumn(clientX, clientY)) {
      return resolveLeftColumnDropTarget(clientX, clientY);
    }
    const symbolsEl = lensesSectionRef.current;
    const sy = symbolsEl?.getBoundingClientRect();
    if (sy && clientY >= sy.top && clientY <= sy.bottom) return RAIL_LENSES;
    return RAIL_TRANSFORMATIONS;
  }

  function resolveSpaceTransferTarget(origin, clientX, clientY) {
    if (origin === "paper") {
      if (isOverAiColumn(clientX, clientY)) return "ai";
      if (isOverFunctionsColumn(clientX, clientY)) return resolveLeftColumnDropTarget(clientX, clientY);
      if (isOverPaperColumn(clientX, clientY)) return "paper";
      return null;
    }
    if (isOverPaperColumn(clientX, clientY) || isNearAiTransferBoundary(clientX)) return "paper";
    if (isOverFunctionsColumn(clientX, clientY)) return resolveLeftColumnDropTarget(clientX, clientY);
    if (isOverAiColumn(clientX, clientY)) return "ai";
    return null;
  }

  function resolveTransferDropTarget(origin, clientX, clientY) {
    const target = resolveSpaceTransferTarget(origin, clientX, clientY);
    if (origin === "paper" && !target) {
      if (isOverAiColumn(clientX, clientY) || isNearTransferBoundary(clientX)) return "ai";
      if (isOverFunctionsColumn(clientX, clientY) || isNearLeftTransferBoundary(clientX)) {
        return guessToolboxTarget(clientX, clientY);
      }
    }
    if (origin === "ai" && !target && isNearAiTransferBoundary(clientX)) return "paper";
    return target;
  }

  function transferGhostWrapClass(ghost) {
    if (!ghost) return "";
    const px = ghost.pointerX ?? ghost.cx;
    const py = ghost.pointerY ?? ghost.cy;
    const { target, origin } = ghost;
    if (target === "ai") return " over-ai";
    if (target === "paper") return " over-paper";
    if (target === RAIL_TRANSFORMATIONS) return " over-transformations";
    if (target === RAIL_LENSES) return " over-lenses";
    if (origin === "paper" && isNearLeftTransferBoundary(px)) {
      return guessToolboxTarget(px, py) === RAIL_LENSES
        ? " over-boundary-lenses"
        : " over-boundary-transformations";
    }
    if (origin === "paper" && isNearTransferBoundary(px)) return " over-boundary";
    if (origin === "ai" && isNearAiTransferBoundary(px)) return " over-boundary";
    return " over-boundary";
  }

  function buildSpaceTransferGhost(origin, ids, clientX, clientY, target = null, previewOverride = null) {
    const preview = previewOverride || transferPreviewText(origin, ids);
    const anchor = transferGhostAnchor(origin, ids, clientX, clientY);
    return {
      cx: anchor.cx,
      cy: anchor.cy,
      pointerX: clientX,
      pointerY: clientY,
      count: ids.length,
      target,
      origin,
      preview,
      previewBox: computeTransferPreviewBox(origin, ids),
    };
  }

  function launchToolboxTransfer(target) {
    focusRailPane(target === RAIL_LENSES ? RAIL_LENSES : RAIL_TRANSFORMATIONS);
    pulseFunctionsRail();
  }

  function transferGhostAnchor(_origin, _ids, clientX, clientY) {
    return { cx: clientX, cy: clientY };
  }

  function isPaperDragTransferZone(clientX, clientY) {
    const target = resolveTransferDropTarget("paper", clientX, clientY);
    return (
      (target && target !== "paper") ||
      isNearLeftTransferBoundary(clientX) ||
      isNearTransferBoundary(clientX)
    );
  }

  function shouldHandoffAiNodeDrag(clientX, clientY) {
    return (
      isOverPaperColumn(clientX, clientY) ||
      isNearAiTransferBoundary(clientX) ||
      isOverFunctionsColumn(clientX, clientY)
    );
  }

  function handoffPaperMoveToSpaceTransfer(g, cx, cy) {
    const next = {
      mode: "space-transfer",
      origin: "paper",
      ids: g.ids.slice(),
      kind: g.kind || null,
      activated: true,
      cx: g.cx,
      cy: g.cy,
      lastCx: cx,
      lastCy: cy,
      previewBox: computeTransferPreviewBox("paper", g.ids),
      preview: transferPreviewText("paper", g.ids),
    };
    gesture.current = next;
    activateSpaceTransfer(next, cx, cy);
    const target = resolveSpaceTransferTarget("paper", cx, cy);
    setBoundaryMagnetActive(true);
    setTransferDragActive(true);
    setRailDropOver(target === RAIL_TRANSFORMATIONS || target === RAIL_LENSES);
    if (target === RAIL_LENSES) {
      setSymbolDropTargetId(structCardAtClient(cx, cy));
    } else {
      setSymbolDropTargetId(null);
    }
    setSpaceTransferGhost(buildSpaceTransferGhost("paper", g.ids, cx, cy, target, g.preview));
  }

  function getAiDropWorldFromClient(clientX, clientY) {
    const rect = aiViewportRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return screenToWorld(aiCamRef.current, clientX - rect.left, clientY - rect.top);
  }

  function markGoldBorn(id) {
    setGoldBornIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    window.setTimeout(() => {
      setGoldBornIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 5200);
  }

  function transferPreviewText(origin, ids) {
    if (origin === "paper") {
      const picked = itemsRef.current.filter((it) => ids.includes(it.id));
      const texts = picked
        .map((it) => (typeof it.text === "string" ? it.text.trim() : ""))
        .filter(Boolean);
      if (texts.length) return texts.join("  ·  ").slice(0, 180);
      const strokes = picked.filter((it) => it.type === "stroke").length;
      if (strokes) return `${strokes} ink stroke${strokes > 1 ? "s" : ""}`;
      return `${ids.length} item${ids.length > 1 ? "s" : ""}`;
    }
    const nodes = aiNodesRef.current.filter((n) => ids.includes(n.id));
    const t = nodes
      .map((n) => n.goldenFragment || n.expandedText || n.preview || n.label)
      .filter(Boolean)
      .join("  ·  ");
    return t.slice(0, 180) || `${ids.length} node${ids.length > 1 ? "s" : ""}`;
  }

  function startAiHighlightTransfer(e, nodeIds, opts = {}) {
    if (!nodeIds?.length) return;
    const nodes = aiNodesRef.current.filter((n) => nodeIds.includes(n.id));
    const fragment =
      opts.fragment?.trim() ||
      nodes.map((n) => n.goldenFragment?.trim()).find(Boolean) ||
      null;
    const preview = fragment || transferPreviewText("ai", nodeIds);
    startPendingSpaceTransfer(e, "ai", nodeIds, {
      kind: "highlight",
      immediate: opts.immediate,
      fragment,
      preview,
    });
  }

  function startPendingSpaceTransfer(e, origin, ids, opts = {}) {
    if (!ids?.length) return;
    const previewBox = opts.previewBox || computeTransferPreviewBox(origin, ids);
    const preview = opts.preview || transferPreviewText(origin, ids);
    setGesturing(true);
    const immediate = !!opts.immediate;
    gesture.current = {
      mode: immediate ? "space-transfer" : "pending-space-transfer",
      origin,
      ids: ids.slice(),
      kind: opts.kind || null,
      fragment: opts.fragment || null,
      previewBox,
      preview,
      activated: immediate,
      cx: e.clientX,
      cy: e.clientY,
      lastCx: e.clientX,
      lastCy: e.clientY,
    };
    setTransferDragActive(immediate);
    if (immediate) {
      const target = resolveSpaceTransferTarget(origin, e.clientX, e.clientY);
      setSpaceTransferGhost(
        buildSpaceTransferGhost(origin, ids, e.clientX, e.clientY, target, preview)
      );
      setBoundaryMagnetActive(true);
    } else {
      setSpaceTransferGhost(null);
    }
    try {
      (e.currentTarget || inputLayerRef.current)?.setPointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  function activateSpaceTransfer(g, cx, cy) {
    g.mode = "space-transfer";
    g.activated = true;
    if (g.kind === "highlight" && !g.tourHighlightDragEmitted) {
      g.tourHighlightDragEmitted = true;
      emitTourEvent("highlight-drag");
    }
    if (!g.previewBox) g.previewBox = computeTransferPreviewBox(g.origin, g.ids);
    if (!g.preview) g.preview = transferPreviewText(g.origin, g.ids);
    setTransferDragActive(true);
    setBoundaryMagnetActive(true);
    setSpaceTransferGhost(buildSpaceTransferGhost(g.origin, g.ids, cx, cy, null, g.preview));
  }

  function transferAiNodesToPaper(nodeIds, atWorld) {
    const nodes = aiNodesRef.current.filter((n) => nodeIds.includes(n.id));
    if (!nodes.length) return;
    let yOffset = 0;
    for (const node of nodes) {
      const fragment = node.goldenFragment?.trim();
      let text = fragment || node.expandedText || node.preview || "";
      if (!text?.trim() && node.sourceIds?.length) {
        text = itemsRef.current
          .filter((it) => node.sourceIds.includes(it.id))
          .map((it) => (it.type === "text" ? it.text : it.preview || it.label || ""))
          .filter(Boolean)
          .join("\n\n");
      }
      if (text?.trim()) {
        const lineage = aiNodeLineageVias(node);
        spawnTextAtWorld(text, { x: atWorld.x, y: atWorld.y + yOffset }, {
          silent: true,
          fromAi: true,
          aiNodeId: node.id,
          sourceIds: node.sourceIds,
          // Single-step productions keep a via for thread capture; longer
          // sequences rely on the per-step history recorded below.
          via: lineage.length === 1 ? lineage[0] : undefined,
          lineageVias: lineage,
        });
        if (fragment) {
          updateAiNode(node.id, { goldenFragment: null });
        }
        yOffset += 72;
      }
    }
    setSelectedAiNodeIds([]);
    showToast("moved to paper");
  }

  function handleAiNodeSelect(idOrIds, opts = {}) {
    if (Array.isArray(idOrIds)) {
      setSelectedAiNodeIds(idOrIds);
      return;
    }
    const id = idOrIds;
    if (opts.toggle) {
      setSelectedAiNodeIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
    } else if (opts.add) {
      setSelectedAiNodeIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    } else {
      setSelectedAiNodeIds([id]);
    }
  }

  function animateAiCameraTo(targetCamera, ms = 420) {
    if (aiCamAnimCancelRef.current) aiCamAnimCancelRef.current();
    aiCamAnimCancelRef.current = animateCameraState(aiCamRef.current, targetCamera, {
      duration: ms,
      ease: easeInOutCubic,
      onUpdate: setAiCamera,
      onDone: () => {
        aiCamAnimCancelRef.current = null;
      },
    });
  }

  /** Zoom so the node circle is centered and text is readable in-place. */
  function aiCardCameraFor(node, el) {
    const scale = clampScale(AI_TEXT_ZOOM_FULL);
    return focusAiNode(node, el.clientWidth, el.clientHeight, scale);
  }

  function zoomAiToNode(node, ms = 580) {
    const el = aiViewportRef.current;
    if (!el || !node) return;
    animateAiCameraTo(aiCardCameraFor(node, el), ms);
  }

  function focusAiNodeContent(node) {
    if (!node) return;
    setAiPanel((prev) => ({
      ...(prev || {}),
      expandedText: node.expandedText || node.preview || node.label || "",
      activeNodeId: node.id,
      loading: node.loading,
      error: node.error,
      sourceIds: node.sourceIds || prev?.sourceIds,
    }));
  }

  function exploreAiNode(nodeId, opts = {}) {
    const { animate = true, runExpand = false } = opts;
    const node = aiNodesRef.current.find((n) => n.id === nodeId);
    if (!node) return;
    emitTourEvent("explore-node");
    emitTourEvent("ai-zoom-in");

    handleAiNodeSelect(nodeId, { replace: true });
    setAiFocusedNodeId(nodeId);
    focusAiNodeContent(node);

    if (animate) {
      zoomAiToNode(node);
    } else {
      const el = aiViewportRef.current;
      if (el) {
        setAiCamera(aiCardCameraFor(node, el));
      }
    }

    if (!runExpand) return;

    if (node.nodeKind === "expanded" && node.expandedText) {
      focusAiNodeContent(node);
      return;
    }

    const { ids, sourceNode } = resolveNodeSourceIds(node);
    const { aiMaterial } = resolveAiOperatorInput(node);
    if ((ids?.length || aiMaterial) && !node.loading) {
      expandInAi(ids || [], {
        sourceNode: sourceNode || node,
        aiMaterial: aiMaterial || null,
      });
    }
  }

  function returnAiToConstellation() {
    const el = aiViewportRef.current;
    if (!el) return;
    emitTourEvent("return-constellation");
    setAiFocusedNodeId(null);
    animateAiCameraTo(fitAiConstellation(aiNodesRef.current, el.clientWidth, el.clientHeight), 520);
  }

  function focusAiNodeFromZoom(nodeId) {
    const node = aiNodesRef.current.find((n) => n.id === nodeId);
    if (!node) return;
    setAiFocusedNodeId(nodeId);
    handleAiNodeSelect(nodeId, { replace: true });
    focusAiNodeContent(node);
    const el = aiViewportRef.current;
    if (!el) return;
    const midScale = Math.min(EXPLORE_ZOOM_SCALE, Math.max(aiCamRef.current.scale, 1.05));
    animateAiCameraTo(focusAiNode(node, el.clientWidth, el.clientHeight, midScale), 480);
  }

  function captureMoveStartPositions(ids) {
    const startPositions = {};
    for (const id of ids) {
      const it = itemsRef.current.find((i) => i.id === id);
      if (!it) continue;
      if (it.type === "stroke") {
        startPositions[id] = { points: it.points.map((p) => ({ ...p })) };
      } else {
        startPositions[id] = { x: it.x, y: it.y };
      }
    }
    return startPositions;
  }

  function restoreMovePositions(startPositions) {
    if (!startPositions) return;
    setItems((arr) =>
      arr.map((it) => {
        const saved = startPositions[it.id];
        if (!saved) return it;
        if (it.type === "stroke") return { ...it, points: saved.points };
        return { ...it, x: saved.x, y: saved.y };
      })
    );
  }

  function transformableDragIds(ids) {
    return (ids || []).filter((id) => {
      const it = itemsRef.current.find((i) => i.id === id);
      return it && isTransformableBlock(it);
    });
  }

  function duplicateItemsAt(ids, atWorld) {
    if (!ids?.length) return;
    const bb = selectionWorldBBoxForIds(ids);
    if (!bb) return;
    pushHistory();
    const ox = atWorld.x - (bb.minx + bb.maxx) / 2;
    const oy = atWorld.y - (bb.miny + bb.maxy) / 2;
    const newIds = [];
    const copies = [];
    for (const id of ids) {
      const it = itemsRef.current.find((i) => i.id === id);
      if (!it || it.type === "link") continue;
      const newId = uid();
      let copy;
      if (it.type === "stroke") {
        copy = {
          ...it,
          id: newId,
          points: it.points.map((p) => ({ ...p, x: p.x + ox, y: p.y + oy })),
        };
      } else {
        copy = { ...it, id: newId, x: it.x + ox, y: it.y + oy };
      }
      copy = tagRecordingItem(normalizeItem(copy));
      if (!copy) continue;
      copies.push(copy);
      newIds.push(newId);
      recordItemEvent(newId, "born", { itemSnapshot: itemSnapshot(copy) });
    }
    if (copies.length) {
      setItems((arr) => [...arr, ...copies]);
      setSelection(newIds);
    }
  }

  function replaceFragmentInAiNode(nodeId, quote) {
    const q = quote?.trim();
    if (!nodeId || !q) return;
    const node = aiNodesRef.current.find((n) => n.id === nodeId);
    if (!node?.expandedText) return;
    const text = node.expandedText;
    const idx = text.indexOf(q);
    const updated =
      idx >= 0 ? text.slice(0, idx) + `⟦${q}⟧` + text.slice(idx + q.length) : `${text}\n\n⟦${q}⟧`;
    updateAiNode(nodeId, { expandedText: updated, goldenFragment: q });
    setAiPanel((prev) =>
      prev?.activeNodeId === nodeId ? { ...prev, expandedText: updated } : prev
    );
  }

  function zoomCamera(c, factor, anchorLocal = null) {
    const r = vpRect();
    const lx = anchorLocal?.x ?? r.width / 2;
    const ly = anchorLocal?.y ?? r.height / 2;
    return zoomAtPoint(c, lx, ly, factor);
  }

  function placeEditCaret(id, cx, cy) {
    const el = document.querySelector(`[data-item="${id}"].editing`);
    if (!el?.isContentEditable) return;
    el.focus();
    try {
      const range = document.caretRangeFromPoint?.(cx, cy);
      if (range && el.contains(range.startContainer)) {
        const s = window.getSelection();
        s.removeAllRanges();
        s.addRange(range);
        return;
      }
    } catch {
      /* ignore */
    }
    const r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(false);
    const s = window.getSelection();
    s.removeAllRanges();
    s.addRange(r);
  }

  function finishEditing() {
    const id = editingRef.current;
    if (!id) return;
    const el = document.querySelector(`[data-item="${id}"].editing`);
    if (el?.isContentEditable) {
      commitEdit(id, el.innerText ?? "");
    } else {
      editingRef.current = null;
      setEditing(null);
    }
  }

  const setGesturingRef = useRef(setGesturing);
  setGesturingRef.current = setGesturing;
  const setPanningRef = useRef(setPanning);
  setPanningRef.current = setPanning;

  // global pointer move/up so gestures work across canvas items
  useEffect(() => {
    function onMove(e) {
      const g = gesture.current;
      lastPointerRef.current = { cx: e.clientX, cy: e.clientY };
      if (!g) return;
      const cx = e.clientX;
      const cy = e.clientY;

      if (g.mode === "pan") {
        if (!g.tourPanEmitted) {
          g.tourPanEmitted = true;
          emitTourEvent("paper-pan");
        }
        setCamera({ ...g.cam, x: g.cam.x + (cx - g.cx), y: g.cam.y + (cy - g.cy) });
      } else if (g.mode === "pending-space-transfer") {
        g.lastCx = cx;
        g.lastCy = cy;
        const dist = Math.hypot(cx - g.cx, cy - g.cy);
        if (dist > TRANSFER_DRAG_THRESHOLD) {
          activateSpaceTransfer(g, cx, cy);
        }
        if (g.mode === "space-transfer" || dist > TRANSFER_DRAG_THRESHOLD) {
          setTransferDragActive(true);
          const target = resolveSpaceTransferTarget(g.origin, cx, cy);
          setSpaceTransferGhost(buildSpaceTransferGhost(g.origin, g.ids, cx, cy, target, g.preview));
        }
      } else if (g.mode === "space-transfer") {
        g.lastCx = cx;
        g.lastCy = cy;
        const target = resolveSpaceTransferTarget(g.origin, cx, cy);
        const magnet =
          (g.origin === "paper" &&
            (isNearTransferBoundary(cx) ||
              isNearLeftTransferBoundary(cx) ||
              target === "ai" ||
              target === RAIL_TRANSFORMATIONS ||
              target === RAIL_LENSES)) ||
          (g.origin === "ai" &&
            (isNearAiTransferBoundary(cx) ||
              target === "paper" ||
              target === RAIL_TRANSFORMATIONS ||
              target === RAIL_LENSES));
        setBoundaryMagnetActive(magnet);
        setRailDropOver(target === RAIL_TRANSFORMATIONS || target === RAIL_LENSES);
        if (target === RAIL_LENSES) {
          setSymbolDropTargetId(structCardAtClient(cx, cy));
        } else {
          setSymbolDropTargetId(null);
        }
        setTransferDragActive(true);
        setSpaceTransferGhost(buildSpaceTransferGhost(g.origin, g.ids, cx, cy, target, g.preview));
      } else if (g.mode === "draw") {
        const w = clientToWorld(cx, cy);
        if (g.highlight) {
          const brushed = highlightBrushHits(
            itemsRef.current,
            cx,
            cy,
            g.lastCx,
            g.lastCy,
            camRef.current.scale,
            worldToClient,
            null
          );
          if (brushed.length) {
            if (!g.brushedIds) g.brushedIds = new Set();
            brushed.forEach((id) => g.brushedIds.add(id));
            setHighlightTouchIds((prev) => [...new Set([...prev, ...brushed])]);
          }
          g.lastCx = cx;
          g.lastCy = cy;
        }
        g.points.push(
          paperSessionRef.current?.recording
            ? { ...w, t: paperSessionRef.current.elapsedMs() }
            : w
        );
        if (paperSessionRef.current?.recording) {
          paperSessionRef.current.addPoint(w.x, w.y);
        }
        const loop = g.highlight && g.points.length > 8 && isClosedHighlightLoop(g.points, camRef.current.scale);
        setDraft({ points: g.points.slice(), marker: g.marker, highlight: g.highlight, loop });
      } else if (g.mode === "erase") {
        const hit = itemAtPoint(cx, cy);
        if (hit && !g.deletedIds?.has(hit.id)) {
          if (!g.deletedIds) g.deletedIds = new Set();
          g.deletedIds.add(hit.id);
          setItems((arr) => arr.filter((it) => !g.deletedIds.has(it.id)));
          setSelection((sel) => sel.filter((id) => !g.deletedIds.has(id)));
        }
      } else if (g.mode === "clone") {
        if (!g.tourCloneEmitted) {
          g.tourCloneEmitted = true;
          emitTourEvent("clone-drag");
        }
        g.lastCx = cx;
        g.lastCy = cy;
        setCloneGhost({ cx, cy, ids: g.ids, count: g.ids.length });
        setBoundaryMagnetActive(isNearTransferBoundary(cx));
        setTransferDragActive(isOverAiColumn(cx, cy) || isNearTransferBoundary(cx));
      } else if (g.mode === "move") {
        g.lastCx = cx;
        g.lastCy = cy;
        if (isPaperDragTransferZone(cx, cy)) {
          handoffPaperMoveToSpaceTransfer(g, cx, cy);
          return;
        }
        setBoundaryMagnetActive(false);
        setTransferDragActive(false);
        setSpaceTransferGhost(null);
        const dx = (cx - g.cx) / camRef.current.scale;
        const dy = (cy - g.cy) / camRef.current.scale;
        g.cx = cx;
        g.cy = cy;
        g.moved += Math.abs(dx) + Math.abs(dy);
        const ids = new Set(g.ids);
        setItems((arr) =>
          arr.map((it) => {
            if (!ids.has(it.id)) return it;
            if (it.type === "stroke") {
              return clampItemToPaper(
                { ...it, points: it.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) },
                itemWorldBBox
              );
            }
            return clampItemToPaper({ ...it, x: it.x + dx, y: it.y + dy }, itemWorldBBox);
          })
        );
      } else if (g.mode === "pending") {
        if (g.intent === "clone") {
          const dist = Math.hypot(cx - g.cx, cy - g.cy);
          if (dist > MOVE_DRAG_THRESHOLD) {
            g.mode = "clone";
            g.lastCx = cx;
            g.lastCy = cy;
            setCloneGhost({ cx, cy, ids: g.ids, count: g.ids.length });
            setBoundaryMagnetActive(isNearTransferBoundary(cx));
            setTransferDragActive(isOverAiColumn(cx, cy) || isNearTransferBoundary(cx));
          }
        } else {
          const dist = Math.hypot(cx - g.cx, cy - g.cy);
          if (dist > MOVE_DRAG_THRESHOLD) {
            if (editingRef.current) finishEditing();
            pushHistoryRef.current();
            g.mode = "move";
            g.moved = 0;
            g.lastCx = cx;
            g.lastCy = cy;
            g.startPositions = captureMoveStartPositions(g.ids || []);
          }
        }
      } else if (g.mode === "lasso") {
        const lp = vpLocal(cx, cy);
        g.x1 = lp.x;
        g.y1 = lp.y;
        setLasso({ x0: g.x0, y0: g.y0, x1: lp.x, y1: lp.y });
      } else if (g.mode === "rotate") {
        const it = itemsRef.current.find((i) => i.id === g.id);
        if (!it) return;
        const c = worldToClient(g.cx0, g.cy0);
        const a1 = Math.atan2(cy - c.y, cx - c.x);
        const deg = g.startRot + ((a1 - g.startAngle) * 180) / Math.PI;
        updateItem(g.id, { rotation: deg });
      } else if (g.mode === "resize") {
        const it = itemsRef.current.find((i) => i.id === g.id);
        if (!it) return;
        const dw = (cx - g.cx) / camRef.current.scale;
        const dh = (cy - g.cy) / camRef.current.scale;
        if (it.type === "image") {
          let nw = Math.max(40, g.startW + (g.corner.includes("w") ? -dw : dw));
          let nh = Math.max(30, g.startH + (g.corner.includes("n") ? -dh : dh));
          if (g.aspect) nh = Math.round(nw * (g.startH / g.startW));
          let nx = g.startX ?? it.x;
          let ny = g.startY ?? it.y;
          if (g.corner.includes("w")) nx = (g.startX ?? it.x) + g.startW - nw;
          if (g.corner.includes("n")) ny = (g.startY ?? it.y) + g.startH - nh;
          updateItem(g.id, { w: Math.round(nw), h: Math.round(nh), x: Math.round(nx), y: Math.round(ny) });
        } else if (it.type === "text" || it.type === "sticky" || it.type === "callout" || it.type === "code" || it.type === "math") {
          updateItem(g.id, { w: clampTextWidth(Math.max(120, Math.round(g.startW + dw))) });
        }
      } else if (g.mode === "scale") {
        const it = itemsRef.current.find((i) => i.id === g.id);
        if (!it) return;
        const dw = (cx - g.cx) / camRef.current.scale;
        const factor = Math.max(0.25, g.startScale + dw / 200);
        updateItem(g.id, { scale: factor });
      }
    }

    function onUp() {
      setGesturingRef.current(false);
      const g = gesture.current;
      gesture.current = null;
      if (!g) return;
      if (g.mode === "pan") setPanningRef.current(false);
      if (g.mode === "pending-space-transfer") {
        setTransferDragActive(false);
        setBoundaryMagnetActive(false);
        setSpaceTransferGhost(null);
      } else if (g.mode === "space-transfer") {
        setTransferDragActive(false);
        setBoundaryMagnetActive(false);
        setRailDropOver(false);
        setSymbolDropTargetId(null);
        setSpaceTransferGhost(null);
        const cx = g.lastCx ?? g.cx;
        const cy = g.lastCy ?? g.cy;
        if (g.activated) spaceTransferCompleteRef.current(g, cx, cy);
      }

      if (g.mode === "draw") {
        const brushedDuring = g.brushedIds ? [...g.brushedIds] : [];
        setHighlightTouchIds([]);
        if (g.points.length > 1) {
          const isHighlight = !!g.highlight;
          if (isHighlight) {
            const pts = g.points.slice();
            if (g.strokeId) paperSessionRef.current?.cancelStroke?.();
            const moved = Math.hypot((g.lastCx ?? g.cx) - g.cx, (g.lastCy ?? g.cy) - g.cy);
            const isTap = pts.length <= 4 && moved <= 10;
            const tapHit = isTap
              ? itemAtPointRef.current?.(g.lastCx ?? g.cx, g.lastCy ?? g.cy)
              : null;
            let ideaIds = ideasFromHighlightGesture(
              pts,
              camRef.current.scale,
              itemsRef.current,
              worldToClient,
              tapHit && isTransformableBlock(tapHit) ? tapHit.id : tapHit?.id
            );
            const merged = [...new Set([...ideaIds, ...brushedDuring])];
            if (merged.length) {
              if (isTap && !g.additive && merged.length === 1) {
                const id = merged[0];
                setHighlightSelectionIds((prev) =>
                  prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                );
              } else {
                // Omni-highlighter: every stroke is additive — the selection
                // is a living thing that grows until Esc clears it.
                accumulateHighlightSelection(merged, true);
              }
            }
          } else {
            const strokeItem = finishRecordedStroke(g, g.points, {
              color: INK,
              width: g.marker ? MARKER_W : PEN_W,
              marker: g.marker,
              highlight: false,
            });
            setItems((arr) => [...arr, strokeItem]);
            recordItemEvent(strokeItem.id, "born", { itemSnapshot: itemSnapshot(strokeItem) });
          }
        } else if (g.highlight && g.strokeId) {
          paperSessionRef.current?.cancelStroke?.();
        }
        setDraft(null);
      } else if (g.mode === "lasso") {
        setLasso(null);
        const r = vpRect();
        const L = Math.min(g.x0, g.x1) + r.left;
        const R = Math.max(g.x0, g.x1) + r.left;
        const T = Math.min(g.y0, g.y1) + r.top;
        const B = Math.max(g.y0, g.y1) + r.top;
        if (Math.abs(R - L) >= 4 || Math.abs(B - T) >= 4) {
          const picked = itemsRef.current
            .filter((it) => {
              const bb = itemScreenBBox(it);
              return bb.left < R && bb.right > L && bb.top < B && bb.bottom > T;
            })
            .map((it) => it.id);
          setSelection(picked);
        } else if (g.spawnTextOnClick && toolRef.current === "select") {
          // clean click on empty paper: the select cursor doubles as the text cursor
          placeBlockAtClick("text", g.x0 + r.left, g.y0 + r.top);
        }
      } else if (g.mode === "edit-click") {
        placeEditCaret(g.hitId, g.cx, g.cy);
      } else if (g.mode === "pending") {
        // Google Slides: second click on an already-selected text box enters edit.
        if (
          g.intent !== "clone" &&
          g.alreadySelected &&
          g.hitId &&
          toolRef.current === "select"
        ) {
          const it = itemsRef.current.find((i) => i.id === g.hitId);
          if (it && isEditableBlock(it) && textClickRegion(it, g.cx, g.cy) === "interior") {
            editingRef.current = it.id;
            setEditing(it.id);
            editClickRef.current = { cx: g.cx, cy: g.cy };
          }
        }
      } else if (g.mode === "clone") {
        setCloneGhost(null);
        setBoundaryMagnetActive(false);
        setTransferDragActive(false);
        const cx = g.lastCx ?? g.cx;
        const cy = g.lastCy ?? g.cy;
        const sketchBundle = gatherSelectionSketchBundle(g.ids);
        const world = getAiDropWorldFromClient(cx, cy);
        if (isOverAiColumn(cx, cy)) {
          if (sketchBundle) {
            interpretSketchBundle(sketchBundle, world);
          } else {
            const expandIds = transformableDragIds(g.ids);
            if (expandIds.length) expandInAi(expandIds, { expandedAt: world, stableCamera: true });
          }
        } else {
          const dist = Math.hypot(cx - g.cx, cy - g.cy);
          if (dist > MOVE_DRAG_THRESHOLD) {
            duplicateItemsAt(g.ids, clientToWorld(cx, cy));
          }
        }
      } else if (g.mode === "move") {
        setBoundaryMagnetActive(false);
        setTransferDragActive(false);
        setRailDropOver(false);
        setSymbolDropTargetId(null);
        setSpaceTransferGhost(null);
        const cx = g.lastCx ?? g.cx;
        const cy = g.lastCy ?? g.cy;
        const target = resolveTransferDropTarget("paper", cx, cy);
        if (target === "ai") {
          restoreMovePositions(g.startPositions);
          const world = getAiDropWorldFromClient(cx, cy);
          const sketchBundle = gatherSelectionSketchBundle(g.ids);
          if (sketchBundle) {
            interpretSketchBundle(sketchBundle, world, { fromClient: { x: cx, y: cy } });
          } else {
            const expandIds = transformableDragIds(g.ids);
            if (expandIds.length) {
              expandInAi(expandIds, {
                expandedAt: world,
                fromClient: { x: cx, y: cy },
                quiet: true,
                stableCamera: true,
              });
            } else {
              showToast("Nothing here can transfer to AI");
            }
          }
        } else if (target === RAIL_TRANSFORMATIONS || target === RAIL_LENSES) {
          restoreMovePositions(g.startPositions);
          spaceTransferCompleteRef.current(
            { origin: "paper", ids: g.ids, activated: true, kind: null },
            cx,
            cy
          );
        } else if (g.ids?.length === 1 && (g.moved || 0) > COMBINE_THRESHOLD) {
          const exclude = new Set(g.ids);
          const target = itemAtPoint(cx, cy, exclude);
          if (target) combineRef.current?.(g.ids, [target.id]);
        }
      }
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  useEffect(() => {
    const el = threeColumnGridRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setColGridWidth(el.clientWidth));
    ro.observe(el);
    setColGridWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (columnResizing) return;
    const el = viewportRef.current;
    if (!el) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    const prev = paperVpSizeRef.current;
    if (prev.w > 0 && (prev.w !== w || prev.h !== h)) {
      setCamera((cam) => compensateCameraForViewportResize(cam, prev.w, prev.h, w, h));
    }
    paperVpSizeRef.current = { w, h };
  }, [columnLayout, colGridWidth, columnResizing]);

  useEffect(() => {
    if (columnResizing) return;
    const el = aiViewportRef.current;
    if (!el) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    const prev = aiVpSizeRef.current;
    if (prev.w > 0 && (prev.w !== w || prev.h !== h)) {
      setAiCamera((cam) => compensateCameraForViewportResize(cam, prev.w, prev.h, w, h));
    }
    aiVpSizeRef.current = { w, h };
  }, [columnLayout, colGridWidth, columnResizing]);

  // wheel: pinch / ctrl+scroll zooms at cursor; two-finger scroll pans
  useEffect(() => {
    const el = inputLayerRef.current;
    if (!el) return;
    return attachCanvasWheel(
      el,
      () => camRef.current,
      (next) => setCamera(next),
      (e) => vpLocal(e.clientX, e.clientY)
    );
  }, []);

  // keyboard: escape, delete while not typing in a field
  useEffect(() => {
    function down(e) {
      const typing = e.target.isContentEditable || /^(INPUT|TEXTAREA)$/.test(e.target.tagName || "");
      if (typing) return;
      if (e.key === "Escape") {
        finishEditing();
        setSelection([]);
        setLasso(null);
        gesture.current = null;
        setHighlight((hl) => {
          if (hl?.strokeId) {
            setItems((arr) => arr.filter((it) => it.id !== hl.strokeId));
          }
          return null;
        });
        clearHighlightSelection();
        pendingImageRef.current = null;
        setImageArmed(false);
      }
      // Space: clear highlight marks, then toggle utensil (AI) or cycle tools (paper)
      if (e.key === " " && !e.repeat) {
        const typing =
          e.target?.isContentEditable || /^(INPUT|TEXTAREA)$/.test(e.target?.tagName || "");
        if (typing) return;
        const lp = lastPointerRef.current;
        const onAi = lp ? isOverAiColumn(lp.cx, lp.cy) : false;
        if (!onAi && walkingRef.current) return;
        e.preventDefault();
        clearHighlightSelection();
        if (onAi) {
          const next = toolRef.current === "select" ? "highlight" : "select";
          setTool(next);
          toolRef.current = next;
          emitTourEvent("space-toggle-tool");
          showToast(UTENSIL_LABELS[next] || next);
        } else {
          setTool((t) => {
            const next = cyclePrimaryUtensil(t);
            toolRef.current = next;
            emitTourEvent("space-toggle-tool");
            showToast(UTENSIL_LABELS[next] || next);
            return next;
          });
        }
        pendingImageRef.current = null;
        setImageArmed(false);
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && highlightSelectionRef.current.length) {
        e.preventDefault();
        deleteHighlightSelection();
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selRef.current.length) {
        e.preventDefault();
        deleteSelection();
        return;
      }
      if (e.key === "Enter" && selRef.current.length === 1 && !e.metaKey && !e.ctrlKey) {
        const it = itemsRef.current.find((i) => i.id === selRef.current[0]);
        if (it?.type === "text" && !editingRef.current) {
          e.preventDefault();
          setEditing(it.id);
        }
      }
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        toolRef.current === "highlight" &&
        lastPointerRef.current
      ) {
        e.preventDefault();
        eraseAtPointerRef.current(lastPointerRef.current.cx, lastPointerRef.current.cy);
      }
    }
    window.addEventListener("keydown", down);
    return () => {
      window.removeEventListener("keydown", down);
    };
  }, []);

  // paste image or text
  useEffect(() => {
    function onPaste(e) {
      const typing = e.target.isContentEditable || /^(INPUT|TEXTAREA)$/.test(e.target.tagName || "");
      if (typing) return;
      const clipItems = e.clipboardData?.items || [];
      for (const it of clipItems) {
        if (it.type?.startsWith("image/")) {
          const f = it.getAsFile();
          if (f) {
            e.preventDefault();
            addImage(f);
            return;
          }
        }
      }
      const text = e.clipboardData?.getData("text/plain")?.trim();
      if (text) {
        e.preventDefault();
        const center = paperViewportCenterWorld();
        const id = uid();
        setItems((arr) => [...arr, normalizeItem({ id, type: "text", x: center.x, y: center.y, text, w: fitTextBoxWidth(text, { maxW: maxTextWidth() }) })]);
        setSelection([id]);
      }
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);

  // ---- item helpers ----
  function updateItem(id, patch) {
    if (patch.text != null) {
      const prev = itemsRef.current.find((it) => it.id === id);
      if (prev?.text != null && prev.text !== patch.text) {
        recordItemEvent(id, "edit", {
          itemSnapshot: itemSnapshot({ ...prev, ...patch }),
          textDiff: { from: truncatePreview(prev.text, 80), to: truncatePreview(patch.text, 80) },
        });
      }
    }
    setItems((arr) => arr.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }
  function deleteHighlightSelection() {
    const ids = highlightSelectionRef.current;
    if (!ids.length) return false;
    pushHistory();
    const idSet = new Set(ids);
    setItems((arr) =>
      arr.filter((it) => {
        if (idSet.has(it.id)) return false;
        if (it.type === "link" && (idSet.has(it.fromId) || idSet.has(it.toId))) return false;
        return true;
      })
    );
    setHighlightSelectionIds([]);
    setHighlightTouchIds([]);
    emitTourEvent("highlight-delete");
    return true;
  }

  function transferHighlightSelectionToAi(ids, worldPos = null, opts = {}) {
    if (!ids?.length) return;
    emitTourEvent("highlight-transfer");
    const sketchBundle = gatherSelectionSketchBundle(ids);
    const world = worldPos || getAiDropWorld();
    const expandIds = transformableDragIds(ids);
    if (!sketchBundle && !expandIds.length) {
      showToast("Nothing here can transfer to AI");
      return;
    }
    setHighlightTransferringIds(ids);
    window.setTimeout(() => {
      setHighlightTransferringIds([]);
      setHighlightSelectionIds((prev) => prev.filter((id) => !ids.includes(id)));
      setHighlightTouchIds([]);
    }, 920);
    recordItemEvents(ids, "highlight-transfer", {
      targetLayer: "ai",
      aiNodeId: null,
      opName: "highlight explore",
      inputPreview: truncatePreview(transferPreviewText("paper", ids), 120),
    });
    if (sketchBundle) {
      interpretSketchBundle(sketchBundle, world, opts);
      return;
    }
    if (expandIds.length) {
      expandInAi(expandIds, { expandedAt: world, fromClient: opts.fromClient, quiet: true });
    }
  }

  function transferHighlightSelectionToPaper(ids, atWorld) {
    if (!ids?.length || !atWorld) return;
    emitTourEvent("highlight-to-paper");
    setHighlightTransferringIds(ids);
    window.setTimeout(() => {
      setHighlightTransferringIds([]);
      setHighlightSelectionIds((prev) => prev.filter((id) => !ids.includes(id)));
      setHighlightTouchIds([]);
    }, 920);
    recordItemEvents(ids, "highlight-transfer", {
      targetLayer: "paper",
      inputPreview: truncatePreview(transferPreviewText("paper", ids), 120),
    });
    duplicateItemsAt(ids, atWorld);
    showToast("placed on paper");
  }

  function transferHighlightSelectionToFunctions(ids) {
    if (!ids?.length) return;
    emitTourEvent("highlight-to-functions");
    setHighlightTransferringIds(ids);
    window.setTimeout(() => {
      setHighlightTransferringIds([]);
      setHighlightSelectionIds((prev) => prev.filter((id) => !ids.includes(id)));
      setHighlightTouchIds([]);
    }, 920);
    recordItemEvents(ids, "highlight-transfer", {
      targetLayer: RAIL_TRANSFORMATIONS,
      inputPreview: truncatePreview(transferPreviewText("paper", ids), 120),
    });
    captureMaterialWithReplay(ids);
  }

  function transferHighlightSelectionToStructures(ids, structId = null) {
    if (!ids?.length) return;
    emitTourEvent("highlight-to-lenses");
    finishHighlightTransfer(ids);
    recordItemEvents(ids, "highlight-transfer", {
      targetLayer: RAIL_LENSES,
      structId: structId || undefined,
      merged: !!structId,
      inputPreview: truncatePreview(transferPreviewText("paper", ids), 120),
    });
    addMaterialToLens(ids, { structId });
  }

  function accumulateHighlightSelection(newIds, addToExisting = false) {
    if (!newIds?.length) return;
    setHighlightSelectionIds((prev) => {
      const merged = addToExisting ? [...new Set([...prev, ...newIds])] : [...new Set(newIds)];
      return merged;
    });
  }

  function clearHighlightSelection() {
    setHighlightSelectionIds([]);
    setHighlightAiNodeIds([]);
    setHighlightTouchIds([]);
    setHighlightTransferringIds([]);
    setHighlightGrabHover(false);
  }

  function toggleHighlightAiNode(nodeId) {
    setHighlightAiNodeIds((prev) =>
      prev.includes(nodeId) ? prev.filter((id) => id !== nodeId) : [...prev, nodeId]
    );
  }

  // ---- omni-highlighter toolbar actions: operate on the whole living selection ----

  function highlightToolbarOperate(op) {
    if (!op) return;
    const paperIds = highlightSelectionRef.current;
    const nodeIds = highlightAiNodeIds;
    if (!paperIds.length && !nodeIds.length) {
      showToast("highlight something first");
      return;
    }
    if (paperIds.length) runOperator(op, paperIds, {});
    for (const nid of nodeIds) {
      const node = aiNodesRef.current.find((n) => n.id === nid);
      if (node) applyOperatorToAiNode(node, op, null, { stableCamera: true });
    }
  }

  function highlightSaveAsLens() {
    const paperIds = highlightSelectionRef.current;
    const nodeIds = highlightAiNodeIds;
    if (!paperIds.length && !nodeIds.length) {
      showToast("highlight something first");
      return;
    }
    let struct = null;
    if (paperIds.length) struct = saveMaterialAsSymbol(paperIds);
    if (nodeIds.length) struct = saveAiNodesAsSymbol(nodeIds, struct?.id || null) || struct;
    if (struct) clearHighlightSelection();
  }

  function highlightSendToAi() {
    const paperIds = highlightSelectionRef.current;
    if (!paperIds.length) {
      showToast("highlight paper material to send across");
      return;
    }
    expandInAi(paperIds, {});
  }

  function deleteSelection() {
    pushHistory();
    const ids = new Set(selRef.current);
    setItems((arr) =>
      arr.filter((it) => {
        if (ids.has(it.id)) return false;
        if (it.type === "link" && (ids.has(it.fromId) || ids.has(it.toId))) return false;
        return true;
      })
    );
    setSelection([]);
  }

  // ---- composed operators (functions made of functions) ----
  const opMap = useMemo(() => Object.fromEntries(operators.map((o) => [o.id, o])), [operators]);

  function makeBoardLink(fromId, toId, fromDir = null) {
    return normalizeItem({ id: uid(), type: "link", fromId, toId, fromDir });
  }

  /** Single entry point for all transform spawns — collision-safe, cascades within a batch. */
  function spawnTransformOutputs(texts, parentIds, atWorld, via = null, opts = {}) {
    const rawList = Array.isArray(texts) ? texts : [texts];
    const cleaned = rawList.map((t) => stripMd(t || "").trim()).filter(Boolean);
    if (!cleaned.length) return { ids: [], lastAnchorBox: null, lastParentIds: parentIds || [] };

    const fallbackWorld = parentIds?.length ? null : atWorld;
    const newIds = [];
    const spawnRecords = [];
    let lastAnchorBox = null;
    let lastParentIds = parentIds || [];

    setItems((arr) => {
      const placedSoFar = [];
      let anchor = opts.anchorBox || spawnAnchorBox(parentIds, arr, fallbackWorld, paperViewportCenterWorld);
      let linkFrom = parentIds || [];
      const newItems = [];
      const newLinks = [];

      for (const clean of cleaned) {
        const w = opts.widthFor?.(clean) || estimateSpawnWidth(clean);
        const { x, y, fromDir } = findClearSpawnPosition(anchor, w, clean, arr, placedSoFar);
        const id = uid();
        newIds.push(id);
        const item = normalizeItem({
          id,
          type: "text",
          x,
          y,
          text: clean,
          w,
          bornFrom: linkFrom,
          via,
          ...(opts.portal != null ? { portal: opts.portal } : {}),
        });
        spawnRecords.push({ id, item, via });
        newItems.push(item);
        placedSoFar.push(item);
        for (const sid of linkFrom) {
          newLinks.push(makeBoardLink(sid, id, fromDir));
        }
        const bb = itemWorldBBox(item);
        if (bb) {
          anchor = bb;
          lastAnchorBox = bb;
        }
        linkFrom = [id];
        lastParentIds = [id];
      }

      return [...arr, ...newLinks, ...newItems];
    });

    for (const { id, item, via: moveVia } of spawnRecords) {
      recordItemEvent(
        id,
        moveVia ? "expand" : "born",
        {
          itemSnapshot: itemSnapshot(item),
          opName: moveVia?.name,
          outputPreview: truncatePreview(item.text, 120),
        }
      );
    }

    if (newIds.length) setSelection(newIds);
    return { ids: newIds, lastAnchorBox, lastParentIds };
  }

  function spawnPortalObjects(portals, sourceIds, atWorld) {
    if (!portals?.length) return [];
    pushHistory();
    const newIds = [];
    let chainParentIds = sourceIds || [];
    let chainAnchor = null;
    for (const portal of portals) {
      const text = portalDisplayText(portal);
      const clean = stripMd(text).trim();
      if (!clean) continue;
      const result = spawnTransformOutputs([clean], chainParentIds, atWorld, null, {
        anchorBox: chainAnchor || undefined,
        widthFor: () => Math.min(480, Math.max(240, Math.round(clean.length * 0.45 + 180))),
        portal: !!portal.domain,
      });
      newIds.push(...result.ids);
      chainParentIds = result.lastParentIds;
      chainAnchor = result.lastAnchorBox;
    }
    return newIds;
  }

  /** Results must be visible where they are born — reopen a collapsed AI column. */
  function ensureAiColumnVisible() {
    if (columnLayoutRef.current.right > 0) return;
    const width = threeColumnGridRef.current?.clientWidth || window.innerWidth;
    const next = clampColumnLayout(
      { ...columnLayoutRef.current, right: DEFAULT_COLUMN_LAYOUT.right },
      width
    );
    setColumnLayout(next);
    saveColumnLayout(next);
  }

  /**
   * All function outputs are born in the AI layer, linked to their sources.
   * They enter the notebook only when the user drags them across the boundary.
   */
  function spawnAiOutputs(texts, sourceIds, via = null, opts = {}) {
    ensureAiColumnVisible();
    const list = (Array.isArray(texts) ? texts : [texts])
      .map((t) => stripMd(t || "").trim())
      .filter(Boolean);
    if (!list.length) return [];

    let parent = opts.parentNode || null;
    if (!parent && sourceIds?.length) {
      parent = ensureSourceNode(sourceIds, opts.sourcePreview || null, opts.sourcePreview?.slice(0, 24) || "Source");
      const idSet = new Set(sourceIds);
      const preview =
        opts.sourcePreview ||
        truncatePreview(
          itemsRef.current
            .filter((it) => idSet.has(it.id))
            .map((it) => it.text || it.preview || "")
            .join(" ")
            .trim(),
          200
        );
      updateAiNode(parent.id, {
        ...(preview ? { preview, label: truncateLabel(preview) } : {}),
        loading: false,
      });
    }

    const nodes = [];
    let chainParent = parent;
    for (const text of list) {
      let node;
      if (chainParent) {
        node = createExpandedChild(
          chainParent,
          { opLabel: via?.name || "output", opId: via?.opId || null, loading: false },
          undefined
        );
      } else {
        node = createOutputNode(text, null);
      }
      updateAiNode(node.id, {
        expandedText: text,
        loading: false,
        error: null,
        label: truncateLabel(via?.name || text.slice(0, 24) || "Output"),
        ...(via ? { via, opId: via.opId || node.opId || null, opLabel: via.name || node.opLabel || null } : {}),
      });
      nodes.push(node);
      if (opts.chain || !chainParent) chainParent = node;
    }

    if (nodes.length) {
      setSelectedAiNodeIds(nodes.map((n) => n.id));
      launchPaperToAiTransfer({ nodeIds: nodes.map((n) => n.id) });
    }
    return nodes;
  }

  function spawnMultipleObjects(texts, sourceIds, atWorld, via = null) {
    return spawnAiOutputs(texts, sourceIds, via).map((n) => n.id);
  }

  async function executeOperatorJob(jobId, op, targetIds, atClient, opts = {}, mapOverride = null) {
    const idSet = new Set(targetIds);
    const itemList = itemsRef.current.filter((it) => idSet.has(it.id));
    patchJob(jobId, { step: "reading material…" });
    const gathered = await gatherMaterialFromItems(itemList);
    let text = gathered.text;
    const { image } = gathered;
    if (!text?.trim() && !image) throw new Error("no readable content");

    const transfer = resolveTransferContext(op, opts.lens);
    if (transfer && text?.trim() && (needsCognitiveInstantiation(transfer, text) || opts.forceTargetDomain)) {
      const targetDomain = opts.forceTargetDomain || inferDomainFromMaterial(text);
      const original = transfer.fidelity?.originalDomain || transfer.domainAnchor?.label;
      const cross = opts.forceTargetDomain
        ? opts.forceTargetDomain !== original
        : !!(original && targetDomain && original !== targetDomain);
      patchJob(jobId, {
        step: cross
          ? `adapting to ${targetDomain || "new domain"}…`
          : "restoring cognitive transfer…",
      });
      let pipelineTree;
      if (!cross) {
        pipelineTree = buildFidelityPipelineFallback(transfer);
      } else {
        pipelineTree = await instantiateTransfer(transfer, runClaude, {
          targetMaterial: text,
          targetDomain,
          mode: "cross",
        });
      }
      if (pipelineTree) {
        const { ops, rootId } = treeToOperators(pipelineTree, { top: false });
        mapOverride = { ...(mapOverride || {}), ...Object.fromEntries(ops.map((o) => [o.id, o])) };
        op = ops.find((o) => o.id === rootId) || op;
      }
    }

    const rawMap = { ...opMap, ...(mapOverride || {}) };
    const map = hydrateOperatorMap(rawMap, operators, op.id);
    const execOp = map[op.id] || op;

    if (opts.highlightQuote) {
      text = `HIGHLIGHTED:\n"""\n${opts.highlightQuote.trim()}\n"""\n\nFULL TEXT:\n"""\n${(opts.highlightContext || text).trim()}\n"""`;
    }

    let out;
    const onProgress = (step) => patchJob(jobId, { step });

    if (isFlatMoveSequence(execOp, map)) {
      const stepMs = execOp.steps.reduce((ms, sid) => {
        const s = map[sid];
        return ms + (isTransformPrimitive(s) ? estimatePrimitiveMs(s, text) : ETA.default);
      }, 0);
      patchJob(jobId, {
        step: execOp.steps.map((sid) => map[sid]?.name).filter(Boolean).join(" → "),
        startedAt: Date.now(),
        estimatedMs: stepMs,
      });
      let chainParentNode = null;
      await runMoveSequence(execOp, map, text, image, onProgress, operators, async ({ out: stepOut, stepOp }) => {
        patchJob(jobId, { step: "spawning object…", progress: 0.92 });
        const polished = isTransformPrimitive(stepOp)
          ? sanitizePrimitiveOutput(stepOut)
          : await polishDeliverable(stepOut, stepOp, text);
        const nodes = spawnAiOutputs([polished], targetIds, viaFromOp(stepOp, targetIds), {
          parentNode: chainParentNode,
          sourcePreview: gathered.preview,
        });
        chainParentNode = nodes[nodes.length - 1] || chainParentNode;
      });
      return;
    } else {
    const plan = compileExecutionPlan(execOp, map, text);
    const estimatedMs = estimatePlanMs(plan);
    patchJob(jobId, {
      step: plan.phases?.[0]?.label || execOp.name,
      startedAt: Date.now(),
      estimatedMs,
    });

    if (plan.phases.length === 1 && plan.phases[0].id === "synthesize") {
      const phase = plan.phases[0];
      onProgress(phase.label);
      out = await runClaude(phase.prompt, text.trim(), {
        system: phase.system,
        maxTokens: phase.maxTokens,
        timeoutMs: phase.timeoutMs,
        image,
        compact: plan.fastPath,
      });
    } else {
      out = await runExecutionOnServer({
        op: execOp,
        opMap: map,
        operators,
        material: text,
        image,
        onProgress,
        plan,
      });
    }
    }

    if (execOp.multi) {
      const parts = out
        .split(/\n{2,}/)
        .map((p) => p.replace(/^\s*(?:\[[^\]]+\]|[-*•]|\d+[.)])\s*/m, "").trim())
        .filter((p) => p.length > 3);
      if (parts.length < 2) {
        const lines = out.split(/\n+/).map((l) => l.trim()).filter((l) => l.length > 3);
        if (lines.length >= 2) {
          const atWorld = atClient ? clientToWorld(atClient.x, atClient.y) : null;
          spawnMultipleObjects(lines, targetIds, atWorld, viaFromOp(execOp, targetIds));
          return;
        }
        throw new Error(`${execOp.name} produced only one part`);
      }
      const atWorld = atClient ? clientToWorld(atClient.x, atClient.y) : null;
      spawnMultipleObjects(parts, targetIds, atWorld, viaFromOp(execOp, targetIds));
      return;
    }

    if (!out?.trim()) throw new Error("empty output");
    if (isTransformPrimitive(execOp)) {
      out = sanitizePrimitiveOutput(out);
      if (!out?.trim() || isPrimitiveMetaOutput(out)) {
        throw new Error(`${execOp.name}: got commentary instead of transformed text — try again`);
      }
    } else {
      patchJob(jobId, { step: "polishing deliverable…", progress: 0.95 });
      out = await polishDeliverable(out, execOp, text);
      if (isInternalMetadataOutput(out)) {
        throw new Error("output looks like internal metadata — try a full function, not a resolve step");
      }
    }
    patchJob(jobId, { step: "spawning object…", progress: 0.98 });
    spawnAiOutputs([out], targetIds, viaFromOp(execOp, targetIds), {
      sourcePreview: gathered.preview,
    });
  }

  function runOperator(op, targetIds, opts = {}) {
    const atClient = opts.atClient;
    const map = opts.opMap || opMap;
    let ids = targetIds?.length ? targetIds : resolveTargetIds(atClient);
    if (!ids.length) {
      showToast("drop onto an idea");
      return;
    }
    if ((op.needsSelection >= 2) && ids.length < 2) {
      showToast("select 2+ ideas for this transform");
      return;
    }
    setSelection(ids);
    const jobId = pushJob({
      id: uid(),
      label: op.name,
      type: "operator",
      status: "running",
      step: "starting…",
      progress: 0,
      startedAt: Date.now(),
      estimatedMs: isTransformPrimitive(op) ? estimatePrimitiveMs(op, "") : ETA.default,
    });
    executeOperatorJob(jobId, op, ids, atClient, opts, map)
      .then(() => finishJob(jobId, "done", `done · ${op.name}`))
      .catch((err) => {
        finishJob(jobId, "error", err.message || "failed");
        showToast(err.message || "failed");
      });
  }

  function applyOpDrop(opId, atClient) {
    if (!atClient) return;
    const op = opMap[opId];
    if (!op) return;
    if (isExpansionOperator(op)) {
      const ids = resolveTargetIds(atClient);
      if (!ids.length) {
        showToast("drop onto text, image, or drawing");
        return;
      }
      if (isOverAiColumn(atClient.x, atClient.y)) {
        expandInAi(ids, {
          op,
          opLabel: op.name,
          expandedAt: getAiDropWorldFromClient(atClient.x, atClient.y),
          fromClient: atClient,
          stableCamera: true,
        });
      } else {
        presentCognitiveBridge(
          ids,
          atClient,
          (bridgeOpts) =>
            expandInAi(ids, {
              op,
              opLabel: op.name,
              ...bridgeOpts,
            }),
          { label: op.name }
        );
      }
      return;
    }
    const ids = resolveTargetIds(atClient);
    if (!ids.length) {
      showToast("drop onto text, image, or drawing");
      return;
    }
    setDropTargetId(null);
    runOperator(op, ids, { atClient });
  }

  function runTransformationLensOnIds(lensId, ids, atClient) {
    if (!ids?.length) {
      showToast("drop onto an idea");
      return;
    }
    const lens = transformationRepos.find((l) => l.id === lensId) || displayTransformations.find((l) => l.id === lensId);
    if (!lens) return;
    const moveOps = (lens.moveIds || []).map((id) => opMap[id]).filter(Boolean);
    if (!moveOps.length) {
      showToast("lens has no moves");
      return;
    }
    setDropTargetId(null);
    if (moveOps.length === 1) {
      runOperator(moveOps[0], ids, { atClient, lens });
      return;
    }
    const tree = {
      name: lens.name,
      description: `Function: ${lens.name}`,
      steps: moveOps.map((op) => opToJsonTree(op, opMap)),
    };
    const { ops, rootId } = treeToOperators(tree, { top: false });
    const compound = ops.find((o) => o.id === rootId);
    if (!compound) return;
    const mergedMap = { ...opMap, ...Object.fromEntries(ops.map((o) => [o.id, o])) };
    runOperator(compound, ids, { atClient, opMap: mergedMap, lens });
  }

  function applyTransformationLensDrop(lensId, atClient) {
    if (!atClient) return;
    const lens = transformationRepos.find((l) => l.id === lensId) || displayTransformations.find((l) => l.id === lensId);
    if (!lens) return;
    const ids = resolveTargetIds(atClient);
    if (!ids.length) {
      showToast("drop onto an idea");
      return;
    }
    const runLens = (bridgeOpts = {}) => {
      expandInAi(ids, {
        op: opMap["op-expand"] || TRANSFORM_PRIMITIVES.find((p) => p.name === "expand"),
        opLabel: lens.name,
        bridgeOnly: true,
        stableCamera: true,
        ...bridgeOpts,
      });
      runTransformationLensOnIds(lensId, ids, atClient);
    };
    if (isOverPaperColumn(atClient.x, atClient.y) && !isOverAiColumn(atClient.x, atClient.y)) {
      presentCognitiveBridge(ids, atClient, runLens, { label: lens.name });
      return;
    }
    runLens();
  }

  function applyToolboxOperatorAt(opId, atClient) {
    if (!atClient) return;
    const op = opMap[opId];
    if (!op) return;
    const env = toolboxDragEnvRef.current;
    if (env.isOverAiColumn?.(atClient.x, atClient.y)) {
      const world = env.getAiDropWorldFromClient(atClient.x, atClient.y);
      const node = env.aiNodeAtWorld?.(world.x, world.y);
      if (!node) {
        showToast("drop onto a concept node");
        return;
      }
      applyOperatorToAiNode(node, op, atClient);
      return;
    }
    applyOpDrop(opId, atClient);
  }

  function applyToolboxTransformationLensAt(lensId, atClient) {
    if (!atClient) return;
    const env = toolboxDragEnvRef.current;
    if (env.isOverAiColumn?.(atClient.x, atClient.y)) {
      const world = env.getAiDropWorldFromClient(atClient.x, atClient.y);
      const node = env.aiNodeAtWorld?.(world.x, world.y);
      if (!node) {
        showToast("drop onto a concept node");
        return;
      }
      const lens =
        transformationRepos.find((l) => l.id === lensId) ||
        displayTransformations.find((l) => l.id === lensId);
      if (!lens) return;
      applyTransformationLensToAiNode(node, lens, atClient);
      return;
    }
    applyTransformationLensDrop(lensId, atClient);
  }

  // ---- lenses (ways of seeing) ----
  async function runOnboarding(role) {
    localStorage.setItem(ONBOARDED_KEY, "1");
    setOnboard(null);
    const jobId = pushJob({
      id: uid(),
      label: `building ${role} toolbox`,
      type: "onboard",
      status: "running",
      step: "imagining functions…",
      startedAt: Date.now(),
      estimatedMs: ETA.onboarding,
    });
    try {
      const template = matchRoleTemplate(role);
      let trees;
      if (template?.trees?.length) {
        patchJob(jobId, { step: `loading ${template.trees.length} curated functions…` });
        trees = template.trees.map((t) => ({ ...t, description: t.description || "" }));
      } else {
        const list = await generateFunctionList(role, operators, opMap);
        if (!list.length) throw new Error("Could not imagine functions. Try again.");
        patchJob(jobId, { step: `designing 0 / ${list.length} functions…` });
        let done = 0;
        trees = await Promise.all(
          list.map(async (fn) => {
            let tree;
            try {
              tree = await decomposeFunction(role, fn, operators, opMap);
            } catch {
              tree = {
                name: fn.name,
                description: fn.description,
                prompt: buildDefaultLeafPrompt(fn.name, fn.description),
              };
            }
            done += 1;
            patchJob(jobId, { step: `designing ${done} / ${list.length} functions…` });
            return tree;
          })
        );
      }
      const newOps = [];
      trees.forEach((t) => materializeTree(t, role, true, newOps));
      setOperators((prev) => [...prev, ...newOps]);
      finishJob(jobId, "done", `${trees.length} functions ready`);
      showToast(`${trees.length} functions ready for ${role}`);
    } catch (err) {
      finishJob(jobId, "error", err.message || "failed");
      showToast(err.message || "Something went wrong.");
    }
  }

  function skipOnboarding() {
    localStorage.setItem(ONBOARDED_KEY, "1");
    setOnboard(null);
  }

  function emitTourEvent(name) {
    if (tourActive) tourEvent(tourContextRef.current, name);
  }
  tourEmitRef.current = emitTourEvent;

  function startFeatureTour() {
    tourContextRef.current = createTourContext();
    setTourStepIndex(0);
    setTourActive(true);
    setOnboard(null);
  }

  function completeFeatureTour() {
    try {
      localStorage.setItem(TOUR_STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setTourActive(false);
  }

  useEffect(() => {
    if (onboard || pendingShareBundle) return;
    try {
      if (localStorage.getItem(TOUR_STORAGE_KEY)) return;
    } catch {
      /* ignore */
    }
    tourContextRef.current = createTourContext();
    setTourStepIndex(0);
    setTourActive(true);
  }, [onboard, pendingShareBundle]);

  function confirmStartFresh() {
    setFreshConfirm(false);
    for (const key of LENS_STORAGE_KEYS) localStorage.removeItem(key);
    shareImportedRef.current = true;
    const clean = clearShareFromLocation(window.location);
    window.history.replaceState({}, "", clean);
    historyRef.current = { past: [], future: [] };
    setCanUndo(false);
    setCanRedo(false);
    pendingImageRef.current = null;
    captureSelRef.current = null;
    finishEditing();
    setItems([]);
    setCamera({ x: 0, y: 0, scale: 1 });
    setOperators(freshOperators());
    setLenses([]);
    setTransformationRepos([]);
    setActiveTransformationId(null);
    setWalking(null);
    setLensCompare(null);
    setTool("select");
    setMoveDraft("");
    setSelection([]);
    setDraft(null);
    setLasso(null);
    setJobs([]);
    setOpEditor(null);
    setExpanded({});
    setDropReady(false);
    setDropTargetId(null);
    setHighlight(null);
    setGesturing(false);
    setImageArmed(false);
    focusRailPane(RAIL_TRANSFORMATIONS);
    setRailDropOver(false);
    setCaptureNameOverride(null);
    setOnboard({ step: "role" });
    showToast("Fresh start");
  }

  function openCreateLens() {
    emitTourEvent("open-function-editor");
    setOpEditor({ mode: "create" });
  }

  function syncTransformationRepoForOperator(rootId, rootOp, { isNew = false, stepNames = [], commitMessage = "", commitKind = "commit" } = {}) {
    if (!rootId || !rootOp) return;
    const name = (rootOp.name || "").trim() || "unnamed transformation";
    const now = Date.now();
    const names = stepNames.length ? stepNames : [name];
    setTransformationRepos((ls) => {
      const idx = ls.findIndex((l) => l.opId === rootId || l.id === rootId);
      if (idx >= 0) {
        const prev = ls[idx];
        const commit = makeCommit(
          { message: commitMessage, stepNames: names, parentId: prev.headCommitId, kind: commitKind },
          uid
        );
        const next = ls.slice();
        next[idx] = appendCommit(
          {
            ...prev,
            opId: rootId,
            name,
            moveIds: [rootId],
          },
          commit
        );
        return next;
      }
      const commit = makeCommit(
        { message: commitMessage, stepNames: names, kind: isNew ? "init" : commitKind },
        uid
      );
      const lens = appendCommit(
        normalizeLens({
          id: rootId,
          opId: rootId,
          name,
          moveIds: [rootId],
          defaultBranch: true,
          createdAt: now,
          updatedAt: now,
        }),
        commit
      );
      return [lens, ...ls];
    });
    if (isNew) setActiveTransformationId(rootId);
  }

  function removeTransformationRepoForOperator(rootId) {
    if (!rootId) return;
    setTransformationRepos((ls) => ls.filter((l) => lensRootOpId(l) !== rootId && l.id !== rootId));
    setActiveTransformationId((id) => (id === rootId ? null : id));
  }

  function duplicateOperatorSubtree(rootId) {
    const map = Object.fromEntries(operators.map((o) => [o.id, o]));
    const root = map[rootId];
    if (!root) return null;
    const subtreeIds = [...collectSubtreeIds(rootId, map)];
    const idMap = Object.fromEntries(subtreeIds.map((id) => [id, uid()]));
    const newOps = subtreeIds.map((id) => {
      const op = map[id];
      const clone = { ...op, id: idMap[id] };
      if (clone.kind === "pipeline" && clone.steps) {
        clone.steps = clone.steps.map((sid) => idMap[sid] || sid);
      }
      if (id === rootId) clone.top = true;
      return clone;
    });
    setOperators((prev) => [...prev, ...newOps]);
    return idMap[rootId];
  }

  function openEditLens(op) {
    emitTourEvent("open-function-editor");
    setOpEditor({ mode: "edit", op });
  }

  /** Resolve a lens record to an editable operator tree (fixes multi-move lenses). */
  function openEditLensFromLens(lens) {
    if (!lens) return;
    emitTourEvent("lens-evolve");
    const opId = lensRootOpId(lens);
    let op = opId ? opMap[opId] : null;
    const moveIds = lens.moveIds || [];

    if (!op && moveIds.length) {
      op = opMap[moveIds[0]];
    }

    if (op && moveIds.length > 1 && op.kind !== "pipeline") {
      const stepTrees = moveIds
        .map((id) => opMap[id])
        .filter(Boolean)
        .map((o) => opToJsonTree(o, opMap));
      if (!stepTrees.length) {
        showToast("Can't edit — steps are missing. Try + function to rebuild.");
        return;
      }
      const tree = { name: lens.name, description: `Function: ${lens.name}`, steps: stepTrees };
      const { ops, rootId } = treeToOperators(tree, { top: true });
      const newRoot = ops.find((o) => o.id === rootId);
      setOperators((prev) => [...prev, ...ops]);
      setTransformationRepos((ls) =>
        ls.some((l) => l.id === lens.id)
          ? ls.map((l) =>
              l.id === lens.id ? normalizeLens({ ...l, opId: rootId, moveIds: [rootId], name: lens.name }) : l
            )
          : ls
      );
      openEditLens(newRoot);
      return;
    }

    if (op) {
      openEditLens(op);
      return;
    }

    showToast("Can't edit — use + lens to create one");
  }

  /** @deprecated use openCreateLens */
  function openCreateFunction() {
    openCreateLens();
  }

  /** @deprecated use openEditLens */
  function openEditFunction(op) {
    openEditLens(op);
  }

  /** One line → a perceptual move you can drag, compound, and lens. */
  function createMove(phrase) {
    const name = (phrase || moveDraft || "").trim();
    if (!name) {
      showToast("name your move — e.g. see as monastery");
      return;
    }
    const exists = operators.some((o) => o.move && o.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      showToast("you already have that move");
      return;
    }
    const op = {
      id: uid(),
      name,
      kind: "prompt",
      move: true,
      description: `Your way of seeing: ${name}`,
      prompt: `${name}.`,
      maxTokens: 800,
      estimatedMs: 13000,
      resolveWhen: "never",
      researchWhen: "never",
    };
    setOperators((arr) => [...arr, op]);
    setMoveDraft("");
    emitTourEvent("create-move");
    showToast(`move · ${name}`);
  }

  function saveLensTree(oldRootId, newOps, { commitMessage = "" } = {}) {
    setOperators((arr) => {
      let next = arr;
      const newRootId = newOps.length ? newOps.find((o) => o.top || o.kind === "pipeline")?.id || newOps[0]?.id : null;
      if (oldRootId) {
        const map = Object.fromEntries(arr.map((o) => [o.id, o]));
        const removeIds = collectSubtreeIds(oldRootId, map);
        next = arr.filter((o) => !removeIds.has(o.id));
        if (newRootId && newRootId !== oldRootId) {
          next = next.map((o) => {
            if (o.kind === "pipeline" && o.steps?.includes(oldRootId)) {
              return { ...o, steps: o.steps.map((sid) => (sid === oldRootId ? newRootId : sid)) };
            }
            return o;
          });
        }
      }
      return [...next, ...newOps];
    });
    const newRootId = newOps.length
      ? newOps.find((o) => o.top || o.kind === "pipeline")?.id || newOps[0]?.id
      : null;
    const root = newOps.find((o) => o.id === newRootId);
    const draftMap = Object.fromEntries(newOps.map((o) => [o.id, o]));
    const stepNames = collectPipelineStepNames(newRootId, draftMap);
    if (root?.top) {
      syncTransformationRepoForOperator(newRootId, root, {
        isNew: !oldRootId,
        stepNames,
        commitMessage,
        commitKind: oldRootId ? "commit" : "init",
      });
    }
    setOpEditor(null);
    showToast(oldRootId ? "saved · lens updated" : "saved · lens created");
  }

  /** @deprecated alias */
  function saveFunctionTree(oldRootId, newOps) {
    saveLensTree(oldRootId, newOps);
  }

  function saveManualOp(op) {
    setOperators((arr) => {
      const exists = arr.some((o) => o.id === op.id);
      const normalized = {
        ...op,
        kind: op.kind || "prompt",
        name: (op.name || "").trim(),
        description: (op.description || "").trim(),
        prompt: (op.prompt || "").trim(),
      };
      if (!normalized.prompt && normalized.kind === "prompt") return arr;
      return exists ? arr.map((o) => (o.id === op.id ? normalized : o)) : [...arr, normalized];
    });
    setOpEditor(null);
    showToast("saved");
  }

  function deleteTransformation(rootId, opts = {}) {
    const map = Object.fromEntries(operators.map((o) => [o.id, o]));
    const removeIds = collectSubtreeIds(rootId, map);
    setOperators((arr) => arr.filter((o) => !removeIds.has(o.id)));
    if (!opts.skipLensRemove) removeTransformationRepoForOperator(rootId);
    setOpEditor(null);
    showToast("transformation deleted");
  }

  /** @deprecated alias */
  function deleteLens(rootId, opts = {}) {
    deleteTransformation(rootId, opts);
  }

  /** @deprecated alias */
  function deleteFunction(rootId, opts) {
    deleteLens(rootId, opts);
  }

  // ---- paths: every node already carries its journey ----
  // Nothing is recorded. A node's path is reconstructed on demand from its
  // history: bornFrom provenance plus drawn connections, in birth order.
  // Any node can be walked or sent, any time.

  const walkingRef = useRef(walking);
  walkingRef.current = walking;
  const itemHistoryLogRef = useRef(itemHistoryLog);
  itemHistoryLogRef.current = itemHistoryLog;
  const camAnimCancelRef = useRef(null);
  const paperVpSizeRef = useRef({ w: 0, h: 0 });
  const aiVpSizeRef = useRef({ w: 0, h: 0 });

  useEffect(() => saveItemHistoryLog(itemHistoryLog), [itemHistoryLog]);

  function recordItemEvent(itemId, kind, meta = {}) {
    if (!itemId || !shouldRecordHistory(kind)) return;
    const it = itemsRef.current.find((x) => x.id === itemId);
    const event = createHistoryEvent(kind, {
      itemSnapshot: meta.itemSnapshot || (it ? itemSnapshot(it) : null),
      ...meta,
    });
    setItemHistoryLog((log) => appendItemHistory(log, itemId, event));
    setItems((arr) =>
      arr.map((x) => (x.id === itemId ? { ...x, history: [...(x.history || []), event] } : x))
    );
  }

  function recordItemEvents(itemIds, kind, meta = {}) {
    for (const id of itemIds || []) recordItemEvent(id, kind, meta);
  }

  function centerCameraOnItem(item) {
    const bb = itemWorldBBoxMeasured(item) || itemWorldBBox(item);
    if (!bb) return;
    const cx = (bb.minx + bb.maxx) / 2;
    const cy = (bb.miny + bb.maxy) / 2;
    animateCameraTo({ x: cx, y: cy }, camRef.current.scale, 420);
  }

  function animateCameraTo(targetWorld, targetScale, ms = 480) {
    if (camAnimCancelRef.current) camAnimCancelRef.current();
    const r = vpRect();
    const from = { ...camRef.current };
    const scale = clampScale(targetScale ?? from.scale);
    const to = {
      scale,
      x: r.width / 2 - targetWorld.x * scale,
      y: r.height / 2 - targetWorld.y * scale,
    };
    camAnimCancelRef.current = animateCameraState(from, to, {
      duration: ms,
      ease: easeInOutCubic,
      onUpdate: setCamera,
      onDone: () => {
        camAnimCancelRef.current = null;
      },
    });
  }

  function animateCameraDirect(targetCamera, ms = 480) {
    if (camAnimCancelRef.current) camAnimCancelRef.current();
    camAnimCancelRef.current = animateCameraState(camRef.current, targetCamera, {
      duration: ms,
      ease: easeInOutCubic,
      onUpdate: setCamera,
      onDone: () => {
        camAnimCancelRef.current = null;
      },
    });
  }

  function stepFocusCenter(step) {
    const ids = new Set(step.itemIds || []);
    const targets = itemsRef.current.filter((it) => ids.has(it.id));
    let minx = Infinity,
      miny = Infinity,
      maxx = -Infinity,
      maxy = -Infinity;
    for (const it of targets) {
      const bb = itemWorldBBox(it);
      if (!bb) continue;
      minx = Math.min(minx, bb.minx);
      miny = Math.min(miny, bb.miny);
      maxx = Math.max(maxx, bb.maxx);
      maxy = Math.max(maxy, bb.maxy);
    }
    if (minx !== Infinity) {
      return { x: (minx + maxx) / 2, y: (miny + maxy) / 2, w: maxx - minx, h: maxy - miny };
    }
    const snap = step.itemSnapshot;
    const sbb = snapshotWorldBBox(snap);
    if (sbb) {
      return {
        x: (sbb.minx + sbb.maxx) / 2,
        y: (sbb.miny + sbb.maxy) / 2,
        w: sbb.maxx - sbb.minx,
        h: sbb.maxy - sbb.miny,
      };
    }
    return step.fallbackCenter || null;
  }

  function stepFocusScale(focus) {
    if (!focus?.w) return camRef.current.scale;
    const r = vpRect();
    const pad = 220;
    const fit = Math.min((r.width - pad) / Math.max(focus.w, 80), (r.height - pad) / Math.max(focus.h, 60));
    return clamp(Math.min(fit, 1.6), 0.25, 1.8);
  }

  function nodeParents(it, allItems) {
    const set = new Set((it.bornFrom || []).filter(Boolean));
    for (const l of allItems) {
      if (l.type === "link" && l.toId === it.id && l.fromId) set.add(l.fromId);
    }
    set.delete(it.id);
    return [...set];
  }

  /** Whether a node's lineage includes operator moves worth distilling into a function. */
  function getNodeThreadCapture(nodeId, allItems = itemsRef.current) {
    const journey = buildNodeJourney(nodeId, allItems);
    if (!journey) return { canCapture: false, reason: "not a thought on the canvas" };
    const vias = journey.steps
      .map((s) => allItems.find((it) => it.id === s.focusId)?.via)
      .filter(Boolean);
    if (!vias.length) {
      const roots = journey.steps.filter((s) => {
        const it = allItems.find((i) => i.id === s.focusId);
        return it && !it.via;
      }).length;
      const reason =
        roots <= 1
          ? "root note — drag a function onto it first"
          : "no transformations on this thread yet";
      return { canCapture: false, reason, journey, moveCount: 0 };
    }
    const moveNames = vias.map((v) => v.name);
    const shortChain = moveNames.slice(0, 4).join(" → ") + (moveNames.length > 4 ? " → …" : "");
    const title = journey.title;
    const defaultName =
      title && title !== "a thought"
        ? `${title}: ${shortChain}`.slice(0, 72)
        : `thread: ${shortChain}`.slice(0, 72);
    const captureMeta = buildCaptureMetadata(journey, vias, allItems);
    return {
      canCapture: true,
      journey,
      vias,
      moveNames,
      moveCount: vias.length,
      defaultName,
      captureMeta,
    };
  }

  /** Reconstruct a node's journey from history alone: ancestors in birth order, ending at the node. */
  function buildNodeJourney(nodeId, allItems = itemsRef.current) {
    const map = new Map(allItems.map((it) => [it.id, it]));
    const target = map.get(nodeId);
    if (!target || target.type === "link") return null;
    const seen = new Set([nodeId]);
    const queue = [nodeId];
    while (queue.length) {
      const it = map.get(queue.shift());
      if (!it) continue;
      for (const pid of nodeParents(it, allItems)) {
        if (!seen.has(pid) && map.get(pid) && map.get(pid).type !== "link") {
          seen.add(pid);
          queue.push(pid);
        }
      }
    }
    const involved = allItems
      .filter((it) => seen.has(it.id) && it.type !== "link")
      .sort((a, b) => (a.bornAt || 0) - (b.bornAt || 0) || (a.id === nodeId ? 1 : b.id === nodeId ? -1 : 0));
    const steps = involved.map((it, i) => {
      const parents = nodeParents(it, allItems).filter((pid) => seen.has(pid));
      const caption = it.via?.name
        ? `through “${it.via.name}”`
        : parents.length === 0
        ? i === 0
          ? "where it began"
          : "a separate spark"
        : parents.length === 1
        ? "grew out of the previous thought"
        : `drawn together from ${parents.length} thoughts`;
      return {
        id: uid(),
        // for convergence moments, illuminate the parents alongside the child
        itemIds: parents.length > 1 ? [...parents, it.id] : [it.id],
        focusId: it.id,
        caption,
        arrived: it.id === nodeId,
      };
    });
    const title = (target.text || "").trim().split("\n")[0].slice(0, 48) || "a thought";
    return { nodeId, title, steps };
  }

  function walkNode(nodeId) {
    const journey = buildNodeJourney(nodeId);
    if (!journey || !journey.steps.length) {
      showToast("nothing to walk yet");
      return;
    }
    finishEditing();
    setSelection([]);
    setWalking({ ...journey, stepIndex: 0 });
  }

  function walkTo(stepIndex) {
    const w = walkingRef.current;
    if (!w) return;
    setWalking({ ...w, stepIndex: clamp(stepIndex, 0, w.steps.length - 1) });
  }

  function endWalk() {
    setWalking(null);
  }

  function openItemStages(itemId) {
    const item = itemsRef.current.find((it) => it.id === itemId);
    if (!item || !isReplayableItem(item)) return;
    finishEditing();
    emitTourEvent("history-replay");
    setTransferExploreOpId(null);
    setStagesItemId(itemId);
  }

  function openTransferExplore(opId) {
    const op = opMap[opId];
    if (!op || !isPortableOperator(op)) {
      showToast("no portable pattern on this operator yet");
      return;
    }
    finishEditing();
    setStagesItemId(null);
    setTransferExploreOpId(opId);
    emitTourEvent("transfer-explore");
  }

  function testTransferInDomain(opId, domain) {
    const op = opMap[opId];
    if (!op) return;
    const ids = selRef.current;
    if (!ids.length) {
      showToast("select material on the board first");
      return;
    }
    setTransferTestingDomain(domain);
    const jobId = pushJob({
      id: uid(),
      label: `${op.name} → ${domain}`,
      type: "operator",
      status: "running",
      step: `testing in ${domain}…`,
      progress: 0,
      startedAt: Date.now(),
      estimatedMs: ETA.default,
    });
    executeOperatorJob(jobId, op, ids, null, { forceTargetDomain: domain })
      .then(() => {
        finishJob(jobId, "done", `tested in ${domain}`);
        setTransferExploreOpId(null);
      })
      .catch((err) => {
        finishJob(jobId, "error", err.message || "failed");
        showToast(err.message || "failed");
      })
      .finally(() => setTransferTestingDomain(null));
  }

  /**
   * Distill the full transformation thread behind a node into one reusable
   * operator: the sequence of moves that produced it becomes a pipeline that
   * replays automatically on any new material.
   */
  function captureThreadAsOperator(nodeId, opts = {}) {
    const info = getNodeThreadCapture(nodeId);
    if (!info.canCapture) {
      showToast(info.reason || "no transformations on this thread yet — apply some operators first");
      return null;
    }
    const item = itemsRef.current.find((it) => it.id === nodeId);
    const materialSample = (item?.text || "").slice(0, 800);
    const domainLabel = opts.domainLabel || inferDomainFromMaterial(materialSample) || null;
    const { vias, moveNames, moveCount, captureMeta } = info;
    const stepNodes = vias.map((via) => abstractStepFromVia(via, opMap, operators));
    const chainLabel = moveNames.join(" → ");
    const name = (opts.name || info.defaultName || `thread: ${chainLabel}`).trim().slice(0, 72);
    const tree = {
      name,
      description: `Captured move sequence (${moveCount} steps): ${chainLabel}. Portable across domains.`,
      steps: stepNodes,
    };
    const meta = {
      ...(captureMeta || {}),
      provenance: captureMeta?.provenance || "thread-capture",
      stepCount: moveCount,
    };
    const { ops, rootId } = treeToOperators(tree, { top: true, captured: true, captureMeta: meta });
    const rootOp = ops.find((o) => o.id === rootId);
    const draftMap = Object.fromEntries(ops.map((o) => [o.id, o]));
    const cognitiveTransfer = rootOp
      ? abstractOperatorToTransfer(rootOp, draftMap, [...operators, ...ops], {
          captureMeta: meta,
          domainLabel,
          materialSample,
          kind: "function",
        })
      : null;
    const opsWithMeta = ops.map((o) =>
      o.id === rootId && cognitiveTransfer
        ? { ...o, captureMeta: { ...(o.captureMeta || meta), cognitiveTransfer } }
        : o
    );
    setOperators((prev) => [...prev, ...opsWithMeta]);
    if (rootOp) syncTransformationRepoForOperator(rootId, rootOp, { isNew: true });
    if (cognitiveTransfer) enrichOperatorTransferAsync(rootId, cognitiveTransfer, { domainLabel, materialSample });
    focusRailPane(RAIL_TRANSFORMATIONS);
    showToast(`saved portable operator · ${moveCount} move${moveCount === 1 ? "" : "s"}`);
    return rootId;
  }

  function saveSelectionAsFunction() {
    const id = selRef.current[0];
    if (!id) return;
    const name = (captureNameOverride ?? getNodeThreadCapture(id).defaultName ?? "").trim();
    captureMaterialWithReplay([id], name ? { name } : {});
    setCaptureNameOverride(null);
  }

  function pickPrimaryCaptureId(ids) {
    const items = (ids || [])
      .map((id) => itemsRef.current.find((it) => it.id === id))
      .filter((it) => it && isReplayableItem(it));
    if (!items.length) return ids?.[0] || null;
    const withVia = items.find((it) => it.via?.name);
    if (withVia) return withVia.id;
    let best = items[0].id;
    let bestLen = 0;
    for (const it of items) {
      const len =
        (itemHistoryLogRef.current[it.id] || []).length + (it.history || []).length;
      if (len > bestLen) {
        bestLen = len;
        best = it.id;
      }
    }
    return best;
  }

  function historyCaptureContext() {
    return {
      allItems: itemsRef.current,
      aiNodes: aiNodesRef.current,
      pages,
      historyLog: itemHistoryLogRef.current,
    };
  }

  function pulseFunctionsRail() {
    setRailPulse(true);
    window.setTimeout(() => setRailPulse(false), 1200);
  }

  function enrichOperatorTransferAsync(rootId, structural, opts = {}) {
    if (!rootId || !structural) return;
    setEnrichingTransferIds((s) => new Set(s).add(rootId));
    enrichTransferWithLLM(structural, runClaude, opts)
      .then((enriched) => {
        setOperators((prev) =>
          prev.map((o) =>
            o.id === rootId
              ? { ...o, captureMeta: { ...(o.captureMeta || {}), cognitiveTransfer: enriched } }
              : o
          )
        );
      })
      .catch(() => {})
      .finally(() => {
        setEnrichingTransferIds((s) => {
          const next = new Set(s);
          next.delete(rootId);
          return next;
        });
      });
  }

  function captureStepsAsOperator(steps, captureMeta, opts = {}) {
    if (!steps?.length) return null;
    const moveNames = steps.map((s) => s.name);
    const chainLabel = moveNames.join(" → ");
    const name = (opts.name || `thread: ${chainLabel}`).slice(0, 72);
    const tree = {
      name,
      description: `Captured perceptual sequence (${steps.length} steps): ${chainLabel}. Reapplies to any similar material.`,
      steps,
    };
    const meta = {
      ...(captureMeta || {}),
      provenance: captureMeta?.provenance || "history-capture",
      stepCount: steps.length,
    };
    const { ops, rootId } = treeToOperators(tree, { top: true, captured: true, captureMeta: meta });
    const rootOp = ops.find((o) => o.id === rootId);
    const draftMap = Object.fromEntries(ops.map((o) => [o.id, o]));
    const cognitiveTransfer = rootOp
      ? abstractOperatorToTransfer(rootOp, draftMap, [...operators, ...ops], {
          captureMeta: meta,
          domainLabel: opts.domainLabel || null,
          materialSample: opts.materialSample || null,
          kind: "function",
        })
      : null;
    const opsWithMeta = ops.map((o) =>
      o.id === rootId && cognitiveTransfer
        ? { ...o, captureMeta: { ...(o.captureMeta || meta), cognitiveTransfer } }
        : o
    );
    setOperators((prev) => [...prev, ...opsWithMeta]);
    if (rootOp) syncTransformationRepoForOperator(rootId, rootOp, { isNew: true });
    if (cognitiveTransfer) enrichOperatorTransferAsync(rootId, cognitiveTransfer, opts);
    focusRailPane(RAIL_TRANSFORMATIONS);
    pulseFunctionsRail();
    showToast(`saved function · ${steps.length} perceptual step${steps.length === 1 ? "" : "s"}`);
    if (opts.sourceIds?.length) {
      recordItemEvents(opts.sourceIds, "saved-as-function", {
        opId: rootId,
        functionName: name,
        stepCount: steps.length,
      });
    }
    return rootId;
  }

  /** Production sequence of an AI node: via records from the root ancestor down to the node. */
  function aiNodeLineageVias(node) {
    const chain = [];
    const seen = new Set();
    let cur = node;
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      if (cur.via || cur.opLabel) {
        chain.push(
          cur.via || {
            name: cur.opLabel,
            opId: cur.opId || null,
            moveRef: cur.opId
              ? { kind: "function", id: cur.opId, name: cur.opLabel }
              : { kind: "primitive", name: cur.opLabel },
          }
        );
      }
      const parentId = cur.parentId || cur.sourceNodeIds?.[0];
      cur = parentId ? aiNodesRef.current.find((n) => n.id === parentId) : null;
    }
    return chain.reverse();
  }

  function collectAiLineageSteps(node) {
    if (!node) return [];
    const steps = [];
    const seen = new Set();
    const pushStep = (step) => {
      const key = `${step.name}:${step.moveRef?.id || step.moveRef?.name || ""}`;
      if (seen.has(key)) return;
      seen.add(key);
      steps.push(step);
    };
    const { ids: sourceIds } = resolveNodeSourceIds(node);
    if (sourceIds?.length) {
      const primaryId = pickPrimaryCaptureId(sourceIds);
      const item = itemsRef.current.find((it) => it.id === primaryId);
      const threadInfo = primaryId ? getNodeThreadCapture(primaryId) : null;
      if (threadInfo?.canCapture) {
        for (const via of threadInfo.vias) {
          pushStep(abstractStepFromVia(via, opMap, operators));
        }
      } else if (item) {
        const perceptual = buildPerceptualCaptureFromItem(primaryId, {
          item,
          ...historyCaptureContext(),
        });
        if (perceptual.canCapture) {
          for (const step of perceptual.steps) pushStep(step);
        }
      }
    }
    // Root-to-node order — the sequence that produced this exact object.
    for (const via of aiNodeLineageVias(node)) {
      pushStep(abstractStepFromVia(via, opMap, operators));
    }
    return steps;
  }

  function captureAiNodesAsFunction(nodeIds, opts = {}) {
    const node = aiNodesRef.current.find((n) => nodeIds.includes(n.id));
    if (!node) return null;
    const steps = collectAiLineageSteps(node);
    if (!steps.length) {
      showToast("no perceptual moves on this thread yet — expand it first");
      return null;
    }
    const label =
      node.expandedText || node.preview || node.label || node.goldenFragment || "AI thread";
    const defaultName = `${truncatePreview(label, 32)}: ${steps.map((s) => s.name).slice(0, 3).join(" → ")}`.slice(
      0,
      72
    );
    return captureStepsAsOperator(
      steps,
      { provenance: "ai-lineage-capture", sourceNodeId: node.id },
      { name: opts.name || defaultName, sourceIds: node.sourceIds || [] }
    );
  }

  function captureMaterialAsFunction(ids, opts = {}) {
    if (!ids?.length) return null;
    for (const id of ids) {
      const info = getNodeThreadCapture(id);
      if (info.canCapture) {
        const rootId = captureThreadAsOperator(id, opts);
        if (rootId) {
          recordItemEvents(ids, "saved-as-function", {
            opId: rootId,
            functionName: opts.name || info.defaultName,
            stepCount: info.moveCount,
          });
          pulseFunctionsRail();
        }
        return rootId;
      }
    }
    const paperIds = ids.filter((id) => {
      const it = itemsRef.current.find((x) => x.id === id);
      return it && isReplayableItem(it);
    });
    if (paperIds.length) {
      const primaryId = pickPrimaryCaptureId(paperIds);
      const item = itemsRef.current.find((it) => it.id === primaryId);
      const perceptual = buildPerceptualCaptureFromItem(primaryId, {
        item,
        ...historyCaptureContext(),
      });
      if (perceptual.canCapture) {
        return captureStepsAsOperator(perceptual.steps, perceptual.captureMeta, {
          name: opts.name || perceptual.defaultName,
          sourceIds: ids,
          domainLabel: inferDomainFromMaterial(item?.text || "") || null,
          materialSample: (item?.text || "").slice(0, 800),
        });
      }
    }
    const aiIds = ids.filter((id) => aiNodesRef.current.some((n) => n.id === id));
    if (aiIds.length) return captureAiNodesAsFunction(aiIds, opts);
    showToast("no perceptual moves to capture yet — explore or transform first");
    return null;
  }

  function captureMaterialWithReplay(ids, opts = {}) {
    captureMaterialAsFunction(ids, opts);
  }

  // leave the walk holding the current thought — tendrils are ready, continuing is branching
  function continueFromWalk() {
    const w = walkingRef.current;
    if (!w) return;
    const focusId = w.steps[w.stepIndex]?.focusId;
    setWalking(null);
    if (focusId && itemsRef.current.some((it) => it.id === focusId)) {
      setSelection([focusId]);
      showToast("continue from here — grab a tendril");
    }
  }

  useEffect(() => {
    if (!walking) return;
    const step = walking.steps?.[walking.stepIndex];
    if (!step) return;
    const focus = stepFocusCenter(step);
    if (focus) animateCameraTo(focus, stepFocusScale(focus));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walking?.nodeId, walking?.stepIndex]);

  // keyboard navigation while walking
  useEffect(() => {
    if (!walking) return;
    function onKey(e) {
      const typing = e.target.isContentEditable || /^(INPUT|TEXTAREA)$/.test(e.target.tagName || "");
      if (typing) return;
      if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        const w = walkingRef.current;
        if (w && w.stepIndex >= w.steps.length - 1) endWalk();
        else walkTo((w?.stepIndex ?? 0) + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        walkTo((walkingRef.current?.stepIndex ?? 0) - 1);
      } else if (e.key === "Escape") {
        e.preventDefault();
        endWalk();
      } else if (e.key.toLowerCase() === "b") {
        e.preventDefault();
        continueFromWalk();
      }
    }
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!walking]);

  function sendNodePath(nodeId) {
    shareJourneyLink(nodeId, { fullPath: true });
  }

  function importPath(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (data?.kind !== "lens-path" || !Array.isArray(data.items) || !data.items.length) {
          throw new Error("not a path");
        }
        importPathItems(data);
      } catch {
        showToast("could not read that path file");
      }
    };
    reader.readAsText(file);
  }

  function structCardAtClient(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);
    const card = el?.closest?.("[data-struct-id]");
    return card?.getAttribute("data-struct-id") || null;
  }

  function opCardAtClient(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);
    const card = el?.closest?.("[data-op-id]");
    return card?.getAttribute("data-op-id") || null;
  }

  function transformationLensCardAtClient(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);
    const card = el?.closest?.("[data-transformation-lens-id]");
    return card?.getAttribute("data-transformation-lens-id") || null;
  }

  function itemLocalBBox(it) {
    if (!it) return null;
    if (it.type === "stroke" && it.points?.length) {
      const xs = it.points.map((p) => p.x);
      const ys = it.points.map((p) => p.y);
      return {
        minx: Math.min(...xs),
        miny: Math.min(...ys),
        maxx: Math.max(...xs),
        maxy: Math.max(...ys),
      };
    }
    const w = it.w || (it.type === "image" ? 200 : 360);
    const h = it.h || (it.type === "image" ? 150 : 120);
    const x = it.x ?? 0;
    const y = it.y ?? 0;
    return { minx: x, miny: y, maxx: x + w, maxy: y + h };
  }

  function structureItemsBBox(structItems) {
    const boxes = (structItems || []).map(itemLocalBBox).filter(Boolean);
    if (!boxes.length) return { minx: 0, miny: 0, maxx: 0, maxy: 0 };
    return {
      minx: Math.min(...boxes.map((b) => b.minx)),
      miny: Math.min(...boxes.map((b) => b.miny)),
      maxx: Math.max(...boxes.map((b) => b.maxx)),
      maxy: Math.max(...boxes.map((b) => b.maxy)),
    };
  }

  function relativeItemsFromIds(ids, offset = { x: 0, y: 0 }) {
    if (!ids?.length) return [];
    const idSet = new Set(ids);
    const sel = itemsRef.current.filter((it) => idSet.has(it.id));
    if (!sel.length) return [];
    const bb = selectionWorldBBoxForIds(ids);
    const anchor = bb ? { x: bb.minx, y: bb.miny } : { x: 0, y: 0 };
    return sel.map((it) => {
      const base = { ...it, id: uid() };
      if (it.type === "stroke") {
        return {
          ...base,
          points: it.points.map((p) => ({
            x: p.x - anchor.x + offset.x,
            y: p.y - anchor.y + offset.y,
          })),
        };
      }
      return {
        ...base,
        x: it.x - anchor.x + offset.x,
        y: it.y - anchor.y + offset.y,
      };
    });
  }

  function mergeTitle(struct, addedItems) {
    const snippet = addedItems
      .filter((it) => it.type === "text" && it.text?.trim())
      .map((it) => it.text.trim().split("\n")[0].slice(0, 32))
      .join(" · ");
    if (!snippet) return struct.title;
    const base = (struct.title || "symbol").trim();
    if (base.includes(snippet)) return base;
    return `${base} · ${snippet}`.slice(0, 72);
  }

  function mergeMaterialIntoSymbol(structId, ids) {
    const struct = lensesRef.current.find((s) => s.id === structId);
    if (!struct) return saveMaterialAsSymbol(ids);
    const rawNew = relativeItemsFromIds(ids);
    if (!rawNew.length) {
      showToast("nothing to add");
      return null;
    }
    const existingBb = structureItemsBBox(struct.items);
    const newBb = structureItemsBBox(rawNew);
    const offset = {
      x: (existingBb.maxx || 0) + 36 - (newBb.minx || 0),
      y: (existingBb.miny || 0) - (newBb.miny || 0),
    };
    const mergedItems = relativeItemsFromIds(ids, offset);
    const nextTitle = mergeTitle(struct, mergedItems);
    setLenses((arr) =>
      arr.map((s) => {
        if (s.id !== structId) return s;
        return stampSymbolStruct({
          ...s,
          kind: "symbol",
          title: nextTitle,
          items: [...(s.items || []), ...mergedItems],
          savedAt: Date.now(),
        });
      })
    );
    focusRailPane(RAIL_LENSES);
    emitTourEvent("save-structure");
    showToast(`added to · ${nextTitle}`);
    enrichSymbolRecord(structId, { inEditor: false });
    return struct;
  }

  function addMaterialToLens(ids, opts = {}) {
    if (opts.structId) return mergeMaterialIntoSymbol(opts.structId, ids);
    return saveMaterialAsSymbol(ids, opts);
  }

  function idsFromMaterialTransfer(e) {
    const thoughtJson = e.dataTransfer.getData(THOUGHT_MIME);
    if (thoughtJson) {
      try {
        return JSON.parse(thoughtJson);
      } catch {
        /* ignore */
      }
    }
    const bundleJson = e.dataTransfer.getData(SKETCH_BUNDLE_MIME);
    if (bundleJson) {
      try {
        const bundle = JSON.parse(bundleJson);
        return [...new Set([...(bundle.itemIds || []), ...(bundle.strokeIds || [])])];
      } catch {
        /* ignore */
      }
    }
    const selJson = e.dataTransfer.getData(SEL_MIME);
    if (selJson) {
      try {
        return JSON.parse(selJson);
      } catch {
        /* ignore */
      }
    }
    return null;
  }

  function handleStructCardMaterialDrop(e, structId) {
    e.preventDefault();
    e.stopPropagation();
    setRailDropOver(false);
    setSymbolDropTargetId(null);
    setTransferDragActive(false);
    const ids = idsFromMaterialTransfer(e);
    if (!ids?.length) return;
    const hl = highlightSelectionRef.current;
    if (ids.some((id) => hl.includes(id))) finishHighlightTransfer(ids);
    addMaterialToLens(ids, { structId });
  }

  function finishHighlightTransfer(ids) {
    setHighlightTransferringIds(ids);
    window.setTimeout(() => {
      setHighlightTransferringIds([]);
      setHighlightSelectionIds((prev) => prev.filter((id) => !ids.includes(id)));
      setHighlightTouchIds([]);
    }, 920);
  }

  function saveSelectionByIds(ids, extra = {}) {
    if (!ids?.length) {
      showToast("select material to save");
      return null;
    }
    const relativeItems = relativeItemsFromIds(ids);
    if (!relativeItems.length) {
      showToast("nothing to save");
      return null;
    }
    const titleFromText = relativeItems
      .filter((it) => it.type === "text" && it.text?.trim())
      .map((it) => it.text.trim().split("\n")[0].slice(0, 48))
      .join(" · ");
    const struct = {
      id: uid(),
      title: extra.title || titleFromText || "untitled",
      kind: extra.kind || "idea",
      structNum: extra.structNum || null,
      items: relativeItems,
      symbolStroke: extra.symbolStroke || null,
      savedAt: Date.now(),
    };
    const stamped = struct.kind === "symbol" ? normalizeSymbolRecord(struct) : struct;
    setLenses((arr) => [stamped, ...arr]);
    focusRailPane(RAIL_LENSES);
    emitTourEvent("save-structure");
    if (!extra.skipToast) showToast(extra.toast || "saved lens");
    return stamped;
  }

  function openLensDrawPrompt(struct) {
    if (!struct?.id) return;
    setSymbolDrawPrompt({ structId: struct.id, title: struct.title || "idea" });
    focusRailPane(RAIL_LENSES);
    enrichSymbolRecord(struct.id, { inEditor: true });
  }

  function completeSymbolDraw(structId, symbolStroke) {
    if (!structId) return;
    setLenses((arr) =>
      arr.map((s) => {
        if (s.id !== structId) return s;
        return stampSymbolStruct({ ...s, symbolStroke: symbolStroke || null });
      })
    );
    // The overlay stays open with a "reading your symbol…" state; the drawn
    // glyph persists on the card either way.
    emitTourEvent("save-symbol");
    enrichSymbolRecord(structId, { force: true });
  }

  async function enrichSymbolRecord(structId, opts = {}) {
    const struct = lensesRef.current.find((s) => s.id === structId);
    if (!struct) return;

    const local = stampSymbolStruct(struct);
    setLenses((arr) => arr.map((s) => (s.id === structId ? { ...s, ...local } : s)));

    const inEditor = opts.inEditor ?? symbolDrawPromptRef.current?.structId === structId;
    if ((!opts.force && !inEditor) || !runClaude) return;

    setSymbolInterpretingId(structId);
    try {
      const current = lensesRef.current.find((s) => s.id === structId) || local;
      const { interpretation, viewLens } = await interpretSymbolWithLLM(current, runClaude);
      let cognitiveTransfer = null;
      try {
        cognitiveTransfer = abstractSymbolToTransfer(
          { ...current, interpretation },
          { domainLabel: current.title }
        );
      } catch {
        /* optional metadata */
      }
      setLenses((arr) =>
        arr.map((s) =>
          s.id === structId
            ? { ...s, interpretation, viewLens, cognitiveTransfer, interpretedAt: Date.now() }
            : s
        )
      );
    } catch {
      /* keep local interpretation */
    } finally {
      setSymbolInterpretingId(null);
    }
  }

  /** Persist edits from the lens settings dialog; user intent beats heuristics. */
  function saveLensSettings(structId, patch) {
    setLenses((arr) =>
      arr.map((s) => {
        if (s.id !== structId) return s;
        const interpretation = {
          ...(s.interpretation || {}),
          meaning: patch.meaning || s.interpretation?.meaning || "",
          viewPrompt: patch.viewPrompt || s.interpretation?.viewPrompt || "",
          elements: patch.elements ?? s.interpretation?.elements ?? [],
        };
        const next = { ...s, title: patch.title, customized: true, interpretation };
        return { ...next, viewLens: viewingLensTreeFromSymbol(next) };
      })
    );
    setLensSettingsId(null);
    showToast("lens updated");
  }

  function openEditLensApplyPrompt(struct) {
    if (!struct) return;
    const tree = struct.viewLens || viewingLensTreeFromSymbol(struct);
    const { ops, rootId } = treeToOperators(tree, { top: true });
    setOperators((prev) => [...prev, ...ops]);
    const root = ops.find((o) => o.id === rootId);
    openEditLens(root);
    symbolViewLensSaveRef.current = struct.id;
  }

  function handleSaveLensTree(oldRootId, newOps, opts) {
    if (symbolViewLensSaveRef.current) {
      saveSymbolViewLens(oldRootId, newOps, opts);
      return;
    }
    saveLensTree(oldRootId, newOps, opts);
  }

  function saveSymbolViewLens(oldRootId, newOps, opts = {}) {
    const structId = symbolViewLensSaveRef.current;
    const newRootId = newOps.find((o) => o.top || o.kind === "pipeline")?.id || newOps[0]?.id;
    const root = newOps.find((o) => o.id === newRootId);
    const draftMap = Object.fromEntries(newOps.map((o) => [o.id, o]));
    if (structId && root) {
      const viewLens = opToJsonTree(root, draftMap);
      setLenses((arr) =>
        arr.map((s) => (s.id === structId ? { ...s, viewLens, viewLensOpId: newRootId } : s))
      );
      symbolViewLensSaveRef.current = null;
    }
    saveLensTree(oldRootId, newOps, opts);
  }

  function saveMaterialAsSymbol(ids, extra = {}) {
    const struct = saveSelectionByIds(ids, {
      kind: "symbol",
      skipToast: true,
      ...extra,
    });
    if (!struct) return null;
    enrichSymbolRecord(struct.id, { inEditor: false });
    showToast(`saved · ${struct.title}`);
    return struct;
  }

  /** Snapshot every item on the current page into a pattern lens, then ask for a glyph. */
  function savePageAsLens() {
    const ids = itemsRef.current
      .filter((it) => itemVisibleOnPage(it, activePageId, worldFilter))
      .map((it) => it.id);
    if (!ids.length) {
      showToast("this page is empty — nothing to save yet");
      return null;
    }
    const title = (docTitle || "").trim() || "untitled page";
    const struct = saveMaterialAsSymbol(ids, { title, toast: `page saved · ${title}` });
    if (struct) setSymbolDrawPrompt({ structId: struct.id, title: struct.title });
    return struct;
  }

  function saveAiNodesAsSymbol(nodeIds, structId = null) {
    const nodes = aiNodesRef.current.filter((n) => nodeIds.includes(n.id));
    const texts = nodes
      .map((n) => n.goldenFragment || n.expandedText || n.preview || n.label || "")
      .filter((t) => t?.trim());
    if (!texts.length) {
      showToast("nothing to save as symbol");
      return null;
    }
    const content = texts.join("\n\n");
    if (structId) {
      const struct = lensesRef.current.find((s) => s.id === structId);
      if (!struct) return saveAiNodesAsSymbol(nodeIds);
      const item = normalizeItem({ type: "text", x: 0, y: 0, text: content, w: 320 });
      const existingBb = structureItemsBBox(struct.items);
      const placed = {
        ...item,
        id: uid(),
        x: (existingBb.maxx || 0) + 36,
        y: existingBb.miny || 0,
      };
      const nextTitle = mergeTitle(struct, [placed]);
      setLenses((arr) =>
        arr.map((s) => {
          if (s.id !== structId) return s;
          return stampSymbolStruct({
            ...s,
            kind: "symbol",
            title: nextTitle,
            items: [...(s.items || []), placed],
            savedAt: Date.now(),
          });
        })
      );
      focusRailPane(RAIL_LENSES);
      showToast(`added to · ${nextTitle}`);
      enrichSymbolRecord(structId, { inEditor: false });
      return struct;
    }
    const struct = stampSymbolStruct({
      id: uid(),
      title: truncatePreview(texts[0], 48) || "idea",
      kind: "symbol",
      items: [normalizeItem({ type: "text", x: 0, y: 0, text: content, w: 320 })],
      symbolStroke: null,
      savedAt: Date.now(),
    });
    setLenses((arr) => [struct, ...arr]);
    showToast(`saved · ${struct.title}`);
    emitTourEvent("save-symbol");
    enrichSymbolRecord(struct.id, { inEditor: false });
    return struct;
  }

  function applyLeftColumnMaterialDrop(ids, clientX, clientY) {
    if (!ids?.length) return;
    const dropTarget = resolveLeftColumnDropTarget(clientX, clientY);
    const structId = dropTarget === RAIL_LENSES ? structCardAtClient(clientX, clientY) : null;
    const hl = highlightSelectionRef.current;
    if (ids.some((id) => hl.includes(id))) finishHighlightTransfer(ids);
    if (dropTarget === RAIL_LENSES) addMaterialToLens(ids, { structId });
    else captureMaterialWithReplay(ids);
    launchToolboxTransfer(dropTarget);
  }

  function captureSelectionAsStructure(extra = {}) {
    return saveMaterialAsSymbol(selRef.current, extra);
  }

  function saveSelectedAsDocument() {
    const id = selRef.current.length === 1 ? selRef.current[0] : null;
    if (!id) {
      showToast("select a text idea to save");
      return null;
    }
    const item = itemsRef.current.find((it) => it.id === id);
    if (!item || item.type !== "text" || !item.text?.trim()) {
      showToast("select a text idea to save");
      return null;
    }
    const content = item.text.trim();
    const name = content.split("\n")[0].slice(0, 48);
    const struct = {
      id: uid(),
      kind: "document",
      name,
      title: name,
      content,
      createdAt: Date.now(),
      savedAt: Date.now(),
      items: [normalizeItem({ type: "text", x: 0, y: 0, text: content, w: item.w || 320 })],
    };
    setLenses((arr) => [struct, ...arr]);
    focusRailPane(RAIL_LENSES);
    showToast("Saved as document");
    return struct;
  }

  function pinOpToToolbox(opId) {
    const op = opMap[opId];
    if (!op) return;
    if (op.top && topFunctions.some((f) => f.id === opId)) {
      showToast("already in toolbox");
      return;
    }
    const tree = opToJsonTree(op, opMap);
    if (!tree) return;
    const { ops, rootId } = treeToOperators(tree, { role: op.role || null, top: true });
    const rootOp = ops.find((o) => o.id === rootId);
    setOperators((prev) => [...prev, ...ops]);
    if (rootOp) syncTransformationRepoForOperator(rootId, rootOp, { isNew: true });
    focusRailPane(RAIL_TRANSFORMATIONS);
    showToast(`saved function · ${op.name}`);
  }

  /** Merge: drop one operator onto another → a compound pipeline (A, then B). */
  function composeOperators(draggedId, targetId) {
    if (!draggedId || draggedId === targetId) return;
    const a = opMap[draggedId];
    const b = opMap[targetId];
    if (!a || !b) return;
    const tree = {
      name: `${a.name} → ${b.name}`.slice(0, 72),
      description: `Compound move: ${a.name}, then ${b.name}.`,
      steps: [opToAbstractTree(a, opMap, operators), opToAbstractTree(b, opMap, operators)],
    };
    const { ops, rootId } = treeToOperators(tree, { top: true });
    const rootOp = ops.find((o) => o.id === rootId);
    setOperators((prev) => [
      ...prev,
      ...ops.map((o) => (o.id === rootId ? { ...o, mergedFrom: [a.id, b.id] } : o)),
    ]);
    if (rootOp) syncTransformationRepoForOperator(rootId, rootOp, { isNew: true });
    focusRailPane(RAIL_TRANSFORMATIONS);
    showToast(`compound lens · ${a.name} → ${b.name}`);
  }

  function deletePatternLens(id) {
    setLenses((arr) => arr.filter((s) => s.id !== id));
  }

  function plantLens(struct, atWorld, { applyViewLens = true } = {}) {
    if (!struct?.items?.length) return;
    const center = atWorld || paperViewportCenterWorld();
    const newIds = [];
    const newItems = struct.items.map((it) => {
      const id = uid();
      newIds.push(id);
      if (it.type === "stroke") {
        return normalizeItem({
          ...it,
          id,
          points: it.points.map((p) => ({ x: p.x + center.x, y: p.y + center.y })),
        });
      }
      return normalizeItem({ ...it, id, x: it.x + center.x, y: it.y + center.y });
    });
    setItems((arr) => [...arr, ...newItems]);
    setSelection(newIds);
    showToast(`planted · ${struct.title || "symbol"}`);
    if (applyViewLens && struct.viewLens) {
      const { ops, rootId } = treeToOperators(struct.viewLens, { top: true });
      const root = ops.find((o) => o.id === rootId);
      if (root) {
        setOperators((prev) => [...prev, ...ops]);
        const textIds = newIds.filter((id) => {
          const it = newItems.find((x) => x.id === id);
          return it && (it.type === "text" || it.type === "sticky") && it.text?.trim();
        });
        if (textIds.length) runOperator(root, textIds);
      }
    }
  }

  function applyPatternLensDrop(structId, atClient) {
    const struct = lenses.find((s) => s.id === structId);
    if (!struct) return;

    const ids = resolveTargetIds(atClient);
    const at = atClient ? clientToWorld(atClient.x, atClient.y) : paperViewportCenterWorld();

    // If the drop doesn't hit an idea, fall back to planting the lens onto paper.
    if (!ids.length) {
      plantLens(struct, at);
      return;
    }

    // If dropping onto ideas, apply the lens' view transformation to those ideas.
    const viewLens = struct.viewLens;
    if (!viewLens) {
      plantLens(struct, at);
      return;
    }

    const textIds = ids.filter((id) => {
      const it = itemsRef.current.find((x) => x.id === id);
      return it && (it.type === "text" || it.type === "sticky" || it.type === "callout") && String(it.text || "").trim();
    });

    if (!textIds.length) {
      showToast("drop lens onto text ideas");
      return;
    }

    const { ops, rootId } = treeToOperators(viewLens, { top: true });
    const root = ops.find((o) => o.id === rootId);
    if (!root) return;

    setOperators((prev) => [...prev, ...ops]);
    runOperator(root, textIds, { atClient });
  }

  function startToolboxApplyDrag(e, payload) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    if (editingRef.current) finishEditing();

    const label = payload.label || "apply";
    const startX = e.clientX;
    const startY = e.clientY;
    let lastX = startX;
    let lastY = startY;

    setGesturing(true);
    document.body.classList.add("toolbox-dragging");
    setToolboxApplyGhost({ cx: startX, cy: startY, label, kind: payload.kind });
    emitTourEvent("drag-function");

    function syncDropTargets(cx, cy) {
      const env = toolboxDragEnvRef.current;
      if (env.isOverPaperColumn?.(cx, cy)) {
        setDropReady(true);
        setCanvasDropOver(true);
        const hit = env.itemAtPointForDrop?.(cx, cy);
        const sel = selRef.current;
        if (hit) setDropTargetId(hit.id);
        else if (sel.length === 1) setDropTargetId(sel[0]);
        else setDropTargetId(null);
      } else {
        setDropReady(false);
        setDropTargetId(null);
        setCanvasDropOver(false);
      }
      if (env.isOverAiColumn?.(cx, cy)) {
        setAiCanvasDropOver(true);
        setTransferDragActive(true);
      } else {
        setAiCanvasDropOver(false);
      }
    }

    function onMove(ev) {
      lastX = ev.clientX;
      lastY = ev.clientY;
      setToolboxApplyGhost({ cx: lastX, cy: lastY, label, kind: payload.kind });
      syncDropTargets(lastX, lastY);
    }

    function finish(ev) {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      setGesturing(false);
      document.body.classList.remove("toolbox-dragging");
      setToolboxApplyGhost(null);
      setDropReady(false);
      setDropTargetId(null);
      setCanvasDropOver(false);
      setAiCanvasDropOver(false);
      setTransferDragActive(false);

      const cx = ev?.clientX ?? lastX;
      const cy = ev?.clientY ?? lastY;
      const moved = Math.hypot(cx - startX, cy - startY) > TOOLBOX_DRAG_THRESHOLD;
      if (moved) toolboxDidDragRef.current = true;
      toolboxApplyCompleteRef.current(
        { payload, cx: startX, cy: startY, moved },
        cx,
        cy
      );
    }

    syncDropTargets(startX, startY);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  }

  toolboxApplyDragRef.current = startToolboxApplyDrag;

  async function runSamenessDiscovery(idsOverride = null) {
    const ids = idsOverride?.length ? idsOverride : selRef.current;
    const idSet = new Set(ids);
    const nodes = itemsRef.current.filter((it) => idSet.has(it.id) && ((it.type === "text" && it.text?.trim()) || it.type === "image"));
    if (nodes.length < 2) {
      showToast("select at least two items");
      return;
    }
    const labels = nodes.map((n) =>
      n.type === "text" ? n.text.trim() : "[image]"
    );
    const jobId = pushJob({ label: "discover sameness", kind: "sameness", status: "running", step: "starting…", startedAt: Date.now(), estimatedMs: ETA.sameness });
    try {
      patchJob(jobId, { status: "running", step: "finding shared structure" });
      const out = await runClaude(samenessPrompt(labels), "", { system: boardSystem(operators, opMap), maxTokens: 2000 });
      const parsed = parseSameness(out);
      const num = nextStructNumber();
      const title = `#${num} · ${parsed.name}`;
      const center = paperViewportCenterWorld();
      const body = `${parsed.name.toUpperCase()}\n\n${parsed.body}`;
      spawnAiOutputs([body], nodes.map((n) => n.id), { name: "sameness" });
      const struct = {
        id: uid(),
        title,
        kind: "structure",
        structNum: num,
        items: [normalizeItem({ type: "text", x: 0, y: 0, text: body, w: 420 })],
        savedAt: Date.now(),
      };
      setLenses((arr) => [struct, ...arr]);
      focusRailPane(RAIL_LENSES);
      finishJob(jobId, "done");
      showToast(`discovered · ${title}`);
    } catch (err) {
      finishJob(jobId, "error", err.message || "discovery failed");
      showToast(err.message || "discovery failed");
    }
  }

  const topFunctions = operators.filter((o) => o.top && !o.move);
  const displayTransformations = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const lens of transformationRepos) {
      const key = lensRootOpId(lens) || lens.id;
      if (key) seen.add(key);
      out.push(lens);
    }
    for (const op of topFunctions) {
      if (!seen.has(op.id)) {
        out.push({
          id: op.id,
          opId: op.id,
          name: op.name,
          moveIds: [op.id],
          version: 1,
        });
        seen.add(op.id);
      }
    }
    return out;
  }, [transformationRepos, topFunctions]);
  const canonicalPrimitives = useMemo(() => {
    const byName = Object.fromEntries(
      operators.filter((o) => o.primitive && !o.role && !o.top).map((o) => [o.name, o])
    );
    return TRANSFORM_PRIMITIVES.map((t) => byName[t.name] || t);
  }, [operators]);
  const moves = useMemo(() => operators.filter((o) => o.move && !o.primitive), [operators]);
  const primitives = useMemo(() => canonicalPrimitives, [canonicalPrimitives]);
  const basics = operators.filter((o) => !o.role && !o.top && !o.primitive);
  const activeTransformation =
    displayTransformations.find((l) => l.id === activeTransformationId || lensRootOpId(l) === activeTransformationId) || null;
  const transformationRepoGroups = useMemo(() => groupLensesByRepo(displayTransformations), [displayTransformations]);

  function renderLensCard(lens, { depth = 0 } = {}) {
    return (
      <LensCard
        key={lens.id}
        lens={lens}
        depth={depth}
        active={lens.id === activeTransformationId || lensRootOpId(lens) === activeTransformationId}
        opMap={opMap}
        lenses={displayTransformations}
        comparing={lensCompare?.aId === lens.id || (lensCompare?.bId === lens.id && !!lensCompare?.bId)}
        comparePick={lensCompare?.aId === lens.id && !lensCompare?.bId}
        onUse={() => {
          const id = lens.id;
          setActiveTransformationId(id === activeTransformationId ? null : id);
          emitTourEvent("lens-use");
        }}
        onEvolve={() => openEditLensFromLens(lens)}
        onBranch={() => setPendingBranch({ kind: "branch", sourceId: lens.id, sourceName: lens.name })}
        onFork={() => setPendingBranch({ kind: "fork", sourceId: lens.id, sourceName: lens.name })}
        onHistory={() => setLensHistoryId(lens.id)}
        onSend={() => exportLens(lens.id)}
        onCompare={() => {
          if (lensCompare?.aId && lensCompare.aId !== lens.id) setLensCompare({ aId: lensCompare.aId, bId: lens.id });
          else {
            setLensCompare({ aId: lens.id });
            showToast("pick another lens to compare");
          }
        }}
        onMergeDrop={(draggedId) => mergeLenses(draggedId, lens.id)}
        onDelete={() => deleteTransformationRecord(lens.id)}
      />
    );
  }

  /** Input material for an operator dropped onto an AI node (paper ids and/or node text). */
  function resolveAiOperatorInput(node) {
    if (!node) return { inputNode: null, ids: null, aiMaterial: null };

    const fragment = node.goldenFragment?.trim() || "";
    const expanded = node.expandedText?.trim() || "";
    const preview = node.preview?.trim() || "";
    const aiMaterial = fragment || expanded || (node.nodeKind === "source" ? "" : preview);

    // Expanded/session nodes: prefer this node's AI text over inherited paper ids.
    if (aiMaterial && node.nodeKind !== "source") {
      return { inputNode: node, ids: null, aiMaterial };
    }

    if (node.sourceIds?.length) {
      return { inputNode: node, ids: node.sourceIds, aiMaterial: null };
    }

    if (aiMaterial) {
      return { inputNode: node, ids: null, aiMaterial };
    }

    const linkId = node.parentId || node.sourceNodeIds?.[0];
    const linked = linkId ? aiNodesRef.current.find((n) => n.id === linkId) : null;
    if (linked) {
      const fromParent = resolveAiOperatorInput(linked);
      if (fromParent.inputNode) return fromParent;
    }

    return { inputNode: node, ids: null, aiMaterial: null };
  }

  function resolveExpandedDropWorld(sourceNode, dropWorld) {
    if (!dropWorld || !sourceNode) return dropWorld;
    const existing = aiNodesRef.current;
    const overlap = Math.hypot(dropWorld.x - sourceNode.x, dropWorld.y - sourceNode.y);
    const childRadius = nodePositionAt(existing, "expanded").radius || 20;
    const minSep = (sourceNode.radius || 20) + childRadius + 12;
    if (overlap < minSep * 0.9) {
      return childNodePosition(sourceNode, "expanded", existing);
    }
    return dropWorld;
  }

  function applyOperatorToAiNode(targetNode, op, atClient, extraOpts = {}) {
    const { inputNode, ids, aiMaterial } = resolveAiOperatorInput(targetNode);
    if (!inputNode) {
      showToast("drop onto a concept node");
      return;
    }
    if (!ids?.length && !aiMaterial?.trim()) {
      showToast("nothing to apply to on this node");
      return;
    }
    const world =
      extraOpts.expandedAt ??
      (atClient ? getAiDropWorldFromClient(atClient.x, atClient.y) : null);
    expandInAi(ids || [], {
      op,
      opLabel: op.name,
      sourceNode: inputNode,
      expandedAt: world,
      fromClient: atClient,
      stableCamera: true,
      aiMaterial: aiMaterial?.trim() || null,
      ...extraOpts,
    });
  }

  function applyTransformationLensToAiNode(targetNode, lens, atClient) {
    const moveOps = (lens.moveIds || []).map((id) => opMap[id]).filter(Boolean);
    if (!moveOps.length) {
      showToast("lens has no moves");
      return;
    }
    const { inputNode, ids, aiMaterial } = resolveAiOperatorInput(targetNode);
    if (!inputNode || (!ids?.length && !aiMaterial?.trim())) {
      showToast("nothing to apply to on this node");
      return;
    }
    if (moveOps.length === 1) {
      applyOperatorToAiNode(targetNode, moveOps[0], atClient, { lens });
      return;
    }
    const tree = {
      name: lens.name,
      description: `Function: ${lens.name}`,
      steps: moveOps.map((op) => opToJsonTree(op, opMap)),
    };
    const { ops, rootId } = treeToOperators(tree, { top: false });
    const compound = ops.find((o) => o.id === rootId);
    if (!compound) return;
    const mergedMap = { ...opMap, ...Object.fromEntries(ops.map((o) => [o.id, o])) };
    const world = getAiDropWorldFromClient(atClient.x, atClient.y);
    expandInAi(ids || [], {
      op: compound,
      opLabel: lens.name,
      sourceNode: inputNode,
      expandedAt: world,
      fromClient: atClient,
      stableCamera: true,
      aiMaterial: aiMaterial?.trim() || null,
      opMap: mergedMap,
      lens,
    });
  }

  function resolveNodeSourceIds(node) {
    const { inputNode, ids } = resolveAiOperatorInput(node);
    return { ids: ids?.length ? ids : null, sourceNode: inputNode || node };
  }

  function getStrandChoicesForNode(node) {
    const lensMoves = activeLens?.moveIds?.length
      ? moves.filter((m) => activeLens.moveIds.includes(m.id))
      : moves;
    return collectStrandChoices(node, aiNodesRef.current, {
      expansionPrimitives: [
        ...primitives.filter(isExpansionOperator),
        ...primitives.filter(isCompressionOperator),
      ],
      topFunctions,
      moves: lensMoves.length ? lensMoves : moves,
      exploreOnly: false,
      opMap,
    });
  }

  /** Apply a move/lens to highlighted or selected paper content. */
  function runFunctionFromRail(op) {
    if (!op) return;
    const hlIds = highlightSelectionRef.current;
    const selIds = selRef.current;
    const rawIds = hlIds.length ? hlIds : selIds;
    if (!rawIds.length) {
      showToast("select or highlight something on paper first");
      return;
    }
    const sketchBundle = gatherSelectionSketchBundle(rawIds);
    const targetIds = transformableDragIds(rawIds);
    if (!targetIds.length && sketchBundle) {
      interpretSketchBundle(sketchBundle);
      setHighlightSelectionIds([]);
      setHighlightTouchIds([]);
      return;
    }
    if (!targetIds.length) {
      showToast("this selection can't be transformed");
      return;
    }
    if (isExpansionOperator(op)) {
      expandInAi(targetIds, { op, opLabel: op.name });
    } else {
      runOperator(op, targetIds);
    }
    setHighlightSelectionIds([]);
    setHighlightTouchIds([]);
  }

  function handleStrandSelect(nodeId, choice, info = {}) {
    const node = aiNodesRef.current.find((n) => n.id === nodeId);
    if (!node || !choice) return;
    emitTourEvent("strand-select");
    handleAiNodeSelect(nodeId, { replace: true });

    const atClient = lastPointerRef.current || { x: 0, y: 0 };

    if (choice.op) {
      applyOperatorToAiNode(node, choice.op, atClient, {
        expandedAt: info.worldPos,
        stableCamera: true,
      });
      return;
    }

    if (choice.kind === "interpret") {
      const bundle = aiPanel?.sketchBundle;
      if (bundle) {
        interpretSketchBundle(bundle, info.worldPos, { fromClient: atClient });
        return;
      }
    }

    showToast("Nothing to apply for this strand");
  }

  // ---- lenses: branch, fork, merge, compare, upload — git for perception ----
  function branchLens(parentId, commitMessage = "") {
    const parent = displayTransformations.find((l) => l.id === parentId) || transformationRepos.find((l) => l.id === parentId);
    if (!parent) return;
    const now = Date.now();
    const parentOpId = lensRootOpId(parent);
    let newOpId = null;
    if (parentOpId) newOpId = duplicateOperatorSubtree(parentOpId);
    const stepNames = lensStepNames(parent, opMap);
    const commit = makeCommit(
      { message: commitMessage || `branch from ${parent.name}`, stepNames, kind: "branch" },
      uid
    );
    const lens = appendCommit(
      normalizeLens({
        id: newOpId || uid(),
        opId: newOpId || undefined,
        name: `${parent.name} · branch`.slice(0, 60),
        moveIds: newOpId ? [newOpId] : [...(parent.moveIds || [])],
        parentId,
        lineage: [...(parent.lineage || []), parentId],
        createdAt: now,
        updatedAt: now,
      }),
      commit
    );
    setTransformationRepos((ls) => [lens, ...ls]);
    setActiveTransformationId(lens.id);
    showToast(`Branched · ${lens.name}`);
  }

  function forkLens(sourceId, commitMessage = "") {
    const source = displayTransformations.find((l) => l.id === sourceId) || transformationRepos.find((l) => l.id === sourceId);
    if (!source) return;
    const now = Date.now();
    const sourceOpId = lensRootOpId(source);
    let newOpId = null;
    if (sourceOpId) newOpId = duplicateOperatorSubtree(sourceOpId);
    const stepNames = lensStepNames(source, opMap);
    const commit = makeCommit(
      { message: commitMessage || `fork from ${source.name}`, stepNames, kind: "fork" },
      uid
    );
    const lens = appendCommit(
      normalizeLens({
        id: newOpId || uid(),
        opId: newOpId || undefined,
        name: `${source.name} · fork`.slice(0, 60),
        moveIds: newOpId ? [newOpId] : [...(source.moveIds || [])],
        forkedFrom: sourceId,
        createdAt: now,
        updatedAt: now,
      }),
      commit
    );
    setTransformationRepos((ls) => [lens, ...ls]);
    setActiveTransformationId(lens.id);
    showToast(`Forked · ${lens.name}`);
  }

  function mergeLenses(aId, bId) {
    if (!aId || aId === bId) return;
    const a = transformationRepos.find((x) => x.id === aId) || displayTransformations.find((x) => x.id === aId);
    const b = transformationRepos.find((x) => x.id === bId) || displayTransformations.find((x) => x.id === bId);
    if (!a || !b) return;
    const now = Date.now();
    const aOpId = lensRootOpId(a);
    const bOpId = lensRootOpId(b);
    let lensId = uid();
    let moveIds = [...new Set([...(a.moveIds || []), ...(b.moveIds || [])])];
    let newOpId = null;
    let stepNames = [...lensStepNames(a, opMap), ...lensStepNames(b, opMap)];

    if (aOpId && bOpId && opMap[aOpId] && opMap[bOpId]) {
      const tree = {
        name: `${a.name} ⚭ ${b.name}`.slice(0, 72),
        description: `Merged pipeline: ${a.name}, then ${b.name}.`,
        steps: [opToAbstractTree(opMap[aOpId], opMap, operators), opToAbstractTree(opMap[bOpId], opMap, operators)],
      };
      const { ops, rootId } = treeToOperators(tree, { top: true });
      newOpId = rootId;
      lensId = rootId;
      moveIds = [rootId];
      const mergedMap = Object.fromEntries(ops.map((o) => [o.id, o]));
      stepNames = collectPipelineStepNames(rootId, mergedMap);
      setOperators((prev) => [
        ...prev,
        ...ops.map((o) => (o.id === rootId ? { ...o, mergedFrom: [aOpId, bOpId] } : o)),
      ]);
    }

    const commit = makeCommit(
      { message: `merge ${a.name} + ${b.name}`, stepNames, kind: "merge" },
      uid
    );
    const lens = appendCommit(
      normalizeLens({
        id: lensId,
        opId: newOpId || undefined,
        name: `${a.name} ⚭ ${b.name}`.slice(0, 60),
        moveIds,
        mergedFrom: [a.id, b.id],
        createdAt: now,
        updatedAt: now,
      }),
      commit
    );
    setTransformationRepos((ls) => [lens, ...ls]);
    setActiveTransformationId(lens.id);
    showToast(`Merged · ${lens.name}`);
  }

  function deleteTransformationRecord(id) {
    const lens = transformationRepos.find((l) => l.id === id) || displayTransformations.find((l) => l.id === id);
    const opId = lensRootOpId(lens);
    if (opId) {
      deleteLens(opId, { skipLensRemove: true });
    }
    setTransformationRepos((ls) => ls.filter((l) => l.id !== id));
    if (activeTransformationId === id || activeTransformationId === opId) setActiveTransformationId(null);
    setLensCompare(null);
  }

  /** Share a lens: copy a link so anyone can upload it. */
  function exportLens(id) {
    shareLensLink(id);
  }

  function importLensData(data, opts = {}) {
    const payload = data.lens || data;
    const name = payload.name || data.name || "uploaded lens";
    const opTrees = payload.opTrees || data.opTrees;
    if (!Array.isArray(opTrees) || !opTrees.length) throw new Error("not a lens");
    const moveIds = [];
    const newOps = [];
    for (const tree of opTrees) {
      const existing = operators.find((o) => o.name === tree.name && !o.top);
      if (existing && !tree.steps) {
        moveIds.push(existing.id);
        continue;
      }
      const { ops, rootId } = treeToOperators(tree, { top: !!tree.steps });
      newOps.push(...ops);
      moveIds.push(rootId);
    }
    if (newOps.length) setOperators((prev) => [...prev, ...newOps]);
    const now = Date.now();
    const lens = normalizeLens({
      id: uid(),
      name,
      moveIds,
      version: payload.version || data.version || 1,
      parentName: payload.parentName || null,
      forkedFromName: payload.forkedFromName || null,
      mergedFromNames: payload.mergedFromNames || null,
      cognitiveTransfer: payload.cognitiveTransfer || data.cognitiveTransfer || extractCognitiveMeta({ meta: data.meta || payload }) || null,
      uploaded: true,
      createdAt: now,
      updatedAt: now,
    });
    setTransformationRepos((ls) => [lens, ...ls]);
    setActiveTransformationId(lens.id);
    focusRailPane(RAIL_TRANSFORMATIONS);
    if (!opts.silent) showToast(`Uploaded · ${lens.name} — now looking through it`);
  }

  function importLens(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (data?.kind !== "lens-lens" && data?.kind !== "lens") throw new Error("not a lens");
        importLensData(data);
      } catch {
        showToast("could not read that lens file");
      }
    };
    reader.readAsText(file);
  }

  function importOperatorTree(tree, opts = {}) {
    if (!tree) throw new Error("missing operator");
    const existing = operators.find((o) => o.name === tree.name && !o.top && !tree.steps);
    if (existing && !opts.forceNew) {
      focusRailPane(RAIL_TRANSFORMATIONS);
      showToast(`already have · ${existing.name}`);
      return existing.id;
    }
    const { ops, rootId } = treeToOperators(tree, { top: true, ...opts });
    const cognitiveTransfer = opts.cognitiveTransfer || null;
    const opsWithMeta = cognitiveTransfer
      ? ops.map((o) =>
          o.id === rootId
            ? { ...o, captureMeta: { ...(o.captureMeta || {}), cognitiveTransfer } }
            : o
        )
      : ops;
    setOperators((prev) => [...prev, ...opsWithMeta]);
    focusRailPane(RAIL_TRANSFORMATIONS);
    showToast(opts.toast || `added · ${tree.name}`);
    return rootId;
  }

  function importPathItems(data, opts = {}) {
    const items = data.items || data.path?.items;
    const nodeId = data.nodeId || data.path?.nodeId;
    if (!Array.isArray(items) || !items.length) throw new Error("not a path");
    const idMap = {};
    for (const it of items) idMap[it.id] = uid();
    const notes = items.filter((it) => it.type !== "link" && it.type !== "stroke");
    const cx = notes.length ? notes.reduce((s, it) => s + (it.x || 0), 0) / notes.length : 0;
    const cy = notes.length ? notes.reduce((s, it) => s + (it.y || 0), 0) / notes.length : 0;
    const center = paperViewportCenterWorld();
    const dx = center.x - cx;
    const dy = center.y - cy;
    const newItems = items.map((it) => {
      const base = { ...it, id: idMap[it.id] };
      if (it.type === "link") {
        return normalizeItem({ ...base, fromId: idMap[it.fromId] || it.fromId, toId: idMap[it.toId] || it.toId });
      }
      if (it.bornFrom) base.bornFrom = it.bornFrom.map((pid) => idMap[pid] || pid);
      if (it.type === "stroke") {
        return normalizeItem({ ...base, points: (it.points || []).map((p) => ({ x: p.x + dx, y: p.y + dy })) });
      }
      return normalizeItem({ ...base, x: (it.x || 0) + dx, y: (it.y || 0) + dy });
    });
    pushHistoryRef.current();
    setItems((arr) => [...arr, ...newItems]);
    const terminal = idMap[nodeId];
    if (!opts.silent) showToast("path received — walking it");
    setTimeout(() => terminal && walkNode(terminal), 80);
  }

  function importJourneyBundle(journey, opts = {}) {
    if (!journey?.steps?.length) throw new Error("empty journey");
    const newOps = [];
    for (const tree of journey.opTrees || []) {
      try {
        const { ops } = treeToOperators(tree, { top: true, captured: true });
        newOps.push(...ops);
      } catch {
        /* skip bad trees */
      }
    }
    if (newOps.length) setOperators((prev) => [...prev, ...newOps]);
    const steps = journey.steps.map((s, i) => ({
      id: uid(),
      itemIds: [],
      focusId: null,
      caption: s.caption || s.via?.name ? `through “${s.via.name}”` : `step ${i + 1}`,
      arrived: !!s.arrived || i === journey.steps.length - 1,
      preview: s.focusPreview || null,
    }));
    finishEditing();
    setSelection([]);
    setWalking({ nodeId: null, title: journey.title || "shared journey", steps, stepIndex: 0, imported: true });
    focusRailPane(RAIL_TRANSFORMATIONS);
    if (!opts.silent) showToast("journey imported — walking it");
  }

  function importShareBundle(bundle, opts = {}) {
    const fromWelcome = !!opts.fromWelcome;
    try {
      switch (bundle.kind) {
        case "operator":
          importOperatorTree(bundle.operators[0], {
            toast: fromWelcome ? "Added to transformations" : undefined,
            cognitiveTransfer: extractCognitiveMeta(bundle),
          });
          break;
        case "lens":
          importLensData(bundle.lens, { silent: fromWelcome });
          if (fromWelcome) showToast("Added to transformations");
          break;
        case "symbol": {
          const raw = bundle.symbols[0];
          const cognitiveTransfer = raw.cognitiveTransfer || extractCognitiveMeta(bundle) || null;
          const struct = {
            id: uid(),
            title: raw.title || bundle.meta?.name || "shared structure",
            kind: raw.kind || "idea",
            structNum: raw.structNum || null,
            items: raw.items,
            savedAt: Date.now(),
            shared: true,
            cognitiveTransfer,
          };
          setLenses((arr) => [struct, ...arr]);
          focusRailPane(RAIL_LENSES);
          showToast(fromWelcome ? "Added to lenses" : `lens received · ${struct.title}`);
          break;
        }
        case "journey":
          importJourneyBundle(bundle.journey, { silent: fromWelcome });
          if (fromWelcome) showToast("Added to transformations");
          break;
        case "path":
          importPathItems(bundle.path, { silent: fromWelcome });
          if (fromWelcome) showToast(`Added to ${shareDestinationLabel(bundle)}`);
          break;
        default:
          showToast("unknown share type");
      }
    } catch {
      showToast("could not import share link");
    }
  }

  function acceptPendingShare() {
    const bundle = pendingShareBundle;
    setPendingShareBundle(null);
    setRailPulse(true);
    setTimeout(() => setRailPulse(false), 1400);
    if (bundle) importShareBundle(bundle, { fromWelcome: true });
  }

  function dismissPendingShare() {
    setPendingShareBundle(null);
  }

  async function copyShareLink(bundle) {
    let url = buildShareUrl(bundle, window.location.origin, window.location.pathname).url;
    try {
      if (url.includes("#share=")) {
        const res = await fetch("/api/share", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bundle }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.url) url = data.url;
        }
      }
    } catch {
      /* offline — hash URL still works */
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    if (navigator.share) {
      try {
        await navigator.share({ title: bundle.meta?.name || "lens", url });
        showToast("shared");
        return;
      } catch {
        /* cancelled */
      }
    }
    showToast("Link copied");
  }

  function shareOperator(opId) {
    const op = opMap[opId];
    if (!op) return;
    const { opTree, cognitiveTransfer } = portableExportTree(op, opMap, operators, { name: op.name });
    copyShareLink(createOperatorBundle(opTree, { name: op.name, cognitiveTransfer }));
  }

  function shareLensLink(id) {
    const l = transformationRepos.find((x) => x.id === id);
    if (!l) return;
    const opTrees = [];
    let cognitiveTransfer = null;
    for (const oid of l.moveIds || []) {
      const op = opMap[oid];
      if (!op) continue;
      const exported = portableExportTree(op, opMap, operators, { name: l.name, kind: "lens" });
      opTrees.push(exported.opTree);
      cognitiveTransfer = exported.cognitiveTransfer;
    }
    if (!opTrees.length && l.opId && opMap[l.opId]) {
      const exported = portableExportTree(opMap[l.opId], opMap, operators, { name: l.name, kind: "lens" });
      opTrees.push(exported.opTree);
      cognitiveTransfer = exported.cognitiveTransfer;
    }
    const parent = l.parentId ? transformationRepos.find((x) => x.id === l.parentId) : null;
    const forked = l.forkedFrom ? transformationRepos.find((x) => x.id === l.forkedFrom) : null;
    const mergedFromNames =
      l.mergedFrom?.length === 2
        ? l.mergedFrom.map((mid) => transformationRepos.find((x) => x.id === mid)?.name).filter(Boolean)
        : l.mergedFromNames || null;
    copyShareLink(
      createLensShareBundle(l.name, opTrees, {
        name: l.name,
        version: l.version || 1,
        parentName: parent?.name || l.parentName || undefined,
        forkedFromName: forked?.name || l.forkedFromName || undefined,
        mergedFromNames: mergedFromNames?.length === 2 ? mergedFromNames : undefined,
        cognitiveTransfer,
      })
    );
  }

  function sharePatternLens(struct) {
    if (!struct) return;
    const cognitiveTransfer = abstractSymbolToTransfer(struct, { domainLabel: struct.title });
    copyShareLink(createSymbolBundle(struct, { name: struct.title, cognitiveTransfer }));
  }

  function shareJourneyLink(nodeId, { fullPath = false } = {}) {
    const journey = buildNodeJourney(nodeId);
    if (!journey) return;
    if (fullPath) {
      const seen = new Set(journey.steps.map((s) => s.focusId));
      const lineageItems = itemsRef.current.filter(
        (it) =>
          seen.has(it.id) ||
          (it.type === "link" && seen.has(it.fromId) && seen.has(it.toId))
      );
      copyShareLink(
        createPathBundle(nodeId, lineageItems, { name: journey.title })
      );
      return;
    }
    const info = getNodeThreadCapture(nodeId);
    const steps = journey.steps.map((s) => {
      const it = itemsRef.current.find((i) => i.id === s.focusId);
      return {
        caption: s.caption,
        via: it?.via || null,
        focusPreview: (it?.text || "").trim().split("\n")[0].slice(0, 80) || null,
        arrived: s.arrived,
      };
    });
    const opTrees = (info.vias || []).map((via) => abstractStepFromVia(via, opMap, operators));
    const cognitiveTransfer = abstractJourneyToTransfer({
      title: journey.title,
      opTrees,
      captureMeta: info.captureMeta,
      opMap,
      operators,
    });
    copyShareLink(
      createJourneyBundle({
        title: journey.title,
        steps,
        opTrees,
        captureMeta: info.captureMeta,
        cognitiveTransfer,
        meta: { name: journey.title },
      })
    );
  }


  function itemScreenBBox(it) {
    if (it.type === "stroke") {
      const xs = it.points.map((p) => worldToClient(p.x, p.y).x);
      const ys = it.points.map((p) => worldToClient(p.x, p.y).y);
      return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
    }
    const el = document.querySelector(`[data-item="${it.id}"]`);
    if (!el) {
      const p = worldToClient(it.x, it.y);
      return { left: p.x, top: p.y, right: p.x + 10, bottom: p.y + 10 };
    }
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  }

  /** Soft landing pulse on new nodes — camera stays put. */
  function launchPaperToAiTransfer({ nodeIds = [] }) {
    if (!nodeIds.length) return;
    setAiLandingNodeIds((prev) => {
      const next = new Set(prev);
      nodeIds.forEach((id) => next.add(id));
      return next;
    });
    window.setTimeout(() => {
      setAiLandingNodeIds((prev) => {
        const next = new Set(prev);
        nodeIds.forEach((id) => next.delete(id));
        return next;
      });
    }, 620);
  }

  function markGrowingAiEdge(fromId, toId) {
    if (!fromId || !toId) return;
    const edgeId = `${fromId}-${toId}`;
    setGrowingAiEdgeIds((prev) => new Set([...prev, edgeId]));
    window.setTimeout(() => {
      setGrowingAiEdgeIds((prev) => {
        if (!prev.has(edgeId)) return prev;
        const next = new Set(prev);
        next.delete(edgeId);
        return next;
      });
    }, 560);
  }

  /** Pick a visible AI world point aligned with a paper drop (left territory, same row). */
  function aiPlacementFromPaperClient(atClient) {
    const el = aiViewportRef.current;
    if (!el) return getAiDropWorldFromClient(atClient.x, atClient.y);
    const rect = el.getBoundingClientRect();
    const sx = Math.min(rect.width * 0.28, 140);
    const sy = Math.min(rect.height - 72, Math.max(72, atClient.y - rect.top));
    return screenToWorld(aiCamRef.current, sx, sy);
  }

  function startIdeaToAiOrbAnimation({ startClient, endWorld, label, onComplete }) {
    const el = aiViewportRef.current;
    if (!el || !startClient) {
      onComplete?.();
      return;
    }
    const rect = el.getBoundingClientRect();
    const endScreen = worldToScreen(aiCamRef.current, endWorld.x, endWorld.y);
    const endX = rect.left + endScreen.x;
    const endY = rect.top + endScreen.y;
    const startX = startClient.x;
    const startY = startClient.y;
    const flight = { startX, startY, endX, endY, label: label || "expand", cx: startX, cy: startY };
    setIdeaOrbFlight(flight);
    const t0 = performance.now();
    const duration = 700;
    function tick(now) {
      const t = Math.min(1, (now - t0) / duration);
      const eased = t * t * (3 - 2 * t);
      setIdeaOrbFlight({
        ...flight,
        cx: startX + (endX - startX) * eased,
        cy: startY + (endY - startY) * eased,
      });
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        setIdeaOrbFlight(null);
        onComplete?.();
      }
    }
    requestAnimationFrame(tick);
  }

  function presentCognitiveBridge(ids, atClient, run, { label, endWorld } = {}) {
    if (!atClient || !isOverPaperColumn(atClient.x, atClient.y)) {
      run();
      return;
    }
    const targetWorld = endWorld || aiPlacementFromPaperClient(atClient);
    startIdeaToAiOrbAnimation({
      startClient: atClient,
      endWorld: targetWorld,
      label,
      onComplete: () =>
        run({
          expandedAt: targetWorld,
          stableCamera: true,
          fromClient: atClient,
        }),
    });
  }

  function pointInExpandedRect(cx, cy, bb, pad) {
    return cx >= bb.left - pad && cx <= bb.right + pad && cy >= bb.top - pad && cy <= bb.bottom + pad;
  }

  function distToRect(cx, cy, bb) {
    const dx = Math.max(bb.left - cx, 0, cx - bb.right);
    const dy = Math.max(bb.top - cy, 0, cy - bb.bottom);
    return Math.hypot(dx, dy);
  }

  /** For drag-drop: expanded hit targets + nearest-item snap (easier than precise aim). */
  function itemAtPointForDrop(cx, cy) {
    const exact = itemAtPoint(cx, cy);
    if (exact && exact.type !== "link") return exact;

    const list = itemsRef.current;
    const isDropTarget = (it) =>
      it.type === "text" || it.type === "image" || it.type === "sticky" || it.type === "callout";

    for (let i = list.length - 1; i >= 0; i--) {
      const it = list[i];
      if (!itemVisibleOnPage(it, pageFilterRef.current.pageId, pageFilterRef.current.world)) continue;
      if (!isDropTarget(it)) continue;
      const bb = itemScreenBBox(it);
      if (pointInExpandedRect(cx, cy, bb, DROP_TARGET_PAD)) return it;
    }

    for (let i = list.length - 1; i >= 0; i--) {
      const it = list[i];
      if (!itemVisibleOnPage(it, pageFilterRef.current.pageId, pageFilterRef.current.world)) continue;
      if (it.type !== "stroke") continue;
      const bb = itemScreenBBox(it);
      if (pointInExpandedRect(cx, cy, bb, DROP_TARGET_PAD * 0.6)) return it;
      for (let k = 1; k < it.points.length; k++) {
        const a = worldToClient(it.points[k - 1].x, it.points[k - 1].y);
        const b = worldToClient(it.points[k].x, it.points[k].y);
        if (distToSeg(cx, cy, a.x, a.y, b.x, b.y) <= Math.max(16, it.width * camRef.current.scale * 1.2)) return it;
      }
    }

    let best = null;
    let bestDist = DROP_TARGET_PAD * 1.25;
    for (let i = list.length - 1; i >= 0; i--) {
      const it = list[i];
      if (!itemVisibleOnPage(it, pageFilterRef.current.pageId, pageFilterRef.current.world)) continue;
      if (!isDropTarget(it)) continue;
      const d = distToRect(cx, cy, itemScreenBBox(it));
      if (d < bestDist) {
        bestDist = d;
        best = it;
      }
    }
    return best;
  }

  function targetIdsFromItem(it) {
    if (!it) return [];
    if (it.groupId) {
      return itemsRef.current.filter((i) => i.groupId === it.groupId).map((i) => i.id);
    }
    return [it.id];
  }

  function selectedAtPoint(cx, cy) {
    const sel = selRef.current;
    if (!sel.length || toolRef.current !== "select" || editingRef.current) return null;
    const PAD = 8;
    let minL = Infinity;
    let minT = Infinity;
    let maxR = -Infinity;
    let maxB = -Infinity;
    let count = 0;
    const { pageId, world } = pageFilterRef.current;
    for (const id of sel) {
      const it = itemsRef.current.find((i) => i.id === id);
      if (!it || !itemVisibleOnPage(it, pageId, world)) continue;
      const bb = itemScreenBBox(it);
      minL = Math.min(minL, bb.left);
      minT = Math.min(minT, bb.top);
      maxR = Math.max(maxR, bb.right);
      maxB = Math.max(maxB, bb.bottom);
      count++;
    }
    if (!count) return null;
    if (cx >= minL - PAD && cx <= maxR + PAD && cy >= minT - PAD && cy <= maxB + PAD) return sel;
    return null;
  }

  function itemAtPoint(cx, cy, excludeIds = null) {
    const { pageId, world } = pageFilterRef.current;
    const list = itemsRef.current;
    for (let i = list.length - 1; i >= 0; i--) {
      const it = list[i];
      if (it.type === "link") continue;
      if (!itemVisibleOnPage(it, pageId, world)) continue;
      if (excludeIds?.has(it.id)) continue;
      if (it.type === "stroke") {
        for (let k = 1; k < it.points.length; k++) {
          const a = worldToClient(it.points[k - 1].x, it.points[k - 1].y);
          const b = worldToClient(it.points[k].x, it.points[k].y);
          if (distToSeg(cx, cy, a.x, a.y, b.x, b.y) <= Math.max(8, it.width * camRef.current.scale * 0.7)) return it;
        }
      } else {
        const bb = itemScreenBBox(it);
        if (cx >= bb.left && cx <= bb.right && cy >= bb.top && cy <= bb.bottom) return it;
      }
    }
    return null;
  }

  function textClickRegion(it, cx, cy) {
    const bb = itemScreenBBox(it);
    const m = 10;
    if (cx < bb.left + m || cx > bb.right - m || cy < bb.top + m || cy > bb.bottom - m) return "border";
    return "interior";
  }

  function resolveTargetIds(atClient) {
    const sel = selRef.current;
    if (!atClient) return sel.length ? sel : [];

    const hit = itemAtPointForDrop(atClient.x, atClient.y);
    if (hit) {
      const ids = targetIdsFromItem(hit);
      if (sel.length > 1 && ids.some((id) => sel.includes(id))) return sel;
      return ids;
    }

    // Near miss: if something is selected, apply to selection without pixel-perfect aim
    if (sel.length) return sel;
    return [];
  }

  function itemWorldBBoxMeasured(it) {
    const el = document.querySelector(`[data-item="${it.id}"]`);
    if (el) {
      const r = el.getBoundingClientRect();
      const tl = clientToWorld(r.left, r.top);
      const br = clientToWorld(r.right, r.bottom);
      return {
        minx: Math.min(tl.x, br.x),
        miny: Math.min(tl.y, br.y),
        maxx: Math.max(tl.x, br.x),
        maxy: Math.max(tl.y, br.y),
      };
    }
    return itemWorldBBox(it);
  }

  function selectionWorldBBoxForIds(itemIds) {
    const ids = new Set(itemIds || []);
    const sel = itemsRef.current.filter((it) => ids.has(it.id));
    if (!sel.length) return null;
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (const it of sel) {
      const bb = itemWorldBBoxMeasured(it);
      if (!bb) continue;
      minx = Math.min(minx, bb.minx);
      miny = Math.min(miny, bb.miny);
      maxx = Math.max(maxx, bb.maxx);
      maxy = Math.max(maxy, bb.maxy);
    }
    if (!Number.isFinite(minx)) return null;
    return { minx, miny, maxx, maxy };
  }

  function selectionWorldBBox() {
    return selectionWorldBBoxForIds(selRef.current);
  }

  function eraseAtPointer(cx, cy) {
    const hits = highlightErasureHits(
      itemsRef.current,
      cx,
      cy,
      null,
      null,
      camRef.current.scale,
      worldToClient,
      null
    );
    for (const it of itemsRef.current) {
      if (it.type !== "text") continue;
      const bb = clientBoundsForItem(it, worldToClient);
      if (!bb) continue;
      const pad = Math.max(5, HIGHLIGHT_W * camRef.current.scale * 0.38);
      if (cx >= bb.left - pad && cx <= bb.right + pad && cy >= bb.top - pad && cy <= bb.bottom + pad) {
        hits.push(it.id);
      }
    }
    const uniq = [...new Set(hits)];
    if (!uniq.length) return false;
    pushHistory();
    setItems((arr) => arr.filter((it) => !uniq.includes(it.id)));
    setHighlight((hl) => (hl && uniq.includes(hl.itemId) ? null : hl));
    setSelection((sel) => sel.filter((id) => !uniq.includes(id)));
    return true;
  }
  eraseAtPointerRef.current = eraseAtPointer;

  function finishRecordedStroke(g, pts, itemAttrs) {
    const rec = paperSessionRef.current;
    let points = pts;
    if (rec?.recording && g.strokeId) {
      const committed = rec.commitStroke();
      if (committed?.points?.length) points = committed.points;
    }
    const strokeId = g.strokeId || uid();
    paperStrokeIdRef.current = null;
    const tags = recordingItemTags(rec);
    return { id: strokeId, type: "stroke", points, pageId: activePageId, ...itemAttrs, ...tags };
  }

  function tagRecordingItem(item) {
    const rec = paperSessionRef.current;
    const tags = recordingItemTags(rec);
    if (!tags.paperSessionId) return item;
    registerRecordingItem(rec, item.id);
    return { ...item, ...tags };
  }

  function gatherSelectionSketchBundle(selectedIds) {
    const page = pages.find((p) => p.id === activePageId);
    const pageItems = itemsRef.current.filter(
      (it) => (it.pageId || DEFAULT_PAGE_ID) === activePageId && isPaperSideItem(it)
    );
    return gatherSketchBundle({
      selectedIds,
      pageItems,
      sessions: page?.sessions || [],
      liveSession: paperSessionRef.current?.recording ? paperSessionRef.current : null,
    });
  }

  async function togglePaperRecord() {
    if (paperRecording && paperSessionRef.current) {
      try {
        const session = await paperSessionRef.current.stop();
        setPaperRecording(false);
        setPaperRecordLevel(0);
        setPaperRecordMs(0);
        paperSessionRef.current = null;
        setPages((ps) =>
          ps.map((p) =>
            p.id === activePageId
              ? { ...p, sessions: [...(p.sessions || []), session] }
              : p
          )
        );
        const sessionPatch = buildItemSessionPatch(session);
        const annotMap = new Map();
        for (const a of session.annotations || []) {
          for (const sid of a.strokeIds || []) {
            annotMap.set(sid, {
              voiceSegmentIds: [a.voiceSegmentIndex],
            });
          }
        }
        const sessionItemIds = new Set([
          ...(session.itemIds || []),
          ...itemsRef.current
            .filter((it) => it.recordingSessionId === session.id || it.paperSessionId === session.id)
            .map((it) => it.id),
        ]);
        session.itemIds = [...sessionItemIds];
        setItems((arr) =>
          arr.map((it) => {
            if (!sessionItemIds.has(it.id)) return it;
            const next = { ...it, ...sessionPatch };
            if (annotMap.has(it.id)) Object.assign(next, annotMap.get(it.id));
            delete next.recordingSessionId;
            return next;
          })
        );
        showToast(
          session.transcript
            ? `session saved · "${session.transcript.slice(0, 48)}…"`
            : "voice + draw session saved"
        );
        emitTourEvent("voice-stopped");
        for (const sid of sessionItemIds) {
          recordItemEvent(sid, "voice-session", {
            sessionId: session.id,
            transcript: truncatePreview(session.transcript, 160),
          });
        }
      } catch (err) {
        showToast(err.message || "could not stop recording");
      }
      return;
    }
    const session = new PaperRecordSession();
    try {
      await session.start({
        onWaveform: (level) => setPaperRecordLevel(level),
      });
      paperSessionRef.current = session;
      setPaperRecording(true);
      setPaperRecordMs(0);
      emitTourEvent("voice-started");
      showToast("recording");
    } catch (err) {
      showToast(err.message || "microphone unavailable");
    }
  }

  async function interpretSketchBundle(bundle, worldPos = null, opts = {}) {
    if (!bundle) {
      showToast("nothing to interpret");
      return;
    }
    const pageItems = itemsRef.current.filter(
      (it) => (it.pageId || DEFAULT_PAGE_ID) === activePageId && isPaperSideItem(it)
    );
    const bundleItems = pageItems.filter(
      (it) => bundle.strokeIds?.includes(it.id) || bundle.itemIds?.includes(it.id)
    );
    const session = bundleAsSession(bundle);
    const prompt = buildSketchBundlePrompt(bundle, bundleItems.length ? bundleItems : pageItems);
    const image = await compositePaperSnapshot(
      bundleItems.length ? bundleItems : pageItems.filter((it) => it.type === "stroke" || it.type === "image")
    );
    const label = bundleLabel(bundle);
    const { sessionNode, expandedNode } = createSessionNodes(
      { ...session, transcript: bundle.transcript || session?.transcript },
      prompt,
      worldPos,
      label
    );
    const bundleSourceIds = [...new Set([...(bundle.strokeIds || []), ...(bundle.itemIds || [])])];
    recordItemEvents(bundleSourceIds, "transfer-to-ai", {
      aiNodeId: expandedNode.id,
      inputPreview: truncatePreview(bundle.transcript || label, 120),
    });
    launchPaperToAiTransfer({
      nodeIds: [sessionNode.id, expandedNode.id],
      focusWorld: worldPos || undefined,
    });
    setAiPanel({
      sourceIds: [...(bundle.strokeIds || []), ...(bundle.itemIds || [])],
      sourcePreview: bundle.transcript?.slice(0, 200) || label,
      sourceText: prompt,
      image,
      loading: true,
      error: null,
      opLabel: "interpret paper",
      activeNodeId: expandedNode.id,
      sketchBundle: bundle,
    });
    try {
      const out = await runClaude(
        "Interpret this multimodal notebook bundle. Voice explains what the user drew and placed spatially.",
        prompt,
        { image, maxTokens: 2048, compact: true }
      );
      const text = out.trim();
      updateAiNode(expandedNode.id, {
        expandedText: text,
        loading: false,
        error: null,
        label: truncateLabel(text, 12),
      });
      setAiPanel((prev) => ({
        ...prev,
        expandedText: text,
        loading: false,
        error: null,
      }));
    } catch (err) {
      updateAiNode(expandedNode.id, {
        loading: false,
        error: err.message || "interpret failed",
      });
      setAiPanel((prev) => ({
        ...prev,
        loading: false,
        error: err.message || "interpret failed",
      }));
      showToast(err.message || "interpret failed");
    }
  }

  async function interpretPaperSession(sessionOverride = null, worldPos = null) {
    const page = pages.find((p) => p.id === activePageId);
    const sessions = page?.sessions || [];
    const latest = sessionOverride || sessions[sessions.length - 1];
    if (!latest) {
      showToast("record a voice + draw session first");
      return;
    }
    const pageItems = itemsRef.current.filter(
      (it) => (it.pageId || DEFAULT_PAGE_ID) === activePageId && isPaperSideItem(it)
    );
    const prompt = buildPaperInterpretPrompt(latest, pageItems);
    const image = await compositePaperSnapshot(pageItems);
    const { expandedNode } = createSessionNodes(latest, prompt, worldPos);
    setAiPanel({
      sourceIds: [],
      sourcePreview: latest.transcript?.slice(0, 200) || "Paper session",
      sourceText: prompt,
      image,
      loading: true,
      error: null,
      opLabel: "interpret paper",
      activeNodeId: expandedNode.id,
    });
    try {
      const out = await runClaude(
        "Interpret this multimodal notebook page. The user's voice explains what their drawings mean spatially.",
        prompt,
        { image, maxTokens: 2048, compact: true }
      );
      const text = out.trim();
      updateAiNode(expandedNode.id, {
        expandedText: text,
        loading: false,
        error: null,
        label: truncateLabel(text, 12),
      });
      setAiPanel((prev) => ({
        ...prev,
        expandedText: text,
        loading: false,
        error: null,
      }));
    } catch (err) {
      updateAiNode(expandedNode.id, {
        loading: false,
        error: err.message || "interpret failed",
      });
      setAiPanel((prev) => ({
        ...prev,
        loading: false,
        error: err.message || "interpret failed",
      }));
      showToast(err.message || "interpret failed");
    }
  }

  async function compositePaperSnapshot(pageItems) {
    const visuals = pageItems.filter((it) => it.type === "stroke" || it.type === "image");
    if (!visuals.length) return null;
    const canvas = document.createElement("canvas");
    canvas.width = PAPER_WIDTH;
    canvas.height = PAPER_HEIGHT;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, PAPER_WIDTH, PAPER_HEIGHT);
    for (const it of visuals) {
      if (it.type === "stroke" && it.points?.length > 1) {
        ctx.beginPath();
        ctx.moveTo(it.points[0].x, it.points[0].y);
        for (let i = 1; i < it.points.length; i++) ctx.lineTo(it.points[i].x, it.points[i].y);
        ctx.strokeStyle = it.highlight ? HIGHLIGHT_INK : it.color || INK;
        ctx.lineWidth = it.width || PEN_W;
        ctx.globalAlpha = it.marker ? 0.35 : 0.9;
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (it.type === "image" && it.src) {
        try {
          const img = await loadImage(it.src);
          ctx.drawImage(img, it.x, it.y, it.w, it.h);
        } catch {
          /* skip */
        }
      }
    }
    return canvas.toDataURL("image/jpeg", 0.82);
  }

  function startDrawStroke(w, attrs) {
    let strokeId = null;
    const rec = paperSessionRef.current;
    if (rec?.recording) {
      strokeId = rec.beginStroke({ id: uid(), ...attrs });
      rec.addPoint(w.x, w.y);
    }
    return strokeId;
  }

  // ---- pointer gestures on the board ----
  function onPointerDown(e) {
    if (e.button === 1) {
      e.preventDefault();
      setGesturing(true);
      setPanning(true);
      gesture.current = { mode: "pan", cx: e.clientX, cy: e.clientY, cam: { ...camRef.current } };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      return;
    }
    if (e.button !== 0) return;
    setGesturing(true);
    const cx = e.clientX;
    const cy = e.clientY;
    lastPointerRef.current = { cx, cy };
    const t = toolRef.current;

    const w = clientToWorld(cx, cy);
    const lp = vpLocal(cx, cy);
    let hit = itemAtPoint(cx, cy);

    if (e.shiftKey && toolRef.current === "select") {
      const paperSel = selRef.current;
      if (paperSel.length > 0) {
        startPendingSpaceTransfer(e, "paper", paperSel);
        return;
      }
      const hlIds = highlightSelectionRef.current;
      if (hlIds.length > 0) {
        startPendingSpaceTransfer(e, "paper", hlIds, { kind: "highlight" });
        return;
      }
    }

    if (e.altKey) {
      setPanning(true);
      gesture.current = { mode: "pan", cx, cy, cam: { ...camRef.current } };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      return;
    }

    if (editingRef.current) {
      if (hit?.id === editingRef.current) {
        if (isEditableBlock(hit) && textClickRegion(hit, cx, cy) === "interior") {
          gesture.current = { mode: "edit-click", cx, cy, hitId: hit.id };
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
          return;
        }
        finishEditing();
        hit = itemAtPoint(cx, cy);
      } else {
        finishEditing();
        hit = itemAtPoint(cx, cy);
      }
    }

    if (t === "image") {
      if (pendingImageRef.current) {
        placeArmedImage(w);
        return;
      }
      pickImage();
      return;
    }

    if (t === "pen" || t === "marker" || t === "eraser") {
      pushHistory();
    }

    if (t === "pen" || t === "marker") {
      const strokeId = startDrawStroke(w, {
        color: INK,
        width: t === "marker" ? MARKER_W : PEN_W,
        marker: t === "marker",
        highlight: false,
      });
      gesture.current = { mode: "draw", marker: t === "marker", points: [w], strokeId };
      setDraft({ points: [w], marker: t === "marker" });
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      return;
    }

    if (t === "highlight") {
      const hlSel = highlightSelectionRef.current;
      if (hlSel.length) {
        const hlBb = selectionWorldBBoxForIds(hlSel);
        if (hlBb) {
          const tl = worldToClient(hlBb.minx, hlBb.miny);
          const br = worldToClient(hlBb.maxx, hlBb.maxy);
          const pad = 12;
          if (
            cx >= tl.x - pad &&
            cx <= br.x + pad &&
            cy >= tl.y - pad &&
            cy <= br.y + pad
          ) {
            startPendingSpaceTransfer(e, "paper", hlSel, { kind: "highlight" });
            return;
          }
        }
        if (hit && hlSel.includes(hit.id)) {
          startPendingSpaceTransfer(e, "paper", hlSel, { kind: "highlight" });
          return;
        }
      }
      const hlW = highlightWorldWidth(camRef.current.scale);
      const strokeId = startDrawStroke(w, {
        color: HIGHLIGHT_INK,
        width: hlW,
        marker: true,
        highlight: true,
      });
      gesture.current = {
        mode: "draw",
        highlight: true,
        additive: e.shiftKey,
        points: [w],
        brushedIds: new Set(),
        lastCx: cx,
        lastCy: cy,
        strokeId,
      };
      setHighlightTouchIds([]);
      setDraft({ points: [w], highlight: true });
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      return;
    }

    if (t === "eraser") {
      pushHistory();
      gesture.current = { mode: "erase", deletedIds: new Set() };
      const hit = itemAtPoint(cx, cy);
      if (hit) {
        gesture.current.deletedIds.add(hit.id);
        setItems((arr) => arr.filter((it) => it.id !== hit.id));
        setSelection((sel) => sel.filter((id) => id !== hit.id));
      }
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      return;
    }

    if (hit) {
      const already = selRef.current.includes(hit.id);
      const nextSel = e.shiftKey
        ? already
          ? selRef.current.filter((id) => id !== hit.id)
          : [...selRef.current, hit.id]
        : already
        ? selRef.current
        : [hit.id];
      setSelection(nextSel);
      if (toolRef.current === "select") {
        clearHighlightSelection();
      }
      // Drag always wins over typing — exit any leftover edit session.
      if (editingRef.current && editingRef.current !== hit.id) {
        finishEditing();
      } else if (editingRef.current && toolRef.current === "select") {
        // Select utensil: pointer-down on objects is for drag/select, not type-in-place.
        finishEditing();
      }
      const intent = e.altKey ? "clone" : "move";
      gesture.current = {
        mode: "pending",
        cx,
        cy,
        ids: nextSel,
        hitId: hit.id,
        intent,
        alreadySelected: already && !e.shiftKey,
      };
    } else if (t === "select") {
      const selHit = selectedAtPoint(cx, cy);
      if (selHit) {
        if (editingRef.current) finishEditing();
        const intent = e.altKey ? "clone" : "move";
        gesture.current = {
          mode: "pending",
          cx,
          cy,
          ids: selHit,
          hitId: selHit[0],
          intent,
          alreadySelected: true,
        };
      } else {
        // Google Slides model: a clean click on empty paper (nothing selected,
        // nothing being edited) creates a text box; a drag is still a marquee.
        const spawnTextOnClick = !editingRef.current && selRef.current.length === 0 && !e.shiftKey;
        if (editingRef.current) finishEditing();
        if (!e.shiftKey) setSelection([]);
        gesture.current = { mode: "lasso", x0: lp.x, y0: lp.y, x1: lp.x, y1: lp.y, spawnTextOnClick };
        setLasso({ x0: lp.x, y0: lp.y, x1: lp.x, y1: lp.y });
      }
    } else {
      if (!e.shiftKey) setSelection([]);
      gesture.current = { mode: "lasso", x0: lp.x, y0: lp.y, x1: lp.x, y1: lp.y };
      setLasso({ x0: lp.x, y0: lp.y, x1: lp.x, y1: lp.y });
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  function startHandleGesture(e, mode, payload) {
    e.stopPropagation();
    e.preventDefault();
    pushHistory();
    gesture.current = { mode, cx: e.clientX, cy: e.clientY, ...payload };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  // ---- text editing ----
  function commitEdit(id, text) {
    const clean = (text || "").replace(/\u00a0/g, " ");
    if (!clean.trim()) {
      setItems((arr) => arr.filter((it) => it.id !== id));
      setSelection((sel) => sel.filter((sid) => sid !== id));
      pendingGoldBornRef.current.delete(id);
    } else {
      const prev = itemsRef.current.find((it) => it.id === id);
      const patch = { text: clean };
      if (prev && ["text", "sticky", "callout", "code", "math"].includes(prev.type)) {
        patch.w = fitTextItemWidth({ ...prev, text: clean });
      }
      updateItem(id, patch);
      if (pendingGoldBornRef.current.has(id)) {
        pendingGoldBornRef.current.delete(id);
        markGoldBorn(id);
      }
    }
    editingRef.current = null;
    setEditing(null);
  }

  function cleanupEmptyDrafts(keepEditingId = editingRef.current) {
    setItems((arr) => purgeEmptyDraftBlocks(arr, keepEditingId));
    setSelection((sel) => {
      const valid = sel.filter((id) => {
        const it = itemsRef.current.find((x) => x.id === id);
        return it && (!isEmptyDraftBlock(it) || id === keepEditingId);
      });
      return valid.length === sel.length ? sel : valid;
    });
  }

  // ---- images ----
  async function addImage(file, at) {
    try {
      pushHistory();
      const { src, w, h } = await fileToImage(file);
      const center = at || paperViewportCenterWorld();
      const scale = Math.min(1, 260 / w);
      const id = uid();
      const imgItem = tagRecordingItem(
        normalizeItem({
          id,
          type: "image",
          x: center.x,
          y: center.y,
          w: Math.round(w * scale),
          h: Math.round(h * scale),
          src,
          rotation: 0,
          scale: 1,
          pageId: activePageId,
        })
      );
      setItems((arr) => [...arr, imgItem]);
      setSelection([id]);
      recordItemEvent(id, "born", { itemSnapshot: itemSnapshot(imgItem) });
    } catch {
      showToast("could not load that image");
    }
  }
  function pickImage() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      if (!input.files?.[0]) return;
      pendingImageRef.current = input.files[0];
      setImageArmed(true);
      setTool("image");
    };
    input.click();
  }

  function placeArmedImage(atWorld) {
    const file = pendingImageRef.current;
    if (!file) return;
    pendingImageRef.current = null;
    setImageArmed(false);
    emitTourEvent("insert-image");
    addImage(file, atWorld);
    setTool("select");
  }

  // double-click object: edit text · blank paper: new text box · ◷ for operator stages
  function onDoubleClick(e) {
    if (!["select", "highlight"].includes(toolRef.current)) return;
    const hit = itemAtPoint(e.clientX, e.clientY);
    if (hit && isEditableBlock(hit)) {
      e.preventDefault();
      setSelection([hit.id]);
      clearHighlightSelection();
      editingRef.current = hit.id;
      setEditing(hit.id);
      editClickRef.current = { cx: e.clientX, cy: e.clientY };
      return;
    }
    if (hit) return;
    e.preventDefault();
    // Blank double-click pans/fits — text boxes only via Text tool (avoids phantom empty boxes).
  }

  function onViewportDoubleClick(e) {
    const hit = itemAtPoint(e.clientX, e.clientY);
    if (hit) return;
    const r = vpRect();
    animateCameraDirect(fitPaperInView(r.width, r.height), 520);
  }

  // ---- export / object helpers ----
  async function combineItemsByDrag(draggedIds, targetIds) {
    const ids = [...new Set([...draggedIds, ...targetIds])];
    const mergeOp = operators.find((o) => o.name === "merge") || TRANSFORM_PRIMITIVES.find((o) => o.name === "expand");
    runOperator(mergeOp, ids, {});
  }
  combineRef.current = combineItemsByDrag;

  function materialFromItemsForExport(itemList) {
    const parts = [];
    for (const it of itemList) {
      if (it.type === "text" && it.text?.trim()) parts.push({ kind: "text", content: it.text.trim() });
      else if (it.type === "image" && it.src) parts.push({ kind: "image", content: it.src, alt: "image" });
      else if (it.type === "stroke") parts.push({ kind: "stroke", content: "[drawing on canvas]" });
    }
    return parts;
  }

  function exportSelection(format) {
    const ids = selRef.current;
    const itemList = ids.length
      ? itemsRef.current.filter((it) => ids.includes(it.id))
      : itemsRef.current.filter((it) => (it.type === "text" && it.text?.trim()) || it.type === "image" || it.type === "stroke");
    if (!itemList.length) {
      showToast("nothing to export");
      return;
    }
    const parts = materialFromItemsForExport(itemList);
    const plain = parts.map((p) => (p.kind === "text" ? p.content : p.content)).join("\n\n---\n\n");
    const title = `lens-export-${new Date().toISOString().slice(0, 10)}`;
    const download = (name, blob, mime) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([blob], { type: mime }));
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
    };

    if (format === "txt") {
      download(`${title}.txt`, plain, "text/plain;charset=utf-8");
    } else if (format === "md") {
      const md = parts
        .map((p) => {
          if (p.kind === "text") return p.content;
          if (p.kind === "image") return `![image](${p.content})`;
          return p.content;
        })
        .join("\n\n---\n\n");
      download(`${title}.md`, md, "text/markdown;charset=utf-8");
    } else if (format === "doc") {
      const html = buildExportHtml(parts, title);
      download(`${title}.doc`, html, "application/msword");
    } else if (format === "pdf") {
      openPrintExport(parts, title);
    }
    showToast(`exported · ${format}`);
  }

  function buildExportHtml(parts, title) {
    const body = parts
      .map((p) => {
        if (p.kind === "text") return `<p style="white-space:pre-wrap;font-family:Inter,system-ui,sans-serif;font-size:16px;line-height:1.5">${escapeHtml(p.content).replace(/\n/g, "<br>")}</p>`;
        if (p.kind === "image") return `<p><img src="${p.content}" style="max-width:100%;height:auto" alt="image"/></p>`;
        return `<p><em>${p.content}</em></p>`;
      })
      .join("<hr/>");
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body style="max-width:720px;margin:40px auto;padding:0 24px;background:#111111;color:#f0f0f0">${body}</body></html>`;
  }

  function openPrintExport(parts, title) {
    const html = buildExportHtml(parts, title);
    const w = window.open("", "_blank");
    if (!w) {
      showToast("allow popups to export PDF");
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  }

  function isEditableBlock(it) {
    return it && (it.type === "text" || it.type === "sticky" || it.type === "callout" || it.type === "code" || it.type === "math");
  }

  function insertBlock(type, opts = {}) {
    pushHistory();
    const meta = defaultBlockMeta(type);
    const origin = opts.atWorld
      ? blockOriginAtPointer(type, opts.atWorld)
      : blockOriginAtViewportCenter(type, paperViewportCenterWorld());
    const id = uid();
    const item = tagRecordingItem(
      normalizeItem({
        id,
        type: type === "text" ? "text" : type,
        x: origin.x,
        y: origin.y,
        w: origin.w ?? meta.w,
        text: defaultBlockContent(type),
        pageId: activePageId,
        world: worldFilter || opts.world || null,
        ...meta,
        ...opts,
      })
    );
    if (type === "callout-obs") {
      item.type = "callout";
      item.variant = "observation";
      item.text = "Your observation…";
    } else if (type === "callout-q" || opts.variant === "question") {
      item.type = "callout";
      item.variant = "question";
      item.text = "Your question?";
    }
    setItems((arr) => [...arr, item]);
    setSelection([id]);
    recordItemEvent(id, "born", { itemSnapshot: itemSnapshot(item) });
    if (["text", "sticky", "callout", "code", "math"].includes(item.type)) {
      setEditing(id);
      editingRef.current = id;
      pendingGoldBornRef.current.add(id);
    }
    if (type !== "text" && type !== "sticky") setTool("select");
    return id;
  }

  function placeBlockAtClick(type, clientX, clientY, opts = {}) {
    const atWorld = clientToWorld(clientX, clientY);
    const id = insertBlock(type, { atWorld, ...opts });
    if (type === "text") emitTourEvent("insert-text");
    if (type === "sticky") emitTourEvent("insert-sticky");
    editingRef.current = id;
    editClickRef.current = {
      cx: clientX,
      cy: clientY,
      selectAll: type === "sticky" && !defaultBlockContent(type),
    };
    return id;
  }

  function insertBlockFromPalette(type) {
    if (type === "text" || type === "sticky") {
      insertBlock(type);
      return;
    }
    if (type === "pen") {
      setTool("pen");
      return;
    }
    if (type === "image") {
      pickImage();
      return;
    }
    insertBlock(type);
  }

  function focusThought(item) {
    if (!item) return;
    if ((item.pageId || DEFAULT_PAGE_ID) !== activePageId) {
      switchPage(item.pageId || DEFAULT_PAGE_ID);
    }
    setSelection([item.id]);
    requestAnimationFrame(() => centerCameraOnItem(item));
  }

  function switchPage(pageId, nextCamera) {
    emitTourEvent("page-switch");
    const targetPage = pages.find((p) => p.id === pageId);
    setPages((ps) =>
      ps.map((p) => (p.id === activePageId ? { ...p, camera: { ...camRef.current } } : p))
    );
    setActivePageId(pageId);
    setSelection([]);
    setEditing(null);
    requestAnimationFrame(() => {
      const r = vpRect();
      const targetCam = nextCamera || targetPage?.camera || fitPaperInView(r.width, r.height);
      animateCameraDirect(targetCam, 520);
    });
  }

  function addPage() {
    emitTourEvent("page-add");
    const id = uid();
    const num = pages.length + 1;
    const r = vpRect();
    const cam = centerPaperCamera(r.width, r.height);
    setPages((ps) => [...ps, { id, name: `World ${num}`, camera: cam, sessions: [] }]);
    switchPage(id, cam);
  }

  function renamePage(pageId, name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setPages((ps) => ps.map((p) => (p.id === pageId ? { ...p, name: trimmed.slice(0, 48) } : p)));
  }

  function moveAiNode(nodeId, x, y) {
    setAiNodes((nodes) => nodes.map((n) => (n.id === nodeId ? { ...n, x, y } : n)));
  }

  function updateAiNode(nodeId, patch) {
    setAiNodes((nodes) => nodes.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)));
  }

  function appendAiNodes(...newNodes) {
    setAiNodes((nodes) => {
      try {
        return layoutAfterAppend(nodes, newNodes);
      } catch (err) {
        console.error("appendAiNodes layout failed", err);
        return [...nodes, ...newNodes];
      }
    });
    return newNodes;
  }

  function findSourceNodeForIds(ids) {
    const key = [...ids].sort().join(",");
    return aiNodesRef.current.find(
      (n) =>
        n.nodeKind === "source" &&
        n.sourceIds?.length &&
        [...n.sourceIds].sort().join(",") === key
    );
  }

  function ensureSourceNode(ids, preview, label, worldPos, opts = {}) {
    const existing = findSourceNodeForIds(ids);
    if (existing) return existing;
    const pos = nodePositionAt(aiNodesRef.current, "source", worldPos);
    const node = makeAiNode({
      nodeKind: "source",
      label: truncateLabel(label || preview || "Source"),
      preview,
      sourceIds: ids,
      loading: !preview,
      x: pos.x,
      y: pos.y,
      radius: pos.radius,
      ...(opts.dropPinned && worldPos ? { _dropPinned: true } : {}),
    });
    appendAiNodes(node);
    setSelectedAiNodeIds([node.id]);
    return node;
  }

  function createExpandedChild(
    sourceNode,
    { opLabel, opId, loading = true, label = "Expanded" } = {},
    worldPos,
    opts = {}
  ) {
    const existing = aiNodesRef.current;
    const pos = worldPos
      ? {
          x: worldPos.x,
          y: worldPos.y,
          radius: worldPos.radius || nodePositionAt(existing, "expanded").radius,
        }
      : childNodePosition(sourceNode, "expanded", existing);
    const node = makeAiNode({
      nodeKind: "expanded",
      label: truncateLabel(opLabel || label),
      sourceNodeIds: [sourceNode.id],
      parentId: sourceNode.id,
      sourceIds: sourceNode.sourceIds || [],
      opId: opId || null,
      opLabel: opLabel || label,
      loading,
      x: pos.x,
      y: pos.y,
      radius: pos.radius,
      ...(opts.dropPinned && worldPos
        ? {
            _dropPinned: true,
            _hintAngle: Math.atan2(pos.y - sourceNode.y, pos.x - sourceNode.x),
          }
        : {}),
    });
    appendAiNodes(node);
    setSelectedAiNodeIds([node.id]);
    return node;
  }

  function createSessionNodes(session, prompt, worldPos, labelOverride) {
    const existing = aiNodesRef.current;
    const sessionPos = worldPos
      ? {
          x: worldPos.x - AI_SPAWN_MIN_DIST * 0.32,
          y: worldPos.y,
          radius: nodePositionAt(existing, "session").radius,
        }
      : nodePositionAt(existing, "session", worldPos);
    const sessionNode = makeAiNode({
      nodeKind: "session",
      label: truncateLabel(labelOverride || session.transcript?.slice(0, 24) || "Session"),
      preview: session.transcript?.slice(0, 200) || "Paper session",
      sourceIds: [],
      x: sessionPos.x,
      y: sessionPos.y,
      radius: sessionPos.radius,
      ...(worldPos ? { _dropPinned: true } : {}),
    });
    const expandedPos = worldPos
      ? { x: worldPos.x, y: worldPos.y, radius: nodePositionAt(existing, "expanded").radius }
      : childNodePosition(sessionNode, "expanded", [...existing, sessionNode]);
    const expandedNode = makeAiNode({
      nodeKind: "expanded",
      label: "···",
      sourceNodeIds: [sessionNode.id],
      parentId: sessionNode.id,
      sourceIds: [],
      loading: true,
      opLabel: "interpret paper",
      x: expandedPos.x,
      y: expandedPos.y,
      radius: expandedPos.radius,
      ...(worldPos ? { _dropPinned: true } : {}),
    });
    appendAiNodes(sessionNode, expandedNode);
    setSelectedAiNodeIds([expandedNode.id]);
    if (worldPos) {
      launchPaperToAiTransfer({
        nodeIds: [expandedNode.id],
      });
    }
    return { sessionNode, expandedNode, prompt };
  }

  function createMoveNode(op, worldPos, linkTo) {
    const existing = aiNodesRef.current;
    let pos;
    if (linkTo) {
      pos = childNodePosition(linkTo, "move", existing);
      if (worldPos) pos = { ...pos, x: worldPos.x, y: worldPos.y };
    } else {
      pos = nodePositionAt(existing, "move", worldPos);
    }
    const node = makeAiNode({
      nodeKind: "move",
      label: truncateLabel(op.name),
      opId: op.id,
      sourceNodeIds: linkTo ? [linkTo.id] : [],
      parentId: linkTo?.id || null,
      x: pos.x,
      y: pos.y,
      radius: pos.radius,
    });
    appendAiNodes(node);
    setSelectedAiNodeIds([node.id]);
    return node;
  }

  function createLensNode(lens, worldPos, linkTo) {
    const existing = aiNodesRef.current;
    let pos;
    if (linkTo) {
      pos = childNodePosition(linkTo, "lens", existing);
      if (worldPos) pos = { ...pos, x: worldPos.x, y: worldPos.y };
    } else {
      pos = nodePositionAt(existing, "lens", worldPos);
    }
    const node = makeAiNode({
      nodeKind: "lens",
      label: truncateLabel(lens.name),
      lensId: lens.id,
      sourceNodeIds: linkTo ? [linkTo.id] : [],
      parentId: linkTo?.id || null,
      x: pos.x,
      y: pos.y,
      radius: pos.radius,
    });
    appendAiNodes(node);
    setSelectedAiNodeIds([node.id]);
    return node;
  }

  function createOutputNode(text, worldPos, linkTo = null) {
    const existing = aiNodesRef.current;
    let pos;
    if (worldPos) {
      pos = { ...nodePositionAt(existing, "expanded", worldPos), x: worldPos.x, y: worldPos.y };
    } else if (linkTo) {
      pos = childNodePosition(linkTo, "expanded", existing);
    } else {
      pos = nodePositionAt(existing, "expanded", null);
    }
    const clean = String(text || "").trim();
    const node = makeAiNode({
      nodeKind: "expanded",
      label: truncateLabel(clean.slice(0, 24) || "Output"),
      expandedText: clean,
      parentId: linkTo?.id || null,
      sourceNodeIds: linkTo ? [linkTo.id] : [],
      x: pos.x,
      y: pos.y,
      radius: pos.radius,
      ...(worldPos ? { _dropPinned: true } : {}),
    });
    appendAiNodes(node);
    setSelectedAiNodeIds([node.id]);
    return node;
  }

  async function syncAiSource(ids, opts = {}) {
    const idSet = new Set(ids);
    const itemList = itemsRef.current.filter((it) => idSet.has(it.id));
    if (!itemList.length) return null;
    const gathered = await gatherMaterialFromItems(itemList);
    if (!opts.skipNode) {
      ensureSourceNode(ids, gathered.preview, gathered.preview?.slice(0, 24));
    }
    setAiPanel((prev) => ({
      ...(prev || {}),
      sourceIds: ids,
      sourcePreview: gathered.preview,
      sourceText: gathered.text,
      image: gathered.image,
      expandedText: opts.keepExpanded ? prev?.expandedText : null,
      loading: false,
      error: null,
      opLabel: opts.opLabel || null,
      opId: opts.opId || null,
    }));
    return gathered;
  }

  async function runOpForAi(op, ids, opts = {}) {
    const idSet = new Set(ids);
    const itemList = itemsRef.current.filter((it) => idSet.has(it.id));
    const gathered = await gatherMaterialFromItems(itemList);
    return runOpForAiMaterial(op, gathered.text, { image: gathered.image, opMap: opts.opMap });
  }

  async function runOpForAiMaterial(op, material, opts = {}) {
    const text = String(material || "").trim();
    const { image } = opts;
    if (!text && !image) throw new Error("no readable content");

    // Merge any caller-supplied ops (compound lenses) and always hydrate
    // moveRef-only steps so captured functions execute with real prompts.
    const map = hydrateOperatorMap({ ...opMap, ...(opts.opMap || {}) }, operators, op.id);
    const execOp = map[op.id] || op;
    const plan = compileExecutionPlan(execOp, map, text);

    if (plan.phases.length === 1 && plan.phases[0].id === "synthesize") {
      const phase = plan.phases[0];
      return runClaude(phase.prompt, text.trim(), {
        system: phase.system,
        maxTokens: phase.maxTokens,
        timeoutMs: phase.timeoutMs,
        image,
        compact: plan.fastPath,
      });
    }

    return runExecutionOnServer({
      op: execOp,
      opMap: map,
      operators,
      material: text,
      image,
      plan,
    });
  }

  async function expandInAi(ids, opts = {}) {
    emitTourEvent("expand-ai");
    ensureAiColumnVisible();
    if (opts.stableCamera) aiStableCameraUntilRef.current = Date.now() + 5000;
    const op = opts.op || opMap["op-expand"] || TRANSFORM_PRIMITIVES.find((p) => p.name === "expand");
    if (!op) {
      showToast("expand primitive not found");
      return;
    }
    const idList = Array.isArray(ids) ? ids.filter(Boolean) : [];
    const aiMaterial = opts.aiMaterial?.trim() || "";
    const dropWorld = opts.expandedAt ?? opts.atWorld;
    let sourceNode = opts.sourceNode || (idList.length ? findSourceNodeForIds(idList) : null);
    const dropPinned = !!dropWorld;

    // The dragged material lands exactly under the cursor; the result branches
    // outward from it rather than displacing it.
    if (!sourceNode && idList.length) {
      const sourceAt = dropWorld ? { x: dropWorld.x, y: dropWorld.y } : null;
      sourceNode = ensureSourceNode(idList, null, "Source", sourceAt, { dropPinned: !!sourceAt });
    } else if (sourceNode && dropWorld && !opts.sourceNode) {
      // Existing source for this material: bring it to the drop point so the
      // node the user "carried" is the one under their cursor.
      updateAiNode(sourceNode.id, { x: dropWorld.x, y: dropWorld.y, dropPinned: true });
      sourceNode = { ...sourceNode, x: dropWorld.x, y: dropWorld.y };
    }
    if (!sourceNode) {
      showToast("no source node for this operation");
      return;
    }

    const childWorld = resolveExpandedDropWorld(sourceNode, dropWorld);
    const expandedNode = createExpandedChild(
      sourceNode,
      {
        opLabel: opts.opLabel || op.name,
        opId: op.id,
        loading: !opts.bridgeOnly,
      },
      childWorld || undefined,
      { dropPinned: dropPinned || !!childWorld }
    );
    markGrowingAiEdge(sourceNode.id, expandedNode.id);
    const inputPreview = aiMaterial
      ? truncatePreview(aiMaterial, 120)
      : truncatePreview(
          itemsRef.current
            .filter((it) => idList.includes(it.id))
            .map((it) => it.text || it.preview || "")
            .join(" ")
            .trim(),
          120
        );
    if (idList.length) {
      recordItemEvents(idList, "transfer-to-ai", {
        aiNodeId: sourceNode.id,
        opName: opts.opLabel || op.name,
        opId: op.id,
        moveRef: viaFromOp(op, idList).moveRef,
        inputPreview,
      });
    }
    launchPaperToAiTransfer({ nodeIds: [expandedNode.id] });
    setSelectedAiNodeIds([expandedNode.id]);
    if (opts.bridgeOnly) {
      updateAiNode(expandedNode.id, {
        loading: false,
        label: truncateLabel(opts.opLabel || op.name || "Expanded"),
        preview: "…",
      });
      return;
    }
    setAiPanel((prev) => ({
      ...(prev || {}),
      sourceIds: idList.length ? idList : prev?.sourceIds,
      loading: true,
      error: null,
      opLabel: opts.opLabel || op.name,
      opId: op.id,
      activeNodeId: expandedNode.id,
    }));
    try {
      let gathered = null;
      if (aiMaterial) {
        updateAiNode(sourceNode.id, { loading: false });
      } else if (idList.length) {
        gathered = await syncAiSource(idList, {
          keepExpanded: false,
          opLabel: op.name,
          opId: op.id,
          skipNode: true,
        });
        if (gathered) {
          updateAiNode(sourceNode.id, {
            preview: gathered.preview,
            label: truncateLabel(gathered.preview || "Source"),
            loading: false,
          });
        }
      } else {
        throw new Error("no readable content");
      }

      let out = aiMaterial
        ? await runOpForAiMaterial(op, aiMaterial, { opMap: opts.opMap })
        : await runOpForAi(op, idList, { opMap: opts.opMap });
      if (isTransformPrimitive(op)) {
        out = sanitizePrimitiveOutput(out);
        if (!out?.trim() || isPrimitiveMetaOutput(out)) {
          throw new Error("got commentary instead of transformed text — try again");
        }
      } else {
        const polishSource = aiMaterial
          || itemsRef.current.filter((it) => idList.includes(it.id)).map((it) => it.text).join("\n");
        out = await polishDeliverable(out, op, polishSource);
      }
      const text = out.trim();
      // History lives on the produced object only — the source keeps no record
      // of transformations that made other objects.
      updateAiNode(expandedNode.id, {
        expandedText: text,
        loading: false,
        error: null,
        label: truncateLabel(opts.opLabel || op.name || "Expanded"),
        via: viaFromOp(op, idList),
      });
      setAiPanel((prev) => ({
        ...prev,
        expandedText: text,
        loading: false,
        error: null,
      }));
    } catch (err) {
      updateAiNode(expandedNode.id, {
        loading: false,
        error: err.message || "expand failed",
      });
      setAiPanel((prev) => ({
        ...prev,
        loading: false,
        error: err.message || "expand failed",
      }));
      showToast(err.message || "expand failed");
    }
  }
  expandInAiRef.current = expandInAi;
  itemAtPointRef.current = itemAtPoint;
  paperHighlightTransferRef.current = (ideaIds) => {
    transferHighlightSelectionToAi(ideaIds);
  };
  transferFragmentToPaperRef.current = (fragment, opts = {}) => {
    if (!fragment?.trim()) return;
    emitTourEvent("fragment-paper");
    const atWorld =
      opts.atWorld ||
      (opts.clientX != null && opts.clientY != null
        ? clientToWorld(opts.clientX, opts.clientY)
        : paperViewportCenterWorld());
    const id = spawnTextAtWorld(fragment, atWorld, { silent: true, fromAi: true });
    if (id) {
      const r = vpRect();
      animateCameraTo(atWorld, Math.min(camRef.current.scale, 1.1));
    }
  };
  transferFragmentReplaceRef.current = (fragment) => {
    emitTourEvent("fragment-highlight");
    const nodeId = selectedAiNodeIdsRef.current[selectedAiNodeIdsRef.current.length - 1];
    replaceFragmentInAiNode(nodeId, fragment);
  };
  spaceTransferCompleteRef.current = (g, cx, cy) => {
    emitTourEvent("transfer");
    const fromClient = { x: cx, y: cy };
    const target = resolveTransferDropTarget(g.origin, cx, cy);

    if (g.origin === "paper" && target === "ai") {
      const ids = g.ids;
      const world = getAiDropWorldFromClient(cx, cy);
      if (g.kind === "highlight") {
        transferHighlightSelectionToAi(ids, world, { fromClient });
        return;
      }
      const sketchBundle = gatherSelectionSketchBundle(ids);
      if (sketchBundle) {
        interpretSketchBundle(sketchBundle, world, { fromClient });
      } else {
        const expandIds = transformableDragIds(ids);
        if (expandIds.length) {
          expandInAi(expandIds, { expandedAt: world, fromClient, quiet: true, stableCamera: true });
        } else {
          showToast("Nothing here can transfer to AI");
        }
      }
    } else if (g.origin === "paper" && target === "paper" && g.kind === "highlight") {
      transferHighlightSelectionToPaper(g.ids, clientToWorld(cx, cy));
    } else if (g.origin === "paper" && target === RAIL_TRANSFORMATIONS) {
      if (g.kind === "highlight") {
        transferHighlightSelectionToFunctions(g.ids);
      } else {
        captureMaterialWithReplay(g.ids);
      }
      launchToolboxTransfer(RAIL_TRANSFORMATIONS);
    } else if (g.origin === "paper" && target === RAIL_LENSES) {
      const structId = structCardAtClient(cx, cy);
      if (g.kind === "highlight") {
        transferHighlightSelectionToStructures(g.ids, structId);
      } else {
        addMaterialToLens(g.ids, { structId });
      }
      launchToolboxTransfer(RAIL_LENSES);
    } else if (g.origin === "ai" && target === "paper") {
      emitTourEvent("transfer-to-paper");
      const atWorld = clientToWorld(cx, cy);
      if (g.fragment?.trim()) {
        emitTourEvent("highlight-to-paper");
        const id = spawnTextAtWorld(g.fragment, atWorld, { silent: true, fromAi: true });
        if (id) {
          for (const nodeId of g.ids || []) {
            updateAiNode(nodeId, { goldenFragment: null });
            recordItemEvent(id, "highlight-transfer", {
              targetLayer: "paper",
              aiNodeId: nodeId,
              inputPreview: truncatePreview(g.fragment, 120),
            });
          }
          setSelectedAiNodeIds([]);
          showToast("placed on paper");
        }
      } else {
        transferAiNodesToPaper(g.ids, atWorld, { fromClient });
      }
    } else if (g.origin === "ai" && target === RAIL_TRANSFORMATIONS) {
      captureAiNodesAsFunction(g.ids);
      launchToolboxTransfer(RAIL_TRANSFORMATIONS);
    } else if (g.origin === "ai" && target === RAIL_LENSES) {
      saveAiNodesAsSymbol(g.ids, structCardAtClient(cx, cy));
      launchToolboxTransfer(RAIL_LENSES);
    } else if (g.origin === "ai" && target === "ai") {
      const world = getAiDropWorldFromClient(cx, cy);
      for (const nodeId of g.ids) {
        const node = aiNodesRef.current.find((n) => n.id === nodeId);
        if (!node) continue;
        const { inputNode, ids, aiMaterial } = resolveAiOperatorInput(node);
        if (!inputNode || (!ids?.length && !aiMaterial?.trim())) continue;
        expandInAi(ids || [], {
          sourceNode: inputNode,
          expandedAt: world,
          fromClient,
          quiet: true,
          stableCamera: true,
          aiMaterial: aiMaterial?.trim() || null,
        });
      }
    } else if (g.activated) {
      showToast("Drop on a column to transfer");
    }
  };
  toolboxApplyCompleteRef.current = (g, cx, cy) => {
    if (!g.moved) return;
    const atClient = { x: cx, y: cy };
    const env = toolboxDragEnvRef.current;
    if (env.isOverPaperColumn?.(cx, cy) || env.isOverAiColumn?.(cx, cy)) {
      if (g.payload.kind === "operator") {
        applyToolboxOperatorAt(g.payload.opId, atClient);
      } else if (g.payload.kind === "transformation-lens") {
        applyToolboxTransformationLensAt(g.payload.lensId, atClient);
      } else if (g.payload.kind === "pattern-lens") {
        if (env.isOverAiColumn?.(cx, cy)) {
          applyPatternLensToAiNode(g.payload.structId, atClient);
        } else {
          applyPatternLensDrop(g.payload.structId, atClient);
        }
      }
      return;
    }
    if (env.isOverFunctionsColumn?.(cx, cy)) {
      if (g.payload.kind === "operator") {
        const targetId = opCardAtClient(cx, cy);
        if (targetId && targetId !== g.payload.opId) composeOperators(g.payload.opId, targetId);
      } else if (g.payload.kind === "transformation-lens") {
        const targetId = transformationLensCardAtClient(cx, cy);
        if (targetId && targetId !== g.payload.lensId) mergeLenses(g.payload.lensId, targetId);
      }
    }
  };
  toolboxDragEnvRef.current = {
    isOverPaperColumn,
    isOverAiColumn,
    isOverFunctionsColumn,
    itemAtPointForDrop,
    getAiDropWorldFromClient,
    aiNodeAtWorld,
  };

  /** Pattern lenses work in the AI space too: read a node through the symbol's structure. */
  function applyPatternLensToAiNode(structId, atClient) {
    const struct = lensesRef.current.find((s) => s.id === structId);
    if (!struct) return;
    const world = getAiDropWorldFromClient(atClient.x, atClient.y);
    const node = aiNodeAtWorld(world.x, world.y);
    if (!node) {
      showToast("drop the lens onto a node");
      return;
    }
    const tree = struct.viewLens || viewingLensTreeFromSymbol(struct);
    const { ops, rootId } = treeToOperators(tree, { top: false });
    const op = ops.find((o) => o.id === rootId);
    if (!op) return;
    const mergedMap = { ...opMap, ...Object.fromEntries(ops.map((o) => [o.id, o])) };
    applyOperatorToAiNode(node, op, atClient, { opMap: mergedMap, opLabel: `◇ ${struct.title}` });
  }

  function spawnTextAtWorld(text, atWorld, opts = {}) {
    const clean = stripMd(text).trim();
    if (!clean) return;
    pushHistory();
    const w = fitTextBoxWidth(clean, { maxW: maxTextWidth() });
    const h = measureTextHeight(w, clean);
    const pos = spawnPositionForBox(atWorld.x, atWorld.y, w, h);
    const id = uid();
    const item = normalizeItem({
      id,
      type: "text",
      x: pos.x,
      y: pos.y,
      text: clean,
      w,
      pageId: activePageId,
      world: worldFilter || null,
      bornFrom: opts.sourceIds || undefined,
      via: opts.via || undefined,
    });
    setItems((arr) => [...arr, item]);
    setSelection([id]);
    if (opts.fromAi) markGoldBorn(id);
    recordItemEvent(id, opts.fromAi ? "transfer-to-paper" : "born", {
      itemSnapshot: itemSnapshot(item),
      textSnapshot: clean,
      aiNodeId: opts.aiNodeId,
      outputPreview: truncatePreview(clean, 120),
    });
    // The object carries the sequence of steps that produced it — and only that.
    for (const v of opts.lineageVias || []) {
      recordItemEvent(id, "expand", {
        opName: v.name,
        opId: v.opId,
        moveRef: v.moveRef,
        outputPreview: truncatePreview(clean, 120),
      });
    }
    if (!opts.silent) showToast("added to paper");
    return id;
  }

  function aiNodeAtWorld(wx, wy) {
    const list = aiNodesRef.current;
    for (let i = list.length - 1; i >= 0; i--) {
      const n = list[i];
      const r = (n.radius || 20) + 28;
      if ((n.x - wx) ** 2 + (n.y - wy) ** 2 <= r * r) return n;
    }
    return null;
  }

  function getAiDropWorld(fallbackWorld) {
    if (fallbackWorld) return fallbackWorld;
    const el = aiViewportRef.current;
    if (el) {
      return aiViewportCenterWorld(aiCamRef.current, el.clientWidth, el.clientHeight);
    }
    return { x: 0, y: 0 };
  }

  function absorbTransferPayloadAt(e, worldPos, { autoExpand = false } = {}) {
    emitTourEvent("transfer");
    const pos = getAiDropWorld(worldPos);

    const aiOut = e.dataTransfer.getData(AI_OUTPUT_MIME);
    if (aiOut?.trim()) {
      createOutputNode(aiOut, pos);
      return true;
    }

    const lensId = e.dataTransfer.getData(LENS_MIME);
    if (lensId) {
      showToast("apply lenses from the functions column onto paper material");
      return true;
    }

    const bundleJson = e.dataTransfer.getData(SKETCH_BUNDLE_MIME);
    if (bundleJson) {
      try {
        interpretSketchBundle(JSON.parse(bundleJson), pos);
      } catch {
        /* ignore */
      }
      return true;
    }

    const sessionJson = e.dataTransfer.getData(PAPER_SESSION_MIME);
    if (sessionJson) {
      try {
        interpretPaperSession(JSON.parse(sessionJson), pos);
      } catch {
        /* ignore */
      }
      return true;
    }

    const thoughtJson = e.dataTransfer.getData(THOUGHT_MIME) || e.dataTransfer.getData(SEL_MIME);
    let ids = null;
    if (thoughtJson) {
      try {
        ids = JSON.parse(thoughtJson);
      } catch {
        /* ignore */
      }
    }
    const sketchBundle = ids?.length ? gatherSelectionSketchBundle(ids) : null;
    if (sketchBundle && autoExpand) {
      interpretSketchBundle(sketchBundle, pos);
      return true;
    }

    const opId = e.dataTransfer.getData(OP_MIME);
    if (opId) {
      const op = opMap[opId];
      if (!op) return true;
      const targetNode = aiNodeAtWorld(pos.x, pos.y);
      if (!targetNode) {
        showToast("drop function onto a concept node");
        return true;
      }
      applyOperatorToAiNode(targetNode, op, null, { expandedAt: pos, stableCamera: true });
      return true;
    }

    if (ids?.length) {
      if (sketchBundle) {
        interpretSketchBundle(sketchBundle, pos);
        return true;
      }
      const sourceNode = findSourceNodeForIds(ids) || ensureSourceNode(ids, null, "Source", pos, { dropPinned: true });
      if (autoExpand) {
        expandInAi(ids, {
          sourceNode,
          expandedAt: pos,
        });
      } else {
        syncAiSource(ids, { keepExpanded: false, skipNode: true });
      }
      return true;
    }
    return false;
  }

  function absorbTransferPayload(e, opts = {}) {
    const world =
      opts.worldPos ??
      (e.clientX != null && e.clientY != null
        ? getAiDropWorldFromClient(e.clientX, e.clientY)
        : null);
    return absorbTransferPayloadAt(e, world, opts);
  }

  function handleBoundaryDragOver(e) {
    if (
      e.dataTransfer.types.includes(THOUGHT_MIME) ||
      e.dataTransfer.types.includes(SEL_MIME) ||
      e.dataTransfer.types.includes(OP_MIME) ||
      e.dataTransfer.types.includes(PAPER_SESSION_MIME) ||
      e.dataTransfer.types.includes(SKETCH_BUNDLE_MIME)
    ) {
      e.preventDefault();
      setBoundaryDropOver(true);
      setTransferDragActive(true);
      e.dataTransfer.dropEffect = "copy";
    }
  }

  function handleBoundaryDrop(e) {
    e.preventDefault();
    setBoundaryDropOver(false);
    setTransferDragActive(false);
    absorbTransferPayload(e, { autoExpand: true });
  }

  function handleAiDrop(e) {
    e.preventDefault();
    setAiDropOver(false);
    setTransferDragActive(false);
    absorbTransferPayload(e, { autoExpand: true });
  }

  function handleAiCanvasDragOver(e) {
    if (
      e.dataTransfer.types.includes(THOUGHT_MIME) ||
      e.dataTransfer.types.includes(SEL_MIME) ||
      e.dataTransfer.types.includes(OP_MIME) ||
      e.dataTransfer.types.includes(PAPER_SESSION_MIME) ||
      e.dataTransfer.types.includes(SKETCH_BUNDLE_MIME) ||
      e.dataTransfer.types.includes(AI_OUTPUT_MIME)
    ) {
      e.preventDefault();
      e.stopPropagation();
      setAiCanvasDropOver(true);
      setAiDropOver(true);
      setTransferDragActive(true);
      e.dataTransfer.dropEffect = "copy";
    }
  }

  function handleAiCanvasDrop(e, world) {
    e.preventDefault();
    setAiCanvasDropOver(false);
    setAiDropOver(false);
    setTransferDragActive(false);
    absorbTransferPayloadAt(e, world, { autoExpand: true });
  }

  function handleMenuAction(action) {
    if (action === "undo") undo();
    else if (action === "redo") redo();
    else if (action === "export-txt") {
      emitTourEvent("export");
      exportSelection("txt");
    } else if (action === "export-md") {
      emitTourEvent("export");
      exportSelection("md");
    } else if (action === "import-path") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "application/json";
      input.onchange = () => input.files?.[0] && importPath(input.files[0]);
      input.click();
    } else if (action === "start-fresh") setFreshConfirm(true);
    else if (action === "zoom-in") setCamera((c) => zoomCamera(c, ZOOM_STEP));
    else if (action === "zoom-out") setCamera((c) => zoomCamera(c, 1 / ZOOM_STEP));
    else if (action === "zoom-reset") setCamera((c) => ({ ...c, scale: 1 }));
    else if (action === "theme-toggle") setTheme((t) => (t === "idea" ? "chalk" : "idea"));
    else if (action === "insert-sticky") insertBlock("sticky");
    else if (action === "insert-callout-obs") insertBlock("callout", { variant: "observation", text: "Your observation…" });
    else if (action === "insert-callout-q") insertBlock("callout", { variant: "question", text: "Your question?" });
    else if (action === "insert-diagram") insertBlock("diagram");
    else if (action === "open-transformations") focusRailPane(RAIL_TRANSFORMATIONS);
    else if (action === "open-lenses") focusRailPane(RAIL_LENSES);
    else if (action === "feature-tour") startFeatureTour();
    else if (action === "setup-role") setOnboard({ step: "role" });
    else if (action === "new-function") openCreateLens();
    else if (action === "open-plans") setPlansOpen(true);
  }

  function handleShareBoard() {
    emitTourEvent("share");
    if (selection.length === 1 && selRef.current[0]) {
      shareJourneyLink(selRef.current[0]);
    } else {
      exportSelection("md");
    }
  }

  // ---- render ----
  const visibleItems = items.filter((it) => itemVisibleOnPage(it, activePageId, worldFilter));
  const selectedAiNodeId = selectedAiNodeIds[selectedAiNodeIds.length - 1] ?? null;
  const highlightTouchSet = useMemo(() => new Set(highlightTouchIds), [highlightTouchIds]);
  const highlightSelectionSet = useMemo(() => new Set(highlightSelectionIds), [highlightSelectionIds]);
  const highlightAiNodeSet = useMemo(() => new Set(highlightAiNodeIds), [highlightAiNodeIds]);
  const highlightTransferringSet = useMemo(() => new Set(highlightTransferringIds), [highlightTransferringIds]);
  const selBBox = selection.length ? selectionWorldBBox() : null;
  const selItem = selection.length === 1 ? items.find((it) => it.id === selection[0]) : null;
  const boardLinks = visibleItems.filter((it) => it.type === "link");
  const paperContentItems = visibleItems.filter(
    (it) => it.type !== "link" && !(it.type === "stroke" && it.highlight)
  );
  const activePageHasSession =
    (pages.find((p) => p.id === activePageId)?.sessions?.length || 0) > 0;
  const walkStep = walking?.steps?.[walking.stepIndex] || null;
  const walkFocusRects = walkStep
    ? walkStep.itemIds
        .map((id) => items.find((it) => it.id === id))
        .filter(Boolean)
        .map((it) => itemScreenBBox(it))
    : [];
  const itemStages = stagesItemId
    ? buildOperatorStages(stagesItemId, {
        item: items.find((it) => it.id === stagesItemId),
        historyLog: itemHistoryLog,
      })
    : null;
  const transferExploreOp = transferExploreOpId ? opMap[transferExploreOpId] : null;
  const transferExploreRecord = transferExploreOp ? resolveTransferContext(transferExploreOp) : null;
  const selectedMaterialText =
    selItem?.text?.trim() ||
    (selItem?.type === "sticky" || selItem?.type === "callout" ? selItem?.text : "") ||
    "";
  const selectedMaterialDomain = selectedMaterialText
    ? inferDomainFromMaterial(selectedMaterialText)
    : null;
  const transferRecognition = useMemo(() => {
    if (!selectedMaterialText || transferExploreOpId) return null;
    const matches = matchingOperatorsForMaterial(operators, selectedMaterialText, opMap);
    if (!matches.length) return null;
    const top = matches[0];
    const hint = recognitionHint(top.transfer, selectedMaterialText);
    return hint ? { matches, hint } : null;
  }, [selectedMaterialText, operators, opMap, transferExploreOpId]);
  // Three cursor types: select (which also types), draw (pen/eraser), highlight.
  const cursorClass =
    panning
      ? "cur-grabbing"
      : tool === "highlight" && highlightGrabHover
      ? "cur-grab"
      : tool === "highlight"
      ? "cur-highlight"
      : tool === "pen" || tool === "marker" || tool === "eraser"
      ? "cur-draw"
      : "cur-select";

  function itemCenter(it) {
    const w = itemWidth(it) * (it.scale ?? 1);
    const h = itemHeight(it) * (it.scale ?? 1);
    return { x: it.x + w / 2, y: it.y + h / 2 };
  }

  // ---- companion director: verbs demonstrating real app actions with a ghost cursor ----
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;

  function directorResolveItem(ref, ctx) {
    if (!ref || ref === "last") {
      const id = ctx.vars.lastItemId;
      return itemsRef.current.find((it) => it.id === id) || null;
    }
    if (ctx.vars[ref]) {
      const hit = itemsRef.current.find((it) => it.id === ctx.vars[ref]);
      if (hit) return hit;
    }
    const needle = String(ref).toLowerCase();
    return (
      itemsRef.current.find((it) => it.id === ref) ||
      itemsRef.current.find((it) => (it.text || "").toLowerCase().includes(needle)) ||
      null
    );
  }

  function directorResolveOp(ref, ctx) {
    if (!ref || ref === "last") return opMap[ctx.vars.lastOpId] || null;
    if (ctx.vars[ref] && opMap[ctx.vars[ref]]) return opMap[ctx.vars[ref]];
    const needle = String(ref).toLowerCase();
    return (
      opMap[ref] ||
      operators.find((o) => (o.name || "").toLowerCase() === needle) ||
      operators.find((o) => (o.name || "").toLowerCase().includes(needle)) ||
      Object.values(opMap).find((o) => (o.name || "").toLowerCase() === needle) ||
      null
    );
  }

  function directorItemClientCenter(item) {
    const bb = itemWorldBBox(item);
    const cx = bb ? (bb.minx + bb.maxx) / 2 : item.x;
    const cy = bb ? (bb.miny + bb.maxy) / 2 : item.y;
    return worldToClient(cx, cy);
  }

  function directorAiClientPoint(wx, wy) {
    const rect = aiViewportRef.current?.getBoundingClientRect();
    if (!rect) return { x: window.innerWidth * 0.85, y: window.innerHeight * 0.42 };
    const s = worldToScreen(aiCamRef.current, wx, wy);
    return { x: rect.left + s.x, y: rect.top + s.y };
  }

  function directorLatestAiNode(ctx) {
    const id = ctx.vars.lastAiNodeId || selectedAiNodeIdsRef.current[0];
    return (
      aiNodesRef.current.find((n) => n.id === id) ||
      [...aiNodesRef.current].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0] ||
      null
    );
  }

  async function directorWaitForJobs(tk, timeoutMs = 120000) {
    const start = Date.now();
    // give the job a beat to register before polling
    await tk.wait(400);
    while (Date.now() - start < timeoutMs && !tk.isAborted()) {
      const busy = jobsRef.current.some((j) => j.status === "running");
      if (!busy) return;
      await tk.wait(320);
    }
  }

  function directorOpRowCenter(tk, op) {
    if (!op) return null;
    return (
      tk.elementCenter(`[data-transformation-lens-id="${op.id}"]`) ||
      tk.elementCenter(`[data-op-id="${op.id}"]`)
    );
  }

  registerDirectorVerbs({
    caption: async (a, tk) => {
      tk.caption(a.text || "");
      await tk.wait(a.ms ?? 1600);
    },
    pause: async (a, tk) => tk.wait(a.ms ?? 600),
    switchTool: async (a, tk) => {
      const target =
        tk.elementCenter(`.canvas-tools-bar [data-tool="${a.tool}"]`) ||
        tk.elementCenter(".canvas-tools-bar");
      if (target) await tk.click(target.x, target.y);
      setTool(a.tool);
      if (a.caption) tk.caption(a.caption);
      await tk.wait(500);
    },
    fitPaper: async (a, tk) => {
      const r = vpRect();
      animateCameraDirect(fitPaperInView(r.width, r.height), 520);
      await tk.wait(680);
    },
    spawnText: async (a, tk, ctx) => {
      const count = (ctx.vars._spawnCount = (ctx.vars._spawnCount || 0) + 1);
      const center = paperViewportCenterWorld();
      const world = a.at || { x: center.x - 60, y: center.y - 150 + (count - 1) * 150 };
      const client = worldToClient(world.x, world.y);
      tk.caption(a.caption || `put “${truncatePreview(a.text, 42)}” on the page`);
      await tk.click(client.x, client.y);
      const id = spawnTextAtWorld(a.text, world, { silent: true });
      ctx.vars.lastItemId = id;
      if (a.saveAs) ctx.vars[a.saveAs] = id;
      await tk.wait(450);
    },
    createFunction: async (a, tk, ctx) => {
      tk.caption(a.caption || `create a new function: “${a.name}”`);
      const plus = tk.elementCenter(".cognition-git-new");
      if (plus) await tk.click(plus.x, plus.y);
      const steps = (a.steps || []).map((s) => (typeof s === "string" ? { name: s, description: "" } : s));
      const tree = steps.length
        ? {
            name: a.name,
            description: a.description || "",
            steps: steps.map((s) => ({
              name: s.name,
              description: s.description || "",
              prompt: buildDefaultLeafPrompt(s.name, s.description),
            })),
          }
        : {
            name: a.name,
            description: a.description || "",
            prompt: buildDefaultLeafPrompt(a.name, a.description),
          };
      const { ops, rootId } = treeToOperators(tree, { top: true });
      setOperators((prev) => [...prev, ...ops]);
      const rootOp = ops.find((o) => o.id === rootId);
      syncTransformationRepoForOperator(rootId, rootOp, {
        isNew: true,
        stepNames: steps.map((s) => s.name),
        commitMessage: "created with the companion",
      });
      ctx.vars.lastOpId = rootId;
      if (a.saveAs) ctx.vars[a.saveAs] = rootId;
      focusRailPane(RAIL_TRANSFORMATIONS);
      pulseFunctionsRail();
      await tk.wait(750);
      const row = directorOpRowCenter(tk, rootOp);
      if (row) {
        await tk.moveTo(row.x, row.y);
        if (steps.length) tk.caption(`${steps.length} steps compose into one reusable move`);
        await tk.wait(900);
      }
    },
    applyFunction: async (a, tk, ctx) => {
      const op = directorResolveOp(a.op, ctx);
      const item = directorResolveItem(a.target, ctx);
      if (!op) throw new Error(`no function called “${a.op}”`);
      if (!item) throw new Error("no object on the page to apply it to");
      tk.caption(a.caption || `drag “${op.name}” onto the object`);
      const row = directorOpRowCenter(tk, op);
      const at = directorItemClientCenter(item);
      if (row) {
        await tk.moveTo(row.x, row.y);
        await tk.press(op.name);
        await tk.moveTo(at.x, at.y, 950);
        await tk.release();
      } else {
        await tk.click(at.x, at.y);
      }
      runOperator(op, [item.id], {});
      tk.caption(`“${op.name}” is thinking…`);
      await directorWaitForJobs(tk);
      const node = directorLatestAiNode(ctx);
      if (node) ctx.vars.lastAiNodeId = node.id;
      tk.caption("the result blooms in the AI layer, branching from its source");
      await tk.wait(1500);
    },
    dragItemToAi: async (a, tk, ctx) => {
      const item = directorResolveItem(a.target, ctx);
      if (!item) throw new Error("no object to move");
      const from = directorItemClientCenter(item);
      const rect = aiViewportRef.current?.getBoundingClientRect();
      const to = rect
        ? { x: rect.left + rect.width * 0.45, y: rect.top + rect.height * 0.45 }
        : { x: window.innerWidth * 0.86, y: window.innerHeight * 0.42 };
      tk.caption(a.caption || "drag it across the boundary into the AI space");
      await tk.moveTo(from.x, from.y);
      await tk.press(truncatePreview(item.text || "object", 18));
      await tk.moveTo(to.x, to.y, 1000);
      await tk.release();
      const world = getAiDropWorldFromClient(to.x, to.y);
      await expandInAi([item.id], { expandedAt: world, stableCamera: true });
      const node = directorLatestAiNode(ctx);
      if (node) ctx.vars.lastAiNodeId = node.id;
      await directorWaitForJobs(tk);
      await tk.wait(600);
    },
    applyFunctionToAiNode: async (a, tk, ctx) => {
      const op = directorResolveOp(a.op, ctx);
      const node = directorLatestAiNode(ctx);
      if (!op) throw new Error(`no function called “${a.op}”`);
      if (!node) throw new Error("no AI node to branch from");
      const row = directorOpRowCenter(tk, op);
      const at = directorAiClientPoint(node.x, node.y);
      tk.caption(a.caption || `drop “${op.name}” onto the node to branch it further`);
      if (row) {
        await tk.moveTo(row.x, row.y);
        await tk.press(op.name);
        await tk.moveTo(at.x, at.y, 950);
        await tk.release();
      }
      applyOperatorToAiNode(node, op, { x: at.x, y: at.y }, { stableCamera: true });
      await directorWaitForJobs(tk);
      const next = directorLatestAiNode(ctx);
      if (next) ctx.vars.lastAiNodeId = next.id;
      await tk.wait(800);
    },
    focusAiResult: async (a, tk, ctx) => {
      const node = directorLatestAiNode(ctx);
      if (!node) return;
      const c = directorAiClientPoint(node.x, node.y);
      await tk.moveTo(c.x, c.y);
      zoomAiToNode(node);
      tk.caption(a.caption || "zoom in — the circle relaxes into readable text");
      await tk.wait(1500);
    },
    dragAiResultToPaper: async (a, tk, ctx) => {
      const node = directorLatestAiNode(ctx);
      if (!node) throw new Error("no AI result to bring back yet");
      const from = directorAiClientPoint(node.x, node.y);
      const center = paperViewportCenterWorld();
      const to = worldToClient(center.x, center.y + 120);
      tk.caption(a.caption || "drag the result back onto paper to keep it");
      await tk.moveTo(from.x, from.y);
      await tk.press("result");
      await tk.moveTo(to.x, to.y, 1000);
      await tk.release();
      transferAiNodesToPaper([node.id], clientToWorld(to.x, to.y));
      await tk.wait(700);
    },
    highlight: async (a, tk, ctx) => {
      setTool("highlight");
      const refsList = a.targets || ["last"];
      const targets = refsList.map((t) => directorResolveItem(t, ctx)).filter(Boolean);
      if (!targets.length) throw new Error("nothing to highlight");
      tk.caption(a.caption || "sweep the highlighter — every stroke adds to one living selection");
      for (const it of targets) {
        const c = directorItemClientCenter(it);
        await tk.moveTo(c.x - 44, c.y);
        await tk.press();
        await tk.moveTo(c.x + 48, c.y, 420);
        await tk.release();
        accumulateHighlightSelection([it.id], true);
        await tk.wait(200);
      }
      await tk.wait(500);
    },
    captureThread: async (a, tk, ctx) => {
      const item = directorResolveItem(a.target, ctx);
      const ids = item ? [item.id] : highlightSelectionRef.current;
      if (!ids?.length) throw new Error("nothing to capture");
      if (item) {
        const c = directorItemClientCenter(item);
        await tk.click(c.x, c.y);
      }
      tk.caption(a.caption || "capture the whole path that produced this as one reusable function");
      captureMaterialAsFunction(Array.isArray(ids) ? ids : [...ids], {});
      focusRailPane(RAIL_TRANSFORMATIONS);
      pulseFunctionsRail();
      await tk.wait(1000);
    },
    showLenses: async (a, tk) => {
      focusRailPane(RAIL_LENSES);
      const pane = tk.elementCenter(".rail-lenses-pane");
      if (pane) await tk.moveTo(pane.x, pane.y);
      tk.caption(a.caption || "lenses live here — symbols, saved pages, ways of seeing");
      await tk.wait(1200);
    },
    waitForJobs: async (a, tk) => directorWaitForJobs(tk),
    savePageAsLens: async (a, tk) => {
      const chip = tk.elementCenter(".page-title-save-lens");
      if (chip) await tk.click(chip.x, chip.y);
      tk.caption(a.caption || "the whole page becomes a lens — draw a glyph to name what it means");
      savePageAsLens();
      await tk.wait(1400);
    },
  });

  async function handleCompanionCommand(text) {
    const demosMeta = COMPANION_DEMOS.map((d) => ({ id: d.id, title: d.title, blurb: d.blurb }));
    const functionNames = operators
      .filter((o) => o.top || o.move)
      .map((o) => o.name)
      .filter(Boolean)
      .slice(0, 30);
    const itemPreviews = itemsRef.current
      .map((it) => truncatePreview(it.text || "", 40))
      .filter(Boolean)
      .slice(0, 12);
    let reply = null;
    try {
      const raw = await runClaude("Translate this request into a director script per the system instructions.", text, {
        system: buildCompanionSystemPrompt({ demos: demosMeta, functionNames, itemPreviews }),
        maxTokens: 1600,
        timeoutMs: 45000,
      });
      reply = parseCompanionReply(raw);
    } catch (err) {
      const fallback = matchDemoLocally(text, COMPANION_DEMOS);
      if (!fallback) throw new Error("I couldn't reach the model — try again in a moment.");
      reply = { say: `let me show you — ${fallback.title.toLowerCase()}.`, demoId: fallback.id, steps: [] };
    }
    const demo = reply.demoId ? findDemo(reply.demoId) : null;
    const steps = demo ? demo.steps : reply.steps;
    if (steps?.length) {
      // fire-and-forget: the ghost cursor takes over while chat stays responsive
      runDirectorScript(steps, { title: demo?.title || "demonstration" });
    }
    return reply.say || (demo ? `watch — ${demo.title.toLowerCase()}.` : steps?.length ? "watch." : "done.");
  }

  const tourState = useMemo(
    () => ({
      items,
      camera,
      aiCamera,
      aiNodes,
      operators,
      lenses,
      highlightSelection: highlightSelectionIds,
      expandCanvasTools: () => setExpandToolsSignal((n) => n + 1),
      setTool,
      expandAiToolbox: () => {
        setRailPulse(true);
        window.setTimeout(() => setRailPulse(false), 1200);
      },
      setToolboxTab: (tab) => {
        focusRailPane(tab);
      },
    }),
    [items, camera, aiCamera, aiNodes, operators, lenses, highlightSelectionIds]
  );

  const paperColWidth = Math.max(0, colGridWidth - columnLayout.left - columnLayout.right - 24);
  const leftColCollapsed = columnLayout.left <= 0;
  const rightColCollapsed = columnLayout.right <= 0;
  const paperColCollapsed = colGridWidth > 0 && paperColWidth <= 0;

  return (
    <div className={"idea-app theme-" + theme}>
      <TopToolbar
        starred={docStarred}
        saved={savedIndicator}
        canUndo={canUndo}
        canRedo={canRedo}
        onToggleStar={() => setDocStarred((s) => !s)}
        onMenuAction={handleMenuAction}
        onUndo={undo}
        onRedo={redo}
        onShare={handleShareBoard}
        account={
          isSupabaseConfigured() && supaAuth.sessionResolved
            ? supaAuth.session
              ? { email: supaAuth.session.user?.email || "your account" }
              : { email: null }
            : null
        }
        planBadge={
          supaAuth.session && !userPlan.loading && !userPlan.error
            ? planBadgeLabel(userPlan.effective)
            : null
        }
        showPlans={isSupabaseConfigured() && supaAuth.sessionResolved}
        onAccountAction={handleAccountAction}
      />

      <div
        ref={threeColumnGridRef}
        className={"three-column-grid" + (columnResizing ? " column-resizing" : "") + (transferDragActive ? " transfer-drag" : "")}
        style={{
          "--col-left-w": `${columnLayout.left}px`,
          "--col-right-w": `${columnLayout.right}px`,
        }}
      >
        <FunctionsColumn
          columnRef={functionsColumnRef}
          collapsed={leftColCollapsed}
          dropOver={railDropOver}
          onPointerTrack={(cx, cy) => {
            lastPointerRef.current = { cx, cy };
          }}
          onDragOver={(e) => {
            if (
              e.dataTransfer.types.includes(OP_MIME) ||
              e.dataTransfer.types.includes(STRUCT_MIME) ||
              e.dataTransfer.types.includes(SEL_MIME) ||
              e.dataTransfer.types.includes(THOUGHT_MIME) ||
              e.dataTransfer.types.includes(SKETCH_BUNDLE_MIME)
            ) {
              e.preventDefault();
              setRailDropOver(true);
              e.dataTransfer.dropEffect = "copy";
              const dropTarget = resolveLeftColumnDropTarget(e.clientX, e.clientY);
              if (dropTarget === RAIL_LENSES) {
                setSymbolDropTargetId(structCardAtClient(e.clientX, e.clientY));
              } else {
                setSymbolDropTargetId(null);
              }
            }
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) {
              setRailDropOver(false);
              setSymbolDropTargetId(null);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            setRailDropOver(false);
            setSymbolDropTargetId(null);
            const ids = idsFromMaterialTransfer(e);
            if (ids?.length) {
              applyLeftColumnMaterialDrop(ids, e.clientX, e.clientY);
              return;
            }
            const opId = e.dataTransfer.getData(OP_MIME);
            if (opId) {
              pinOpToToolbox(opId);
              return;
            }
            const structId = e.dataTransfer.getData(STRUCT_MIME);
            if (structId) {
              focusRailPane(RAIL_LENSES);
              showToast("already saved");
            }
          }}
        >
          <aside
            ref={railRef}
            className={"board-rail functions-board-rail" + (railDropOver ? " drop-over" : "") + (railPulse ? " rail-pulse" : "")}
            data-tour="functions-toolbox"
          >
            <section ref={functionsSectionRef} className="rail-pane rail-functions-pane cognition-git-pane" data-tour="functions-section">
              <CognitionGitHeader
                activeTransformation={activeTransformation}
                transformationCount={displayTransformations.length}
                onNewTransformation={openCreateLens}
              />
              <div className="move-quick-add">
                <input className="move-quick-input" placeholder="quick move — e.g. treat as garden" value={moveDraft} onChange={(e) => setMoveDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") createMove(); }} />
                <button type="button" className="move-quick-btn" disabled={!moveDraft.trim()} onClick={() => createMove()}>+</button>
              </div>
              <div className="rail-scroll">
                {transformationRepoGroups.length > 0 &&
                  transformationRepoGroups.map((repo) => (
                    <div key={repo.root.id} className="git-repo-group">
                      {renderLensCard(repo.root, { depth: 0 })}
                      {repo.branches.map((lens) => renderLensCard(lens, { depth: 1 }))}
                      {repo.forks.map((lens) => renderLensCard(lens, { depth: 1 }))}
                    </div>
                  ))}
                {moves.length > 0 && (<><div className="rail-section">Quick moves</div>{moves.map((op) => (<DraggableOpCard key={op.id} op={op} opMap={opMap} expanded={expanded} onToggle={(id) => setExpanded((e) => ({ ...e, [id]: !e[id] }))} onEdit={openEditLens} onCompose={composeOperators} onShare={() => shareOperator(op.id)} onExplore={(o) => openTransferExplore(o.id)} onRun={runFunctionFromRail} flat />))}</>)}
                {primitives.length > 0 && (<><div className="rail-section">Built-in</div><div className="op-chip-grid">{primitives.map((op) => (<DraggableOpCard key={op.id} op={op} opMap={opMap} expanded={expanded} onToggle={(id) => setExpanded((e) => ({ ...e, [id]: !e[id] }))} onEdit={openEditLens} onCompose={composeOperators} onShare={() => shareOperator(op.id)} onExplore={(o) => openTransferExplore(o.id)} onRun={runFunctionFromRail} flat chip />))}</div></>)}
                {basics.length > 0 && (<><div className="rail-section">Library</div>{basics.map((op) => (<DraggableOpCard key={op.id} op={op} opMap={opMap} expanded={expanded} onToggle={(id) => setExpanded((e) => ({ ...e, [id]: !e[id] }))} onEdit={openEditLens} onCompose={composeOperators} onShare={() => shareOperator(op.id)} onExplore={(o) => openTransferExplore(o.id)} onRun={runFunctionFromRail} flat />))}</>)}
              </div>
            </section>
            <section ref={lensesSectionRef} className="rail-pane rail-lenses-pane" data-tour="lenses-tab">
              <h3 className="rail-pane-heading">
                lenses {lenses.length ? `(${lenses.length})` : ""}
              </h3>
              <div className="rail-scroll">
                {lenses.filter((s) => s?.id).map((struct) => (
                  <PatternLensCard
                    key={struct.id}
                    struct={struct}
                    dropTarget={symbolDropTargetId === struct.id}
                    onMaterialDragOver={() => setSymbolDropTargetId(struct.id)}
                    onMaterialDragLeave={() =>
                      setSymbolDropTargetId((prev) => (prev === struct.id ? null : prev))
                    }
                    onMaterialDrop={handleStructCardMaterialDrop}
                    onDelete={() => deletePatternLens(struct.id)}
                    onShare={() => sharePatternLens(struct)}
                    onEditSymbol={() => openLensDrawPrompt(struct)}
                    onEditViewLens={() => openEditLensApplyPrompt(struct)}
                    onSettings={() => setLensSettingsId(struct.id)}
                  />
                ))}
              </div>
            </section>
            <JobPanel jobs={jobs} onDismiss={(id) => setJobs((j) => j.filter((x) => x.id !== id))} />
            <button type="button" className="rail-fresh" onClick={() => setFreshConfirm(true)}>Start fresh</button>
          </aside>
        </FunctionsColumn>

        <InterpretBoundary
          variant="tools-paper"
          resizeEdge="left"
          onResizeStart={startColumnBoundaryResize}
          resizing={columnResizing === "left"}
        />

        <CanvasColumn
          collapsed={paperColCollapsed}
          tool={tool}
          imageArmed={imageArmed}
          dropOver={canvasDropOver}
          boundaryMagnet={boundaryMagnetActive}
          expandToolsSignal={expandToolsSignal}
          onTourEvent={emitTourEvent}
          onSelectTool={(id) => {
            if (id !== "image") {
              pendingImageRef.current = null;
              setImageArmed(false);
            }
            emitTourEvent("tool-" + id);
            setTool(id);
          }}
          onInsertBlock={insertBlockFromPalette}
          onPickImage={pickImage}
          pages={pages}
          activePageId={activePageId}
          zoomPct={Math.round(camera.scale * 100)}
          onSelectPage={switchPage}
          onAddPage={addPage}
          onRenamePage={renamePage}
          onZoomIn={() => {
            const r = vpRect();
            const c = camRef.current;
            const next = zoomCamera(c, ZOOM_STEP);
            const local = { x: r.width / 2, y: r.height / 2 };
            const world = screenToWorld(c, local.x, local.y);
            animateCameraTo(world, next.scale, 320);
          }}
          onZoomOut={() => {
            const r = vpRect();
            const c = camRef.current;
            const next = zoomCamera(c, 1 / ZOOM_STEP);
            const local = { x: r.width / 2, y: r.height / 2 };
            const world = screenToWorld(c, local.x, local.y);
            animateCameraTo(world, next.scale, 320);
          }}
          onZoomReset={() => {
            const r = vpRect();
            animateCameraDirect(fitPaperInView(r.width, r.height), 520);
          }}
          paperRecording={paperRecording}
          paperRecordLevel={paperRecordLevel}
          paperRecordMs={paperRecordMs}
          onTogglePaperRecord={togglePaperRecord}
        >
      <div className={"board-main" + (dropReady ? " drop-ready" : "") + (boundaryMagnetActive ? " boundary-magnet" : "") + (transferDragActive ? " transfer-drag" : "") + (editing ? " editing-text" : "") + (dropTargetId ? " drop-has-target" : "")}>
      <div className="page-title-chip" data-tour="page-title" onPointerDown={(e) => e.stopPropagation()}>
        <input
          className="page-title-input"
          value={docTitle}
          onChange={(e) => setDocTitle(e.target.value)}
          aria-label="Page title"
          placeholder="Untitled idea"
        />
        <button
          type="button"
          className="page-title-save-lens"
          onClick={savePageAsLens}
          title="Save this page as a lens"
        >
          ◇
        </button>
      </div>
      <div
        ref={viewportRef}
        className="viewport"
        data-tour="paper-canvas"
        onPointerDown={
          editing
            ? (e) => {
                if (!e.target.closest?.(".board-text.editing")) finishEditing();
              }
            : undefined
        }
      >
        <div
          className="world"
          style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})` }}
        >
          <div
            className="paper-sheet"
            style={{ width: PAPER_WIDTH, height: PAPER_HEIGHT }}
          >
            <div className="paper-content" style={{ width: PAPER_WIDTH, height: PAPER_HEIGHT }}>
          {/* branch arrows between notes */}
          <svg className="link-layer">
            <defs>
              <marker
                id="board-link-arrow"
                markerWidth="9"
                markerHeight="9"
                refX="8"
                refY="4.5"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M0,0 L9,4.5 L0,9 Z" fill={INK} fillOpacity="0.55" />
              </marker>
            </defs>
            {boardLinks.map((link) => {
              if (!selection.includes(link.fromId) && !selection.includes(link.toId)) return null;
              const from = visibleItems.find((i) => i.id === link.fromId) || items.find((i) => i.id === link.fromId);
              const to = visibleItems.find((i) => i.id === link.toId) || items.find((i) => i.id === link.toId);
              if (!from || !to) return null;
              const fromC = noteCenter(from);
              const toC = noteCenter(to);
              if (!fromC || !toC) return null;
              const a = linkEndpoint(from, toC);
              const b = linkEndpoint(to, fromC);
              return (
                <path
                  key={link.id}
                  d={linkCurvePath(a, b)}
                  className="board-link"
                  fill="none"
                  stroke={INK}
                  strokeWidth={2}
                  strokeOpacity={0.5}
                  strokeLinecap="round"
                  markerEnd="url(#board-link-arrow)"
                />
              );
            })}
          </svg>

          {/* committed strokes */}
          <svg className="ink-layer">
            {visibleItems
              .filter((it) => it.type === "stroke" && !it.highlight)
              .map((it) => (
                <g key={it.id}>
                  {it.instructionText && <title>{it.instructionText}</title>}
                  {!it.instructionText && it.paperSessionId && <title>Linked to voice recording</title>}
                  <polyline
                    data-item={it.id}
                    points={it.points.map((p) => `${p.x},${p.y}`).join(" ")}
                    fill="none"
                    stroke={it.highlight ? HIGHLIGHT_INK : it.color || PAPER_INK}
                    strokeWidth={it.highlight ? highlightWorldWidth(camera.scale) : it.width}
                    strokeOpacity={it.highlight ? HIGHLIGHT_OPACITY : it.marker ? MARKER_OPACITY : 1}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={
                      (selection.includes(it.id) ? " sel" : "") +
                      (highlightSelectionSet.has(it.id) ? " hl-selected" : "") +
                      (highlightTouchSet.has(it.id) ? " hl-touch" : "") +
                      (highlightTransferringSet.has(it.id) ? " hl-transferring" : "") +
                      (it.highlight ? " hl-stroke" : "") +
                      (it.loop ? " hl-loop-fill" : "") +
                      (it.instructionText || it.paperSessionId || it.recordingSessionId
                        ? " voice-linked"
                        : "")
                    }
                  />
                </g>
              ))}
            {draft && draft.points.length >= 1 && (
              <>
                {draft.points.length === 1 ? (
                  <circle
                    className="draft-dot"
                    cx={draft.points[0].x}
                    cy={draft.points[0].y}
                    r={
                      draft.highlight
                        ? highlightWorldWidth(camera.scale) / 2
                        : draft.marker
                        ? MARKER_W / 2
                        : PEN_W / 2
                    }
                    fill={draft.highlight ? HIGHLIGHT_INK : INK}
                    fillOpacity={draft.highlight ? HIGHLIGHT_OPACITY : draft.marker ? 0.32 : 1}
                  />
                ) : (
                  <>
                    <polyline
                      className={
                        "draft-stroke" +
                        (draft.highlight ? " hl-stroke" : "") +
                        (draft.loop ? " hl-loop" : "") +
                        (paperRecording ? " voice-linked" : "")
                      }
                      points={draft.points.map((p) => `${p.x},${p.y}`).join(" ")}
                      fill={draft.loop ? "rgba(240, 240, 240, 0.05)" : "none"}
                      stroke={draft.loop ? PAPER_INK : draft.highlight ? HIGHLIGHT_INK : INK}
                      strokeWidth={
                        draft.highlight
                          ? highlightWorldWidth(camera.scale)
                          : draft.marker
                          ? MARKER_W
                          : PEN_W
                      }
                      strokeOpacity={draft.loop ? 0.4 : draft.highlight ? 0.88 : draft.marker ? 0.32 : 1}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {draft.loop && draft.points.length > 2 && (
                      <line
                        className="hl-loop-close"
                        x1={draft.points[draft.points.length - 1].x}
                        y1={draft.points[draft.points.length - 1].y}
                        x2={draft.points[0].x}
                        y2={draft.points[0].y}
                        stroke={PAPER_INK}
                        strokeWidth={1.5 / camera.scale}
                        strokeOpacity={0.35}
                        strokeDasharray={`${6 / camera.scale} ${4 / camera.scale}`}
                      />
                    )}
                  </>
                )}
              </>
            )}
          </svg>

          {/* text + images */}
          {visibleItems
            .filter((it) => it.type !== "stroke" && it.type !== "link")
            .map((it) => {
              if (it.type === "image") {
                return (
                  <img
                    key={it.id}
                    data-item={it.id}
                    className={"board-img" + (selection.includes(it.id) ? " sel" : "") + (highlightSelectionSet.has(it.id) ? " hl-selected" : "") + (highlightTouchSet.has(it.id) ? " hl-touch" : "") + (highlightTransferringSet.has(it.id) ? " hl-transferring" : "") + (dropTargetId === it.id ? " drop-target" : "") + (dropReady && dropTargetId === it.id ? " drop-magnetic" : "")}
                    src={it.src}
                    style={{ ...itemStyle(it), width: it.w, height: it.h }}
                    alt=""
                  />
                );
              }
              if (it.type === "text") {
                return (
                  <BoardText
                    key={it.id}
                    item={it}
                    selected={selection.includes(it.id)}
                    bornGold={goldBornIds.has(it.id)}
                    highlightTouched={highlightTouchSet.has(it.id)}
                    highlightSelected={highlightSelectionSet.has(it.id)}
                    highlightTransferring={highlightTransferringSet.has(it.id)}
                    dropTarget={dropTargetId === it.id}
                    dropMagnetic={dropReady && dropTargetId === it.id}
                    editing={editing === it.id}
                    editClickRef={editClickRef}
                    onCommit={(text) => commitEdit(it.id, text)}
                    onResizeWidth={(w) => updateItem(it.id, { w })}
                  />
                );
              }
              return (
                <BoardBlockItem
                  key={it.id}
                  item={it}
                  selected={selection.includes(it.id)}
                  bornGold={goldBornIds.has(it.id)}
                  highlightTouched={highlightTouchSet.has(it.id)}
                  highlightSelected={highlightSelectionSet.has(it.id)}
                  highlightTransferring={highlightTransferringSet.has(it.id)}
                  dropTarget={dropTargetId === it.id}
                  dropMagnetic={dropReady && dropTargetId === it.id}
                  editing={editing === it.id}
                  editClickRef={editClickRef}
                  onCommit={(text) => commitEdit(it.id, text)}
                  onResizeWidth={(w) => updateItem(it.id, { w })}
                  itemStyle={itemStyle}
                />
              );
            })}

          {/* golden glow for highlight selection */}
          {highlightSelectionIds.length > 0 && (
            <svg className="highlight-glow-layer" aria-hidden="true">
              {highlightSelectionIds.map((id) => {
                const it = visibleItems.find((i) => i.id === id);
                if (!it) return null;
                const bb = selectionWorldBBoxForIds([id]);
                if (!bb) return null;
                const pad = 10;
                const x = bb.minx - pad;
                const y = bb.miny - pad;
                const w = bb.maxx - bb.minx + pad * 2;
                const h = bb.maxy - bb.miny + pad * 2;
                return (
                  <rect
                    key={id}
                    className={
                      "highlight-glow-rect" +
                      (highlightTransferringSet.has(id) ? " transferring" : "")
                    }
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    rx={8}
                  />
                );
              })}
            </svg>
          )}

          {/* selection handles */}
          {selection.length > 1 && (
            <div
              className="sel-box"
              style={{
                left: selBBox.minx - 10,
                top: selBBox.miny - 10,
                width: selBBox.maxx - selBBox.minx + 20,
                height: selBBox.maxy - selBBox.miny + 20,
              }}
            />
          )}
            </div>
            <span className="paper-edge-label">8 × 11.5</span>
          </div>
        </div>

        {/* live lasso (viewport-local space) */}
        {lasso && (
          <div
            className="lasso"
            style={{
              left: Math.min(lasso.x0, lasso.x1),
              top: Math.min(lasso.y0, lasso.y1),
              width: Math.abs(lasso.x1 - lasso.x0),
              height: Math.abs(lasso.y1 - lasso.y0),
            }}
          />
        )}
      </div>

      {strokeTooltip && (
        <div
          className="stroke-voice-tooltip"
          style={{ left: strokeTooltip.x + 12, top: strokeTooltip.y + 12 }}
        >
          {strokeTooltip.text}
        </div>
      )}

      {/* dedicated input surface — all canvas tools attach here */}
      <div
        ref={inputLayerRef}
        className={"canvas-input-layer " + cursorClass}
        onPointerDown={onPointerDown}
        onPointerMove={(e) => {
          if (gesture.current || paperRecording) {
            if (!paperRecording) setStrokeTooltip(null);
            return;
          }
          const cx = e.clientX;
          const cy = e.clientY;
          if (toolRef.current === "highlight" && highlightSelectionRef.current.length) {
            const hlSel = highlightSelectionRef.current;
            const hit = itemAtPoint(cx, cy);
            setHighlightGrabHover(!!(hit && hlSel.includes(hit.id)));
          } else if (highlightGrabHover) {
            setHighlightGrabHover(false);
          }
          const hit = itemAtPoint(cx, cy);
          if (hit?.type === "stroke" && (hit.instructionText || hit.paperSessionId)) {
            setStrokeTooltip({
              text: hit.instructionText || "Linked to voice recording",
              x: e.clientX,
              y: e.clientY,
              id: hit.id,
            });
          } else {
            setStrokeTooltip(null);
          }
        }}
        onDoubleClick={onDoubleClick}
        onDragOver={(e) => {
          if (
            e.dataTransfer.types.includes(OP_MIME) ||
            e.dataTransfer.types.includes(LENS_MIME) ||
            e.dataTransfer.types.includes(STRUCT_MIME) ||
            e.dataTransfer.types.includes(AI_OUTPUT_MIME) ||
            e.dataTransfer.types.includes("Files")
          ) {
            e.preventDefault();
            setDropReady(true);
            setCanvasDropOver(true);
            if (e.dataTransfer.types.includes(OP_MIME) || e.dataTransfer.types.includes(LENS_MIME)) {
              e.dataTransfer.dropEffect = "copy";
              const hit = itemAtPointForDrop(e.clientX, e.clientY);
              const sel = selRef.current;
              if (hit) setDropTargetId(hit.id);
              else if (sel.length === 1) setDropTargetId(sel[0]);
              else setDropTargetId(null);
            } else if (e.dataTransfer.types.includes(AI_OUTPUT_MIME)) {
              e.dataTransfer.dropEffect = "copy";
            }
          }
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            setDropReady(false);
            setDropTargetId(null);
            setCanvasDropOver(false);
          }
        }}
        onDrop={(e) => {
          setDropReady(false);
          setDropTargetId(null);
          setCanvasDropOver(false);
          e.preventDefault();
          const aiOut = e.dataTransfer.getData(AI_OUTPUT_MIME);
          if (aiOut) {
            const w = clientToWorld(e.clientX, e.clientY);
            spawnTextAtWorld(aiOut, w);
            return;
          }
          const opId = e.dataTransfer.getData(OP_MIME);
          if (opId) {
            applyOpDrop(opId, { x: e.clientX, y: e.clientY });
            return;
          }
          const lensId = e.dataTransfer.getData(LENS_MIME);
          if (lensId) {
            applyTransformationLensDrop(lensId, { x: e.clientX, y: e.clientY });
            return;
          }
          const structId = e.dataTransfer.getData(STRUCT_MIME);
          if (structId) {
            applyPatternLensDrop(structId, { x: e.clientX, y: e.clientY });
            return;
          }
          if (e.dataTransfer.files?.length) {
            const w = clientToWorld(e.clientX, e.clientY);
            addImage(e.dataTransfer.files[0], w);
          }
        }}
      />

      {symbolDrawPrompt && (
        <SymbolDrawOverlay
          title={symbolDrawPrompt.title}
          meaning={
            lenses.find((s) => s.id === symbolDrawPrompt.structId)?.interpretation?.meaning
          }
          interpreting={symbolInterpretingId === symbolDrawPrompt.structId}
          onComplete={(stroke) => completeSymbolDraw(symbolDrawPrompt.structId, stroke)}
          onDone={() => {
            setSymbolDrawPrompt(null);
            showToast("lens saved");
          }}
          onCancel={() => {
            setSymbolDrawPrompt(null);
            setSymbolInterpretingId(null);
            showToast("symbol skipped — idea saved");
          }}
        />
      )}

      {/* brand moved to rail — canvas stays clean */}
      </div>
        </CanvasColumn>

        <InterpretBoundary
          dropOver={boundaryDropOver}
          magnetActive={boundaryMagnetActive || transferDragActive}
          loading={!!aiPanel?.loading}
          resizeEdge="right"
          onResizeStart={startColumnBoundaryResize}
          resizing={columnResizing === "right"}
          onDragOver={handleBoundaryDragOver}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) {
              setBoundaryDropOver(false);
              setTransferDragActive(false);
            }
          }}
          onDrop={handleBoundaryDrop}
        />

        <AiColumn
          collapsed={rightColCollapsed}
          nodes={aiNodes}
          camera={aiCamera}
          onCameraChange={setAiCamera}
          selectedNodeIds={selectedAiNodeIds}
          onSelectNode={handleAiNodeSelect}
          onMoveNode={moveAiNode}
          tool={tool}
          onHighlightTransferStart={(e, nodeIds, opts = {}) => {
            startAiHighlightTransfer(e, nodeIds, opts);
          }}
          onHighlightMark={toggleHighlightAiNode}
          highlightMarkedIds={highlightAiNodeSet}
          onSpaceTransferStart={(e, nodeIds, opts = {}) => {
            const ids = nodeIds?.length ? nodeIds : selectedAiNodeIdsRef.current;
            if (!ids.length) return;
            startPendingSpaceTransfer(e, "ai", ids, {
              kind: opts.kind ?? (toolRef.current === "highlight" ? "highlight" : null),
              immediate: opts.immediate,
              fragment: opts.fragment || null,
            });
          }}
          shouldHandoffNodeDrag={shouldHandoffAiNodeDrag}
          onFragmentReplace={(fragment) => transferFragmentReplaceRef.current(fragment)}
          onFragmentToPaper={(fragment, opts) => transferFragmentToPaperRef.current(fragment, opts)}
          isPaperDestination={(x, y) => isOverPaperColumn(x, y)}
          viewportRef={aiViewportRef}
          canvasDropOver={aiCanvasDropOver}
          onCanvasDragOver={handleAiCanvasDragOver}
          onCanvasDragLeave={() => setAiCanvasDropOver(false)}
          onCanvasDrop={handleAiCanvasDrop}
          onExploreNode={(nodeId) => exploreAiNode(nodeId, { runExpand: false })}
          onFocusFromZoom={focusAiNodeFromZoom}
          onReturnToConstellation={returnAiToConstellation}
          focusedNodeId={aiFocusedNodeId}
          onTourEvent={emitTourEvent}
          getStrandChoices={getStrandChoicesForNode}
          onStrandSelect={handleStrandSelect}
          onExpandNode={(nodeId) => exploreAiNode(nodeId, { runExpand: true })}
          onPointerTrack={(cx, cy) => {
            lastPointerRef.current = { cx, cy };
          }}
          landingNodeIds={aiLandingNodeIds}
          growingEdgeIds={growingAiEdgeIds}
          dropOver={aiDropOver}
          onDragOver={(e) => {
            if (
              e.dataTransfer.types.includes(THOUGHT_MIME) ||
              e.dataTransfer.types.includes(SEL_MIME) ||
              e.dataTransfer.types.includes(OP_MIME) ||
              e.dataTransfer.types.includes(PAPER_SESSION_MIME) ||
              e.dataTransfer.types.includes(SKETCH_BUNDLE_MIME) ||
              e.dataTransfer.types.includes(AI_OUTPUT_MIME)
            ) {
              e.preventDefault();
              setAiDropOver(true);
              setTransferDragActive(true);
              e.dataTransfer.dropEffect = "copy";
            }
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) {
              setAiDropOver(false);
              setTransferDragActive(false);
            }
          }}
          onDrop={handleAiDrop}
        />
      </div>

      {selItem && isReplayableItem(selItem) && !walking && !stagesItemId && (
        <button
          type="button"
          className="item-stages-trigger"
          style={{
            left: itemScreenBBox(selItem).right - 6,
            top: itemScreenBBox(selItem).top - 6,
          }}
          onClick={(e) => {
            e.stopPropagation();
            openItemStages(selItem.id);
          }}
          title="Operator stages"
        >
          ◷
        </button>
      )}

      {itemStages && (
        <ItemStagesPanel
          title={itemStages.title}
          stages={itemStages.stages}
          onClose={() => setStagesItemId(null)}
        />
      )}

      {transferExploreRecord && (
        <TransferExplorePanel
          op={transferExploreOp}
          transfer={transferExploreRecord}
          currentMaterial={selectedMaterialText}
          currentDomain={selectedMaterialDomain}
          testingDomain={transferTestingDomain}
          enriching={transferExploreOpId && enrichingTransferIds.has(transferExploreOpId)}
          onClose={() => setTransferExploreOpId(null)}
          onTestDomain={(domain) => testTransferInDomain(transferExploreOpId, domain)}
          onShare={() => shareOperator(transferExploreOpId)}
          onEdit={() => {
            setTransferExploreOpId(null);
            openEditLens(transferExploreOp);
          }}
        />
      )}

      {transferRecognition && !walking && !stagesItemId && (
        <div className="transfer-recognition-bar">
          <span>{transferRecognition.hint}</span>
          <button
            type="button"
            onClick={() => openTransferExplore(transferRecognition.matches[0].op.id)}
          >
            explore
          </button>
        </div>
      )}

      {walking && walkStep && (
        <WalkOverlay
          walk={walking}
          stepIndex={walking.stepIndex}
          step={walkStep}
          rects={walkFocusRects}
          onPrev={() => walkTo(walking.stepIndex - 1)}
          onNext={() =>
            walking.stepIndex >= walking.steps.length - 1 ? endWalk() : walkTo(walking.stepIndex + 1)
          }
          onBranch={continueFromWalk}
          onDistill={
            walking.nodeId
              ? () => {
                  const nodeId = walking.nodeId;
                  endWalk();
                  captureThreadAsOperator(nodeId);
                }
              : null
          }
          onShare={
            walking.nodeId
              ? () => shareJourneyLink(walking.nodeId)
              : null
          }
          onLeave={endWalk}
        />
      )}


      {toast && <div className="toast">{toast}</div>}

      {freshConfirm && (
        <div className="modal-scrim" onClick={() => setFreshConfirm(false)}>
          <div className="modal fresh-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Start fresh?</h3>
            <div className="modal-foot">
              <button type="button" onClick={() => setFreshConfirm(false)}>
                Cancel
              </button>
              <button type="button" className="primary del" onClick={confirmStartFresh}>
                Clear everything
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingShareBundle && !supaAuth.passwordRecovery && (
        <ShareWelcomeOverlay
          bundle={pendingShareBundle}
          railRef={railRef}
          canvasRef={viewportRef}
          onAccept={acceptPendingShare}
          onDismiss={dismissPendingShare}
        />
      )}

      {onboard && !supaAuth.passwordRecovery && (
        <Onboarding state={onboard} onStart={runOnboarding} onSkip={skipOnboarding} onClose={() => setOnboard(null)} />
      )}

      {(authOpen || supaAuth.passwordRecovery) && (
        <AuthOverlay
          forced={supaAuth.passwordRecovery}
          accountEmail={supaAuth.session?.user?.email || null}
          bootError={authBootError}
          onClose={() => {
            setAuthOpen(false);
            setAuthBootError(null);
          }}
          onPasswordUpdated={() => {
            supaAuth.clearPasswordRecovery();
            setAuthOpen(false);
            setAuthBootError(null);
            showToast("password updated");
          }}
        />
      )}

      {plansOpen && !supaAuth.passwordRecovery && (
        <PlansOverlay
          session={supaAuth.session}
          onClose={() => setPlansOpen(false)}
        />
      )}

      {tourActive && (
        <InteractiveTour
          stepIndex={tourStepIndex}
          tourContext={tourContextRef.current}
          tourState={tourState}
          onStepChange={setTourStepIndex}
          onComplete={completeFeatureTour}
          onSkipAll={completeFeatureTour}
        />
      )}

      {opEditor && (
        <LensTreeEditor
          editor={opEditor}
          opMap={opMap}
          operators={operators}
          paletteGroups={[
            { label: "your moves", ops: moves },
            { label: "primitives", ops: primitives },
            { label: "basics", ops: basics },
          ]}
          onClose={() => setOpEditor(null)}
          onSaveTree={handleSaveLensTree}
          onDelete={deleteLens}
          createFromProse={createFunctionFromProse}
          editFromProse={editFunctionWithProse}
          treeToOperators={treeToOperators}
        />
      )}

      {lensCompare?.aId && lensCompare?.bId && (
        <LensComparePanel
          a={transformationRepos.find((l) => l.id === lensCompare.aId) || displayTransformations.find((l) => l.id === lensCompare.aId)}
          b={transformationRepos.find((l) => l.id === lensCompare.bId) || displayTransformations.find((l) => l.id === lensCompare.bId)}
          opMap={opMap}
          onClose={() => setLensCompare(null)}
          onMerge={(aId, bId) => {
            mergeLenses(aId, bId);
            setLensCompare(null);
          }}
        />
      )}

      {lensHistoryId && (
        <LensHistoryPanel
          lens={displayTransformations.find((l) => l.id === lensHistoryId) || transformationRepos.find((l) => l.id === lensHistoryId)}
          lenses={displayTransformations}
          onClose={() => setLensHistoryId(null)}
          onCheckout={(id) => {
            setActiveTransformationId(id);
            setLensHistoryId(null);
          }}
        />
      )}

      {pendingBranch && (
        <LensCommitDialog
          title={pendingBranch.kind === "fork" ? "fork lens" : "branch lens"}
          subtitle={`from “${pendingBranch.sourceName}”`}
          defaultMessage={
            pendingBranch.kind === "fork"
              ? `fork from ${pendingBranch.sourceName}`
              : `branch from ${pendingBranch.sourceName}`
          }
          onConfirm={(msg) => {
            if (pendingBranch.kind === "fork") forkLens(pendingBranch.sourceId, msg);
            else branchLens(pendingBranch.sourceId, msg);
            setPendingBranch(null);
          }}
          onCancel={() => setPendingBranch(null)}
        />
      )}

      {spaceTransferGhost && (
        <div
          className={"space-transfer-ghost-wrap" + transferGhostWrapClass(spaceTransferGhost)}
          style={{ left: spaceTransferGhost.cx, top: spaceTransferGhost.cy }}
        >
          <div className="transfer-morph">
            <div className="transfer-morph-card">
              {spaceTransferGhost.preview}
              {spaceTransferGhost.count > 1 && (
                <span className="transfer-morph-count">{spaceTransferGhost.count}</span>
              )}
            </div>
            <div className="transfer-morph-orb">
              <span className="transfer-morph-orb-glow" />
              <span className="transfer-morph-orb-core" />
              {spaceTransferGhost.count > 1 && (
                <span className="transfer-morph-orb-count">{spaceTransferGhost.count}</span>
              )}
            </div>
            <div className="transfer-morph-function" aria-hidden="true">
              <span className="transfer-morph-function-badge">ƒ</span>
              <span className="transfer-morph-function-name">
                {spaceTransferGhost.preview?.slice(0, 64) || "function"}
              </span>
            </div>
            <div className="transfer-morph-symbol" aria-hidden="true">
              <span className="transfer-morph-symbol-ring" />
              <span className="transfer-morph-symbol-glyph">◇</span>
            </div>
          </div>
        </div>
      )}

      {cloneGhost && (
        <div
          className={
            "clone-drag-ghost" +
            (isOverAiColumn(cloneGhost.cx, cloneGhost.cy) || boundaryMagnetActive ? " to-ai" : "")
          }
          style={{ left: cloneGhost.cx, top: cloneGhost.cy }}
        >
          <span className="clone-drag-ghost-badge">{cloneGhost.count}</span>
        </div>
      )}

      {ideaOrbFlight && (
        <div
          className="idea-orb-flight"
          style={{ left: ideaOrbFlight.cx, top: ideaOrbFlight.cy }}
        >
          <div className="idea-orb-flight-core">
            <span className="idea-orb-flight-label">{ideaOrbFlight.label}</span>
          </div>
        </div>
      )}

      {toolboxApplyGhost && (
        <div
          className={
            "toolbox-apply-ghost" +
            (isOverPaperColumn(toolboxApplyGhost.cx, toolboxApplyGhost.cy)
              ? " over-paper"
              : isOverAiColumn(toolboxApplyGhost.cx, toolboxApplyGhost.cy)
                ? " over-ai"
                : "")
          }
          style={{ left: toolboxApplyGhost.cx, top: toolboxApplyGhost.cy }}
        >
          <span className="toolbox-apply-ghost-badge">
            {toolboxApplyGhost.kind === "operator" ? "ƒ" : "◇"}
          </span>
          <span className="toolbox-apply-ghost-label">{toolboxApplyGhost.label}</span>
        </div>
      )}

      {lensSettingsId && (() => {
        const struct = lenses.find((s) => s.id === lensSettingsId);
        if (!struct) return null;
        return (
          <LensSettingsDialog
            key={struct.id + ":" + (struct.interpretedAt || 0)}
            struct={struct}
            interpreting={symbolInterpretingId === struct.id}
            onSave={(patch) => saveLensSettings(struct.id, patch)}
            onReread={() => enrichSymbolRecord(struct.id, { force: true })}
            onRedraw={() => {
              setLensSettingsId(null);
              openLensDrawPrompt(struct);
            }}
            onClose={() => setLensSettingsId(null)}
          />
        );
      })()}

      <HighlightToolbar
        paperCount={highlightSelectionIds.length}
        aiCount={highlightAiNodeIds.length}
        ops={[
          ...operators.filter((o) => o.top || o.move),
          ...TRANSFORM_PRIMITIVES.filter((p) => opMap[p.id]).map((p) => opMap[p.id]),
        ].slice(0, 24)}
        onOperate={highlightToolbarOperate}
        onExtend={() =>
          highlightToolbarOperate(
            opMap["op-expand"] || TRANSFORM_PRIMITIVES.find((p) => p.name === "expand")
          )
        }
        onSameness={() => runSamenessDiscovery(highlightSelectionIds)}
        onSaveLens={highlightSaveAsLens}
        onSendToAi={highlightSendToAi}
        onClear={clearHighlightSelection}
      />
      <GhostCursor />
      <CompanionChat
        demos={COMPANION_DEMOS}
        onCommand={handleCompanionCommand}
        initialOpen={!onboard && companionAutoOpen}
        onOpened={() => {
          if (companionAutoOpen) setCompanionAutoOpen(false);
          try {
            localStorage.setItem(COMPANION_SEEN_KEY, "1");
          } catch {
            /* private mode */
          }
        }}
      />
    </div>
  );
}

function WalkOverlay({ walk, stepIndex, step, rects, onPrev, onNext, onBranch, onDistill, onShare, onLeave }) {
  const last = stepIndex >= walk.steps.length - 1;
  const pad = 16;
  const missing = rects.length === 0;
  return (
    <>
      <svg className="walk-dim" width="100%" height="100%">
        <defs>
          <mask id="walk-holes">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {rects.map((r, i) => (
              <rect
                key={i}
                x={r.left - pad}
                y={r.top - pad}
                width={r.right - r.left + pad * 2}
                height={r.bottom - r.top + pad * 2}
                rx="12"
                fill="black"
              />
            ))}
          </mask>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill="rgba(0, 0, 0, 0.72)" mask="url(#walk-holes)" />
        {rects.map((r, i) => (
          <rect
            key={"o" + i}
            x={r.left - pad}
            y={r.top - pad}
            width={r.right - r.left + pad * 2}
            height={r.bottom - r.top + pad * 2}
            rx="12"
            fill="none"
            stroke="rgba(245, 230, 163, 0.85)"
            strokeWidth="2"
            className="walk-hole-ring"
          />
        ))}
      </svg>
      <div className="walk-footer" onPointerDown={(e) => e.stopPropagation()}>
        <div className="walk-verb">
          <span className="walk-glyph">{step.arrived ? "◉" : "✦"}</span>
          <span className="walk-verb-name">{step.arrived ? "arrival" : `step ${stepIndex + 1}`}</span>
        </div>
        <div className="walk-caption">
          {step.arrived ? "the thought as it stands now" : step.caption}
          {step.preview && missing && <span className="walk-preview"> · “{step.preview}”</span>}
          {missing && !step.preview && walk.imported && (
            <span className="walk-missing"> (shared journey — moves imported to your functions rail)</span>
          )}
          {missing && !step.preview && !walk.imported && (
            <span className="walk-missing"> (what was here has changed — that, too, is part of the path)</span>
          )}
        </div>
        <div className="walk-progress">
          {walk.steps.map((s, i) => (
            <span key={s.id} className={"walk-dot" + (i === stepIndex ? " on" : i < stepIndex ? " past" : "")} />
          ))}
        </div>
        <div className="walk-controls">
          <button className="walk-btn" disabled={stepIndex === 0} onClick={onPrev}>
            ←
          </button>
          <span className="walk-count">
            {stepIndex + 1} / {walk.steps.length}
          </span>
          <button className="walk-btn primary" onClick={onNext}>
            {last ? "arrive" : "→"}
          </button>
          <span className="walk-sep" />
          <button className="walk-btn branch" onClick={onBranch} title="stop here and continue your own way (b)">
            ⑂ continue from here
          </button>
          {onDistill && (
            <button
              className="walk-btn branch"
              onClick={onDistill}
              title="save this whole thread of transformations as one reusable operator"
            >
              ◈ distill
            </button>
          )}
          {onShare && (
            <button className="walk-btn branch" onClick={onShare} title="copy link to this journey">
              ↗ share
            </button>
          )}
          <button className="walk-btn" onClick={onLeave} title="leave the walk (esc)">
            leave
          </button>
        </div>
        <div className="walk-title">the journey of · {walk.title}</div>
      </div>
    </>
  );
}

function BoardText({
  item,
  selected,
  bornGold,
  highlightTouched,
  highlightSelected,
  highlightTransferring,
  dropTarget,
  dropMagnetic,
  editing,
  editClickRef,
  onCommit,
  onResizeWidth,
}) {
  const ref = useRef(null);
  const seeded = useRef(false);

  const measureAndSyncWidth = () => {
    if (!ref.current || !onResizeWidth) return;
    const el = ref.current;
    const prev = el.style.width;
    el.style.width = "max-content";
    const needed = Math.min(
      TEXT_BOX_MAX_W,
      Math.max(TEXT_BOX_MIN_W, Math.ceil(el.scrollWidth))
    );
    el.style.width = prev;
    if (Math.abs(needed - (item.w || 0)) > 1) onResizeWidth(needed);
  };

  useEffect(() => {
    if (!editing || !ref.current) return;
    if (!seeded.current) {
      ref.current.innerText = item.text || "";
      seeded.current = true;
    }
    focusEditableAtPoint(ref.current, editClickRef);
  }, [editing, item.id, editClickRef]);

  useEffect(() => {
    if (!editing) seeded.current = false;
  }, [editing]);

  useLayoutEffect(() => {
    if (editing) return;
    measureAndSyncWidth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.text, item.w, editing]);

  const style = itemStyle(item);

  if (editing) {
    return (
      <div
        ref={ref}
        className="board-text editing"
        data-item={item.id}
        contentEditable
        suppressContentEditableWarning
        style={style}
        onPointerDown={(e) => e.stopPropagation()}
        onInput={measureAndSyncWidth}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Escape") {
            e.preventDefault();
            onCommit(ref.current?.innerText ?? "");
          }
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onCommit(ref.current?.innerText ?? "");
          }
        }}
      />
    );
  }
  return (
    <div
      ref={ref}
      className={
        "board-text" +
        (selected ? " sel" : "") +
        (bornGold ? " born-gold" : "") +
        (highlightSelected ? " hl-selected" : "") +
        (highlightTouched ? " hl-touch" : "") +
        (highlightTransferring ? " hl-transferring" : "") +
        (dropTarget ? " drop-target" : "") +
        (dropMagnetic ? " drop-magnetic" : "") +
        (item.portal ? " portal" : "")
      }
      data-item={item.id}
      style={style}
    >
      {item.text}
    </div>
  );
}

function startSelectionDrag(e, ids) {
  e.stopPropagation();
  e.dataTransfer.setData(SEL_MIME, JSON.stringify(ids));
  e.dataTransfer.effectAllowed = "copy";
}

function startOpDrag(e, op) {
  e.stopPropagation();
  e.dataTransfer.setData(OP_MIME, op.id);
  e.dataTransfer.effectAllowed = "copy";
  tourEmitRef.current?.("drag-function");
}

function startToolboxOperatorDrag(e, op) {
  if (e.target.closest?.("button, input, textarea, a")) return;
  toolboxApplyDragRef.current?.(e, { kind: "operator", opId: op.id, label: op.name });
}

function startToolboxTransformationLensDrag(e, lens) {
  if (e.target.closest?.("button, input, textarea, a, .lens-menu")) return;
  toolboxApplyDragRef.current?.(e, {
    kind: "transformation-lens",
    lensId: lens.id,
    label: lens.name,
  });
}

function startToolboxPatternLensDrag(e, struct) {
  if (e.target.closest?.("button, input, textarea, a, .struct-card-actions")) return;
  toolboxApplyDragRef.current?.(e, {
    kind: "pattern-lens",
    structId: struct.id,
    label: struct.title || "lens",
  });
}

function startStructDrag(e, struct) {
  e.stopPropagation();
  e.dataTransfer.setData(STRUCT_MIME, struct.id);
  e.dataTransfer.effectAllowed = "copy";
}

function InputDeck({ tool, imageArmed, canUndo, canRedo, onSelectTool, onPickImage, onUndo, onRedo }) {
  return (
    <div className="input-deck" onPointerDown={(e) => e.stopPropagation()}>
      <div className="input-deck-head">
        <span>input</span>
        <div className="input-history">
          <button type="button" className="input-undo" disabled={!canUndo} onClick={onUndo} title="undo">
            ↩ undo
          </button>
          <button type="button" className="input-undo" disabled={!canRedo} onClick={onRedo} title="redo">
            redo ↪
          </button>
        </div>
      </div>
      <div className="input-deck-groups">
        {TOOL_GROUPS.map((group) => {
          const tools = Object.values(CANVAS_TOOLS).filter((t) => t.group === group.id);
          if (!tools.length) return null;
          return (
            <div key={group.id} className="input-group">
              <span className="input-group-label">{group.label}</span>
              <div className="input-group-tools">
                {tools.map((t) => {
                  const isImage = t.id === "image";
                  const active = tool === t.id || (isImage && imageArmed);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className={
                        "input-tool" +
                        (active ? " on" : "") +
                        (t.id === "highlight" ? " highlight-tool" : "")
                      }
                      title={t.label}
                      onClick={() => (isImage ? onPickImage() : onSelectTool(t.id))}
                    >
                      {t.swatch && (
                        <span
                          className="tool-swatch"
                          style={{
                            background: t.swatch,
                            opacity: t.swatchOpacity ?? (t.id === "highlight" ? 0.85 : 0.95),
                          }}
                        />
                      )}
                      <span className="tool-icon">{t.icon}</span>
                      <span className="tool-label">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function JobRow({ job, onDismiss }) {
  const [displayProgress, setDisplayProgress] = useState(0);
  const [etaMs, setEtaMs] = useState(null);

  useEffect(() => {
    if (job.status === "done") {
      setDisplayProgress(1);
      setEtaMs(0);
      return;
    }
    if (job.status !== "running") return;

    const start = job.startedAt || Date.now();
    const total = job.estimatedMs || ETA.default;

    const tick = () => {
      const elapsed = Date.now() - start;
      const timeRatio = Math.min(1, elapsed / total);
      const target = Math.min(0.96, timeRatio * 0.96);
      setDisplayProgress((prev) => {
        const eased = prev + (target - prev) * 0.12;
        return Math.max(prev, Math.min(0.96, eased));
      });
      setEtaMs(Math.max(0, total - elapsed));
    };

    tick();
    const id = setInterval(tick, 80);
    return () => clearInterval(id);
  }, [job.id, job.status, job.startedAt, job.estimatedMs]);

  useEffect(() => {
    if (typeof job.progress === "number" && job.progress > displayProgress) {
      setDisplayProgress(job.progress);
    }
  }, [job.progress, displayProgress]);

  const pct = Math.round((job.status === "done" ? 1 : displayProgress) * 100);
  const eta =
    job.status === "running" && etaMs != null
      ? formatJobEta(etaMs)
      : job.status === "done"
      ? "done"
      : null;

  return (
    <div className={"job-row" + (job.status === "error" ? " error" : job.status === "done" ? " done" : "")}>
      <div className="job-row-top">
        <span className="job-label">{job.label}</span>
        {job.status === "running" && eta && <span className="job-eta">{eta}</span>}
        {job.status === "error" && (
          <button className="job-dismiss" onClick={() => onDismiss(job.id)} title="dismiss">
            ×
          </button>
        )}
      </div>
      {job.step && <div className="job-step">{job.step}</div>}
      {job.status === "running" && (
        <div className="job-bar">
          <div className="job-bar-fill" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

function JobPanel({ jobs, onDismiss }) {
  if (!jobs.length) return null;
  return (
    <div className="job-panel">
      <div className="job-panel-head">in progress</div>
      {jobs.map((job) => (
        <JobRow key={job.id} job={job} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

const PRIMITIVE_GLYPHS = {
  compress: "⊖",
  expand: "⊕",
  explore: "✧",
  research: "⌕",
  invert: "⇅",
  reframe: "⟲",
  transcend: "△",
};

function DraggableOpCard({ op, opMap, expanded, onToggle, onEdit, onCompose, onShare, onExplore, onRun, flat, chip }) {
  const [composeOver, setComposeOver] = useState(false);
  if (!op) return null;
  const steps = op.kind === "pipeline" && op.steps ? op.steps.map((id) => opMap[id]).filter(Boolean) : [];
  const open = expanded[op.id];
  const stepNames = steps.map((s) => s?.name).filter(Boolean);
  // Details live in a hover tooltip, never inline — the list stays one line per function.
  const rowTitle = [
    op.description?.trim(),
    stepNames.length ? `steps: ${stepNames.join(" → ")}` : "",
    "drag onto paper or AI",
  ]
    .filter(Boolean)
    .join("\n");
  const glyph = chip ? PRIMITIVE_GLYPHS[op.name] || "◦" : null;
  return (
    <div className={"op-card-wrap" + (chip ? " op-chip-wrap" : "")}>
      <div
        className={"op-card" + (composeOver ? " compose-over" : "") + (chip ? " op-chip" : "")}
        data-op-id={op.id}
        onDragOver={(e) => {
          if (onCompose && e.dataTransfer.types.includes(OP_MIME)) {
            e.preventDefault();
            e.stopPropagation();
            setComposeOver(true);
          }
        }}
        onDragLeave={() => setComposeOver(false)}
        onDrop={(e) => {
          if (!onCompose) return;
          const draggedId = e.dataTransfer.getData(OP_MIME);
          if (draggedId) {
            e.preventDefault();
            e.stopPropagation();
            setComposeOver(false);
            onCompose(draggedId, op.id);
          }
        }}
      >
        <div
          className="op-card-row toolbox-drag-row"
          onPointerDown={(e) => startToolboxOperatorDrag(e, op)}
          title={rowTitle}
        >
          {glyph ? (
            <span className="op-chip-glyph" aria-hidden="true">
              {glyph}
            </span>
          ) : (
            <span className="op-drag-grip" aria-hidden="true">
              ⠿
            </span>
          )}
          <div className="op-card-label">
            <span className="op-card-name">{op.name}</span>
          </div>
          {stepNames.length > 0 && !chip && (
            <span className="op-card-stepcount">{stepNames.length}</span>
          )}
          <span className="rail-row-actions">
            {!flat && steps.length > 0 && (
              <button
                className="rail-icon-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle(op.id);
                }}
                title={`${steps.length} steps`}
              >
                {open ? "▾" : "▸"}
              </button>
            )}
            <button
              className="rail-icon-btn"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(op);
              }}
              title="Edit"
            >
              ✎
            </button>
            {onExplore && isPortableOperator(op) && (
              <button
                className="rail-icon-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onExplore(op);
                }}
                title="Where else does this apply?"
              >
                ◎
              </button>
            )}
            {onShare && (
              <button
                className="rail-icon-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onShare(op);
                }}
                title="Copy share link"
              >
                ↗
              </button>
            )}
          </span>
        </div>
      </div>
      {open && steps.length > 0 && !flat && (
        <div className="op-card-steps">
          {steps.map((step) => (
            <DraggableStep key={step.id} step={step} opMap={opMap} expanded={expanded} onToggle={onToggle} onEdit={onEdit} depth={1} />
          ))}
        </div>
      )}
    </div>
  );
}

function DraggableStep({ step, opMap, expanded, onToggle, onEdit, depth }) {
  const sub = step.kind === "pipeline" && step.steps ? step.steps.map((id) => opMap[id]).filter(Boolean) : [];
  const open = expanded[step.id];
  const isLeaf = !sub.length;
  return (
    <div className="op-step" style={{ paddingLeft: depth * 8 }}>
      <div
        className={"op-step-chip" + (isLeaf ? " leaf" : "")}
        data-op-id={step.id}
        onPointerDown={(e) => startToolboxOperatorDrag(e, step)}
        title="Drag onto paper"
      >
        <span className="op-drag-grip">⠿</span>
        <div className="op-step-label">
          <span className="op-step-name">{step.name}</span>
          {open && step.description && <span className="op-step-desc">{step.description}</span>}
        </div>
        {!isLeaf && (
          <button className="op-step-toggle" onClick={() => onToggle(step.id)}>
            {open ? "▾" : "▸"}
          </button>
        )}
        <button className="op-step-edit" onClick={() => onEdit(step)}>⚙</button>
      </div>
      {open &&
        sub.map((child) => (
          <DraggableStep key={child.id} step={child} opMap={opMap} expanded={expanded} onToggle={onToggle} onEdit={onEdit} depth={depth + 1} />
        ))}
    </div>
  );
}

function LensCard({
  lens,
  depth = 0,
  active,
  opMap,
  lenses,
  comparing,
  comparePick,
  onUse,
  onEvolve,
  onBranch,
  onFork,
  onHistory,
  onSend,
  onCompare,
  onMergeDrop,
  onDelete,
}) {
  const [mergeOver, setMergeOver] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const moveNames = lensStepNames(lens, opMap);
  const metaLines = lensMetaLines(lens, lenses);
  const refKind = gitRefLabel(lens);
  const commits = commitCount(lens);
  const byId = Object.fromEntries((lenses || []).map((l) => [l.id, l]));
  const crumbs = lineageBreadcrumb(lens, byId);
  return (
    <div
      className={
        "lens-card" +
        (active ? " active" : "") +
        (mergeOver ? " merge-over" : "") +
        (comparing ? " comparing" : "") +
        (depth > 0 ? " git-child" : "")
      }
      data-transformation-lens-id={lens.id}
      style={depth > 0 ? { marginLeft: depth * 14 } : undefined}
      onClick={(e) => {
        if (toolboxDidDragRef.current) {
          toolboxDidDragRef.current = false;
          return;
        }
        if (e.target.closest(".op-drag-grip, .rail-row-actions, .lens-menu, button")) return;
        onUse();
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(LENS_MIME)) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          setMergeOver(true);
        }
      }}
      onDragLeave={() => setMergeOver(false)}
      onDrop={(e) => {
        const draggedId = e.dataTransfer.getData(LENS_MIME);
        setMergeOver(false);
        if (draggedId && draggedId !== lens.id) {
          e.preventDefault();
          e.stopPropagation();
          onMergeDrop(draggedId);
        }
      }}
    >
      <div
        className="lens-card-top toolbox-drag-row"
        onPointerDown={(e) => startToolboxTransformationLensDrag(e, lens)}
      >
        <span
          className={"git-ref-dot " + refKind}
          title={[refKind, commits > 0 ? `${commits} commit${commits === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ")}
          aria-hidden="true"
        />
        <span className="lens-card-name">{lens.name}</span>
        {moveNames.length > 0 && <span className="op-card-stepcount">{moveNames.length}</span>}
        <span className="rail-row-actions">
          <button
            className="rail-icon-btn"
            onClick={(e) => {
              e.stopPropagation();
              onEvolve();
            }}
            title="Edit this lens"
          >
            ✎
          </button>
          <button
            className="rail-icon-btn"
            onClick={(e) => {
              e.stopPropagation();
              onSend();
            }}
            title="Copy share link"
          >
            ↗
          </button>
          <button
            className="rail-icon-btn"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((o) => !o);
            }}
            title="More actions"
          >
            ⋯
          </button>
        </span>
        {menuOpen && (
          <div className="lens-menu" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => { onUse(); setMenuOpen(false); }}>
              {active ? "Deselect" : "Select"}
            </button>
            <button type="button" onClick={() => { onBranch(); setMenuOpen(false); }}>Branch</button>
            <button type="button" onClick={() => { onFork(); setMenuOpen(false); }}>Fork</button>
            <button type="button" onClick={() => { onCompare(); setMenuOpen(false); }}>Compare</button>
            {onHistory && (
              <button type="button" onClick={() => { onHistory(); setMenuOpen(false); }}>History</button>
            )}
            <button type="button" className="danger" onClick={() => { onDelete(); setMenuOpen(false); }}>Delete</button>
          </div>
        )}
      </div>
      {(moveNames.length > 0 || metaLines.length > 0 || crumbs.length > 1) && (
        <div className="rail-hover-card" aria-hidden="true">
          {crumbs.length > 1 && <div className="rail-hover-crumb">{crumbs.join(" → ")}</div>}
          {moveNames.length > 0 && (
            <div className="rail-hover-steps">{moveNames.join(" → ")}</div>
          )}
          {metaLines.map((line, i) => (
            <div key={i} className="rail-hover-meta">
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LensComparePanel({ a, b, opMap, onClose, onMerge }) {
  if (!a || !b) return null;
  const aRoot = lensRootOpId(a);
  const bRoot = lensRootOpId(b);
  const aNames = aRoot ? collectPipelineStepNames(aRoot, opMap) : (a.moveIds || []).map((id) => opMap[id]?.name).filter(Boolean);
  const bNames = bRoot ? collectPipelineStepNames(bRoot, opMap) : (b.moveIds || []).map((id) => opMap[id]?.name).filter(Boolean);
  const { shared, onlyA, onlyB } = diffStepSequences(aNames, bNames);
  const chipIn = (name, side) => {
    if (shared.some((s) => s.name === name)) return "lens-move-chip shared";
    return "lens-move-chip unique";
  };
  return (
    <div className="onboard-scrim" onClick={onClose}>
      <div className="lens-compare git-compare-panel" onClick={(e) => e.stopPropagation()}>
        <h3 className="lens-editor-title">
          diff · “{a.name}” ≍ “{b.name}”
        </h3>
        <p className="lens-editor-sub">
          Step sequences aligned — shared steps highlighted, unique steps per branch.
        </p>
        <div className="lens-compare-seq">
          <div className="lens-compare-seq-col">
            <div className="rail-section">{a.name}</div>
            <div className="lens-compare-seq-row">
              {aNames.length ? (
                aNames.map((name, i) => (
                  <React.Fragment key={name + i}>
                    {i > 0 && <span className="lens-seq-arrow">→</span>}
                    <span className={chipIn(name, "a")}>{name}</span>
                  </React.Fragment>
                ))
              ) : (
                <span className="lens-compare-none">empty</span>
              )}
            </div>
          </div>
          <div className="lens-compare-seq-col">
            <div className="rail-section">{b.name}</div>
            <div className="lens-compare-seq-row">
              {bNames.length ? (
                bNames.map((name, i) => (
                  <React.Fragment key={name + i}>
                    {i > 0 && <span className="lens-seq-arrow">→</span>}
                    <span className={chipIn(name, "b")}>{name}</span>
                  </React.Fragment>
                ))
              ) : (
                <span className="lens-compare-none">empty</span>
              )}
            </div>
          </div>
        </div>
        <div className="lens-compare-cols">
          <div className="lens-compare-col">
            <div className="rail-section">only “{a.name}”</div>
            {onlyA.length ? (
              onlyA.map((x, i) => (
                <span key={i} className="lens-move-chip unique">
                  {x.name}
                </span>
              ))
            ) : (
              <span className="lens-compare-none">nothing unique</span>
            )}
          </div>
          <div className="lens-compare-col shared">
            <div className="rail-section">shared</div>
            {shared.length ? (
              shared.map((x, i) => (
                <span key={i} className="lens-move-chip shared">
                  {x.name}
                </span>
              ))
            ) : (
              <span className="lens-compare-none">no common ground</span>
            )}
          </div>
          <div className="lens-compare-col">
            <div className="rail-section">only “{b.name}”</div>
            {onlyB.length ? (
              onlyB.map((x, i) => (
                <span key={i} className="lens-move-chip unique">
                  {x.name}
                </span>
              ))
            ) : (
              <span className="lens-compare-none">nothing unique</span>
            )}
          </div>
        </div>
        <div className="lens-editor-foot">
          {onMerge && (
            <button type="button" className="rec-btn primary" onClick={() => onMerge(a.id, b.id)}>
              merge pipelines
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button className="rec-btn" onClick={onClose}>
            close
          </button>
        </div>
      </div>
    </div>
  );
}

function PatternLensCard({
  struct,
  dropTarget,
  onMaterialDragOver,
  onMaterialDragLeave,
  onMaterialDrop,
  onDelete,
  onShare,
  onEditSymbol,
  onEditViewLens,
  onSettings,
}) {
  const preview = lensPreview(struct);
  const meaning = struct.interpretation?.meaning || preview;
  const acceptsMaterial = (e) =>
    e.dataTransfer.types.includes(THOUGHT_MIME) ||
    e.dataTransfer.types.includes(SKETCH_BUNDLE_MIME) ||
    e.dataTransfer.types.includes(SEL_MIME);
  return (
    <div
      className="struct-card-wrap struct-card-horizontal"
      onDragOver={(e) => {
        if (!acceptsMaterial(e)) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "copy";
        onMaterialDragOver?.(struct.id);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) onMaterialDragLeave?.(struct.id);
      }}
      onDrop={(e) => {
        if (!acceptsMaterial(e)) return;
        onMaterialDrop?.(e, struct.id);
      }}
    >
      <div
        className={"struct-card" + (dropTarget ? " drop-target merge-target" : "")}
        data-struct-id={struct.id}
      >
        <div
          className="struct-card-row toolbox-drag-row"
          onPointerDown={(e) => startToolboxPatternLensDrag(e, struct)}
          title={[meaning, "drag onto paper or AI · drop material here to deepen"].filter(Boolean).join("\n")}
        >
          <SymbolGlyph symbolStroke={struct.symbolStroke} className="struct-card-glyph" />
          <div className="struct-card-body">
            <span className="struct-title">{struct.title || preview}</span>
          </div>
          <span className="rail-row-actions">
            {onEditViewLens && (
              <button
                type="button"
                className="rail-icon-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditViewLens(struct);
                }}
                title="Apply as a way of seeing"
              >
                ◉
              </button>
            )}
            {onSettings && (
              <button
                type="button"
                className="rail-icon-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onSettings(struct);
                }}
                title="Lens settings — meaning, generation, structure"
              >
                ⚙
              </button>
            )}
            {onEditSymbol && (
              <button
                type="button"
                className="rail-icon-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditSymbol(struct);
                }}
                title="Edit symbol"
              >
                ✎
              </button>
            )}
            {onShare && (
              <button
                type="button"
                className="rail-icon-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onShare(struct);
                }}
                title="Share"
              >
                ↗
              </button>
            )}
            <button type="button" className="rail-icon-btn danger" onClick={onDelete} title="Delete">
              ×
            </button>
          </span>
        </div>
        {meaning && <div className="rail-hover-card" aria-hidden="true">{meaning}</div>}
      </div>
    </div>
  );
}

function escapeHtml(s) {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

function Onboarding({ state, onStart, onSkip, onClose }) {
  const [custom, setCustom] = useState("");

  if (state.step === "role") {
    return (
      <div className="onboard-scrim">
        <div className="onboard">
          <div className="onboard-mark">lens</div>
          <h2>What do you do?</h2>
          <div className="role-grid">
            {ROLES.map((r) => (
              <button key={r} className="role-btn" onClick={() => onStart(r)}>
                {r}
              </button>
            ))}
          </div>
          <div className="onboard-custom">
            <input
              placeholder="or type your own…"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && custom.trim() && onStart(custom.trim())}
            />
            <button disabled={!custom.trim()} onClick={() => custom.trim() && onStart(custom.trim())}>
              build
            </button>
          </div>
          <button className="onboard-skip" onClick={onSkip}>
            skip for now
          </button>
        </div>
      </div>
    );
  }

  if (state.step === "working") {
    const pct = state.total ? Math.round((state.done / state.total) * 100) : 0;
    return (
      <div className="onboard-scrim">
        <div className="onboard">
          <div className="onboard-mark">lens</div>
          <h2>Building your toolbox</h2>
          <div className="progress">
            <div className="progress-bar" style={{ width: `${pct}%` }} />
          </div>
          <div className="progress-label">
            {state.label || `${state.done} / ${state.total} functions`} {state.total ? `· ${state.done}/${state.total}` : ""}
          </div>
        </div>
      </div>
    );
  }

  if (state.step === "done") {
    return (
      <div className="onboard-scrim">
        <div className="onboard">
          <div className="onboard-mark">lens</div>
          <h2>Your toolbox is ready</h2>
          <button className="onboard-go" onClick={onClose}>
            start thinking
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="onboard-scrim">
      <div className="onboard">
        <div className="onboard-mark">lens</div>
        <h2>Hm, that didn't work</h2>
        <p className="onboard-sub">{state.message}</p>
        <div className="onboard-custom">
          <button className="onboard-go" onClick={() => onStart("founder")}>
            try again
          </button>
          <button className="onboard-skip" onClick={onSkip}>
            skip
          </button>
        </div>
      </div>
    </div>
  );
}

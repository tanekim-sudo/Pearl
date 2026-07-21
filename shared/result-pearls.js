import { createPearlPrivacyPolicy } from "./pearl-privacy-policy.js";

export const RESULT_PEARL_VERSION = 1;
export const RESULT_PEARL_STATUSES = Object.freeze(["streaming", "ready", "failed", "opened", "accepted", "archived"]);
export const RESULT_DESTINATION_TYPES = Object.freeze([
  "margin-pearl",
  "new-tab",
  "web-scene",
  "chat",
  "native-insert",
  "native-replace",
  "canvas-textbox",
  "canvas-region",
  "companion-region",
  "clipboard",
  "download",
  "pdf",
]);

const clone = (value) => structuredClone(value);
const bounded = (value, length = 120_000) => String(value ?? "").slice(0, length);
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function rect(value = {}) {
  return {
    x: finite(value.x),
    y: finite(value.y),
    width: Math.max(0, finite(value.width)),
    height: Math.max(0, finite(value.height)),
  };
}

function overlaps(left, right, padding = 4) {
  return left.x < right.x + right.width + padding
    && left.x + left.width + padding > right.x
    && left.y < right.y + right.height + padding
    && left.y + left.height + padding > right.y;
}

export function placeResultPearls(input = {}) {
  const anchor = rect(input.anchor);
  const viewport = {
    width: Math.max(80, finite(input.viewport?.width, 1280)),
    height: Math.max(80, finite(input.viewport?.height, 720)),
    scrollX: finite(input.viewport?.scrollX),
    scrollY: finite(input.viewport?.scrollY),
  };
  const count = Math.max(1, Math.min(24, Number(input.count) || 1));
  const size = clamp(finite(input.size, 32), 28, 36);
  const gap = 8;
  const leftSpace = anchor.x;
  const rightSpace = viewport.width - (anchor.x + anchor.width);
  const side = rightSpace >= size + 16 || rightSpace >= leftSpace ? "right" : "left";
  const marginFits = (side === "right" ? rightSpace : leftSpace) >= size + 12;
  const x = marginFits
    ? side === "right" ? anchor.x + anchor.width + 12 : anchor.x - size - 12
    : side === "right" ? viewport.width - size - 8 : 8;
  const obstacles = (input.obstacles || []).map(rect);
  const placements = [];
  const clusterHeight = count * size + (count - 1) * gap;
  let startY = clamp(anchor.y + anchor.height / 2 - clusterHeight / 2, 8, Math.max(8, viewport.height - clusterHeight - 8));
  for (let index = 0; index < count; index += 1) {
    const baseY = startY + index * (size + gap);
    let candidate = { x: clamp(x, 8, viewport.width - size - 8), y: baseY, width: size, height: size };
    for (let attempts = 0; attempts < 80; attempts += 1) {
      const distance = Math.ceil(attempts / 2) * (size + gap);
      const direction = attempts % 2 ? 1 : -1;
      const candidateY = clamp(baseY + distance * direction, 8, viewport.height - size - 8);
      const next = { ...candidate, y: candidateY };
      const placedInViewport = placements.map((entry) => ({
        ...entry,
        x: entry.x - viewport.scrollX,
        y: entry.y - viewport.scrollY,
      }));
      if (![...obstacles, ...placedInViewport].some((entry) => overlaps(next, entry, 5))) {
        candidate = next;
        break;
      }
      if (attempts === 79) {
        const alternateX = side === "right" ? 8 : viewport.width - size - 8;
        candidate = { ...candidate, x: alternateX, y: clamp(baseY, 8, viewport.height - size - 8) };
      }
    }
    placements.push({
      x: candidate.x + viewport.scrollX,
      y: candidate.y + viewport.scrollY,
      width: size,
      height: size,
      coordinateSpace: "document",
      side,
      docked: !marginFits,
      branchIndex: index,
      devicePixelRatio: Math.max(1, finite(input.viewport?.devicePixelRatio, 1)),
    });
  }
  return placements;
}

export function normalizeResultDestination(value = {}) {
  const type = RESULT_DESTINATION_TYPES.includes(value.type) ? value.type : "margin-pearl";
  return {
    type,
    targetId: value.targetId || null,
    placement: value.placement ? clone(value.placement) : null,
    requestedAt: finite(value.requestedAt, Date.now()),
    confirmed: value.confirmed === true,
  };
}

export function normalizeResultPearl(value = {}) {
  if (!value.id || !value.pearlId || !value.pageIdentity) throw new Error("result Pearl identity is incomplete");
  const status = RESULT_PEARL_STATUSES.includes(value.status) ? value.status : "streaming";
  return {
    version: RESULT_PEARL_VERSION,
    id: bounded(value.id, 220),
    pearlId: bounded(value.pearlId, 180),
    pageIdentity: bounded(value.pageIdentity, 1_000),
    outputId: bounded(value.outputId || value.id, 220),
    text: bounded(value.text),
    status,
    expanded: Boolean(value.expanded),
    archived: Boolean(value.archived),
    sourceRefs: (value.sourceRefs || []).slice(0, 200).map((entry) => typeof entry === "string" ? { id: bounded(entry, 220) } : clone(entry)),
    lens: value.lens ? {
      id: bounded(value.lens.id, 220),
      version: Math.max(1, finite(value.lens.version, 1)),
      strength: clamp(finite(value.lens.strength, 1), 0, 1),
    } : null,
    execution: clone(value.execution || {}),
    branch: clone(value.branch || null),
    outputSpec: clone(value.outputSpec || null),
    disclosureReceipt: clone(value.disclosureReceipt || null),
    lineage: clone(value.lineage || []),
    destination: normalizeResultDestination(value.destination),
    placement: value.placement ? clone(value.placement) : null,
    checkpoint: clone(value.checkpoint || null),
    failure: status === "failed" ? { code: bounded(value.failure?.code || "RESULT_FAILED", 100), recoverable: value.failure?.recoverable !== false } : null,
    createdAt: finite(value.createdAt, Date.now()),
    updatedAt: finite(value.updatedAt, Date.now()),
    openedAt: value.openedAt ? finite(value.openedAt) : null,
    acceptedAt: value.acceptedAt ? finite(value.acceptedAt) : null,
    provenance: clone(value.provenance || {}),
    routing: clone(value.routing || null),
    privacyPolicy: createPearlPrivacyPolicy(value.privacyPolicy || { pearlId: value.id, provenance: { source: "result-pearl-local-default" } }),
  };
}

export function spawnResultPearl(value) {
  return normalizeResultPearl({
    ...value,
    status: value.status || "streaming",
    destination: value.destination || { type: "margin-pearl" },
    checkpoint: value.checkpoint || { type: "spawn", at: Date.now(), sourceRefs: clone(value.sourceRefs || []) },
  });
}

export function updateResultPearl(value, patch) {
  const current = normalizeResultPearl(value);
  return normalizeResultPearl({
    ...current,
    ...clone(patch),
    id: current.id,
    pearlId: current.pearlId,
    pageIdentity: current.pageIdentity,
    updatedAt: Date.now(),
    checkpoint: {
      type: "update",
      at: Date.now(),
      previous: {
        status: current.status,
        expanded: current.expanded,
        destination: current.destination,
        placement: current.placement,
      },
    },
  });
}

export function redirectResultPearl(value, destination) {
  return updateResultPearl(value, { destination: normalizeResultDestination(destination) });
}

export function undoResultPearl(value) {
  const current = normalizeResultPearl(value);
  const previous = current.checkpoint?.previous;
  if (!previous) throw new Error("result Pearl has no checkpoint to undo");
  return normalizeResultPearl({
    ...current,
    ...clone(previous),
    updatedAt: Date.now(),
    checkpoint: { type: "undo", at: Date.now(), previous: { status: current.status, expanded: current.expanded, destination: current.destination, placement: current.placement } },
  });
}

export function resultPearlChatMessage(value) {
  const result = normalizeResultPearl(value);
  return {
    id: `chat:${result.id}`,
    role: "assistant",
    content: result.text,
    resultPearlId: result.id,
    branches: result.branch ? [clone(result.branch)] : [],
    citations: (result.provenance?.sources || result.lineage || []).map(clone),
    sourceRefs: clone(result.sourceRefs),
    provenance: clone(result.provenance),
    createdAt: result.createdAt,
  };
}

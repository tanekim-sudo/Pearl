import {
  effectivePearlPrivacyPolicy,
  guardPearlPrivacyAction,
} from "../../shared/pearl-privacy-policy.js";

const DISCLOSURE_MAX_BYTES = 120_000;
const DISCLOSURE_MAX_OBJECTS = 30;
const DISCLOSURE_MAX_HISTORY = 20;
const MAX_TEXT = 2_000;

const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const boundedText = (value) => String(value ?? "").slice(0, MAX_TEXT);

export function clampCompanionPlacement(placement = {}, viewport = {}, pearl = {}) {
  const viewportWidth = Math.max(1, finite(viewport.width, globalThis.innerWidth || 390));
  const viewportHeight = Math.max(1, finite(viewport.height, globalThis.innerHeight || 844));
  const width = Math.min(viewportWidth - 16, Math.max(28, finite(pearl.width, 36)));
  const height = Math.min(viewportHeight - 16, Math.max(28, finite(pearl.height, width)));
  return {
    ...placement,
    x: Math.max(8, Math.min(viewportWidth - width - 8, finite(placement.x, (viewportWidth - width) / 2))),
    y: Math.max(8, Math.min(viewportHeight - height - 8, finite(placement.y, viewportHeight - height - 28))),
    placementVersion: 2,
  };
}

export function modelRequestBody(input = {}) {
  const profile = input.profile || (input.purpose === "companion-planning" ? "companion_planning" : undefined);
  return Object.fromEntries(Object.entries({ ...input, profile }).filter(([, value]) => value != null));
}

function sanitize(value, depth = 0) {
  if (depth > 5 || value == null) return value == null ? null : undefined;
  if (typeof value === "string") return boundedText(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 80).map((entry) => sanitize(entry, depth + 1));
  if (typeof value !== "object") return undefined;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !/token|secret|password|credential|authorization|cookie/i.test(key))
      .slice(0, 100)
      .map(([key, entry]) => [key, sanitize(entry, depth + 1)]),
  );
}

function fitBundle(bundle) {
  const candidate = structuredClone(bundle);
  const bytes = () => new TextEncoder().encode(JSON.stringify(candidate)).length;
  const arrays = [
    candidate.visibleObjects,
    candidate.graph,
    candidate.recentHistory,
    candidate.authorizedMemory?.memories,
    candidate.authorizedMemory?.actions,
    ...Object.values(candidate.authorizedMemory?.references || {}),
    candidate.lenses,
    candidate.generators,
    candidate.highlighted,
    candidate.selection,
  ].filter(Array.isArray);
  while (bytes() > DISCLOSURE_MAX_BYTES && arrays.some((entries) => entries.length)) {
    const largest = arrays.filter((entries) => entries.length).sort((left, right) =>
      JSON.stringify(right).length - JSON.stringify(left).length
    )[0];
    largest.pop();
  }
  if (bytes() > DISCLOSURE_MAX_BYTES) {
    candidate.observations = null;
    candidate.context = sanitize({
      page: candidate.context?.page || null,
      viewport: candidate.context?.viewport || null,
    });
  }
  return { bundle: candidate, byteCount: bytes(), exceeded: bytes() > DISCLOSURE_MAX_BYTES };
}

export function createCompanionDisclosureBundle({ snapshot = {}, policy, provider = null, approved = false } = {}) {
  const effective = policy?.effective ? policy : effectivePearlPrivacyPolicy([policy]);
  const decision = guardPearlPrivacyAction(effective, "model-call", {
    provider,
    fields: ["selection", "highlighted", "visibleObjects", "graph", "library", "viewport", "history", "authorizedMemory"],
  });
  if (!decision.allowed || (decision.approvalRequired && !approved)) {
    return {
      allowed: false,
      code: !decision.allowed ? decision.code : "DISCLOSURE_APPROVAL_REQUIRED",
      reason: !decision.allowed ? decision.reason : "Review the bounded workspace disclosure before model planning.",
      minimumPatch: decision.minimumPatch || null,
      bundle: null,
      receipt: null,
    };
  }
  const fitted = fitBundle({
    version: 1,
    provenance: "live-authorized-workspace",
    selection: sanitize(snapshot.selection || []),
    highlighted: sanitize(snapshot.highlighted || []),
    visibleObjects: sanitize((snapshot.objects || []).slice(0, DISCLOSURE_MAX_OBJECTS)),
    graph: sanitize((snapshot.graph || []).slice(0, 80)),
    lenses: sanitize(snapshot.lenses || []),
    generators: sanitize(snapshot.generators || []),
    context: sanitize(snapshot.context || {}),
    observations: sanitize(snapshot.observations || {}),
    recentHistory: sanitize((snapshot.recentHistory || []).slice(-DISCLOSURE_MAX_HISTORY)),
    authorizedMemory: sanitize(snapshot.user || null),
  });
  if (fitted.exceeded) {
    return {
      allowed: false,
      code: "DISCLOSURE_BUDGET_EXCEEDED",
      reason: "The authorized context could not be bounded safely for model disclosure.",
      minimumPatch: null,
      bundle: null,
      receipt: null,
    };
  }
  const bundle = fitted.bundle;
  const byteCount = fitted.byteCount;
  return {
    allowed: true,
    code: "ALLOWED",
    bundle,
    receipt: {
      version: 1,
      channel: "model",
      purpose: "companion-planning",
      policyId: effective.id || null,
      policyVersion: effective.version,
      provider,
      byteCount,
      fields: Object.keys(bundle),
      provenance: bundle.provenance,
      at: new Date().toISOString(),
    },
  };
}

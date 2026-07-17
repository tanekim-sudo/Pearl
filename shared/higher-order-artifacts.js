export const HIGHER_ORDER_ARTIFACT_VERSION = 1;
const KINDS = new Set(["move", "function", "lens"]);
const MAX_DEPTH = 4;
const MAX_OPERATIONS = 100;

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, stable(entry)]));
}

function fingerprint(value) {
  const text = JSON.stringify(stable(value));
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  return `artifact-${(hash >>> 0).toString(36)}-${text.length.toString(36)}`;
}

export function createArtifactRef({ id, version, kind, contracts = {}, summary = {}, editableScope = [], snapshot }) {
  if (!id || !Number.isInteger(version) || version < 1 || !KINDS.has(kind) || snapshot == null) {
    throw new Error("ArtifactRef requires a stable id, positive version, supported kind, and snapshot");
  }
  const value = { schemaVersion: HIGHER_ORDER_ARTIFACT_VERSION, id, version, kind, contracts, summary, editableScope: [...editableScope], snapshot: structuredClone(snapshot) };
  return Object.freeze({ ...value, fingerprint: fingerprint(value) });
}

export function createArtifactPatch({ source, purpose, operations, outputKind = source?.kind, depth = 1, provenance = {} }) {
  if (!source?.fingerprint || !KINDS.has(outputKind)) throw new Error("ArtifactPatch requires a valid ArtifactRef source and output kind");
  if (!Array.isArray(operations) || !operations.length || operations.length > MAX_OPERATIONS) throw new Error("ArtifactPatch operation count is outside the safe bound");
  if (depth < 1 || depth > MAX_DEPTH) throw new Error("ArtifactPatch recursion depth exceeds the safe bound");
  const paths = new Set();
  const normalized = operations.map((operation, index) => {
    if (!["add", "replace", "remove"].includes(operation.op) || !/^\/(?!securityRegistry|commandRegistry)/.test(operation.path || "")) {
      throw new Error(`ArtifactPatch operation ${index} is invalid or targets a protected registry`);
    }
    if (paths.has(operation.path)) throw new Error(`ArtifactPatch contains competing edits at ${operation.path}`);
    paths.add(operation.path);
    return { id: operation.id || `hunk-${index + 1}`, ...structuredClone(operation) };
  });
  return {
    schemaVersion: HIGHER_ORDER_ARTIFACT_VERSION,
    id: globalThis.crypto?.randomUUID?.() || `patch-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    source: { id: source.id, version: source.version, kind: source.kind, fingerprint: source.fingerprint },
    outputKind,
    purpose: String(purpose || "Higher-order transformation"),
    depth,
    operations: normalized,
    provenance: { ...provenance, createdAt: new Date().toISOString() },
  };
}

function segments(path) {
  return path.split("/").slice(1).map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"));
}

export function applyArtifactPatch(source, patch, { acceptedHunkIds = patch?.operations?.map((entry) => entry.id) || [] } = {}) {
  if (source.fingerprint !== patch.source.fingerprint || source.id !== patch.source.id || source.version !== patch.source.version) {
    throw new Error("ArtifactPatch source is stale; refresh and rebase before applying");
  }
  const accepted = new Set(acceptedHunkIds);
  const snapshot = structuredClone(source.snapshot);
  for (const operation of patch.operations.filter((entry) => accepted.has(entry.id))) {
    const parts = segments(operation.path);
    let parent = snapshot;
    for (const part of parts.slice(0, -1)) {
      if (!parent || typeof parent !== "object" || !(part in parent)) throw new Error(`ArtifactPatch path does not exist: ${operation.path}`);
      parent = parent[part];
    }
    const key = parts.at(-1);
    if (operation.op === "remove") {
      if (Array.isArray(parent)) parent.splice(Number(key), 1);
      else delete parent[key];
    } else {
      if (operation.op === "replace" && !(key in parent)) throw new Error(`ArtifactPatch replace path does not exist: ${operation.path}`);
      parent[key] = structuredClone(operation.value);
    }
  }
  const result = createArtifactRef({
    ...source,
    version: source.version + 1,
    kind: patch.outputKind,
    snapshot,
    summary: { ...source.summary, derivedFrom: `${source.id}@${source.version}`, patchId: patch.id },
  });
  return {
    artifact: result,
    receipt: {
      type: "artifact-patch-receipt",
      patchId: patch.id,
      source: `${source.id}@${source.version}`,
      result: `${result.id}@${result.version}`,
      acceptedHunkIds: [...accepted],
      rejectedHunkIds: patch.operations.filter((entry) => !accepted.has(entry.id)).map((entry) => entry.id),
    },
  };
}

export async function testArtifactPatchIsolated(source, patch, { fixtures = [], evaluate = async () => ({ passed: true }) } = {}) {
  const candidate = applyArtifactPatch(source, patch).artifact;
  const results = [];
  for (const fixture of fixtures.slice(0, 50)) results.push(await evaluate(structuredClone(candidate), structuredClone(fixture)));
  return { isolated: true, candidateFingerprint: candidate.fingerprint, passed: results.every((entry) => entry?.passed), results };
}

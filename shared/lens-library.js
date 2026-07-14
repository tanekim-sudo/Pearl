import { createLensPack, importLensPack, previewLensPackImport } from "./lens-rack.js";

export const LENS_LIBRARY_KIND = "lens-everywhere-library";
export const LENS_LIBRARY_VERSION = 1;
export const LENS_LIBRARY_LIMITS = Object.freeze({
  bytes: 10 * 1024 * 1024,
  operators: 1000,
  generators: 100,
  generatorItems: 5000,
  depth: 40,
});

const BLOCKED_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const PRIVATE_KEYS = new Set([
  "accessToken", "refreshToken", "token", "apiKey", "authorization",
  "boardSync", "companionMemory", "grindExamples", "privateExamples",
  "rawCapturedPage", "capturedPageContent",
]);
const SOURCE_KEYS = new Set(["provenance", "sourceHtml", "sourceUrl", "sourceSnippet", "pageSnapshot"]);

function assertPlain(value, depth = 0, seen = new WeakSet()) {
  if (depth > LENS_LIBRARY_LIMITS.depth) throw new Error("bundle nesting is too deep");
  if (value == null || ["string", "number", "boolean"].includes(typeof value)) return;
  if (typeof value !== "object" || value instanceof Date) throw new Error("bundle contains executable or unsupported values");
  if (seen.has(value)) throw new Error("bundle contains a cycle");
  seen.add(value);
  for (const key of Object.keys(value)) {
    if (BLOCKED_KEYS.has(key)) throw new Error("bundle contains an unsafe key");
    assertPlain(value[key], depth + 1, seen);
  }
  seen.delete(value);
}

function scrub(value, { includePrivateSources = false } = {}, depth = 0) {
  if (depth > LENS_LIBRARY_LIMITS.depth) throw new Error("library nesting is too deep");
  if (value == null || ["string", "number", "boolean"].includes(typeof value)) return value;
  if (Array.isArray(value)) return value.map((entry) => scrub(entry, { includePrivateSources }, depth + 1));
  const next = {};
  for (const [key, entry] of Object.entries(value)) {
    if (BLOCKED_KEYS.has(key) || PRIVATE_KEYS.has(key)) continue;
    if (!includePrivateSources && SOURCE_KEYS.has(key)) continue;
    next[key] = scrub(entry, { includePrivateSources }, depth + 1);
  }
  return next;
}

export function sanitizeLibraryValue(value, options = {}) {
  assertPlain(value);
  return scrub(value, options);
}

export function stableLibraryStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableLibraryStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableLibraryStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function payloadForHash(bundle) {
  const { integrity: _integrity, ...payload } = bundle;
  return payload;
}

function userRoots(operators) {
  return (operators || []).filter((operator) => operator?.id && !operator.primitive).map((operator) => operator.id);
}

export async function createLensLibraryBundle({
  operators = [],
  generators = [],
  rackMeta = {},
  collections = [],
  includePrivateSources = false,
  name = "My Lens library",
} = {}) {
  const pack = createLensPack(userRoots(operators), operators, {
    name,
    collections,
    includePrivateExamples: includePrivateSources,
  });
  const safeGenerators = generators.map((generator) => scrub(generator, { includePrivateSources }));
  const bundle = {
    kind: LENS_LIBRARY_KIND,
    version: LENS_LIBRARY_VERSION,
    id: globalThis.crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    name: String(name).slice(0, 120),
    lensPack: pack,
    generators: safeGenerators,
    rack: scrub(rackMeta),
    collections: scrub(collections),
    privacy: {
      privateSourcesIncluded: !!includePrivateSources,
      excludedByDefault: ["auth tokens", "board sync metadata", "companion memory", "private grind examples", "raw captured pages"],
    },
    migration: { minimumReaderVersion: 1 },
  };
  const serialized = stableLibraryStringify(bundle);
  if (new TextEncoder().encode(serialized).byteLength > LENS_LIBRARY_LIMITS.bytes) throw new Error("library exceeds 10 MB");
  bundle.integrity = { algorithm: "SHA-256", payloadHash: await sha256(serialized) };
  return bundle;
}

export async function validateLensLibraryBundle(raw) {
  try {
    const bundle = typeof raw === "string" ? JSON.parse(raw) : raw;
    assertPlain(bundle);
    const bytes = new TextEncoder().encode(JSON.stringify(bundle)).byteLength;
    if (bytes > LENS_LIBRARY_LIMITS.bytes) throw new Error("library exceeds 10 MB");
    if (bundle?.kind !== LENS_LIBRARY_KIND) throw new Error("not a Lens Everywhere library");
    if (bundle.version !== LENS_LIBRARY_VERSION) throw new Error("unsupported library version");
    if (bundle.integrity?.algorithm !== "SHA-256" || !/^[a-f0-9]{64}$/.test(bundle.integrity?.payloadHash || "")) {
      throw new Error("missing library checksum");
    }
    if (!Array.isArray(bundle.lensPack?.operators) || bundle.lensPack.operators.length > LENS_LIBRARY_LIMITS.operators) {
      throw new Error("invalid lens count");
    }
    if (!Array.isArray(bundle.generators) || bundle.generators.length > LENS_LIBRARY_LIMITS.generators) {
      throw new Error("invalid generator count");
    }
    const generatorItems = bundle.generators.reduce((sum, generator) => sum + (generator.items || generator.objects || []).length, 0);
    if (generatorItems > LENS_LIBRARY_LIMITS.generatorItems) throw new Error("too many generator items");
    const ids = new Set(bundle.lensPack.operators.map((operator) => operator.id));
    if (ids.size !== bundle.lensPack.operators.length || ids.has(undefined)) throw new Error("duplicate or missing lens IDs");
    for (const operator of bundle.lensPack.operators) {
      for (const dependency of [
        ...(operator.steps || []),
        ...(operator.composition?.components || []).map((component) => component.opId),
      ]) {
        if (!ids.has(dependency)) throw new Error(`missing dependency ${dependency}`);
      }
    }
    const actual = await sha256(stableLibraryStringify(payloadForHash(bundle)));
    if (actual !== bundle.integrity.payloadHash) throw new Error("library checksum does not match");
    return { ok: true, bundle, bytes, counts: { lenses: bundle.lensPack.operators.length, generators: bundle.generators.length, generatorItems } };
  } catch (error) {
    return { ok: false, error: error?.message || "invalid library" };
  }
}

export function previewLibraryImport(bundle, existingOperators = [], existingGenerators = []) {
  const lensPreview = previewLensPackImport(bundle.lensPack, existingOperators);
  const existingGeneratorMap = new Map(existingGenerators.map((entry) => [entry.id, entry]));
  const generators = bundle.generators.map((incoming) => {
    const existing = existingGeneratorMap.get(incoming.id);
    if (!existing) return { id: incoming.id, name: incoming.title || incoming.name, status: "new" };
    if (stableLibraryStringify(existing) === stableLibraryStringify(incoming)) {
      return { id: incoming.id, name: incoming.title || incoming.name, status: "exact-duplicate" };
    }
    const incomingVersion = Number(incoming.version) || 1;
    const existingVersion = Number(existing.version) || 1;
    return {
      id: incoming.id,
      name: incoming.title || incoming.name,
      status: incomingVersion > existingVersion ? "version-update" : "id-conflict",
    };
  });
  const lenses = lensPreview.entries.map((entry) => ({
    ...entry,
    status: entry.status === "duplicate" || entry.status === "duplicate-content"
      ? "exact-duplicate"
      : entry.status === "conflict"
        ? ((Number(bundle.lensPack.operators.find((op) => op.id === entry.id)?.version) || 1) >
          (Number(existingOperators.find((op) => op.id === entry.id)?.version) || 1) ? "version-update" : "id-conflict")
        : entry.status,
  }));
  return { lenses, generators };
}

export function importLensLibrary(bundle, existingOperators = [], existingGenerators = [], choices = {}, idFactory) {
  const preview = previewLibraryImport(bundle, existingOperators, existingGenerators);
  const lensChoices = {};
  for (const entry of preview.lenses) {
    lensChoices[entry.id] = choices.lenses?.[entry.id]
      || (entry.status === "new" ? "add" : entry.status === "version-update" ? "replace" : "skip");
  }
  const imported = importLensPack(bundle.lensPack, existingOperators, lensChoices, idFactory);
  const generators = [...existingGenerators];
  const ids = new Set(generators.map((entry) => entry.id));
  for (const incoming of bundle.generators) {
    const status = preview.generators.find((entry) => entry.id === incoming.id)?.status;
    const choice = choices.generators?.[incoming.id]
      || (status === "new" ? "add" : status === "version-update" ? "replace" : "skip");
    if (choice === "skip") continue;
    if (choice === "replace" && ids.has(incoming.id)) {
      generators[generators.findIndex((entry) => entry.id === incoming.id)] = incoming;
    } else if (choice === "keep-both") {
      generators.push({ ...incoming, id: idFactory(), importedFromId: incoming.id });
    } else if (!ids.has(incoming.id)) {
      generators.push(incoming);
      ids.add(incoming.id);
    }
  }
  return { operators: imported.operators, generators, preview, remap: imported.remap };
}

export function normalizeLibraryInput(raw) {
  if (raw?.kind === LENS_LIBRARY_KIND) return raw;
  if (raw?.kind === "lens-pack") {
    return {
      kind: LENS_LIBRARY_KIND,
      version: LENS_LIBRARY_VERSION,
      id: "legacy-lens-pack",
      createdAt: new Date(0).toISOString(),
      name: raw.name || "Imported lens pack",
      lensPack: raw,
      generators: [],
      rack: {},
      collections: raw.collections || [],
      privacy: { privateSourcesIncluded: !!raw.privacy?.examplesIncluded },
      migration: { minimumReaderVersion: 1, source: "lens-pack" },
    };
  }
  if (raw?.v === 1 && ["operator", "lens", "symbol"].includes(raw.kind)) {
    const trees = raw.kind === "operator" ? raw.operators : raw.kind === "lens" ? raw.lens?.opTrees : [];
    const operators = [];
    let sequence = 0;
    const flatten = (tree) => {
      const id = tree.id || `shared-${String(tree.name || "lens").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "lens"}-${sequence++}`;
      const childIds = (tree.steps || []).filter((entry) => entry && typeof entry === "object").map(flatten);
      operators.push({
        ...scrub(tree),
        id,
        version: Number(tree.version) || 1,
        ...(childIds.length ? { kind: "pipeline", steps: childIds } : {}),
      });
      return id;
    };
    const roots = (trees || []).map(flatten);
    const generators = raw.kind === "symbol"
      ? (raw.symbols || []).map((symbol, index) => ({
        ...scrub(symbol),
        id: symbol.id || `shared-generator-${index}`,
        name: symbol.title || symbol.name || "Shared generator",
        version: Number(symbol.version) || 1,
      }))
      : [];
    return {
      kind: LENS_LIBRARY_KIND,
      version: LENS_LIBRARY_VERSION,
      id: "legacy-share-bundle",
      createdAt: new Date(0).toISOString(),
      name: raw.meta?.name || raw.lens?.name || "Shared Lens library",
      lensPack: { kind: "lens-pack", version: 1, name: raw.meta?.name || "Shared lenses", roots, operators, collections: [] },
      generators,
      rack: {},
      collections: [],
      privacy: { privateSourcesIncluded: false },
      migration: { minimumReaderVersion: 1, source: `share-${raw.kind}` },
    };
  }
  return null;
}

export async function prepareLibraryInput(raw) {
  const normalized = normalizeLibraryInput(raw);
  if (!normalized) return { ok: false, error: "unsupported Lens file" };
  if (normalized.integrity) return validateLensLibraryBundle(normalized);
  normalized.integrity = {
    algorithm: "SHA-256",
    payloadHash: await sha256(stableLibraryStringify(payloadForHash(normalized))),
  };
  return validateLensLibraryBundle(normalized);
}

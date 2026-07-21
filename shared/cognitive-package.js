const PACKAGE_VERSION = 1;
const KINDS = new Set(["move", "function", "lens", "bundle"]);
const VISIBILITY = new Set(["private", "team", "unlisted", "public"]);
const FORBIDDEN_KEYS = new Set(["code", "script", "eval", "executable", "javascript", "wasm"]);

function clean(value) {
  if (Array.isArray(value)) return value.map(clean);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, entry]) => entry !== undefined && key !== "signature" && key !== "contentHash" && typeof entry !== "function")
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, clean(entry)])
  );
}

export function canonicalPackageJson(value) {
  return JSON.stringify(clean(value));
}

function bytes(value) {
  return new TextEncoder().encode(value);
}

function base64url(value) {
  const binary = String.fromCharCode(...new Uint8Array(value));
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function fromBase64url(value) {
  const normalized = String(value).replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function packageHash(value, cryptoApi = globalThis.crypto) {
  if (!cryptoApi?.subtle) throw new Error("Web Crypto is required");
  return `sha256-${base64url(await cryptoApi.subtle.digest("SHA-256", bytes(canonicalPackageJson(value))))}`;
}

function assertDeclarative(value, path = "manifest") {
  if (typeof value === "function") throw new Error(`${path} cannot contain executable functions`);
  if (!value || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) throw new Error(`${path}.${key} is not declarative package data`);
    if (typeof entry === "string" && /\b(?:javascript:|<script|eval\s*\(|new\s+Function\s*\()/i.test(entry)) {
      throw new Error(`${path}.${key} contains executable content`);
    }
    assertDeclarative(entry, `${path}.${key}`);
  }
}

function semver(value, field = "version") {
  const normalized = String(value || "").trim();
  if (!/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/.test(normalized)) {
    throw new Error(`${field} must be semantic version`);
  }
  return normalized;
}

export function validateCognitivePackageManifest(manifest, { requireSignature = false } = {}) {
  assertDeclarative(manifest);
  if (manifest?.schemaVersion !== PACKAGE_VERSION) throw new Error(`unsupported package schema ${manifest?.schemaVersion}`);
  if (!/^[a-z0-9][a-z0-9._-]{1,63}$/i.test(manifest.namespace || "")) throw new Error("package namespace is invalid");
  if (!/^[a-z0-9][a-z0-9._-]{1,63}$/i.test(manifest.name || "")) throw new Error("package name is invalid");
  semver(manifest.version);
  if (!Array.isArray(manifest.kinds) || !manifest.kinds.length || manifest.kinds.some((kind) => !KINDS.has(kind))) {
    throw new Error("package kinds are invalid");
  }
  if (!VISIBILITY.has(manifest.visibility)) throw new Error("package visibility is invalid");
  if (!Array.isArray(manifest.artifacts) || !manifest.artifacts.length) throw new Error("package requires declarative artifacts");
  for (const artifact of manifest.artifacts) {
    if (!["move", "function", "lens"].includes(artifact.kind) || !artifact.id || !artifact.version || !artifact.hash) {
      throw new Error("package artifact reference is incomplete");
    }
  }
  if (!Array.isArray(manifest.tests)) throw new Error("package test evidence must be an array");
  if (manifest.tests.some((test) => test.status === "passed" && !test.evidenceHash)) {
    throw new Error("passed package tests require evidence hashes");
  }
  if (requireSignature && (!manifest.signature?.value || manifest.signature.algorithm !== "Ed25519")) {
    throw new Error("verified Ed25519 signature is required");
  }
  return manifest;
}

export async function createCognitivePackageManifest(input, cryptoApi = globalThis.crypto) {
  const createdAt = input.createdAt || new Date().toISOString();
  const artifacts = await Promise.all((input.artifacts || []).map(async (artifact) => ({
    id: artifact.id,
    version: Number(artifact.version) || 1,
    kind: artifact.kind,
    hash: artifact.hash || await packageHash(artifact.snapshot || artifact, cryptoApi),
    contracts: clean(artifact.contracts || {}),
    lineage: clean(artifact.lineage || {}),
  })));
  const manifest = {
    schemaVersion: PACKAGE_VERSION,
    namespace: String(input.namespace || "").trim(),
    name: String(input.name || "").trim(),
    version: semver(input.version || "0.1.0"),
    kinds: [...new Set(input.kinds || artifacts.map((artifact) => artifact.kind))],
    artifacts,
    dependencies: clean(input.dependencies || []),
    contracts: clean(input.contracts || {}),
    lensContext: clean(input.lensContext || null),
    requirements: clean(input.requirements || { models: [], modalities: ["text"], contextLimit: null }),
    permissions: clean(input.permissions || []),
    connectors: clean(input.connectors || []),
    provenance: clean(input.provenance || {}),
    author: clean(input.author || {}),
    license: input.license || "UNLICENSED",
    visibility: input.visibility || "private",
    tests: clean(input.tests || []),
    scans: clean(input.scans || { quality: null, security: null, privacy: null }),
    changelog: clean(input.changelog || []),
    migrationNotes: input.migrationNotes || "",
    deprecation: clean(input.deprecation || null),
    createdAt,
    publishedAt: input.publishedAt || null,
  };
  validateCognitivePackageManifest(manifest);
  return { ...manifest, contentHash: await packageHash(manifest, cryptoApi) };
}

export async function generatePackageSigningIdentity(cryptoApi = globalThis.crypto) {
  if (!cryptoApi?.subtle) throw new Error("Web Crypto is required");
  const pair = await cryptoApi.subtle.generateKey({ name: "Ed25519" }, false, ["sign", "verify"]);
  return {
    privateKey: pair.privateKey,
    publicKey: pair.publicKey,
    publicJwk: await cryptoApi.subtle.exportKey("jwk", pair.publicKey),
  };
}

export async function signCognitivePackage(manifest, { privateKey, keyId, cryptoApi = globalThis.crypto }) {
  validateCognitivePackageManifest(manifest);
  if (!privateKey || privateKey.type !== "private" || privateKey.extractable) {
    throw new Error("signing requires a non-extractable private key");
  }
  const contentHash = await packageHash(manifest, cryptoApi);
  if (manifest.contentHash && manifest.contentHash !== contentHash) throw new Error("package content hash mismatch before signing");
  const value = base64url(await cryptoApi.subtle.sign({ name: "Ed25519" }, privateKey, bytes(contentHash)));
  return {
    ...clean(manifest),
    contentHash,
    signature: {
      algorithm: "Ed25519",
      keyId,
      value,
      signedAt: new Date().toISOString(),
    },
  };
}

export async function verifyCognitivePackage(signed, { publicKey, revokedKeyIds = [], cryptoApi = globalThis.crypto }) {
  validateCognitivePackageManifest(signed, { requireSignature: true });
  if (revokedKeyIds.includes(signed.signature.keyId)) throw new Error("package signing key is revoked");
  if (!publicKey || publicKey.type !== "public") throw new Error("trusted package public key is unavailable");
  const contentHash = await packageHash(signed, cryptoApi);
  if (contentHash !== signed.contentHash) throw new Error("package content hash mismatch");
  const valid = await cryptoApi.subtle.verify(
    { name: "Ed25519" },
    publicKey,
    fromBase64url(signed.signature.value),
    bytes(contentHash)
  );
  if (!valid) throw new Error("package signature mismatch");
  return { valid: true, contentHash, keyId: signed.signature.keyId };
}

export function resolvePackageDependencies(root, available) {
  const byName = new Map(available.map((entry) => [`${entry.namespace}/${entry.name}@${entry.version}`, entry]));
  const visiting = new Set();
  const visited = new Set();
  const ordered = [];
  const visit = (pkg) => {
    const key = `${pkg.namespace}/${pkg.name}@${pkg.version}`;
    if (visiting.has(key)) throw new Error(`package dependency cycle at ${key}`);
    if (visited.has(key)) return;
    visiting.add(key);
    for (const dependency of pkg.dependencies || []) {
      const exact = dependency.version || dependency.pinned;
      const resolved = byName.get(`${dependency.namespace}/${dependency.name}@${exact}`);
      if (!resolved) throw new Error(`package dependency unavailable: ${dependency.namespace}/${dependency.name}@${exact}`);
      visit(resolved);
    }
    visiting.delete(key);
    visited.add(key);
    ordered.push(pkg);
  };
  visit(root);
  return ordered;
}

export async function installCognitivePackageAtomic(pkg, {
  verify,
  readInstalled,
  writeInstalled,
}) {
  await verify(pkg);
  const before = await readInstalled();
  const key = `${pkg.namespace}/${pkg.name}`;
  const next = { ...before, [key]: pkg };
  try {
    await writeInstalled(next);
    return { type: "package-install-receipt", id: `${key}@${pkg.version}`, previousVersion: before[key]?.version || null };
  } catch (error) {
    try {
      await writeInstalled(before);
      throw new Error(`package install rolled back: ${error.message}`);
    } catch (rollbackError) {
      if (/^package install rolled back:/.test(rollbackError.message)) throw rollbackError;
      throw new Error(`package install failed and rollback could not be verified: ${error.message}; ${rollbackError.message}`);
    }
  }
}

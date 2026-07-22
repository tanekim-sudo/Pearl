import {
  createCognitivePackageManifest,
  installCognitivePackageAtomic,
  packageHash,
  resolvePackageDependencies,
  signCognitivePackage,
  validateCognitivePackageManifest,
  verifyCognitivePackage,
} from "./cognitive-package.js";

export const PEARL_SHARE_VERSION = 1;
export const PEARL_PACKAGE_EXTENSION = ".pearl";
export const PEARL_SHARE_MODES = Object.freeze([
  "download",
  "private-once",
  "unlisted",
  "public",
  "team",
  "clone",
  "reference",
]);
export const PEARL_SHARE_COMPONENTS = Object.freeze([
  "identity",
  "cognition",
  "privacyPolicy",
  "contextSchema",
  "moves",
  "functions",
  "lenses",
  "outputSpecs",
  "templates",
  "examples",
  "tests",
  "generationPlan",
  "researchPlan",
  "canvasSettings",
  "soundscapeSettings",
  "dependencies",
  "license",
  "permissions",
  "lineage",
  "publicMetadata",
]);
export const PEARL_PRIVATE_COMPONENTS = Object.freeze([
  "privateContext",
  "rawCaptures",
  "commandHistory",
  "credentials",
  "localAudio",
  "disclosureReceipts",
  "sourceMaterial",
]);

const SECRET_PATTERNS = Object.freeze([
  ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i],
  ["api-key", /\b(?:sk|pk|api)[-_][a-z0-9_-]{16,}\b/i],
  ["bearer-token", /\bbearer\s+[a-z0-9._~+/-]{16,}\b/i],
  ["credential", /\b(?:password|passwd|secret|access[_ -]?token|refresh[_ -]?token|client[_ -]?secret)\s*[:=]\s*\S+/i],
  ["connection-string", /\b(?:postgres|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s]+/i],
  ["private-context", /\b(?:confidential|internal only|do not distribute|firm[- ]private|privileged and confidential)\b/i],
  ["private-context", /\b(?:limited partner|lp briefing|lp meeting|investment committee|\bic memo\b|pitchbook|affinity crm|capital call|management fee|carry)\b/i],
]);
const BLOCKED_KEYS = new Set(["__proto__", "prototype", "constructor", "code", "script", "eval", "executable", "wasm"]);
const clone = (value) => value == null ? value : structuredClone(value);
const bounded = (value, limit = 100_000) => String(value ?? "").slice(0, limit);
const opaqueId = (prefix) => `${prefix}_${globalThis.crypto?.randomUUID?.().replaceAll("-", "") || `${Date.now()}${Math.random().toString(36).slice(2)}`}`;

function assertPlain(value, path = "package", depth = 0, seen = new WeakSet()) {
  if (depth > 24) throw new Error(`${path} exceeds package nesting limit`);
  if (value == null || ["string", "number", "boolean"].includes(typeof value)) return;
  if (typeof value !== "object" || value instanceof Date) throw new Error(`${path} must contain declarative data only`);
  if (seen.has(value)) throw new Error(`${path} contains a cycle`);
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) throw new Error(`${path} must contain plain data`);
  seen.add(value);
  for (const [key, entry] of Object.entries(value)) {
    const declarativeExecutionFlag = key.toLowerCase() === "executable"
      && path.endsWith(".uncertainty")
      && typeof entry === "boolean";
    if (BLOCKED_KEYS.has(key.toLowerCase()) && !declarativeExecutionFlag) throw new Error(`${path}.${key} is not declarative package data`);
    assertPlain(entry, `${path}.${key}`, depth + 1, seen);
  }
  seen.delete(value);
}

function walkStrings(value, visit, path = "", depth = 0) {
  if (depth > 24 || value == null) return;
  if (typeof value === "string") return visit(value, path);
  if (Array.isArray(value)) return value.forEach((entry, index) => walkStrings(entry, visit, `${path}[${index}]`, depth + 1));
  if (typeof value === "object") Object.entries(value).forEach(([key, entry]) => walkStrings(entry, visit, path ? `${path}.${key}` : key, depth + 1));
}

export function classifyPearlShareSensitivity(value) {
  assertPlain(value, "Pearl");
  const findings = [];
  walkStrings(value, (text, path) => {
    for (const [kind, pattern] of SECRET_PATTERNS) {
      const match = text.match(pattern);
      if (match) findings.push({
        id: `finding:${findings.length + 1}`,
        kind,
        path,
        severity: kind === "private-context" ? "private" : "secret",
        preview: `${text.slice(Math.max(0, match.index - 16), match.index)}[REDACTED]${text.slice((match.index || 0) + match[0].length, (match.index || 0) + match[0].length + 16)}`.slice(0, 120),
      });
    }
  });
  for (const component of PEARL_PRIVATE_COMPONENTS) {
    if (value?.[component] != null) findings.push({
      id: `finding:${findings.length + 1}`,
      kind: "excluded-private-component",
      path: component,
      severity: "private",
      preview: `${component} is private by default`,
    });
  }
  return { version: PEARL_SHARE_VERSION, findings, safe: !findings.some((entry) => entry.severity === "secret") };
}

function selectedSnapshot(pearl, included) {
  return Object.fromEntries(included.map((component) => [component, clone(pearl?.[component])]).filter(([, value]) => value != null));
}

export function createPearlShareReview(pearl, selection = {}) {
  if (!pearl?.id) throw new Error("Pearl identity is required");
  const included = [...new Set((selection.included || ["identity", "cognition", "privacyPolicy", "contextSchema", "moves", "functions", "lenses", "outputSpecs", "templates", "tests", "generationPlan", "researchPlan", "dependencies", "license", "permissions", "lineage", "publicMetadata"])
    .filter((entry) => PEARL_SHARE_COMPONENTS.includes(entry)))];
  const privateRequested = (selection.privateIncluded || []).filter((entry) => PEARL_PRIVATE_COMPONENTS.includes(entry));
  if (privateRequested.length && selection.privateApproval !== true) throw new Error("private Pearl context requires explicit scoped approval");
  if (privateRequested.length && !selection.encryption?.required) throw new Error("private Pearl context sharing requires recipient-bound encryption");
  const snapshot = { ...selectedSnapshot(pearl, included), ...selectedSnapshot(pearl, privateRequested) };
  const classification = classifyPearlShareSensitivity(snapshot);
  const unresolvedSecrets = classification.findings.filter((finding) =>
    finding.severity === "secret" && !(selection.redactions || []).includes(finding.path)
  );
  const invalidUncertainty = (snapshot.cognition?.layers || []).filter((layer) =>
    layer.uncertainty?.status !== "resolved" && (layer.uncertainty?.executable === true || layer.uncertainty?.shareableFact === true)
  );
  const redacted = clone(snapshot);
  for (const finding of classification.findings) {
    if (!(selection.redactions || []).includes(finding.path)) continue;
    const parts = finding.path.split(".");
    let target = redacted;
    for (let index = 0; index < parts.length - 1; index += 1) target = target?.[parts[index]];
    if (target && parts.at(-1) in target) target[parts.at(-1)] = "[REDACTED]";
  }
  return {
    version: PEARL_SHARE_VERSION,
    pearlId: pearl.id,
    sourceVersion: Number(pearl.version) || 1,
    included,
    privateIncluded: privateRequested,
    omitted: [...PEARL_SHARE_COMPONENTS, ...PEARL_PRIVATE_COMPONENTS].filter((entry) => !included.includes(entry) && !privateRequested.includes(entry)),
    linked: clone(selection.linked || []),
    redactions: clone(selection.redactions || []),
    findings: classification.findings,
    blocked: unresolvedSecrets.length > 0 || invalidUncertainty.length > 0,
    blockedReasons: [
      ...unresolvedSecrets.map((entry) => entry.id),
      ...invalidUncertainty.map((entry) => `unresolved-executable-layer:${entry.id}`),
    ],
    encryption: privateRequested.length ? clone(selection.encryption) : null,
    snapshot: redacted,
    reviewedAt: Date.now(),
  };
}

function artifactKind(component) {
  if (component === "moves") return "move";
  if (component === "lenses" || component === "contextSchema") return "lens";
  return "function";
}

export async function preparePearlPackage(pearl, review, options = {}) {
  if (review?.pearlId !== pearl?.id || review?.sourceVersion !== (Number(pearl.version) || 1)) throw new Error("Pearl changed after share review");
  if (review.blocked) throw new Error("Pearl share review has unresolved sensitive data");
  if (!PEARL_SHARE_MODES.includes(options.mode || "download")) throw new Error("Pearl share mode is invalid");
  const snapshots = Object.entries(review.snapshot).map(([component, snapshot]) => ({
    id: `${pearl.id}:${component}`,
    version: Number(pearl.version) || 1,
    kind: artifactKind(component),
    component,
    snapshot,
  }));
  const artifacts = await Promise.all(snapshots.map(async (artifact) => ({
    ...artifact,
    hash: await packageHash(artifact.snapshot),
  })));
  const mode = options.mode || "download";
  const manifest = await createCognitivePackageManifest({
    namespace: options.namespace || "pearl.local",
    name: options.name || bounded(pearl.identity?.name || pearl.name || pearl.id, 64).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-|-$/g, "") || "shared-pearl",
    version: options.version || `${Number(pearl.version) || 1}.0.0`,
    kinds: [...new Set(artifacts.map((entry) => entry.kind))],
    artifacts,
    dependencies: review.snapshot.dependencies || [],
    contracts: {
      pearlId: pearl.id,
      sourceVersion: Number(pearl.version) || 1,
      shareMode: mode,
      updateChannel: mode === "reference" ? options.updateChannel || null : null,
      reviewHash: await packageHash({ ...review, snapshot: undefined }),
    },
    lensContext: review.snapshot.contextSchema || null,
    permissions: review.snapshot.permissions || [],
    provenance: { ...clone(pearl.provenance || {}), lineage: clone(review.snapshot.lineage || []), sharedAt: new Date().toISOString() },
    author: clone(options.author || {}),
    license: review.snapshot.license || options.license || "UNLICENSED",
    visibility: mode === "public" ? "public" : mode === "unlisted" || mode === "reference" ? "unlisted" : mode === "team" ? "team" : "private",
    tests: clone(review.snapshot.tests || []),
    scans: { privacy: { passed: true, findings: review.findings.length }, security: options.securityScan || null, quality: options.qualityScan || null },
  });
  const signedManifest = await signCognitivePackage(manifest, options.signing);
  return {
    format: "pearl-cognitive-package",
    version: PEARL_SHARE_VERSION,
    manifest: signedManifest,
    artifacts,
    publicMetadata: clone(review.snapshot.publicMetadata || review.snapshot.identity || {}),
    share: {
      mode,
      ownership: options.ownership || "author",
      editRights: options.editRights || (mode === "clone" ? "fork-only" : "none"),
      expiresAt: options.expiresAt || null,
      revocable: mode !== "download",
      recipientBinding: options.recipientBinding || null,
    },
  };
}

export function createPearlShareGrant(pkg, options = {}) {
  const mode = options.mode || pkg?.share?.mode;
  if (!PEARL_SHARE_MODES.includes(mode)) throw new Error("Pearl share mode is invalid");
  if (mode === "team" && !options.recipientId && !options.teamId) throw new Error("recipient or named team identity is required for this share mode");
  const now = options.now || Date.now();
  return {
    version: PEARL_SHARE_VERSION,
    id: opaqueId("psh"),
    packageHash: pkg.manifest.contentHash,
    mode,
    ownerId: options.ownerId,
    recipientId: options.recipientId || null,
    teamId: options.teamId || null,
    permissions: clone(options.permissions || ["inspect", "install", "fork"]),
    oneTime: mode === "private-once",
    uses: 0,
    maxUses: mode === "private-once" ? 1 : Math.max(1, Number(options.maxUses) || 10_000),
    createdAt: now,
    expiresAt: options.expiresAt || now + (mode === "private-once" ? 10 * 60_000 : 30 * 24 * 60 * 60_000),
    revokedAt: null,
  };
}

export function consumePearlShareGrant(grant, claims = {}, now = Date.now()) {
  if (!grant || grant.version !== PEARL_SHARE_VERSION) throw new Error("Pearl share is unavailable");
  if (grant.revokedAt) throw new Error("Pearl share was revoked");
  if (grant.expiresAt <= now) throw new Error("Pearl share expired");
  if (grant.uses >= grant.maxUses) throw new Error("Pearl share has already been consumed");
  if (grant.recipientId && grant.recipientId !== claims.recipientId) throw new Error("Pearl share recipient is unauthorized");
  if (grant.teamId && !claims.teamIds?.includes(grant.teamId)) throw new Error("Pearl team grant is unauthorized");
  return {
    grant: { ...grant, uses: grant.uses + 1, consumedAt: now },
    receipt: { type: "pearl-share-consumption", grantId: grant.id, packageHash: grant.packageHash, recipientId: claims.recipientId || "accountless-local", at: now },
  };
}

export function revokePearlShareGrant(grant, actorId, now = Date.now()) {
  if (grant.ownerId !== actorId) throw new Error("only the Pearl share owner can revoke this grant");
  return { ...grant, revokedAt: now };
}

export async function validatePearlPackage(pkg, options = {}) {
  assertPlain(pkg, "Pearl package");
  if (pkg?.format !== "pearl-cognitive-package" || pkg.version !== PEARL_SHARE_VERSION) throw new Error("unsupported Pearl package");
  const classification = classifyPearlShareSensitivity({
    artifacts: (pkg.artifacts || []).map((artifact) => ({
      component: artifact.component,
      snapshot: artifact.snapshot,
    })),
  });
  const secrets = classification.findings.filter((finding) => finding.severity === "secret");
  if (secrets.length) throw new Error(`Pearl package contains unreviewed secret material: ${secrets.map((finding) => finding.path).join(", ")}`);
  validateCognitivePackageManifest(pkg.manifest, { requireSignature: true });
  await verifyCognitivePackage(pkg.manifest, options);
  for (const artifact of pkg.artifacts || []) {
    if (!artifact.id || !artifact.component || !artifact.snapshot) throw new Error("Pearl package artifact is incomplete");
    if (artifact.hash !== await packageHash(artifact.snapshot, options.cryptoApi)) throw new Error(`Pearl package artifact was tampered: ${artifact.id}`);
  }
  const declared = new Map(pkg.manifest.artifacts.map((entry) => [entry.id, entry]));
  if (declared.size !== pkg.artifacts.length || pkg.artifacts.some((entry) => declared.get(entry.id)?.hash !== entry.hash)) {
    throw new Error("Pearl package manifest does not match its artifacts");
  }
  resolvePackageDependencies(pkg.manifest, options.availableDependencies || [pkg.manifest]);
  const failedTest = pkg.manifest.tests.find((test) => test.required !== false && test.status !== "passed");
  if (failedTest) throw new Error(`Pearl package required test did not pass: ${failedTest.id || "unknown"}`);
  return { valid: true, contentHash: pkg.manifest.contentHash, artifacts: pkg.artifacts.length };
}

export async function installPearlPackage(pkg, stores, options = {}) {
  return installCognitivePackageAtomic(pkg.manifest, {
    verify: async () => validatePearlPackage(pkg, options),
    readInstalled: stores.readInstalled,
    writeInstalled: async (installed) => {
      const key = `${pkg.manifest.namespace}/${pkg.manifest.name}`;
      await stores.writeInstalled({
        ...installed,
        [key]: {
          ...installed[key],
          package: pkg,
          installedAt: Date.now(),
          localPearlId: options.localPearlId || opaqueId("pearl"),
          forked: options.fork === true,
        },
      });
    },
  });
}

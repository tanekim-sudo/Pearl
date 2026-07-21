export const PEARL_PRIVACY_POLICY_VERSION = 1;
export const PRIVACY_AUDIENCES = Object.freeze(["local-only", "private-account", "selected-people", "organization", "organization-groups", "unlisted-link", "public"]);
export const PRIVACY_SENSITIVITIES = Object.freeze(["public", "personal", "confidential", "firm-internal", "restricted"]);
export const PRIVACY_STORAGE_MODES = Object.freeze(["device-only", "encrypted-account-sync", "encrypted-organization-sync"]);
export const PRIVACY_DISCLOSURE_CHANNELS = Object.freeze(["model", "research", "music-search", "export", "link", "recipient", "derived-result", "sync", "handoff"]);
export const PRIVACY_ROLES = Object.freeze(["owner", "viewer", "runner", "editor", "sharer", "admin"]);
export const PRIVACY_RIGHTS = Object.freeze(["inspect", "run", "edit", "share", "admin", "clone", "fork", "update", "export", "research"]);

const audienceRank = new Map(PRIVACY_AUDIENCES.map((entry, index) => [entry, index]));
const sensitivityRank = new Map(PRIVACY_SENSITIVITIES.map((entry, index) => [entry, index]));
const storageRank = new Map(PRIVACY_STORAGE_MODES.map((entry, index) => [entry, index]));
const clone = (value) => value == null ? value : structuredClone(value);
const bounded = (value, limit = 500) => String(value ?? "").slice(0, limit);
const id = (prefix) => `${prefix}:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

const DEFAULT_ROLE_RIGHTS = Object.freeze({
  owner: PRIVACY_RIGHTS,
  admin: PRIVACY_RIGHTS,
  sharer: ["inspect", "run", "share", "clone", "fork", "export"],
  editor: ["inspect", "run", "edit", "clone", "fork", "update", "research"],
  runner: ["run"],
  viewer: ["inspect"],
});

function unique(values, allowed, limit = 100) {
  return [...new Set(values || [])].filter((entry) => allowed.includes(entry)).slice(0, limit);
}

function normalizeDisclosure(value = {}) {
  return Object.fromEntries(PRIVACY_DISCLOSURE_CHANNELS.map((channel) => {
    const current = value[channel];
    return [channel, {
      allowed: current?.allowed === true,
      fields: (current?.fields || []).slice(0, 100).map((entry) => bounded(entry, 220)),
      providers: (current?.providers || []).slice(0, 30).map((entry) => bounded(entry, 220)),
      purposes: (current?.purposes || []).slice(0, 30).map((entry) => bounded(entry, 220)),
      requiresApproval: current?.requiresApproval !== false,
    }];
  }));
}

function normalizeAcl(value = {}) {
  const grants = (value.grants || []).slice(0, 500).map((grant) => {
    const role = PRIVACY_ROLES.includes(grant.role) ? grant.role : "viewer";
    return {
      id: bounded(grant.id || id("acl"), 220),
      subjectType: ["user", "organization", "group", "role", "device"].includes(grant.subjectType) ? grant.subjectType : "user",
      subjectId: bounded(grant.subjectId, 220),
      role,
      rights: unique(grant.rights?.length ? grant.rights : DEFAULT_ROLE_RIGHTS[role], PRIVACY_RIGHTS),
      expiresAt: grant.expiresAt || null,
      revokedAt: grant.revokedAt || null,
    };
  }).filter((entry) => entry.subjectId);
  return {
    ownerId: bounded(value.ownerId || "local-profile", 220),
    organizationId: value.organizationId ? bounded(value.organizationId, 220) : null,
    grants,
    defaultRecipientRights: unique(value.defaultRecipientRights || ["inspect", "run"], PRIVACY_RIGHTS),
  };
}

export function createPearlPrivacyPolicy(input = {}) {
  const audience = PRIVACY_AUDIENCES.includes(input.audience) ? input.audience : "local-only";
  const sensitivity = PRIVACY_SENSITIVITIES.includes(input.sensitivity) ? input.sensitivity : "personal";
  const storageMode = PRIVACY_STORAGE_MODES.includes(input.storage?.mode) ? input.storage.mode : "device-only";
  if (audience === "local-only" && storageMode !== "device-only") throw new Error("local-only Pearls must remain device-only");
  if (storageMode === "encrypted-organization-sync" && !input.acl?.organizationId) throw new Error("organization sync requires a verified organization boundary");
  return {
    schemaVersion: PEARL_PRIVACY_POLICY_VERSION,
    id: bounded(input.id || id("privacy-policy"), 220),
    pearlId: bounded(input.pearlId, 220),
    version: Math.max(1, Number(input.version) || 1),
    audience,
    audienceScope: {
      people: (input.audienceScope?.people || []).slice(0, 500).map((entry) => bounded(entry, 220)),
      organizationId: input.audienceScope?.organizationId ? bounded(input.audienceScope.organizationId, 220) : null,
      groups: (input.audienceScope?.groups || []).slice(0, 200).map((entry) => bounded(entry, 220)),
      roles: (input.audienceScope?.roles || []).slice(0, 100).map((entry) => bounded(entry, 120)),
    },
    sensitivity,
    customLabels: (input.customLabels || []).slice(0, 50).map((entry) => bounded(entry, 120)),
    storage: {
      mode: storageMode,
      residency: (input.storage?.residency || []).slice(0, 20).map((entry) => bounded(entry, 80)),
      allowedStores: (input.storage?.allowedStores || ["indexeddb"]).slice(0, 20).map((entry) => bounded(entry, 120)),
      queuedEncryptedSync: input.storage?.queuedEncryptedSync === true,
    },
    disclosure: normalizeDisclosure({
      model: { allowed: true, requiresApproval: true, purposes: ["explicit-user-request"] },
      export: { allowed: true, requiresApproval: true, purposes: ["explicit-user-placement"] },
      "derived-result": { allowed: true, requiresApproval: false, purposes: ["local-staging"] },
      ...(input.disclosure || {}),
    }),
    acl: normalizeAcl(input.acl),
    retention: {
      expiresAt: input.retention?.expiresAt || null,
      localDays: input.retention?.localDays == null ? null : Math.max(0, Number(input.retention.localDays)),
      serverDays: input.retention?.serverDays == null ? 0 : Math.max(0, Number(input.retention.serverDays)),
      revokeRecipientsOnExpiry: input.retention?.revokeRecipientsOnExpiry !== false,
      tombstone: input.retention?.tombstone !== false,
      propagateDeletion: input.retention?.propagateDeletion !== false,
    },
    provenance: {
      source: bounded(input.provenance?.source || "pearl-default", 220),
      inheritedPolicyIds: (input.provenance?.inheritedPolicyIds || []).slice(0, 500).map((entry) => bounded(entry, 220)),
      overrides: clone(input.provenance?.overrides || []),
      signer: clone(input.provenance?.signer || null),
      createdAt: input.provenance?.createdAt || Date.now(),
      updatedAt: input.provenance?.updatedAt || Date.now(),
    },
    encryption: {
      status: ["locked", "unlocked", "unavailable"].includes(input.encryption?.status) ? input.encryption.status : "unlocked",
      localKeyId: input.encryption?.localKeyId ? bounded(input.encryption.localKeyId, 220) : null,
      accountEnvelopeId: input.encryption?.accountEnvelopeId ? bounded(input.encryption.accountEnvelopeId, 220) : null,
      organizationEnvelopeId: input.encryption?.organizationEnvelopeId ? bounded(input.encryption.organizationEnvelopeId, 220) : null,
      organizationKeyVersion: input.encryption?.organizationKeyVersion || null,
      recipientGrantIds: (input.encryption?.recipientGrantIds || []).slice(0, 500).map((entry) => bounded(entry, 220)),
      rotationState: bounded(input.encryption?.rotationState || "current", 80),
      revokedDeviceIds: (input.encryption?.revokedDeviceIds || []).slice(0, 500).map((entry) => bounded(entry, 220)),
      recovery: bounded(input.encryption?.recovery || "local-warning-required", 120),
    },
    audit: {
      lastDisclosureAt: input.audit?.lastDisclosureAt || null,
      lastShareAt: input.audit?.lastShareAt || null,
      lastEditAt: input.audit?.lastEditAt || null,
      conflicts: clone(input.audit?.conflicts || []),
      pendingApprovals: clone(input.audit?.pendingApprovals || []),
      integrity: bounded(input.audit?.integrity || "local-unverified", 120),
      receiptHead: input.audit?.receiptHead || null,
    },
  };
}

function restrictiveByRank(values, ranks, fallback) {
  return values.reduce((chosen, value) => ranks.get(value) < ranks.get(chosen) ? value : chosen, fallback);
}

function mostSensitive(values) {
  return values.reduce((chosen, value) => sensitivityRank.get(value) > sensitivityRank.get(chosen) ? value : chosen, "public");
}

function intersection(arrays) {
  if (!arrays.length) return [];
  return arrays.slice(1).reduce((shared, values) => shared.filter((entry) => values.includes(entry)), [...arrays[0]]);
}

function earliest(values) {
  const dates = values.filter(Boolean).map((entry) => new Date(entry).getTime()).filter(Number.isFinite);
  return dates.length ? new Date(Math.min(...dates)).toISOString() : null;
}

export function effectivePearlPrivacyPolicy(policies = [], options = {}) {
  const normalized = policies.filter(Boolean).map(createPearlPrivacyPolicy);
  if (!normalized.length) normalized.push(createPearlPrivacyPolicy({ pearlId: options.pearlId }));
  const audience = restrictiveByRank(normalized.map((entry) => entry.audience), audienceRank, "public");
  const storageMode = restrictiveByRank(normalized.map((entry) => entry.storage.mode), storageRank, "encrypted-organization-sync");
  const disclosure = Object.fromEntries(PRIVACY_DISCLOSURE_CHANNELS.map((channel) => {
    const entries = normalized.map((entry) => entry.disclosure[channel]);
    return [channel, {
      allowed: entries.every((entry) => entry.allowed),
      fields: intersection(entries.map((entry) => entry.fields)),
      providers: intersection(entries.map((entry) => entry.providers)),
      purposes: intersection(entries.map((entry) => entry.purposes)),
      requiresApproval: entries.some((entry) => entry.requiresApproval),
    }];
  }));
  const conflicts = normalized.flatMap((entry) => entry.audit.conflicts || []);
  if (new Set(normalized.map((entry) => entry.acl.organizationId).filter(Boolean)).size > 1) {
    conflicts.push({ code: "ORGANIZATION_BOUNDARY_CONFLICT", blocking: true });
  }
  const effective = createPearlPrivacyPolicy({
    pearlId: options.pearlId || normalized[0].pearlId,
    audience,
    audienceScope: {
      people: intersection(normalized.map((entry) => entry.audienceScope.people)),
      organizationId: normalized.map((entry) => entry.audienceScope.organizationId).find(Boolean) || null,
      groups: intersection(normalized.map((entry) => entry.audienceScope.groups)),
      roles: intersection(normalized.map((entry) => entry.audienceScope.roles)),
    },
    sensitivity: mostSensitive(normalized.map((entry) => entry.sensitivity)),
    customLabels: [...new Set(normalized.flatMap((entry) => entry.customLabels))],
    storage: {
      mode: audience === "local-only" ? "device-only" : storageMode,
      residency: intersection(normalized.map((entry) => entry.storage.residency)),
      allowedStores: intersection(normalized.map((entry) => entry.storage.allowedStores)),
      queuedEncryptedSync: audience !== "local-only" && normalized.every((entry) => entry.storage.queuedEncryptedSync),
    },
    disclosure,
    acl: {
      ownerId: normalized[0].acl.ownerId,
      organizationId: normalized.map((entry) => entry.acl.organizationId).find(Boolean) || null,
      grants: normalized.flatMap((entry) => entry.acl.grants),
      defaultRecipientRights: intersection(normalized.map((entry) => entry.acl.defaultRecipientRights)),
    },
    retention: {
      expiresAt: earliest(normalized.map((entry) => entry.retention.expiresAt)),
      localDays: Math.min(...normalized.map((entry) => entry.retention.localDays ?? Number.POSITIVE_INFINITY)),
      serverDays: Math.min(...normalized.map((entry) => entry.retention.serverDays ?? 0)),
      revokeRecipientsOnExpiry: normalized.some((entry) => entry.retention.revokeRecipientsOnExpiry),
      tombstone: normalized.some((entry) => entry.retention.tombstone),
      propagateDeletion: normalized.some((entry) => entry.retention.propagateDeletion),
    },
    provenance: {
      source: "effective-most-restrictive",
      inheritedPolicyIds: normalized.map((entry) => entry.id),
      createdAt: normalized[0].provenance.createdAt,
      updatedAt: Date.now(),
    },
    encryption: {
      status: normalized.some((entry) => entry.encryption.status !== "unlocked") ? "locked" : "unlocked",
      localKeyId: normalized[0].encryption.localKeyId,
      accountEnvelopeId: normalized.find((entry) => entry.encryption.accountEnvelopeId)?.encryption.accountEnvelopeId,
      organizationEnvelopeId: normalized.find((entry) => entry.encryption.organizationEnvelopeId)?.encryption.organizationEnvelopeId,
      organizationKeyVersion: normalized.find((entry) => entry.encryption.organizationKeyVersion)?.encryption.organizationKeyVersion,
      recipientGrantIds: intersection(normalized.map((entry) => entry.encryption.recipientGrantIds)),
      rotationState: normalized.some((entry) => entry.encryption.rotationState !== "current") ? "rotation-required" : "current",
      revokedDeviceIds: [...new Set(normalized.flatMap((entry) => entry.encryption.revokedDeviceIds))],
    },
    audit: {
      conflicts,
      pendingApprovals: normalized.flatMap((entry) => entry.audit.pendingApprovals),
      integrity: normalized.every((entry) => entry.audit.integrity === "verified") ? "verified" : "review-required",
    },
  });
  return {
    ...effective,
    retention: {
      ...effective.retention,
      localDays: Number.isFinite(effective.retention.localDays) ? effective.retention.localDays : null,
    },
    effective: true,
  };
}

const ACTION_CHANNEL = Object.freeze({
  "model-call": "model",
  research: "research",
  "music-search": "music-search",
  export: "export",
  download: "export",
  share: "recipient",
  link: "link",
  "derived-result": "derived-result",
  sync: "sync",
  handoff: "handoff",
});

export function guardPearlPrivacyAction(policyInput, action, context = {}) {
  const policy = policyInput?.effective ? policyInput : effectivePearlPrivacyPolicy([policyInput]);
  const now = context.now || Date.now();
  if (policy.encryption.status !== "unlocked" && !["inspect-policy", "unlock", "delete"].includes(action)) {
    return { allowed: false, code: "PEARL_LOCKED", reason: "This Pearl is locked.", minimumPatch: null };
  }
  if (policy.retention.expiresAt && new Date(policy.retention.expiresAt).getTime() <= now) {
    return { allowed: false, code: "PEARL_EXPIRED", reason: "This Pearl's retention period expired.", minimumPatch: null };
  }
  if (policy.audit.conflicts.some((entry) => entry.blocking !== false)) {
    return { allowed: false, code: "PRIVACY_CONFLICT", reason: "Resolve the Pearl's privacy conflict before this action.", minimumPatch: null };
  }
  if (context.actorId && context.actorId !== policy.acl.ownerId) {
    const active = policy.acl.grants.filter((grant) =>
      !grant.revokedAt && (!grant.expiresAt || new Date(grant.expiresAt).getTime() > now) &&
      ((grant.subjectType === "user" && grant.subjectId === context.actorId) ||
       (grant.subjectType === "organization" && grant.subjectId === context.organizationId) ||
       (grant.subjectType === "group" && context.groupIds?.includes(grant.subjectId)) ||
       (grant.subjectType === "role" && context.roles?.includes(grant.subjectId)))
    );
    const requiredRight = context.requiredRight || (action === "research" ? "research" : ["share", "link"].includes(action) ? "share" : action === "export" || action === "download" ? "export" : "run");
    if (!active.some((grant) => grant.rights.includes(requiredRight) || grant.rights.includes("admin"))) {
      return { allowed: false, code: "PRIVACY_PERMISSION_DENIED", reason: `The current identity lacks ${requiredRight} permission.`, minimumPatch: null };
    }
  }
  if (["sync", "share", "link", "handoff"].includes(action) && policy.audience === "local-only") {
    return {
      allowed: false,
      code: "LOCAL_ONLY",
      reason: "This Pearl is local-only.",
      minimumPatch: { audience: action === "sync" ? "private-account" : "selected-people", disclosure: { [ACTION_CHANNEL[action]]: { allowed: true, requiresApproval: true } } },
    };
  }
  if (action === "organization-share") {
    if (!context.verifiedMembership || context.organizationId !== policy.acl.organizationId) {
      return { allowed: false, code: "ORGANIZATION_UNVERIFIED", reason: "Verified organization membership is required.", minimumPatch: null };
    }
    if (!policy.encryption.organizationEnvelopeId || policy.encryption.rotationState !== "current") {
      return { allowed: false, code: "ORGANIZATION_KEY_UNAVAILABLE", reason: "A current organization encryption envelope is required.", minimumPatch: null };
    }
  }
  const channel = ACTION_CHANNEL[action];
  if (channel && !policy.disclosure[channel].allowed) {
    return {
      allowed: false,
      code: "DISCLOSURE_DENIED",
      reason: `This Pearl does not permit ${channel} disclosure.`,
      minimumPatch: { disclosure: { [channel]: { allowed: true, requiresApproval: true, fields: context.fields || [] } } },
    };
  }
  if (channel && policy.disclosure[channel].providers.length && context.provider && !policy.disclosure[channel].providers.includes(context.provider)) {
    return { allowed: false, code: "PROVIDER_DENIED", reason: `${context.provider} is not an approved ${channel} provider.`, minimumPatch: null };
  }
  return { allowed: true, code: "ALLOWED", policyVersion: policy.version, approvalRequired: Boolean(channel && policy.disclosure[channel].requiresApproval) };
}

export function proposePearlPrivacyPatch(policyInput, patch, options = {}) {
  const current = createPearlPrivacyPolicy(policyInput);
  if (options.expectedVersion != null && current.version !== options.expectedVersion) throw new Error("PrivacyPolicy changed; review the newer policy");
  const merged = createPearlPrivacyPolicy({
    ...current,
    ...clone(patch),
    storage: { ...current.storage, ...clone(patch.storage || {}) },
    disclosure: { ...current.disclosure, ...clone(patch.disclosure || {}) },
    acl: { ...current.acl, ...clone(patch.acl || {}) },
    retention: { ...current.retention, ...clone(patch.retention || {}) },
    encryption: { ...current.encryption, ...clone(patch.encryption || {}) },
    provenance: { ...current.provenance, ...clone(patch.provenance || {}) },
    audit: { ...current.audit, ...clone(patch.audit || {}) },
    version: current.version + 1,
  });
  const relaxation = audienceRank.get(merged.audience) > audienceRank.get(current.audience) ||
    sensitivityRank.get(merged.sensitivity) < sensitivityRank.get(current.sensitivity) ||
    PRIVACY_DISCLOSURE_CHANNELS.some((channel) => !current.disclosure[channel].allowed && merged.disclosure[channel].allowed);
  return {
    id: id("privacy-patch"),
    pearlId: current.pearlId,
    baseVersion: current.version,
    status: "review",
    relaxation,
    requiresAdmin: relaxation && Boolean(current.acl.organizationId),
    diff: Object.keys(patch).map((key) => ({ path: key, before: clone(current[key]), after: clone(merged[key]) })),
    nextPolicy: merged,
    createdAt: Date.now(),
  };
}

export function applyPearlPrivacyPatch(policyInput, proposal, approval = {}) {
  const current = createPearlPrivacyPolicy(policyInput);
  if (proposal.status !== "review" || proposal.baseVersion !== current.version) throw new Error("PrivacyPolicy patch is stale");
  if (approval.confirmed !== true) throw new Error("explicit PrivacyPolicy diff confirmation is required");
  if (proposal.requiresAdmin && approval.adminVerified !== true) throw new Error("verified organization admin approval is required");
  return {
    policy: createPearlPrivacyPolicy({
      ...proposal.nextPolicy,
      provenance: { ...proposal.nextPolicy.provenance, updatedAt: Date.now(), overrides: [...(current.provenance.overrides || []), proposal.id] },
      audit: { ...proposal.nextPolicy.audit, lastEditAt: Date.now() },
    }),
    checkpoint: { type: "privacy-policy-edit", proposalId: proposal.id, previousPolicy: current, at: Date.now() },
    proposal: { ...proposal, status: "applied", approvedAt: Date.now() },
  };
}

export function mergePearlPrivacyPolicies(localInput, remoteInput) {
  const local = createPearlPrivacyPolicy(localInput);
  const remote = createPearlPrivacyPolicy(remoteInput);
  if (local.id !== remote.id || local.pearlId !== remote.pearlId) throw new Error("PrivacyPolicy merge identity mismatch");
  if (local.version === remote.version && JSON.stringify(local) === JSON.stringify(remote)) return { policy: local, conflict: null };
  const policy = effectivePearlPrivacyPolicy([local, remote], { pearlId: local.pearlId });
  const conflict = {
    code: "CONCURRENT_POLICY_EDIT",
    blocking: true,
    localVersion: local.version,
    remoteVersion: remote.version,
    restrictivePolicyApplied: true,
  };
  return {
    policy: createPearlPrivacyPolicy({
      ...policy,
      id: local.id,
      version: Math.max(local.version, remote.version) + 1,
      audit: { ...policy.audit, conflicts: [...policy.audit.conflicts, conflict] },
    }),
    conflict,
  };
}

export function inheritPrivacyForDerivedPearl(derived, sourcePolicies = [], organizationPolicy = null) {
  const effective = effectivePearlPrivacyPolicy([...sourcePolicies, organizationPolicy].filter(Boolean), { pearlId: derived.id });
  return {
    ...clone(derived),
    privacyPolicy: createPearlPrivacyPolicy({
      ...effective,
      id: id("privacy-policy"),
      pearlId: derived.id,
      version: 1,
      provenance: {
        source: "derived-most-restrictive",
        inheritedPolicyIds: effective.provenance.inheritedPolicyIds,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    }),
  };
}

export function pearlPrivacyObservation(policyInput, context = {}) {
  const policy = policyInput?.effective ? policyInput : effectivePearlPrivacyPolicy([policyInput]);
  const actorGuard = guardPearlPrivacyAction(policy, "inspect-policy", context);
  return {
    policyId: policy.id,
    version: policy.version,
    audience: policy.audience,
    sensitivity: policy.sensitivity,
    storageMode: policy.storage.mode,
    organizationId: context.organizationId && context.organizationId === policy.acl.organizationId ? policy.acl.organizationId : null,
    rights: context.actorId === policy.acl.ownerId ? PRIVACY_RIGHTS : policy.acl.grants.filter((grant) => grant.subjectId === context.actorId && !grant.revokedAt).flatMap((grant) => grant.rights),
    lockState: policy.encryption.status,
    keyRotationState: policy.encryption.rotationState,
    disclosures: Object.fromEntries(PRIVACY_DISCLOSURE_CHANNELS.map((channel) => [channel, policy.disclosure[channel].allowed])),
    conflicts: clone(policy.audit.conflicts),
    pendingApprovals: clone(policy.audit.pendingApprovals),
    integrity: policy.audit.integrity,
    authorized: actorGuard.allowed,
  };
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function base64url(bytes) {
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

export async function createPrivacyAuditReceipt(input, cryptoApi = globalThis.crypto) {
  const metadata = {
    version: PEARL_PRIVACY_POLICY_VERSION,
    id: input.id || id("privacy-audit"),
    pearlId: bounded(input.pearlId, 220),
    policyId: bounded(input.policyId, 220),
    policyVersion: Number(input.policyVersion) || 1,
    action: bounded(input.action, 120),
    actorRef: bounded(input.actorRef || "local-profile", 220),
    channel: input.channel ? bounded(input.channel, 120) : null,
    fieldNames: (input.fieldNames || []).slice(0, 100).map((entry) => bounded(entry, 220)),
    byteCount: Math.max(0, Number(input.byteCount) || 0),
    destinationRef: input.destinationRef ? bounded(input.destinationRef, 220) : null,
    decision: bounded(input.decision || "allowed", 80),
    at: input.at || Date.now(),
    previousHash: input.previousHash || null,
  };
  const digest = await cryptoApi.subtle.digest("SHA-256", new TextEncoder().encode(stableJson(metadata)));
  return { ...metadata, hash: `sha256-${base64url(new Uint8Array(digest))}` };
}

export async function verifyPrivacyAuditChain(receipts, cryptoApi = globalThis.crypto) {
  let previousHash = null;
  for (const receipt of receipts || []) {
    if (receipt.previousHash !== previousHash) return { valid: false, reason: "privacy audit chain link mismatch" };
    const { hash, ...metadata } = receipt;
    const expected = await createPrivacyAuditReceipt(metadata, cryptoApi);
    if (expected.hash !== hash) return { valid: false, reason: "privacy audit receipt was tampered" };
    previousHash = hash;
  }
  return { valid: true, head: previousHash };
}

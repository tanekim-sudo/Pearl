import {
  validateCognitivePackageManifest,
  verifyCognitivePackage,
} from "../shared/cognitive-package.js";
import { getAdminClient } from "./supabase-auth.js";

function statusError(status, message, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

async function publicKeyFor(manifest, cryptoApi = globalThis.crypto) {
  const jwk = manifest.author?.publicKey;
  if (!jwk) throw statusError(400, "Package author public key is required.", "PACKAGE_KEY_REQUIRED");
  try {
    return await cryptoApi.subtle.importKey("jwk", jwk, { name: "Ed25519" }, true, ["verify"]);
  } catch {
    throw statusError(400, "Package author public key is invalid.", "PACKAGE_KEY_INVALID");
  }
}

function packageKey(manifest) {
  return `${manifest.namespace}/${manifest.name}@${manifest.version}`;
}

function visibleTo(record, userId) {
  return record.manifest.visibility === "public" ||
    record.manifest.visibility === "unlisted" ||
    record.ownerId === userId ||
    (record.manifest.visibility === "team" && record.teamId && record.teamId === record.requestTeamId);
}

export function createCognitivePackageRegistry({
  revokedKeyIds = [],
  now = () => new Date().toISOString(),
  database = null,
  maxLocalPackages = 200,
} = {}) {
  const memory = new Map();
  const load = async (key) => {
    if (!database) return memory.get(key) || null;
    const { data, error } = await database.from("cognitive_packages").select("*").eq("id", key).maybeSingle();
    if (error) throw statusError(503, "Package persistence lookup failed.", "PACKAGE_PERSISTENCE_FAILED");
    return data ? {
      manifest: data.manifest,
      ownerId: data.owner_id,
      teamId: data.team_id,
      receipt: data.publish_receipt,
      deprecatedAt: data.deprecated_at,
      replacement: data.replacement,
    } : null;
  };
  const save = async (key, record) => {
    if (!database) {
      memory.set(key, record);
      while (memory.size > maxLocalPackages) memory.delete(memory.keys().next().value);
      return;
    }
    const manifest = record.manifest;
    const { error } = await database.from("cognitive_packages").insert({
      id: key,
      owner_id: record.ownerId,
      team_id: record.teamId,
      namespace: manifest.namespace,
      name: manifest.name,
      version: manifest.version,
      visibility: manifest.visibility,
      content_hash: manifest.contentHash,
      manifest,
      publish_receipt: record.receipt,
    });
    if (error) throw statusError(503, "Package persistence write failed.", "PACKAGE_PERSISTENCE_FAILED");
  };
  const rows = async () => {
    if (!database) return [...memory.values()];
    const { data, error } = await database.from("cognitive_packages").select("*").order("created_at", { ascending: false }).limit(500);
    if (error) throw statusError(503, "Package registry query failed.", "PACKAGE_PERSISTENCE_FAILED");
    return (data || []).map((entry) => ({
      manifest: entry.manifest,
      ownerId: entry.owner_id,
      teamId: entry.team_id,
      receipt: entry.publish_receipt,
      deprecatedAt: entry.deprecated_at,
      replacement: entry.replacement,
    }));
  };
  const saveKey = async (manifest, userId, teamId) => {
    if (!database) return;
    const keyId = manifest.signature.keyId;
    const { data: existing, error: readError } = await database
      .from("cognitive_package_keys")
      .select("owner_id,status,public_jwk")
      .eq("id", keyId)
      .maybeSingle();
    if (readError) throw statusError(503, "Signing key lookup failed.", "PACKAGE_KEY_LOOKUP_FAILED");
    if (existing?.status === "revoked") throw statusError(403, "Package signing key is revoked.", "PACKAGE_KEY_REVOKED");
    if (existing && existing.owner_id !== userId) throw statusError(409, "Package signing key belongs to another identity.", "PACKAGE_KEY_CONFLICT");
    if (existing && JSON.stringify(existing.public_jwk) !== JSON.stringify(manifest.author.publicKey)) {
      throw statusError(409, "Package signing key material changed unexpectedly.", "PACKAGE_KEY_CONFLICT");
    }
    if (!existing) {
      const { error } = await database.from("cognitive_package_keys").insert({
        id: keyId,
        owner_id: userId,
        team_id: teamId,
        public_jwk: manifest.author.publicKey,
        status: "active",
      });
      if (error) throw statusError(503, "Signing key persistence failed.", "PACKAGE_KEY_PERSISTENCE_FAILED");
    }
  };
  return {
    async publish(manifest, { userId, teamId = null, approved, idempotencyKey, cryptoApi = globalThis.crypto } = {}) {
      if (!userId) throw statusError(401, "Sign in is required to publish a package.", "PACKAGE_AUTH_REQUIRED");
      if (!approved) throw statusError(409, "Scoped publish preview approval is required.", "PACKAGE_APPROVAL_REQUIRED");
      if (!idempotencyKey) throw statusError(400, "Publish idempotency key is required.", "PACKAGE_IDEMPOTENCY_REQUIRED");
      validateCognitivePackageManifest(manifest, { requireSignature: true });
      await verifyCognitivePackage(manifest, {
        publicKey: await publicKeyFor(manifest, cryptoApi),
        revokedKeyIds,
        cryptoApi,
      });
      await saveKey(manifest, userId, teamId);
      const key = packageKey(manifest);
      const existing = await load(key);
      if (existing) {
        if (existing.manifest.contentHash !== manifest.contentHash) {
          throw statusError(409, "Published package versions are immutable.", "PACKAGE_VERSION_IMMUTABLE");
        }
        return existing.receipt;
      }
      const receipt = {
        type: "package-publish-receipt",
        id: idempotencyKey,
        package: key,
        contentHash: manifest.contentHash,
        visibility: manifest.visibility,
        publishedAt: now(),
      };
      await save(key, {
        manifest: { ...manifest, publishedAt: manifest.publishedAt || receipt.publishedAt },
        ownerId: userId,
        teamId,
        receipt,
        deprecatedAt: null,
      });
      return receipt;
    },

    async list({ userId = null, query = "", cursor = 0, limit = 20, teamId = null } = {}) {
      const start = Math.max(0, Number(cursor) || 0);
      const bounded = Math.min(50, Math.max(1, Number(limit) || 20));
      const normalized = String(query).toLowerCase().trim();
      const visibleRows = (await rows())
        .map((record) => ({ ...record, requestTeamId: teamId }))
        .filter((record) => visibleTo(record, userId))
        .filter((record) => !normalized || `${record.manifest.namespace}/${record.manifest.name}`.toLowerCase().includes(normalized))
        .sort((left, right) => right.receipt.publishedAt.localeCompare(left.receipt.publishedAt));
      return {
        packages: visibleRows.slice(start, start + bounded).map((record) => ({
          ...record.manifest,
          deprecatedAt: record.deprecatedAt,
          trust: {
            signature: "verified",
            keyId: record.manifest.signature.keyId,
            tests: record.manifest.tests,
            permissions: record.manifest.permissions,
            dependencies: record.manifest.dependencies,
          },
        })),
        nextCursor: start + bounded < visibleRows.length ? start + bounded : null,
      };
    },

    async deprecate({ namespace, name, version, replacement = null }, { userId, approved, idempotencyKey } = {}) {
      if (!approved || !idempotencyKey) throw statusError(409, "Scoped deprecation approval and receipt key are required.", "PACKAGE_APPROVAL_REQUIRED");
      const key = `${namespace}/${name}@${version}`;
      const record = await load(key);
      if (!record) throw statusError(404, "Package version was not found.", "PACKAGE_NOT_FOUND");
      if (record.ownerId !== userId) throw statusError(403, "Only the package owner can deprecate this version.", "PACKAGE_FORBIDDEN");
      record.deprecatedAt ||= now();
      record.replacement ||= replacement;
      if (database) {
        const { error } = await database.from("cognitive_packages").update({
          deprecated_at: record.deprecatedAt,
          replacement: record.replacement,
        }).eq("id", key).eq("owner_id", userId);
        if (error) throw statusError(503, "Package deprecation persistence failed.", "PACKAGE_PERSISTENCE_FAILED");
      }
      return { type: "package-deprecation-receipt", id: idempotencyKey, package: key, deprecatedAt: record.deprecatedAt, replacement };
    },

    resetForTests() {
      memory.clear();
    },
  };
}

export const cognitivePackageRegistry = createCognitivePackageRegistry({ database: getAdminClient() });

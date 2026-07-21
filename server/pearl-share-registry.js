import { randomBytes } from "node:crypto";
import { validatePearlPackage } from "../shared/pearl-sharing.js";

function statusError(status, message, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function opaqueId() {
  return randomBytes(24).toString("base64url");
}

async function publicKeyFor(pkg, cryptoApi = globalThis.crypto) {
  const jwk = pkg?.manifest?.author?.publicKey;
  if (!jwk) throw statusError(400, "Pearl package author public key is required.", "PEARL_SHARE_KEY_REQUIRED");
  try {
    return await cryptoApi.subtle.importKey("jwk", jwk, { name: "Ed25519" }, true, ["verify"]);
  } catch {
    throw statusError(400, "Pearl package author public key is invalid.", "PEARL_SHARE_KEY_INVALID");
  }
}

export function createPearlShareRegistry({ database = null, now = () => Date.now(), maxMemoryShares = 500 } = {}) {
  const memory = new Map();
  const mutations = new Map();
  const load = async (id) => {
    if (!database) return memory.get(id) || null;
    const { data, error } = await database.from("pearl_shares").select("*").eq("id", id).maybeSingle();
    if (error) throw statusError(503, "Pearl share lookup failed.", "PEARL_SHARE_PERSISTENCE_FAILED");
    return data ? {
      id: data.id,
      package: data.package,
      ownerId: data.owner_id,
      recipientId: data.recipient_id,
      teamId: data.team_id,
      mode: data.mode,
      permissions: data.permissions,
      oneTime: data.one_time,
      uses: data.uses,
      maxUses: data.max_uses,
      expiresAt: new Date(data.expires_at).getTime(),
      revokedAt: data.revoked_at ? new Date(data.revoked_at).getTime() : null,
      createdAt: new Date(data.created_at).getTime(),
      idempotencyKey: data.idempotency_key,
    } : null;
  };
  const save = async (record) => {
    if (!database) {
      memory.set(record.id, record);
      while (memory.size > maxMemoryShares) memory.delete(memory.keys().next().value);
      return;
    }
    const row = {
      id: record.id,
      package: record.package,
      owner_id: record.ownerId,
      recipient_id: record.recipientId,
      team_id: record.teamId,
      mode: record.mode,
      permissions: record.permissions,
      one_time: record.oneTime,
      uses: record.uses,
      max_uses: record.maxUses,
      expires_at: new Date(record.expiresAt).toISOString(),
      revoked_at: record.revokedAt ? new Date(record.revokedAt).toISOString() : null,
      idempotency_key: record.idempotencyKey,
    };
    const { error } = await database.from("pearl_shares").upsert(row, { onConflict: "id" });
    if (error) throw statusError(503, "Pearl share persistence failed.", "PEARL_SHARE_PERSISTENCE_FAILED");
  };
  const mutate = (id, callback) => {
    const prior = mutations.get(id) || Promise.resolve();
    const next = prior.then(async () => callback(await load(id)));
    mutations.set(id, next.catch(() => {}));
    return next;
  };
  const authorize = (record, claims = {}) => {
    if (record.revokedAt) throw statusError(410, "Pearl share was revoked.", "PEARL_SHARE_REVOKED");
    if (record.expiresAt <= now()) throw statusError(410, "Pearl share expired.", "PEARL_SHARE_EXPIRED");
    if (record.recipientId && claims.userId !== record.recipientId) throw statusError(403, "Pearl share recipient is unauthorized.", "PEARL_SHARE_FORBIDDEN");
    if (record.teamId && !claims.teamIds?.includes(record.teamId)) throw statusError(403, "Pearl team grant is unauthorized.", "PEARL_SHARE_FORBIDDEN");
    if (record.uses >= record.maxUses) throw statusError(410, "Pearl share has already been consumed.", "PEARL_SHARE_CONSUMED");
  };
  return {
    async create(pkg, options = {}) {
      if (!options.ownerId) throw statusError(401, "Sign in is required to create a hosted Pearl share.", "PEARL_SHARE_AUTH_REQUIRED");
      if (options.approved !== true) throw statusError(409, "Exact Pearl share scope approval is required.", "PEARL_SHARE_APPROVAL_REQUIRED");
      if (!options.idempotencyKey) throw statusError(400, "Pearl share idempotency key is required.", "PEARL_SHARE_IDEMPOTENCY_REQUIRED");
      const publicKey = await publicKeyFor(pkg, options.cryptoApi);
      await validatePearlPackage(pkg, { publicKey, cryptoApi: options.cryptoApi });
      const existing = [...memory.values()].find((entry) => entry.ownerId === options.ownerId && entry.idempotencyKey === options.idempotencyKey);
      if (existing) return { id: existing.id, expiresAt: existing.expiresAt, mode: existing.mode, packageHash: existing.package.manifest.contentHash };
      const mode = options.mode || pkg.share?.mode;
      if (!["private-once", "unlisted", "public", "team", "reference", "clone"].includes(mode)) throw statusError(400, "Hosted Pearl share mode is invalid.", "PEARL_SHARE_MODE_INVALID");
      if (mode === "team" && !options.teamId) throw statusError(400, "Named team is required.", "PEARL_SHARE_TEAM_REQUIRED");
      if (mode === "team" && !["owner", "publisher"].includes(options.organizationRole)) {
        throw statusError(403, "Verified organization publisher membership is required.", "PEARL_SHARE_ORGANIZATION_FORBIDDEN");
      }
      const createdAt = now();
      const record = {
        id: opaqueId(),
        package: pkg,
        ownerId: options.ownerId,
        recipientId: options.recipientId || null,
        teamId: options.teamId || null,
        mode,
        permissions: options.permissions || ["inspect", "install", "fork"],
        oneTime: mode === "private-once",
        uses: 0,
        maxUses: mode === "private-once" ? 1 : Math.min(100_000, Math.max(1, Number(options.maxUses) || 10_000)),
        expiresAt: Math.min(createdAt + 365 * 86_400_000, Number(options.expiresAt) || createdAt + (mode === "private-once" ? 10 * 60_000 : 30 * 86_400_000)),
        revokedAt: null,
        createdAt,
        idempotencyKey: options.idempotencyKey,
      };
      await save(record);
      return { id: record.id, expiresAt: record.expiresAt, mode, packageHash: pkg.manifest.contentHash };
    },

    async inspect(id, claims = {}) {
      const record = await load(id);
      if (!record) throw statusError(404, "Pearl share was not found.", "PEARL_SHARE_NOT_FOUND");
      authorize(record, claims);
      return {
        id: record.id,
        mode: record.mode,
        permissions: record.permissions,
        expiresAt: record.expiresAt,
        sender: record.package.manifest.author,
        manifest: record.package.manifest,
        publicMetadata: record.package.publicMetadata,
      };
    },

    consume(id, claims = {}) {
      if (database) {
        return (async () => {
          const { data, error } = await database.rpc("consume_pearl_share", {
            p_id: id,
            p_user_id: claims.userId || null,
            p_team_ids: claims.teamIds || [],
          });
          if (error || !data) throw statusError(410, "Pearl share is unavailable, unauthorized, expired, revoked, or consumed.", "PEARL_SHARE_UNAVAILABLE");
          const row = Array.isArray(data) ? data[0] : data;
          return {
            package: row.package,
            receipt: {
              type: "pearl-share-receipt",
              shareId: row.id,
              packageHash: row.package.manifest.contentHash,
              recipientId: claims.userId || "accountless-local",
              at: now(),
            },
          };
        })();
      }
      return mutate(id, async (record) => {
        if (!record) throw statusError(404, "Pearl share was not found.", "PEARL_SHARE_NOT_FOUND");
        authorize(record, claims);
        const next = { ...record, uses: record.uses + 1, consumedAt: now() };
        await save(next);
        return {
          package: next.package,
          receipt: {
            type: "pearl-share-receipt",
            shareId: next.id,
            packageHash: next.package.manifest.contentHash,
            recipientId: claims.userId || "accountless-local",
            at: next.consumedAt,
          },
        };
      });
    },

    revoke(id, ownerId) {
      return mutate(id, async (record) => {
        if (!record) throw statusError(404, "Pearl share was not found.", "PEARL_SHARE_NOT_FOUND");
        if (record.ownerId !== ownerId) throw statusError(403, "Only the Pearl owner can revoke this share.", "PEARL_SHARE_FORBIDDEN");
        const next = { ...record, revokedAt: record.revokedAt || now() };
        await save(next);
        return { type: "pearl-share-revocation", shareId: id, revokedAt: next.revokedAt };
      });
    },

    resetForTests() {
      memory.clear();
      mutations.clear();
    },
  };
}

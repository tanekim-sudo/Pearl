export const ORGANIZATION_ENVELOPE_VERSION = 1;
export const ORGANIZATION_ENVELOPE_ALGORITHM = "AES-GCM";
export const ORGANIZATION_KEY_WRAP_ALGORITHM = "RSA-OAEP";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(value) {
  let binary = "";
  const bytes = new Uint8Array(value);
  for (let offset = 0; offset < bytes.length; offset += 32_768) binary += String.fromCharCode(...bytes.subarray(offset, offset + 32_768));
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(String(value));
  return Uint8Array.from(binary, (entry) => entry.charCodeAt(0));
}

function aad(record) {
  return encoder.encode([
    "pearl-organization-envelope",
    record.version,
    record.organizationId,
    record.organizationKeyVersion,
    record.packageHash,
    record.policyHash,
  ].join(":"));
}

export async function generateOrganizationKeyPair(cryptoApi = globalThis.crypto) {
  return cryptoApi.subtle.generateKey(
    { name: ORGANIZATION_KEY_WRAP_ALGORITHM, modulusLength: 3072, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    false,
    ["wrapKey", "unwrapKey"],
  );
}

export async function exportOrganizationPublicKey(publicKey, cryptoApi = globalThis.crypto) {
  if (publicKey.type !== "public") throw new Error("organization public key is required");
  return cryptoApi.subtle.exportKey("jwk", publicKey);
}

export async function importOrganizationPublicKey(jwk, cryptoApi = globalThis.crypto) {
  return cryptoApi.subtle.importKey("jwk", jwk, { name: ORGANIZATION_KEY_WRAP_ALGORITHM, hash: "SHA-256" }, true, ["wrapKey"]);
}

export async function createOrganizationEnvelope(payload, options, cryptoApi = globalThis.crypto) {
  if (!options?.organizationId || !options.organizationKeyVersion || !options.publicKey) throw new Error("verified organization key binding is required");
  if (!options.packageHash || !options.policyHash) throw new Error("package and PrivacyPolicy integrity hashes are required");
  const serialized = encoder.encode(JSON.stringify(payload));
  if (serialized.byteLength > 8 * 1024 * 1024) throw new Error("organization Pearl payload exceeds 8 MB");
  const dataKey = await cryptoApi.subtle.generateKey({ name: ORGANIZATION_ENVELOPE_ALGORITHM, length: 256 }, true, ["encrypt", "decrypt"]);
  const iv = cryptoApi.getRandomValues(new Uint8Array(12));
  const header = {
    version: ORGANIZATION_ENVELOPE_VERSION,
    type: "pearl-organization-envelope",
    organizationId: String(options.organizationId),
    organizationKeyVersion: Number(options.organizationKeyVersion),
    packageHash: String(options.packageHash),
    policyHash: String(options.policyHash),
    algorithm: ORGANIZATION_ENVELOPE_ALGORITHM,
    keyWrapAlgorithm: ORGANIZATION_KEY_WRAP_ALGORITHM,
    iv: bytesToBase64(iv),
    createdAt: Date.now(),
  };
  const ciphertext = await cryptoApi.subtle.encrypt({ name: ORGANIZATION_ENVELOPE_ALGORITHM, iv, additionalData: aad(header), tagLength: 128 }, dataKey, serialized);
  const wrappedKey = await cryptoApi.subtle.wrapKey("raw", dataKey, options.publicKey, { name: ORGANIZATION_KEY_WRAP_ALGORITHM });
  return {
    ...header,
    ciphertext: bytesToBase64(ciphertext),
    wrappedKey: bytesToBase64(wrappedKey),
  };
}

export async function openOrganizationEnvelope(record, options, cryptoApi = globalThis.crypto) {
  if (record?.version !== ORGANIZATION_ENVELOPE_VERSION || record?.type !== "pearl-organization-envelope") throw new Error("organization Pearl envelope version is unsupported");
  if (record.organizationId !== options.organizationId) throw new Error("organization envelope tenant mismatch");
  if (record.organizationKeyVersion !== options.organizationKeyVersion) throw new Error("organization envelope key version mismatch");
  if (options.revokedKeyVersions?.includes(record.organizationKeyVersion)) throw new Error("organization envelope key is revoked");
  if (!options.privateKey || options.privateKey.type !== "private" || options.privateKey.extractable) throw new Error("non-extractable organization private key is required");
  try {
    const dataKey = await cryptoApi.subtle.unwrapKey(
      "raw",
      base64ToBytes(record.wrappedKey),
      options.privateKey,
      { name: ORGANIZATION_KEY_WRAP_ALGORITHM },
      { name: ORGANIZATION_ENVELOPE_ALGORITHM, length: 256 },
      false,
      ["decrypt"],
    );
    const plaintext = await cryptoApi.subtle.decrypt({
      name: ORGANIZATION_ENVELOPE_ALGORITHM,
      iv: base64ToBytes(record.iv),
      additionalData: aad(record),
      tagLength: 128,
    }, dataKey, base64ToBytes(record.ciphertext));
    return JSON.parse(decoder.decode(plaintext));
  } catch {
    throw new Error("organization Pearl envelope integrity verification failed");
  }
}

export async function rotateOrganizationEnvelope(record, options, cryptoApi = globalThis.crypto) {
  const payload = await openOrganizationEnvelope(record, {
    organizationId: record.organizationId,
    organizationKeyVersion: record.organizationKeyVersion,
    privateKey: options.previousPrivateKey,
    revokedKeyVersions: options.revokedKeyVersions || [],
  }, cryptoApi);
  return createOrganizationEnvelope(payload, {
    organizationId: record.organizationId,
    organizationKeyVersion: options.nextKeyVersion,
    publicKey: options.nextPublicKey,
    packageHash: record.packageHash,
    policyHash: record.policyHash,
  }, cryptoApi);
}

export function organizationEnvelopeRoutingMetadata(record) {
  if (record?.type !== "pearl-organization-envelope") throw new Error("organization envelope is required");
  return {
    version: record.version,
    organizationId: record.organizationId,
    organizationKeyVersion: record.organizationKeyVersion,
    packageHash: record.packageHash,
    policyHash: record.policyHash,
    createdAt: record.createdAt,
  };
}

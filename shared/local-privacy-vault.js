export const LOCAL_PRIVACY_ENVELOPE_VERSION = 1;
export const ANONYMOUS_PROFILE_ID = "anonymous";
export const LOCAL_PRIVACY_ALGORITHM = "AES-GCM";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes) {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value);
}

function base64ToBytes(value) {
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(value, "base64"));
  const decoded = atob(value);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (!value || typeof value !== "object") return JSON.stringify(value);
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
}

export async function privacyProfileHash(profileId, cryptoApi = globalThis.crypto) {
  const normalized = String(profileId || ANONYMOUS_PROFILE_ID).trim() || ANONYMOUS_PROFILE_ID;
  const digest = await cryptoApi.subtle.digest("SHA-256", encoder.encode(`pearl-profile:${normalized}`));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

export async function createLocalPrivacyEnvelope(value, options) {
  const cryptoApi = options.crypto || globalThis.crypto;
  const profileHash = options.profileHash;
  const key = options.key;
  if (!cryptoApi?.subtle || !key || !profileHash) throw new Error("local privacy encryption unavailable");
  const iv = cryptoApi.getRandomValues(new Uint8Array(12));
  const additionalData = encoder.encode(`pearl-local:${LOCAL_PRIVACY_ENVELOPE_VERSION}:${profileHash}`);
  const plaintext = encoder.encode(stableJson(value));
  const ciphertext = await cryptoApi.subtle.encrypt(
    { name: LOCAL_PRIVACY_ALGORITHM, iv, additionalData, tagLength: 128 },
    key,
    plaintext,
  );
  return {
    version: LOCAL_PRIVACY_ENVELOPE_VERSION,
    algorithm: LOCAL_PRIVACY_ALGORITHM,
    profileHash,
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    updatedAt: new Date().toISOString(),
  };
}

export async function openLocalPrivacyEnvelope(envelope, options) {
  const cryptoApi = options.crypto || globalThis.crypto;
  if (
    !envelope
    || envelope.version !== LOCAL_PRIVACY_ENVELOPE_VERSION
    || envelope.algorithm !== LOCAL_PRIVACY_ALGORITHM
    || envelope.profileHash !== options.profileHash
  ) {
    throw new Error("local privacy envelope mismatch");
  }
  try {
    const additionalData = encoder.encode(`pearl-local:${envelope.version}:${envelope.profileHash}`);
    const plaintext = await cryptoApi.subtle.decrypt(
      {
        name: LOCAL_PRIVACY_ALGORITHM,
        iv: base64ToBytes(envelope.iv),
        additionalData,
        tagLength: 128,
      },
      options.key,
      base64ToBytes(envelope.ciphertext),
    );
    return JSON.parse(decoder.decode(plaintext));
  } catch {
    throw new Error("local privacy data is locked or corrupted");
  }
}

export async function generateLocalPrivacyKey(cryptoApi = globalThis.crypto) {
  return cryptoApi.subtle.generateKey(
    { name: LOCAL_PRIVACY_ALGORITHM, length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export function createLocalPrivacyVault({
  profileId = ANONYMOUS_PROFILE_ID,
  keyStore,
  envelopeStore,
  crypto: cryptoApi = globalThis.crypto,
}) {
  if (!keyStore || !envelopeStore) throw new Error("privacy vault stores are required");
  let profileHash;
  let key;
  let readyPromise;

  async function ready() {
    readyPromise ||= (async () => {
      profileHash ||= await privacyProfileHash(profileId, cryptoApi);
      key ||= await keyStore.get(profileHash);
      if (!key) {
        key = await generateLocalPrivacyKey(cryptoApi);
        await keyStore.set(profileHash, key);
      }
      return { profileHash, key };
    })();
    try {
      return await readyPromise;
    } catch (error) {
      readyPromise = null;
      throw error;
    }
  }

  async function read() {
    const current = await ready();
    const envelope = await envelopeStore.get(current.profileHash);
    if (!envelope) return {};
    const value = await openLocalPrivacyEnvelope(envelope, { ...current, crypto: cryptoApi });
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  async function write(value) {
    const current = await ready();
    const envelope = await createLocalPrivacyEnvelope(value, { ...current, crypto: cryptoApi });
    await envelopeStore.set(current.profileHash, envelope);
    return envelope;
  }

  async function migrate(entries, removePlaintext) {
    const existing = await read();
    const merged = { ...entries, ...existing };
    const envelope = await write(merged);
    const verified = await read();
    if (stableJson(verified) !== stableJson(merged)) throw new Error("local privacy migration verification failed");
    await removePlaintext?.(Object.keys(entries));
    return { migrated: Object.keys(entries).length, envelope };
  }

  async function clear() {
    const current = await ready();
    await envelopeStore.remove(current.profileHash);
    return {
      type: "local-privacy-deletion",
      profileHash: current.profileHash,
      at: new Date().toISOString(),
      deleted: true,
    };
  }

  return { ready, read, write, migrate, clear };
}

export function redactPrivacyDiagnostic(error) {
  const message = String(error?.message || error || "")
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+/gi, "Bearer [redacted]")
    .replace(/(?:access|refresh|auth)[_-]?token\s*[:=]\s*[^\s,;]+/gi, "token=[redacted]")
    .replace(/https?:\/\/\S+/gi, "[url redacted]")
    .replace(/["']?(?:prompt|context|quote|rawInput|metadata)["']?\s*:\s*["'][^"']*["']/gi, "\"sensitive\":\"[redacted]\"");
  return {
    name: String(error?.name || "Error").slice(0, 80),
    code: String(error?.code || "LOCAL_PRIVACY_ERROR").slice(0, 80),
    message: /locked|corrupt|mismatch/i.test(message)
      ? "Local Pearl data could not be opened with this profile."
      : "The local privacy operation could not be completed.",
  };
}

export async function createDisclosureReceipt(input, cryptoApi = globalThis.crypto) {
  const fragmentIds = Array.isArray(input.fragmentIds) ? input.fragmentIds.map(String).sort() : [];
  const digest = await cryptoApi.subtle.digest(
    "SHA-256",
    encoder.encode(stableJson({
      action: String(input.action || "model-action"),
      fragmentIds,
      disclosedCharacters: Math.max(0, Number(input.disclosedCharacters) || 0),
      destination: String(input.destination || "configured-model"),
      at: String(input.at || ""),
    })),
  );
  return {
    version: 1,
    type: "bounded-disclosure",
    id: input.id || cryptoApi.randomUUID(),
    action: String(input.action || "model-action"),
    fragmentCount: fragmentIds.length,
    disclosedCharacters: Math.max(0, Number(input.disclosedCharacters) || 0),
    destination: String(input.destination || "configured-model"),
    digest: bytesToBase64(new Uint8Array(digest)),
    at: input.at || new Date().toISOString(),
  };
}

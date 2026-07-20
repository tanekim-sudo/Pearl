import { BrowserPlatform } from "../platform/browser-platform.js";
import { validatePearlImageSignature } from "../../../shared/profile-blob-security.js";

const DATABASE = "pearl-local-blobs-v1";
const MAX_IMAGE_BYTES = 5_000_000;
const MAX_PROFILE_BLOB_BYTES = 10_000_000;

function requestValue(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("local blob storage failed"));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error("local blob transaction failed"));
    transaction.onabort = () => reject(transaction.error || new Error("local blob transaction aborted"));
  });
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("blobs");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("local blob storage unavailable"));
  });
}

async function sha256(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function storeProfileImage(input) {
  const bytes = input.bytes instanceof ArrayBuffer ? input.bytes : new Uint8Array(input.bytes || []).buffer;
  const mime = validatePearlImageSignature(bytes, input.mime);
  if (!bytes.byteLength || bytes.byteLength > MAX_IMAGE_BYTES) throw new Error("local canvas image exceeds its quota");
  const hash = await sha256(bytes);
  const profile = await BrowserPlatform.storage.profileHash();
  const key = `${profile}:${hash}`;
  const database = await openDatabase();
  const existing = await requestValue(database.transaction("blobs").objectStore("blobs").get(key));
  if (!existing) {
    const records = await requestValue(database.transaction("blobs").objectStore("blobs").getAll());
    const usage = records.filter((entry) => entry.profile === profile).reduce((sum, entry) => sum + (entry.byteLength || 0), 0);
    if (usage + bytes.byteLength > MAX_PROFILE_BLOB_BYTES) throw new Error("local canvas image quota is full");
    await requestValue(database.transaction("blobs", "readwrite").objectStore("blobs").put({
      version: 1,
      profile,
      hash,
      mime,
      byteLength: bytes.byteLength,
      bytes: new Blob([bytes], { type: mime }),
      createdAt: Date.now(),
    }, key));
  }
  return { blobRef: `pearl-blob:${hash}`, hash, byteLength: bytes.byteLength, duplicate: Boolean(existing) };
}

export async function readProfileImage(blobRef) {
  const hash = String(blobRef || "").replace(/^pearl-blob:/, "");
  if (!/^[a-f0-9]{64}$/i.test(hash)) throw new Error("invalid local canvas blob reference");
  const profile = await BrowserPlatform.storage.profileHash();
  const database = await openDatabase();
  const record = await requestValue(database.transaction("blobs").objectStore("blobs").get(`${profile}:${hash}`));
  if (!record?.bytes || record.profile !== profile) throw new Error("local canvas image is missing");
  const bytes = await record.bytes.arrayBuffer();
  if (await sha256(bytes) !== hash) throw new Error("local canvas image failed its integrity check");
  return { bytes, mime: record.mime, byteLength: record.byteLength };
}

export async function deleteProfileImage(blobRef) {
  const hash = String(blobRef || "").replace(/^pearl-blob:/, "");
  if (!/^[a-f0-9]{64}$/i.test(hash)) throw new Error("invalid local canvas blob reference");
  const profile = await BrowserPlatform.storage.profileHash();
  const database = await openDatabase();
  await requestValue(database.transaction("blobs", "readwrite").objectStore("blobs").delete(`${profile}:${hash}`));
  return { deleted: true };
}

export async function deleteProfileImages(profile) {
  const database = await openDatabase();
  const keys = await requestValue(database.transaction("blobs").objectStore("blobs").getAllKeys());
  const transaction = database.transaction("blobs", "readwrite");
  const store = transaction.objectStore("blobs");
  for (const key of keys) if (String(key).startsWith(`${profile}:`)) store.delete(key);
  await transactionDone(transaction);
  return keys.filter((key) => String(key).startsWith(`${profile}:`)).length;
}

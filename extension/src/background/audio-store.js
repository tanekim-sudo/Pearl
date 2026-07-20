import { PEARL_AUDIO_MAX_BYTES, validatePearlAudioSignature } from "../../../shared/pearl-soundscape.js";
import { BrowserPlatform } from "../platform/browser-platform.js";

const DATABASE = "pearl-local-audio-v1";

function requestValue(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("local audio storage failed"));
  });
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("audio")) database.createObjectStore("audio");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("local audio storage unavailable"));
  });
}

async function profileId() {
  const stored = await BrowserPlatform.storage.get("local", ["pearlActiveProfile"]);
  return stored.pearlActiveProfile || "anonymous";
}

async function sha256(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function storePearlAudio(input) {
  const bytes = input.bytes instanceof ArrayBuffer ? input.bytes : new Uint8Array(input.bytes || []).buffer;
  validatePearlAudioSignature(bytes, input.mime);
  const estimate = await navigator.storage?.estimate?.().catch(() => null);
  if (estimate?.quota && estimate.usage + bytes.byteLength > estimate.quota) {
    throw new Error("local audio quota is full");
  }
  if (bytes.byteLength > PEARL_AUDIO_MAX_BYTES) throw new Error("local audio exceeds the 100 MB limit");
  const hash = await sha256(bytes);
  if (input.expectedHash && input.expectedHash !== hash) throw new Error("downloaded audio failed its integrity check");
  const profile = await profileId();
  const key = `${profile}:${hash}`;
  const database = await openDatabase();
  const existing = await requestValue(database.transaction("audio").objectStore("audio").get(key));
  if (!existing) {
    await requestValue(database.transaction("audio", "readwrite").objectStore("audio").put({
      version: 1,
      profile,
      contentHash: hash,
      mime: input.mime,
      bytes: new Blob([bytes], { type: input.mime }),
      byteLength: bytes.byteLength,
      createdAt: Date.now(),
    }, key));
  }
  return {
    localBlobRef: key,
    contentHash: hash,
    byteLength: bytes.byteLength,
    mime: input.mime,
    duplicate: Boolean(existing),
    quota: estimate ? { usage: estimate.usage || 0, quota: estimate.quota || 0 } : null,
  };
}

export async function readPearlAudio(localBlobRef) {
  const profile = await profileId();
  if (!String(localBlobRef || "").startsWith(`${profile}:`)) throw new Error("local audio belongs to another profile");
  const database = await openDatabase();
  const record = await requestValue(database.transaction("audio").objectStore("audio").get(localBlobRef));
  if (!record?.bytes || record.profile !== profile) throw new Error("local audio is missing");
  const bytes = await record.bytes.arrayBuffer();
  const hash = await sha256(bytes);
  if (hash !== record.contentHash) throw new Error("local audio failed its integrity check");
  return { ...record, bytes };
}

export async function deletePearlAudio(localBlobRef) {
  const profile = await profileId();
  if (!String(localBlobRef || "").startsWith(`${profile}:`)) throw new Error("local audio belongs to another profile");
  const database = await openDatabase();
  await requestValue(database.transaction("audio", "readwrite").objectStore("audio").delete(localBlobRef));
  return { deleted: true, localBlobRef, at: new Date().toISOString() };
}

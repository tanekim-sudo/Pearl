import {
  ANONYMOUS_PROFILE_ID,
  createLocalPrivacyVault,
  privacyProfileHash,
  redactPrivacyDiagnostic,
} from "../../shared/local-privacy-vault.js";

const DB_NAME = "pearl-local-private-v1";
const ACTIVE_PROFILE_KEY = "lens.privacy.active-profile.v1";
const LOCKED_KEY = "lens.privacy.locked.v1";
const UNENCRYPTED_BOOTSTRAP_KEYS = new Set([
  ACTIVE_PROFILE_KEY,
  LOCKED_KEY,
  "lens.auth.resendAt",
]);

function requestValue(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("indexed storage failed"));
  });
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("keys")) database.createObjectStore("keys");
      if (!database.objectStoreNames.contains("envelopes")) database.createObjectStore("envelopes");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("local privacy database unavailable"));
  });
}

function indexedStore(database, name) {
  return {
    get(key) {
      return requestValue(database.transaction(name).objectStore(name).get(key));
    },
    set(key, value) {
      return requestValue(database.transaction(name, "readwrite").objectStore(name).put(value, key));
    },
    remove(key) {
      return requestValue(database.transaction(name, "readwrite").objectStore(name).delete(key));
    },
  };
}

function sensitiveKey(key) {
  return typeof key === "string" && !UNENCRYPTED_BOOTSTRAP_KEYS.has(key);
}

function listRawEntries(storage, original) {
  const entries = {};
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!sensitiveKey(key)) continue;
    const value = original.getItem.call(storage, key);
    if (value != null) entries[key] = value;
  }
  return entries;
}

export async function installSecureLocalStorage() {
  if (typeof window === "undefined" || !globalThis.indexedDB || window.__pearlPrivacy) {
    return window?.__pearlPrivacy || null;
  }
  const storage = window.localStorage;
  const prototype = Object.getPrototypeOf(storage);
  const original = {
    getItem: prototype.getItem,
    setItem: prototype.setItem,
    removeItem: prototype.removeItem,
    clear: prototype.clear,
    key: prototype.key,
  };
  const database = await openDatabase();
  const keyStore = indexedStore(database, "keys");
  const envelopeStore = indexedStore(database, "envelopes");
  const anonymousHash = await privacyProfileHash(ANONYMOUS_PROFILE_ID);
  let profileId = original.getItem.call(storage, ACTIVE_PROFILE_KEY) || anonymousHash;
  original.setItem.call(storage, ACTIVE_PROFILE_KEY, profileId);
  let vault = createLocalPrivacyVault({ profileId, keyStore, envelopeStore });
  let values = {};
  let locked = original.getItem.call(storage, LOCKED_KEY) === "1";
  if (!locked) {
    try {
      values = await vault.read();
    } catch (error) {
      locked = true;
      window.dispatchEvent(new CustomEvent("pearl-privacy-error", { detail: redactPrivacyDiagnostic(error) }));
    }
  }
  const plaintext = listRawEntries(storage, original);
  if (!locked && Object.keys(plaintext).length) {
    await vault.migrate(plaintext, async (keys) => {
      for (const key of keys) original.removeItem.call(storage, key);
    });
    values = await vault.read();
  }

  let flushChain = Promise.resolve();
  function flush() {
    if (locked) return Promise.reject(new Error("local Pearl data is locked"));
    const snapshot = { ...values };
    flushChain = flushChain.then(() => vault.write(snapshot));
    return flushChain;
  }
  function scheduleFlush() {
    flush().catch((error) => {
      window.dispatchEvent(new CustomEvent("pearl-privacy-error", { detail: redactPrivacyDiagnostic(error) }));
    });
  }

  prototype.getItem = function getItem(key) {
    if (this !== storage || !sensitiveKey(key)) return original.getItem.call(this, key);
    return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null;
  };
  prototype.setItem = function setItem(key, value) {
    if (this !== storage || !sensitiveKey(key)) return original.setItem.call(this, key, value);
    if (locked) throw new Error("local Pearl data is locked");
    values[key] = String(value);
    scheduleFlush();
  };
  prototype.removeItem = function removeItem(key) {
    if (this !== storage || !sensitiveKey(key)) return original.removeItem.call(this, key);
    delete values[key];
    scheduleFlush();
  };
  prototype.clear = function clear() {
    if (this !== storage) return original.clear.call(this);
    values = {};
    scheduleFlush();
    for (const key of UNENCRYPTED_BOOTSTRAP_KEYS) original.removeItem.call(storage, key);
  };

  const api = {
    get profileId() { return profileId; },
    get locked() { return locked; },
    flush,
    describe() {
      return {
        mode: "local-only",
        encrypted: !locked,
        locked,
        profile: profileId === anonymousHash ? "anonymous" : "account",
        itemCount: Object.keys(values).length,
        bootstrap: [...UNENCRYPTED_BOOTSTRAP_KEYS],
      };
    },
    async exportLocal() {
      return {
        version: 1,
        exportedAt: new Date().toISOString(),
        profile: profileId === anonymousHash ? "anonymous" : "account",
        entries: { ...values },
      };
    },
    async switchProfile(nextProfileId, options = {}) {
      if (locked) throw new Error("local Pearl data is locked");
      const normalized = String(nextProfileId || ANONYMOUS_PROFILE_ID);
      const nextHash = await privacyProfileHash(normalized);
      if (nextHash === profileId) return false;
      const carried = {};
      for (const [key, value] of Object.entries(values)) {
        if (options.carry?.(key)) {
          carried[key] = value;
          delete values[key];
        }
      }
      await flush();
      const nextVault = createLocalPrivacyVault({ profileId: nextHash, keyStore, envelopeStore });
      const nextValues = await nextVault.read();
      profileId = nextHash;
      vault = nextVault;
      values = { ...nextValues, ...carried };
      locked = false;
      original.setItem.call(storage, ACTIVE_PROFILE_KEY, profileId);
      await flush();
      return true;
    },
    async lock() {
      await flush();
      values = {};
      locked = true;
      original.setItem.call(storage, LOCKED_KEY, "1");
    },
    async unlock() {
      values = await vault.read();
      locked = false;
      original.removeItem.call(storage, LOCKED_KEY);
      return true;
    },
    async deleteLocal() {
      values = {};
      const receipt = await vault.clear();
      return receipt;
    },
  };
  window.__pearlPrivacy = api;
  window.addEventListener("pagehide", () => { flush().catch(() => {}); });
  return api;
}

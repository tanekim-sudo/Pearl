import {
  ANONYMOUS_PROFILE_ID,
  createLocalPrivacyVault,
  privacyProfileHash,
} from "../../../shared/local-privacy-vault.js";

const DATABASE = "pearl-extension-private-v1";
const ACTIVE_PROFILE_KEY = "pearlActiveProfile";
const LOCKED_KEY = "pearlPrivacyLocked";
const AUTO_LOCK_MS = 15 * 60_000;
const BOOTSTRAP_KEYS = new Set([
  ACTIVE_PROFILE_KEY,
  LOCKED_KEY,
  "apiOrigin",
  "onboardingComplete",
  "onboardingMode",
  "pearlSyncConsent",
]);

function requestValue(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("extension private storage failed"));
  });
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("keys")) database.createObjectStore("keys");
      if (!database.objectStoreNames.contains("envelopes")) database.createObjectStore("envelopes");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("extension private storage unavailable"));
  });
}

function store(database, name) {
  return {
    get: (key) => requestValue(database.transaction(name).objectStore(name).get(key)),
    set: (key, value) => requestValue(database.transaction(name, "readwrite").objectStore(name).put(value, key)),
    remove: (key) => requestValue(database.transaction(name, "readwrite").objectStore(name).delete(key)),
  };
}

function requestedKeys(keys, values) {
  if (Array.isArray(keys)) return keys;
  if (typeof keys === "string") return [keys];
  if (keys && typeof keys === "object") return Object.keys(keys);
  return Object.keys(values);
}

export function createSecureExtensionStorage(raw) {
  if (typeof indexedDB === "undefined" && globalThis.process?.versions?.node) {
    return {
      get: (area, keys) => raw.get(area, keys),
      set: (area, input) => raw.set(area, input),
      remove: (area, keys) => raw.remove(area, keys),
      async switchProfile(nextProfileId) {
        const nextHash = await privacyProfileHash(nextProfileId || ANONYMOUS_PROFILE_ID);
        await raw.set("local", { [ACTIVE_PROFILE_KEY]: nextHash });
        return true;
      },
      async exportLocal() {
        const entries = await raw.get("local", null);
        return { version: 1, profile: entries[ACTIVE_PROFILE_KEY] || "test", entries };
      },
      async deleteLocal() {
        const entries = await raw.get("local", null);
        await raw.remove("local", Object.keys(entries || {}).filter((key) => !BOOTSTRAP_KEYS.has(key)));
        const session = await raw.get("session", null);
        await raw.remove("session", Object.keys(session || {}));
        return { type: "local-privacy-deletion", profileHash: entries[ACTIVE_PROFILE_KEY] || "test", at: new Date().toISOString(), deleted: true };
      },
      async lock() { await raw.set("local", { [LOCKED_KEY]: true }); return { locked: true }; },
      async unlock() { await raw.remove("local", [LOCKED_KEY]); return { locked: false }; },
      async clearSession() {
        const session = await raw.get("session", null);
        await raw.remove("session", Object.keys(session || {}));
      },
      async profileHash() {
        const entries = await raw.get("local", [ACTIVE_PROFILE_KEY]);
        return entries[ACTIVE_PROFILE_KEY] || "test";
      },
    };
  }
  let database;
  let profileId;
  let anonymousHash;
  let vault;
  let values = {};
  let chain = Promise.resolve();
  let locked = false;
  let initializePromise;
  let autoLockTimer;

  async function scheduleAutoLock() {
    clearTimeout(autoLockTimer);
    if (locked || !(await vault?.protection?.())?.protected) return;
    autoLockTimer = setTimeout(() => {
      values = {};
      vault?.lock();
      locked = true;
      raw.set("local", { [LOCKED_KEY]: true }).catch(() => {});
    }, AUTO_LOCK_MS);
  }

  async function initialize(force = false) {
    if (!force && initializePromise) return initializePromise;
    initializePromise = (async () => {
      database ||= await openDatabase();
      anonymousHash ||= await privacyProfileHash(ANONYMOUS_PROFILE_ID);
      const bootstrap = await raw.get("local", [ACTIVE_PROFILE_KEY, LOCKED_KEY]);
      const requestedProfile = bootstrap[ACTIVE_PROFILE_KEY] || anonymousHash;
      if (!force && vault && requestedProfile === profileId) return;
      profileId = requestedProfile;
      vault = createLocalPrivacyVault({
        profileId,
        keyStore: store(database, "keys"),
        envelopeStore: store(database, "envelopes"),
      });
      locked = bootstrap[LOCKED_KEY] === true;
      if (locked) {
        values = {};
      } else {
        try {
          values = await vault.read();
        } catch (error) {
          if (!/locked/i.test(String(error?.message || ""))) throw error;
          values = {};
          locked = true;
          await raw.set("local", { [LOCKED_KEY]: true });
        }
      }
      const all = await raw.get("local", null);
      const plaintext = Object.fromEntries(Object.entries(all || {}).filter(([key]) => !BOOTSTRAP_KEYS.has(key)));
      if (locked && Object.keys(plaintext).length) throw new Error("private storage is locked");
      if (Object.keys(plaintext).length) {
        await vault.migrate(plaintext, (keys) => raw.remove("local", keys));
        values = await vault.read();
      }
      if (!bootstrap[ACTIVE_PROFILE_KEY]) await raw.set("local", { [ACTIVE_PROFILE_KEY]: profileId });
    })();
    try {
      return await initializePromise;
    } catch (error) {
      initializePromise = null;
      throw error;
    }
  }

  function flush() {
    const snapshot = { ...values };
    chain = chain.then(() => vault.write(snapshot));
    return chain;
  }

  return {
    async get(area, keys) {
      if (area !== "local") return raw.get(area, keys);
      await initialize();
      const bootstrapKeys = requestedKeys(keys, {}).filter((key) => BOOTSTRAP_KEYS.has(key));
      const bootstrap = bootstrapKeys.length ? await raw.get("local", bootstrapKeys) : {};
      const result = { ...bootstrap };
      for (const key of requestedKeys(keys, values)) {
        if (!BOOTSTRAP_KEYS.has(key) && Object.prototype.hasOwnProperty.call(values, key)) result[key] = values[key];
      }
      await scheduleAutoLock();
      return result;
    },
    async set(area, input) {
      if (area !== "local") return raw.set(area, input);
      await initialize();
      if (locked && Object.keys(input || {}).some((key) => !BOOTSTRAP_KEYS.has(key))) throw new Error("private storage is locked");
      const bootstrap = {};
      for (const [key, value] of Object.entries(input || {})) {
        if (BOOTSTRAP_KEYS.has(key)) bootstrap[key] = value;
        else values[key] = value;
      }
      if (Object.keys(bootstrap).length) await raw.set("local", bootstrap);
      if (Object.keys(input || {}).some((key) => !BOOTSTRAP_KEYS.has(key))) await flush();
      await scheduleAutoLock();
    },
    async remove(area, keys) {
      if (area !== "local") return raw.remove(area, keys);
      await initialize();
      const list = Array.isArray(keys) ? keys : [keys];
      const bootstrap = list.filter((key) => BOOTSTRAP_KEYS.has(key));
      for (const key of list) if (!BOOTSTRAP_KEYS.has(key)) delete values[key];
      if (bootstrap.length) await raw.remove("local", bootstrap);
      if (list.some((key) => !BOOTSTRAP_KEYS.has(key))) await flush();
      await scheduleAutoLock();
    },
    async switchProfile(nextProfileId) {
      await initialize();
      const nextHash = await privacyProfileHash(nextProfileId || ANONYMOUS_PROFILE_ID);
      if (nextHash === profileId) return false;
      if (!locked) await flush();
      const session = await raw.get("session", null);
      await raw.remove("session", Object.keys(session || {}));
      values = {};
      vault?.lock();
      clearTimeout(autoLockTimer);
      await raw.set("local", { [ACTIVE_PROFILE_KEY]: nextHash });
      await raw.remove("local", [LOCKED_KEY]);
      locked = false;
      try {
        await initialize(true);
      } catch (error) {
        if (!/locked/i.test(String(error?.message || ""))) throw error;
        values = {};
        locked = true;
        await raw.set("local", { [LOCKED_KEY]: true });
      }
      return true;
    },
    async exportLocal() {
      await initialize();
      return { version: 1, profile: profileId === anonymousHash ? "anonymous" : "account", entries: { ...values } };
    },
    async deleteLocal() {
      await initialize();
      values = {};
      const profileHash = profileId;
      const session = await raw.get("session", null);
      await raw.remove("session", Object.keys(session || {}));
      const receipt = await vault.clear();
      locked = true;
      clearTimeout(autoLockTimer);
      await raw.set("local", { [LOCKED_KEY]: true });
      return { ...receipt, profileHash };
    },
    async lock(secret) {
      await initialize();
      const protection = await vault.protection();
      if (!protection.protected) await vault.protect(secret);
      else await vault.unlock(secret);
      await flush();
      values = {};
      vault.lock();
      locked = true;
      clearTimeout(autoLockTimer);
      await raw.set("local", { [LOCKED_KEY]: true });
      return { locked: true };
    },
    async unlock(secret) {
      await initialize();
      await vault.unlock(secret);
      values = await vault.read();
      locked = false;
      await raw.remove("local", [LOCKED_KEY]);
      await scheduleAutoLock();
      return { locked: false };
    },
    async clearSession() {
      const session = await raw.get("session", null);
      await raw.remove("session", Object.keys(session || {}));
      values = locked ? {} : values;
    },
    async profileHash() {
      await initialize();
      return profileId;
    },
  };
}

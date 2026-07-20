import { createSecureExtensionStorage } from "./secure-storage.js";

function api() {
  return globalThis.browser || globalThis.chrome;
}

function callbackPromise(fn, ...args) {
  const browserApi = api();
  if (!fn) return Promise.reject(new Error("browser API unavailable"));
  if (globalThis.browser) return fn(...args);
  return new Promise((resolve, reject) => {
    fn(...args, (value) => {
      const error = browserApi.runtime?.lastError;
      if (error) reject(new Error(error.message));
      else resolve(value);
    });
  });
}

const rawStorage = {
  async get(area, keys) { return callbackPromise(api()?.storage?.[area]?.get.bind(api().storage[area]), keys); },
  async set(area, value) { return callbackPromise(api()?.storage?.[area]?.set.bind(api().storage[area]), value); },
  async remove(area, keys) { return callbackPromise(api()?.storage?.[area]?.remove.bind(api().storage[area]), keys); },
};
const secureStorage = createSecureExtensionStorage(rawStorage);

export const BrowserPlatform = Object.freeze({
  runtime: {
    sendMessage(message) { return callbackPromise(api()?.runtime?.sendMessage.bind(api().runtime), message); },
    onMessage(listener) { api()?.runtime?.onMessage.addListener(listener); },
    get id() { return api()?.runtime?.id || ""; },
    get url() { return api()?.runtime?.getURL?.("") || ""; },
  },
  storage: {
    get: secureStorage.get,
    set: secureStorage.set,
    remove: secureStorage.remove,
    switchProfile: secureStorage.switchProfile,
    exportLocal: secureStorage.exportLocal,
    deleteLocal: secureStorage.deleteLocal,
    lock: secureStorage.lock,
    unlock: secureStorage.unlock,
  },
  tabs: {
    async active() {
      const tabs = await callbackPromise(api()?.tabs?.query.bind(api().tabs), { active: true, currentWindow: true });
      return tabs?.[0] || null;
    },
    sendMessage(tabId, message, options) {
      return callbackPromise(api()?.tabs?.sendMessage.bind(api().tabs), tabId, message, options || {});
    },
    create(url) { return callbackPromise(api()?.tabs?.create.bind(api().tabs), { url }); },
  },
  permissions: {
    contains(value) { return callbackPromise(api()?.permissions?.contains.bind(api().permissions), value); },
    request(value) { return callbackPromise(api()?.permissions?.request.bind(api().permissions), value); },
  },
  identity: {
    launch(url, interactive = true) {
      return callbackPromise(api()?.identity?.launchWebAuthFlow.bind(api().identity), { url, interactive });
    },
    redirectUrl(path = "auth") { return api()?.identity?.getRedirectURL?.(path) || ""; },
  },
  sidePanel: {
    open(windowId) {
      const sidePanel = api()?.sidePanel;
      if (sidePanel?.open) return callbackPromise(sidePanel.open.bind(sidePanel), { windowId });
      return Promise.resolve(false);
    },
  },
});

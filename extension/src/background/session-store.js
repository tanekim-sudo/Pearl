import { BrowserPlatform } from "../platform/browser-platform.js";

const KEY = "lensEverywhereSession";
const empty = () => ({
  fragments: [],
  queue: [],
  generator: null,
  results: [],
  activeRunId: null,
  updatedAt: Date.now(),
});

export async function readSession() {
  const data = await BrowserPlatform.storage.get("session", [KEY]);
  return { ...empty(), ...(data[KEY] || {}) };
}

export async function writeSession(patch) {
  const current = await readSession();
  const next = { ...current, ...patch, updatedAt: Date.now() };
  await BrowserPlatform.storage.set("session", { [KEY]: next });
  return next;
}

export async function clearPageMaterial() {
  return writeSession({ fragments: [], results: [], activeRunId: null });
}

export async function clearAllSession() {
  await BrowserPlatform.storage.remove("session", [KEY]);
  return empty();
}

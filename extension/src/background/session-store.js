import { BrowserPlatform } from "../platform/browser-platform.js";

const KEY = "lensEverywhereSession";
let writeChain = Promise.resolve();
let sessionGeneration = 0;
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

export function writeSession(patch) {
  const generation = sessionGeneration;
  const write = writeChain.then(async () => {
    if (generation !== sessionGeneration) return empty();
    const current = await readSession();
    if (generation !== sessionGeneration) return empty();
    const next = { ...current, ...patch, updatedAt: Date.now() };
    await BrowserPlatform.storage.set("session", { [KEY]: next });
    return next;
  });
  writeChain = write.catch(() => {});
  return write;
}

export async function clearPageMaterial() {
  return writeSession({ fragments: [], results: [], activeRunId: null });
}

export async function clearAllSession() {
  sessionGeneration += 1;
  await writeChain.catch(() => {});
  await BrowserPlatform.storage.remove("session", [KEY]);
  return empty();
}

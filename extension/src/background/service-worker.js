import { createExecutionRequest, createExecutionResult, createProvenance } from "../../../shared/lens-runtime.js";
import { apiRequest, login, openArtifact } from "./api-client.js";
import { clearPageMaterial, readSession, writeSession } from "./session-store.js";
import { assertTrustedSender, createMessage, validateMessage } from "../core/messages.js";
import { BrowserPlatform } from "../platform/browser-platform.js";
import { importLibraryFile, mergeRemoteLibrary, previewLibraryFile, readLocalLibrary } from "./library-store.js";
import { validateExternalHandoff } from "../core/external-handoff.js";

const runs = new Map();

async function activeTab(preferredId) {
  const tab = preferredId
    ? await globalThis.chrome.tabs.get(Number(preferredId))
    : await BrowserPlatform.tabs.active();
  if (!tab?.id || !/^https?:/.test(tab.url || "")) throw new Error("open a supported web page");
  return tab;
}

async function ensureBridge(tab) {
  try {
    await BrowserPlatform.tabs.sendMessage(tab.id, createMessage("get-session", {}));
  } catch {
    const scripting = (globalThis.browser || globalThis.chrome)?.scripting;
    await scripting.executeScript({ target: { tabId: tab.id, allFrames: false }, files: ["assets/content.js"] });
    await new Promise((resolve) => setTimeout(resolve, 75));
  }
}

async function sendPage(type, payload = {}) {
  const tab = await activeTab(payload.targetTabId);
  await ensureBridge(tab);
  const { targetTabId: _targetTabId, ...contentPayload } = payload;
  return BrowserPlatform.tabs.sendMessage(tab.id, createMessage(type, contentPayload));
}

async function executeGo(payload) {
  const session = await readSession();
  if (!session.fragments.length) throw new Error("highlight material before GO");
  if (!session.queue.length && !session.generator) throw new Error("queue a lens or generator before GO");
  const runId = payload.runId || crypto.randomUUID();
  const controller = new AbortController();
  runs.set(runId, controller);
  const request = createExecutionRequest({
    fragments: session.fragments,
    queue: session.queue,
    generator: session.generator,
    idempotencyKey: payload.idempotencyKey || runId,
    disclosedCharacters: payload.disclosedCharacters,
  });
  await writeSession({ activeRunId: runId });
  try {
    const response = await apiRequest("/api/extension/execute", {
      method: "POST",
      body: request,
      idempotencyKey: request.idempotencyKey,
      controller,
    });
    const result = createExecutionResult({
      runId,
      outputs: response.outputs || response.results || [],
      provenance: response.provenance || createProvenance(session.fragments, { runId }),
    });
    return writeSession({ results: [result], activeRunId: null });
  } finally {
    runs.delete(runId);
  }
}

async function handle(message) {
  const { type, payload } = message;
  const session = await readSession();
  if (type === "get-session") return session;
  if (type === "fragments-changed") {
    const byId = new Map(session.fragments.map((entry) => [entry.id, entry]));
    for (const fragment of payload.fragments || []) byId.set(fragment.id, fragment);
    return writeSession({ fragments: [...byId.values()] });
  }
  if (type === "remove-fragment") {
    await sendPage(type, payload);
    return writeSession({ fragments: session.fragments.filter((entry) => entry.id !== payload.id) });
  }
  if (type === "clear-fragments") {
    if (!payload.navigation) await sendPage(type, payload);
    return clearPageMaterial();
  }
  if (type === "toggle-highlighter" || type === "capture-selection") return sendPage(type, payload);
  if (type === "queue-lens") {
    if (!payload.lens?.id) throw new Error("lens id required");
    const queue = [...session.queue.filter((entry) => entry.id !== payload.lens.id), payload.lens];
    return writeSession({ queue });
  }
  if (type === "remove-queue") return writeSession({ queue: session.queue.filter((_, index) => index !== payload.index) });
  if (type === "reorder-queue") {
    const queue = [...session.queue];
    if (payload.from < 0 || payload.to < 0 || payload.from >= queue.length || payload.to >= queue.length) return session;
    const [entry] = queue.splice(payload.from, 1);
    queue.splice(payload.to, 0, entry);
    return writeSession({ queue });
  }
  if (type === "set-generator") return writeSession({ generator: payload.generator || null });
  if (type === "go") return executeGo(payload);
  if (type === "cancel-run") {
    runs.get(payload.runId || session.activeRunId)?.abort();
    return writeSession({ activeRunId: null });
  }
  if (type === "result-action") return sendPage(type, payload);
  if (type === "auth-login") return { authenticated: await login() };
  if (type === "library-refresh") {
    const local = await readLocalLibrary();
    try {
      const remote = await apiRequest("/api/extension/library");
      const merged = await mergeRemoteLibrary(remote);
      if (local.operators.length || local.generators.length) {
        await apiRequest("/api/extension/library", {
          method: "POST",
          body: { operators: merged.operators, generators: merged.generators, rack: merged.rack },
        });
      }
      return merged;
    } catch {
      return local;
    }
  }
  if (type === "library-import-preview") return previewLibraryFile(payload.bundle);
  if (type === "library-import") {
    const imported = await importLibraryFile(payload.bundle, payload.choices || {});
    try {
      await apiRequest("/api/extension/library", {
        method: "POST",
        body: { operators: imported.operators, generators: imported.generators, rack: imported.rack },
        idempotencyKey: payload.bundle?.integrity?.payloadHash,
      });
    } catch {
      // Anonymous imports remain local and are merged on a later authenticated refresh.
    }
    return imported;
  }
  if (type === "library-pending") {
    const stored = await BrowserPlatform.storage.get("local", ["pendingLibraryHandoff"]);
    return stored.pendingLibraryHandoff || null;
  }
  if (type === "open-artifact") {
    const created = await apiRequest("/api/extension/artifacts", { method: "POST", body: payload });
    await BrowserPlatform.tabs.create(await openArtifact(created.id));
    return created;
  }
  throw new Error(`unsupported worker message: ${type}`);
}

globalThis.chrome?.runtime?.onInstalled.addListener(() => {
  globalThis.chrome.contextMenus.create({ id: "lens-capture", title: "Capture selection in Lens", contexts: ["selection"] });
  globalThis.chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true });
});

globalThis.chrome?.contextMenus?.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "lens-capture" || !tab?.id) return;
  await ensureBridge(tab);
  await BrowserPlatform.tabs.sendMessage(tab.id, createMessage("toggle-highlighter", { enabled: true }));
  await BrowserPlatform.tabs.sendMessage(tab.id, createMessage("capture-selection", {}));
  await BrowserPlatform.sidePanel.open(tab.windowId);
});

globalThis.chrome?.commands?.onCommand.addListener(async (command) => {
  if (command === "toggle-highlighter") await sendPage("toggle-highlighter");
});

globalThis.chrome?.runtime?.onMessage.addListener((raw, sender, respond) => {
  try {
    assertTrustedSender(sender, globalThis.chrome.runtime.id);
    const validated = validateMessage(raw);
    if (!validated.ok) throw new Error(validated.error);
    handle(validated.value).then((value) => respond({ ok: true, value }), (error) => respond({ ok: false, error: error.message }));
  } catch (error) {
    respond({ ok: false, error: error.message });
  }
  return true;
});

globalThis.chrome?.runtime?.onMessageExternal.addListener((raw, sender, respond) => {
  (async () => {
    const handoff = validateExternalHandoff(raw, sender);
    const preview = await previewLibraryFile(handoff.bundle);
    await BrowserPlatform.storage.set("local", {
      pendingLibraryHandoff: {
        bundle: preview.bundle,
        counts: preview.counts,
        receivedAt: Date.now(),
        origin: handoff.origin,
      },
    });
    return { accepted: true, requiresConfirmation: true, counts: preview.counts };
  })().then((value) => respond({ ok: true, value }), (error) => respond({ ok: false, error: error.message }));
  return true;
});

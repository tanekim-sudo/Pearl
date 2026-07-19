import { createExecutionRequest, createExecutionResult, createProvenance } from "../../../shared/lens-runtime.js";
import { apiRequest, authStatus, login, openArtifact } from "./api-client.js";
import { clearPageMaterial, readSession, writeSession } from "./session-store.js";
import { assertTrustedSender, createMessage, validateMessage } from "../core/messages.js";
import { BrowserPlatform } from "../platform/browser-platform.js";
import {
  importLibraryFile,
  composeLocalLibraryObjects,
  mergeRemoteLibrary,
  previewLibraryFile,
  readLocalLibrary,
  saveCapturedFunction,
  saveCapturedMove,
  saveCapturedLens,
  saveTranscriptCandidates,
  writeLocalLibrary,
} from "./library-store.js";
import { validateExternalAction, validateExternalHandoff } from "../core/external-handoff.js";
import {
  ORB_CURSOR_HIDE_CSS,
  ORB_CURSOR_TAB_STATE_KEY,
  orbCursorTabState,
} from "../core/orb-cursor-contract.js";
import { inferenceResultToOperator, normalizeBeforeAfterExamples } from "../../../shared/before-after-examples.js";
import { normalizeGenerationPlan, normalizeTasteFeedback } from "../../../shared/generation-plan.js";
import { canonicalPrimitiveName, TRANSFORM_PRIMITIVES } from "../../../shared/transform-primitives.js";
import { createCritiqueSession } from "../../../shared/critique-session.js";
import { createPersonalCommandDefinition } from "../../../shared/personal-command-vocabulary.js";

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
  if (!session.queue.length && !session.generator) throw new Error("queue a Move/Function action or Lens context before GO");
  const runId = payload.runId || crypto.randomUUID();
  const controller = new AbortController();
  runs.set(runId, controller);
  const request = createExecutionRequest({
    fragments: session.fragments,
    queue: session.queue,
    generator: session.generator,
    idempotencyKey: payload.idempotencyKey || runId,
    disclosedCharacters: payload.disclosedCharacters,
    generationPlan: payload.generationPlan,
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

async function handle(message, sender = {}) {
  const { type, payload } = message;
  const session = await readSession();
  if (type === "get-session") return session;
  if (type === "orb-cursor-get") {
    const tabId = sender.tab?.id ?? payload.targetTabId ?? (await activeTab().catch(() => null))?.id;
    if (!Number.isInteger(tabId)) return { enabled: false, supported: false };
    const stored = await BrowserPlatform.storage.get("session", [ORB_CURSOR_TAB_STATE_KEY]);
    return {
      enabled: stored[ORB_CURSOR_TAB_STATE_KEY]?.[String(tabId)]?.enabled === true,
      supported: true,
      tabId,
    };
  }
  if (type === "orb-cursor-set") {
    const tabId = sender.tab?.id ?? payload.targetTabId;
    if (!Number.isInteger(tabId)) throw new Error("orb cursor requires a supported page tab");
    const scripting = globalThis.chrome?.scripting;
    if (!scripting) throw new Error("orb cursor injection is unavailable");
    const injection = { target: { tabId, allFrames: false }, css: ORB_CURSOR_HIDE_CSS, origin: "USER" };
    if (payload.enabled === true) await scripting.insertCSS(injection);
    else await scripting.removeCSS(injection).catch(() => {});
    const stored = await BrowserPlatform.storage.get("session", [ORB_CURSOR_TAB_STATE_KEY]);
    const tabs = orbCursorTabState(stored[ORB_CURSOR_TAB_STATE_KEY], tabId, payload.enabled === true);
    await BrowserPlatform.storage.set("session", { [ORB_CURSOR_TAB_STATE_KEY]: tabs });
    return { enabled: payload.enabled === true, supported: true, tabId };
  }
  if (type === "toggle-orb-cursor") return sendPage(type, payload);
  if (type === "open-side-panel") {
    const tab = await activeTab(payload.targetTabId);
    await globalThis.chrome.sidePanel?.open?.({ windowId: tab.windowId });
    return { opened: true, tabId: tab.id };
  }
  if (type === "model-catalog") return apiRequest("/api/models", { method: "GET" });
  if (type === "compose-library-objects") return composeLocalLibraryObjects(payload.a, payload.b, { name: payload.name });
  if (type === "personal-command-save") {
    const storage = await BrowserPlatform.storage.get("local", ["personalCommandVocabulary"]);
    const definitions = storage.personalCommandVocabulary || [];
    const definition = createPersonalCommandDefinition({
      trigger: payload.trigger,
      scope: payload.scope,
      target: { command: payload.command },
      teachingUtterance: `When I say ${payload.trigger}, run ${payload.command}`,
      risk: "inherit",
    }, definitions);
    await BrowserPlatform.storage.set("local", { personalCommandVocabulary: [...definitions, definition] });
    return { type: "personal-command-definition", id: definition.id, version: definition.version };
  }
  if (type === "open-web-handoff") {
    await BrowserPlatform.storage.set("local", { cognitiveWorkflowHandoff: { ...payload, createdAt: Date.now() } });
    await globalThis.chrome.tabs.create({
      url: `https://representation-eta.vercel.app/?handoff=${encodeURIComponent(payload.surface || "workspace")}&view=${encodeURIComponent(payload.tab || "integrate")}`,
    });
    return { type: "cognitive-workflow-handoff", preserved: true };
  }
  if (type === "open-cognitive-pull-request") {
    if (!session.fragments.length) throw new Error("select explicit page material before opening an extraction proposal");
    const handoff = { kinds: payload.kinds, fragments: session.fragments, captureScope: "explicit-selection", createdAt: Date.now() };
    await BrowserPlatform.storage.set("local", { cognitivePullRequestHandoff: handoff });
    await globalThis.chrome.tabs.create({ url: "https://representation-eta.vercel.app/?handoff=cognitive-pull-request&view=pull-request" });
    return { type: "cognitive-pull-request-handoff", preserved: true, fragmentCount: session.fragments.length };
  }
  if (type === "invoke-primitive") {
    const name = canonicalPrimitiveName(payload.primitive);
    const primitive = TRANSFORM_PRIMITIVES.find((entry) => entry.name.toLowerCase() === name.toLowerCase());
    if (!primitive?.primitiveMove) throw new Error("choose Branch, Merge, Deepen, Challenge, or Embody");
    if (primitive.name === "merge" && (payload.targets || []).length < 2) throw new Error("Merge requires at least two explicit Material inputs");
    return writeSession({
      queue: [...session.queue, {
        id: primitive.id,
        name: primitive.name,
        prompt: primitive.prompt,
        targets: (payload.targets || []).slice(0, 20),
        generationPlan: normalizeGenerationPlan({
          ...(primitive.generationPlan || {}),
          ...(payload.branchSpecs ? { branchSpecs: payload.branchSpecs } : {}),
        }),
      }],
    });
  }
  if (type === "set-generation-branches") {
    const library = await readLocalLibrary();
    const index = library.operators.findIndex((entry) => entry.id === payload.artifact);
    if (index < 0) throw new Error("synced Move or Function not found");
    const operators = [...library.operators];
    operators[index] = {
      ...operators[index],
      version: (Number(operators[index].version) || 1) + 1,
      generationPlan: normalizeGenerationPlan({ ...(operators[index].generationPlan || {}), branchSpecs: payload.branchSpecs }),
      updatedAt: Date.now(),
    };
    return writeLocalLibrary({ ...library, operators });
  }
  if (type === "reorder-primitive") {
    const library = await readLocalLibrary();
    const primitiveId = library.operators.find((entry) => entry.id === payload.primitive || entry.name === payload.primitive)?.id || payload.primitive;
    const rank = [...new Set([...(library.rack?.primitiveRank || []), primitiveId])];
    const from = rank.indexOf(primitiveId);
    rank.splice(from, 1);
    rank.splice(Math.max(0, Math.min(Number(payload.to) || 0, rank.length)), 0, primitiveId);
    return writeLocalLibrary({ ...library, rack: { ...library.rack, primitiveRank: rank } });
  }
  if (type === "arm-merge-preview") {
    if ((payload.targets || []).length < 2) throw new Error("Merge requires at least two explicit Material inputs");
    return writeSession({ mergePreview: { targets: payload.targets.slice(0, 20), armedAt: Date.now(), destructive: false } });
  }
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
  if (type === "capture-visible-tab") {
    if (payload.authorized !== true) throw new Error("visible-tab capture requires explicit user authorization");
    const tab = await activeTab(payload.targetTabId);
    const capture = (globalThis.browser || globalThis.chrome)?.tabs?.captureVisibleTab;
    if (!capture) throw new Error("visible-tab capture is unavailable in this browser");
    const image = await capture.call((globalThis.browser || globalThis.chrome).tabs, tab.windowId, { format: "png" });
    return {
      version: 1,
      scope: "visibleTab",
      ephemeral: true,
      capturedAt: new Date().toISOString(),
      tab: { id: tab.id, title: tab.title || "", url: tab.url || "" },
      image,
    };
  }
  if (type === "critique-start") {
    const targets = [
      ...session.fragments.map((entry) => ({ id: entry.id, domain: "visibleTab" })),
      ...session.results.flatMap((run) => run.outputs.map((entry) => ({ id: entry.id, domain: "ai" }))),
    ];
    if (!targets.length) throw new Error("capture material or generate candidates before critique");
    const critique = createCritiqueSession({ targets });
    critique.start({ fragments: session.fragments, resultIds: targets.map((entry) => entry.id) });
    return writeSession({ critiqueSession: critique.snapshot() });
  }
  if (type === "critique-ingest") {
    if (!session.critiqueSession) throw new Error("start critique mode first");
    const critique = createCritiqueSession({
      id: session.critiqueSession.id,
      targets: session.critiqueSession.targets,
      rememberPreferences: session.critiqueSession.rememberPreferences,
      snapshot: session.critiqueSession,
    });
    const result = critique.ingest(payload.text, { source: "voice", targetSnapshot: payload.targetSnapshot || null });
    await writeSession({ critiqueSession: critique.snapshot() });
    return { session: critique.snapshot(), result };
  }
  if (type === "critique-stop") {
    if (!session.critiqueSession) throw new Error("no critique session is active");
    const critique = createCritiqueSession({ id: session.critiqueSession.id, targets: session.critiqueSession.targets, snapshot: session.critiqueSession });
    critique.stop();
    return writeSession({ critiqueSession: critique.snapshot() });
  }
  if (type === "save-capture-as-move") return saveCapturedMove(session.fragments, payload);
  if (type === "save-capture-as-function") return saveCapturedFunction(session.fragments, payload);
  if (type === "save-capture-as-lens") return saveCapturedLens(session.fragments, payload);
  if (type === "infer-transcript-artifacts") {
    if (!String(payload.transcript || "").trim()) throw new Error("paste transcript text explicitly");
    return apiRequest("/api/infer-transcript-artifacts", {
      method: "POST",
      body: { transcript: payload.transcript, requested: payload.requested || "all", source: "extension-explicit" },
      idempotencyKey: payload.idempotencyKey || crypto.randomUUID(),
    });
  }
  if (type === "save-transcript-artifacts") return saveTranscriptCandidates(payload.result, payload.kinds || []);
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
  if (type === "taste-feedback") {
    const feedback = payload.decision === "undecided" ? null : normalizeTasteFeedback(payload);
    let found = false;
    const results = session.results.map((run) => ({
      ...run,
      outputs: run.outputs.map((output) => {
        if (output.id !== payload.outputId) return output;
        found = true;
        return { ...output, tasteFeedback: feedback };
      }),
    }));
    if (!found) throw new Error("staged candidate not found");
    return writeSession({ results });
  }
  if (type === "result-action") return sendPage(type, payload);
  if (type === "auth-status") return authStatus();
  if (type === "auth-login") {
    await login();
    const library = await handle({ type: "library-refresh", payload: {} });
    return {
      authenticated: true,
      library,
      counts: { lenses: library.operators.length, generators: library.generators.length },
    };
  }
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
    await BrowserPlatform.storage.remove("local", ["pendingLibraryHandoff"]);
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
  if (type === "infer-before-after") {
    const examples = normalizeBeforeAfterExamples(payload);
    const inferred = await apiRequest("/api/infer-transformation", {
      method: "POST",
      body: examples,
      idempotencyKey: payload.idempotencyKey || crypto.randomUUID(),
    });
    const operator = inferenceResultToOperator(inferred.specification, examples, crypto.randomUUID());
    const local = await readLocalLibrary();
    const updated = await writeLocalLibrary({ ...local, operators: [...local.operators, operator] });
    try {
      await apiRequest("/api/extension/library", {
        method: "POST",
        body: { operators: updated.operators, generators: updated.generators, rack: updated.rack },
      });
    } catch {
      // The learned lens remains local and merges on a later authenticated refresh.
    }
    return { operator, library: updated };
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
  globalThis.chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: false });
});

globalThis.chrome?.action?.onClicked.addListener(async (tab) => {
  if (!tab?.id || !/^https?:/.test(tab.url || "")) return;
  await ensureBridge(tab);
  await globalThis.chrome.sidePanel?.open?.({ windowId: tab.windowId });
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
    handle(validated.value, sender).then((value) => respond({ ok: true, value }), (error) => respond({ ok: false, error: error.message }));
  } catch (error) {
    respond({ ok: false, error: error.message });
  }
  return true;
});

globalThis.chrome?.tabs?.onRemoved?.addListener(async (tabId) => {
  const stored = await BrowserPlatform.storage.get("session", [ORB_CURSOR_TAB_STATE_KEY]).catch(() => ({}));
  const tabs = orbCursorTabState(stored[ORB_CURSOR_TAB_STATE_KEY], tabId, false);
  await BrowserPlatform.storage.set("session", { [ORB_CURSOR_TAB_STATE_KEY]: tabs }).catch(() => {});
});

globalThis.chrome?.runtime?.onMessageExternal.addListener((raw, sender, respond) => {
  (async () => {
    if (raw?.type === "lens-install-check" || raw?.type === "lens-extension-open") {
      const action = validateExternalAction(raw, sender);
      if (action.type === "lens-extension-open") {
        const tab = await activeTab();
        await BrowserPlatform.sidePanel.open(tab.windowId);
      }
      const library = await readLocalLibrary();
      const auth = await authStatus();
      return {
        installed: true,
        opened: action.type === "lens-extension-open",
        authenticated: auth.authenticated,
        counts: { lenses: library.operators.length, generators: library.generators.length },
      };
    }
    if (raw?.type === "pearl-workspace-handoff") {
      validateExternalAction(raw, sender);
      const local = await BrowserPlatform.storage.get("local", [
        "cognitiveWorkflowHandoff",
        "cognitivePullRequestHandoff",
        "semanticOrbs",
        "activeSemanticOrbId",
      ]);
      const activeSession = await readSession();
      return {
        type: "pearl-workspace-handoff",
        handoff: local.cognitiveWorkflowHandoff || local.cognitivePullRequestHandoff || null,
        semanticOrbs: (local.semanticOrbs || []).filter((orb) => !orb.archived).slice(0, 80),
        activeSemanticOrbId: local.activeSemanticOrbId || null,
        session: {
          fragments: (activeSession.fragments || []).slice(0, 80),
          queue: (activeSession.queue || []).slice(0, 40),
          generator: activeSession.generator || null,
          results: (activeSession.results || []).slice(-20),
        },
      };
    }
    const handoff = validateExternalHandoff(raw, sender);
    const preview = await previewLibraryFile(handoff.bundle);
    const conflicts = [...preview.conflicts.lenses, ...preview.conflicts.generators]
      .filter((entry) => !["new", "exact-duplicate", "version-update"].includes(entry.status));
    if (!conflicts.length && !preview.bundle.privacy?.privateSourcesIncluded) {
      const imported = await importLibraryFile(preview.bundle);
      return {
        accepted: true,
        imported: true,
        requiresConfirmation: false,
        counts: { lenses: imported.operators.length, generators: imported.generators.length },
      };
    }
    await BrowserPlatform.storage.set("local", {
      pendingLibraryHandoff: {
        bundle: preview.bundle,
        counts: preview.counts,
        receivedAt: Date.now(),
        origin: handoff.origin,
      },
    });
    return { accepted: true, imported: false, requiresConfirmation: true, counts: preview.counts };
  })().then((value) => respond({ ok: true, value }), (error) => respond({ ok: false, error: error.message }));
  return true;
});

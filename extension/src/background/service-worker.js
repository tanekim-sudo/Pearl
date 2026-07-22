import { createExecutionRequest, createExecutionResult, createProvenance } from "../../../shared/lens-runtime.js";
import { apiRequest, authStatus, login, logout, openArtifact } from "./api-client.js";
import { clearAllSession, clearPageMaterial, readSession, writeSession } from "./session-store.js";
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
import { executeDomainCommand } from "../../../shared/domain-commands.js";
import { canonicalPageIdentity, pearlCanvasKey, pearlCanvasUsage } from "../../../shared/pearl-page-canvas.js";
import { normalizePearlTrack, pearlTrackAllowsOffline } from "../../../shared/pearl-soundscape.js";
import {
  createInternetArchiveAudioProvider,
  createJamendoAudioProvider,
  createProceduralAudioProvider,
} from "../../../shared/pearl-audio-providers.js";
import { deletePearlAudio, deleteProfileAudio, readPearlAudio, storePearlAudio } from "./audio-store.js";
import { deleteProfileImage, deleteProfileImages, readProfileImage, storeProfileImage } from "./profile-blob-store.js";
import { createDisclosureReceipt } from "../../../shared/local-privacy-vault.js";
import { normalizeResultPearl, spawnResultPearl } from "../../../shared/result-pearls.js";
import { consumeSecureHandoff, createSecureHandoff, pruneSecureHandoffs } from "../../../shared/secure-handoff.js";
import { createPearlPrivacyPolicy, guardPearlPrivacyAction, inheritPrivacyForDerivedPearl } from "../../../shared/pearl-privacy-policy.js";
import { createPearlEntity } from "../../../shared/pearl-entity.js";
import { migrateLegacyPearlState, PEARL_STORE_KEY } from "../../../shared/pearl-store.js";
import { executePearlActionEvent } from "../../../shared/pearl-action-protocol.js";
import { assertPrivilegedExtensionSurface, assertServerVerifiedPearlCommand } from "../core/security.js";

const runs = new Map();
const handledRequests = new Map();
let handoffChain = Promise.resolve();
const canvasCommands = new Set([
  "activatePearlPageCanvas",
  "deactivatePearlPageCanvas",
  "setPearlCanvasInputMode",
  "createPearlCanvasArtifact",
  "updatePearlCanvasArtifact",
  "deletePearlCanvasArtifacts",
  "selectPearlCanvasArtifacts",
  "bindPearlCanvasContext",
  "setPearlCanvasOutputDestination",
  "placePearlCanvasOutput",
  "undoPearlPageCanvas",
]);
const resultCommands = new Set([
  "placeResultPearl",
  "moveResultPearl",
  "undoResultPearl",
  "setResultPearlStatus",
  "expandResultPearl",
  "collapseResultPearl",
  "redirectResultPearl",
  "presentResultPearlAsChat",
  "createResultPlacementRegion",
  "selectResultPlacementRegion",
  "acceptResultPearl",
  "archiveResultPearl",
  "deleteResultPearl",
  "requestOutputPlacement",
  "interpretOutputPlacement",
  "confirmOutputPlacement",
  "beginOutputPlacement",
  "completeOutputPlacement",
  "failOutputPlacement",
  "cancelOutputPlacement",
]);
const audioProviders = new Map([
  ["procedural", createProceduralAudioProvider()],
  ["internet-archive", createInternetArchiveAudioProvider()],
  ["jamendo", createJamendoAudioProvider({ clientId: import.meta.env.VITE_JAMENDO_CLIENT_ID || "" })],
]);

function mutateHandoffs(storageKey, mutation) {
  const pending = handoffChain.then(async () => {
    const stored = await BrowserPlatform.storage.get("local", [storageKey]);
    const records = pruneSecureHandoffs(stored[storageKey] || {});
    const outcome = await mutation(records);
    await BrowserPlatform.storage.set("local", { [storageKey]: outcome.records });
    return outcome.value;
  });
  handoffChain = pending.catch(() => {});
  return pending;
}

async function createBoundHandoff(storageKey, input) {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const profileHash = await BrowserPlatform.storage.profileHash();
  const tab = await BrowserPlatform.tabs.create("about:blank");
  const record = createSecureHandoff({ ...input, nonce, profileHash, tabId: tab.id });
  await mutateHandoffs(storageKey, (records) => ({
    records: { ...records, [nonce]: record },
    value: record,
  }));
  return { nonce, tab };
}

async function consumeBoundHandoff(storageKey, nonce, claims) {
  return mutateHandoffs(storageKey, (records) => {
    const consumed = consumeSecureHandoff(records, nonce, claims);
    return { records: consumed.records, value: consumed.payload };
  });
}

async function clearDecryptedPageSurfaces() {
  const tabs = await globalThis.chrome?.tabs?.query?.({}) || [];
  await Promise.all(tabs.filter((tab) => /^https?:/.test(tab.url || "")).flatMap((tab) => [
    BrowserPlatform.tabs.sendMessage(tab.id, createMessage("clear-fragments", {})).catch(() => {}),
    BrowserPlatform.tabs.sendMessage(tab.id, createMessage("page-canvas-state", { canvas: null })).catch(() => {}),
    BrowserPlatform.tabs.sendMessage(tab.id, createMessage("result-pearl-state", { results: [] })).catch(() => {}),
  ]));
  try {
    await globalThis.chrome?.offscreen?.closeDocument?.();
  } catch {
    // No offscreen audio document is active.
  }
}

async function canvasStore() {
  const stored = await BrowserPlatform.storage.get("local", ["pearlPageCanvases", "activeSemanticOrbId"]);
  return {
    pageCanvases: stored.pearlPageCanvases || {},
    activeSemanticOrbId: stored.activeSemanticOrbId || null,
  };
}

function assertPageIdentity(pageIdentity, sender) {
  if (!/^https?:/.test(sender.tab?.url || "")) return pageIdentity;
  const actual = canonicalPageIdentity(sender.tab.url);
  if (pageIdentity && pageIdentity !== actual) throw new Error("Pearl canvas page identity mismatch");
  return actual;
}

async function executeCanvasCommand(command, args, sender) {
  if (!canvasCommands.has(command)) throw new Error("unsupported Pearl canvas command");
  const state = await canvasStore();
  const pearlId = String(args.pearlId || state.activeSemanticOrbId || "");
  if (!pearlId) throw new Error("choose a Pearl before using the page canvas");
  const senderIsPage = /^https?:/.test(sender.tab?.url || "");
  const pageIdentity = args.pageIdentity
    ? senderIsPage ? assertPageIdentity(args.pageIdentity, sender) : String(args.pageIdentity)
    : senderIsPage ? canonicalPageIdentity(sender.tab.url) : canonicalPageIdentity((await activeTab()).url);
  const execution = await executeDomainCommand(command, state, { ...args, pearlId, pageIdentity }, {
    persist: (next) => {
      const canvases = Object.values(next.pageCanvases || {});
      const usage = canvases.map(pearlCanvasUsage).reduce((total, entry) => ({
        artifacts: total.artifacts + entry.artifacts,
        points: total.points + entry.points,
        bytes: total.bytes + entry.bytes,
      }), { artifacts: 0, points: 0, bytes: 0 });
      if (canvases.length > 100 || usage.artifacts > 5_000 || usage.points > 500_000 || usage.bytes > 25_000_000) {
        const error = new Error("Pearl canvas profile quota reached");
        error.code = "PEARL_CANVAS_QUOTA";
        error.recoverable = true;
        throw error;
      }
      return BrowserPlatform.storage.set("local", {
        pearlPageCanvases: next.pageCanvases,
        activeSemanticOrbId: pearlId,
      });
    },
  });
  const key = pearlCanvasKey(pearlId, pageIdentity);
  const canvas = execution.state.pageCanvases[key];
  if (!senderIsPage) {
    const tab = await activeTab();
    await ensureBridge(tab);
    await BrowserPlatform.tabs.sendMessage(tab.id, createMessage("page-canvas-state", { canvas }));
  }
  return { ...execution.result, canvas };
}

async function ensureAudioDocument() {
  if (!globalThis.chrome?.offscreen) throw new Error("persistent audio is unavailable on this browser");
  const url = chrome.runtime.getURL("offscreen.html");
  const existing = await chrome.runtime.getContexts?.({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [url],
  });
  if (existing?.length) return;
  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["AUDIO_PLAYBACK"],
    justification: "Play a user-activated Pearl soundscape after the side panel closes.",
  });
}

async function soundscapeStore() {
  const stored = await BrowserPlatform.storage.get("local", ["pearlSoundscapes", "activeSemanticOrbId"]);
  return {
    pearlSoundscapes: stored.pearlSoundscapes || {},
    activeSemanticOrbId: stored.activeSemanticOrbId || null,
  };
}

async function executeSoundscapeCommand(command, pearlId, args = {}) {
  const state = await soundscapeStore();
  const selectedPearlId = String(pearlId || state.activeSemanticOrbId || "");
  if (!selectedPearlId) throw new Error("choose a Pearl before changing its soundscape");
  const execution = await executeDomainCommand(command, state, { pearlId: selectedPearlId, ...args }, {
    persist: (next) => BrowserPlatform.storage.set("local", {
      pearlSoundscapes: next.pearlSoundscapes,
      activeSemanticOrbId: selectedPearlId,
    }),
  });
  return { ...execution.result, soundscape: execution.state.pearlSoundscapes[selectedPearlId] };
}

async function resultStore() {
  const stored = await BrowserPlatform.storage.get("local", ["resultPearls", "resultChats", "activeSemanticOrbId", "pearlPageCanvases", "pearlPrivacyPolicies", PEARL_STORE_KEY]);
  const resultPearls = {};
  for (const [id, entry] of Object.entries(stored.resultPearls || {})) {
    try {
      resultPearls[id] = normalizeResultPearl(entry);
    } catch {
      if (!entry?.id || !entry?.pearlId || !entry?.pageIdentity) continue;
      resultPearls[id] = spawnResultPearl({
        id: entry.id,
        pearlId: entry.pearlId,
        pageIdentity: entry.pageIdentity,
        outputId: entry.outputId || entry.id,
        status: "failed",
        failure: { code: "CORRUPT_RESULT", recoverable: true },
        sourceRefs: entry.sourceRefs || [],
        text: "",
        placement: entry.placement || null,
        destination: entry.destination || { type: "margin-pearl" },
      });
    }
  }
  for (const entity of Object.values(stored[PEARL_STORE_KEY]?.entities || {})) {
    if (entity.kind !== "result" || resultPearls[entity.id]) continue;
    const snapshot = entity.results?.[0] || {};
    try {
      resultPearls[entity.id] = normalizeResultPearl({
        ...snapshot,
        id: entity.id,
        pearlId: entity.relationships?.parentPearlId || entity.id,
        pageIdentity: entity.workingSet?.pageIdentity,
        placement: entity.representation?.placement,
        expanded: entity.representation?.expanded,
        routing: entity.outputRouting,
        privacyPolicy: entity.privacy?.policy,
        lineage: entity.lineage,
        provenance: entity.provenance,
        updatedAt: entity.updatedAt,
        createdAt: entity.createdAt,
      });
    } catch {
      // Corrupt canonical entities remain quarantined for Studio recovery.
    }
  }
  return {
    resultPearls,
    resultChats: stored.resultChats || [],
    activeSemanticOrbId: stored.activeSemanticOrbId || null,
    pageCanvases: stored.pearlPageCanvases || {},
    pearlPrivacyPolicies: stored.pearlPrivacyPolicies || {},
  };
}

async function privacyPolicyStore() {
  const stored = await BrowserPlatform.storage.get("local", ["pearlPrivacyPolicies", "pearlPrivacyPatches", "pearlPrivacyCheckpoints", "activeSemanticOrbId"]);
  return {
    pearlPrivacyPolicies: stored.pearlPrivacyPolicies || {},
    pearlPrivacyPatches: stored.pearlPrivacyPatches || {},
    pearlPrivacyCheckpoints: stored.pearlPrivacyCheckpoints || {},
    activeSemanticOrbId: stored.activeSemanticOrbId || null,
  };
}

async function persistPrivacyPolicyState(state) {
  const stored = await BrowserPlatform.storage.get("local", [PEARL_STORE_KEY]);
  const pearlStore = stored[PEARL_STORE_KEY] || migrateLegacyPearlState({});
  const entities = { ...(pearlStore.entities || {}) };
  for (const [pearlId, policy] of Object.entries(state.pearlPrivacyPolicies || {})) {
    if (!entities[pearlId]) continue;
    entities[pearlId] = createPearlEntity({ ...entities[pearlId], privacyPolicy: policy, revision: entities[pearlId].revision + 1 });
  }
  await BrowserPlatform.storage.set("local", {
    pearlPrivacyPolicies: state.pearlPrivacyPolicies || {},
    pearlPrivacyPatches: state.pearlPrivacyPatches || {},
    pearlPrivacyCheckpoints: state.pearlPrivacyCheckpoints || {},
    [PEARL_STORE_KEY]: { ...pearlStore, entities, updatedAt: Date.now() },
  });
}

async function persistResultState(next) {
  const stored = await BrowserPlatform.storage.get("local", [PEARL_STORE_KEY]);
  const pearlStore = stored[PEARL_STORE_KEY] || migrateLegacyPearlState({});
  const entities = { ...(pearlStore.entities || {}) };
  for (const resultPearl of Object.values(next.resultPearls || {})) {
    entities[resultPearl.id] = createPearlEntity({ ...resultPearl, kind: "result" });
  }
  await BrowserPlatform.storage.set("local", {
    resultPearls: next.resultPearls || {},
    resultChats: next.resultChats || [],
    ...(next.pageCanvases ? { pearlPageCanvases: next.pageCanvases } : {}),
    [PEARL_STORE_KEY]: { ...pearlStore, entities, activePearlId: pearlStore.activePearlId || Object.keys(entities)[0] || null, updatedAt: Date.now() },
  });
}

async function resultPearlsForPage(pageIdentity, pearlId) {
  const state = await resultStore();
  return Object.values(state.resultPearls).filter((entry) =>
    entry.pageIdentity === pageIdentity && (!pearlId || entry.pearlId === pearlId)
  );
}

async function publishResultPearls(tab, pageIdentity, pearlId) {
  const results = await resultPearlsForPage(pageIdentity, pearlId);
  const current = await globalThis.chrome.tabs.get(tab.id).catch(() => null);
  if (current && /^https?:/.test(current.url || "") && canonicalPageIdentity(current.url) === pageIdentity) {
    await BrowserPlatform.tabs.sendMessage(tab.id, createMessage("result-pearl-state", { results })).catch(() => {});
  }
  return results;
}

async function executeResultCommand(command, args, sender = {}) {
  if (!resultCommands.has(command)) throw new Error("unsupported result Pearl command");
  const state = await resultStore();
  const resolvedArgs = { ...args };
  if (resolvedArgs.resultId === "latest") {
    const latest = Object.values(state.resultPearls).filter((entry) => !entry.archived).sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (!latest) throw new Error("no result Pearl is available");
    resolvedArgs.resultId = latest.id;
  }
  const execution = await executeDomainCommand(command, state, resolvedArgs, { persist: persistResultState });
  const object = execution.result.object;
  const updatedResult = execution.state.resultPearls?.[resolvedArgs.resultId];
  const publishObject = object?.pageIdentity ? object : updatedResult;
  if (publishObject?.pageIdentity) {
    const pageTab = /^https?:/.test(sender.tab?.url || "") ? sender.tab : await activeTab().catch(() => null);
    if (pageTab) await publishResultPearls(pageTab, publishObject.pageIdentity, publishObject.pearlId);
  }
  if (command === "createResultPlacementRegion" && object?.pageIdentity) {
    const tab = sender.tab?.id ? sender.tab : await activeTab();
    const canvas = execution.state.pageCanvases?.[pearlCanvasKey(object.pearlId, object.pageIdentity)] || null;
    await BrowserPlatform.tabs.sendMessage(tab.id, createMessage("page-canvas-state", { canvas })).catch(() => {});
  }
  return execution.result;
}

async function executeConfirmedOutputPlacement(resultId, sender = {}) {
  let state = await resultStore();
  const object = state.resultPearls[resultId];
  if (!object) throw new Error("result Pearl not found");
  const begun = await executeDomainCommand("beginOutputPlacement", state, { resultId }, {
    persist: persistResultState,
    disclosureApproved: true,
  });
  if (begun.result.object?.duplicate) return begun.result;
  state = begun.state;
  const current = state.resultPearls[resultId];
  const plan = current.routing.plan;
  const destination = plan.destination;
  let effect = { type: destination.type };
  try {
    if (destination.type === "margin-pearl") {
      effect = { type: "margin-pearl", placement: current.placement, retained: true };
    } else if (destination.type === "chat") {
      const placed = await executeDomainCommand("presentResultPearlAsChat", state, { resultId }, { persist: persistResultState });
      state = placed.state;
      effect = { type: "chat", id: placed.result.object.id };
    } else if (["new-textbox", "companion-region", "user-region"].includes(destination.type)) {
      const anchor = destination.anchor?.geometry || current.placement || { x: 24, y: 80, width: 1, height: 1 };
      const box = destination.type === "user-region" && destination.anchor?.geometry
        ? destination.anchor.geometry
        : { x: anchor.x, y: anchor.y + anchor.height + 16, width: 320, height: 190 };
      const placed = await executeDomainCommand("createResultPlacementRegion", state, {
        resultId,
        pearlId: current.pearlId,
        pageIdentity: current.pageIdentity,
        box,
        coordinateSpace: box.coordinateSpace || "document",
        kind: destination.type === "new-textbox" ? "canvas-textbox" : destination.type === "user-region" ? "canvas-region" : "companion-region",
      }, { persist: persistResultState });
      state = placed.state;
      effect = { type: destination.type, targetId: placed.result.object.destination?.targetId };
    } else if (destination.type === "existing-textbox") {
      const placed = await executeDomainCommand("selectResultPlacementRegion", state, {
        resultId,
        pearlId: current.pearlId,
        pageIdentity: current.pageIdentity,
        artifactId: destination.targetId,
        kind: "canvas-textbox",
      }, { persist: persistResultState });
      state = placed.state;
      effect = { type: destination.type, targetId: destination.targetId };
    } else if (["native-insert", "native-replace"].includes(destination.type)) {
      effect = await sendPage("result-action", {
        targetTabId: destination.tabId,
        resultId,
        text: current.text,
        outputSpec: current.outputSpec,
        plan: {
          operation: destination.type === "native-replace" ? "replace" : "insert",
          anchor: destination.anchor,
          targetRevision: plan.targetRevision,
          confirmed: true,
          idempotencyKey: plan.idempotencyKey,
        },
      });
    } else if (destination.type === "pearl-studio") {
      const handoff = await createBoundHandoff("resultPearlHandoffs", {
        origin: new URL(chrome.runtime.getURL("result.html")).origin,
        scope: "result-tab",
        payload: { result: current, studio: true, placementPlanId: plan.id },
      });
      await BrowserPlatform.tabs.update(handoff.tab.id, { url: chrome.runtime.getURL(`result.html#handoff=${handoff.nonce}`) });
      effect = { type: destination.type, opened: true };
    } else if (["web-scene", "output-frame"].includes(destination.type)) {
      const handoff = await createBoundHandoff("webResultHandoffs", {
        origin: "https://representation-eta.vercel.app",
        scope: "result-web",
        payload: { type: "pearl-result-handoff", resultPearl: current, destination: destination.type },
      });
      await BrowserPlatform.tabs.update(handoff.tab.id, {
        url: `https://representation-eta.vercel.app/#handoff=result-pearl&token=${handoff.nonce}`,
      });
      effect = { type: destination.type, opened: true };
    } else {
      effect = await sendPage("output-placement-effect", {
        resultId,
        destination,
        text: current.text,
        outputSpec: current.outputSpec,
        idempotencyKey: plan.idempotencyKey,
      });
    }
    const completed = await executeDomainCommand("completeOutputPlacement", state, { resultId, effect }, { persist: persistResultState });
    const pending = await readSession();
    if (pending.pendingOutputRouting?.activeResultId === resultId) await writeSession({ pendingOutputRouting: null });
    if (current.pageIdentity) {
      const tab = sender.tab?.id ? sender.tab : await activeTab().catch(() => null);
      if (tab) await publishResultPearls(tab, current.pageIdentity, current.pearlId);
    }
    return completed.result;
  } catch (error) {
    await executeDomainCommand("failOutputPlacement", state, {
      resultId,
      error: { code: error?.code || "PLACEMENT_FAILED" },
    }, { persist: persistResultState });
    throw error;
  }
}

async function materializeResultPearls(session, run, disclosureReceipt, options = {}) {
  const stored = await resultStore();
  const existing = Object.values(stored.resultPearls)
    .filter((entry) => entry.execution?.runId === run.runId)
    .sort((a, b) => (a.branch?.index || 0) - (b.branch?.index || 0));
  const tab = options.tab || await activeTab();
  if (!existing.length) await ensureBridge(tab);
  const pageIdentity = existing[0]?.pageIdentity || canonicalPageIdentity(tab.url);
  const pearlId = existing[0]?.pearlId || stored.activeSemanticOrbId || "pearl:extension-default";
  const sourcePolicy = stored.pearlPrivacyPolicies?.[pearlId] || createPearlPrivacyPolicy({ pearlId });
  const sourceRefs = (session.fragments || []).map((entry) => ({
    id: entry.id,
    anchor: entry.anchor || null,
    provenance: entry.provenance || null,
  }));
  let placements = existing.map((entry) => entry.placement);
  if (!existing.length || existing.length !== run.outputs.length) {
    const layoutResponse = await BrowserPlatform.tabs.sendMessage(tab.id, createMessage("result-pearl-layout-request", {
      sourceRefs,
      count: run.outputs.length,
    })).catch(() => null);
    placements = layoutResponse?.placements || Array.from({ length: run.outputs.length }, (_, index) => ({
      ...(existing[index]?.placement || existing[0]?.placement || { x: 8, y: 80, width: 32, height: 32, coordinateSpace: "document", side: "right", docked: true }),
      y: (existing[index]?.placement?.y || existing[0]?.placement?.y || 80) + index * 40,
    }));
  }
  let state = stored;
  const spawnedResults = [];
  for (let index = 0; index < run.outputs.length; index += 1) {
    const output = run.outputs[index];
    const idempotencyKey = `${run.runId}:${output.id || index}:result-pearl`;
    const resultId = `result-pearl:${run.runId}:${index}`;
    const spawned = await executeDomainCommand("spawnResultPearl", state, {
      idempotencyKey,
      result: {
        id: resultId,
        outputId: output.id || resultId,
        pearlId,
        pageIdentity,
        text: "",
        status: "streaming",
        sourceRefs,
        lens: session.generator
          ? { id: session.generator.id, version: session.generator.version || 1, strength: 1 }
          : session.queue.at(-1)
            ? { id: session.queue.at(-1).id, version: session.queue.at(-1).version || 1, strength: 1 }
            : null,
        execution: { runId: run.runId, idempotencyKey, model: run.provenance?.resolvedModel || run.provenance?.model || "configured" },
        branch: { index, total: run.outputs.length, spec: output.branchSpec || null },
        outputSpec: output.outputSpec || null,
        disclosureReceipt,
        lineage: output.lineage || sourceRefs.map((entry) => ({ id: entry.id })),
        destination: { type: "margin-pearl", placement: placements[index] || null },
        placement: placements[index] || null,
        provenance: output.provenance || run.provenance || {},
        privacyPolicy: inheritPrivacyForDerivedPearl({ id: resultId }, [sourcePolicy]).privacyPolicy,
      },
    });
    state = spawned.state;
    spawnedResults.push({ resultId, output });
  }
  await persistResultState(state);
  await publishResultPearls(tab, pageIdentity, pearlId);
  if (options.streamingOnly) return Object.values(state.resultPearls).filter((entry) => entry.execution?.runId === run.runId);
  for (const { resultId, output } of spawnedResults) {
    const ready = await executeDomainCommand("setResultPearlStatus", state, {
      resultId,
      status: run.failed ? "failed" : "ready",
      text: run.failed ? "" : output.text || "",
      patch: {
        outputId: output.id || resultId,
        outputSpec: output.outputSpec || null,
        branch: { index: output.branchIndex ?? spawnedResults.findIndex((entry) => entry.resultId === resultId), total: spawnedResults.length, id: output.branchId || null, spec: output.branchSpec || output.branchProvenance || output.branch || null },
        lineage: output.lineage || sourceRefs.map((entry) => ({ id: entry.id })),
        provenance: output.provenance || output.branchProvenance || run.provenance || {},
      },
      ...(run.failed ? { failure: run.failure || { code: "GENERATION_FAILED", recoverable: true } } : {}),
    });
    state = ready.state;
    if (!run.failed) {
      const routing = await executeDomainCommand("requestOutputPlacement", state, {
        resultId,
        branches: spawnedResults.map((entry, branchIndex) => ({
          id: entry.output.branchId || entry.resultId,
          resultId: entry.resultId,
          index: branchIndex,
          label: entry.output.branchSpec?.name || entry.output.branchSpec?.label || `Branch ${branchIndex + 1}`,
        })),
      });
      state = routing.state;
    }
  }
  for (const stale of existing.slice(spawnedResults.length)) {
    const failed = await executeDomainCommand("setResultPearlStatus", state, {
      resultId: stale.id,
      status: "failed",
      text: "",
      failure: { code: "OUTPUT_MISSING", recoverable: true },
    });
    state = failed.state;
  }
  await persistResultState(state);
  if (!run.failed && spawnedResults.length) {
    const primary = state.resultPearls[spawnedResults[0].resultId];
    await writeSession({
      pendingOutputRouting: {
        resultIds: spawnedResults.map((entry) => entry.resultId),
        activeResultId: primary.id,
        stage: primary.routing?.stage || "choosing",
        question: primary.routing?.question || "Where should this output go?",
        updatedAt: Date.now(),
      },
    });
  }
  return publishResultPearls(tab, pageIdentity, pearlId);
}

async function activeTab(preferredId) {
  let tab = preferredId
    ? await globalThis.chrome.tabs.get(Number(preferredId))
    : await BrowserPlatform.tabs.active();
  if (!tab?.id || !/^https?:/.test(tab.url || "")) {
    const candidates = await globalThis.chrome.tabs.query({ currentWindow: true });
    tab = candidates.filter((entry) => /^https?:/.test(entry.url || "")).sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0] || tab;
  }
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
  const privacyState = await BrowserPlatform.storage.get("local", ["activeSemanticOrbId", "pearlPrivacyPolicies"]);
  const privacyPearlId = privacyState.activeSemanticOrbId || "pearl:extension-default";
  const privacyPolicy = privacyState.pearlPrivacyPolicies?.[privacyPearlId] || createPearlPrivacyPolicy({ pearlId: privacyPearlId });
  if (!privacyState.pearlPrivacyPolicies?.[privacyPearlId]) {
    await BrowserPlatform.storage.set("local", {
      pearlPrivacyPolicies: { ...(privacyState.pearlPrivacyPolicies || {}), [privacyPearlId]: privacyPolicy },
    });
  }
  const privacyDecision = guardPearlPrivacyAction(privacyPolicy, "model-call", {
    fields: ["explicit-page-selection"],
    provider: payload.provider || null,
  });
  if (!privacyDecision.allowed) {
    const error = new Error(privacyDecision.reason);
    error.code = privacyDecision.code;
    error.minimumPrivacyPatch = privacyDecision.minimumPatch;
    throw error;
  }
  if (privacyDecision.approvalRequired && payload.privacyDisclosureApproved !== true) {
    const error = new Error("Approve the bounded model disclosure for this run.");
    error.code = "PRIVACY_APPROVAL_REQUIRED";
    throw error;
  }
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
    workingMemory: payload.workingMemory || null,
  });
  const executionTab = await activeTab();
  await writeSession({ activeRunId: runId });
  const disclosureReceipt = await createDisclosureReceipt({
    id: `disclosure:${runId}`,
    action: "extension-model-execution",
    fragmentIds: session.fragments.map((entry) => entry.id),
    disclosedCharacters: request.disclosedCharacters || session.fragments.reduce((sum, entry) => sum + String(entry.quote || "").length, 0),
    destination: "configured-model",
    policyId: privacyPolicy.id,
    policyVersion: privacyPolicy.version,
  });
  const receipts = await BrowserPlatform.storage.get("local", ["disclosureReceipts"]);
  await BrowserPlatform.storage.set("local", {
    disclosureReceipts: [...(receipts.disclosureReceipts || []), disclosureReceipt].slice(-500),
  });
  const plannedOutputs = Array.from({ length: request.generationPlan?.candidateCount || 1 }, (_, index) => ({
    id: `pending:${runId}:${index}`,
    branchSpec: request.generationPlan?.branchSpecs?.[index] || null,
    outputSpec: request.generationPlan?.branchSpecs?.[index]?.outputSpecOverride || null,
  }));
  await materializeResultPearls(session, {
    runId,
    outputs: plannedOutputs,
    provenance: { model: "pending" },
  }, disclosureReceipt, { streamingOnly: true, tab: executionTab }).catch(() => {});
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
    await writeSession({ results: [result], activeRunId: null });
    await materializeResultPearls(session, result, disclosureReceipt, { tab: executionTab }).catch(() => {});
    return readSession();
  } catch (error) {
    await writeSession({ activeRunId: null });
    await materializeResultPearls(session, {
      runId,
      failed: true,
      failure: { code: error.name === "AbortError" ? "CANCELED" : "GENERATION_FAILED", recoverable: true },
      outputs: plannedOutputs.map((entry, index) => ({ ...entry, id: `failed:${runId}:${index}`, text: "", lineage: session.fragments.map((fragment) => ({ id: fragment.id })) })),
      provenance: createProvenance(session.fragments, { runId }),
    }, disclosureReceipt, { tab: executionTab }).catch(() => {});
    throw new Error(`GO stopped before all candidates completed. Your capture and action stack were preserved for retry. ${error.message}`);
  } finally {
    runs.delete(runId);
  }
}

async function handle(message, sender = {}) {
  const { type, payload } = message;
  const session = await readSession();
  if (type === "get-session") return session;
  if (type === "pearl-state-get") {
    const local = await BrowserPlatform.storage.get("local", [
      "semanticOrbs", "activeSemanticOrbId", "pearlPageCanvases", "resultPearls", "pearlSoundscapes",
    ]);
    return {
      semanticOrbs: local.semanticOrbs || [],
      activeSemanticOrbId: local.activeSemanticOrbId || null,
      pageCanvases: local.pearlPageCanvases || {},
      resultPearls: local.resultPearls || {},
      pearlSoundscapes: local.pearlSoundscapes || {},
    };
  }
  if (type === "page-canvas-get") {
    const state = await canvasStore();
    const pearlId = String(payload.pearlId || state.activeSemanticOrbId || "");
    if (!pearlId) return { canvas: null };
    const pageIdentity = assertPageIdentity(payload.pageIdentity, sender);
    return { canvas: state.pageCanvases[pearlCanvasKey(pearlId, pageIdentity)] || null };
  }
  if (type === "result-pearl-get") {
    const state = await resultStore();
    const pageIdentity = assertPageIdentity(payload.pageIdentity, sender);
    return {
      results: Object.values(state.resultPearls).filter((entry) =>
        entry.pageIdentity === pageIdentity && (!state.activeSemanticOrbId || entry.pearlId === state.activeSemanticOrbId)
      ),
    };
  }
  if (type === "page-canvas-command") {
    return executeCanvasCommand(payload.command, payload.args || {}, sender);
  }
  if (type === "page-canvas-blob-store") {
    if (!/^data:image\/[a-z0-9.+-]+;base64,/i.test(String(payload.dataUrl || ""))) throw new Error("invalid local canvas image");
    const bytes = await fetch(payload.dataUrl).then((response) => response.arrayBuffer());
    return storeProfileImage({ bytes, mime: payload.mime });
  }
  if (type === "page-canvas-blob-read") {
    const image = await readProfileImage(payload.blobRef);
    const bytes = new Uint8Array(image.bytes);
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 32_768) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 32_768));
    }
    return { mime: image.mime, byteLength: image.byteLength, dataUrl: `data:${image.mime};base64,${btoa(binary)}` };
  }
  if (type === "page-canvas-blob-delete") {
    return deleteProfileImage(payload.blobRef);
  }
  if (type === "page-canvas-export-pdf") return sendPage("page-canvas-export-pdf", payload);
  if (type === "output-routing-answer") {
    const state = await resultStore();
    const object = payload.resultId === "latest"
      ? Object.values(state.resultPearls).filter((entry) => !entry.archived).sort((a, b) => b.updatedAt - a.updatedAt)[0]
      : state.resultPearls[payload.resultId];
    if (!object) throw new Error("result Pearl not found");
    const answer = String(payload.answer || "").trim();
    if (/^(?:cancel|never ?mind|stop)$/i.test(answer)) {
      return executeResultCommand("cancelOutputPlacement", { resultId: object.id }, sender);
    }
    if (/^(?:no|not that|somewhere else)$/i.test(answer)) {
      const reset = await executeResultCommand("requestOutputPlacement", { resultId: object.id, branches: object.routing?.branches }, sender);
      await writeSession({ pendingOutputRouting: { resultIds: [object.id], activeResultId: object.id, stage: "choosing", question: reset.object.question, updatedAt: Date.now() } });
      return reset;
    }
    const observed = payload.observation && Object.keys(payload.observation).length
      ? payload.observation
      : (await sendPage("output-routing-observe", { targetTabId: payload.targetTabId }).catch(() => null))?.observation || {};
    const live = {
      ...observed,
      tabId: Number.isInteger(payload.targetTabId) ? payload.targetTabId : observed.tabId,
      frameId: Number.isInteger(payload.frameId) ? payload.frameId : observed.frameId,
    };
    const interpreted = await executeResultCommand("interpretOutputPlacement", {
      resultId: object.id,
      answer,
      observation: live,
      branchIds: payload.branchIds || [],
    }, sender);
    const routing = interpreted.object;
    await writeSession({
      pendingOutputRouting: {
        resultIds: [object.id],
        activeResultId: object.id,
        stage: routing.stage,
        question: routing.stage === "confirming" ? routing.plan.summary : routing.clarification,
        updatedAt: Date.now(),
      },
    });
    return interpreted;
  }
  if (type === "output-routing-confirm") {
    const state = await resultStore();
    const target = state.resultPearls[payload.resultId]?.routing?.plan?.destination;
    const live = await sendPage("output-routing-observe", { targetTabId: target?.tabId }).catch(() => null);
    const confirmed = await executeResultCommand("confirmOutputPlacement", {
      resultId: payload.resultId,
      targetRevision: payload.targetRevision ?? live?.observation?.targetRevision,
    }, sender);
    if (confirmed.object.stage !== "confirmed") return confirmed;
    return executeConfirmedOutputPlacement(payload.resultId, sender);
  }
  if (type === "output-routing-revise") {
    const state = await resultStore();
    const object = state.resultPearls[payload.resultId];
    if (!object) throw new Error("result Pearl not found");
    return executeResultCommand("requestOutputPlacement", { resultId: object.id, branches: object.routing?.branches }, sender);
  }
  if (type === "output-routing-cancel") return executeResultCommand("cancelOutputPlacement", { resultId: payload.resultId }, sender);
  if (type === "result-pearl-command") return executeResultCommand(payload.command, {
    resultId: payload.resultId,
    ...(payload.destination ? { destination: payload.destination } : {}),
  }, sender);
  if (type === "result-pearl-open-tab" || type === "result-pearl-open-studio") {
    const state = await resultStore();
    const object = payload.resultId === "latest"
      ? Object.values(state.resultPearls).filter((entry) => !entry.archived).sort((a, b) => b.updatedAt - a.updatedAt)[0]
      : state.resultPearls[payload.resultId];
    if (!object) throw new Error("result Pearl not found");
    const redirected = await executeDomainCommand("openResultPearlInTab", state, {
      resultId: object.id,
    }, { persist: persistResultState });
    let tab;
    try {
      const handoff = await createBoundHandoff("resultPearlHandoffs", {
        origin: new URL(chrome.runtime.getURL("result.html")).origin,
        scope: "result-tab",
        payload: { result: object, studio: type === "result-pearl-open-studio" },
      });
      tab = handoff.tab;
      await BrowserPlatform.tabs.update(tab.id, { url: chrome.runtime.getURL(`result.html#handoff=${handoff.nonce}`) });
    } catch {
      await executeDomainCommand("undoResultPearl", redirected.state, { resultId: object.id }, { persist: persistResultState }).catch(() => {});
      throw new Error("the browser blocked the result tab; the margin Pearl is preserved");
    }
    return { ...redirected.result, opened: true };
  }
  if (type === "pearl-open-studio") {
    const stored = await BrowserPlatform.storage.get("local", null);
    const pearlStore = stored[PEARL_STORE_KEY] || migrateLegacyPearlState(stored);
    const pearlId = payload.pearlId || pearlStore.activePearlId || stored.activeSemanticOrbId;
    const entity = pearlStore.entities?.[pearlId];
    if (!entity) throw new Error("make or activate a Pearl before opening Studio");
    if (entity.permissions?.lockState === "locked") throw new Error("unlock this Pearl before opening Studio");
    const handoff = await createBoundHandoff("resultPearlHandoffs", {
      origin: new URL(chrome.runtime.getURL("result.html")).origin,
      scope: "result-tab",
      payload: { result: entity, studio: true },
    });
    await BrowserPlatform.tabs.update(handoff.tab.id, { url: chrome.runtime.getURL(`result.html#handoff=${handoff.nonce}`) });
    return { type: "pearl-studio-open", pearlId: entity.id, opened: true };
  }
  if (type === "result-pearl-open-web") {
    const state = await resultStore();
    const object = payload.resultId === "latest"
      ? Object.values(state.resultPearls).filter((entry) => !entry.archived).sort((a, b) => b.updatedAt - a.updatedAt)[0]
      : state.resultPearls[payload.resultId];
    if (!object) throw new Error("result Pearl not found");
    const handoff = await createBoundHandoff("webResultHandoffs", {
      origin: "https://representation-eta.vercel.app",
      scope: "result-web",
      payload: { type: "pearl-result-handoff", resultPearl: object },
    });
    await BrowserPlatform.tabs.update(handoff.tab.id, {
      url: `https://representation-eta.vercel.app/#handoff=result-pearl&token=${handoff.nonce}`,
    });
    return { type: "result-pearl-web-handoff", resultId: object.id };
  }
  if (type === "result-pearl-create-region") {
    const state = await resultStore();
    const object = payload.resultId === "latest"
      ? Object.values(state.resultPearls).filter((entry) => !entry.archived).sort((a, b) => b.updatedAt - a.updatedAt)[0]
      : state.resultPearls[payload.resultId];
    if (!object) throw new Error("result Pearl not found");
    const tab = await activeTab();
    await ensureBridge(tab);
    const layout = await BrowserPlatform.tabs.sendMessage(tab.id, createMessage("result-pearl-layout-request", {
      sourceRefs: object.sourceRefs,
      count: 1,
    }));
    const anchor = layout?.anchor || { x: 24, y: 80, width: 1, height: 1 };
    const viewport = layout?.viewport || { width: 1200, height: 800, scrollX: 0, scrollY: 0 };
    const box = {
      x: viewport.scrollX + Math.max(12, Math.min(viewport.width - 344, anchor.x)),
      y: viewport.scrollY + Math.max(12, Math.min(viewport.height - 214, anchor.y + anchor.height + 16)),
      width: Math.min(320, viewport.width - 24),
      height: Math.min(190, viewport.height - 24),
    };
    await executeCanvasCommand("activatePearlPageCanvas", {
      pearlId: object.pearlId,
      pageIdentity: object.pageIdentity,
    }, {});
    await executeCanvasCommand("setPearlCanvasInputMode", {
      pearlId: object.pearlId,
      pageIdentity: object.pageIdentity,
      mode: "select-type",
    }, {});
    return executeResultCommand("createResultPlacementRegion", {
      resultId: object.id,
      pearlId: object.pearlId,
      pageIdentity: object.pageIdentity,
      box,
      coordinateSpace: "document",
      kind: "companion-region",
    }, {});
  }
  if (type === "result-pearl-redeem") {
    const nonce = String(payload.nonce || "");
    if (!/^[a-f0-9]{32}$/i.test(nonce)) throw new Error("invalid result handoff");
    const profileHash = await BrowserPlatform.storage.profileHash();
    return consumeBoundHandoff("resultPearlHandoffs", nonce, {
      profileHash,
      tabId: sender.tab?.id,
      origin: new URL(sender.url || chrome.runtime.getURL("result.html")).origin,
      scope: "result-tab",
    });
  }
  if (type === "result-pearl-cancel") {
    const state = await resultStore();
    const object = state.resultPearls[payload.resultId];
    if (!object) throw new Error("result Pearl not found");
    runs.get(object.execution?.runId)?.abort();
    return executeResultCommand("setResultPearlStatus", {
      resultId: object.id,
      status: "failed",
      failure: { code: "CANCELED", recoverable: true },
    }, sender);
  }
  if (type === "result-pearl-retry") {
    const state = await resultStore();
    const object = state.resultPearls[payload.resultId];
    if (!object?.failure?.recoverable) throw new Error("this result cannot be retried");
    await executeResultCommand("setResultPearlStatus", { resultId: object.id, status: "streaming" }, sender);
    return executeGo({ runId: object.execution?.runId, idempotencyKey: `${object.execution?.idempotencyKey}:retry` });
  }
  if (type === "page-canvas-create-textbox") {
    const pendingResults = await resultStore();
    const pendingResult = Object.values(pendingResults.resultPearls)
      .filter((entry) => ["canvas-textbox", "canvas-region", "companion-region"].includes(entry.destination?.type))
      .sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (pendingResult) {
      return executeResultCommand("createResultPlacementRegion", {
        resultId: pendingResult.id,
        pearlId: pendingResult.pearlId,
        pageIdentity: pendingResult.pageIdentity,
        box: payload.box,
        coordinateSpace: payload.coordinateSpace,
        kind: pendingResult.destination.type,
      }, sender);
    }
    const latest = session.results.at(-1)?.outputs?.at(-1);
    const artifact = {
      id: String(payload.id || `canvas-text:${message.requestId}`).slice(0, 220),
      type: latest ? "output" : "text",
      text: latest?.text || "",
      box: payload.box,
      coordinateSpace: payload.coordinateSpace,
      provenance: latest?.provenance || { kind: "explicit-text-placement", local: true },
    };
    const command = latest ? "placePearlCanvasOutput" : "createPearlCanvasArtifact";
    return executeCanvasCommand(command, {
      pearlId: payload.pearlId,
      pageIdentity: payload.pageIdentity,
      artifact,
      ...(latest ? { destination: { type: "canvas-textbox", targetId: artifact.id, scope: "selected-output" } } : {}),
    }, sender);
  }
  if (type === "pearl-audio-search") {
    const provider = audioProviders.get(payload.provider || "internet-archive");
    if (!provider) throw new Error("audio provider is not configured");
    await executeSoundscapeCommand("searchPearlAudioCatalog", payload.pearlId, {
      query: payload.query,
      provider: provider.id,
    });
    return { provider: provider.id, tracks: await provider.search(payload.query, { limit: payload.limit }) };
  }
  if (type === "pearl-audio-upload") {
    const stored = await storePearlAudio({ bytes: payload.bytes, mime: payload.mime });
    const track = normalizePearlTrack({
      source: "local",
      id: `local:${stored.contentHash}`,
      title: String(payload.title || "Local audio").slice(0, 240),
      artist: String(payload.artist || "You").slice(0, 240),
      ...stored,
      license: {
        terms: "User-provided local audio. Pearl does not infer redistribution rights.",
        streamAllowed: true,
        offlineAllowed: true,
        redistributionAllowed: false,
      },
      provenance: { kind: "explicit-local-audio-upload", importedAt: Date.now() },
    });
    return executeSoundscapeCommand("addPearlSoundscapeTrack", payload.pearlId, { track });
  }
  if (type === "pearl-audio-add") {
    let track = normalizePearlTrack(payload.track);
    const provider = track.provider && audioProviders.get(track.provider);
    if (provider?.resolve) track = await provider.resolve(track);
    return executeSoundscapeCommand("addPearlSoundscapeTrack", payload.pearlId, { track });
  }
  if (type === "pearl-audio-control") {
    const action = payload.action;
    if (!["play", "pause", "stop", "volume"].includes(action)) throw new Error("unsupported Pearl audio control");
    if (action === "volume") {
      const updated = await executeSoundscapeCommand("updatePearlSoundscape", payload.pearlId, {
        patch: { volume: payload.volume, muted: payload.muted, shuffle: payload.shuffle, loop: payload.loop },
      });
      await ensureAudioDocument();
      await chrome.runtime.sendMessage(createMessage("pearl-audio-control", { action: "volume", soundscape: updated.soundscape }));
      return updated;
    }
    const transitioned = await executeSoundscapeCommand("transitionPearlSoundscape", payload.pearlId, {
      action,
      userGesture: payload.userGesture === true,
    });
    const track = transitioned.soundscape.tracks.find((entry) => entry.id === transitioned.soundscape.activeTrackId);
    if (action === "play" && transitioned.soundscape.playback === "blocked") return transitioned;
    await ensureAudioDocument();
    let bytes;
    if (action === "play" && track?.localBlobRef) bytes = (await readPearlAudio(track.localBlobRef)).bytes;
    const playback = await chrome.runtime.sendMessage(createMessage("pearl-audio-control", {
      action,
      soundscape: transitioned.soundscape,
      track,
      bytes,
      userGesture: payload.userGesture === true,
    }));
    if (playback?.error) throw new Error(playback.error);
    return { ...transitioned, playback };
  }
  if (type === "pearl-audio-save-offline") {
    const state = await soundscapeStore();
    const pearlId = String(payload.pearlId || state.activeSemanticOrbId || "");
    const soundscape = state.pearlSoundscapes[pearlId];
    const track = soundscape?.tracks?.find((entry) => entry.id === payload.trackId);
    if (!track || !pearlTrackAllowsOffline(track) || !track.downloadUrl) throw new Error("this track license does not permit offline saving");
    if (payload.confirmed !== true) throw new Error("confirm this licensed track before saving it offline");
    const response = await fetch(track.downloadUrl, { credentials: "omit", redirect: "follow" });
    if (!response.ok) throw new Error("licensed track download is unavailable");
    const announced = Number(response.headers.get("content-length") || 0);
    if (announced > 100 * 1024 * 1024) throw new Error("licensed track exceeds the offline size limit");
    const stored = await storePearlAudio({ bytes: await response.arrayBuffer(), mime: track.mime || response.headers.get("content-type")?.split(";")[0] || "audio/mpeg" });
    return executeSoundscapeCommand("cachePearlTrackOffline", pearlId, { trackId: track.id, ...stored });
  }
  if (type === "pearl-audio-delete") {
    if (payload.confirmed !== true) throw new Error("confirm removal of this Pearl audio track");
    const state = await soundscapeStore();
    const pearlId = String(payload.pearlId || state.activeSemanticOrbId || "");
    const track = state.pearlSoundscapes[pearlId]?.tracks?.find((entry) => entry.id === payload.trackId);
    const removed = await executeSoundscapeCommand("removePearlSoundscapeTrack", pearlId, { trackId: payload.trackId });
    if (track?.localBlobRef) await deletePearlAudio(track.localBlobRef);
    return removed;
  }
  if (type === "pearl-audio-status") {
    if (!payload.pearlId) return { recorded: false };
    const action = payload.status === "playing" ? "play" : payload.status === "blocked" ? "pause" : "stop";
    return executeSoundscapeCommand("transitionPearlSoundscape", payload.pearlId, { action, userGesture: payload.status === "playing" });
  }
  if (type === "make-pearl") {
    const material = payload.material || session.fragments.at(-1);
    if (!material && !payload.name) throw new Error("capture page material before making a pearl");
    const stored = await BrowserPlatform.storage.get("local", ["semanticOrbs", "activeSemanticOrbId"]);
    const idempotencyKey = String(payload.idempotencyKey || crypto.randomUUID());
    const id = String(payload.id || `external-pearl:${idempotencyKey}`).slice(0, 180);
    const execution = await executeDomainCommand("createSemanticOrb", {
      semanticOrbs: stored.semanticOrbs || [],
      activeSemanticOrbId: stored.activeSemanticOrbId || null,
    }, {
      sceneId: "extension-captures",
      material,
      orb: { id, name: payload.name || undefined },
      placement: payload.placement || { x: 0, y: 0 },
      activate: true,
    }, {
      idFactory: () => id,
      persist: async (state) => BrowserPlatform.storage.set("local", {
        semanticOrbs: state.semanticOrbs,
        activeSemanticOrbId: state.activeSemanticOrbId,
      }),
    });
    return {
      ...execution.result,
      semanticOrbs: execution.state.semanticOrbs,
      activeSemanticOrbId: execution.state.activeSemanticOrbId,
      pearl: execution.result.object || execution.state.semanticOrbs.find((entry) => entry.id === id),
    };
  }
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
    if (String(payload.intent || "").trim()) {
      await BrowserPlatform.storage.set("local", {
        pendingPearlIntent: {
          text: String(payload.intent).trim().slice(0, 4000),
          id: `page-intent:${Date.now()}`,
          createdAt: Date.now(),
        },
      });
    }
    await globalThis.chrome.sidePanel?.open?.({ windowId: tab.windowId });
    return { opened: true, tabId: tab.id };
  }
  if (type === "model-catalog") return apiRequest("/api/models", { method: "GET" });
  if (type === "adaptive-companion-plan") {
    if (!payload.request || typeof payload.request !== "object" || Array.isArray(payload.request)) {
      throw new Error("adaptive planning request is invalid");
    }
    if ("authorization" in payload.request || "accessToken" in payload.request || "token" in payload.request) {
      throw new Error("adaptive planning credentials must stay in the authenticated API client");
    }
    return apiRequest("/api/run", { method: "POST", body: payload.request });
  }
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
    const local = await BrowserPlatform.storage.get("local", [
      "cognitiveWorkflowHandoff",
      "cognitivePullRequestHandoff",
      "semanticOrbs",
      "activeSemanticOrbId",
    ]);
    const approvedPayload = {
      type: "pearl-workspace-handoff",
      handoff: {
        surface: String(payload.surface || "workspace").slice(0, 80),
        view: String(payload.tab || "integrate").slice(0, 80),
        createdAt: Date.now(),
        approvedBy: "explicit-extension-command",
      },
      semanticOrbs: (local.semanticOrbs || []).filter((orb) => !orb.archived).slice(0, 80),
      activeSemanticOrbId: local.activeSemanticOrbId || null,
      session: {
        fragments: (session.fragments || []).slice(0, 80),
        queue: (session.queue || []).slice(0, 40),
        generator: session.generator || null,
        results: (session.results || []).slice(-20),
      },
      proposal: local.cognitivePullRequestHandoff || local.cognitiveWorkflowHandoff || null,
    };
    const handoff = await createBoundHandoff("webWorkspaceHandoffs", {
      origin: "https://representation-eta.vercel.app",
      scope: "workspace-web",
      payload: approvedPayload,
    });
    await BrowserPlatform.tabs.update(handoff.tab.id, {
      url: `https://representation-eta.vercel.app/#handoff=${encodeURIComponent(approvedPayload.handoff.surface)}&view=${encodeURIComponent(approvedPayload.handoff.view)}&token=${handoff.nonce}`,
    });
    return {
      type: "cognitive-workflow-handoff",
      preserved: true,
      route: { surface: approvedPayload.handoff.surface, view: approvedPayload.handoff.view },
    };
  }
  if (type === "open-cognitive-pull-request") {
    if (!session.fragments.length) throw new Error("select explicit page material before opening an extraction proposal");
    const proposal = { kinds: payload.kinds, fragments: session.fragments.slice(0, 80), captureScope: "explicit-selection", createdAt: Date.now() };
    const handoff = await createBoundHandoff("webWorkspaceHandoffs", {
      origin: "https://representation-eta.vercel.app",
      scope: "workspace-web",
      payload: {
        type: "pearl-workspace-handoff",
        handoff: { surface: "cognitive-pull-request", view: "pull-request", createdAt: Date.now(), approvedBy: "explicit-extension-command" },
        semanticOrbs: [],
        activeSemanticOrbId: null,
        session: { fragments: proposal.fragments, queue: [], generator: null, results: [] },
        proposal,
      },
    });
    await BrowserPlatform.tabs.update(handoff.tab.id, {
      url: `https://representation-eta.vercel.app/#handoff=cognitive-pull-request&view=pull-request&token=${handoff.nonce}`,
    });
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
  if (type === "pearl-power-fx" || type === "pearl-seek-to" || type === "pearl-find-matching" || type === "pearl-effect-animation" || type === "pearl-aesthetic-apply" || type === "pearl-worn-orbit") {
    return sendPage(type, payload);
  }
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
  if (type === "pearl-entity-get") {
    const stored = await BrowserPlatform.storage.get("local", [PEARL_STORE_KEY]);
    const entity = stored[PEARL_STORE_KEY]?.entities?.[payload.pearlId];
    if (!entity) throw new Error("canonical Pearl not found");
    return { entity };
  }
  if (type === "pearl-action") {
    assertServerVerifiedPearlCommand(payload.event?.command, payload.event?.args);
    const stored = await BrowserPlatform.storage.get("local", null);
    const pearlStore = stored[PEARL_STORE_KEY] || migrateLegacyPearlState(stored);
    const entity = pearlStore.entities?.[payload.event?.pearlId];
    if (!entity) throw new Error("canonical Pearl not found");
    const executed = await executePearlActionEvent({
      entity,
      state: { ...stored, pearlEntities: pearlStore.entities },
      event: payload.event,
    });
    const executedEntities = executed.state?.pearlEntities || pearlStore.entities;
    const migratedEffects = migrateLegacyPearlState(executed.state || {});
    const { pearlEntities: _entities, [PEARL_STORE_KEY]: _nestedStore, ...profileState } = executed.state || {};
    await BrowserPlatform.storage.set("local", {
      ...profileState,
      [PEARL_STORE_KEY]: {
        ...pearlStore,
        entities: { ...pearlStore.entities, ...migratedEffects.entities, ...executedEntities, [entity.id]: executed.entity },
        updatedAt: Date.now(),
      },
    });
    await sendPage("pearl-effect-animation", {
      pearlId: entity.id,
      animation: executed.animation,
      effectReceiptId: executed.effectReceipt?.id,
    }).catch(() => {});
    if (executed.powerFx || executed.animation) {
      await sendPage("pearl-power-fx", {
        pearlId: entity.id,
        ...(executed.powerFx || {}),
        kind: executed.powerFx?.kind || executed.animation?.power || executed.animation?.semantic,
        count: executed.powerFx?.count || executed.domainResult?.workers?.length || executed.domainResult?.objects?.length,
      }).catch(() => {});
    }
    if (payload.event?.command === "setPearlAesthetic" || executed.entity?.aesthetic) {
      await sendPage("pearl-aesthetic-apply", {
        pearlId: entity.id,
        aesthetic: executed.entity?.aesthetic || executed.domainResult?.object?.aesthetic || executed.state?.companionAesthetic,
      }).catch(() => {});
    }
    return {
      pearlId: entity.id,
      revision: executed.entity.revision,
      effectReceipt: executed.effectReceipt,
      animation: executed.animation,
      powerFx: executed.powerFx || null,
      observation: executed.observation,
      domainResult: executed.domainResult,
      replay: executed.replay,
      conflict: executed.conflict,
    };
  }
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
  if (type === "result-action") throw new Error("direct result mutation is blocked; confirm a typed PlacementPlan");
  if (type === "auth-status") return authStatus();
  if (type === "auth-login") {
    for (const run of runs.values()) run.abort();
    runs.clear();
    await clearAllSession();
    await clearDecryptedPageSurfaces();
    await login();
    const library = await readLocalLibrary();
    return {
      authenticated: true,
      library,
      counts: { lenses: library.operators.length, generators: library.generators.length },
    };
  }
  if (type === "auth-logout") {
    for (const run of runs.values()) run.abort();
    runs.clear();
    await clearAllSession();
    await clearDecryptedPageSurfaces();
    return logout();
  }
  if (type === "privacy-policy-get") {
    let state = await privacyPolicyStore();
    const pearlId = payload.pearlId || state.activeSemanticOrbId || "pearl:extension-default";
    if (!state.pearlPrivacyPolicies[pearlId]) {
      const ensured = await executeDomainCommand("ensurePearlPrivacyPolicy", state, { pearlId }, { persist: persistPrivacyPolicyState });
      state = ensured.state;
    }
    const inspected = await executeDomainCommand("inspectPearlPrivacy", state, {
      pearlId,
      actor: payload.actor || {},
    });
    return { policy: state.pearlPrivacyPolicies[pearlId], observation: inspected.result.object };
  }
  if (type === "privacy-policy-propose") {
    const state = await privacyPolicyStore();
    const pearlId = payload.pearlId || state.activeSemanticOrbId || "pearl:extension-default";
    return (await executeDomainCommand("proposePearlPrivacyPatch", state, {
      pearlId,
      patch: payload.patch,
      expectedVersion: payload.expectedVersion,
    }, { persist: persistPrivacyPolicyState })).result;
  }
  if (type === "privacy-policy-apply") {
    const state = await privacyPolicyStore();
    const pearlId = payload.pearlId || state.activeSemanticOrbId || "pearl:extension-default";
    return (await executeDomainCommand("applyPearlPrivacyPatch", state, {
      pearlId,
      proposalId: payload.proposalId,
      confirmed: payload.confirmed === true,
    }, { persist: persistPrivacyPolicyState })).result;
  }
  if (type === "privacy-lock") {
    for (const run of runs.values()) run.abort();
    runs.clear();
    await clearAllSession();
    await clearDecryptedPageSurfaces();
    return BrowserPlatform.storage.lock(payload.secret);
  }
  if (type === "privacy-unlock") {
    return BrowserPlatform.storage.unlock(payload.secret);
  }
  if (type === "privacy-delete-local") {
    if (payload.confirmed !== true) throw new Error("confirmed local deletion is required");
    for (const run of runs.values()) run.abort();
    runs.clear();
    const profileHash = await BrowserPlatform.storage.profileHash();
    await clearAllSession();
    await clearDecryptedPageSurfaces();
    const [audioDeleted, imagesDeleted] = await Promise.all([
      deleteProfileAudio(profileHash),
      deleteProfileImages(profileHash),
    ]);
    const receipt = await BrowserPlatform.storage.deleteLocal();
    return {
      ...receipt,
      audioDeleted,
      imagesDeleted,
      completed: true,
    };
  }
  if (type === "library-refresh") {
    const local = await readLocalLibrary();
    const consent = await BrowserPlatform.storage.get("local", ["pearlSyncConsent"]);
    if (payload.sync !== true || consent.pearlSyncConsent !== "enabled") return local;
    try {
      const remote = await apiRequest("/api/extension/library");
      const remoteCount = (remote.operators?.length || 0) + (remote.generators?.length || 0);
      const localCount = local.operators.length + local.generators.length;
      if (remoteCount && localCount && payload.adoption !== "merge") {
        return {
          ...local,
          requiresAdoption: true,
          adoption: { localCount, accountCount: remoteCount, choices: ["merge", "keep-local"] },
        };
      }
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
    const consent = await BrowserPlatform.storage.get("local", ["pearlSyncConsent"]);
    if (consent.pearlSyncConsent === "enabled" && payload.sync === true) try {
      await apiRequest("/api/extension/library", {
        method: "POST",
        body: { operators: imported.operators, generators: imported.generators, rack: imported.rack },
        idempotencyKey: payload.bundle?.integrity?.payloadHash,
      });
    } catch {
      // Local import remains authoritative; explicit sync may be retried later.
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

const PRIVILEGED_EXTENSION_MESSAGE_TYPES = new Set([
  "pearl-action",
  "adaptive-companion-plan",
  "privacy-policy-propose",
  "privacy-policy-apply",
  "privacy-lock",
  "privacy-unlock",
  "privacy-delete-local",
  "auth-logout",
]);

globalThis.chrome?.runtime?.onMessage.addListener((raw, sender, respond) => {
  try {
    assertTrustedSender(sender, globalThis.chrome.runtime.id);
    const validated = validateMessage(raw);
    if (!validated.ok) throw new Error(validated.error);
    if (!validated.value.requestId) throw new Error("request ID required");
    if (PRIVILEGED_EXTENSION_MESSAGE_TYPES.has(validated.value.type)) assertPrivilegedExtensionSurface(sender, globalThis.chrome.runtime.id);
    const replayKey = `${sender.id || "extension"}:${sender.tab?.id || "view"}:${validated.value.requestId}`;
    let pending = handledRequests.get(replayKey);
    if (!pending) {
      pending = handle(validated.value, sender)
        .then((value) => ({ ok: true, value }), (error) => ({ ok: false, error: String(error?.message || "request failed").slice(0, 300) }));
      handledRequests.set(replayKey, pending);
      if (handledRequests.size > 2_000) handledRequests.delete(handledRequests.keys().next().value);
    }
    pending.then(respond);
  } catch (error) {
    respond({ ok: false, error: String(error?.message || "request rejected").slice(0, 300) });
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
      const action = validateExternalAction(raw, sender);
      const profileHash = await BrowserPlatform.storage.profileHash();
      return consumeBoundHandoff("webWorkspaceHandoffs", action.nonce, {
        profileHash,
        tabId: sender.tab?.id,
        origin: action.origin,
        scope: "workspace-web",
      });
    }
    if (raw?.type === "pearl-result-handoff") {
      const action = validateExternalAction(raw, sender);
      const profileHash = await BrowserPlatform.storage.profileHash();
      return consumeBoundHandoff("webResultHandoffs", action.nonce, {
        profileHash,
        tabId: sender.tab?.id,
        origin: action.origin,
        scope: "result-web",
      });
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

/**
 * Companion pearl job pack — durable Cursor-for-pearls identity.
 *
 * Always inject into harness / planner / GO grounding alongside:
 *   - pearl-companion-context (active pearl M/W/L)
 *   - per-turn app understanding snapshot (screen, gauntlet, reef, studio)
 *
 * Companion is the agent harness for pearls the way Cursor is for codebases.
 * Never append user task text into systemPrompt.
 */

import {
  buildPearlCompanionContext,
  formatPearlCompanionContextForModel,
} from "./pearl-companion-context.js";

export const COMPANION_PEARL_JOB_VERSION = 1;

const bounded = (value, limit = 120) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, limit);
const softList = (values, limit = 40) => (Array.isArray(values) ? values : [])
  .map((entry) => bounded(entry, 80))
  .filter(Boolean)
  .slice(0, limit);

/**
 * Durable Companion identity — what the app is, what a pearl is, what the job is.
 * Model-facing; keep stable across turns.
 */
export const COMPANION_PEARL_JOB_PACK = Object.freeze(`# Companion job — Cursor for pearls

You are Companion (Mother Pearl): the always-on agent harness for the Pearl shell.
Your job mirrors Cursor for a codebase — understand the world, choose tools, execute natural language, leave world-visible results. You are not a chat that rewrites brains by dumping tasks into prompts.

## What the app is
- **Companion** — Talk → type/speak → GO. No mode picker. Action-first; demonstrate with the ghost cursor when meaningful.
- **Reef** — home shelf of all pearls (visible titled capsules). Create/wear/open from here.
- **Gauntlet** — up to 5 worn pearls as working memory (sockets). Sixth wear refuses clearly; never silently bump.
- **Studio** — open one pearl; system prompt is the hero readable field; Moves · Weights · Lenses are the structure.
- **Scene / Encode / Install / Packages / Settings** — other primary shell surfaces; navigate when asked.

## What a pearl is
A pearl is a persistent structured brain:
- **Moves** — procedural: how work is done (ordered steps; present function-of-moves storage as Moves)
- **Weights** — evaluative: preferences, judgements, tradeoffs
- **Lenses** — perspective: bounded ways of seeing
- **systemPrompt** — readable **projection / summary** of those layers only — never the dump of chat, goals, or execution requests

Canonical fidelity is Moves · Weights · Lenses. Edit layers (or project the prompt from them). Do not treat systemPrompt as a scratchpad.

## Your job
1. Observe app snapshot + pearl companion context every turn.
2. Classify: **mutate_brain** vs **operate** (see tool chooser).
3. Propose a real tool / director verb (or a precise blocker).
4. Apply and reveal a world-visible titled result (Reef / gauntlet / Studio / download) — chat alone is not success.
5. Trail: Working → Interpreting → Proposed → Applied / Blocked.

## Tool chooser (load-bearing)
| Class | Means | Tools |
| --- | --- | --- |
| **mutate_brain** | Change pearl structure / projection | create pearl, interpretPearlPrompt, edit layers/weights/lenses, project systemPrompt |
| **operate** | Use pearls without rewriting them | comparePearls, summarize layers, produce PDF/md, ask-about, wear/navigate |

**Hard rule:** compare / differences / PDF / export / summarize-without-edit / ask-about → **operate**. Never call editPearlSystemPrompt for those.
**Hard rule:** Never append user task text into systemPrompt (no “Source request” / “User refinement” dumps).
**Hard rule:** create / more like / rewrite taste / edit Moves·Weights·Lenses → **mutate_brain** via harness — update layers, then project systemPrompt.
Offline structured work succeeds signed-out; AI enrich is optional when signed in. Never fake Done. Never invent success.`);

/** Alias for callers that want a function. */
export function formatCompanionPearlJobPack() {
  return COMPANION_PEARL_JOB_PACK;
}

/** Back-compat aliases used by prompt harness / cursor harness. */
export function formatCompanionPearlJobForModel(options = {}) {
  const extra = String(options.extra || "").trim();
  return extra ? `${COMPANION_PEARL_JOB_PACK}\n\n${extra}` : COMPANION_PEARL_JOB_PACK;
}

export function companionPearlJobSummary() {
  return "Cursor for pearls: execute create/edit/wear/compare/produce via tools on Moves·Weights·Lenses — never dump user tasks into systemPrompt.";
}

/** Alias matching older snapshot helper name. */
export function buildPearlAppSnapshot(options = {}) {
  return buildCompanionAppSnapshot({
    path: options.path,
    hash: options.hash,
    currentScreen: options.screen || options.currentScreen,
    studioOpen: options.studioOpen,
    sceneName: options.sceneName,
    sceneId: options.sceneId,
    activePearl: options.activePearl,
    openPearl: options.activePearl
      ? { name: options.activePearl.name, id: options.activePearl.id }
      : options.openPearl,
    gauntletPearls: options.gauntletPearls,
    gauntletTitles: options.gauntletTitles
      || (options.gauntletPearls || []).map((p) => p?.name).filter(Boolean),
    primaryPearlId: options.primaryPearlId,
    pearls: options.reefPearls || options.pearls,
    reefPearlNames: options.reefPearlNames
      || (options.reefPearls || []).map((p) => p?.name).filter(Boolean),
    wornCount: options.wornCount,
    gauntletCapacity: options.gauntletCapacity,
  });
}

export function formatPearlAppSnapshotForModel(snapshot, options = {}) {
  return formatCompanionAppSnapshotForModel(snapshot, options);
}

/** Map classifyPearlCompanionClass → Cursor tool class label. */
export function toolClassFromPearlClassification(classification = {}) {
  const cls = String(classification.class || classification.toolClass || "other");
  if (cls === "operate" || cls === "mutate_brain") return cls;
  return "other";
}

/**
 * Infer primary shell screen id from path / studio / emission hints.
 */
export function inferCompanionScreen(input = {}) {
  if (input.studioOpen === true || input.hash === "#pearl-studio" || /\bpearl-studio\b/i.test(String(input.hash || ""))) {
    return "studio";
  }
  if (input.currentScreen) return bounded(input.currentScreen, 40);
  if (input.sceneOpen === true || input.sceneRoute === true) return "scene";
  if (input.emittedView) return bounded(input.emittedView, 40);
  const path = String(input.path || "/").replace(/\/+$/, "") || "/";
  if (path === "/install") return "install";
  if (path === "/settings") return "settings";
  if (path === "/packages") return "packages";
  if (path === "/library" || path === "/toolbox") return path.slice(1);
  if (path === "/") return "reef";
  return "reef";
}

/**
 * Per-turn app understanding snapshot — Pearl-world awareness for Companion.
 * Like Cursor's codebase awareness, but for shell + pearls.
 */
export function buildCompanionAppSnapshot(input = {}) {
  const currentScreen = inferCompanionScreen(input);
  const openPearlName = bounded(
    input.openPearl?.name
    || input.openPearlName
    || input.activePearl?.name
    || "",
    120,
  ) || null;
  const openPearlId = String(
    input.openPearl?.id
    || input.openPearlId
    || input.activePearl?.id
    || "",
  ).trim() || null;
  const gauntletTitles = softList(
    input.gauntletTitles
    || input.wornPearlNames
    || (input.gauntletPearls || []).map((pearl) => pearl?.name || pearl),
    5,
  );
  const reefPearlNames = softList(
    input.reefPearlNames
    || input.pearlNames
    || (input.pearls || []).map((pearl) => pearl?.name || pearl),
    40,
  );
  const studioOpen = Boolean(
    input.studioOpen === true
    || currentScreen === "studio"
    || input.hash === "#pearl-studio",
  );
  const studioPearlName = bounded(
    input.studioPearlName
    || (studioOpen ? openPearlName : ""),
    120,
  ) || null;
  const sceneName = bounded(input.sceneName || "", 120) || null;
  const sceneId = String(input.sceneId || "").trim() || null;
  const wornCount = Number.isFinite(input.wornCount)
    ? input.wornCount
    : gauntletTitles.length;
  const gauntletCapacity = Number.isFinite(input.gauntletCapacity)
    ? input.gauntletCapacity
    : 5;

  const openPearl = openPearlName
    ? { name: openPearlName, id: openPearlId }
    : null;
  return {
    version: COMPANION_PEARL_JOB_VERSION,
    job: "Cursor for pearls",
    currentScreen,
    openPearl,
    gauntletTitles,
    reefPearlNames,
    studioOpen,
    studioPearlName,
    sceneName,
    sceneId,
    wornCount,
    gauntletCapacity,
    // Nested aliases (planner / tests / cursor harness)
    shell: {
      screen: currentScreen,
      studioOpen,
      sceneName,
    },
    activePearl: openPearl
      ? {
        name: openPearl.name,
        id: openPearl.id,
        hasSystemPrompt: Boolean(input.activePearl?.systemPrompt),
      }
      : null,
    gauntlet: {
      capacity: gauntletCapacity,
      filled: wornCount,
      sockets: gauntletTitles.map((name) => ({ name })),
    },
    reef: {
      count: reefPearlNames.length,
      pearls: reefPearlNames.map((name) => ({ name })),
    },
    summary: [
      `screen:${currentScreen}`,
      openPearlName ? `open:“${openPearlName}”` : "open:none",
      `gauntlet:${wornCount}/${gauntletCapacity}${gauntletTitles.length ? ` [${gauntletTitles.join(" · ")}]` : ""}`,
      `reef:${reefPearlNames.length}`,
      studioOpen ? `studio:${studioPearlName || "open"}` : "studio:closed",
      sceneName ? `scene:“${sceneName}”` : null,
    ].filter(Boolean).join(" · "),
  };
}

/**
 * Model-facing app snapshot block.
 */
export function formatCompanionAppSnapshotForModel(snapshot, options = {}) {
  const snap = snapshot && typeof snapshot === "object"
    ? snapshot
    : buildCompanionAppSnapshot(snapshot || {});
  const nameLimit = Number.isFinite(options.nameLimit) ? options.nameLimit : 24;
  const currentScreen = snap.currentScreen || snap.shell?.screen || "reef";
  const openName = snap.openPearl?.name || snap.activePearl?.name || null;
  const studioOpen = snap.studioOpen === true || snap.shell?.studioOpen === true || currentScreen === "studio";
  const studioPearlName = snap.studioPearlName || (studioOpen ? openName : null);
  const sceneName = snap.sceneName || snap.shell?.sceneName || null;
  const gauntletTitles = softList(
    snap.gauntletTitles
    || (snap.gauntlet?.sockets || []).map((socket) => socket?.name || socket),
    5,
  );
  const reefPearlNames = softList(
    snap.reefPearlNames
    || (snap.reef?.pearls || []).map((pearl) => pearl?.name || pearl),
    40,
  );
  const wornCount = Number.isFinite(snap.wornCount)
    ? snap.wornCount
    : (Number.isFinite(snap.gauntlet?.filled) ? snap.gauntlet.filled : gauntletTitles.length);
  const gauntletCapacity = Number.isFinite(snap.gauntletCapacity)
    ? snap.gauntletCapacity
    : (Number.isFinite(snap.gauntlet?.capacity) ? snap.gauntlet.capacity : 5);
  const reef = reefPearlNames.slice(0, nameLimit);
  const lines = [
    "Pearl app world — App understanding snapshot (this turn):",
    `Current screen: ${currentScreen}`,
    openName
      ? `Open / active pearl: “${openName}”`
      : "Open / active pearl: none",
    `Gauntlet (${wornCount}/${gauntletCapacity}): ${
      gauntletTitles.length
        ? gauntletTitles.map((name) => `“${name}”`).join(" · ")
        : "empty"
    }`,
    `Reef pearls (${reefPearlNames.length}): ${
      reef.length ? reef.map((name) => `“${name}”`).join(" · ") : "none yet"
    }${reefPearlNames.length > nameLimit ? "…" : ""}`,
    studioOpen
      ? `Studio: open${studioPearlName ? ` — “${studioPearlName}”` : ""}`
      : "Studio: closed",
    sceneName ? `Scene: ${sceneName}` : null,
    "Use this snapshot to choose tools. Prefer named pearls from gauntlet/reef over inventing titles.",
  ];
  return lines.filter(Boolean).join("\n");
}

/**
 * Combined grounding: job pack + app snapshot + optional pearl companion context.
 */
export function buildCompanionGrounding({
  appSnapshot = null,
  pearl = null,
  pearlContext = null,
  appState = {},
} = {}) {
  const hasSnapshot = appSnapshot
    && typeof appSnapshot === "object"
    && (appSnapshot.currentScreen || appSnapshot.shell?.screen || Array.isArray(appSnapshot.reefPearlNames) || appSnapshot.reef);
  const snapshot = hasSnapshot
    ? {
      ...buildCompanionAppSnapshot({
        currentScreen: appSnapshot.currentScreen || appSnapshot.shell?.screen,
        studioOpen: appSnapshot.studioOpen ?? appSnapshot.shell?.studioOpen,
        sceneName: appSnapshot.sceneName || appSnapshot.shell?.sceneName,
        openPearl: appSnapshot.openPearl || appSnapshot.activePearl || null,
        gauntletTitles: appSnapshot.gauntletTitles
          || (appSnapshot.gauntlet?.sockets || []).map((s) => s?.name || s).filter(Boolean),
        reefPearlNames: appSnapshot.reefPearlNames
          || (appSnapshot.reef?.pearls || []).map((p) => p?.name || p).filter(Boolean),
        wornCount: appSnapshot.wornCount ?? appSnapshot.gauntlet?.filled,
        gauntletCapacity: appSnapshot.gauntletCapacity ?? appSnapshot.gauntlet?.capacity,
      }),
      ...appSnapshot,
      currentScreen: appSnapshot.currentScreen || appSnapshot.shell?.screen || "reef",
    }
    : buildCompanionAppSnapshot({
      ...appState,
      ...(appSnapshot && typeof appSnapshot === "object" ? appSnapshot : {}),
      activePearl: pearl || appState.activePearl || null,
      openPearl: appState.openPearl || (pearl ? { name: pearl.name, id: pearl.id } : null),
    });
  const context = pearlContext
    || (pearl ? buildPearlCompanionContext(pearl, appState) : null);

  return {
    version: COMPANION_PEARL_JOB_VERSION,
    jobPack: COMPANION_PEARL_JOB_PACK,
    appSnapshot: snapshot,
    pearlContext: context,
  };
}

/**
 * Full model-facing grounding string for harness / planner injection.
 */
export function formatCompanionGroundingForModel(grounding, options = {}) {
  const pack = grounding?.jobPack || COMPANION_PEARL_JOB_PACK;
  const snapText = formatCompanionAppSnapshotForModel(
    grounding?.appSnapshot || buildCompanionAppSnapshot({}),
    options,
  );
  const includePearl = options.includePearlContext !== false;
  const pearlText = includePearl && grounding?.pearlContext
    ? formatPearlCompanionContextForModel(grounding.pearlContext, {
      promptLimit: Number.isFinite(options.promptLimit) ? options.promptLimit : 2_400,
    })
    : null;
  return [pack, snapText, pearlText].filter(Boolean).join("\n\n");
}

/**
 * Attach grounding onto a route / proposal object (non-destructive).
 */
export function attachCompanionGrounding(target, groundingInput = {}) {
  const grounding = groundingInput?.jobPack
    ? groundingInput
    : buildCompanionGrounding(groundingInput);
  if (!target || typeof target !== "object") {
    return { grounding };
  }
  return {
    ...target,
    grounding,
    appSnapshot: grounding.appSnapshot,
  };
}

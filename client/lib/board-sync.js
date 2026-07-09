import { useEffect, useRef } from "react";
import { getSupabase } from "./supabase.js";
import {
  PATTERN_LENSES_KEY,
  TRANSFORMATION_REPOS_KEY,
  ACTIVE_TRANSFORMATION_KEY,
} from "../../shared/object-types.js";

// Cloud board sync: mirrors lens.* board keys to Supabase for signed-in users.
// localStorage remains the offline cache; cloud is the cross-device source of truth.

export const BOARD_SYNC_VERSION = 1;
export const BOARD_SYNC_META_KEY = "lens.board.sync-meta.v1";

const ITEMS_KEY = "lens.board.items.v1";
const PAGES_KEY = "lens.board.pages.v1";
const DOC_TITLE_KEY = "lens.doc.title.v1";
const DOC_STAR_KEY = "lens.doc.star.v1";
const THEME_KEY = "lens.theme.v1";
const CAMERA_KEY = "lens.board.camera.v1";
const OPERATORS_KEY = "lens.board.operators.v2";
export const AI_NODES_KEY = "lens.ai.nodes.v1";
const ITEM_HISTORY_KEY = "lens.item.history.v1";

export const BOARD_SYNC_STORAGE_KEYS = [
  ITEMS_KEY,
  PAGES_KEY,
  DOC_TITLE_KEY,
  DOC_STAR_KEY,
  THEME_KEY,
  CAMERA_KEY,
  OPERATORS_KEY,
  PATTERN_LENSES_KEY,
  TRANSFORMATION_REPOS_KEY,
  ACTIVE_TRANSFORMATION_KEY,
  AI_NODES_KEY,
  ITEM_HISTORY_KEY,
];

/** Keys whose values are arrays of {id}-bearing records, mergeable by id. */
const ID_ARRAY_KEYS = [
  ITEMS_KEY,
  PAGES_KEY,
  OPERATORS_KEY,
  PATTERN_LENSES_KEY,
  TRANSFORMATION_REPOS_KEY,
  AI_NODES_KEY,
];

function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* ignore quota / privacy mode */
  }
}

/**
 * @returns {{ version: number, savedAt: string, keys: Record<string, string> }}
 */
export function readLocalBoardSnapshot() {
  const keys = {};
  for (const key of BOARD_SYNC_STORAGE_KEYS) {
    const raw = safeGet(key);
    if (raw != null) keys[key] = raw;
  }
  let savedAt = new Date().toISOString();
  try {
    const meta = JSON.parse(safeGet(BOARD_SYNC_META_KEY) || "null");
    if (meta?.savedAt) savedAt = meta.savedAt;
  } catch {
    /* use now */
  }
  return { version: BOARD_SYNC_VERSION, savedAt, keys };
}

/**
 * @param {{ version?: number, savedAt?: string, keys?: Record<string, string> }} snapshot
 */
export function writeLocalBoardSnapshot(snapshot) {
  const keys = snapshot?.keys || {};
  for (const key of BOARD_SYNC_STORAGE_KEYS) {
    if (key in keys) safeSet(key, keys[key]);
  }
  safeSet(
    BOARD_SYNC_META_KEY,
    JSON.stringify({
      savedAt: snapshot?.savedAt || new Date().toISOString(),
      version: snapshot?.version || BOARD_SYNC_VERSION,
      ownerId: getLocalBoardOwner(),
    })
  );
}

/** Which account the local board already belongs to (null = anonymous work). */
export function getLocalBoardOwner() {
  try {
    const meta = JSON.parse(safeGet(BOARD_SYNC_META_KEY) || "null");
    return meta?.ownerId || null;
  } catch {
    return null;
  }
}

export function setLocalBoardOwner(userId) {
  let meta = {};
  try {
    meta = JSON.parse(safeGet(BOARD_SYNC_META_KEY) || "null") || {};
  } catch {
    meta = {};
  }
  safeSet(
    BOARD_SYNC_META_KEY,
    JSON.stringify({
      savedAt: meta.savedAt || new Date().toISOString(),
      version: meta.version || BOARD_SYNC_VERSION,
      ownerId: userId || null,
    })
  );
}

/**
 * @param {string | undefined} a
 * @param {string | undefined} b
 * @returns {'local' | 'remote' | 'equal'}
 */
export function compareSnapshotTimestamps(a, b) {
  const ta = Date.parse(a || "");
  const tb = Date.parse(b || "");
  if (!Number.isFinite(ta) && !Number.isFinite(tb)) return "equal";
  if (!Number.isFinite(tb) || (Number.isFinite(ta) && ta > tb)) return "local";
  if (!Number.isFinite(ta) || tb > ta) return "remote";
  return "equal";
}

/**
 * @param {{ keys?: Record<string, string> }} snapshot
 */
export function parseBoardSnapshot(snapshot) {
  const keys = snapshot?.keys || {};
  function parseJson(key, fallback) {
    try {
      const raw = keys[key];
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }
  return {
    items: parseJson(ITEMS_KEY, []),
    pages: parseJson(PAGES_KEY, null),
    docTitle: parseJson(DOC_TITLE_KEY, "Untitled Idea"),
    docStarred: parseJson(DOC_STAR_KEY, false),
    theme: parseJson(THEME_KEY, "idea"),
    camera: parseJson(CAMERA_KEY, { x: 0, y: 0, scale: 1 }),
    operators: parseJson(OPERATORS_KEY, null),
    lenses: parseJson(PATTERN_LENSES_KEY, []),
    transformationRepos: parseJson(TRANSFORMATION_REPOS_KEY, []),
    activeTransformationId: parseJson(ACTIVE_TRANSFORMATION_KEY, null),
    aiNodes: parseJson(AI_NODES_KEY, []),
    itemHistory: parseJson(ITEM_HISTORY_KEY, {}),
  };
}

/** Whether a snapshot holds meaningful anonymous work worth protecting. */
export function snapshotHasContent(snapshot) {
  const parsed = parseBoardSnapshot(snapshot);
  return (
    (parsed.items?.length || 0) > 0 ||
    (parsed.lenses?.length || 0) > 0 ||
    (parsed.transformationRepos?.length || 0) > 0 ||
    (parsed.aiNodes?.length || 0) > 0
  );
}

/**
 * Merge anonymous local work into an account snapshot: id-bearing arrays merge
 * with local records winning on id conflicts; scalar keys prefer local
 * (what the user is looking at right now); item history merges per item.
 */
export function mergeBoardSnapshots(local, remote) {
  const keys = { ...(remote?.keys || {}) };
  const localKeys = local?.keys || {};

  for (const key of BOARD_SYNC_STORAGE_KEYS) {
    if (!(key in localKeys)) continue;
    if (!(key in keys)) {
      keys[key] = localKeys[key];
      continue;
    }
    if (ID_ARRAY_KEYS.includes(key)) {
      try {
        const remoteArr = JSON.parse(keys[key]);
        const localArr = JSON.parse(localKeys[key]);
        if (Array.isArray(remoteArr) && Array.isArray(localArr)) {
          const byId = new Map();
          for (const rec of remoteArr) if (rec?.id) byId.set(rec.id, rec);
          for (const rec of localArr) if (rec?.id) byId.set(rec.id, rec);
          keys[key] = JSON.stringify([...byId.values()]);
          continue;
        }
      } catch {
        /* fall through to local-wins */
      }
      keys[key] = localKeys[key];
    } else if (key === ITEM_HISTORY_KEY) {
      try {
        const remoteLog = JSON.parse(keys[key]) || {};
        const localLog = JSON.parse(localKeys[key]) || {};
        keys[key] = JSON.stringify({ ...remoteLog, ...localLog });
      } catch {
        keys[key] = localKeys[key];
      }
    } else {
      keys[key] = localKeys[key];
    }
  }

  return { version: BOARD_SYNC_VERSION, savedAt: new Date().toISOString(), keys };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 */
export async function fetchCloudBoardSnapshot(supabase, userId) {
  const { data, error } = await supabase
    .from("board_snapshots")
    .select("data, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.data) return null;
  return {
    ...data.data,
    savedAt: data.data.savedAt || data.updated_at,
  };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @param {{ version: number, savedAt: string, keys: Record<string, string> }} snapshot
 */
export async function pushCloudBoardSnapshot(supabase, userId, snapshot) {
  const payload = {
    version: snapshot.version,
    savedAt: snapshot.savedAt,
    keys: snapshot.keys,
  };
  const { error } = await supabase.from("board_snapshots").upsert(
    {
      user_id: userId,
      data: payload,
      updated_at: snapshot.savedAt,
    },
    { onConflict: "user_id" }
  );
  if (error) throw error;
}

/**
 * @param {{ session: import('@supabase/supabase-js').Session | null, sessionResolved: boolean, onHydrate?: (parsed: ReturnType<typeof parseBoardSnapshot>) => void, onSynced?: () => void, onConflict?: (opts: { local: any, remote: any, resolve: (choice: 'remote'|'merge'|'local') => Promise<void> }) => void, dirtyToken?: unknown }} opts
 */
export function useBoardCloudSync({
  session,
  sessionResolved,
  onHydrate,
  onSynced,
  onConflict,
  dirtyToken,
}) {
  const syncGenRef = useRef(0);
  const saveTimerRef = useRef(null);
  const hydratedUserRef = useRef(null);
  const dirtyRef = useRef(false);
  const firstDirtyRef = useRef(true);

  // Stamp local edits even while signed out — otherwise anonymous work looks
  // older than any cloud snapshot and gets silently replaced on login.
  useEffect(() => {
    if (firstDirtyRef.current) {
      firstDirtyRef.current = false;
      return;
    }
    dirtyRef.current = true;
    safeSet(
      BOARD_SYNC_META_KEY,
      JSON.stringify({
        savedAt: new Date().toISOString(),
        version: BOARD_SYNC_VERSION,
        ownerId: getLocalBoardOwner(),
      })
    );
  }, [dirtyToken]);

  useEffect(() => {
    if (!sessionResolved || !session?.user?.id) {
      hydratedUserRef.current = null;
      return;
    }
    const userId = session.user.id;
    if (hydratedUserRef.current === userId) return;

    let cancelled = false;
    const gen = ++syncGenRef.current;

    (async () => {
      const supabase = getSupabase();
      if (!supabase || cancelled || gen !== syncGenRef.current) return;

      try {
        const local = readLocalBoardSnapshot();
        const remote = await fetchCloudBoardSnapshot(supabase, userId);
        if (cancelled || gen !== syncGenRef.current) return;

        if (!remote) {
          const stamped = { ...local, savedAt: new Date().toISOString() };
          writeLocalBoardSnapshot(stamped);
          setLocalBoardOwner(userId);
          await pushCloudBoardSnapshot(supabase, userId, stamped);
          hydratedUserRef.current = userId;
          onSynced?.();
          return;
        }

        const winner = compareSnapshotTimestamps(local.savedAt, remote.savedAt);

        // Ask only when the local board is genuinely foreign to this account
        // (anonymous work or another user's). A board this account already
        // adopted just syncs newest-wins — no popup on every open.
        const localOwner = getLocalBoardOwner();
        if (
          winner !== "equal" &&
          onConflict &&
          localOwner !== userId &&
          snapshotHasContent(local) &&
          snapshotHasContent(remote)
        ) {
          onConflict({
            local,
            remote,
            resolve: async (choice) => {
              try {
                if (choice === "remote") {
                  writeLocalBoardSnapshot(remote);
                  onHydrate?.(parseBoardSnapshot(remote));
                } else {
                  const merged =
                    choice === "merge"
                      ? mergeBoardSnapshots(local, remote)
                      : { ...local, savedAt: new Date().toISOString() };
                  writeLocalBoardSnapshot(merged);
                  onHydrate?.(parseBoardSnapshot(merged));
                  await pushCloudBoardSnapshot(supabase, userId, merged);
                }
                setLocalBoardOwner(userId);
                hydratedUserRef.current = userId;
                onSynced?.();
              } catch (err) {
                console.warn("[lens] board conflict resolution failed:", err);
              }
            },
          });
          return;
        }

        if (winner === "remote") {
          writeLocalBoardSnapshot(remote);
          setLocalBoardOwner(userId);
          onHydrate?.(parseBoardSnapshot(remote));
          hydratedUserRef.current = userId;
          onSynced?.();
        } else if (winner === "local") {
          const stamped = { ...local, savedAt: new Date().toISOString() };
          writeLocalBoardSnapshot(stamped);
          setLocalBoardOwner(userId);
          await pushCloudBoardSnapshot(supabase, userId, stamped);
          hydratedUserRef.current = userId;
          onSynced?.();
        } else {
          setLocalBoardOwner(userId);
          hydratedUserRef.current = userId;
        }
      } catch (err) {
        console.warn("[lens] board cloud sync failed:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, sessionResolved, onHydrate, onSynced, onConflict]);

  useEffect(() => {
    if (!sessionResolved || !session?.user?.id || !hydratedUserRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const supabase = getSupabase();
      if (!supabase) return;
      try {
        const stamped = {
          ...readLocalBoardSnapshot(),
          savedAt: new Date().toISOString(),
        };
        writeLocalBoardSnapshot(stamped);
        await pushCloudBoardSnapshot(supabase, session.user.id, stamped);
        dirtyRef.current = false;
        onSynced?.();
      } catch (err) {
        console.warn("[lens] board cloud save failed:", err);
      }
    }, 2500);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [dirtyToken, session?.user?.id, sessionResolved, onSynced]);

  // Flush pending changes when the tab is backgrounded or closed so quick
  // edits right before leaving aren't lost to the debounce window.
  useEffect(() => {
    if (!sessionResolved || !session?.user?.id) return undefined;
    const userId = session.user.id;
    const flush = () => {
      if (!hydratedUserRef.current || !dirtyRef.current) return;
      const supabase = getSupabase();
      if (!supabase) return;
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      const stamped = { ...readLocalBoardSnapshot(), savedAt: new Date().toISOString() };
      writeLocalBoardSnapshot(stamped);
      dirtyRef.current = false;
      pushCloudBoardSnapshot(supabase, userId, stamped).catch(() => {});
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [session?.user?.id, sessionResolved]);
}

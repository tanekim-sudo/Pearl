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
  };
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
 * @param {{ session: import('@supabase/supabase-js').Session | null, sessionResolved: boolean, onHydrate?: (parsed: ReturnType<typeof parseBoardSnapshot>) => void, onSynced?: () => void, dirtyToken?: unknown }} opts
 */
export function useBoardCloudSync({
  session,
  sessionResolved,
  onHydrate,
  onSynced,
  dirtyToken,
}) {
  const syncGenRef = useRef(0);
  const saveTimerRef = useRef(null);
  const hydratedUserRef = useRef(null);

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
          await pushCloudBoardSnapshot(supabase, userId, stamped);
          hydratedUserRef.current = userId;
          onSynced?.();
          return;
        }

        const winner = compareSnapshotTimestamps(local.savedAt, remote.savedAt);
        if (winner === "remote") {
          writeLocalBoardSnapshot(remote);
          onHydrate?.(parseBoardSnapshot(remote));
          hydratedUserRef.current = userId;
          onSynced?.();
        } else if (winner === "local") {
          const stamped = { ...local, savedAt: new Date().toISOString() };
          writeLocalBoardSnapshot(stamped);
          await pushCloudBoardSnapshot(supabase, userId, stamped);
          hydratedUserRef.current = userId;
          onSynced?.();
        } else {
          hydratedUserRef.current = userId;
        }
      } catch (err) {
        console.warn("[lens] board cloud sync failed:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, sessionResolved, onHydrate, onSynced]);

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
        onSynced?.();
      } catch (err) {
        console.warn("[lens] board cloud save failed:", err);
      }
    }, 2500);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [dirtyToken, session?.user?.id, sessionResolved, onSynced]);
}

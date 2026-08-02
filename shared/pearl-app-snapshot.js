/**
 * Thin re-export — canonical app snapshot lives in companion-pearl-job.js
 * (Cursor-for-pearls app understanding).
 */
export {
  buildCompanionAppSnapshot,
  buildPearlAppSnapshot,
  formatCompanionAppSnapshotForModel,
  formatPearlAppSnapshotForModel,
  inferCompanionScreen,
  COMPANION_PEARL_JOB_VERSION as PEARL_APP_SNAPSHOT_VERSION,
} from "./companion-pearl-job.js";

export const PEARL_SOUNDSCAPE_VERSION = 1;
export const PEARL_TRACK_VERSION = 1;
export const PEARL_AUDIO_MAX_BYTES = 100 * 1024 * 1024;
export const PEARL_AUDIO_MIME_TYPES = Object.freeze([
  "audio/mpeg",
  "audio/mp4",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "audio/flac",
]);
export const PROCEDURAL_SOUNDSCAPES = Object.freeze([
  { id: "procedural:rain", title: "Rain ambience", kind: "rain-noise" },
  { id: "procedural:room", title: "Soft room tone", kind: "room-tone" },
  { id: "procedural:brown", title: "Low noise", kind: "brown-noise" },
]);

const clone = (value) => structuredClone(value);
const bounded = (value, length = 500) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, length);
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function validatePearlAudioSignature(bytes, mime = "") {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  if (!PEARL_AUDIO_MIME_TYPES.includes(String(mime).toLowerCase())) throw new Error("unsupported audio codec");
  if (!data.length || data.length > PEARL_AUDIO_MAX_BYTES) throw new Error(data.length ? "local audio exceeds the 100 MB limit" : "audio file is empty");
  const ascii = (start, length) => String.fromCharCode(...data.slice(start, start + length));
  const valid = ascii(0, 3) === "ID3"
    || (data[0] === 0xff && (data[1] & 0xe0) === 0xe0)
    || (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WAVE")
    || ascii(0, 4) === "OggS"
    || ascii(0, 4) === "fLaC"
    || ascii(4, 4) === "ftyp"
    || ascii(0, 4) === "\u001aEß£";
  if (!valid) throw new Error("audio signature does not match a supported codec");
  return true;
}

export function normalizePearlTrack(value = {}) {
  const source = ["local", "provider", "procedural"].includes(value.source) ? value.source : "local";
  const rights = {
    spdx: bounded(value.license?.spdx, 80) || null,
    terms: bounded(value.license?.terms, 500) || null,
    termsUrl: bounded(value.license?.termsUrl, 2_000) || null,
    attributionText: bounded(value.license?.attributionText, 1_000) || null,
    attributionUrl: bounded(value.license?.attributionUrl, 2_000) || null,
    streamAllowed: value.license?.streamAllowed === true,
    offlineAllowed: value.license?.offlineAllowed === true,
    redistributionAllowed: value.license?.redistributionAllowed === true,
  };
  if (source === "provider" && (!value.provider || !value.externalId || !rights.termsUrl || !rights.streamAllowed)) {
    throw new Error("provider track rights are incomplete");
  }
  if (source === "local" && (!value.localBlobRef || !value.contentHash)) throw new Error("local audio requires an integrity-checked blob reference");
  if (source === "procedural" && !PROCEDURAL_SOUNDSCAPES.some((entry) => entry.id === value.externalId)) {
    throw new Error("unsupported procedural soundscape");
  }
  return {
    version: PEARL_TRACK_VERSION,
    id: bounded(value.id || `${source}:${value.provider || "user"}:${value.externalId || value.contentHash}`, 300),
    source,
    provider: source === "provider" ? bounded(value.provider, 120) : null,
    externalId: bounded(value.externalId, 300) || null,
    title: bounded(value.title || "Untitled audio", 240),
    artist: bounded(value.artist, 240) || null,
    album: bounded(value.album, 240) || null,
    artworkUrl: source === "provider" ? bounded(value.artworkUrl, 2_000) || null : null,
    license: rights,
    streamUrl: source === "provider" && rights.streamAllowed ? bounded(value.streamUrl, 4_000) || null : null,
    downloadUrl: source === "provider" && rights.offlineAllowed ? bounded(value.downloadUrl, 4_000) || null : null,
    localBlobRef: source === "local" || value.localBlobRef ? bounded(value.localBlobRef, 300) : null,
    contentHash: bounded(value.contentHash, 128) || null,
    mime: bounded(value.mime, 80) || null,
    byteLength: Math.max(0, finite(value.byteLength)),
    duration: Math.max(0, finite(value.duration)),
    provenance: clone(value.provenance || { kind: `${source}-audio`, capturedAt: Date.now() }),
    addedAt: Math.max(0, finite(value.addedAt, Date.now())),
  };
}

export function emptyPearlSoundscape(pearlId) {
  return {
    version: PEARL_SOUNDSCAPE_VERSION,
    pearlId: bounded(pearlId, 180),
    tracks: [],
    playlist: [],
    activeTrackId: null,
    playback: "stopped",
    volume: .55,
    muted: false,
    loop: true,
    shuffle: false,
    crossfadeMs: 1200,
    fadeInMs: 900,
    fadeOutMs: 900,
    autoplay: "gesture-required",
    autoplayConsentAt: null,
    activation: { onPearlActivation: false },
    revision: 0,
    updatedAt: Date.now(),
    provenance: { kind: "local-pearl-soundscape", version: PEARL_SOUNDSCAPE_VERSION },
  };
}

export function normalizePearlSoundscape(value = {}) {
  const base = emptyPearlSoundscape(value.pearlId);
  const tracks = (value.tracks || []).slice(0, 500).map(normalizePearlTrack);
  const ids = new Set(tracks.map((track) => track.id));
  return {
    ...base,
    ...clone(value),
    version: PEARL_SOUNDSCAPE_VERSION,
    pearlId: bounded(value.pearlId, 180),
    tracks,
    playlist: [...new Set(value.playlist || [])].filter((entry) => ids.has(entry)),
    activeTrackId: ids.has(value.activeTrackId) ? value.activeTrackId : null,
    playback: ["stopped", "playing", "paused", "blocked", "loading", "error"].includes(value.playback) ? value.playback : "stopped",
    volume: Math.max(0, Math.min(1, finite(value.volume, .55))),
    muted: Boolean(value.muted),
    loop: value.loop !== false,
    shuffle: Boolean(value.shuffle),
    crossfadeMs: Math.max(0, Math.min(10_000, finite(value.crossfadeMs, 1200))),
    fadeInMs: Math.max(0, Math.min(10_000, finite(value.fadeInMs, 900))),
    fadeOutMs: Math.max(0, Math.min(10_000, finite(value.fadeOutMs, 900))),
    autoplay: value.autoplay === "consented" ? "consented" : "gesture-required",
    activation: { onPearlActivation: value.activation?.onPearlActivation === true },
    revision: Math.max(0, finite(value.revision)),
    updatedAt: Math.max(0, finite(value.updatedAt, Date.now())),
  };
}

function change(state, patch) {
  const current = normalizePearlSoundscape(state);
  return normalizePearlSoundscape({ ...current, ...patch, revision: current.revision + 1, updatedAt: Date.now() });
}

export function addPearlTrack(state, value) {
  const current = normalizePearlSoundscape(state);
  const track = normalizePearlTrack(value);
  const duplicate = current.tracks.find((entry) =>
    (track.contentHash && entry.contentHash === track.contentHash)
    || (track.provider && entry.provider === track.provider && entry.externalId === track.externalId)
  );
  if (duplicate) return { soundscape: current, track: duplicate, duplicate: true };
  return {
    soundscape: change(current, {
      tracks: [...current.tracks, track],
      playlist: [...current.playlist, track.id],
      activeTrackId: current.activeTrackId || track.id,
    }),
    track,
    duplicate: false,
  };
}

export function removePearlTrack(state, trackId) {
  const current = normalizePearlSoundscape(state);
  const tracks = current.tracks.filter((entry) => entry.id !== trackId);
  const playlist = current.playlist.filter((entry) => entry !== trackId);
  return change(current, {
    tracks,
    playlist,
    activeTrackId: current.activeTrackId === trackId ? playlist[0] || null : current.activeTrackId,
    playback: current.activeTrackId === trackId ? "stopped" : current.playback,
  });
}

export function setPearlActiveTrack(state, trackId) {
  const current = normalizePearlSoundscape(state);
  if (!current.tracks.some((entry) => entry.id === trackId)) throw new Error("Pearl track not found");
  return change(current, { activeTrackId: trackId });
}

export function updatePearlSoundscape(state, patch = {}) {
  return change(state, {
    ...(patch.volume != null ? { volume: patch.volume } : {}),
    ...(patch.muted != null ? { muted: patch.muted } : {}),
    ...(patch.loop != null ? { loop: patch.loop } : {}),
    ...(patch.shuffle != null ? { shuffle: patch.shuffle } : {}),
    ...(patch.crossfadeMs != null ? { crossfadeMs: patch.crossfadeMs } : {}),
    ...(patch.fadeInMs != null ? { fadeInMs: patch.fadeInMs } : {}),
    ...(patch.fadeOutMs != null ? { fadeOutMs: patch.fadeOutMs } : {}),
    ...(patch.activation ? { activation: patch.activation } : {}),
  });
}

export function transitionPearlSoundscape(state, action, options = {}) {
  const current = normalizePearlSoundscape(state);
  if (action === "play" && current.autoplay !== "consented" && options.userGesture !== true) {
    return change(current, { playback: "blocked" });
  }
  if (action === "play" && !current.activeTrackId) throw new Error("choose a track before playback");
  const playback = action === "play" ? "playing" : action === "pause" ? "paused" : "stopped";
  return change(current, {
    playback,
    ...(options.userGesture === true ? { autoplay: "consented", autoplayConsentAt: Date.now() } : {}),
  });
}

export function pearlTrackAllowsOffline(track) {
  const normalized = normalizePearlTrack(track);
  return normalized.source === "local"
    || normalized.source === "procedural"
    || (normalized.license.offlineAllowed && Boolean(normalized.downloadUrl));
}

export function soundscapeSwitchTransition(from, to) {
  const previous = from ? normalizePearlSoundscape(from) : null;
  const next = to ? normalizePearlSoundscape(to) : null;
  return {
    type: "pearl-soundscape-crossfade",
    fromPearlId: previous?.pearlId || null,
    toPearlId: next?.pearlId || null,
    durationMs: Math.max(previous?.fadeOutMs || 0, next?.crossfadeMs || next?.fadeInMs || 0),
    stopFrom: Boolean(previous?.activeTrackId),
    startTo: Boolean(next?.activeTrackId && next.activation.onPearlActivation),
  };
}

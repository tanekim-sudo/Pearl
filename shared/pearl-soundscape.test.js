import test from "node:test";
import assert from "node:assert/strict";
import {
  addPearlTrack,
  emptyPearlSoundscape,
  pearlTrackAllowsOffline,
  removePearlTrack,
  soundscapeSwitchTransition,
  transitionPearlSoundscape,
  updatePearlSoundscape,
  validatePearlAudioSignature,
} from "./pearl-soundscape.js";
import {
  createInternetArchiveAudioProvider,
  createProceduralAudioProvider,
  rightsFromLicenseUrl,
} from "./pearl-audio-providers.js";

const localTrack = {
  source: "local",
  id: "local:a",
  title: "My private track",
  localBlobRef: "blob:user-a:a",
  contentHash: "sha256-a",
  mime: "audio/mpeg",
  byteLength: 200,
  license: { terms: "User-owned local file", streamAllowed: true, offlineAllowed: true },
};

test("soundscapes remain distinct per Pearl and dedupe by content hash", () => {
  const left = addPearlTrack(emptyPearlSoundscape("pearl-a"), localTrack);
  const duplicate = addPearlTrack(left.soundscape, { ...localTrack, id: "local:b" });
  const right = emptyPearlSoundscape("pearl-b");
  assert.equal(left.soundscape.tracks.length, 1);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.soundscape.tracks.length, 1);
  assert.equal(right.tracks.length, 0);
});

test("playback respects gesture consent and switches deterministically", () => {
  let first = addPearlTrack(emptyPearlSoundscape("first"), localTrack).soundscape;
  first = updatePearlSoundscape(first, { activation: { onPearlActivation: true }, crossfadeMs: 1400 });
  const blocked = transitionPearlSoundscape(first, "play");
  assert.equal(blocked.playback, "blocked");
  const playing = transitionPearlSoundscape(blocked, "play", { userGesture: true });
  assert.equal(playing.playback, "playing");
  assert.equal(playing.autoplay, "consented");
  const second = addPearlTrack(emptyPearlSoundscape("second"), { ...localTrack, id: "local:second", contentHash: "sha256-second" }).soundscape;
  const transition = soundscapeSwitchTransition(playing, updatePearlSoundscape(second, { activation: { onPearlActivation: true } }));
  assert.deepEqual({ from: transition.fromPearlId, to: transition.toPearlId }, { from: "first", to: "second" });
  assert.ok(transition.durationMs >= 900);
});

test("offline saving fails closed when provider rights are unclear", () => {
  assert.equal(rightsFromLicenseUrl("https://creativecommons.org/publicdomain/zero/1.0/").offlineAllowed, true);
  assert.equal(rightsFromLicenseUrl("https://example.test/custom-license"), null);
  assert.throws(() => addPearlTrack(emptyPearlSoundscape("p"), {
    source: "provider",
    provider: "unknown",
    externalId: "x",
    title: "Unknown rights",
    license: { streamAllowed: true },
  }), /rights are incomplete/);
  const licensed = addPearlTrack(emptyPearlSoundscape("p"), {
    source: "provider",
    provider: "archive",
    externalId: "x",
    title: "Licensed",
    downloadUrl: "https://archive.org/file.mp3",
    license: {
      spdx: "CC0-1.0",
      termsUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
      streamAllowed: true,
      offlineAllowed: true,
    },
  }).track;
  assert.equal(pearlTrackAllowsOffline(licensed), true);
  assert.equal(removePearlTrack(addPearlTrack(emptyPearlSoundscape("p"), localTrack).soundscape, "local:a").tracks.length, 0);
});

test("local upload validation checks MIME, size, and file signature", () => {
  assert.equal(validatePearlAudioSignature(new Uint8Array([0x49, 0x44, 0x33, 1]), "audio/mpeg"), true);
  assert.throws(() => validatePearlAudioSignature(new Uint8Array([1, 2, 3]), "audio/mpeg"), /signature/);
  assert.throws(() => validatePearlAudioSignature(new Uint8Array([0x49, 0x44, 0x33]), "application/octet-stream"), /unsupported/);
});

test("provider search sends only the bounded query and filters unknown rights", async () => {
  let requested;
  const provider = createInternetArchiveAudioProvider({
    fetch: async (url) => {
      requested = String(url);
      return {
        ok: true,
        json: async () => ({ response: { docs: [
          { identifier: "lawful", title: "Lawful", creator: "Artist", licenseurl: "https://creativecommons.org/licenses/by/4.0/" },
          { identifier: "unclear", title: "Unclear", licenseurl: "https://example.test/terms" },
        ] } }),
      };
    },
  });
  const tracks = await provider.search("rain ambience");
  assert.equal(tracks.length, 1);
  assert.equal(tracks[0].externalId, "lawful");
  assert.match(requested, /rain\+ambience|rain%20ambience/);
  assert.doesNotMatch(requested, /pearl|context|private/i);
  assert.equal((await createProceduralAudioProvider().search("rain"))[0].source, "procedural");
});

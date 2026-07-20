import { PearlSoundscapeRuntime } from "../../../shared/pearl-soundscape-runtime.js";
import { createMessage } from "../core/messages.js";

const runtime = new PearlSoundscapeRuntime();

chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  if (message?.type !== "pearl-audio-control") return false;
  Promise.resolve().then(async () => {
    const { action, soundscape, track } = message;
    if (action === "play") {
      const result = await runtime.play(soundscape, track, {
        userGesture: message.userGesture === true,
        resolveSource: async () => {
          if (message.bytes) {
            const url = URL.createObjectURL(new Blob([message.bytes], { type: track.mime || "audio/mpeg" }));
            return { url, release: () => URL.revokeObjectURL(url) };
          }
          return { url: track.streamUrl };
        },
      });
      chrome.runtime.sendMessage(createMessage("pearl-audio-status", { status: "playing", pearlId: result.pearlId, trackId: result.trackId })).catch(() => {});
      return result;
    }
    if (action === "pause") return { paused: runtime.pause() };
    if (action === "resume") return { resumed: await runtime.resume() };
    if (action === "volume") return runtime.setVolume(soundscape.volume, soundscape.muted);
    if (action === "stop") return runtime.stop(soundscape.fadeOutMs);
    throw new Error("unsupported Pearl audio control");
  }).then(respond, (error) => {
    chrome.runtime.sendMessage(createMessage("pearl-audio-status", {
      status: /gesture|play\(\)/i.test(error.message) ? "blocked" : "error",
    })).catch(() => {});
    respond({ error: /gesture|play\(\)/i.test(error.message) ? "Playback needs a click, key press, or explicit voice command." : "Pearl audio could not play this source." });
  });
  return true;
});

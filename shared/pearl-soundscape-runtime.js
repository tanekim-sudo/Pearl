import { normalizePearlSoundscape, normalizePearlTrack } from "./pearl-soundscape.js";

function proceduralBuffer(context, kind, seconds = 8) {
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  let brown = 0;
  for (let index = 0; index < length; index += 1) {
    const white = Math.random() * 2 - 1;
    brown = (brown + .02 * white) / 1.02;
    const envelope = kind === "rain-noise"
      ? .55 + .25 * Math.sin(index / context.sampleRate * .37)
      : kind === "room-tone"
        ? .12
        : .36;
    data[index] = (kind === "rain-noise" ? white * .32 + brown * .28 : brown * 2.8) * envelope;
  }
  return buffer;
}

export class PearlSoundscapeRuntime {
  constructor(options = {}) {
    this.AudioContext = options.AudioContext || globalThis.AudioContext || globalThis.webkitAudioContext;
    this.createAudio = options.createAudio || ((url) => new Audio(url));
    this.now = options.now || (() => Date.now());
    this.context = null;
    this.master = null;
    this.channel = null;
    this.active = null;
  }

  ensureContext() {
    if (!this.AudioContext) throw new Error("Web Audio is unavailable in this browser");
    if (!this.context) {
      this.context = new this.AudioContext();
      this.master = this.context.createGain();
      this.master.connect(this.context.destination);
    }
    return this.context;
  }

  async play(soundscapeValue, trackValue, options = {}) {
    const soundscape = normalizePearlSoundscape(soundscapeValue);
    const track = normalizePearlTrack(trackValue);
    if (options.userGesture !== true && soundscape.autoplay !== "consented") {
      throw new Error("Playback needs a click, key press, or explicit voice command");
    }
    const context = this.ensureContext();
    if (context.state === "suspended") await context.resume();
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, context.currentTime);
    gain.connect(this.master);
    let source;
    let element = null;
    let release = options.release || (() => {});
    if (track.source === "procedural") {
      source = context.createBufferSource();
      source.buffer = proceduralBuffer(context, track.provenance?.generator || "room-tone");
      source.loop = true;
      source.connect(gain);
      source.start();
    } else {
      const resolved = await options.resolveSource?.(track);
      if (!resolved?.url) throw new Error(track.localBlobRef ? "local audio is missing" : "track stream is unavailable");
      element = this.createAudio(resolved.url);
      element.loop = soundscape.loop;
      element.preload = "auto";
      element.crossOrigin = track.source === "provider" ? "anonymous" : null;
      source = context.createMediaElementSource(element);
      source.connect(gain);
      release = resolved.release || release;
      await element.play();
    }
    const target = soundscape.muted ? 0 : soundscape.volume;
    gain.gain.linearRampToValueAtTime(target, context.currentTime + soundscape.fadeInMs / 1000);
    const previous = this.active;
    this.active = { source, element, gain, release, pearlId: soundscape.pearlId, trackId: track.id, startedAt: this.now() };
    this.channel = gain;
    if (previous) this.fadeAndStop(previous, soundscape.crossfadeMs);
    return { playing: true, pearlId: soundscape.pearlId, trackId: track.id, startedAt: this.active.startedAt };
  }

  setVolume(value, muted = false) {
    const volume = Math.max(0, Math.min(1, Number(value) || 0));
    if (!this.active || !this.context) return { volume, muted };
    this.active.gain.gain.cancelScheduledValues(this.context.currentTime);
    this.active.gain.gain.linearRampToValueAtTime(muted ? 0 : volume, this.context.currentTime + .08);
    return { volume, muted };
  }

  pause() {
    if (!this.active?.element) return false;
    this.active.element.pause();
    return true;
  }

  async resume() {
    if (!this.active?.element) return false;
    await this.active.element.play();
    return true;
  }

  fadeAndStop(channel, durationMs = 500) {
    if (!channel || !this.context) return;
    const stopAt = this.context.currentTime + Math.max(0, durationMs) / 1000;
    channel.gain.gain.cancelScheduledValues(this.context.currentTime);
    channel.gain.gain.linearRampToValueAtTime(0, stopAt);
    setTimeout(() => {
      try { channel.element?.pause(); } catch { /* already gone */ }
      try { channel.source?.stop?.(); } catch { /* media sources have no stop */ }
      try { channel.source?.disconnect?.(); } catch { /* already disconnected */ }
      try { channel.gain?.disconnect?.(); } catch { /* already disconnected */ }
      channel.release?.();
    }, Math.max(0, durationMs) + 40);
  }

  stop(durationMs = 500) {
    const current = this.active;
    this.active = null;
    this.channel = null;
    if (current) this.fadeAndStop(current, durationMs);
    return { stopped: Boolean(current) };
  }

  async destroy() {
    this.stop(0);
    await this.context?.close?.();
    this.context = null;
    this.master = null;
  }
}

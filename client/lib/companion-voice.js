import { companionRequestFingerprint, normalizeCompanionRequest } from "./companion-submit.js";

const DEFAULT_SILENCE_MS = 2600;

/**
 * Owns one logical utterance across recognition restarts. Browser callbacks
 * may replay result indexes or finals; only this object may consume/send it.
 */
export function createCompanionVoiceSession({
  generation,
  dispatch,
  updateDraft = () => {},
  silenceMs = DEFAULT_SILENCE_MS,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`,
} = {}) {
  const utteranceId = `voice-${generation}-${makeId()}`;
  const recognizers = new Set();
  const finals = [];
  let interim = "";
  let timer = null;
  let active = true;
  let consumed = false;
  let lastFinalFingerprint = "";

  const text = () => normalizeCompanionRequest([...finals, interim].filter(Boolean).join(" "));

  const arm = () => {
    if (timer) clearTimer(timer);
    if (!active || !text()) return;
    timer = setTimer(() => finish({ send: true, reason: "silence" }), silenceMs);
  };

  const ingest = (event, recognizerGeneration = 0) => {
    if (!active || recognizerGeneration !== generation) return false;
    let nextInterim = "";
    for (let i = event.resultIndex || 0; i < event.results.length; i += 1) {
      const result = event.results[i];
      const transcript = normalizeCompanionRequest(result?.[0]?.transcript);
      if (!transcript) continue;
      if (result.isFinal) {
        const fingerprint = companionRequestFingerprint(transcript);
        // Chrome/Safari can replay the same final on end/restart.
        if (fingerprint && fingerprint !== lastFinalFingerprint) {
          finals.push(transcript);
          lastFinalFingerprint = fingerprint;
        }
      } else {
        nextInterim = transcript;
      }
    }
    interim = nextInterim;
    updateDraft(text());
    arm();
    return true;
  };

  const registerRecognizer = (recognizer) => {
    if (!active || !recognizer) return false;
    recognizers.add(recognizer);
    return true;
  };

  function finish({ send = true } = {}) {
    if (!active && consumed) return false;
    active = false;
    if (timer) clearTimer(timer);
    timer = null;
    for (const recognizer of recognizers) {
      recognizer.onresult = null;
      recognizer.onerror = null;
      recognizer.onend = null;
      try {
        recognizer.stop();
      } catch {
        // Already stopped.
      }
    }
    recognizers.clear();
    const said = text();
    if (send && said && !consumed) {
      consumed = true;
      dispatch(said, {
        source: "voice",
        utteranceId,
        requestId: `request-${utteranceId}`,
        sessionGeneration: generation,
      });
    }
    return Boolean(said);
  }

  return {
    generation,
    utteranceId,
    ingest,
    registerRecognizer,
    finish,
    text,
    isActive: () => active,
    isConsumed: () => consumed,
  };
}

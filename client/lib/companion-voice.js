import { companionRequestFingerprint, normalizeCompanionRequest } from "./companion-submit.js";
import { normalizeUtterance } from "../../shared/utterance-normalizer.js";

const DEFAULT_SILENCE_MS = 1800;

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
  now = () => Date.now(),
  captureSnapshot = () => null,
  sessionId = null,
  speakerId = "local-user",
} = {}) {
  const utteranceId = `voice-${generation}-${makeId()}`;
  const recognizers = new Set();
  const finals = [];
  let interim = "";
  let timer = null;
  let active = true;
  let consumed = false;
  let lastFinalFingerprint = "";
  let sequence = 0;
  const segments = [];
  const startedAt = now();

  const rawText = () => normalizeCompanionRequest([...finals, interim].filter(Boolean).join(" "));
  const normalized = () => normalizeUtterance(rawText(), { source: "voice" });
  const text = () => normalized().cleanedText;

  const arm = () => {
    if (timer) clearTimer(timer);
    // Interim words are preview-only. Silence dispatches only after an ASR
    // final; explicit mic stop can still commit the current preview.
    if (!active || !finals.length || !text()) return;
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
          segments.push({
            id: `${utteranceId}:${++sequence}`,
            sequence,
            text: transcript,
            final: true,
            confidence: Number(result?.[0]?.confidence) || null,
            startedAt,
            endedAt: now(),
            sessionId: sessionId || utteranceId,
            speakerId,
            targetSnapshot: captureSnapshot(),
          });
        }
      } else {
        nextInterim = transcript;
      }
    }
    interim = nextInterim;
    updateDraft(rawText(), { normalized: normalized(), stableSegments: [...segments] });
    arm();
    return true;
  };

  const registerRecognizer = (recognizer) => {
    if (!active || !recognizer) return false;
    recognizers.add(recognizer);
    return true;
  };

  function finish({ send = true, reason = "explicit" } = {}) {
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
    const raw = rawText();
    const semantic = normalizeUtterance(raw, { source: "voice" });
    const said = semantic.cleanedText;
    if (send && said && !consumed) {
      consumed = true;
      dispatch(said, {
        source: "voice",
        utteranceId,
        requestId: `request-${utteranceId}`,
        sessionGeneration: generation,
        voice: {
          version: 1,
          sessionId: sessionId || utteranceId,
          speakerId,
          rawText: raw,
          semantic,
          segments: [...segments],
          startedAt,
          endedAt: now(),
          reason,
        },
      });
      return true;
    }
    // Never silent-fail: callers surface an exact diagnostic when send was requested.
    if (send && !said && !consumed) {
      consumed = true;
      dispatch("", {
        source: "voice",
        empty: true,
        utteranceId,
        requestId: `request-${utteranceId}`,
        sessionGeneration: generation,
        voice: {
          version: 1,
          sessionId: sessionId || utteranceId,
          speakerId,
          rawText: raw,
          semantic,
          segments: [...segments],
          startedAt,
          endedAt: now(),
          reason: reason || "empty",
          empty: true,
        },
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
    rawText,
    normalized,
    segments: () => [...segments],
    isActive: () => active,
    isConsumed: () => consumed,
  };
}

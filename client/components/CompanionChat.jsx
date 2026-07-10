import React, { useEffect, useRef, useState } from "react";
import { subscribeDirector, stopDirector } from "../lib/director.js";

const SpeechRecognitionImpl =
  typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

/**
 * Companion — a voice/text helper that answers by DOING: every reply can play
 * a live demonstration with the ghost cursor, so the user learns the exact
 * gesture. Mic in via Web Speech API, replies spoken via speechSynthesis.
 */
export default function CompanionChat({ demos = [], onCommand, initialOpen = false, onOpened }) {
  const [open, setOpen] = useState(initialOpen);
  const [messages, setMessages] = useState(() => [
    {
      role: "companion",
      text: "hi — I'm your companion. ask me to show you anything, or tell me what to build and I'll do it in front of you. try “make me an investment memo function and run it on Gimlet Labs.”",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceOut, setVoiceOut] = useState(true);
  const [director, setDirector] = useState(null);
  const listRef = useRef(null);
  const recRef = useRef(null);
  const voiceSessionRef = useRef(null);
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => subscribeDirector(setDirector), []);

  useEffect(() => {
    if (initialOpen) setOpen(true);
  }, [initialOpen]);

  useEffect(() => {
    if (open) onOpened?.();
  }, [open, onOpened]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  function speak(text) {
    if (!voiceOut || typeof speechSynthesis === "undefined" || !text) return;
    try {
      speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1.04;
      utter.pitch = 1.0;
      speechSynthesis.speak(utter);
    } catch {
      /* voice out is best-effort */
    }
  }

  async function send(rawText) {
    const text = (rawText ?? draft).trim();
    if (!text || busy) return;
    setDraft("");
    setMessages((m) => [...m, { role: "user", text }]);
    setBusy(true);
    try {
      const say = await onCommand(text);
      setMessages((m) => [...m, { role: "companion", text: say }]);
      speak(say);
    } catch (err) {
      const msg = err?.message || "something went wrong — try again";
      setDraft(text);
      setMessages((m) => [...m, { role: "companion", text: msg, error: true }]);
    } finally {
      setBusy(false);
    }
  }

  /** How long a pause (after you've said something) means "I'm done". */
  const VOICE_SILENCE_MS = 2600;

  function endVoiceSession({ send: shouldSend } = { send: true }) {
    const s = voiceSessionRef.current;
    if (!s) return;
    voiceSessionRef.current = null;
    s.active = false;
    if (s.silenceTimer) clearTimeout(s.silenceTimer);
    try {
      s.rec.stop();
    } catch {
      /* already stopped */
    }
    recRef.current = null;
    setListening(false);
    const said = (s.finalText + " " + s.interim).replace(/\s+/g, " ").trim();
    if (shouldSend && said) send(said);
    else if (said) setDraft(said);
  }

  function stopListening() {
    endVoiceSession({ send: false });
  }

  function startVoiceSession() {
    const session = {
      rec: null,
      finalText: "",
      interim: "",
      active: true,
      silenceTimer: null,
      restarts: 0,
    };

    const armSilenceTimer = () => {
      if (session.silenceTimer) clearTimeout(session.silenceTimer);
      // Only auto-send once something has actually been said — otherwise
      // keep listening indefinitely until the user speaks or taps the mic.
      if (!(session.finalText + session.interim).trim()) return;
      session.silenceTimer = setTimeout(() => {
        if (session.active) endVoiceSession({ send: true });
      }, VOICE_SILENCE_MS);
    };

    const attach = () => {
      const rec = new SpeechRecognitionImpl();
      rec.lang = navigator.language || "en-US";
      rec.interimResults = true;
      // Continuous: pauses between phrases don't end the session.
      rec.continuous = true;
      rec.onresult = (e) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) session.finalText += r[0].transcript + " ";
          else interim += r[0].transcript;
        }
        session.interim = interim;
        setDraft((session.finalText + interim).replace(/\s+/g, " ").trimStart());
        armSilenceTimer();
      };
      rec.onerror = (e) => {
        // "no-speech" just means a quiet stretch — the restart below handles it.
        if (e?.error === "not-allowed" || e?.error === "service-not-allowed") {
          endVoiceSession({ send: false });
        }
      };
      rec.onend = () => {
        if (!session.active) return;
        // The engine ends on its own after quiet stretches; if the user
        // hasn't finished (no silence-send fired), seamlessly restart and
        // keep the transcript accumulated so far.
        session.restarts += 1;
        if (session.restarts > 40) {
          endVoiceSession({ send: true });
          return;
        }
        try {
          attach();
        } catch {
          endVoiceSession({ send: true });
        }
      };
      session.rec = rec;
      recRef.current = rec;
      rec.start();
    };

    voiceSessionRef.current = session;
    setListening(true);
    try {
      attach();
    } catch {
      endVoiceSession({ send: false });
    }
  }

  function toggleMic() {
    if (listening) {
      // Tapping the mic while listening means "I'm done — go".
      endVoiceSession({ send: true });
      return;
    }
    if (!SpeechRecognitionImpl) {
      setMessages((m) => [...m, { role: "companion", text: "voice input isn't available in this browser — typing works just as well.", error: true }]);
      return;
    }
    startVoiceSession();
  }

  useEffect(() => () => stopListening(), []);

  const playing = !!director?.running;

  if (!open) {
    return (
      <button type="button" className="companion-fab" onClick={() => setOpen(true)} title="Ask the companion">
        <span className="companion-fab-orb" />
        <span className="companion-fab-label">companion</span>
      </button>
    );
  }

  return (
    <div className={"companion-panel" + (playing ? " playing" : "")}>
      <div className="companion-head">
        <span className="companion-head-orb" />
        <span className="companion-head-title">companion</span>
        <button
          type="button"
          className={"companion-head-btn" + (voiceOut ? " on" : "")}
          onClick={() => {
            if (voiceOut && typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
            setVoiceOut((v) => !v);
          }}
          title={voiceOut ? "Mute spoken replies" : "Speak replies aloud"}
        >
          {voiceOut ? "voice on" : "voice off"}
        </button>
        <button type="button" className="companion-head-btn" onClick={() => setOpen(false)} title="Close">
          ×
        </button>
      </div>

      <div className="companion-messages" ref={listRef}>
        {messages.map((m, i) => (
          <div key={i} className={"companion-msg " + m.role + (m.error ? " error" : "")}>
            {m.text}
          </div>
        ))}
        {busy && <div className="companion-msg companion thinking">on it — checking what I can do…</div>}
        {playing && (
          <div className="companion-playing">
            <span>demonstrating{director?.scriptTitle ? ` — ${director.scriptTitle}` : ""}…</span>
            <button type="button" onClick={() => stopDirector()}>stop</button>
          </div>
        )}
      </div>

      {!playing && (
        <div className="companion-demos">
          {demos.slice(0, 6).map((d) => (
            <button key={d.id} type="button" className="companion-demo-chip" onClick={() => send(`show me: ${d.title}`)}>
              {d.title}
            </button>
          ))}
        </div>
      )}

      <div className="companion-input-row">
        <button
          type="button"
          className={"companion-mic" + (listening ? " listening" : "")}
          onClick={toggleMic}
          title={listening ? "Stop listening" : "Speak to the companion"}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="9" y="2" width="6" height="12" rx="3" />
            <path d="M5 10v1a7 7 0 0 0 14 0v-1M12 18v4" />
          </svg>
        </button>
        <input
          className="companion-input"
          placeholder={listening ? "listening — pause when done, or tap the mic to send" : "ask, or tell me what to build…"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
          disabled={busy}
        />
        <button type="button" className="companion-send" onClick={() => send()} disabled={busy || !draft.trim()}>
          ↑
        </button>
      </div>
    </div>
  );
}

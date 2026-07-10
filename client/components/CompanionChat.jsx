import React, { useEffect, useRef, useState } from "react";
import { subscribeDirector, stopDirector } from "../lib/director.js";
import { classifyInterviewInput } from "../lib/companion-intent.js";
import { createCompanionSubmitGuard } from "../lib/companion-submit.js";
import {
  adoptAnonymousCompanionMemory,
  applyInterviewAnswer,
  clearCompanionMemory,
  loadCompanionMemory,
  nextInterviewPrompt,
  rememberCompanionAction,
  saveCompanionMemory,
  setCompanionAutonomy,
} from "../lib/companion-memory.js";

const SpeechRecognitionImpl =
  typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

/**
 * Companion — a voice/text helper that answers by DOING: every reply can play
 * a live demonstration with the ghost cursor, so the user learns the exact
 * gesture. Mic in via Web Speech API, replies spoken via speechSynthesis.
 */
export default function CompanionChat({
  demos = [],
  onCommand,
  initialOpen = false,
  onOpened,
  userId = null,
  notice = null,
  confirmationOpen = false,
}) {
  const [memory, setMemory] = useState(() => loadCompanionMemory(userId));
  const [open, setOpen] = useState(initialOpen);
  const [messages, setMessages] = useState(() => [
    {
      role: "companion",
      text: nextInterviewPrompt(loadCompanionMemory(userId)) ||
        "Welcome back — tell me what you want to think through, transform, or build, and I’ll do it in the app.",
    },
  ]);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("");
  const [activePlan, setActivePlan] = useState(null);
  const [listening, setListening] = useState(false);
  const [voiceOut, setVoiceOut] = useState(false);
  const [director, setDirector] = useState(null);
  const listRef = useRef(null);
  const recRef = useRef(null);
  const voiceSessionRef = useRef(null);
  const composingRef = useRef(false);
  const submitGuardRef = useRef(null);
  if (!submitGuardRef.current) submitGuardRef.current = createCompanionSubmitGuard();
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => subscribeDirector(setDirector), []);

  useEffect(() => {
    const next = userId ? adoptAnonymousCompanionMemory(userId) : loadCompanionMemory(null);
    setMemory(next);
  }, [userId]);

  useEffect(() => {
    if (initialOpen) setOpen(true);
  }, [initialOpen]);

  useEffect(() => {
    if (open) onOpened?.();
  }, [open, onOpened]);

  useEffect(() => {
    if (!notice?.text) return;
    // A confirmation/cancellation notice marks a completed user interaction,
    // so an immediate intentional retry is distinct from a duplicate event.
    submitGuardRef.current.resetDedupe();
    setMessages((current) => [...current, { role: "companion", text: notice.text }]);
    speak(notice.text);
  }, [notice?.id]);

  useEffect(() => {
    if (!confirmationOpen) submitGuardRef.current.resetDedupe();
  }, [confirmationOpen]);

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

  async function send(rawText, source = "unknown") {
    const run = submitGuardRef.current.begin(rawText ?? draft);
    if (!run) return;
    const { text } = run;
    if (typeof window !== "undefined" && import.meta.env?.DEV) {
      window.__lensCompanionLastRun = { id: run.id, text, source, startedAt: run.at };
      window.dispatchEvent(new CustomEvent("lens:companion-run", { detail: window.__lensCompanionLastRun }));
    }
    setDraft("");
    setMessages((m) => [...m, { role: "user", text }]);
    setBusy(true);
    setPhase("understanding");
    const commandOptions = {
      signal: run.signal,
      onPhase(nextPhase) {
        if (!run.signal.aborted) setPhase(nextPhase);
      },
      onPlan(plan) {
        if (!run.signal.aborted) setActivePlan(plan);
      },
    };
    try {
      const interviewPrompt = nextInterviewPrompt(memory);
      if (interviewPrompt) {
        const field = !memory.identity ? "identity" : !memory.role ? "role" : "goal";
        const route = classifyInterviewInput(text, field);
        if (route.kind === "command") {
          const commandReply = await onCommand(text, commandOptions);
          setMemory(rememberCompanionAction(userId, text));
          if (commandReply?.visible && commandReply.text) {
            setMessages((m) => [...m, { role: "companion", text: commandReply.text }]);
            speak(commandReply.text);
          }
          return;
        }
        const next = saveCompanionMemory(userId, applyInterviewAnswer(memory, text));
        setMemory(next);
        const prompt = nextInterviewPrompt(next);
        if (prompt) setMessages((m) => [...m, { role: "companion", text: prompt }]);
        if (field === "goal") {
          const result = await onCommand(text, commandOptions);
          setMemory(rememberCompanionAction(userId, text));
          if (result?.visible && result.text) {
            setMessages((m) => [...m, { role: "companion", text: result.text }]);
            speak(result.text);
          }
        }
        return;
      }
      const result = await onCommand(text, commandOptions);
      setMemory(rememberCompanionAction(userId, text));
      if (result?.visible && result.text) {
        setMessages((m) => [...m, { role: "companion", text: result.text }]);
        speak(result.text);
      }
    } catch (err) {
      if (run.signal.aborted || err?.name === "AbortError") {
        setDraft(text);
        return;
      }
      const msg = err?.message || "something went wrong — try again";
      setDraft(text);
      setMessages((m) => [...m, { role: "companion", text: msg, error: true }]);
    } finally {
      const isCurrent = submitGuardRef.current.active()?.id === run.id;
      submitGuardRef.current.finish(run.id);
      if (isCurrent) {
        setBusy(false);
        setPhase("");
        setActivePlan(null);
      }
    }
  }

  function cancelActiveWork() {
    const cancelled = submitGuardRef.current.cancel();
    if (cancelled) setDraft(cancelled.text);
    setBusy(false);
    setPhase("");
    setActivePlan(null);
    stopDirector();
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
    if (shouldSend && said) send(said, "speech");
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

  useEffect(
    () => () => {
      stopListening();
      submitGuardRef.current.cancel();
    },
    []
  );

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
    <div className={"companion-panel" + (playing ? " playing" : "") + (!memory.interviewComplete ? " interviewing" : "") + (confirmationOpen ? " confirming" : "")}>
      <div className="companion-head">
        <span className="companion-head-orb" />
        <span className="companion-head-title">companion</span>
        <button type="button" className="companion-head-btn" onClick={() => setMemoryOpen((v) => !v)} title="Inspect companion memory">
          memory
        </button>
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

      {memoryOpen && (
        <div className="companion-memory" data-testid="companion-memory">
          <label>
            who you are
            <input
              value={memory.identity}
              onChange={(e) => setMemory(saveCompanionMemory(userId, { identity: e.target.value }))}
            />
          </label>
          <label>
            what you do
            <input
              value={memory.role}
              onChange={(e) => setMemory(saveCompanionMemory(userId, { role: e.target.value }))}
            />
          </label>
          <small>{memory.goals.length} goals · {memory.actions.length} recent action summaries</small>
          <label>
            autonomy
            <select
              value={memory.preferences?.autonomy || "preview-complex"}
              onChange={(event) =>
                setMemory(setCompanionAutonomy(userId, event.target.value))
              }
            >
              <option value="act-immediately">act immediately</option>
              <option value="preview-complex">preview complex plans</option>
              <option value="always-preview">always preview</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              const next = clearCompanionMemory(userId);
              setMemory(next);
              setMessages([{ role: "companion", text: nextInterviewPrompt(next) }]);
            }}
          >
            clear memory
          </button>
        </div>
      )}

      <div className="companion-messages" ref={listRef}>
        {activePlan?.preview && (
          <div className="companion-plan-strip" data-testid="companion-plan-strip">
            <strong>{activePlan.title}</strong>
            <div>
              {(activePlan.steps || []).map((step, index) => (
                <span key={`${step}-${index}`}>{step}</span>
              ))}
            </div>
            <button type="button" onClick={cancelActiveWork}>stop</button>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={"companion-msg " + m.role + (m.error ? " error" : "")}>
            {m.text}
          </div>
        ))}
        {busy && (
          <div className="companion-progress" role="status" aria-live="polite" data-testid="companion-progress">
            <span>{phase || "understanding"}…</span>
            <button type="button" onClick={cancelActiveWork}>stop</button>
          </div>
        )}
        {playing && (
          <div className="companion-playing">
            <span>demonstrating{director?.scriptTitle ? ` — ${director.scriptTitle}` : ""}…</span>
            <button type="button" onClick={cancelActiveWork}>stop</button>
          </div>
        )}
      </div>

      {!playing && (
        <div className="companion-demos">
          {memory.interviewComplete && demos.slice(0, 3).map((d) => (
            <button key={d.id} type="button" className="companion-demo-chip" onClick={() => send(`show me: ${d.title}`)}>
              {d.title}
            </button>
          ))}
        </div>
      )}

      <form
        className="companion-input-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (!composingRef.current) {
            send(e.currentTarget.elements.companionRequest?.value, "form");
          }
        }}
      >
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
          name="companionRequest"
          className="companion-input"
          aria-label="Companion request"
          placeholder={listening ? "listening — pause when done, or tap the mic to send" : "ask, or tell me what to build…"}
          value={draft}
          onFocus={() => submitGuardRef.current.resetDedupe()}
          onChange={(e) => {
            submitGuardRef.current.resetDedupe();
            setDraft(e.target.value);
          }}
          onCompositionStart={() => {
            composingRef.current = true;
          }}
          onCompositionEnd={() => {
            composingRef.current = false;
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            if (e.repeat || e.nativeEvent?.isComposing || composingRef.current) return;
            send(e.currentTarget.value, "keyboard");
          }}
          disabled={busy}
        />
        <button type="submit" className="companion-send" disabled={busy || !draft.trim()}>
          ↑
        </button>
      </form>
    </div>
  );
}

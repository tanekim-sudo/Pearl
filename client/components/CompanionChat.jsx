import React, { useEffect, useRef, useState } from "react";
import { subscribeDirector, stopDirector } from "../lib/director.js";
import { classifyInterviewInput } from "../lib/companion-intent.js";
import { createCompanionSubmitGuard } from "../lib/companion-submit.js";
import { publicCompanionError } from "../lib/companion-command-ledger.js";
import { createCompanionVoiceSession } from "../lib/companion-voice.js";
import {
  COMPANION_MODES,
  createRunLedger,
  normalizeGoal,
  persistRunLedger,
  recommendCompanionMode,
  restoreRunLedger,
  transitionRun,
} from "../lib/companion-harness.js";
import {
  adoptAnonymousCompanionMemory,
  applyInterviewAnswer,
  clearCompanionMemory,
  forgetCompanionMemory,
  loadCompanionMemory,
  nextInterviewPrompt,
  pauseCompanionInterview,
  rememberCompanionAction,
  resumeCompanionInterview,
  saveCompanionMemory,
  setCompanionAutonomy,
} from "../lib/companion-memory.js";

const SpeechRecognitionImpl =
  typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
const MODE_KEY = "lens.companion.mode.v1";
const PENDING_PLAN_KEY = "lens.companion.pending-plan.v1";

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
  const [foreground, setForeground] = useState(false);
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
  const [planDraft, setPlanDraft] = useState("");
  const [planEditing, setPlanEditing] = useState(false);
  const [reviewSelections, setReviewSelections] = useState({});
  const [mode, setMode] = useState(() => {
    const stored = typeof localStorage !== "undefined" ? localStorage.getItem(MODE_KEY) : null;
    return COMPANION_MODES.includes(stored) ? stored : "agent";
  });
  const [listening, setListening] = useState(false);
  const [voiceOut, setVoiceOut] = useState(false);
  const [director, setDirector] = useState(null);
  const listRef = useRef(null);
  const recRef = useRef(null);
  const voiceSessionRef = useRef(null);
  const voiceGenerationRef = useRef(0);
  const composingRef = useRef(false);
  const planDecisionRef = useRef(null);
  const planRunRef = useRef(null);
  const submitGuardRef = useRef(null);
  if (!submitGuardRef.current) submitGuardRef.current = createCompanionSubmitGuard();
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => subscribeDirector(setDirector), []);

  useEffect(() => {
    try {
      const pending = JSON.parse(localStorage.getItem(PENDING_PLAN_KEY) || "null");
      if (pending?.plan?.preview && pending?.rawText) {
        setActivePlan({ ...pending.plan, resumeText: pending.rawText });
        setPlanDraft(JSON.stringify(pending.plan.plan || {}, null, 2));
        setReviewSelections(Object.fromEntries(
          (pending.plan.review?.sections || []).map((section) => [section.id, section.selected !== false])
        ));
        const ledger = restoreRunLedger(localStorage);
        planRunRef.current = ledger.runs.find((run) => run.runId === ledger.activeRunId) || null;
      }
    } catch {
      localStorage.removeItem(PENDING_PLAN_KEY);
    }
  }, []);

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
    if (notice.transient) return;
    setMessages((current) =>
      current.some((message) => message.role === "companion" && message.text === notice.text)
        ? current
        : [...current, { role: "companion", text: notice.text }]
    );
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

  async function send(rawText, sourceOrEnvelope = "unknown") {
    const envelope =
      typeof sourceOrEnvelope === "string" ? { source: sourceOrEnvelope } : sourceOrEnvelope || {};
    const run = submitGuardRef.current.begin(rawText ?? draft, envelope);
    if (!run) return;
    const { text } = run;
    if (typeof window !== "undefined" && import.meta.env?.DEV) {
      window.__lensCompanionLastRun = { ...run, controller: undefined, signal: undefined, text, startedAt: run.at };
      window.dispatchEvent(new CustomEvent("lens:companion-run", { detail: window.__lensCompanionLastRun }));
    }
    setDraft("");
    setMessages((m) => [...m, { role: "user", text }]);
    setBusy(true);
    setPhase("understanding");
    const commandOptions = {
      signal: run.signal,
      mode,
      goal: normalizeGoal(text),
      planApproved: envelope.planApproved === true,
      onPhase(nextPhase) {
        if (!run.signal.aborted) setPhase(nextPhase);
      },
      onPlan(plan) {
        if (run.signal.aborted) return Promise.resolve({ decision: "reject", reason: "cancelled" });
        if (!plan) {
          localStorage.removeItem(PENDING_PLAN_KEY);
          setActivePlan(null);
          setPlanDraft("");
          setPlanEditing(false);
          setReviewSelections({});
          return Promise.resolve({ decision: "closed" });
        }
        setActivePlan(plan);
        setPlanDraft(JSON.stringify(plan.plan || {}, null, 2));
        setPlanEditing(false);
        setReviewSelections(Object.fromEntries(
          (plan.review?.sections || []).map((section) => [section.id, section.selected !== false])
        ));
        if (!plan.preview) return Promise.resolve({ decision: "accept", plan: plan.plan || null });
        let pendingRun = createRunLedger(normalizeGoal(text), plan.plan || plan, { mode });
        pendingRun = transitionRun(pendingRun, { status: "awaiting-approval" });
        planRunRef.current = persistRunLedger(pendingRun, localStorage);
        localStorage.setItem(PENDING_PLAN_KEY, JSON.stringify({ version: 1, rawText: text, mode, plan }));
        return new Promise((resolve) => {
          planDecisionRef.current = resolve;
        });
      },
    };
    try {
      if (/^(?:continue|resume|finish)\s+(?:my\s+)?(?:setup|onboarding|profile)$/i.test(text)) {
        const resumed = resumeCompanionInterview(userId);
        setMemory(resumed);
        const prompt = nextInterviewPrompt(resumed);
        if (prompt) {
          setMessages((current) =>
            current.some((message) => message.role === "companion" && message.text === prompt)
              ? current
              : [...current, { role: "companion", text: prompt }]
          );
        }
        return;
      }
      const interviewPrompt = nextInterviewPrompt(memory);
      if (interviewPrompt) {
        const field = !memory.identity ? "identity" : !memory.role ? "role" : "goal";
        const route = classifyInterviewInput(text, field);
        if (route.kind === "mixed") {
          const next = saveCompanionMemory(userId, {
            ...route.profile,
            interviewPaused: true,
          });
          setMemory(next);
          const commandReply = await onCommand(route.command, commandOptions);
          setMemory(rememberCompanionAction(userId, route.command));
          if (commandReply?.visible && commandReply.text) {
            setMessages((m) => [...m, { role: "companion", text: commandReply.text }]);
            speak(commandReply.text);
          }
          return;
        }
        if (route.kind === "command") {
          setMemory(pauseCompanionInterview(userId));
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
      if (typeof window !== "undefined" && import.meta.env?.DEV) {
        window.__lensCompanionLastError = {
          name: err?.name || "Error",
          message: err?.message || String(err),
          stack: err?.stack || null,
        };
      }
      if (run.signal.aborted || err?.name === "AbortError") {
        setDraft(text);
        return;
      }
      const msg = publicCompanionError(err);
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
    planDecisionRef.current?.({ decision: "reject", reason: "user rejected plan" });
    planDecisionRef.current = null;
    const cancelled = submitGuardRef.current.cancel();
    if (cancelled) setDraft(cancelled.text);
    setBusy(false);
    setPhase("");
    setActivePlan(null);
    stopDirector();
  }

  function decidePlan(decision) {
    let editedPlan = activePlan?.plan || null;
    if (decision === "accept" && planEditing) {
      try {
        editedPlan = JSON.parse(planDraft);
      } catch {
        setMessages((current) => [...current, { role: "companion", text: "Plan JSON is invalid. Fix it or reject the plan.", error: true }]);
        return;
      }
    }
    if (!planDecisionRef.current && activePlan?.resumeText) {
      if (planRunRef.current) {
        planRunRef.current = transitionRun(planRunRef.current, {
          status: decision === "accept" ? "approved" : "cancelled",
          stepId: decision === "accept" ? "plan-approval" : null,
          stepStatus: decision === "accept" ? "completed" : null,
          approval: { decision: decision === "accept" ? "accepted" : "rejected", scope: "plan" },
        });
        persistRunLedger(planRunRef.current, localStorage);
      }
      localStorage.removeItem(PENDING_PLAN_KEY);
      setActivePlan(null);
      setPlanEditing(false);
      if (decision === "accept") void send(activePlan.resumeText, { source: "plan-resume", planApproved: true });
      return;
    }
    planDecisionRef.current?.({
      decision,
      plan: editedPlan,
      selectedSectionIds: Object.entries(reviewSelections)
        .filter(([, selected]) => selected)
        .map(([id]) => id),
      rejectedSectionIds: Object.entries(reviewSelections)
        .filter(([, selected]) => !selected)
        .map(([id]) => id),
    });
    planDecisionRef.current = null;
    if (planRunRef.current) {
      planRunRef.current = transitionRun(planRunRef.current, {
        status: decision === "accept" ? "approved" : "cancelled",
        stepId: decision === "accept" ? "plan-approval" : null,
        stepStatus: decision === "accept" ? "completed" : null,
        approval: { decision: decision === "accept" ? "accepted" : "rejected", scope: "plan" },
      });
      persistRunLedger(planRunRef.current, localStorage);
    }
    localStorage.removeItem(PENDING_PLAN_KEY);
    if (decision !== "accept") setActivePlan(null);
    setPlanEditing(false);
    setReviewSelections({});
  }

  function endVoiceSession({ send: shouldSend } = { send: true }) {
    const s = voiceSessionRef.current;
    if (!s) return;
    voiceSessionRef.current = null;
    const said = s.finish({ send: shouldSend });
    recRef.current = null;
    setListening(false);
    if (!shouldSend && said) setDraft(s.text());
  }

  function stopListening() {
    endVoiceSession({ send: false });
  }

  function startVoiceSession() {
    endVoiceSession({ send: false });
    const generation = ++voiceGenerationRef.current;
    let restarts = 0;
    const session = createCompanionVoiceSession({
      generation,
      dispatch: (text, envelope) => {
        if (voiceSessionRef.current === session) voiceSessionRef.current = null;
        recRef.current = null;
        setListening(false);
        send(text, envelope);
      },
      updateDraft: setDraft,
    });

    const attach = () => {
      if (!session.isActive() || generation !== voiceGenerationRef.current) return;
      const rec = new SpeechRecognitionImpl();
      rec.lang = navigator.language || "en-US";
      rec.interimResults = true;
      // Continuous: pauses between phrases don't end the session.
      rec.continuous = true;
      rec.onresult = (e) => {
        session.ingest(e, generation);
      };
      rec.onerror = (e) => {
        // "no-speech" just means a quiet stretch — the restart below handles it.
        if (e?.error === "not-allowed" || e?.error === "service-not-allowed") {
          endVoiceSession({ send: false });
        }
      };
      rec.onend = () => {
        if (!session.isActive() || generation !== voiceGenerationRef.current) return;
        // The engine ends on its own after quiet stretches; if the user
        // hasn't finished (no silence-send fired), seamlessly restart and
        // keep the transcript accumulated so far.
        restarts += 1;
        if (restarts > 40) {
          endVoiceSession({ send: true });
          return;
        }
        try {
          attach();
        } catch {
          endVoiceSession({ send: true });
        }
      };
      session.registerRecognizer(rec);
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
      voiceGenerationRef.current += 1;
      stopListening();
      submitGuardRef.current.cancel();
    },
    []
  );

  const playing = !!director?.running;
  const modeRecommendation = draft.trim()
    ? recommendCompanionMode(normalizeGoal(draft), { autonomy: memory.preferences?.autonomy })
    : null;

  if (!open) {
    return (
      <button
        type="button"
        className="companion-fab"
        onClick={() => {
          setForeground(true);
          setOpen(true);
        }}
        title="Ask the companion"
      >
        <span className="companion-fab-orb" />
        <span className="companion-fab-label">companion</span>
      </button>
    );
  }

  return (
    <div
      className={"companion-panel" + (foreground ? " foreground" : "") + (playing ? " playing" : "") + (!memory.interviewComplete ? " interviewing" : "") + (confirmationOpen ? " confirming" : "")}
      onPointerDown={() => setForeground(true)}
    >
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
        <button
          type="button"
          className="companion-head-btn"
          onClick={() => {
            setForeground(false);
            setOpen(false);
          }}
          title="Close"
        >
          ×
        </button>
      </div>
      <div className="companion-mode-bar">
        <label>
          mode
          <select
            aria-label="Companion mode"
            value={mode}
            onChange={(event) => {
              const next = event.target.value;
              setMode(next);
              localStorage.setItem(MODE_KEY, next);
            }}
          >
            <option value="ask">Ask · inspect only</option>
            <option value="plan">Plan · approve before changes</option>
            <option value="agent">Agent · execute reversible work</option>
            <option value="debug">Debug · reproduce and verify</option>
          </select>
        </label>
        {modeRecommendation && modeRecommendation.mode !== mode && (
          <button
            type="button"
            onClick={() => {
              setMode(modeRecommendation.mode);
              localStorage.setItem(MODE_KEY, modeRecommendation.mode);
            }}
            title={modeRecommendation.reasons.join(" · ")}
          >
            use {modeRecommendation.mode}
          </button>
        )}
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
          {memory.memories?.length > 0 && (
            <div className="companion-memory-entries">
              {memory.memories.map((entry) => (
                <div key={entry.id} className="companion-memory-entry">
                  <span>{entry.value}</span>
                  <small>
                    {entry.scope} · {Math.round(entry.confidence * 100)}% · {entry.provenance?.kind || "unknown source"}
                    {entry.expiresAt ? ` · expires ${entry.expiresAt}` : ""}
                  </small>
                  <button
                    type="button"
                    onClick={() => setMemory(forgetCompanionMemory(userId, entry.id))}
                  >
                    forget
                  </button>
                </div>
              ))}
            </div>
          )}
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
            {(activePlan.expectedEffects?.length > 0 || activePlan.cost) && (
              <details className="companion-plan-evidence">
                <summary>scope, expected effects, and cost</summary>
                {activePlan.expectedEffects?.length > 0 && (
                  <ul>{activePlan.expectedEffects.map((effect, index) => <li key={index}>{String(effect)}</li>)}</ul>
                )}
                {activePlan.cost && <pre>{JSON.stringify(activePlan.cost, null, 2)}</pre>}
              </details>
            )}
            {activePlan.review?.sections?.length > 0 && (
              <section className="companion-semantic-review" aria-label="Semantic change review">
                <strong>semantic review</strong>
                <p>{activePlan.review.summary || "Choose the exact changes to accept."}</p>
                {activePlan.review.sections.map((section) => (
                  <label key={section.id} className="companion-review-hunk">
                    <input
                      type="checkbox"
                      checked={reviewSelections[section.id] !== false}
                      onChange={(event) => setReviewSelections((current) => ({
                        ...current,
                        [section.id]: event.target.checked,
                      }))}
                    />
                    <span>
                      <b>{section.label || section.id}</b>
                      <small>{section.scope || "object"} · {section.kind || "content"} · {section.targetId || "workspace"}</small>
                      <del>{typeof section.before === "string" ? section.before : JSON.stringify(section.before)}</del>
                      <ins>{typeof section.after === "string" ? section.after : JSON.stringify(section.after)}</ins>
                    </span>
                  </label>
                ))}
                {activePlan.review.checkpointId && <small>restore: {activePlan.review.checkpointId}</small>}
              </section>
            )}
            <details className="companion-plan-evidence">
              <summary>typed plan and approval scope</summary>
              <pre>{JSON.stringify(activePlan.plan || {}, null, 2)}</pre>
            </details>
            {planEditing && (
              <textarea
                aria-label="Editable typed plan"
                value={planDraft}
                onChange={(event) => setPlanDraft(event.target.value)}
              />
            )}
            <div className="companion-plan-actions">
              <button type="button" data-testid="companion-plan-accept" onClick={() => decidePlan("accept")}>accept</button>
              <button type="button" data-testid="companion-plan-edit" onClick={() => setPlanEditing((value) => !value)}>{planEditing ? "close edit" : "edit"}</button>
              <button type="button" data-testid="companion-plan-reject" onClick={() => decidePlan("reject")}>reject</button>
            </div>
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
            <button
              key={d.id}
              type="button"
              className="companion-demo-chip"
              onClick={(event) =>
                send(`show me: ${d.title}`, { source: "text", eventId: `demo-${d.id}-${event.timeStamp}` })
              }
            >
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
            send(e.currentTarget.elements.companionRequest?.value, {
              source: "text",
              eventId: `form-${e.nativeEvent?.timeStamp ?? e.timeStamp}`,
            });
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
            send(e.currentTarget.value, {
              source: "text",
              eventId: `keyboard-${e.nativeEvent?.timeStamp ?? e.timeStamp}`,
            });
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

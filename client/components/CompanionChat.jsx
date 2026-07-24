import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
import {
  clearExecutionEvents,
  formatExecutionChatMessage,
  loadExecutionEvents,
  normalizeCompanionCommandResult,
  recordAndLogExecution,
} from "../../shared/execution-result.js";

const SpeechRecognitionImpl =
  typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
const MODE_KEY = "lens.companion.mode.v1";
const PENDING_PLAN_KEY = "lens.companion.pending-plan.v1";
const CHAT_MESSAGES_KEY = "lens.companion.chat-messages.v1";
const MAX_PERSISTED_CHAT = 80;

function loadPersistedChat(pearlShell) {
  try {
    const raw = sessionStorage.getItem(CHAT_MESSAGES_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) return null;
    return parsed.slice(-MAX_PERSISTED_CHAT).map((entry) => ({
      role: entry.role === "user" ? "user" : "companion",
      text: String(entry.text || "").slice(0, 4000),
      error: Boolean(entry.error),
      execution: entry.execution || undefined,
    }));
  } catch {
    return null;
  }
}

function persistChat(messages) {
  try {
    sessionStorage.setItem(
      CHAT_MESSAGES_KEY,
      JSON.stringify(
        (messages || [])
          .filter((m) => m?.text && m.role !== "status")
          .slice(-MAX_PERSISTED_CHAT)
          .map((m) => ({
            role: m.role,
            text: String(m.text).slice(0, 4000),
            error: Boolean(m.error),
            execution: m.execution
              ? { status: m.execution.status, code: m.execution.code, message: m.execution.message }
              : undefined,
          })),
      ),
    );
  } catch {
    /* private mode / quota */
  }
}

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
  pearlShell = false,
  destructiveConfirmation = null,
  onDestructiveConfirm = null,
  onDestructiveCancel = null,
}) {
  const [memory, setMemory] = useState(() => loadCompanionMemory(userId));
  const [open, setOpen] = useState(initialOpen);
  const [foreground, setForeground] = useState(false);
  const [messages, setMessages] = useState(() => {
    const persisted = loadPersistedChat(pearlShell);
    if (persisted?.length) return persisted;
    return [
      {
        role: "companion",
        text: nextInterviewPrompt(loadCompanionMemory(userId)) ||
          "Type or speak what you want, then press GO. I’ll reply here with what happened.",
      },
    ];
  });
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [diagnostics, setDiagnostics] = useState(() => loadExecutionEvents());
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("");
  const [activePlan, setActivePlan] = useState(null);
  const [planDraft, setPlanDraft] = useState("");
  const [planEditing, setPlanEditing] = useState(false);
  const [reviewSelections, setReviewSelections] = useState({});
  const [shellApproval, setShellApproval] = useState(null);
  // Modes (ask/plan/agent/debug) are chosen automatically per utterance — never a user picker.
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
    function expand() {
      setForeground(true);
      setOpen(true);
    }
    function collapse() {
      setOpen(false);
      setForeground(false);
    }
    window.addEventListener("lens:companion-expand", expand);
    window.addEventListener("lens:companion-collapse", collapse);
    return () => {
      window.removeEventListener("lens:companion-expand", expand);
      window.removeEventListener("lens:companion-collapse", collapse);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    // Focus after portal paint so Talk → type never lands on a dead field.
    let attempts = 0;
    function focusInput() {
      const input = document.querySelector("[data-testid='companion-chat-input'], .companion-panel.shell-dock .companion-input, .companion-panel .companion-input");
      if (input) {
        input.focus?.();
        return;
      }
      if (attempts++ < 12) window.setTimeout(focusInput, 32);
    }
    requestAnimationFrame(focusInput);
  }, [open]);

  useEffect(() => {
    if (!notice?.text) return;
    // A confirmation/cancellation notice marks a completed user interaction,
    // so an immediate intentional retry is distinct from a duplicate event.
    submitGuardRef.current.resetDedupe();
    if (notice.transient) return;
    setMessages((current) =>
      current.some((message) => message.role === "companion" && message.text === notice.text)
        ? current
        : [...current, { role: "companion", text: notice.text, error: /Blocked:|Failed:/i.test(notice.text) }]
    );
    speak(notice.text);
  }, [notice?.id]);

  useEffect(() => {
    function onShellNotice(event) {
      const detail = event.detail || {};
      const text = String(detail.text || "").trim();
      if (!text) return;
      submitGuardRef.current.resetDedupe();
      setForeground(true);
      setOpen(true);
      setMessages((current) =>
        current.some((message) => message.role === "companion" && message.text === text)
          ? current
          : [...current, { role: "companion", text, error: /Blocked:|Failed:/i.test(text) }]
      );
    }
    function onShellApproval(event) {
      const detail = event.detail || null;
      setForeground(true);
      setOpen(true);
      if (!detail) {
        setShellApproval(null);
        return;
      }
      setShellApproval({
        title: detail.title || "Confirm this action",
        steps: Array.isArray(detail.steps) ? detail.steps : [],
        id: detail.id || `shell-approval:${Date.now()}`,
      });
    }
    window.addEventListener("lens:companion-notice", onShellNotice);
    window.addEventListener("lens:companion-approval", onShellApproval);
    return () => {
      window.removeEventListener("lens:companion-notice", onShellNotice);
      window.removeEventListener("lens:companion-approval", onShellApproval);
    };
  }, []);

  useEffect(() => {
    if (!destructiveConfirmation?.domains?.length) return;
    setForeground(true);
    setOpen(true);
  }, [destructiveConfirmation?.domains?.join("|")]);

  useEffect(() => {
    if (!confirmationOpen) submitGuardRef.current.resetDedupe();
  }, [confirmationOpen]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    persistChat(messages);
  }, [messages]);

  function speak(text) {
    if (!voiceOut || typeof speechSynthesis === "undefined" || !text) return;
    try {
      speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1.04;
      utter.pitch = 1.0;
      speechSynthesis.speak(utter);
    } catch (error) {
      console.warn("[pearl:voice] speechSynthesis failed", error?.message || error);
    }
  }

  function refreshDiagnostics() {
    setDiagnostics(loadExecutionEvents());
  }

  function surfaceExecution(result, error = null) {
    const execution = result?.execution || normalizeCompanionCommandResult(result, error);
    const problem = execution.status === "blocked"
      || execution.status === "failed"
      || execution.status === "cancelled";
    // Persist problems for reload debugging; successes stay in-chat only.
    if (problem) recordAndLogExecution(execution);
    else if (import.meta.env?.DEV) recordAndLogExecution(execution);
    refreshDiagnostics();
    if (typeof window !== "undefined") {
      window.__lensCompanionLastExecution = execution;
      if (import.meta.env?.DEV) {
        window.__lensCompanionLastError = problem ? execution : null;
      }
    }
    if (problem) {
      const text = formatExecutionChatMessage(execution);
      setMessages((m) => [...m, {
        role: "companion",
        text,
        error: execution.status !== "cancelled",
        execution,
      }]);
      speak(execution.message);
      return execution;
    }
    // Brief success confirmation so GO never feels silent.
    const text = result?.visible && result?.text
      ? result.text
      : (execution.message && execution.message !== "Done."
        ? execution.message
        : "Done.");
    setMessages((m) => [...m, { role: "companion", text, execution }]);
    if (result?.visible && result?.text) speak(result.text);
    return execution;
  }

  async function send(rawText, sourceOrEnvelope = "unknown") {
    const envelope =
      typeof sourceOrEnvelope === "string" ? { source: sourceOrEnvelope } : sourceOrEnvelope || {};
    // Empty voice finish: never silent — tell the user exactly why GO did not run.
    if (envelope.empty || (envelope.source === "voice" && !String(rawText || "").trim())) {
      const execution = {
        status: "blocked",
        code: "empty-voice",
        stage: "parse",
        message: "Heard nothing clear enough to run. Hold the mic, speak, then release — or type and press GO.",
      };
      surfaceExecution({ execution }, null);
      setBusy(false);
      setPhase("idle");
      return execution;
    }
    const run = submitGuardRef.current.begin(rawText ?? draft, envelope);
    if (!run) {
      const active = submitGuardRef.current.active?.();
      const detail = active
        ? "Still working on your last command — wait for the reply, or press Stop."
        : "That command was ignored as a duplicate of something you just sent. Change the text or wait a moment, then press GO again.";
      setMessages((m) => [...m, {
        role: "companion",
        text: `Blocked: ${detail} [submit-guard]`,
        error: true,
      }]);
      setOpen(true);
      setForeground(true);
      return;
    }
    const { text } = run;
    if (typeof window !== "undefined" && import.meta.env?.DEV) {
      window.__lensCompanionLastRun = { ...run, controller: undefined, signal: undefined, text, startedAt: run.at };
      window.dispatchEvent(new CustomEvent("lens:companion-run", { detail: window.__lensCompanionLastRun }));
    }
    setDraft("");
    setMessages((m) => [...m, { role: "user", text }]);
    setBusy(true);
    setPhase("understanding");
    const goal = normalizeGoal(text);
    const resolvedMode = recommendCompanionMode(goal, {
      autonomy: memory.preferences?.autonomy,
    }).mode;
    setMode(resolvedMode);
    try { localStorage.setItem(MODE_KEY, resolvedMode); } catch { /* private mode / quota */ }
    const commandOptions = {
      signal: run.signal,
      mode: resolvedMode,
      goal,
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
        let pendingRun = createRunLedger(goal, plan.plan || plan, { mode: resolvedMode });
        pendingRun = transitionRun(pendingRun, { status: "awaiting-approval" });
        planRunRef.current = persistRunLedger(pendingRun, localStorage);
        localStorage.setItem(PENDING_PLAN_KEY, JSON.stringify({ version: 1, rawText: text, mode: resolvedMode, plan }));
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
          surfaceExecution(commandReply);
          return;
        }
        if (route.kind === "command") {
          setMemory(pauseCompanionInterview(userId));
          const commandReply = await onCommand(text, commandOptions);
          setMemory(rememberCompanionAction(userId, text));
          surfaceExecution(commandReply);
          return;
        }
        const next = saveCompanionMemory(userId, applyInterviewAnswer(memory, text));
        setMemory(next);
        const prompt = nextInterviewPrompt(next);
        if (prompt) setMessages((m) => [...m, { role: "companion", text: prompt }]);
        if (field === "goal") {
          const result = await onCommand(text, commandOptions);
          setMemory(rememberCompanionAction(userId, text));
          surfaceExecution(result);
        }
        return;
      }
      if (typeof onCommand !== "function") {
        surfaceExecution({
          completed: false,
          visible: true,
          text: "Blocked: Companion runtime is not connected. Reload the page, then try GO again. [runtime-unavailable]",
          execution: {
            status: "blocked",
            code: "runtime-unavailable",
            stage: "execute",
            message: "Companion runtime is not connected. Reload the page, then try GO again.",
          },
        });
        return;
      }
      const result = await onCommand(text, commandOptions);
      setMemory(rememberCompanionAction(userId, text));
      // Always show a chat reply — never complete silently.
      surfaceExecution(
        result?.visible || result?.text
          ? result
          : {
              ...result,
              visible: true,
              text: result?.text || result?.execution?.message || "Done.",
            },
      );
    } catch (err) {
      if (run.signal.aborted || err?.name === "AbortError") {
        surfaceExecution(null, err);
        setDraft(text);
        return;
      }
      surfaceExecution({ completed: false, text: publicCompanionError(err) }, err);
      setDraft(text);
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

  function decideShellApproval(decision) {
    setShellApproval(null);
    window.dispatchEvent(new CustomEvent("lens:companion-approval-decision", {
      detail: { decision },
    }));
  }

  function formatDestructiveSummary(pending) {
    if (!pending?.domains?.length) return "selected workspace content";
    return pending.domains
      .map((domain) => {
        const count = pending.counts?.[domain] || 0;
        const label =
          domain === "paper" ? "whiteboard items"
            : domain === "ai" ? "AI nodes"
              : domain === "lenses" ? "user-created lenses"
                : "generators";
        return `${count} ${label}`;
      })
      .join(" · ");
  }

  function endVoiceSession({ send: shouldSend } = { send: true }) {
    const s = voiceSessionRef.current;
    if (!s) return;
    voiceSessionRef.current = null;
    const said = s.finish({ send: shouldSend });
    recRef.current = null;
    setListening(false);
    setMessages((m) => m.filter((entry) => entry.role !== "status"));
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
      updateDraft: (value) => {
        setDraft(value);
        const heard = String(value || "").trim();
        if (!heard) return;
        setMessages((m) => {
          const without = m.filter((entry) => entry.role !== "status");
          return [...without, { role: "status", text: `Hearing: “${heard.slice(0, 160)}${heard.length > 160 ? "…" : ""}”` }];
        });
      },
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
          setMessages((m) => [...m, {
            role: "companion",
            text: "Microphone permission was blocked. Allow mic for this site in the browser address bar, then tap the mic again — or type and press GO.",
            error: true,
          }]);
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
    setMessages((m) => {
      const without = m.filter((entry) => entry.role !== "status");
      return [...without, {
        role: "status",
        text: "Listening… speak now. Tap the mic again when you’re done (or pause and I’ll send what I heard).",
      }];
    });
    setOpen(true);
    setForeground(true);
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
      setMessages((m) => [...m, {
        role: "companion",
        text: "Voice isn’t available in this browser. Type your goal in the chat and press GO.",
        error: true,
      }]);
      return;
    }
    try {
      startVoiceSession();
    } catch {
      setMessages((m) => [...m, {
        role: "companion",
        text: "Could not start the microphone. Check browser permission for this site, then try again — or type and press GO.",
        error: true,
      }]);
    }
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

  if (!open) {
    // In the Orb Universe shell the Mother Pearl (CompanionOrb) is the open affordance.
    if (pearlShell) return null;
    return (
      <button
        type="button"
        className="companion-fab"
        onClick={() => {
          setForeground(true);
          setOpen(true);
        }}
        title="Open Companion chat"
      >
        <span className="companion-fab-orb" />
        <span className="companion-fab-label">Companion</span>
      </button>
    );
  }

  const panel = (
    <div
      className={"companion-panel" + (pearlShell ? " shell-dock" : "") + (foreground ? " foreground" : "") + (playing ? " playing" : "") + (!memory.interviewComplete ? " interviewing" : "") + (confirmationOpen ? " confirming" : "")}
      data-testid="companion-chat"
      data-pearl-shell={pearlShell ? "true" : "false"}
      data-auto-mode={mode}
      onPointerDown={() => setForeground(true)}
    >
      <div className="companion-head">
        <span className="companion-head-orb" aria-hidden="true" />
        <span className="companion-head-title">Companion</span>
        <button type="button" className="companion-head-btn" onClick={() => setMemoryOpen((v) => !v)} title="Inspect Pearl memory">
          memory
        </button>
        <button
          type="button"
          className={"companion-head-btn" + (diagnosticsOpen ? " on" : "")}
          data-testid="companion-diagnostics-toggle"
          onClick={() => {
            refreshDiagnostics();
            setDiagnosticsOpen((v) => !v);
            setMemoryOpen(false);
          }}
          title="Why didn’t that run? — last execution problems"
        >
          why?
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

      {diagnosticsOpen && (
        <div className="companion-diagnostics" data-testid="companion-diagnostics">
          <strong>Why didn’t that run?</strong>
          <p className="companion-diagnostics-hint">
            Last {Math.max(diagnostics.length, 1)} execution event{diagnostics.length === 1 ? "" : "s"}
            {" "}(kept for this tab session).
          </p>
          {diagnostics.length === 0 ? (
            <p className="companion-diagnostics-empty">No blocked or failed runs yet in this session.</p>
          ) : (
            <ol className="companion-diagnostics-list">
              {[...diagnostics].reverse().slice(0, 12).map((event, index) => (
                <li key={`${event.at}-${event.code}-${index}`} className={`companion-diagnostics-item status-${event.status}`}>
                  <code>{event.code}</code>
                  <span className="companion-diagnostics-status">{event.status}</span>
                  <span className="companion-diagnostics-stage">{event.stage}</span>
                  <p>{event.message}</p>
                  {event.details?.verb && <small>verb: {event.details.verb}</small>}
                </li>
              ))}
            </ol>
          )}
          <button
            type="button"
            onClick={() => {
              clearExecutionEvents();
              refreshDiagnostics();
            }}
          >
            clear session log
          </button>
        </div>
      )}

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
        {destructiveConfirmation?.domains?.length > 0 && (
          <div className="companion-plan-strip" data-testid="companion-destructive-strip" role="alertdialog" aria-label="Confirm destructive clear">
            <strong>Clear this workspace content?</strong>
            <div>
              <span>{formatDestructiveSummary(destructiveConfirmation)}</span>
              <span>Built-in lens primitives will be kept. Nothing is deleted until you accept.</span>
            </div>
            <div className="companion-plan-actions">
              <button
                type="button"
                data-testid="companion-destructive-accept"
                onClick={() => onDestructiveConfirm?.()}
              >
                accept
              </button>
              <button
                type="button"
                data-testid="companion-destructive-reject"
                onClick={() => onDestructiveCancel?.()}
              >
                reject
              </button>
            </div>
          </div>
        )}
        {shellApproval && !destructiveConfirmation?.domains?.length && !activePlan?.preview && (
          <div className="companion-plan-strip" data-testid="companion-shell-approval-strip" role="alertdialog" aria-label="Confirm Companion action">
            <strong>{shellApproval.title}</strong>
            <div>
              {(shellApproval.steps || []).map((step, index) => (
                <span key={`${step}-${index}`}>{step}</span>
              ))}
            </div>
            <div className="companion-plan-actions">
              <button
                type="button"
                data-testid="companion-shell-approval-accept"
                onClick={() => decideShellApproval("accept")}
              >
                accept
              </button>
              <button
                type="button"
                data-testid="companion-shell-approval-reject"
                onClick={() => decideShellApproval("reject")}
              >
                reject
              </button>
            </div>
          </div>
        )}
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
              {/* JSON plan editor demoted from novice / pearl-shell path; still available outside shell. */}
              {!pearlShell && (
                <button type="button" data-testid="companion-plan-edit" onClick={() => setPlanEditing((value) => !value)}>{planEditing ? "close edit" : "edit"}</button>
              )}
              <button type="button" data-testid="companion-plan-reject" onClick={() => decidePlan("reject")}>reject</button>
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={"companion-msg " + m.role + (m.error ? " error" : "") + (m.execution ? ` exec-${m.execution.status}` : "")}
            data-execution-code={m.execution?.code || undefined}
          >
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
          aria-label={listening ? "Stop listening and send" : "Speak — then press GO"}
          title={listening ? "Stop listening and send" : "Speak your goal (same as typing + GO)"}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="9" y="2" width="6" height="12" rx="3" />
            <path d="M5 10v1a7 7 0 0 0 14 0v-1M12 18v4" />
          </svg>
        </button>
        <input
          name="companionRequest"
          className="companion-input"
          data-testid="companion-chat-input"
          aria-label="Type your goal for the Companion"
          placeholder={listening ? "Listening… tap mic or pause to send" : "Type what you want → press GO"}
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
        <button type="submit" className="companion-send" data-testid="companion-go" disabled={busy || !draft.trim()} aria-label="GO — run your command">
          GO
        </button>
      </form>
    </div>
  );

  // Portal out of the clipped orb-runtime-host so chat stays visible on Reef/Scene.
  if (pearlShell && typeof document !== "undefined") {
    return createPortal(panel, document.body);
  }
  return panel;
}

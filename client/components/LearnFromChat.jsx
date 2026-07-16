import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  chunkTranscript,
  localTranscriptSuggestion,
  parseTranscript,
  redactTranscript,
} from "../../shared/transcript-learning.js";

const DRAFT_KEY = "lens.learn-from-chat.draft.v1";

function candidateLabel(kind) {
  return kind === "move" ? "Move · one action" : kind === "function" ? "Function · a process" : "Lens · a way of seeing";
}

export default function LearnFromChat({ onClose, onSaveArtifacts, onEditArtifact }) {
  const restored = useMemo(() => {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch { return null; }
  }, []);
  const [raw, setRaw] = useState(restored?.raw || "");
  const [parsed, setParsed] = useState(null);
  const [requested, setRequested] = useState(restored?.requested || "move");
  const [excluded, setExcluded] = useState(restored?.excluded || []);
  const [redact, setRedact] = useState("");
  const [results, setResults] = useState(restored?.results || null);
  const [selected, setSelected] = useState({ move: true, function: true, lens: true });
  const [status, setStatus] = useState("idle");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ raw, requested, excluded, results }));
  }, [raw, requested, excluded, results]);

  useEffect(() => {
    if (!raw.trim()) { setParsed(null); return; }
    const timer = setTimeout(() => {
      try {
        const value = parseTranscript(raw);
        setParsed(value);
        setError("");
        if (!restored?.requested) setRequested(localTranscriptSuggestion(value));
      } catch (nextError) {
        setParsed(null);
        setError(nextError.message);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [raw]);

  async function loadFile(file) {
    if (!file) return;
    if (!/\.(txt|md|json)$/i.test(file.name) || !["text/plain", "text/markdown", "application/json", ""].includes(file.type)) {
      setError("Choose a UTF-8 .txt, .md, or recognized JSON chat export. Archives are not accepted.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) { setError("Transcript file exceeds 8 MB."); return; }
    setRaw(await file.text());
  }

  function toggleMessage(index) {
    setExcluded((current) => current.includes(index) ? current.filter((value) => value !== index) : [...current, index]);
  }

  async function generate() {
    if (!parsed) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus("running");
    setError("");
    const replacement = redact.trim() ? [{ match: redact.trim(), replacement: "[REDACTED]" }] : [];
    const safe = redactTranscript(parsed, excluded, replacement);
    const chunks = chunkTranscript(safe);
    setProgress(`Analyzing ${chunks.length} bounded chunk${chunks.length === 1 ? "" : "s"} · messages ${chunks[0]?.from || 0}–${chunks.at(-1)?.to || 0}`);
    try {
      const response = await fetch("/api/infer-transcript-artifacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: safe, requested, source: safe.source }),
        signal: controller.signal,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Transcript inference is unavailable.");
      setResults(body);
      setSelected(Object.fromEntries(["move", "function", "lens"].map((kind) => [kind, !!body.candidates?.[kind]?.supported])));
      setStatus("preview");
      setProgress("Preview ready · nothing has been saved");
    } catch (nextError) {
      if (nextError.name === "AbortError") {
        setStatus("idle");
        setProgress("Cancelled · draft and exclusions preserved");
      } else {
        setStatus("error");
        setError(nextError.message);
      }
    } finally {
      abortRef.current = null;
    }
  }

  function patchCandidate(kind, field, value) {
    setResults((current) => ({
      ...current,
      candidates: { ...current.candidates, [kind]: { ...current.candidates[kind], [field]: value } },
    }));
  }

  const requestedKinds = requested === "all" ? ["move", "function", "lens"] : [requested];

  useEffect(() => {
    const handler = async (event) => {
      const detail = event.detail || {};
      try {
        let value = { type: "transcript-draft", id: "active-transcript-draft" };
        if (detail.type === "set-transcript") {
          setRaw(String(detail.text || ""));
          value = { ...value, characterCount: String(detail.text || "").length };
        } else if (detail.type === "choose-kind") {
          setRequested(detail.kind);
          value = { ...value, requested: detail.kind };
        } else if (detail.type === "exclude") {
          const next = [...new Set((detail.messages || []).map(Number).filter(Number.isInteger))];
          setExcluded(next);
          value = { ...value, excluded: next };
        } else if (detail.type === "redact") {
          setRedact(String(detail.text || ""));
          value = { ...value, redactionReady: true };
        } else if (detail.type === "generate") {
          await generate();
          value = { type: "transcript-generation", id: "active-transcript-generation" };
        } else if (detail.type === "select-alternative") {
          const alternative = results?.candidates?.[detail.kind]?.alternatives?.[Math.max(0, Number(detail.alternative) - 1)];
          if (!alternative) throw new Error("that transcript alternative is unavailable");
          setResults((current) => ({ ...current, candidates: { ...current.candidates, [detail.kind]: { ...current.candidates[detail.kind], ...alternative } } }));
          value = { type: detail.kind, id: `transcript-${detail.kind}-preview` };
        } else if (detail.type === "edit-artifact") {
          const candidate = results?.candidates?.[detail.kind];
          if (!candidate) throw new Error(`no ${detail.kind} preview is available`);
          const field = detail.kind === "move" ? "prompt" : detail.kind === "function" ? "steps" : "material";
          patchCandidate(detail.kind, "name", detail.name ?? candidate.name);
          if (detail.content != null) {
            const content = detail.kind === "move" ? detail.content : String(detail.content).split("\n").filter(Boolean).map((entry) => detail.kind === "function" ? { name: entry } : { content: entry });
            patchCandidate(detail.kind, field, content);
          }
          value = { type: detail.kind, id: `transcript-${detail.kind}-preview` };
        } else if (detail.type === "save") {
          if (!results) throw new Error("generate transcript artifacts before saving");
          const kinds = new Set(detail.kinds || []);
          onSaveArtifacts(results, Object.fromEntries(["move", "function", "lens"].map((kind) => [kind, kinds.has(kind)])));
          value = { type: "library-artifacts", id: results.transcript?.fingerprint || "transcript-artifacts", kinds: [...kinds] };
        }
        detail.resolve?.(value);
      } catch (nextError) {
        detail.reject?.(nextError);
      }
    };
    window.addEventListener("lens:transcript-learning", handler);
    return () => window.removeEventListener("lens:transcript-learning", handler);
  }, [parsed, requested, excluded, redact, results, selected]);

  return <div className="modal-scrim" onClick={onClose}>
    <div className="modal learn-chat-modal" role="dialog" aria-modal="true" aria-labelledby="learn-chat-title" onClick={(event) => event.stopPropagation()}>
      <header><div><h3 id="learn-chat-title">Learn from a chat</h3><p>Extract a Move, Function, Lens, or all three from private transcript evidence.</p></div><button onClick={onClose} aria-label="Close">×</button></header>
      <div className="learn-chat-grid">
        <section>
          <label>Paste plain text, Markdown, or chat export JSON
            <textarea rows="10" value={raw} onChange={(event) => { setRaw(event.target.value); setResults(null); }} placeholder={"User: Rewrite this more clearly.\nAssistant: …"} />
          </label>
          <div className="learn-chat-file"><button onClick={() => fileRef.current?.click()}>Choose .txt, .md, or JSON</button><input ref={fileRef} hidden type="file" accept=".txt,.md,.json,text/plain,text/markdown,application/json" onChange={(event) => loadFile(event.target.files?.[0])} /><small>No archives, scripts, hidden HTML, or clipboard access.</small></div>
          {parsed && <div className="learn-chat-stats"><b>{parsed.messageCount} messages · {parsed.characterCount.toLocaleString()} characters</b><span>{parsed.format} · private draft</span></div>}
          {parsed && <div className="learn-chat-messages">{parsed.messages.slice(0, 200).map((message) =>
            <label key={message.id} className={excluded.includes(message.index) ? "excluded" : ""}><input type="checkbox" checked={!excluded.includes(message.index)} onChange={() => toggleMessage(message.index)} /><b>{message.index}. {message.role}</b><span>{message.content.slice(0, 180)}</span></label>
          )}{parsed.messageCount > 200 && <small>Showing 200 of {parsed.messageCount}; all included messages are processed in bounded chunks.</small>}</div>}
          <label>Redact exact text locally before sending<input value={redact} onChange={(event) => setRedact(event.target.value)} placeholder="token, name, or sensitive phrase" /></label>
        </section>
        <section>
          <fieldset><legend>Generate</legend>{[
            ["move", "Move only"],
            ["function", "Function only"],
            ["lens", "Lens only"],
            ["all", "All three"],
          ].map(([value, label]) => <label key={value}><input type="radio" name="learn-kind" value={value} checked={requested === value} onChange={() => setRequested(value)} />{label}</label>)}</fieldset>
          <div className="learn-chat-definitions"><span><b>Move</b> = one recurring action.</span><span><b>Function</b> = an evidenced process.</span><span><b>Lens</b> = the way the chat sees.</span></div>
          <p className="learn-chat-disclosure">Only included, locally redacted transcript content is sent to the configured model when you press Generate. Raw transcript bodies stay private and are excluded from sharing and extension sync.</p>
          <div className="learn-chat-actions"><button className="primary" disabled={!parsed || status === "running"} onClick={generate}>Generate {requested === "all" ? "all three" : candidateLabel(requested).split(" · ")[0]}</button>{status === "running" && <button onClick={() => abortRef.current?.abort()}>Cancel</button>}</div>
          {progress && <p role="status">{progress}</p>}
          {error && <p role="alert">{error}</p>}
          {results && <div className="learn-chat-results">{requestedKinds.map((kind) => {
            const candidate = results.candidates?.[kind];
            if (!candidate) return null;
            return <article key={kind} className={!candidate.supported ? "unsupported" : ""}>
              <label><input type="checkbox" checked={!!selected[kind]} disabled={!candidate.supported} onChange={(event) => setSelected((current) => ({ ...current, [kind]: event.target.checked }))} /><b>{candidateLabel(kind)}</b></label>
              <small>{Math.round((candidate.confidence || 0) * 100)}% confidence · evidence messages {(candidate.evidenceRefs || []).join(", ") || "not identified"}</small>
              <input value={candidate.name || ""} onChange={(event) => patchCandidate(kind, "name", event.target.value)} placeholder={`${kind} name`} />
              {kind === "move" && <textarea rows="4" value={candidate.prompt || ""} onChange={(event) => patchCandidate(kind, "prompt", event.target.value)} />}
              {kind === "function" && <textarea rows="4" value={(candidate.steps || []).map((step) => typeof step === "string" ? step : step.name).join("\n")} onChange={(event) => patchCandidate(kind, "steps", event.target.value.split("\n").filter(Boolean).map((name) => ({ name })))} />}
              {kind === "lens" && <textarea rows="4" value={(candidate.material || []).map((item) => typeof item === "string" ? item : item.content).join("\n")} onChange={(event) => patchCandidate(kind, "material", event.target.value.split("\n").filter(Boolean).map((content, index) => ({ id: `context-${index + 1}`, content })))} />}
              {!!candidate.alternatives?.length && <div className="learn-chat-alternatives" aria-label={`${candidateLabel(kind)} alternatives`}>
                {candidate.alternatives.map((alternative, index) => <button key={`${kind}-alternative-${index}`} onClick={() => setResults((current) => ({
                  ...current,
                  candidates: { ...current.candidates, [kind]: { ...current.candidates[kind], ...alternative, alternatives: current.candidates[kind].alternatives } },
                }))}>{alternative.name || `Alternative ${index + 1}`}</button>)}
              </div>}
              {candidate.supported && kind !== "lens" && <button onClick={() => onEditArtifact?.(kind, candidate)}>Edit in {kind === "move" ? "Move" : "Function"} editor</button>}
              {!candidate.supported && <p>{candidate.reason || "Evidence does not support this type."}</p>}
            </article>;
          })}</div>}
          {results && <button className="primary" disabled={!Object.entries(selected).some(([kind, value]) => value && results.candidates?.[kind]?.supported)} onClick={() => onSaveArtifacts(results, selected)}>Save selected artifacts</button>}
        </section>
      </div>
    </div>
  </div>;
}

import React, { useCallback, useRef, useState } from "react";
import {
  buildEncodeEvidenceList,
  classifyDroppedText,
  detectEncodeIntent,
  extractTextFromFile,
  firstPearlLabelsFromEncode,
  lpBriefingSections,
} from "../../shared/encode-evidence.js";
import { compileAutomationPearl } from "../../shared/automation-pearl.js";
import { PEARL_STORE_KEY } from "../../shared/pearl-store.js";
import { createPearlEntity } from "../../shared/pearl-entity.js";
import { beginDrivePicker, driveConnectorStatus } from "../../shared/connectors/drive.js";

function persistAutomationPearl(pearl) {
  let store;
  try { store = JSON.parse(localStorage.getItem(PEARL_STORE_KEY) || "null"); } catch { store = null; }
  store ||= { version: 1, entities: {}, automationPearls: {} };
  const entity = createPearlEntity({
    id: pearl.id,
    kind: "automation",
    identity: pearl.identity,
    privacyPolicy: pearl.privacyPolicy,
    cognition: pearl.cognition,
    results: [],
    material: pearl.material,
  });
  store.entities = { ...(store.entities || {}), [entity.id]: entity };
  store.automationPearls = { ...(store.automationPearls || {}), [pearl.id]: pearl };
  store.activePearlId = entity.id;
  store.updatedAt = Date.now();
  localStorage.setItem(PEARL_STORE_KEY, JSON.stringify(store));
  return entity;
}

export default function EncodeAnythingPanel({ onClose, onCompiled }) {
  const [items, setItems] = useState([]);
  const [draft, setDraft] = useState("");
  const [slot, setSlot] = useState("instructions");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);
  const drive = driveConnectorStatus();

  const addItem = useCallback((raw, meta = {}) => {
    try {
      const classified = classifyDroppedText(raw, { ...meta, kind: meta.kind || (slot === "instructions" ? null : slot) });
      setItems((current) => [...current, {
        id: `encode:${Date.now()}:${current.length + 1}`,
        kind: classified.kind,
        name: classified.name,
        content: classified.content,
        filename: meta.filename || null,
        connector: meta.connector || null,
      }]);
      setError(null);
    } catch (reason) {
      setError(reason.message);
    }
  }, [slot]);

  async function onFiles(fileList) {
    const files = [...(fileList || [])];
    for (const file of files) {
      const extracted = await extractTextFromFile(file);
      addItem(extracted.text, { filename: extracted.filename, attachment: true, kind: "attachment-extract" });
    }
  }

  async function compile() {
    setBusy(true);
    setError(null);
    try {
      const pending = [...items];
      if (draft.trim()) pending.push({ ...classifyDroppedText(draft, { kind: slot === "instructions" ? null : slot }), id: `encode:draft:${Date.now()}` });
      const evidence = buildEncodeEvidenceList(pending);
      if (!evidence.length) throw new Error("Add a prompt, email, PDF, Drive link, or CRM paste first.");
      let compiled = null;
      try {
        const response = await fetch("/api/infer-automation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ evidence }),
        });
        if (response.ok) {
          const payload = await response.json();
          compiled = payload.pearl;
        }
      } catch { /* local structural compile below */ }
      if (!compiled) compiled = compileAutomationPearl(evidence);
      const entity = persistAutomationPearl(compiled);
      const intent = detectEncodeIntent(evidence.map((entry) => entry.content || entry.verbatim).join("\n"));
      const labels = firstPearlLabelsFromEncode(intent, compiled);
      setResult({ pearl: compiled, entity, labels, intent });
      onCompiled?.({ pearl: compiled, entity, labels });
    } catch (reason) {
      setError(reason.message || "Could not encode this material");
    } finally {
      setBusy(false);
    }
  }

  return <section className="pearl-encode-panel" aria-label="Encode anything into a Pearl">
    <header>
      <b>Encode anything</b>
      <button type="button" onClick={onClose}>Close</button>
    </header>
    <p>Optional bulk drop surface. Prefer telling Pearl in the companion — voice or text — while switching tabs to show formats; Pearl captures screen context, clarifies vagueness, then compiles a reviewable Automation Pearl. Firm material stays local until you approve model or research.</p>
    <div
      className="pearl-encode-drop"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        if (event.dataTransfer.files?.length) onFiles(event.dataTransfer.files);
        else {
          const text = event.dataTransfer.getData("text/plain");
          if (text) addItem(text);
        }
      }}
    >
      <span>Drop files or paste below</span>
      <button type="button" onClick={() => fileRef.current?.click()}>Upload PDF / Doc / text</button>
      <input ref={fileRef} className="sr-only" type="file" multiple accept=".pdf,.txt,.md,.json,.doc,.docx,.html,.csv,image/*" onChange={(event) => onFiles(event.target.files)} />
    </div>
    <div className="pearl-encode-slots" role="group" aria-label="Evidence slots">
      {[
        ["instructions", "Prompt / instructions"],
        ["email-thread", "Email thread"],
        ["crm-export", "Pitchbook / Affinity"],
        ["drive-doc", "Drive link"],
        ["format-template", "Format template"],
        ["attachment-extract", "Prior briefing / PDF text"],
      ].map(([value, label]) => <button type="button" key={value} aria-pressed={slot === value} onClick={() => setSlot(value)}>{label}</button>)}
    </div>
    <textarea
      aria-label="Paste material to encode"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      placeholder={slot === "crm-export"
        ? "Paste Pitchbook overview or Affinity notes…"
        : slot === "drive-doc"
          ? "Paste a Google Drive or Docs link…"
          : "Paste the prompt, email, or prior briefing text…"}
    />
    <div className="pearl-encode-actions">
      <button type="button" onClick={() => { if (draft.trim()) { addItem(draft, { kind: slot }); setDraft(""); } }}>Add to evidence</button>
      <button type="button" onClick={async () => {
        const outcome = await beginDrivePicker({
          clientId: import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID,
          onPicked: () => setSlot("drive-doc"),
        });
        if (!outcome.ok) setError(outcome.detail || drive.fallback);
        else setError(null);
      }}>{drive.configured ? "Choose from Drive" : "Drive link / upload"}</button>
      <button type="button" className="pearl-encode-primary" disabled={busy} onClick={compile}>
        {busy ? "Encoding…" : "Make this a Pearl"}
      </button>
    </div>
    <p className="pearl-account-note">{drive.fallback}</p>
    {items.length > 0 && <ul className="pearl-encode-list" aria-label="Evidence ready to encode">
      {items.map((item) => <li key={item.id}>
        <b>{item.name}</b>
        <small>{item.kind}</small>
        <button type="button" onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}>Remove</button>
      </li>)}
    </ul>}
    {error && <p role="alert">{error}</p>}
    {result && <div className="pearl-encode-result" role="status">
      <b>{result.pearl.identity.name}</b>
      <p>Saved locally{result.pearl.privacyPolicy?.sensitivity === "firm-internal" ? " · firm-internal · research locked until approval" : ""}.</p>
      {result.intent?.lpBriefing && <ul>
        {lpBriefingSections().map((section) => <li key={section.id}>{section.label}</li>)}
      </ul>}
      <p>First pearls: {result.labels.join(" · ")}</p>
    </div>}
  </section>;
}

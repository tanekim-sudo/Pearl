import React, { useMemo, useState } from "react";
import { applyArtifactPatch, createArtifactPatch, createArtifactRef, testArtifactPatchIsolated } from "../../shared/higher-order-artifacts.js";
import { createPersonalCommandDefinition, resolvePersonalCommand, updatePersonalCommand } from "../../shared/personal-command-vocabulary.js";
import { addCognitiveCandidates, createCognitivePullRequest, mergeCognitivePullRequest, reviewCognitiveCandidate, testCognitiveCandidates } from "../../shared/cognitive-pull-request.js";

const VOCAB_KEY = "lens.personal-command-vocabulary.v1";
const PATCH_KEY = "lens.higher-order-patches.v1";
const CPR_KEY = "lens.cognitive-pull-requests.v1";

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; }
}

export default function CognitiveWorkflowStudio({ artifacts, materials, initialTab = "higher-order", onMergeArtifacts, onClose, onOpenPackages }) {
  const [tab, setTab] = useState(initialTab);
  const [vocabulary, setVocabulary] = useState(() => load(VOCAB_KEY, []));
  const [patches, setPatches] = useState(() => load(PATCH_KEY, []));
  const [requests, setRequests] = useState(() => load(CPR_KEY, []));
  const [trigger, setTrigger] = useState("");
  const [targetCommand, setTargetCommand] = useState("openCognitivePullRequest");
  const [scope, setScope] = useState("workspace");
  const [testPhrase, setTestPhrase] = useState("");
  const [status, setStatus] = useState("");
  const selectedArtifact = artifacts[0] || null;
  const selectedMaterial = materials[0] || null;
  const latestRequest = requests.at(-1) || null;

  const vocabularyMatch = useMemo(() => resolvePersonalCommand(testPhrase, vocabulary), [testPhrase, vocabulary]);

  function persist(key, value, setter) {
    localStorage.setItem(key, JSON.stringify(value));
    setter(value);
  }

  async function proposePatch() {
    if (!selectedArtifact) return setStatus("Select a Move, Function, or Lens first.");
    const source = createArtifactRef(selectedArtifact);
    const field = source.kind === "move" ? "promptTemplate" : source.kind === "lens" ? "name" : "name";
    const current = source.snapshot[field] || selectedArtifact.summary?.name || "Artifact";
    const patch = createArtifactPatch({
      source,
      purpose: "Make the artifact more evidence-grounded",
      operations: [{ id: "evidence-hunk", op: "replace", path: `/${field}`, value: `${current} — require cited evidence` }],
      provenance: { surface: "cognitive-workflow-studio" },
    });
    const test = await testArtifactPatchIsolated(source, patch, { fixtures: [{ id: "structural" }], evaluate: async (candidate) => ({ passed: Boolean(candidate.snapshot[field]) }) });
    const next = [...patches, { source, patch, test, acceptedHunkIds: ["evidence-hunk"], status: "review" }];
    persist(PATCH_KEY, next, setPatches);
    setStatus("Candidate patch tested in an isolated snapshot. Review its hunk before versioning.");
  }

  function applyLatestPatch() {
    const entry = patches.at(-1);
    if (!entry?.test?.passed) return setStatus("Only passing isolated patches can be applied.");
    const applied = applyArtifactPatch(entry.source, entry.patch, { acceptedHunkIds: entry.acceptedHunkIds });
    onMergeArtifacts([applied.artifact]);
    const next = patches.map((value, index) => index === patches.length - 1 ? { ...value, status: "applied", receipt: applied.receipt } : value);
    persist(PATCH_KEY, next, setPatches);
    setStatus(`Created ${applied.artifact.id}@${applied.artifact.version}; original remains stable.`);
  }

  function saveVocabulary() {
    const persistent = scope !== "session";
    if (persistent && !window.confirm(`Remember “${trigger}” in ${scope} scope?`)) return;
    try {
      const definition = createPersonalCommandDefinition({ trigger, scope, target: { command: targetCommand }, risk: "inherit", teachingUtterance: `When I say ${trigger}, ${targetCommand}` }, vocabulary);
      persist(VOCAB_KEY, [...vocabulary, definition], setVocabulary);
      setTrigger("");
      setStatus("Personal command saved with provenance and inherited risk.");
    } catch (error) { setStatus(error.message); }
  }

  async function extractProposal() {
    if (!selectedMaterial) return setStatus("Select material on the paper first.");
    const text = String(selectedMaterial.snapshot?.text || selectedMaterial.snapshot?.content || "");
    const source = { id: selectedMaterial.id, fingerprint: selectedMaterial.fingerprint, snapshot: selectedMaterial.snapshot };
    let request = createCognitivePullRequest({ source });
    const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
    request = addCognitiveCandidates(request, [
      { kind: "move", title: "Atomic operation", definition: sentences[0] || text, evidence: [{ sourceId: source.id, start: 0, end: (sentences[0] || text).length }], confidence: 0.86, category: "operation" },
      ...(sentences.length > 1 ? [{ kind: "function", title: "Latent sequence", definition: sentences.join(" → "), evidence: sentences.map((sentence) => ({ sourceId: source.id, quote: sentence })), confidence: 0.78, category: "process" }] : []),
      { kind: "lens", title: "Source perspective", definition: `Attend to the assumptions and emphasis in: ${sentences[0] || text}`, evidence: [{ sourceId: source.id, start: 0, end: text.length }], confidence: 0.72, category: "perspective" },
    ]);
    request = await testCognitiveCandidates(request, async (candidate) => ({ passed: candidate.evidence.length > 0 && candidate.definition.length > 0, evidence: "grounding-conformance" }));
    persist(CPR_KEY, [...requests, request], setRequests);
    setStatus("Grounded candidates are ready. Nothing has been merged.");
  }

  function decideCandidate(id, decision) {
    const nextRequest = reviewCognitiveCandidate(latestRequest, id, decision);
    const next = requests.map((request) => request.id === nextRequest.id ? nextRequest : request);
    persist(CPR_KEY, next, setRequests);
  }

  function mergeAccepted() {
    const accepted = latestRequest.candidates.filter((candidate) => candidate.status === "accepted").map((candidate) => candidate.id);
    const merged = mergeCognitivePullRequest(latestRequest, { selectedCandidateIds: accepted });
    onMergeArtifacts(merged.artifacts);
    const next = requests.map((request) => request.id === merged.request.id ? { ...merged.request, receipt: merged.receipt } : request);
    persist(CPR_KEY, next, setRequests);
    setStatus(`Merged ${merged.artifacts.length} reviewed artifact(s) with an undo receipt.`);
  }

  return <div className="cognitive-studio-scrim" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="cognitive-studio" role="dialog" aria-label="Cognitive Workflow Studio">
      <header><div><b>Cognitive Workflow Studio</b><small>reviewed transformations, vocabulary, and extraction proposals</small></div><button onClick={onClose}>×</button></header>
      <nav>{[
        ["higher-order", "Higher-order"],
        ["vocabulary", "Vocabulary"],
        ["pull-request", "Pull request"],
        ["integrate", "Integrate"],
      ].map(([id, label]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{label}</button>)}</nav>

      {tab === "higher-order" && <div className="cognitive-studio-body">
        <p>Transform <b>{selectedArtifact?.id || "a selected artifact"}</b> through a bounded, isolated, reviewable patch.</p>
        <button onClick={proposePatch}>Propose evidence-grounded patch</button>
        {patches.at(-1) && <article><b>{patches.at(-1).patch.purpose}</b><small>isolated tests: {patches.at(-1).test.passed ? "passed" : "failed"}</small>
          {patches.at(-1).patch.operations.map((operation) => <label key={operation.id}><input type="checkbox" checked={patches.at(-1).acceptedHunkIds.includes(operation.id)} onChange={(event) => {
            const entry = patches.at(-1);
            const ids = event.target.checked ? [...entry.acceptedHunkIds, operation.id] : entry.acceptedHunkIds.filter((id) => id !== operation.id);
            persist(PATCH_KEY, patches.map((value, index) => index === patches.length - 1 ? { ...value, acceptedHunkIds: ids } : value), setPatches);
          }} /> {operation.path}: {String(operation.value)}</label>)}
          <button onClick={applyLatestPatch}>Accept selected hunks as new version</button>
        </article>}
      </div>}

      {tab === "vocabulary" && <div className="cognitive-studio-body">
        <label>When I say<input value={trigger} onChange={(event) => setTrigger(event.target.value)} placeholder="Founder pass" /></label>
        <label>Run<input value={targetCommand} onChange={(event) => setTargetCommand(event.target.value)} /></label>
        <label>Scope<select value={scope} onChange={(event) => setScope(event.target.value)}><option>session</option><option>workspace</option><option>account</option><option>team</option></select></label>
        <button onClick={saveVocabulary}>Preview & remember</button>
        <label>Test without executing<input value={testPhrase} onChange={(event) => setTestPhrase(event.target.value)} /></label>
        <output>{vocabularyMatch.matched ? `Resolves to ${vocabularyMatch.definition.target.command || "plan"}${vocabularyMatch.requiresConfirmation ? " · confirmation inherited" : ""}` : vocabularyMatch.literal ? "Literal text; no execution" : "No match"}</output>
        {vocabulary.map((definition) => <article key={definition.id}><b>{definition.trigger}</b><small>{definition.scope} · v{definition.version}</small><button onClick={() => persist(VOCAB_KEY, vocabulary.map((entry) => entry.id === definition.id ? updatePersonalCommand(entry, { active: !entry.active }) : entry), setVocabulary)}>{definition.active ? "Disable" : "Enable"}</button><button onClick={() => persist(VOCAB_KEY, vocabulary.filter((entry) => entry.id !== definition.id), setVocabulary)}>Forget</button></article>)}
      </div>}

      {tab === "pull-request" && <div className="cognitive-studio-body">
        <p>Extract distinct, evidence-grounded candidates from <b>{selectedMaterial?.id || "selected material"}</b>. Nothing saves until review.</p>
        <button onClick={extractProposal}>Create extraction pull request</button>
        {latestRequest && <><small>coverage {latestRequest.candidates.length}/{latestRequest.budget} · saturation {latestRequest.saturation.reached ? "reached" : "open"}</small>{latestRequest.candidates.map((candidate) => <article key={candidate.id}><b>{candidate.kind}: {candidate.title}</b><p>{candidate.definition}</p><small>{Math.round(candidate.confidence * 100)}% · {candidate.novel ? "novel" : "duplicate"} · {candidate.evidence.length} evidence ref(s)</small><button onClick={() => decideCandidate(candidate.id, "accept")}>Accept</button><button onClick={() => decideCandidate(candidate.id, "reject")}>Reject</button></article>)}<button onClick={mergeAccepted}>Merge accepted</button></>}
      </div>}

      {tab === "integrate" && <div className="cognitive-studio-body"><p>Accepted proposal artifacts and higher-order versions can proceed through conformance tests into a signed package. Publishing still requires scoped approval.</p><button onClick={onOpenPackages}>Continue to package review</button></div>}
      {status && <footer>{status}</footer>}
    </section>
  </div>;
}

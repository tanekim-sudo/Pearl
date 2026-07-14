import React, { useMemo, useState } from "react";

export function LensRackToolbar({
  query,
  onQuery,
  total,
  shown,
  grindCount,
  onOpenGrind,
  onNewCollection,
}) {
  return (
    <div className="lens-rack-toolbar" data-lens-rack-toolbar>
      <div className="lens-rack-search-row">
        <input
          type="search"
          value={query.search || ""}
          onChange={(event) => onQuery({ ...query, search: event.target.value })}
          placeholder="search lenses, tags, components…"
          aria-label="Search lens rack"
        />
        <button type="button" className="lens-rack-grind-button" onClick={onOpenGrind} title="Forge a lens from kept transformations">
          ◇ {grindCount || 0}
        </button>
      </div>
      <div className="lens-rack-filter-row">
        <select
          value={query.type || "all"}
          onChange={(event) => onQuery({ ...query, type: event.target.value })}
          aria-label="Filter lens type"
        >
          <option value="all">all lenses</option>
          <option value="primitive">primitive</option>
          <option value="custom">custom</option>
          <option value="compound">compound</option>
          <option value="forged">forged</option>
          <option value="forked">forked</option>
          <option value="shared">shared</option>
          <option value="archived">archived</option>
        </select>
        <select
          value={query.sort || "recent"}
          onChange={(event) => onQuery({ ...query, sort: event.target.value })}
          aria-label="Sort lens rack"
        >
          <option value="recent">recent</option>
          <option value="frequent">frequent</option>
          <option value="name">name</option>
          <option value="version">version</option>
        </select>
        <button type="button" onClick={onNewCollection} title="Create a collection">+ pack</button>
        <span className="lens-rack-count">{shown < total ? `${shown}/${total}` : total}</span>
      </div>
    </div>
  );
}

export function CompositionPreview({
  composition,
  candidates,
  onChooseSecond,
  onChange,
  onCancel,
  onSave,
  onEdit,
}) {
  if (!composition) return null;
  const { first, second, preview } = composition;
  return (
    <div className="lens-composition-popover" role="dialog" aria-label="Composition preview" data-composition-preview>
      <div className="lens-composition-title">Stack lenses</div>
      {!second ? (
        <label>
          <span>run after {first?.name}</span>
          <select defaultValue="" onChange={(event) => onChooseSecond(event.target.value)}>
            <option value="" disabled>choose lens…</option>
            {candidates.filter((op) => op.id !== first?.id).map((op) => (
              <option key={op.id} value={op.id}>{op.name}</option>
            ))}
          </select>
        </label>
      ) : (
        <>
          <div className="lens-composition-order" data-composition-order>{preview.label}</div>
          <label>
            <span>name</span>
            <input value={composition.name} onChange={(event) => onChange({ ...composition, name: event.target.value })} />
          </label>
          <label>
            <span>components</span>
            <select value={composition.linkMode} onChange={(event) => onChange({ ...composition, linkMode: event.target.value })}>
              <option value="pinned">pinned snapshots</option>
              <option value="latest">follow latest</option>
            </select>
          </label>
          <div className="lens-composition-contract">
            {preview.algebra.firstOutputs} × {preview.algebra.secondOutputsPerInput} → <strong>{preview.outputContract.count} output{preview.outputContract.count === 1 ? "" : "s"}</strong>
          </div>
          {preview.errors.map((error) => <div className="lens-grammar-error" key={error}>{error}</div>)}
          {preview.warnings.map((warning) => <div className="lens-grammar-warning" key={warning}>{warning}</div>)}
          <div className="lens-composition-actions">
            <button type="button" onClick={onCancel}>cancel</button>
            <button type="button" onClick={onEdit} disabled={!preview.ok}>edit tree</button>
            <button type="button" className="primary" onClick={onSave} disabled={!preview.ok || !composition.name.trim()}>
              {preview.requiresConfirmation ? `confirm ${preview.outputContract.count} & save` : "save compound"}
            </button>
          </div>
        </>
      )}
      {!second && <button type="button" className="lens-composition-cancel" onClick={onCancel}>cancel</button>}
    </div>
  );
}

export function GrindWorkspace({
  draft,
  onDraft,
  onAddManual,
  onRemove,
  onReorder,
  onCompile,
  onManualFallback,
  onTest,
  onRefine,
  onShape,
  onClose,
}) {
  const [manual, setManual] = useState({ input: "", output: "", note: "", polarity: "positive", domain: "general" });
  const [testResults, setTestResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const examples = draft?.examples || [];
  const proposal = draft?.proposal || null;
  const ruleMap = proposal?.ruleExampleMap || {};
  const canCompile = examples.length >= 2;
  const versions = draft?.versions || [];

  const positives = useMemo(() => examples.filter((example) => example.polarity !== "negative").length, [examples]);
  if (!draft) return null;

  async function run(action) {
    setBusy(true);
    try {
      const value = await action();
      if (Array.isArray(value)) setTestResults(value);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-scrim lens-grind-scrim" onClick={onClose}>
      <div className="lens-grind-workspace" onClick={(event) => event.stopPropagation()} data-grind-workspace>
        <header>
          <div>
            <h3>Forge lens from examples</h3>
            <p>{examples.length} examples · {positives} positive · craftsmanship checkpoint before save</p>
          </div>
          <button type="button" onClick={onClose}>×</button>
        </header>
        <div className="lens-grind-body">
          <section className="lens-grind-examples">
            <h4>Grinding tray</h4>
            {examples.map((example, index) => (
              <article key={example.id} className={`lens-grind-example ${example.polarity}`} data-grind-example-id={example.id}>
                <div className="lens-grind-example-head">
                  <span>{index + 1}. {example.polarity} · {example.domain}</span>
                  <span>
                    <button disabled={index === 0} onClick={() => onReorder(example.id, index - 1)}>↑</button>
                    <button disabled={index === examples.length - 1} onClick={() => onReorder(example.id, index + 1)}>↓</button>
                    <button onClick={() => onRemove(example.id)}>×</button>
                  </span>
                </div>
                <div><b>in</b> {example.input}</div>
                <div><b>out</b> {example.output}</div>
                {example.note && <div className="lens-grind-note">why: {example.note}</div>}
              </article>
            ))}
            <div className="lens-grind-manual">
              <select value={manual.polarity} onChange={(event) => setManual({ ...manual, polarity: event.target.value })}>
                <option value="positive">positive</option>
                <option value="negative">negative</option>
              </select>
              <input value={manual.domain} onChange={(event) => setManual({ ...manual, domain: event.target.value })} placeholder="domain" />
              <textarea value={manual.input} onChange={(event) => setManual({ ...manual, input: event.target.value })} placeholder="input before transformation" />
              <textarea value={manual.output} onChange={(event) => setManual({ ...manual, output: event.target.value })} placeholder="output you kept" />
              <input value={manual.note} onChange={(event) => setManual({ ...manual, note: event.target.value })} placeholder="why you liked it" />
              <button type="button" disabled={!manual.input.trim() || !manual.output.trim()} onClick={() => {
                onAddManual(manual);
                setManual({ input: "", output: "", note: "", polarity: "positive", domain: "general" });
              }}>keep example</button>
            </div>
          </section>
          <section className="lens-grind-rules">
            {!proposal ? (
              <div className="lens-grind-start">
                <h4>Find the repeatable craft</h4>
                <p>The compiler receives bounded input→output pairs, notes, negative examples and an explicit cross-domain generalization instruction.</p>
                <button type="button" className="primary" disabled={!canCompile || busy} onClick={() => run(onCompile)}>analyze & propose rules</button>
                <button type="button" disabled={!canCompile || busy} onClick={onManualFallback}>shape manually</button>
                {!canCompile && <div className="lens-grammar-warning">keep at least two transformations</div>}
              </div>
            ) : (
              <>
                <label>name<input value={proposal.name || ""} onChange={(event) => onDraft({ ...draft, proposal: { ...proposal, name: event.target.value } })} /></label>
                <label>description<textarea value={proposal.description || ""} onChange={(event) => onDraft({ ...draft, proposal: { ...proposal, description: event.target.value } })} /></label>
                <label>generalized prompt<textarea rows={8} value={proposal.generalizedPrompt || ""} onChange={(event) => onDraft({ ...draft, proposal: { ...proposal, generalizedPrompt: event.target.value } })} /></label>
                <h4>Rules and evidence</h4>
                {(proposal.rules || []).map((rule, index) => (
                  <div className="lens-grind-rule" key={index}>
                    <input value={rule} onChange={(event) => {
                      const rules = [...proposal.rules];
                      rules[index] = event.target.value;
                      onDraft({ ...draft, proposal: { ...proposal, rules } });
                    }} />
                    <small>{(ruleMap[index] || []).length ? `explains ${(ruleMap[index] || []).join(", ")}` : "user-editable rule"}</small>
                  </div>
                ))}
                <div className="lens-grind-refine">
                  {["tighten", "generalize", "make more concrete"].map((instruction) => (
                    <button key={instruction} disabled={busy} onClick={() => run(() => onRefine(instruction))}>{instruction}</button>
                  ))}
                </div>
                <button type="button" disabled={busy} onClick={() => run(onTest)}>test holdout</button>
                {testResults.map((result) => (
                  <div className="lens-grind-test" key={result.exampleId}>
                    <b>{result.deterministic.label}</b>
                    <span>expected: {result.expected}</span>
                    <span>actual: {result.actual}</span>
                  </div>
                ))}
                <div className="lens-grind-version-note">{versions.length} draft version{versions.length === 1 ? "" : "s"} retained</div>
                <button type="button" className="primary" onClick={onShape}>shape in LensTreeEditor…</button>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

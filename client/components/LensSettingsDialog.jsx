import React, { useMemo, useRef, useState } from "react";
import { LENS_PERCEPTUAL_SECTIONS, normalizePerceptualModel } from "../../shared/lens-perceptual-model.js";

const PROBE_DOMAINS = ["music", "books", "prayers", "paintings"];
const SECTION_LABELS = {
  notice: "What to notice",
  questions: "Questions to ask",
  relationships: "Relationships to trace",
  concepts: "Concepts to use",
  assumptions: "Assumptions to surface",
  evidenceStandards: "Evidence standards",
  scales: "Scales to examine",
  transformations: "Transformations to try",
  tensions: "Tensions to hold",
  blindSpots: "Possible blind spots",
  counterLenses: "Alternative lenses",
  preserve: "What to preserve",
  dimensions: "Judgment dimensions and weights",
  preferences: "Positive principles",
  antiPatterns: "Anti-patterns and rejections",
  exceptions: "Exceptions and context conditions",
  positiveExamples: "Positive examples",
  negativeExamples: "Negative examples",
  pairedExamples: "Before → after examples",
  critiques: "Critiques and reasons",
  candidatePreferences: "Preferred and rejected candidates",
  vocabularyPatterns: "Vocabulary and style patterns",
};

const TEXT_CARD_W = 190;
const TEXT_CARD_MAX_H = 110;

function itemBox(it) {
  if (!it) return null;
  if (it.type === "stroke") {
    const pts = Array.isArray(it.points) ? it.points : [];
    if (!pts.length) return null;
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    return {
      minx: Math.min(...xs),
      miny: Math.min(...ys),
      maxx: Math.max(...xs),
      maxy: Math.max(...ys),
    };
  }
  const x = it.x ?? 0;
  const y = it.y ?? 0;
  const w = it.w || (it.type === "image" ? 200 : 320);
  const h = it.h || (it.type === "image" ? 150 : 120);
  return { minx: x, miny: y, maxx: x + w, maxy: y + h };
}

/**
 * Lens workspace — an open-ended contextual holding space, like a piece of paper.
 * It renders everything the Lens has accumulated at its stored
 * placements; the user moves things around, selects a few, runs functions on
 * the selection to look for structure, and — when ready — crafts a lens
 * themselves. The AI affordances (probe, re-read, auto-lens) stay available
 * but quiet.
 */
export default function LensSettingsDialog({
  struct,
  interpreting,
  functionChips = [],
  onSave,
  onReread,
  onEncode,
  onProbe,
  onKeepProbe,
  onMakeLens,
  onMoveItem,
  onRunFunction,
  onFindSameness,
  onCraftLens,
  onAddBeforeAfter,
  onClose,
}) {
  const [title, setTitle] = useState(String(struct.title || ""));
  const [meaning, setMeaning] = useState(struct.interpretation?.meaning || "");
  const [perceptualModel, setPerceptualModel] = useState(() => normalizePerceptualModel(struct.perceptualModel || {}));
  const [encoding, setEncoding] = useState(false);
  const [encodingError, setEncodingError] = useState("");
  const [elements, setElements] = useState(() =>
    (Array.isArray(struct.interpretation?.elements) ? struct.interpretation.elements : []).map(
      (el) => ({
        element: el?.element || "",
        reading: el?.reading || "",
      })
    )
  );
  const [probeDomain, setProbeDomain] = useState("");
  const [probing, setProbing] = useState(false);
  const [probeError, setProbeError] = useState(null);
  const [probeResults, setProbeResults] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [dragOverride, setDragOverride] = useState(null); // { id, x, y } while dragging
  const [running, setRunning] = useState(null); // label of the function in flight
  const [runError, setRunError] = useState(null);
  const spaceRef = useRef(null);

  const items = Array.isArray(struct.items) ? struct.items.filter(Boolean) : [];
  const isTasteLens = perceptualModel.profile.purposes.includes("taste/judgment");
  const tasteChips = [
    ...perceptualModel.sections.preferences,
    ...perceptualModel.sections.antiPatterns,
    ...perceptualModel.sections.preserve,
  ].filter((facet) => facet.enabled && facet.reviewStatus !== "rejected")
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 8);
  const isPlaceholder = !!struct.structNum || /^[◇#]\s*\d+/.test(String(struct.title || ""));

  // Fit the material into the workspace viewport: world bbox → scale + offset.
  const view = useMemo(() => {
    const boxes = items.map(itemBox).filter(Boolean);
    if (!boxes.length) return { scale: 1, ox: 16, oy: 16, w: 0, h: 0 };
    const minx = Math.min(...boxes.map((b) => b.minx));
    const miny = Math.min(...boxes.map((b) => b.miny));
    const maxx = Math.max(...boxes.map((b) => b.maxx));
    const maxy = Math.max(...boxes.map((b) => b.maxy));
    const availW = 620;
    const availH = 268;
    const w = Math.max(maxx - minx, 1);
    const h = Math.max(maxy - miny, 1);
    const scale = Math.min(1, availW / (w + 40), availH / (h + 40));
    return { scale, ox: 16 - minx * scale, oy: 16 - miny * scale, w, h };
    // dragOverride shifts one item live; bbox recomputes on drop via struct.items
  }, [items]);

  function toWorldDelta(dxClient, dyClient) {
    const s = view.scale || 1;
    return { dx: dxClient / s, dy: dyClient / s };
  }

  function startItemDrag(e, it) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const baseX = it.x ?? 0;
    const baseY = it.y ?? 0;
    let moved = false;

    function onMove(ev) {
      const { dx, dy } = toWorldDelta(ev.clientX - startX, ev.clientY - startY);
      if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 4) moved = true;
      if (moved) setDragOverride({ id: it.id, x: baseX + dx, y: baseY + dy });
    }

    function onUp(ev) {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      if (moved) {
        const { dx, dy } = toWorldDelta(ev.clientX - startX, ev.clientY - startY);
        setDragOverride(null);
        onMoveItem?.(it.id, { x: baseX + dx, y: baseY + dy });
      } else {
        setDragOverride(null);
        setSelectedIds((prev) =>
          prev.includes(it.id) ? prev.filter((x) => x !== it.id) : [...prev, it.id]
        );
      }
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  async function runChip(op) {
    if (!op || running || !onRunFunction) return;
    const ids = selectedIds.length ? selectedIds : items.map((it) => it.id);
    if (!ids.length) return;
    setRunning(op.name || "function");
    setRunError(null);
    try {
      await onRunFunction(op, ids);
    } catch (err) {
      setRunError(err?.message || "run failed");
    } finally {
      setRunning(null);
    }
  }

  async function runSameness() {
    if (running || !onFindSameness) return;
    const ids = selectedIds.length >= 2 ? selectedIds : items.map((it) => it.id);
    if (ids.length < 2) {
      setRunError("select at least two things");
      return;
    }
    setRunning("find sameness");
    setRunError(null);
    try {
      await onFindSameness(ids);
    } catch (err) {
      setRunError(err?.message || "run failed");
    } finally {
      setRunning(null);
    }
  }

  function patchElement(i, key, value) {
    setElements((els) => els.map((el, idx) => (idx === i ? { ...el, [key]: value } : el)));
  }

  function save() {
    onSave?.({
      title: title.trim() || struct.title,
      meaning: meaning.trim(),
      perceptualModel: normalizePerceptualModel(perceptualModel),
      elements: elements.filter((el) => el.element.trim() || el.reading.trim()),
    });
  }

  async function runProbe(domain) {
    const target = (domain || "").trim();
    if (!target || probing || !onProbe) return;
    setProbing(true);
    setProbeError(null);
    setProbeResults(null);
    try {
      const candidates = await onProbe(target);
      setProbeResults({ domain: target, candidates: Array.isArray(candidates) ? candidates : [] });
    } catch (err) {
      setProbeError(err.message || "probe failed");
    } finally {
      setProbing(false);
    }
  }

  function keepCandidate(i) {
    if (!probeResults) return;
    onKeepProbe?.(probeResults.domain, probeResults.candidates[i]);
    setProbeResults((prev) =>
      prev ? { ...prev, candidates: prev.candidates.filter((_, idx) => idx !== i) } : prev
    );
  }

  function discardCandidate(i) {
    setProbeResults((prev) =>
      prev ? { ...prev, candidates: prev.candidates.filter((_, idx) => idx !== i) } : prev
    );
  }

  function renderItem(it) {
    const selected = selectedIds.includes(it.id);
    const pos =
      dragOverride?.id === it.id ? { x: dragOverride.x, y: dragOverride.y } : { x: it.x ?? 0, y: it.y ?? 0 };
    if (it.type === "stroke") {
      const pts = Array.isArray(it.points) ? it.points : [];
      if (pts.length < 2) return null;
      const box = itemBox(it);
      const dx = dragOverride?.id === it.id ? dragOverride.x - (it.x ?? box.minx) : 0;
      const dy = dragOverride?.id === it.id ? dragOverride.y - (it.y ?? box.miny) : 0;
      return (
        <svg
          key={it.id}
          className={"gen-space-stroke" + (selected ? " gen-item-selected" : "")}
          style={{
            left: (box.minx + dx) * view.scale + view.ox,
            top: (box.miny + dy) * view.scale + view.oy,
            width: Math.max((box.maxx - box.minx) * view.scale, 2),
            height: Math.max((box.maxy - box.miny) * view.scale, 2),
          }}
          viewBox={`${box.minx} ${box.miny} ${Math.max(box.maxx - box.minx, 1)} ${Math.max(box.maxy - box.miny, 1)}`}
          preserveAspectRatio="none"
          onPointerDown={(e) => startItemDrag(e, { ...it, x: box.minx, y: box.miny })}
        >
          <polyline
            points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={Math.max(2 / (view.scale || 1), 2)}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    }
    if (it.type === "image" && it.src) {
      return (
        <img
          key={it.id}
          className={"gen-space-image" + (selected ? " gen-item-selected" : "")}
          src={it.src}
          alt=""
          draggable={false}
          style={{
            left: pos.x * view.scale + view.ox,
            top: pos.y * view.scale + view.oy,
            width: (it.w || 200) * view.scale,
          }}
          onPointerDown={(e) => startItemDrag(e, it)}
        />
      );
    }
    const text = String(it.text || "").trim();
    if (!text) return null;
    return (
      <div
        key={it.id}
        className={"gen-space-card" + (selected ? " gen-item-selected" : "")}
        style={{
          left: pos.x * view.scale + view.ox,
          top: pos.y * view.scale + view.oy,
          width: Math.min(it.w || TEXT_CARD_W, 280) * Math.max(view.scale, 0.6),
          maxHeight: TEXT_CARD_MAX_H,
        }}
        onPointerDown={(e) => startItemDrag(e, it)}
        title={text.slice(0, 400)}
      >
        {text.slice(0, 320)}
      </div>
    );
  }

  const selCount = selectedIds.length;

  return (
    <div className="onboard-scrim" onClick={onClose}>
      <div className="lens-settings lens-settings-wide" onClick={(e) => e.stopPropagation()}>
        <div className="lens-settings-head">
          <input
            className="lens-settings-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={isPlaceholder ? "name this emerging Lens" : "name this Lens"}
            aria-label="Lens name"
          />
          <button type="button" className="lens-settings-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {isPlaceholder && (
          <div className="lens-settings-graduate-hint">
            {struct.title} is an open workspace — rename it whenever the collected material
            suggests a useful concept.
          </div>
        )}

        <div className="lens-settings-label">
          context space — everything this Lens holds
          <div className="gen-space" ref={spaceRef}>
            {items.length === 0 && (
              <div className="gen-space-empty">
                nothing here yet — drop material onto this Lens card to collect context, then
                arrange and experiment with it here.
              </div>
            )}
            {items.map(renderItem)}
          </div>
          <div className="gen-space-hint">
            drag to arrange · click to select · run lenses on the selection · craft a lens
          </div>
        </div>

        {(items.length > 0 || selCount > 0) && (
          <div className="gen-space-tools">
            {functionChips.map((op) => (
              <button
                key={op.id}
                type="button"
                className="lens-settings-probe-chip"
                disabled={!!running || (!selCount && !items.length)}
                onClick={() => runChip(op)}
                title={op.description || op.name}
              >
                {op.name}
              </button>
            ))}
            <button
              type="button"
              className="lens-settings-probe-chip"
              disabled={!!running || items.length < 2}
              onClick={runSameness}
              title="find the hidden sameness across the selection"
            >
              find sameness
            </button>
            <span className="lens-settings-spacer" />
            <button
              type="button"
              className="gen-craft-lens"
              onClick={() => onCraftLens?.(selectedIds)}
              title="open the lens editor seeded with what you selected and arranged — you shape and save it"
            >
              ƒ craft lens{selCount ? ` from ${selCount} selected` : ""}
            </button>
          </div>
        )}
        {running && <div className="lens-settings-probe-status">{running}…</div>}
        {runError && <div className="lens-settings-probe-status error">{runError}</div>}

        <label className="lens-settings-label">
          workspace note
          <textarea
            className="lens-settings-text"
            rows={2}
            value={meaning}
            onChange={(e) => setMeaning(e.target.value)}
            placeholder="what you are collecting or exploring here…"
          />
        </label>

        <section className="lens-perceptual-editor" data-lens-perceptual-editor>
          <div className="lens-settings-label">
            {isTasteLens ? "how this Lens judges" : "perceptual model"} — explicit context, never an action
            <p className="gen-space-hint">Edit one facet per line. Your edits are confirmed and always override inferred hypotheses.</p>
          </div>
          {isTasteLens && <div className="lens-taste-summary" data-taste-lens-summary>
            <small>{perceptualModel.profile.domains.join(", ") || "general"} · {tasteChips.length} high-priority facets · {perceptualModel.sections.pairedExamples.length} before/after example(s){perceptualModel.profile.lastRefinedAt ? ` · refined ${new Date(perceptualModel.profile.lastRefinedAt).toLocaleDateString()}` : ""}</small>
            <div>{tasteChips.map((facet) => <span key={facet.id} className="lens-context-chip">{facet.text}</span>)}</div>
            {onAddBeforeAfter && <button type="button" className="lens-settings-quiet" onClick={onAddBeforeAfter}>Add before &amp; after</button>}
          </div>}
          {LENS_PERCEPTUAL_SECTIONS.map((section) => (
            <label className="lens-settings-label" key={section}>
              {SECTION_LABELS[section]}
              <textarea
                className="lens-settings-text"
                rows={Math.max(2, Math.min(5, (perceptualModel.sections[section]?.length || 0) + 1))}
                value={(perceptualModel.sections[section] || []).map((facet) => facet.text).join("\n")}
                onChange={(event) => {
                  const previous = perceptualModel.sections[section] || [];
                  const facets = event.target.value.split("\n").map((text) => text.trim()).filter(Boolean).map((text, index) => ({
                    ...(previous[index] || {}),
                    id: previous[index]?.id || `${section}:user:${Date.now()}:${index}`,
                    text,
                    reviewStatus: "confirmed",
                    origin: "user",
                    userConfirmed: true,
                    confidence: 1,
                    updatedAt: Date.now(),
                  }));
                  setPerceptualModel(normalizePerceptualModel({
                    ...perceptualModel,
                    sections: { ...perceptualModel.sections, [section]: facets },
                  }));
                }}
                aria-label={SECTION_LABELS[section]}
                placeholder={`Add ${SECTION_LABELS[section].toLowerCase()}…`}
              />
            </label>
          ))}
          {!!struct.encoding?.diff?.length && (
            <details className="gen-quiet-tools">
              <summary>{struct.encoding.diff.length} inference changes</summary>
              <ul>{struct.encoding.diff.slice(0, 50).map((change, index) => <li key={change.id || index}>{change.section}: {change.after?.text || change.before?.text || change.type}</li>)}</ul>
            </details>
          )}
          {onEncode && (
            <button
              type="button"
              className="lens-settings-quiet"
              disabled={encoding}
              onClick={async () => {
                setEncoding(true);
                setEncodingError("");
                try {
                  const result = await onEncode(perceptualModel);
                  if (result?.proposedPerceptualModel) setPerceptualModel(normalizePerceptualModel(result.proposedPerceptualModel));
                } catch (error) {
                  setEncodingError(error.message || "Lens encoding failed");
                } finally {
                  setEncoding(false);
                }
              }}
            >
              {encoding ? "inferring facets…" : "infer alternative hypotheses"}
            </button>
          )}
          {encodingError && <div className="lens-settings-probe-status error">{encodingError}</div>}
        </section>

        <details className="gen-quiet-tools">
          <summary>quiet tools — reading, probing, ai assists</summary>

          {elements.length > 0 && (
            <div className="lens-settings-label">
              saved readings
              <div className="lens-settings-elements">
                {elements.map((el, i) => (
                  <div key={i} className="lens-settings-element">
                    <input
                      value={el.element}
                      onChange={(e) => patchElement(i, "element", e.target.value)}
                      placeholder="element"
                      aria-label="Element"
                    />
                    <input
                      value={el.reading}
                      onChange={(e) => patchElement(i, "reading", e.target.value)}
                      placeholder="what it contributes"
                      aria-label="Element reading"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {onProbe && (
            <div className="lens-settings-label lens-settings-probe" data-tour="generator-probe">
              probe the collected material in another domain
              <div className="lens-settings-probe-row">
                {PROBE_DOMAINS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className="lens-settings-probe-chip"
                    disabled={probing}
                    onClick={() => runProbe(d)}
                  >
                    {d}
                  </button>
                ))}
                <input
                  className="lens-settings-probe-input"
                  value={probeDomain}
                  onChange={(e) => setProbeDomain(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") runProbe(probeDomain);
                  }}
                  placeholder="or any domain…"
                  disabled={probing}
                />
                <button
                  type="button"
                  className="lens-settings-probe-go"
                  disabled={probing || !probeDomain.trim()}
                  onClick={() => runProbe(probeDomain)}
                >
                  probe
                </button>
              </div>
              {probing && <div className="lens-settings-probe-status">listening for resonance…</div>}
              {probeError && <div className="lens-settings-probe-status error">{probeError}</div>}
              {probeResults && probeResults.candidates.length > 0 && (
                <div className="lens-settings-probe-results">
                  {probeResults.candidates.map((c, i) => (
                    <div key={i} className="lens-settings-probe-candidate">
                      <p>{c}</p>
                      <div className="lens-settings-probe-candidate-actions">
                        <button type="button" onClick={() => keepCandidate(i)}>
                          keep
                        </button>
                        <button type="button" className="quiet" onClick={() => discardCandidate(i)}>
                          discard
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {probeResults && probeResults.candidates.length === 0 && (
                <div className="lens-settings-probe-status">all candidates resolved</div>
              )}
            </div>
          )}

          <div className="gen-quiet-actions">
            <button
              type="button"
              className="lens-settings-quiet"
              onClick={onReread}
              disabled={interpreting}
            >
              {interpreting ? "reading…" : "re-read with AI"}
            </button>
            {onMakeLens && (
              <button
                type="button"
                className="lens-settings-quiet lens-settings-make-lens"
                onClick={onMakeLens}
                title="Ask the AI to draft a Function from this Lens — crafting one yourself keeps you in charge"
              >
                ƒ ai-draft a lens
              </button>
            )}
          </div>
        </details>

        <div className="lens-settings-actions">
          <span className="lens-settings-spacer" />
          <button type="button" className="lens-settings-save" onClick={save}>
            save
          </button>
        </div>
      </div>
    </div>
  );
}

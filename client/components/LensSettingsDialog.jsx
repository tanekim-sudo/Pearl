import React, { useState } from "react";
import { SymbolGlyph } from "./SymbolDrawOverlay.jsx";

const PROBE_DOMAINS = ["music", "books", "prayers", "paintings"];

/**
 * Generator workspace — customize everything a generator means and does:
 * graduate (name) it, edit its meaning, choose what applying it generates,
 * fine-tune the structural reading of its elements, probe it against other
 * domains, and turn it into a reusable lens.
 */
export default function LensSettingsDialog({
  struct,
  interpreting,
  onSave,
  onReread,
  onRedraw,
  onProbe,
  onKeepProbe,
  onMakeLens,
  onClose,
}) {
  const [title, setTitle] = useState(struct.title || "");
  const [meaning, setMeaning] = useState(struct.interpretation?.meaning || "");
  const [viewPrompt, setViewPrompt] = useState(
    struct.interpretation?.viewPrompt || struct.viewLens?.prompt || ""
  );
  const [elements, setElements] = useState(() =>
    (struct.interpretation?.elements || []).map((el) => ({
      element: el.element || "",
      reading: el.reading || "",
    }))
  );
  const [probeDomain, setProbeDomain] = useState("");
  const [probing, setProbing] = useState(false);
  const [probeError, setProbeError] = useState(null);
  const [probeResults, setProbeResults] = useState(null);

  const isPlaceholder = !!struct.structNum || /^[◇#]\s*\d+/.test(struct.title || "");

  function patchElement(i, key, value) {
    setElements((els) => els.map((el, idx) => (idx === i ? { ...el, [key]: value } : el)));
  }

  function save() {
    onSave?.({
      title: title.trim() || struct.title,
      meaning: meaning.trim(),
      viewPrompt: viewPrompt.trim(),
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
      setProbeResults({ domain: target, candidates });
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
      prev
        ? { ...prev, candidates: prev.candidates.filter((_, idx) => idx !== i) }
        : prev
    );
  }

  function discardCandidate(i) {
    setProbeResults((prev) =>
      prev
        ? { ...prev, candidates: prev.candidates.filter((_, idx) => idx !== i) }
        : prev
    );
  }

  return (
    <div className="onboard-scrim" onClick={onClose}>
      <div className="lens-settings" onClick={(e) => e.stopPropagation()}>
        <div className="lens-settings-head">
          {struct.symbolStroke && <SymbolGlyph symbolStroke={struct.symbolStroke} className="lens-settings-glyph" />}
          <input
            className="lens-settings-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={isPlaceholder ? "graduate — give it its real name" : "name this generator"}
            aria-label="Generator name"
          />
          <button type="button" className="lens-settings-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {isPlaceholder && (
          <div className="lens-settings-graduate-hint">
            {struct.title} is a placeholder — when the structure becomes clear, rename it to graduate
            it into a named concept.
          </div>
        )}

        <label className="lens-settings-label">
          what it means
          <textarea
            className="lens-settings-text"
            rows={2}
            value={meaning}
            onChange={(e) => setMeaning(e.target.value)}
            placeholder="the structure this generator compresses…"
          />
        </label>

        <label className="lens-settings-label">
          what applying it generates
          <textarea
            className="lens-settings-text"
            rows={2}
            value={viewPrompt}
            onChange={(e) => setViewPrompt(e.target.value)}
            placeholder="instruction for reading new material through this structure…"
          />
        </label>

        {elements.length > 0 && (
          <div className="lens-settings-label">
            structure — how each element reads
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
            probe — express this structure in another domain
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

        <div className="lens-settings-actions">
          <button type="button" className="lens-settings-quiet" onClick={onRedraw}>
            redraw glyph
          </button>
          <button type="button" className="lens-settings-quiet" onClick={onReread} disabled={interpreting}>
            {interpreting ? "reading…" : "re-read with AI"}
          </button>
          {onMakeLens && (
            <button
              type="button"
              className="lens-settings-quiet lens-settings-make-lens"
              onClick={onMakeLens}
              title="Ask the AI to turn this generator's structure into a reusable lens on the lenses rail"
            >
              ƒ make lens from this
            </button>
          )}
          <span className="lens-settings-spacer" />
          <button type="button" className="lens-settings-save" onClick={save}>
            save
          </button>
        </div>
      </div>
    </div>
  );
}

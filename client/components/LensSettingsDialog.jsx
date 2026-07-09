import React, { useState } from "react";
import { SymbolGlyph } from "./SymbolDrawOverlay.jsx";

/**
 * Lens settings — customize everything a lens means and does:
 * rename/graduate it, edit its meaning, choose what applying it generates,
 * and fine-tune the structural reading of its elements.
 */
export default function LensSettingsDialog({ struct, interpreting, onSave, onReread, onRedraw, onClose }) {
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

  return (
    <div className="onboard-scrim" onClick={onClose}>
      <div className="lens-settings" onClick={(e) => e.stopPropagation()}>
        <div className="lens-settings-head">
          {struct.symbolStroke && <SymbolGlyph symbolStroke={struct.symbolStroke} className="lens-settings-glyph" />}
          <input
            className="lens-settings-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="name this lens"
            aria-label="Lens name"
          />
          <button type="button" className="lens-settings-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <label className="lens-settings-label">
          what it means
          <textarea
            className="lens-settings-text"
            rows={2}
            value={meaning}
            onChange={(e) => setMeaning(e.target.value)}
            placeholder="the structure this symbol compresses…"
          />
        </label>

        <label className="lens-settings-label">
          what applying it generates
          <textarea
            className="lens-settings-text"
            rows={2}
            value={viewPrompt}
            onChange={(e) => setViewPrompt(e.target.value)}
            placeholder="instruction for reading new material through this lens…"
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

        <div className="lens-settings-actions">
          <button type="button" className="lens-settings-quiet" onClick={onRedraw}>
            redraw glyph
          </button>
          <button type="button" className="lens-settings-quiet" onClick={onReread} disabled={interpreting}>
            {interpreting ? "reading…" : "re-read with AI"}
          </button>
          <span className="lens-settings-spacer" />
          <button type="button" className="lens-settings-save" onClick={save}>
            save
          </button>
        </div>
      </div>
    </div>
  );
}

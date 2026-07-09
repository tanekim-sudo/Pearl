import React from "react";

/** Static list of operator stages — no animation, no transfer theater. */
export default function ItemStagesPanel({ title, stages, onClose }) {
  return (
    <div className="onboard-scrim" onClick={onClose}>
      <div className="item-stages-panel" onClick={(e) => e.stopPropagation()}>
        <h3 className="item-stages-title">lenses applied · {title}</h3>
        {stages?.length ? (
          <ol className="item-stages-list">
            {stages.map((s, i) => (
              <li key={s.id} className="item-stages-row">
                <span className="item-stage-num">{i + 1}</span>
                <div className="item-stage-body">
                  <span className="item-stage-op">{s.opName}</span>
                  {s.outputPreview && (
                    <span className="item-stage-preview">{s.outputPreview}</span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="item-stages-empty">
            No lenses applied yet — drag a lens onto this idea to start a thread.
          </p>
        )}
        <div className="item-stages-foot">
          <button type="button" className="rec-btn primary" onClick={onClose}>
            close
          </button>
        </div>
      </div>
    </div>
  );
}

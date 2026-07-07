import React, { useState } from "react";

export default function LensCommitDialog({ title, subtitle, defaultMessage, stepPreview, onConfirm, onCancel }) {
  const [message, setMessage] = useState(defaultMessage || "");

  return (
    <div className="onboard-scrim git-commit-scrim" onClick={onCancel}>
      <div className="git-commit-dialog" onClick={(e) => e.stopPropagation()}>
        <h3 className="git-commit-title">{title || "commit changes"}</h3>
        {subtitle && <p className="git-commit-sub">{subtitle}</p>}
        {stepPreview?.length > 0 && (
          <div className="git-commit-preview">
            <span className="git-commit-preview-label">pipeline</span>
            <div className="git-commit-seq">
              {stepPreview.map((name, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <span className="lens-seq-arrow">→</span>}
                  <span className="lens-move-chip">{name}</span>
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
        <label className="git-commit-label">commit message</label>
        <input
          className="git-commit-input"
          autoFocus
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="what changed in this way of seeing?"
          onKeyDown={(e) => e.key === "Enter" && onConfirm(message)}
        />
        <div className="git-commit-foot">
          <button type="button" className="rec-btn" onClick={onCancel}>
            cancel
          </button>
          <button type="button" className="rec-btn primary" onClick={() => onConfirm(message)}>
            commit
          </button>
        </div>
      </div>
    </div>
  );
}

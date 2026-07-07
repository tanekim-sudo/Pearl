import React from "react";
import { formatGitTime, lineageBreadcrumb } from "../lib/cognition-git.js";

export default function LensHistoryPanel({ lens, lenses, onClose, onCheckout }) {
  if (!lens) return null;
  const byId = Object.fromEntries((lenses || []).map((l) => [l.id, l]));
  const crumbs = lineageBreadcrumb(lens, byId);
  const commits = [...(lens.commits || [])].reverse();

  return (
    <div className="onboard-scrim" onClick={onClose}>
      <div className="git-history-panel" onClick={(e) => e.stopPropagation()}>
        <h3 className="lens-editor-title">history · {lens.name}</h3>
        {crumbs.length > 1 && (
          <p className="git-history-crumb">{crumbs.join(" → ")}</p>
        )}
        <div className="git-history-list">
          {commits.length ? (
            commits.map((c, i) => (
              <div key={c.id} className={"git-history-item" + (i === 0 ? " head" : "")}>
                <div className="git-history-item-top">
                  <span className={"git-ref-badge " + (c.kind || "commit")}>{c.kind || "commit"}</span>
                  <span className="git-history-msg">{c.message}</span>
                  <span className="git-history-time">{formatGitTime(c.at)}</span>
                </div>
                {c.stepNames?.length > 0 && (
                  <div className="git-history-steps">
                    {c.stepNames.slice(0, 8).map((n, j) => (
                      <span key={j} className="lens-move-chip sm">
                        {n}
                      </span>
                    ))}
                    {c.stepNames.length > 8 && (
                      <span className="lens-move-chip sm more">+{c.stepNames.length - 8}</span>
                    )}
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="git-history-empty">
              No commits yet — evolve this lens and save with a commit message.
            </p>
          )}
        </div>
        <div className="lens-editor-foot">
          {onCheckout && (
            <button type="button" className="rec-btn" onClick={() => onCheckout(lens.id)}>
              checkout this branch
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button type="button" className="rec-btn primary" onClick={onClose}>
            close
          </button>
        </div>
      </div>
    </div>
  );
}

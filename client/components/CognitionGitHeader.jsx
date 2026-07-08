import React from "react";
import { commitCount, gitRefLabel } from "../lib/cognition-git.js";

export default function CognitionGitHeader({ activeLens, lensCount, onNewLens }) {
  const ref = activeLens ? gitRefLabel(activeLens) : null;
  const commits = activeLens ? commitCount(activeLens) : 0;

  return (
    <div className="cognition-git-header" data-tour="cognition-git">
      <div className="cognition-git-brand">
        <span className="cognition-git-icon" aria-hidden>
          ◈
        </span>
        <div>
          <div className="cognition-git-title">Lenses</div>
          <div className="cognition-git-tagline">drag onto ideas to transform them</div>
        </div>
      </div>
      <div className="cognition-git-status">
        {activeLens ? (
          <>
            <span className="git-ref-badge checkout">{ref}</span>
            <span className="cognition-git-checkout" title="Selected lens">
              {activeLens.name}
            </span>
            {commits > 0 && <span className="cognition-git-commits">{commits} save{commits === 1 ? "" : "s"}</span>}
          </>
        ) : (
          <span className="cognition-git-idle">{lensCount} lens{lensCount === 1 ? "" : "es"}</span>
        )}
      </div>
      <button type="button" className="rail-create cognition-git-new" data-tour="create-function" onClick={onNewLens}>
        + lens
      </button>
    </div>
  );
}

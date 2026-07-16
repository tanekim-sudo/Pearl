import React from "react";
import { commitCount, gitRefLabel } from "../lib/cognition-git.js";

export default function CognitionGitHeader({ activeTransformation, transformationCount, onNewTransformation }) {
  const ref = activeTransformation ? gitRefLabel(activeTransformation) : null;
  const commits = activeTransformation ? commitCount(activeTransformation) : 0;

  return (
    <div className="cognition-git-header" data-tour="cognition-git">
      <div className="cognition-git-brand">
        <div className="cognition-git-title">functions</div>
        <div className="rail-pane-sub">processes — ordered, branched, or nested Moves and Functions</div>
      </div>
      <div className="cognition-git-status">
        {activeTransformation ? (
          <>
            <span className="git-ref-badge checkout">{ref}</span>
            <span className="cognition-git-checkout" title="Selected lens">
              {activeTransformation.name}
            </span>
            {commits > 0 && (
              <span className="cognition-git-commits">
                {commits} save{commits === 1 ? "" : "s"}
              </span>
            )}
          </>
        ) : (
          <span className="cognition-git-idle">
            {transformationCount} function{transformationCount === 1 ? "" : "s"}
          </span>
        )}
      </div>
      <button
        type="button"
        className="rail-create cognition-git-new"
        data-tour="create-function"
        aria-label="Create Function"
        onClick={onNewTransformation}
      >
        +
      </button>
    </div>
  );
}

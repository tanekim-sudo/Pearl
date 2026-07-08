import React from "react";
import {
  phaseChainLabel,
  sourceDomainOf,
  suggestDomainsForTransfer,
} from "../../shared/cognitive-recognition.js";

/** Explore where a portable cognitive operator applies — test across domains, refine, share. */
export default function TransferExplorePanel({
  op,
  transfer,
  currentMaterial,
  currentDomain,
  testingDomain,
  enriching,
  onClose,
  onTestDomain,
  onShare,
  onEdit,
}) {
  if (!transfer) return null;

  const sourceDomain = sourceDomainOf(transfer);
  const phases = transfer.invariant?.phaseGrammar || [];
  const suggested = suggestDomainsForTransfer(transfer);
  const pattern = (transfer.invariant?.relationalPattern || "transformation").replace(/-/g, " ");
  const outputShape = transfer.invariant?.outputShape || "transformed material";

  return (
    <div className="onboard-scrim" onClick={onClose}>
      <div className="transfer-explore-panel" onClick={(e) => e.stopPropagation()}>
        <h3 className="transfer-explore-title">portable operator · {op?.name || transfer.name}</h3>
        <p className="transfer-explore-lead">{transfer.narrative || phaseChainLabel(transfer)}</p>

        {(sourceDomain || currentDomain) && (
          <p className="transfer-explore-domain">
            {sourceDomain && (
              <>
                learned in <strong>{sourceDomain}</strong>
              </>
            )}
            {currentDomain && currentDomain !== sourceDomain && (
              <>
                {sourceDomain ? " · " : ""}
                selection looks like <strong>{currentDomain}</strong>
              </>
            )}
            {enriching && <span className="transfer-explore-enriching"> · refining abstraction…</span>}
          </p>
        )}

        <div className="transfer-explore-section">
          <span className="transfer-explore-label">cognitive phases</span>
          <div className="transfer-explore-phases">
            {phases.length ? (
              phases.map((p, i) => (
                <React.Fragment key={`${p}-${i}`}>
                  {i > 0 && <span className="transfer-phase-arrow" aria-hidden="true">→</span>}
                  <span className="transfer-phase-chip">{p.replace(/-/g, " ")}</span>
                </React.Fragment>
              ))
            ) : (
              <span className="transfer-phase-chip muted">{phaseChainLabel(transfer)}</span>
            )}
          </div>
        </div>

        <div className="transfer-explore-meta">
          <span>
            <em>pattern</em> {pattern}
          </span>
          <span>
            <em>output</em> {outputShape}
          </span>
        </div>

        <div className="transfer-explore-section">
          <span className="transfer-explore-label">where else does this apply?</span>
          <div className="transfer-domain-grid">
            {suggested.map((d) => (
              <button
                key={d}
                type="button"
                className={"transfer-domain-chip" + (testingDomain === d ? " testing" : "")}
                disabled={!!testingDomain}
                onClick={() => onTestDomain?.(d)}
              >
                {d}
              </button>
            ))}
          </div>
          <p className="transfer-explore-hint">
            {currentMaterial?.trim()
              ? "Adapts the operator's invariant pattern to your selection in that domain."
              : "Select material on the board, then pick a domain to test."}
          </p>
        </div>

        <div className="transfer-explore-foot">
          {onEdit && (
            <button type="button" className="rec-btn" onClick={() => onEdit(op)}>
              refine
            </button>
          )}
          {onShare && (
            <button type="button" className="rec-btn" onClick={() => onShare(op)}>
              share
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

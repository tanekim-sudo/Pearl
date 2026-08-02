import React, { useEffect, useMemo, useState } from "react";
import { summarizePearlFunctions } from "../../shared/pearl-function-moves.js";
import { readPearlWeights } from "../../shared/pearl-weights.js";
import { PEARL_STUDIO_COGNITIVE_SECTION_HELP } from "../../shared/pearl-studio.js";

/**
 * Studio fidelity layer: Moves | Weights | Lenses.
 * Drag / decompose / nest for ordered Moves live in LensTreeEditor (opened from Moves).
 * Function-of-moves storage is presented as Moves — not a middle "Functions" brain.
 */
export default function PearlFunctionMovesStudio({
  entity,
  onOpenOriginalEditor,
  editorOpen = false,
  activeFunctionId = null,
}) {
  const summaries = useMemo(() => summarizePearlFunctions(entity || {}), [entity]);
  const weights = useMemo(() => readPearlWeights(entity || {}), [entity]);
  const lenses = entity?.lenses || [];
  const topMoves = entity?.moves || [];
  const [expandedId, setExpandedId] = useState(() => activeFunctionId || summaries[0]?.id || null);

  useEffect(() => {
    if (activeFunctionId) {
      setExpandedId(activeFunctionId);
      return;
    }
    if (!summaries.length) return;
    if (!expandedId || !summaries.some((entry) => entry.id === expandedId)) {
      setExpandedId(summaries[0].id);
    }
  }, [summaries, expandedId, activeFunctionId]);

  return (
    <section
      className={"pearl-fn-moves" + (editorOpen ? " pearl-fn-moves--summary" : "")}
      data-testid="studio-function-moves"
      aria-label="Moves, Weights, and Lenses"
    >
      <style>{studioCss}</style>
      <header className="pearl-fn-moves__guide">
        <b>Moves · Weights · Lenses</b>
        <p>
          System prompt above summarizes this structure.
          Moves = how work is done. Weights = what you value. Lenses = how to see.
        </p>
      </header>

      <section className="pearl-layer" data-testid="studio-layer-moves" aria-label="Moves">
        <header className="pearl-layer__head">
          <span>Moves</span>
          <small>{PEARL_STUDIO_COGNITIVE_SECTION_HELP.moves}</small>
        </header>
        {!summaries.length && !topMoves.length ? (
          <p className="pearl-fn-moves__empty">
            No Moves yet. Ask Companion to organize this pearl, or create with a process in mind.
          </p>
        ) : null}
        {topMoves.length > 0 && !summaries.length ? (
          <ol className="pearl-fn-moves__list" data-testid="studio-move-sequence" aria-label="Moves">
            {topMoves.map((move, index) => (
              <li key={move.id || move.name || index} className="pearl-fn-moves__move" data-testid="studio-move">
                <span className="pearl-fn-moves__index" aria-hidden="true">{index + 1}</span>
                <div className="pearl-fn-moves__body">
                  <b>{move.name || `Move ${index + 1}`}</b>
                  {move.description ? <p>{move.description}</p> : null}
                </div>
              </li>
            ))}
          </ol>
        ) : null}
        {summaries.map((summary) => {
          const open = expandedId === summary.id;
          const moves = summary.moves;
          const active = activeFunctionId === summary.id;
          return (
            <article
              key={summary.id}
              className={"pearl-fn-moves__fn" + (active ? " is-active" : "")}
              data-testid="studio-function"
              data-function-id={summary.id}
              data-function-name={summary.name}
            >
              <button
                type="button"
                className="pearl-fn-moves__fn-head"
                aria-expanded={open}
                onClick={() => {
                  setExpandedId(open && !editorOpen ? null : summary.id);
                  onOpenOriginalEditor?.(summary.id);
                }}
              >
                <span className="pearl-fn-moves__fn-label">Ordered Moves</span>
                <strong>{summary.name}</strong>
                <small>{summary.moveCount} Move{summary.moveCount === 1 ? "" : "s"}</small>
              </button>
              {open && (
                <ol
                  className="pearl-fn-moves__list"
                  data-testid={editorOpen ? "studio-move-summary" : "studio-move-sequence"}
                  aria-label={`${summary.name} moves in order`}
                >
                  {moves.map((move, index) => (
                    <li
                      key={move.id}
                      className="pearl-fn-moves__move"
                      data-testid={editorOpen ? "studio-move-summary-item" : "studio-move"}
                      data-move-index={index}
                    >
                      <span className="pearl-fn-moves__index" aria-hidden="true">{index + 1}</span>
                      <div className="pearl-fn-moves__body">
                        <b>{move.name}</b>
                        {move.description && !editorOpen ? <p>{move.description}</p> : null}
                      </div>
                    </li>
                  ))}
                  {!moves.length && (
                    <li className="pearl-fn-moves__empty">No moves yet — ask Companion to expand this process.</li>
                  )}
                </ol>
              )}
            </article>
          );
        })}
      </section>

      <section className="pearl-layer" data-testid="studio-layer-weights" aria-label="Weights">
        <header className="pearl-layer__head">
          <span>Weights</span>
          <small>{PEARL_STUDIO_COGNITIVE_SECTION_HELP.weights}</small>
        </header>
        {weights.length ? (
          <ul className="pearl-weights" data-testid="studio-weights-list">
            {weights.map((weight) => (
              <li key={weight.id} data-testid="studio-weight">
                <b>{weight.name}</b>
                <small>{Math.round((weight.priority || 0) * 100)}%</small>
                {weight.note ? <p>{weight.note}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="pearl-fn-moves__empty">
            No Weights yet — tell Companion what you care about more or less.
          </p>
        )}
      </section>

      <section className="pearl-layer pearl-layer--lenses" data-testid="studio-layer-lenses" aria-label="Lenses">
        <header className="pearl-layer__head">
          <span>Lenses</span>
          <small>{PEARL_STUDIO_COGNITIVE_SECTION_HELP.lenses}</small>
        </header>
        {lenses.length ? (
          <ul className="pearl-fn-moves__lenses-list" data-testid="studio-lenses-secondary">
            {lenses.map((lens) => (
              <li key={lens.id}>{lens.name || lens.identity?.name || "Lens"}</li>
            ))}
          </ul>
        ) : (
          <p className="pearl-fn-moves__empty">No Lenses yet — apply a perspective or wear this pearl.</p>
        )}
      </section>
    </section>
  );
}

const studioCss = `
  .pearl-fn-moves{margin:22px 0 28px;padding-top:8px}
  .pearl-fn-moves--summary{margin-bottom:12px}
  .pearl-fn-moves__guide{display:grid;gap:4px;margin-bottom:16px}
  .pearl-fn-moves__guide b{font:550 13px/1.3 inherit}
  .pearl-fn-moves__guide p{margin:0;font-size:13px;line-height:1.5;opacity:.78;max-width:56ch}
  .pearl-layer{margin:0 0 22px;padding-top:12px;border-top:1px solid color-mix(in srgb,currentColor 12%,transparent)}
  .pearl-layer__head{display:grid;gap:4px;margin-bottom:12px}
  .pearl-layer__head span{font-size:10px;letter-spacing:.08em;text-transform:uppercase;opacity:.55}
  .pearl-layer__head small{font-size:12px;line-height:1.45;opacity:.72;max-width:56ch}
  .pearl-fn-moves__fn{margin:0 0 14px;padding-top:4px}
  .pearl-fn-moves__fn.is-active{opacity:1}
  .pearl-fn-moves__fn-head{display:grid;grid-template-columns:auto 1fr auto;gap:4px 12px;align-items:baseline;width:100%;padding:0;border:0;background:transparent;color:inherit;text-align:left;cursor:pointer}
  .pearl-fn-moves__fn-label{grid-column:1/-1;font-size:10px;letter-spacing:.08em;text-transform:uppercase;opacity:.55}
  .pearl-fn-moves__fn-head strong{font:550 18px/1.25 inherit}
  .pearl-fn-moves__fn-head small{opacity:.62;font-size:12px}
  .pearl-fn-moves__list{list-style:none;margin:12px 0 0;padding:0;display:grid;gap:6px}
  .pearl-fn-moves--summary .pearl-fn-moves__list{grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px}
  .pearl-fn-moves__move{display:grid;grid-template-columns:22px minmax(0,1fr);gap:8px;align-items:start;padding:8px 6px;border:1px solid color-mix(in srgb,currentColor 10%,transparent);border-radius:8px;background:color-mix(in srgb,Canvas 94%,transparent)}
  .pearl-fn-moves__index{font-size:12px;opacity:.5;padding-top:2px}
  .pearl-fn-moves__body{min-width:0}
  .pearl-fn-moves__body b{display:block;font:550 13px/1.35 inherit}
  .pearl-fn-moves__body p{margin:4px 0 0;font-size:12px;line-height:1.45;opacity:.72}
  .pearl-fn-moves__empty{opacity:.62;font-size:13px;padding:8px 0;margin:0}
  .pearl-weights{list-style:none;margin:0;padding:0;display:grid;gap:8px}
  .pearl-weights li{display:grid;grid-template-columns:1fr auto;gap:2px 12px;padding:8px 6px;border:1px solid color-mix(in srgb,currentColor 10%,transparent);border-radius:8px}
  .pearl-weights b{font:550 13px/1.35 inherit}
  .pearl-weights small{opacity:.62;font-size:12px}
  .pearl-weights p{grid-column:1/-1;margin:0;font-size:12px;line-height:1.45;opacity:.72}
  .pearl-fn-moves__lenses-list{margin:0;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:8px 14px}
  .pearl-fn-moves__lenses-list li{font-size:13px;opacity:.84}
  @media(prefers-reduced-motion:reduce){.pearl-fn-moves *{transition:none!important}}
`;

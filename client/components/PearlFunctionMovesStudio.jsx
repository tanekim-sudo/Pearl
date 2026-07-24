import React, { useEffect, useMemo, useState } from "react";
import { summarizePearlFunctions } from "../../shared/pearl-function-moves.js";

/**
 * Thin Studio summary of Functions as ordered Moves.
 * Drag / decompose / nest live in the original LensTreeEditor (default primary view).
 * This list is for switching Functions and clueless world-state labels only.
 */
export default function PearlFunctionMovesStudio({
  entity,
  onOpenOriginalEditor,
  editorOpen = false,
  activeFunctionId = null,
}) {
  const summaries = useMemo(() => summarizePearlFunctions(entity || {}), [entity]);
  const lenses = entity?.lenses || [];
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

  if (!summaries.length) {
    return (
      <section className="pearl-fn-moves" data-testid="studio-function-moves" aria-label="Functions as ordered Moves">
        <style>{studioCss}</style>
        <header className="pearl-fn-moves__guide">
          <b>Functions = ordered Moves</b>
          <p>This pearl has no Functions yet. Ask Companion to organize it, or create an investor / role pearl with memo steps.</p>
        </header>
      </section>
    );
  }

  return (
    <section
      className={"pearl-fn-moves" + (editorOpen ? " pearl-fn-moves--summary" : "")}
      data-testid="studio-function-moves"
      aria-label="Functions as ordered Moves"
    >
      <style>{studioCss}</style>
      <header className="pearl-fn-moves__guide">
        <b>Functions = ordered Moves</b>
        <p>
          {editorOpen
            ? "Editing in the original Function editor below — drag grips to reorder, nest, or save. Companion NL uses the same reorderStep path."
            : "Open a Function to edit its ordered Moves in the original Function editor (drag grips, nest, lineage)."}
        </p>
      </header>

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
              <span className="pearl-fn-moves__fn-label">Function</span>
              <strong>{summary.name}</strong>
              <small>{summary.moveCount} ordered Move{summary.moveCount === 1 ? "" : "s"}</small>
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
                  <li className="pearl-fn-moves__empty">No moves yet — ask Companion to expand this Function.</li>
                )}
              </ol>
            )}
          </article>
        );
      })}

      {lenses.length > 0 && (
        <aside className="pearl-fn-moves__lenses" data-testid="studio-lenses-secondary" aria-label="Lenses and taste">
          <span>Lenses / taste</span>
          <ul>
            {lenses.map((lens) => (
              <li key={lens.id}>{lens.name || lens.identity?.name || "Lens"}</li>
            ))}
          </ul>
        </aside>
      )}
    </section>
  );
}

const studioCss = `
  .pearl-fn-moves{margin:22px 0 28px;padding-top:8px}
  .pearl-fn-moves--summary{margin-bottom:12px}
  .pearl-fn-moves__guide{display:grid;gap:4px;margin-bottom:16px}
  .pearl-fn-moves__guide b{font:550 13px/1.3 inherit}
  .pearl-fn-moves__guide p{margin:0;font-size:13px;line-height:1.5;opacity:.78;max-width:56ch}
  .pearl-fn-moves__fn{margin:0 0 14px;border-top:1px solid color-mix(in srgb,currentColor 12%,transparent);padding-top:12px}
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
  .pearl-fn-moves__empty{opacity:.62;font-size:13px;padding:8px 0}
  .pearl-fn-moves__lenses{margin-top:22px;padding-top:14px;border-top:1px solid color-mix(in srgb,currentColor 10%,transparent)}
  .pearl-fn-moves__lenses span{display:block;font-size:10px;letter-spacing:.08em;text-transform:uppercase;opacity:.55;margin-bottom:8px}
  .pearl-fn-moves__lenses ul{margin:0;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:8px 14px}
  .pearl-fn-moves__lenses li{font-size:13px;opacity:.84}
  @media(prefers-reduced-motion:reduce){.pearl-fn-moves *{transition:none!important}}
`;

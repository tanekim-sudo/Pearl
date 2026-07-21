import React, { useMemo, useRef, useState } from "react";

export default function CognitiveLayerStudio({ cognition, onCommand }) {
  const [selectedId, setSelectedId] = useState(null);
  const [pending, setPending] = useState(null);
  const [positions, setPositions] = useState({});
  const dragRef = useRef(null);
  const layers = cognition?.layers || [];
  const selected = layers.find((entry) => entry.id === selectedId) || null;
  const ordered = useMemo(() => (cognition?.semanticOrder || []).map((id) => layers.find((entry) => entry.id === id)).filter(Boolean), [cognition, layers]);

  function position(layer) {
    return positions[layer.id] || layer.layout;
  }

  async function dropComposition(event, target) {
    const payload = event.dataTransfer.getData("application/x-pearl-cognitive-layer");
    if (!payload) return;
    event.preventDefault();
    const source = JSON.parse(payload);
    if (source.layerId === target.id) return;
    const preview = await onCommand("composePearlCognitiveLayers", {
      leftId: source.layerId,
      rightId: target.id,
      options: { intent: "direct spatial composition" },
      confirmed: false,
    });
    setPending({ type: "composition", leftId: source.layerId, rightId: target.id, preview: preview?.object || preview });
  }

  async function finishDrag(event, layer) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || drag.layerId !== layer.id || !drag.moved) return;
    const next = positions[layer.id] || layer.layout;
    await onCommand("mutatePearlCognitiveLayer", { layerId: layer.id, operation: "layout", value: next });
  }

  return <section className="cognitive-layer-studio" aria-label="Organized cognitive layers">
    <style>{`
      .cognitive-layer-studio{position:relative;min-height:440px;margin:30px 0;border-top:1px solid color-mix(in srgb,currentColor 12%,transparent);overflow:hidden}
      .cognitive-layer-field{position:relative;min-height:440px}.cognitive-layer{position:absolute;display:grid;gap:3px;min-width:120px;max-width:190px;padding:8px 10px;border:0;border-left:1px solid color-mix(in srgb,currentColor 24%,transparent);border-radius:0;background:color-mix(in srgb,Canvas 94%,transparent);color:inherit;text-align:left;touch-action:none}
      .cognitive-layer[aria-pressed=true]{border-left-color:currentColor}.cognitive-layer small{font-size:8px;letter-spacing:.12em;text-transform:uppercase;opacity:.55}.cognitive-layer b{overflow:hidden;text-overflow:ellipsis;font:500 12px/1.3 inherit;white-space:nowrap}
      .cognitive-layer__uncertain{position:absolute;top:4px;right:5px;font-size:10px;opacity:.58}.cognitive-layer-editor{position:absolute;z-index:3;right:0;bottom:0;left:0;display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:12px 0;background:Canvas;border-top:1px solid color-mix(in srgb,currentColor 14%,transparent)}
      .cognitive-layer-editor input{flex:1;min-width:180px;border:0;border-bottom:1px solid color-mix(in srgb,currentColor 18%,transparent);background:transparent;color:inherit}.cognitive-layer-editor button{border:0;border-bottom:1px solid color-mix(in srgb,currentColor 18%,transparent);border-radius:0;background:transparent;color:inherit;padding:5px 0}.cognitive-layer-editor p{flex-basis:100%;margin:0;font-size:10px;opacity:.68}
      @media(prefers-reduced-motion:reduce){.cognitive-layer-studio *{transition:none!important;animation:none!important}}
    `}</style>
    <div className="cognitive-layer-field">
      {ordered.map((layer, index) => {
        const at = position(layer);
        return <button
          type="button"
          className="cognitive-layer"
          key={layer.id}
          aria-pressed={selectedId === layer.id}
          aria-label={`${layer.kind} ${layer.identity.name}${layer.uncertainty.status === "resolved" ? "" : ", unresolved"}`}
          draggable
          style={{ transform: `translate(${at.x || (index % 4) * 190}px,${at.y || Math.floor(index / 4) * 96}px)` }}
          onClick={() => setSelectedId(layer.id)}
          onDragStart={(event) => event.dataTransfer.setData("application/x-pearl-cognitive-layer", JSON.stringify({ layerId: layer.id, kind: layer.kind }))}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => dropComposition(event, layer)}
          onPointerDown={(event) => {
            dragRef.current = { layerId: layer.id, x: event.clientX, y: event.clientY, start: at, moved: false };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current;
            if (!drag || drag.layerId !== layer.id) return;
            const dx = event.clientX - drag.x;
            const dy = event.clientY - drag.y;
            if (Math.hypot(dx, dy) < 4) return;
            drag.moved = true;
            setPositions((value) => ({ ...value, [layer.id]: { ...drag.start, x: drag.start.x + dx, y: drag.start.y + dy } }));
          }}
          onPointerUp={(event) => finishDrag(event, layer)}
        >
          <small>{layer.kind}</small><b>{layer.identity.name}</b>
          {layer.uncertainty.status !== "resolved" && <span className="cognitive-layer__uncertain" title={layer.uncertainty.unresolvedQuestions.join(" ")}>?</span>}
        </button>;
      })}
      {selected && <div className="cognitive-layer-editor">
        <input aria-label="Layer name" defaultValue={selected.identity.name} onBlur={async (event) => {
          if (event.target.value === selected.identity.name) return;
          const proposal = await onCommand("proposePearlCognitivePatch", {
            layerId: selected.id,
            patch: { identity: { ...selected.identity, name: event.target.value } },
            rationale: "Direct Studio rename",
          });
          const object = proposal?.object || proposal;
          await onCommand("applyPearlCognitivePatch", { proposalId: object.id, confirmed: true });
        }} />
        <button type="button" onClick={() => onCommand("mutatePearlCognitiveLayer", { layerId: selected.id, operation: "reorder", to: Math.max(0, ordered.indexOf(selected) - 1), confirmed: true })}>Earlier</button>
        <button type="button" onClick={() => onCommand("mutatePearlCognitiveLayer", { layerId: selected.id, operation: "reorder", to: Math.min(ordered.length - 1, ordered.indexOf(selected) + 1), confirmed: true })}>Later</button>
        <button type="button" onClick={() => onCommand("mutatePearlCognitiveLayer", { layerId: selected.id, operation: "duplicate", confirmed: true })}>Duplicate</button>
        <button type="button" onClick={() => onCommand("mutatePearlCognitiveLayer", { layerId: selected.id, operation: "fork", confirmed: true })}>Fork</button>
        {selected.kind === "function" && <button type="button" onClick={() => onCommand("startPearlCognitivePlayback", { functionLayerId: selected.id })}>Play</button>}
        {selected.kind === "function" && <button type="button" onClick={() => setPending({ type: "split", layerId: selected.id })}>Split</button>}
        {selected.uncertainty.status !== "resolved" && <button type="button" onClick={() => setPending({ type: "resolve", layerId: selected.id })}>Resolve uncertainty</button>}
        <button type="button" onClick={() => setPending({ type: "remove", layerId: selected.id })}>Remove</button>
        <p>{selected.uncertainty.status === "resolved" ? `${Math.round(selected.uncertainty.confidence * 100)}% confidence · ${selected.uncertainty.authorship}` : `${Math.round(selected.uncertainty.confidence * 100)}% · ${selected.uncertainty.unresolvedQuestions.join(" ") || "Unresolved inference"}`}</p>
      </div>}
      {pending && <div className="cognitive-layer-editor" role="alertdialog" aria-label="Review cognitive change">
        <p>{pending.type === "composition" ? `Compose these layers${pending.preview?.bridgeMoves?.length ? ` with visible bridge Moves: ${pending.preview.bridgeMoves.join(", ")}` : ""}?` : pending.type === "resolve" ? "Mark this inference resolved and executable/shareable at its recorded confidence?" : `${pending.type} this layer?`}</p>
        <button type="button" onClick={async () => {
          if (pending.type === "composition") await onCommand("composePearlCognitiveLayers", { leftId: pending.leftId, rightId: pending.rightId, options: { intent: "direct spatial composition" }, confirmed: true });
          else if (pending.type === "resolve") await onCommand("resolvePearlCognitiveUncertainty", { layerId: pending.layerId, resolution: { confidence: 1 }, confirmed: true });
          else await onCommand("mutatePearlCognitiveLayer", { layerId: pending.layerId, operation: pending.type, confirmed: true });
          setPending(null);
        }}>Confirm</button>
        <button type="button" onClick={() => setPending(null)}>Cancel</button>
      </div>}
    </div>
  </section>;
}

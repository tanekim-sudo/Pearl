import React, { useEffect, useMemo, useRef, useState } from "react";
import { clusterSemanticOrbs } from "../../shared/semantic-orbs.js";

const PAYLOAD = "application/x-lens-object";

function labelFor(orb) {
  return orb.name || orb.representation?.label || "Untitled pearl";
}

function OrbGlyph({ active = false }) {
  const id = React.useId();
  return <svg viewBox="0 0 64 64" aria-hidden="true">
    <defs>
      <radialGradient id={`semantic-pearl-${id}`} cx="39%" cy="58%" r="72%">
        <stop offset="0" stopColor="#fffaf0" />
        <stop offset=".3" stopColor="#f5f0e7" />
        <stop offset=".68" stopColor="#e7e6de" />
        <stop offset=".88" stopColor="#d1d4ce" />
        <stop offset="1" stopColor="#aeb3af" />
      </radialGradient>
      <radialGradient id={`semantic-nucleus-${id}`} cx="38%" cy="62%" r="58%">
        <stop offset="0" stopColor="#f2d9ce" stopOpacity=".52" />
        <stop offset=".36" stopColor="#d2e2da" stopOpacity=".34" />
        <stop offset=".72" stopColor="#eadcb9" stopOpacity=".15" />
        <stop offset="1" stopColor="#c6ced0" stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`semantic-nacre-${id}`} x1="10%" y1="12%" x2="90%" y2="84%">
        <stop offset="0" stopColor="#dfbfb9" stopOpacity=".11" />
        <stop offset=".31" stopColor="#bfd8ce" stopOpacity=".28" />
        <stop offset=".53" stopColor="#f2e4c2" stopOpacity=".18" />
        <stop offset=".72" stopColor="#d9bdba" stopOpacity=".21" />
        <stop offset="1" stopColor="#bdd3cc" stopOpacity=".1" />
      </linearGradient>
      <linearGradient id={`semantic-rim-${id}`} x1="18%" y1="8%" x2="82%" y2="92%">
        <stop offset="0" stopColor="#fff" stopOpacity=".78" />
        <stop offset=".5" stopColor="#edf2ee" stopOpacity=".18" />
        <stop offset=".82" stopColor="#78817e" stopOpacity=".35" />
        <stop offset="1" stopColor="#f4ecdf" stopOpacity=".48" />
      </linearGradient>
    </defs>
    <ellipse className="semantic-orb-shadow" cx="32" cy="61" rx="17" ry="1.5" />
    <circle className="semantic-orb-core" cx="32" cy="31" r="27" fill={`url(#semantic-pearl-${id})`} />
    <ellipse className="semantic-orb-nucleus" cx="28" cy="35" rx="15" ry="17" fill={`url(#semantic-nucleus-${id})`} />
    <circle className="semantic-orb-nacre" cx="32" cy="31" r="25.8" fill={`url(#semantic-nacre-${id})`} />
    <ellipse className="semantic-orb-reflection" cx="37" cy="38" rx="17" ry="10" />
    <circle className="semantic-orb-rim" cx="32" cy="31" r="26.4" fill="none" stroke={`url(#semantic-rim-${id})`} />
    <ellipse className="semantic-orb-glint" cx="22" cy="18.5" rx="5.5" ry="2.8" transform="rotate(-38 22 18.5)" />
    <circle className="semantic-orb-pinlight" cx="18.5" cy="15.5" r="1.25" />
    <path className="semantic-orb-trace" d="M9 31 C18 9 46 8 55 31 C48 53 18 55 9 31Z" />
  </svg>;
}

export default function SemanticOrbLayer({
  sceneId,
  orbs = [],
  activeId = null,
  onCreate,
  onActivate,
  onMove,
  onRename,
  onArchive,
  onBind,
  onAddContext,
  onRemoveContext,
  onApplyLens,
  onRemoveLens,
  onNest,
  onUnnest,
  onMerge,
  onCompose,
  onSplit,
  onDuplicate,
  onDelete,
}) {
  const rootRef = useRef(null);
  const dragRef = useRef(null);
  const [expandedCluster, setExpandedCluster] = useState(null);
  const [composition, setComposition] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [rename, setRename] = useState("");
  const active = orbs.find((orb) => orb.id === activeId) || null;
  const clusters = useMemo(() => clusterSemanticOrbs(orbs, { zoom: 1 }), [orbs]);

  useEffect(() => setRename(active ? labelFor(active) : ""), [active?.id, active?.name]);

  useEffect(() => {
    function keyDown(event) {
      if (event.target?.closest?.("input,textarea,select,[contenteditable='true']")) return;
      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        onCreate?.({ placement: { x: 0, y: 0 } });
        return;
      }
      if (!active) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onActivate?.(null);
      } else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        onArchive?.(active.id, true);
      } else if (event.key.startsWith("Arrow")) {
        event.preventDefault();
        const step = event.shiftKey ? 48 : 12;
        onMove?.(active.id, {
          x: active.placement.x + (event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0),
          y: active.placement.y + (event.key === "ArrowDown" ? step : event.key === "ArrowUp" ? -step : 0),
        });
      }
    }
    window.addEventListener("keydown", keyDown);
    return () => window.removeEventListener("keydown", keyDown);
  }, [active, onActivate, onArchive, onCreate, onMove]);

  function stagePoint(event) {
    const box = rootRef.current?.getBoundingClientRect();
    return {
      x: event.clientX - (box?.left || 0) - (box?.width || innerWidth) / 2,
      y: event.clientY - (box?.top || 0) - (box?.height || innerHeight) / 2,
    };
  }

  function pointerDown(event, orb) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      id: orb.id,
      pointerId: event.pointerId,
      point: stagePoint(event),
      start: orb.placement,
      moved: false,
    };
  }

  function pointerMove(event) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const point = stagePoint(event);
    const dx = point.x - drag.point.x;
    const dy = point.y - drag.point.y;
    if (Math.hypot(dx, dy) > 3) drag.moved = true;
    if (drag.moved) onMove?.(drag.id, { x: drag.start.x + dx, y: drag.start.y + dy });
  }

  function pointerUp(event, orb) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag?.moved) onActivate?.(activeId === orb.id ? null : orb.id);
  }

  function drop(event, targetOrb) {
    const portable = event.dataTransfer?.getData(PAYLOAD);
    if (!portable) return;
    event.preventDefault();
    event.stopPropagation();
    try {
      const source = JSON.parse(portable);
      if (source.kind === "semantic-orb") {
        if (source.id !== targetOrb.id) setComposition({ sourceId: source.id, targetId: targetOrb.id });
      } else if (["move", "function", "operator"].includes(source.kind || source.type || source.libraryKind)) {
        onBind?.(targetOrb.id, {
          kind: source.libraryKind || source.kind || source.type,
          refs: [source.id],
          label: source.name || source.label || "Bound object",
        });
      } else if (["lens", "generator"].includes(source.kind || source.type)) {
        onApplyLens?.(targetOrb.id, source);
      } else {
        onAddContext?.(targetOrb.id, source);
      }
    } catch {
      // Typed payloads only. Plain text remains available to the primary orb.
    }
  }

  const visible = clusters.flatMap((cluster) => {
    if (cluster.count === 1) return [{ orb: orbs.find((orb) => orb.id === cluster.orbIds[0]), display: null }];
    if (expandedCluster !== cluster.id) return [{ cluster, orb: null }];
    return cluster.orbIds.map((id, index) => ({
      orb: orbs.find((orb) => orb.id === id),
      display: {
        x: cluster.x + Math.cos(index * 2.3999632297) * (54 + index * 4),
        y: cluster.y + Math.sin(index * 2.3999632297) * (54 + index * 4),
      },
    }));
  }).filter((entry) => entry.orb || entry.cluster);

  return <section
    ref={rootRef}
    className="semantic-orb-layer"
    aria-label="Pearls"
    data-scene-id={sceneId}
    onDoubleClick={(event) => {
      if (event.target !== event.currentTarget) return;
      onCreate?.({ placement: stagePoint(event) });
    }}
  >
    <button className="semantic-orb-new" type="button" onClick={() => onCreate?.({ placement: { x: 0, y: 0 } })}>
      <span>+</span> New pearl
    </button>
    {visible.map(({ orb, cluster, display }) => cluster
      ? <button
          type="button"
          className="semantic-orb-cluster"
          key={cluster.id}
          style={{ "--semantic-x": `${cluster.x}px`, "--semantic-y": `${cluster.y}px` }}
          onClick={() => setExpandedCluster(cluster.id)}
          aria-label={`Open cluster of ${cluster.count} pearls`}
        ><OrbGlyph /><b>{cluster.count}</b></button>
      : <div
          className={`semantic-orb-capsule ${activeId === orb.id ? "active" : ""}`}
          key={orb.id}
          style={{
            "--semantic-x": `${display?.x ?? orb.placement.x}px`,
            "--semantic-y": `${display?.y ?? orb.placement.y}px`,
          }}
          data-semantic-orb-id={orb.id}
          data-semantic-anchor={`semantic-orb:${orb.id}`}
        >
          <button
            type="button"
            className="semantic-orb-button"
            aria-label={`${labelFor(orb)}, ${orb.representation?.kind || "empty"} pearl${activeId === orb.id ? ", active" : ""}`}
            aria-pressed={activeId === orb.id}
            draggable="true"
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "copyMove";
              event.dataTransfer.setData("text/plain", labelFor(orb));
              event.dataTransfer.setData(PAYLOAD, JSON.stringify(orb));
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => drop(event, orb)}
            onPointerDown={(event) => pointerDown(event, orb)}
            onPointerMove={pointerMove}
            onPointerUp={(event) => pointerUp(event, orb)}
            onPointerCancel={() => { dragRef.current = null; }}
          >
            <OrbGlyph active={activeId === orb.id} />
            <span>{labelFor(orb)}</span>
            {(orb.workingSet?.context?.length || 0) > 0 && <i>{orb.workingSet.context.length}</i>}
          </button>
          {activeId === orb.id && <aside className="semantic-orb-inspector" aria-label={`${labelFor(orb)} pearl controls`}>
            <form onSubmit={(event) => {
              event.preventDefault();
              if (rename.trim() && rename.trim() !== orb.name) onRename?.(orb.id, rename.trim());
            }}>
              <input aria-label="Orb name" value={rename} onChange={(event) => setRename(event.target.value)} />
              <button type="submit">Rename</button>
            </form>
            <small>{orb.representation?.kind || "empty"} · {orb.workingSet?.context?.length || 0} context · {orb.workingSet?.lenses?.length || 0} Lenses</small>
            {(orb.workingSet?.context || []).length > 0 && <ul className="semantic-orb-inspector-list" aria-label="Orb context">
              {orb.workingSet.context.slice(0, 6).map((item) => <li key={item.id}>
                <span>{item.label || item.name || item.text || "Context material"}</span>
                <button type="button" onClick={() => onRemoveContext?.(orb.id, item.id)}>Remove</button>
              </li>)}
            </ul>}
            {(orb.workingSet?.lenses || []).length > 0 && <ul className="semantic-orb-inspector-list" aria-label="Orb Lenses">
              {orb.workingSet.lenses.slice(0, 6).map((lens) => <li key={lens.id}>
                <span>{lens.name || lens.label || "Lens"}</span>
                <button type="button" onClick={() => onRemoveLens?.(orb.id, lens.id)}>Remove</button>
              </li>)}
            </ul>}
            <div className="semantic-orb-inspector-actions">
              <button type="button" onClick={() => onDuplicate?.(orb.id)}>Duplicate</button>
              <button type="button" disabled={(orb.sourceIds?.length || orb.representation?.refs?.length || 0) < 2} onClick={() => onSplit?.(orb.id)}>Split</button>
              {orb.parentOrbId && <button type="button" onClick={() => onUnnest?.(orb.id)}>Unnest</button>}
              <button type="button" onClick={() => onActivate?.(null)}>Close</button>
              <button type="button" onClick={() => onArchive?.(orb.id, true)}>Archive</button>
            </div>
            {confirmDelete === orb.id
              ? <div className="semantic-orb-delete-confirm" role="alert">
                  <span>Delete this pearl? Referenced source material remains.</span>
                  <button type="button" onClick={() => { onDelete?.(orb.id); setConfirmDelete(null); }}>Delete</button>
                  <button type="button" onClick={() => setConfirmDelete(null)}>Cancel</button>
                </div>
              : <button className="semantic-orb-delete" type="button" onClick={() => setConfirmDelete(orb.id)}>Delete pearl…</button>}
          </aside>}
        </div>)}
    {composition && <aside className="semantic-orb-compose-chooser" role="dialog" aria-label="Combine pearls">
      <b>Combine these pearls</b>
      <button type="button" onClick={() => { onNest?.(composition.sourceId, composition.targetId); setComposition(null); }}>Nest</button>
      <button type="button" onClick={() => { onMerge?.([composition.sourceId, composition.targetId]); setComposition(null); }}>Merge</button>
      <button type="button" onClick={() => { onCompose?.([composition.sourceId, composition.targetId]); setComposition(null); }}>Compose</button>
      <button type="button" onClick={() => setComposition(null)}>Cancel</button>
    </aside>}
  </section>;
}
